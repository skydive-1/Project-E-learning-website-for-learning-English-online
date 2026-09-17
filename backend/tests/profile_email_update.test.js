const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/config/database');
const authService = require('../src/modules/auth/services/auth.service');

describe('User Profile Email Update & Joined Date Verification', () => {
  test('authService.getProfile returns both createdDate and created_date', async () => {
    const originalQuery = db.query;
    db.query = async (sql, params) => {
      if (sql.includes('FROM users WHERE user_id = $1')) {
        return {
          rows: [{
            user_id: 101,
            email: 'user101@example.com',
            username: 'user101',
            full_name: 'User 101',
            birth_date: '2000-01-01',
            phone: '0123456789',
            role_id: 3,
            gender: 'Male',
            created_date: '2026-03-15T08:00:00Z',
            profile_picture_url: null
          }]
        };
      }
      return originalQuery.call(db, sql, params);
    };

    try {
      const profile = await authService.getProfile(101);
      assert.equal(profile.userId, 101);
      assert.equal(profile.email, 'user101@example.com');
      assert.equal(profile.createdDate, '2026-03-15T08:00:00Z');
      assert.equal(profile.created_date, '2026-03-15T08:00:00Z');
    } finally {
      db.query = originalQuery;
    }
  });

  test('authService.updateProfile updates email successfully and returns createdDate', async () => {
    const originalQuery = db.query;
    db.query = async (sql, params) => {
      // 0. Current user lookup
      if (sql.includes('SELECT user_id, email, username, full_name, supabase_uid, created_date FROM users WHERE user_id = $1')) {
        return {
          rows: [{
            user_id: 101,
            email: 'oldemail@example.com',
            username: 'user101',
            full_name: 'User 101',
            supabase_uid: null,
            created_date: '2026-03-15T08:00:00Z'
          }]
        };
      }
      // Check duplicate email
      if (sql.includes('SELECT user_id FROM users WHERE LOWER(email) = $1 AND user_id != $2')) {
        return { rows: [] }; // No duplicate
      }
      // UPDATE query
      if (sql.includes('UPDATE users')) {
        return {
          rows: [{
            user_id: 101,
            email: 'newemail@example.com',
            username: 'user101',
            full_name: 'User 101 Updated',
            profile_picture_url: null,
            phone: null,
            gender: 'Male',
            birth_date: '2000-01-01',
            role_id: 3,
            created_date: '2026-03-15T08:00:00Z'
          }]
        };
      }
      return originalQuery.call(db, sql, params);
    };

    try {
      const updated = await authService.updateProfile({
        userId: 101,
        fullName: 'User 101 Updated',
        email: 'newemail@example.com'
      });

      assert.equal(updated.userId, 101);
      assert.equal(updated.email, 'newemail@example.com');
      assert.equal(updated.fullName, 'User 101 Updated');
      assert.equal(updated.createdDate, '2026-03-15T08:00:00Z');
      assert.equal(updated.created_date, '2026-03-15T08:00:00Z');
    } finally {
      db.query = originalQuery;
    }
  });

  test('authService.updateProfile rejects duplicate email from another user', async () => {
    const originalQuery = db.query;
    db.query = async (sql, params) => {
      if (sql.includes('SELECT user_id, email, username, full_name, supabase_uid, created_date FROM users WHERE user_id = $1')) {
        return {
          rows: [{
            user_id: 101,
            email: 'user101@example.com',
            username: 'user101',
            full_name: 'User 101',
            supabase_uid: null,
            created_date: '2026-03-15T08:00:00Z'
          }]
        };
      }
      if (sql.includes('SELECT user_id FROM users WHERE LOWER(email) = $1 AND user_id != $2')) {
        return { rows: [{ user_id: 102 }] }; // Duplicate exists
      }
      return originalQuery.call(db, sql, params);
    };

    try {
      await assert.rejects(
        async () => {
          await authService.updateProfile({
            userId: 101,
            email: 'taken@example.com'
          });
        },
        (err) => err.status === 400 && err.message.includes('đã được sử dụng')
      );
    } finally {
      db.query = originalQuery;
    }
  });

  test('authService.updateProfile rejects invalid email format', async () => {
    const originalQuery = db.query;
    db.query = async (sql, params) => {
      if (sql.includes('SELECT user_id, email, username, full_name, supabase_uid, created_date FROM users WHERE user_id = $1')) {
        return {
          rows: [{
            user_id: 101,
            email: 'user101@example.com',
            username: 'user101',
            full_name: 'User 101',
            supabase_uid: null,
            created_date: '2026-03-15T08:00:00Z'
          }]
        };
      }
      return originalQuery.call(db, sql, params);
    };

    try {
      await assert.rejects(
        async () => {
          await authService.updateProfile({
            userId: 101,
            email: 'not-an-email'
          });
        },
        (err) => err.status === 400 && err.message.includes('không hợp lệ')
      );
    } finally {
      db.query = originalQuery;
    }
  });
});
