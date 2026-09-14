const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/config/database');
const authService = require('../src/modules/auth/services/auth.service');
const authController = require('../src/modules/auth/controllers/auth.controller');

describe('User Profile Avatar & Picture URL', () => {
  test('authService.getProfile returns profilePictureUrl when user has an avatar', async () => {
    const originalQuery = db.query;
    db.query = async (sql, params) => {
      if (sql.includes('FROM users WHERE user_id = $1')) {
        return {
          rows: [{
            user_id: 99,
            email: 'testavatar@example.com',
            username: 'testavatar',
            full_name: 'Test Avatar',
            birth_date: '2000-01-01',
            phone: '0123456789',
            role_id: 3,
            gender: 'Other',
            created_date: '2026-01-01T00:00:00Z',
            profile_picture_url: 'https://example.com/avatars/user-99.png'
          }]
        };
      }
      return originalQuery.call(db, sql, params);
    };

    try {
      const profile = await authService.getProfile(99);
      assert.equal(profile.userId, 99);
      assert.equal(profile.profilePictureUrl, 'https://example.com/avatars/user-99.png');
    } finally {
      db.query = originalQuery;
    }
  });

  test('authService.getProfile returns null profilePictureUrl when user has no avatar', async () => {
    const originalQuery = db.query;
    db.query = async (sql, params) => {
      if (sql.includes('FROM users WHERE user_id = $1')) {
        return {
          rows: [{
            user_id: 100,
            email: 'noavatar@example.com',
            username: 'noavatar',
            full_name: 'No Avatar',
            birth_date: null,
            phone: null,
            role_id: 3,
            gender: 'Other',
            created_date: '2026-01-01T00:00:00Z',
            profile_picture_url: null
          }]
        };
      }
      return originalQuery.call(db, sql, params);
    };

    try {
      const profile = await authService.getProfile(100);
      assert.equal(profile.userId, 100);
      assert.equal(profile.profilePictureUrl, null);
    } finally {
      db.query = originalQuery;
    }
  });

  test('authService.uploadAvatar rejects invalid file formats', async () => {
    await assert.rejects(
      async () => {
        await authService.uploadAvatar(99, null);
      },
      (err) => err.status === 400 && err.message.includes('Vui lòng chọn tệp hình ảnh')
    );

    await assert.rejects(
      async () => {
        await authService.uploadAvatar(99, {
          mimetype: 'application/pdf',
          buffer: Buffer.from('%PDF-1.4...'),
          size: 1000
        });
      },
      (err) => err.status === 400 && err.message.includes('Định dạng hình ảnh không hợp lệ')
    );
  });

  test('authService.uploadAvatar succeeds with valid image buffer and updates database', async () => {
    const originalQuery = db.query;
    let updatedUrl = null;

    // Fake valid PNG buffer: 89 50 4E 47 ...
    const fakePng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);

    db.query = async (sql, params) => {
      if (sql.includes('UPDATE users') && sql.includes('SET profile_picture_url = $1')) {
        updatedUrl = params[0];
        return {
          rows: [{
            user_id: 99,
            email: 'testavatar@example.com',
            username: 'testavatar',
            full_name: 'Test Avatar',
            birth_date: '2000-01-01',
            phone: '0123456789',
            role_id: 3,
            gender: 'Other',
            created_date: '2026-01-01T00:00:00Z',
            profile_picture_url: updatedUrl
          }]
        };
      }
      return originalQuery.call(db, sql, params);
    };

    try {
      const result = await authService.uploadAvatar(99, {
        originalname: 'my_avatar.png',
        mimetype: 'image/png',
        buffer: fakePng,
        size: fakePng.length
      });

      assert.ok(result);
      assert.ok(result.profilePictureUrl);
      assert.equal(result.profilePictureUrl, updatedUrl);
      assert.equal(result.userId, 99);
    } finally {
      db.query = originalQuery;
    }
  });

  test('authController.uploadAvatar calls authService and returns 200 JSON', async () => {
    const originalUploadAvatar = authService.uploadAvatar;
    authService.uploadAvatar = async (userId, file) => ({
      userId,
      username: 'controlleruser',
      profilePictureUrl: 'https://cdn.example.com/avatar.png'
    });

    try {
      const req = {
        user: { id: 77 },
        file: { originalname: 'avatar.png' }
      };

      let statusCode = null;
      let responseBody = null;

      const res = {
        status(code) {
          statusCode = code;
          return this;
        },
        json(payload) {
          responseBody = payload;
          return this;
        }
      };

      let nextCalled = false;
      await authController.uploadAvatar(req, res, (err) => {
        nextCalled = true;
      });

      assert.equal(nextCalled, false);
      assert.equal(statusCode, 200);
      assert.equal(responseBody.success, true);
      assert.equal(responseBody.data.profilePictureUrl, 'https://cdn.example.com/avatar.png');
    } finally {
      authService.uploadAvatar = originalUploadAvatar;
    }
  });
});
