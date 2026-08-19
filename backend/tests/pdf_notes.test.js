/**
 * Automated Test Suite for PDF Highlight & Smart Notes Engine (TASK-PDF-SMART-NOTES-01)
 *
 * Kiểm tra toàn diện:
 * 1. CRUD Ghi chú & Highlight PDF.
 * 2. Xác thực phân quyền truy cập bài học (canUserAccessLesson).
 * 3. Cô lập dữ liệu cá nhân 100% (Strict User Isolation giữa User A và User B).
 * 4. Kiểm tra nghiêm ngặt tọa độ chuẩn hóa (Normalized Rects [0.0, 1.0]).
 * 5. Whitelist danh mục (category) và màu sắc (color).
 *
 * Người phụ trách task: NGUYỄN DŨNG QUỐC ANH
 * Hỗ trợ triển khai & kiểm thử: AI Agent
 */

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const express = require('express');

const pdfNotesService = require('../src/modules/lessons/services/pdfNotes.service');
const pdfNotesController = require('../src/modules/lessons/controllers/pdfNotes.controller');
const coursesService = require('../src/modules/courses/services/courses.service');
const errorHandler = require('../src/middleware/error.middleware');

describe('=== TASK-PDF-SMART-NOTES-01 AUTOMATED TEST SUITE ===', () => {
  let server;
  let baseUrl;
  let currentAuthToken = 'user_10_token';
  let originalCanAccess;

  // In-memory mock database store for testing isolation
  const mockNotesDb = new Map();
  let nextNoteId = 1;

  before(async () => {
    originalCanAccess = coursesService.canUserAccessLesson;

    // Thiết lập Express Test Server
    const app = express();
    app.use(express.json());

    // Test authentication middleware
    const testAuthenticate = (req, res, next) => {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          success: false,
          code: 'UNAUTHORIZED',
          message: 'Yêu cầu đăng nhập để truy cập ghi chú.'
        });
      }

      const token = authHeader.split(' ')[1];
      if (token === 'user_10_token') {
        req.user = { id: 10, userId: 10, roleId: 3, role: 3, email: 'studentA@example.com' };
        return next();
      } else if (token === 'user_20_token') {
        req.user = { id: 20, userId: 20, roleId: 3, role: 3, email: 'studentB@example.com' };
        return next();
      }

      return res.status(401).json({
        success: false,
        code: 'UNAUTHORIZED',
        message: 'Token không hợp lệ.'
      });
    };

    const testRouter = express.Router();
    testRouter.get('/:lessonId/pdf-notes', testAuthenticate, pdfNotesController.getNotes);
    testRouter.post('/:lessonId/pdf-notes', testAuthenticate, pdfNotesController.createNote);
    testRouter.put('/:lessonId/pdf-notes/:noteId', testAuthenticate, pdfNotesController.updateNote);
    testRouter.delete('/:lessonId/pdf-notes/:noteId', testAuthenticate, pdfNotesController.deleteNote);

    app.use('/api/lessons', testRouter);
    app.use(errorHandler);

    await new Promise((resolve) => {
      server = http.createServer(app);
      server.listen(0, '127.0.0.1', () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    coursesService.canUserAccessLesson = originalCanAccess;
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  beforeEach(() => {
    currentAuthToken = 'user_10_token';
    coursesService.canUserAccessLesson = async (userId, lessonId) => {
      return Number(lessonId) !== 999; // Lesson 999 là bài bị cấm truy cập
    };

    mockNotesDb.clear();
    nextNoteId = 1;

    pdfNotesService.getNotes = async ({ userId, lessonId, documentRef, pageNumber }) => {
      const results = [];
      for (const note of mockNotesDb.values()) {
        if (note.userId === Number(userId) && note.lessonId === Number(lessonId)) {
          if (documentRef && note.documentRef !== documentRef) continue;
          if (pageNumber && note.pageNumber !== Number(pageNumber)) continue;
          results.push(note);
        }
      }
      return results;
    };

    pdfNotesService.getNoteById = async (noteId, userId) => {
      const note = mockNotesDb.get(Number(noteId));
      if (note && note.userId === Number(userId)) {
        return note;
      }
      return null;
    };

    pdfNotesService.createNote = async (data) => {
      const {
        userId,
        lessonId,
        materialId,
        documentRef,
        pageNumber,
        selectedText,
        noteText,
        category = 'important',
        color = 'yellow',
        rects,
        contextBefore,
        contextAfter
      } = data;

      const ALLOWED_CATEGORIES = ['important', 'not_understood', 'review', 'vocabulary'];
      const ALLOWED_COLORS = ['yellow', 'green', 'blue', 'pink'];

      if (!ALLOWED_CATEGORIES.includes(category)) {
        throw new Error(`category không hợp lệ. Phải thuộc: ${ALLOWED_CATEGORIES.join(', ')}.`);
      }
      if (!ALLOWED_COLORS.includes(color)) {
        throw new Error(`color không hợp lệ. Phải thuộc: ${ALLOWED_COLORS.join(', ')}.`);
      }

      if (!Array.isArray(rects) || rects.length === 0) {
        throw new Error('Danh sách vùng chọn rects phải là một mảng không rỗng.');
      }
      for (const r of rects) {
        for (const k of ['x', 'y', 'width', 'height']) {
          const v = r[k];
          if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 1) {
            throw new Error(`Tọa độ '${k}' (${v}) phải nằm trong khoảng chuẩn hóa [0.0, 1.0].`);
          }
        }
      }

      const id = nextNoteId++;
      const created = {
        id,
        noteId: id,
        userId: Number(userId),
        lessonId: Number(lessonId),
        materialId: materialId ? Number(materialId) : null,
        documentRef: documentRef || `lesson:${lessonId}:primary`,
        pageNumber: Number(pageNumber),
        selectedText,
        noteText: noteText || '',
        category,
        color,
        rects,
        contextBefore: contextBefore || '',
        contextAfter: contextAfter || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      mockNotesDb.set(id, created);
      return created;
    };

    pdfNotesService.updateNote = async ({ noteId, userId, noteText, category, color }) => {
      const note = mockNotesDb.get(Number(noteId));
      if (!note || note.userId !== Number(userId)) {
        return null;
      }
      if (noteText !== undefined) note.noteText = noteText;
      if (category !== undefined) {
        if (!['important', 'not_understood', 'review', 'vocabulary'].includes(category)) {
          throw new Error('category không hợp lệ.');
        }
        note.category = category;
      }
      if (color !== undefined) {
        if (!['yellow', 'green', 'blue', 'pink'].includes(color)) {
          throw new Error('color không hợp lệ.');
        }
        note.color = color;
      }
      note.updatedAt = new Date().toISOString();
      return note;
    };

    pdfNotesService.deleteNote = async (noteId, userId) => {
      const note = mockNotesDb.get(Number(noteId));
      if (!note || note.userId !== Number(userId)) {
        return false;
      }
      mockNotesDb.delete(Number(noteId));
      return true;
    };
  });

  // =========================================================================
  // 1. AUTHENTICATION & ACCESS CONTROL
  // =========================================================================
  describe('1. Authentication & Permission Checks', () => {
    it('1.1 should return HTTP 401 UNAUTHORIZED when no token/user provided', async () => {
      const res = await fetch(`${baseUrl}/api/lessons/1/pdf-notes`);
      const data = await res.json();

      assert.strictEqual(res.status, 401);
      assert.strictEqual(data.code, 'UNAUTHORIZED');
    });

    it('1.2 should return HTTP 403 FORBIDDEN when user does not have access to the lesson', async () => {
      coursesService.canUserAccessLesson = async () => false;

      const res = await fetch(`${baseUrl}/api/lessons/999/pdf-notes`, {
        headers: { Authorization: `Bearer ${currentAuthToken}` }
      });
      const data = await res.json();

      assert.strictEqual(res.status, 403);
      assert.strictEqual(data.code, 'FORBIDDEN');
    });
  });

  // =========================================================================
  // 2. CREATE PDF NOTE & STRICT VALIDATION
  // =========================================================================
  describe('2. Create PDF Note & Validation Rules', () => {
    it('2.1 should create a PDF note successfully with valid normalized rects (HTTP 201)', async () => {
      const newNotePayload = {
        documentRef: 'lesson:1:primary',
        pageNumber: 2,
        selectedText: 'Communication is essential for daily conversation.',
        noteText: 'Cần ghi nhớ định nghĩa này',
        category: 'important',
        color: 'yellow',
        rects: [
          { x: 0.15, y: 0.32, width: 0.70, height: 0.04 }
        ],
        contextBefore: 'Welcome to Chapter 1. ',
        contextAfter: ' Let us begin.'
      };

      const res = await fetch(`${baseUrl}/api/lessons/1/pdf-notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${currentAuthToken}`
        },
        body: JSON.stringify(newNotePayload)
      });

      const data = await res.json();
      assert.strictEqual(res.status, 201);
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.data.pageNumber, 2);
      assert.strictEqual(data.data.selectedText, 'Communication is essential for daily conversation.');
      assert.strictEqual(data.data.rects[0].x, 0.15);
    });

    it('2.2 should REJECT invalid category not in whitelist (HTTP 400)', async () => {
      const payload = {
        pageNumber: 1,
        selectedText: 'Some text',
        category: 'invalid_category_xyz',
        color: 'yellow',
        rects: [{ x: 0.1, y: 0.1, width: 0.2, height: 0.05 }]
      };

      const res = await fetch(`${baseUrl}/api/lessons/1/pdf-notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${currentAuthToken}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      assert.strictEqual(res.status, 400);
      assert.strictEqual(data.code, 'INVALID_NOTE_DATA');
      assert.match(data.message, /category không hợp lệ/i);
    });

    it('2.3 should REJECT invalid color not in whitelist (HTTP 400)', async () => {
      const payload = {
        pageNumber: 1,
        selectedText: 'Some text',
        category: 'vocabulary',
        color: 'neon-purple',
        rects: [{ x: 0.1, y: 0.1, width: 0.2, height: 0.05 }]
      };

      const res = await fetch(`${baseUrl}/api/lessons/1/pdf-notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${currentAuthToken}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      assert.strictEqual(res.status, 400);
      assert.match(data.message, /color không hợp lệ/i);
    });

    it('2.4 should REJECT out-of-bounds normalized rects (< 0 or > 1) (HTTP 400)', async () => {
      const payload = {
        pageNumber: 1,
        selectedText: 'Some text',
        category: 'review',
        color: 'blue',
        rects: [{ x: -0.5, y: 1.25, width: 0.2, height: 0.05 }]
      };

      const res = await fetch(`${baseUrl}/api/lessons/1/pdf-notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${currentAuthToken}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      assert.strictEqual(res.status, 400);
      assert.match(data.message, /khoảng chuẩn hóa/i);
    });
  });

  // =========================================================================
  // 3. STRICT USER ISOLATION (USER A VS USER B)
  // =========================================================================
  describe('3. Strict User Isolation & CRUD Operations', () => {
    it('3.1 User A should only see their own notes, not User B notes', async () => {
      // Create Note for User 10 (Student A)
      await pdfNotesService.createNote({
        userId: 10,
        lessonId: 1,
        pageNumber: 1,
        selectedText: 'Note by Student A',
        category: 'important',
        color: 'yellow',
        rects: [{ x: 0.1, y: 0.1, width: 0.5, height: 0.05 }]
      });

      // Create Note for User 20 (Student B)
      await pdfNotesService.createNote({
        userId: 20,
        lessonId: 1,
        pageNumber: 1,
        selectedText: 'Note by Student B',
        category: 'review',
        color: 'pink',
        rects: [{ x: 0.2, y: 0.2, width: 0.4, height: 0.05 }]
      });

      // Request as User 10
      const resA = await fetch(`${baseUrl}/api/lessons/1/pdf-notes`, {
        headers: { Authorization: `Bearer user_10_token` }
      });
      const dataA = await resA.json();

      assert.strictEqual(resA.status, 200);
      assert.strictEqual(dataA.data.length, 1);
      assert.strictEqual(dataA.data[0].selectedText, 'Note by Student A');

      // Request as User 20
      const resB = await fetch(`${baseUrl}/api/lessons/1/pdf-notes`, {
        headers: { Authorization: `Bearer user_20_token` }
      });
      const dataB = await resB.json();

      assert.strictEqual(resB.status, 200);
      assert.strictEqual(dataB.data.length, 1);
      assert.strictEqual(dataB.data[0].selectedText, 'Note by Student B');
    });

    it('3.2 User B should NOT be able to update or delete User A note (HTTP 404)', async () => {
      // Create Note owned by User 10
      const noteA = await pdfNotesService.createNote({
        userId: 10,
        lessonId: 1,
        pageNumber: 1,
        selectedText: 'Protected Note',
        noteText: 'Original text',
        category: 'important',
        color: 'yellow',
        rects: [{ x: 0.1, y: 0.1, width: 0.5, height: 0.05 }]
      });

      // Attempt update as User 20
      const updateRes = await fetch(`${baseUrl}/api/lessons/1/pdf-notes/${noteA.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer user_20_token`
        },
        body: JSON.stringify({ noteText: 'Hacked by User B' })
      });
      const updateData = await updateRes.json();

      assert.strictEqual(updateRes.status, 404);
      assert.strictEqual(updateData.code, 'NOTE_NOT_FOUND');

      // Attempt delete as User 20
      const deleteRes = await fetch(`${baseUrl}/api/lessons/1/pdf-notes/${noteA.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer user_20_token` }
      });
      const deleteData = await deleteRes.json();

      assert.strictEqual(deleteRes.status, 404);
      assert.strictEqual(deleteData.code, 'NOTE_NOT_FOUND');

      // Note must still exist for User 10
      const checkNote = await pdfNotesService.getNoteById(noteA.id, 10);
      assert.notStrictEqual(checkNote, null);
      assert.strictEqual(checkNote.noteText, 'Original text');
    });

    it('3.3 Owner can update and delete their own note successfully', async () => {
      const note = await pdfNotesService.createNote({
        userId: 10,
        lessonId: 1,
        pageNumber: 3,
        selectedText: 'My note',
        noteText: 'Initial text',
        category: 'vocabulary',
        color: 'blue',
        rects: [{ x: 0.1, y: 0.1, width: 0.3, height: 0.05 }]
      });

      // Update
      const updateRes = await fetch(`${baseUrl}/api/lessons/1/pdf-notes/${note.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer user_10_token`
        },
        body: JSON.stringify({
          noteText: 'Updated content',
          category: 'review',
          color: 'green'
        })
      });
      const updateData = await updateRes.json();
      assert.strictEqual(updateRes.status, 200);
      assert.strictEqual(updateData.data.noteText, 'Updated content');
      assert.strictEqual(updateData.data.category, 'review');
      assert.strictEqual(updateData.data.color, 'green');

      // Delete
      const deleteRes = await fetch(`${baseUrl}/api/lessons/1/pdf-notes/${note.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer user_10_token` }
      });
      const deleteData = await deleteRes.json();
      assert.strictEqual(deleteRes.status, 200);
      assert.strictEqual(deleteData.success, true);

      // Verify gone
      const verifyRes = await fetch(`${baseUrl}/api/lessons/1/pdf-notes`, {
        headers: { Authorization: `Bearer user_10_token` }
      });
      const verifyData = await verifyRes.json();
      assert.strictEqual(verifyData.data.length, 0);
    });
  });
});
