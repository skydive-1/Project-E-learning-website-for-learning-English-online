/**
 * Auth Service - Xử lý logic nghiệp vụ xác thực người dùng
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../../../config/database');
const { handleServiceError } = require('../../../utils/service-errors');
const { supabaseAdmin, supabaseClient } = require('../../../config/supabase');
const { createClient } = require('@supabase/supabase-js');

class AuthService {
  async register({ email, username, password, fullName, roleId }) {
    try {
      if (!supabaseAdmin) {
        throw new Error('Supabase Admin client chưa được cấu hình. Vui lòng kiểm tra file .env.');
      }

      // 1. Kiểm tra email trùng lặp trong PostgreSQL cục bộ
      const existingUser = await db.query('SELECT user_id FROM users WHERE email = $1', [email]);
      if (existingUser.rows.length > 0) {
        const error = new Error('Email đã được sử dụng bởi một tài khoản khác');
        error.name = 'ValidationError';
        error.status = 400;
        throw error;
      }

      // Kiểm tra username trùng lặp
      const existingUsername = await db.query('SELECT user_id FROM users WHERE username = $1', [username]);
      if (existingUsername.rows.length > 0) {
        const error = new Error('Tên đăng nhập (username) đã tồn tại');
        error.name = 'ValidationError';
        error.status = 400;
        throw error;
      }

      // Tự động gán Admin cho email được ủy quyền hoặc giới hạn vai trò công khai
      let finalRoleId = parseInt(roleId, 10);
      const adminEmails = ['quocanh26012004@gmail.com', 'bte290904@gmail.com'];
      if (adminEmails.includes(email.toLowerCase())) {
        finalRoleId = 1; // Admin
      } else if (finalRoleId !== 2 && finalRoleId !== 3) {
        finalRoleId = 3; // Chỉ cho phép đăng ký trực tiếp vai trò Student hoặc Instructor
      }

      // 2. Tạo tài khoản trong Supabase Auth bằng Admin SDK (tự động kích hoạt email)
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          username,
          full_name: fullName || username,
          role_id: finalRoleId
        }
      });

      if (authError) {
        throw authError;
      }

      const supabaseUser = authData.user;

      // 3. Lưu thông tin người dùng vào database PostgreSQL (sử dụng supabase_uid)
      const queryText = `
        INSERT INTO users (email, password_hash, username, full_name, role_id, supabase_uid)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING user_id, email, username, full_name, role_id, created_date, supabase_uid
      `;
      const values = [email, '', username, fullName || username, finalRoleId, supabaseUser.id];
      const result = await db.query(queryText, values);

      const newUser = result.rows[0];

      return {
        userId: newUser.user_id,
        email: newUser.email,
        username: newUser.username,
        fullName: newUser.full_name,
        roleId: newUser.role_id,
        createdDate: newUser.created_date,
        supabaseUid: newUser.supabase_uid
      };
    } catch (error) {
      handleServiceError(error, 'Lỗi đăng ký trong AuthService');
    }
  }

  async login({ email, password }) {
    try {
      if (!supabaseClient) {
        throw new Error('Supabase Client chưa được cấu hình. Vui lòng kiểm tra file .env.');
      }

      // 1. Đăng nhập qua Supabase Auth
      let authData;
      let authError;
      try {
        const res = await supabaseClient.auth.signInWithPassword({
          email,
          password
        });
        authData = res.data;
        authError = res.error;
      } catch (err) {
        authError = err;
      }

      let supabaseUser;
      let user;

      if (authError) {
        // Tự động di trú người dùng cũ (Lazy Migration / Shadow Migration):
        // Nếu không đăng nhập được qua Supabase, kiểm tra xem user có tồn tại ở PostgreSQL cục bộ với mật khẩu cũ không
        const localUserQuery = 'SELECT user_id, email, password_hash, username, full_name, role_id, supabase_uid FROM users WHERE email = $1';
        const localUserResult = await db.query(localUserQuery, [email]);

        if (localUserResult.rows.length > 0) {
          const matchedUser = localUserResult.rows[0];
          // Nếu tài khoản cũ chưa được đồng bộ và có password_hash (hệ thống cũ)
          if (matchedUser.password_hash) {
            const isMatch = await bcrypt.compare(password, matchedUser.password_hash);
            if (isMatch) {
              console.log(`[Lazy Migration] Đang di trú tài khoản cũ sang Supabase Auth: ${email}`);
              // Tạo tài khoản trên Supabase Auth bằng Admin SDK
              const { data: migratedData, error: migrateError } = await supabaseAdmin.auth.admin.createUser({
                email,
                password,
                email_confirm: true,
                user_metadata: {
                  username: matchedUser.username,
                  full_name: matchedUser.full_name,
                  role_id: matchedUser.role_id
                }
              });

              if (migrateError) {
                console.error('❌ Lỗi tự động di trú sang Supabase Auth:', migrateError.message);
                const error = new Error('Email hoặc mật khẩu không chính xác');
                error.name = 'AuthError';
                error.status = 401;
                throw error;
              }

              supabaseUser = migratedData.user;
              // Cập nhật supabase_uid vào PostgreSQL cục bộ để liên kết
              await db.query('UPDATE users SET supabase_uid = $1 WHERE user_id = $2', [supabaseUser.id, matchedUser.user_id]);

              user = matchedUser;
              user.supabase_uid = supabaseUser.id;
            } else {
              const error = new Error('Email hoặc mật khẩu không chính xác');
              error.name = 'AuthError';
              error.status = 401;
              throw error;
            }
          } else {
            const error = new Error('Email hoặc mật khẩu không chính xác');
            error.name = 'AuthError';
            error.status = 401;
            throw error;
          }
        } else {
          const error = new Error('Email hoặc mật khẩu không chính xác');
          error.name = 'AuthError';
          error.status = 401;
          throw error;
        }
      } else {
        supabaseUser = authData.user;

        // 2. Tìm kiếm thông tin user cục bộ bằng supabase_uid hoặc email để liên kết
        const queryText = 'SELECT user_id, email, username, full_name, role_id, supabase_uid FROM users WHERE supabase_uid = $1 OR email = $2';
        const result = await db.query(queryText, [supabaseUser.id, email]);

        if (result.rows.length === 0) {
          // Tự động đồng bộ nếu user tồn tại trên Supabase nhưng chưa có ở DB của mình
          const roleId = supabaseUser.user_metadata?.role_id || 3;
          const username = supabaseUser.user_metadata?.username || email.split('@')[0];
          const fullName = supabaseUser.user_metadata?.full_name || username;

          const insertQuery = `
            INSERT INTO users (email, password_hash, username, full_name, role_id, supabase_uid)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING user_id, email, username, full_name, role_id, supabase_uid
          `;
          const insertRes = await db.query(insertQuery, [email, '', username, fullName, roleId, supabaseUser.id]);
          user = insertRes.rows[0];
        } else {
          user = result.rows[0];
          // Nếu user cũ chưa có supabase_uid, tự động cập nhật liên kết
          if (!user.supabase_uid) {
            await db.query('UPDATE users SET supabase_uid = $1 WHERE user_id = $2', [supabaseUser.id, user.user_id]);
            user.supabase_uid = supabaseUser.id;
          }
        }
      }

      // 3. Tạo local JWT Token trả về cho client giống hệ thống cũ
      if (!process.env.JWT_SECRET) {
        throw new Error('JWT_SECRET chưa được cấu hình trên hệ thống');
      }

      const payload = {
        id: user.user_id,
        email: user.email,
        username: user.username,
        roleId: user.role_id
      };

      const token = jwt.sign(payload, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRE || '24h'
      });

      return {
        token,
        user: {
          userId: user.user_id,
          email: user.email,
          username: user.username,
          fullName: user.full_name,
          roleId: user.role_id
        }
      };
    } catch (error) {
      handleServiceError(error, 'Lỗi đăng nhập trong AuthService');
    }
  }

  async getProfile(userId) {
    try {
      // Lấy thông tin chi tiết người dùng từ database theo cấu trúc mới
      const queryText = 'SELECT user_id, email, username, full_name, birth_date, phone, role_id, gender, created_date FROM users WHERE user_id = $1';
      const result = await db.query(queryText, [userId]);

      if (result.rows.length === 0) {
        const error = new Error('Không tìm thấy tài khoản người dùng');
        error.name = 'AuthError';
        error.status = 404;
        throw error;
      }

      const user = result.rows[0];
      return {
        userId: user.user_id,
        email: user.email,
        username: user.username,
        fullName: user.full_name,
        birthDate: user.birth_date,
        phone: user.phone,
        roleId: user.role_id,
        gender: user.gender,
        createdDate: user.created_date
      };
    } catch (error) {
      handleServiceError(error, 'Lỗi lấy thông tin cá nhân trong AuthService');
    }
  }

  async changePassword({ userId, oldPassword, newPassword }) {
    try {
      if (!supabaseAdmin || !supabaseClient) {
        throw new Error('Supabase clients chưa được cấu hình. Vui lòng kiểm tra file .env.');
      }

      // 1. Lấy thông tin user cục bộ
      const queryText = 'SELECT email, supabase_uid FROM users WHERE user_id = $1';
      const result = await db.query(queryText, [userId]);

      if (result.rows.length === 0) {
        const error = new Error('Không tìm thấy tài khoản người dùng');
        error.name = 'AuthError';
        error.status = 404;
        throw error;
      }

      const user = result.rows[0];
      if (!user.supabase_uid) {
        const error = new Error('Tài khoản chưa được liên kết với Supabase. Hãy đăng xuất và đăng nhập lại.');
        error.name = 'AuthError';
        error.status = 400;
        throw error;
      }

      // 2. Xác thực mật khẩu cũ bằng cách thử đăng nhập Supabase
      const { error: signInError } = await supabaseClient.auth.signInWithPassword({
        email: user.email,
        password: oldPassword
      });

      if (signInError) {
        const error = new Error('Mật khẩu cũ không chính xác');
        error.name = 'ValidationError';
        error.status = 400;
        throw error;
      }

      // 3. Cập nhật mật khẩu mới trên Supabase
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user.supabase_uid, {
        password: newPassword
      });

      if (updateError) {
        throw new Error('Không thể cập nhật mật khẩu mới trên Supabase: ' + updateError.message);
      }

      return true;
    } catch (error) {
      handleServiceError(error, 'Lỗi khi thay đổi mật khẩu trong AuthService');
    }
  }

  async updateProfile({ userId, username, fullName, profilePictureUrl, phone, gender, birthDate }) {
    try {
      // 1. Kiểm tra username trùng lặp nếu có đổi
      if (username) {
        const existingUser = await db.query('SELECT user_id FROM users WHERE username = $1 AND user_id != $2', [username, userId]);
        if (existingUser.rows.length > 0) {
          const error = new Error('Tên người dùng đã được sử dụng');
          error.name = 'ValidationError';
          error.status = 400;
          throw error;
        }
      }

      // 2. Tạo câu query động để cập nhật
      const updates = [];
      const values = [];
      let paramIndex = 1;

      if (username) {
        updates.push(`username = $${paramIndex++}`);
        values.push(username);
      }
      if (fullName) {
        updates.push(`full_name = $${paramIndex++}`);
        values.push(fullName);
      }
      if (profilePictureUrl !== undefined) {
        updates.push(`profile_picture_url = $${paramIndex++}`);
        values.push(profilePictureUrl);
      }
      if (phone !== undefined) {
        updates.push(`phone = $${paramIndex++}`);
        values.push(phone);
      }
      if (gender !== undefined) {
        updates.push(`gender = $${paramIndex++}`);
        values.push(gender);
      }
      if (birthDate !== undefined) {
        updates.push(`birth_date = $${paramIndex++}`);
        // Xử lý giá trị trống hoặc null
        values.push(birthDate === '' ? null : birthDate);
      }

      if (updates.length === 0) {
        const error = new Error('Không có thông tin nào để cập nhật');
        error.name = 'ValidationError';
        error.status = 400;
        throw error;
      }

      values.push(userId);
      const queryText = `
        UPDATE users 
        SET ${updates.join(', ')} 
        WHERE user_id = $${paramIndex}
        RETURNING user_id, email, username, full_name, profile_picture_url, phone, gender, birth_date, role_id
      `;

      const result = await db.query(queryText, values);
      if (result.rows.length === 0) {
        const error = new Error('Không tìm thấy tài khoản người dùng');
        error.name = 'AuthError';
        error.status = 404;
        throw error;
      }

      const updatedUser = result.rows[0];
      return {
        userId: updatedUser.user_id,
        email: updatedUser.email,
        username: updatedUser.username,
        fullName: updatedUser.full_name,
        profilePictureUrl: updatedUser.profile_picture_url,
        phone: updatedUser.phone,
        gender: updatedUser.gender,
        birthDate: updatedUser.birth_date,
        roleId: updatedUser.role_id
      };
    } catch (error) {
      handleServiceError(error, 'Lỗi cập nhật profile trong AuthService');
    }
  }

  async syncGoogleUserWithSupabase(email, fullName, profilePictureUrl) {
    if (!supabaseAdmin) {
      console.warn('⚠️ Supabase Admin client chưa cấu hình, bỏ qua đồng bộ Supabase cho user Google');
      return null;
    }
    try {
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          profile_picture_url: profilePictureUrl
        }
      });

      if (error) {
        if (error.message.includes('already registered') || error.status === 422) {
          const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers();
          if (!listError) {
            const found = listData.users.find(u => u.email === email);
            if (found) return found;
          }
        }
        throw error;
      }
      return data.user;
    } catch (err) {
      console.error('Lỗi khi sync user Google với Supabase Auth:', err.message);
      return null;
    }
  }

  async googleLogin(tokenData) {
    try {
      let token = tokenData;
      let isAccessToken = false;

      if (tokenData && typeof tokenData === 'object') {
        token = tokenData.token;
        isAccessToken = tokenData.isAccessToken;
      }

      let url = `https://oauth2.googleapis.com/tokeninfo?id_token=${token}`;
      if (isAccessToken) {
        url = `https://www.googleapis.com/oauth2/v3/userinfo?access_token=${token}`;
      }

      const response = await fetch(url);
      if (!response.ok) {
        const error = new Error('Mã token Google không hợp lệ hoặc đã hết hạn');
        error.name = 'ValidationError';
        error.status = 400;
        throw error;
      }

      const payload = await response.json();
      if (payload.error_description) {
        const error = new Error(payload.error_description);
        error.name = 'ValidationError';
        error.status = 400;
        throw error;
      }

      const email = payload.email;
      const fullName = payload.name || payload.given_name || 'Google User';
      const profilePictureUrl = payload.picture || null;

      // Đồng bộ user lên Supabase Auth
      const supabaseUser = await this.syncGoogleUserWithSupabase(email, fullName, profilePictureUrl);

      // Automatically register/update admin emails as Admin (role_id = 1)
      const adminEmails = ['quocanh26012004@gmail.com', 'bte290904@gmail.com'];
      if (adminEmails.includes(email.toLowerCase())) {
        const checkResult = await db.query(
          'SELECT user_id, email, username, full_name, role_id FROM users WHERE email = $1',
          [email]
        );

        if (checkResult.rows.length === 0) {
          let username = email.split('@')[0];
          const checkUsername = await db.query('SELECT user_id FROM users WHERE username = $1', [username]);
          if (checkUsername.rows.length > 0) {
            username = `${username}_${Math.floor(1000 + Math.random() * 9000)}`;
          }

          const insertQuery = `
            INSERT INTO users (email, password_hash, username, full_name, role_id, profile_picture_url, supabase_uid)
            VALUES ($1, $2, $3, $4, 1, $5, $6)
            RETURNING user_id, email, username, full_name, role_id, profile_picture_url
          `;
          await db.query(insertQuery, [email, '', username, fullName, profilePictureUrl, supabaseUser ? supabaseUser.id : null]);
          console.log(`[Google Auth] Auto-registered admin: ${email}`);
        } else {
          const updateQuery = supabaseUser
            ? 'UPDATE users SET role_id = 1, supabase_uid = $2 WHERE email = $1'
            : 'UPDATE users SET role_id = 1 WHERE email = $1';

          const params = supabaseUser ? [email, supabaseUser.id] : [email];
          await db.query(updateQuery, params);
          console.log(`[Google Auth] Auto-promoted existing user to admin: ${email}`);
        }
      }

      const result = await db.query(
        'SELECT user_id, email, username, full_name, role_id, supabase_uid FROM users WHERE email = $1',
        [email]
      );

      if (result.rows.length > 0) {
        const user = result.rows[0];

        // Nếu user đã có ở DB cục bộ nhưng chưa lưu supabase_uid, tiến hành cập nhật liên kết
        if (!user.supabase_uid && supabaseUser) {
          await db.query('UPDATE users SET supabase_uid = $1 WHERE user_id = $2', [supabaseUser.id, user.user_id]);
          user.supabase_uid = supabaseUser.id;
        }

        const jwtPayload = {
          id: user.user_id,
          email: user.email,
          username: user.username,
          roleId: user.role_id
        };

        const token = jwt.sign(jwtPayload, process.env.JWT_SECRET, {
          expiresIn: process.env.JWT_EXPIRE || '24h'
        });

        return {
          isNewUser: false,
          token,
          user: {
            userId: user.user_id,
            email: user.email,
            username: user.username,
            fullName: user.full_name,
            roleId: user.role_id
          }
        };
      }

      const tempPayload = {
        email,
        fullName,
        profilePictureUrl
      };

      const tempToken = jwt.sign(tempPayload, process.env.JWT_SECRET, {
        expiresIn: '15m'
      });

      return {
        isNewUser: true,
        tempToken,
        email,
        fullName,
        profilePictureUrl
      };
    } catch (error) {
      handleServiceError(error, 'Lỗi googleLogin trong AuthService');
    }
  }

  async googleConfirmRole({ tempToken, roleId }) {
    try {
      let decoded;
      try {
        decoded = jwt.verify(tempToken, process.env.JWT_SECRET);
      } catch (err) {
        const error = new Error('Liên kết chọn vai trò đã hết hạn hoặc không hợp lệ');
        error.status = 400;
        throw error;
      }

      const { email, fullName, profilePictureUrl } = decoded;

      let targetRoleId = parseInt(roleId, 10);
      const adminEmails = ['quocanh26012004@gmail.com', 'bte290904@gmail.com'];
      if (adminEmails.includes(email.toLowerCase())) {
        targetRoleId = 1; // Admin
      } else if (targetRoleId !== 2 && targetRoleId !== 3) {
        const error = new Error('Vai trò người dùng chọn không hợp lệ');
        error.status = 400;
        throw error;
      }

      const checkUser = await db.query('SELECT user_id FROM users WHERE email = $1', [email]);
      if (checkUser.rows.length > 0) {
        const error = new Error('Tài khoản với email này đã tồn tại');
        error.status = 400;
        throw error;
      }

      let username = email.split('@')[0];
      const checkUsername = await db.query('SELECT user_id FROM users WHERE username = $1', [username]);
      if (checkUsername.rows.length > 0) {
        username = `${username}_${Math.floor(1000 + Math.random() * 9000)}`;
      }

      // Tạo tài khoản trên Supabase Auth
      const supabaseUser = await this.syncGoogleUserWithSupabase(email, fullName, profilePictureUrl);

      const queryText = `
        INSERT INTO users (email, password_hash, username, full_name, role_id, profile_picture_url, supabase_uid)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING user_id, email, username, full_name, role_id, profile_picture_url, created_date
      `;
      const values = [email, '', username, fullName, targetRoleId, profilePictureUrl, supabaseUser ? supabaseUser.id : null];
      const result = await db.query(queryText, values);
      const newUser = result.rows[0];

      const jwtPayload = {
        id: newUser.user_id,
        email: newUser.email,
        username: newUser.username,
        roleId: newUser.role_id
      };

      const token = jwt.sign(jwtPayload, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRE || '24h'
      });

      return {
        token,
        user: {
          userId: newUser.user_id,
          email: newUser.email,
          username: newUser.username,
          fullName: newUser.full_name,
          roleId: newUser.role_id,
          profilePictureUrl: newUser.profile_picture_url
        }
      };
    } catch (error) {
      handleServiceError(error, 'Lỗi googleConfirmRole trong AuthService');
    }
  }

  async forgotPassword(email) {
    try {
      if (!supabaseClient) {
        throw new Error('Supabase Client chưa được cấu hình. Vui lòng kiểm tra file .env.');
      }
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const redirectTo = `${frontendUrl}/reset-password`;

      const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
        redirectTo
      });

      if (error) {
        const err = new Error(error.message);
        err.status = 400;
        throw err;
      }
      return true;
    } catch (error) {
      handleServiceError(error, 'Lỗi gửi yêu cầu khôi phục mật khẩu trong AuthService');
    }
  }

  async resetPassword({ accessToken, newPassword }) {
    try {
      if (!supabaseClient) {
        throw new Error('Supabase Client chưa được cấu hình. Vui lòng kiểm tra file .env.');
      }
      if (!supabaseAdmin) {
        throw new Error('Supabase Admin Client chưa được cấu hình. Vui lòng kiểm tra file .env.');
      }

      // 1. Xác thực access token và lấy thông tin user từ Supabase
      const { data: { user }, error: userError } = await supabaseClient.auth.getUser(accessToken);

      if (userError || !user) {
        const error = new Error('Token khôi phục không hợp lệ hoặc đã hết hạn');
        error.status = 400;
        throw error;
      }

      // 2. Cập nhật mật khẩu mới bằng Admin SDK (bỏ qua session phức tạp)
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
        password: newPassword
      });

      if (updateError) {
        const error = new Error(updateError.message);
        error.status = 400;
        throw error;
      }

      return true;
    } catch (error) {
      handleServiceError(error, 'Lỗi đặt lại mật khẩu mới trong AuthService');
    }
  }
}

module.exports = new AuthService();
