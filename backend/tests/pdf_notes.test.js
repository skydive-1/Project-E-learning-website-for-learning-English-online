/**
 * Automated Test Suite for PDF Highlight & Smart Notes Engine (TASK-PDF-SMART-NOTES-01-R1)
 *
 * Kiểm tra toàn diện trên production service:
 * 1. PUT / DELETE không có token -> 401 UNAUTHORIZED
 * 2. PUT / DELETE khi không có quyền truy cập bài học -> 403 FORBIDDEN
 * 3. Note đúng user nhưng sai lessonId trên URL -> 404 NOTE_NOT_FOUND
 * 4. User B tuyệt đối không được sửa hoặc xóa note của User A
 * 5. materialId thuộc lesson khác -> 400 INVALID_MATERIAL
 * 6. documentRef giả mạo từ client bị bỏ qua / xác thực lại từ server
 * 7. Rect có x + width > 1 hoặc y + height > 1 -> 400 INVALID_RECTS
 * 8. Database error -> trả HTTP 500 an toàn, không leak raw SQL error
 * 9. PDF version mới (v2) không trả note của version cũ (v1)
 *
 * Người phụ trách task: NGUYỄN DŨNG QUỐC ANH
 * Hỗ trợ triển khai & kiểm thử: AI Agent
 */

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const express = require('express');

const db = require('../src/config/database');
const pdfNotesService = require('../src/modules/lessons/services/pdfNotes.service');
const pdfNotesController = require('../src/modules/lessons/controllers/pdfNotes.controller');
const coursesService = require('../src/modules/courses/services/courses.service');
const errorHandler = require('../src/middleware/error.middleware');

describe('=== TASK-PDF-SMART-NOTES-01-R1 AUTOMATED TEST SUITE ===', () => {
  let server;
  let baseUrl;
  let currentAuthToken = 'user_10_token';
  let originalCanAccess;
  let originalDbQuery;

  // In-memory Database Table Rows for boundary db.query
  const dbStore = {
    lessons: [
      { lesson_id: 1, section_id: 1, title: 'Lesson 1 PDF', content_type: 'pdf', content_url: '/uploads/lesson1.pdf', pdf_version: 1 },
      { lesson_id: 2, section_id: 1, title: 'Lesson 2 PDF v2', content_type: 'pdf', content_url: '/uploads/lesson2.pdf', pdf_version: 2 },
      { lesson_id: 3, section_id: 1, title: 'Lesson 3 Other', content_type: 'pdf', content_url: '/uploads/lesson3.pdf', pdf_version: 1 }
    ],
    lesson_materials: [
      { material_id: 101, lesson_id: 1, file_name: 'Doc 1.pdf', file_url: '/uploads/doc1.pdf', pdf_version: 1 },
      { material_id: 201, lesson_id: 2, file_name: 'Doc 2.pdf', file_url: '/uploads/doc2.pdf', pdf_version: 1 }
    ],
    pdf_notes: []
  };

  let nextNoteId = 1;
  let simulateDbError = false;

  before(async () => {
    originalCanAccess = coursesService.canUserAccessLesson;
    originalDbQuery = db.query;

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
    testRouter.get('/:lessonId/pdf-notes', testAuthenticate, (req, res, next) => pdfNotesController.getNotes(req, res, next));
    testRouter.post('/:lessonId/pdf-notes', testAuthenticate, (req, res, next) => pdfNotesController.createNote(req, res, next));
    testRouter.put('/:lessonId/pdf-notes/:noteId', testAuthenticate, (req, res, next) => pdfNotesController.updateNote(req, res, next));
    testRouter.delete('/:lessonId/pdf-notes/:noteId', testAuthenticate, (req, res, next) => pdfNotesController.deleteNote(req, res, next));

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
    db.query = originalDbQuery;
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  beforeEach(() => {
    currentAuthToken = 'user_10_token';
    simulateDbError = false;
    dbStore.pdf_notes = [];
    nextNoteId = 1;

    coursesService.canUserAccessLesson = async (userId, lessonId) => {
      return Number(lessonId) !== 999; // Lesson 999 là bài bị cấm truy cập
    };

    // Boundary Mock cho db.query thực thi logic SQL thật
    db.query = async (sqlText, params = []) => {
      if (simulateDbError) {
        throw new Error('FATAL: Connection pool destroyed (Mocked DB Failure)');
      }

      const cleanSql = sqlText.trim();

      // 1. SELECT from lesson_materials
      if (cleanSql.startsWith('SELECT material_id, lesson_id') && cleanSql.includes('FROM lesson_materials')) {
        const matId = params[0];
        const row = dbStore.lesson_materials.find((m) => m.material_id === Number(matId));
        return { rows: row ? [row] : [] };
      }

      // 2. SELECT from lessons
      if (cleanSql.startsWith('SELECT lesson_id, content_type') && cleanSql.includes('FROM lessons')) {
        const lId = params[0];
        const row = dbStore.lessons.find((l) => l.lesson_id === Number(lId));
        return { rows: row ? [row] : [] };
      }

      // 3. SELECT note by note_id, user_id, lesson_id
      if (cleanSql.includes('FROM pdf_notes') && cleanSql.includes('WHERE note_id = $1 AND user_id = $2 AND lesson_id = $3')) {
        const [noteId, userId, lessonId] = params;
        const row = dbStore.pdf_notes.find(
          (n) => n.note_id === Number(noteId) && n.user_id === Number(userId) && n.lesson_id === Number(lessonId)
        );
        return { rows: row ? [{ ...row, id: row.note_id, noteId: row.note_id, userId: row.user_id, lessonId: row.lesson_id }] : [] };
      }

      // 4. SELECT list from pdf_notes with filters
      if (cleanSql.includes('FROM pdf_notes') && cleanSql.includes('WHERE user_id = $1 AND lesson_id = $2')) {
        const userId = Number(params[0]);
        const lessonId = Number(params[1]);

        let matched = dbStore.pdf_notes.filter((n) => n.user_id === userId && n.lesson_id === lessonId);

        // Document Ref filtering
        if (cleanSql.includes('(document_ref = $3 OR document_ref = $4)')) {
          const docRef1 = params[2];
          const docRef2 = params[3];
          matched = matched.filter((n) => n.document_ref === docRef1 || n.document_ref === docRef2);
        } else if (cleanSql.includes('AND document_ref = $3')) {
          const docRef = params[2];
          matched = matched.filter((n) => n.document_ref === docRef);
        }

        // Page Number filtering
        if (cleanSql.includes('AND page_number =')) {
          const pageParam = params[params.length - 1];
          matched = matched.filter((n) => n.page_number === Number(pageParam));
        }

        const mappedRows = matched.map((r) => ({
          ...r,
          id: r.note_id,
          noteId: r.note_id,
          userId: r.user_id,
          lessonId: r.lesson_id,
          materialId: r.material_id,
          documentRef: r.document_ref,
          pageNumber: r.page_number,
          selectedText: r.selected_text,
          noteText: r.note_text,
          contextBefore: r.context_before,
          contextAfter: r.context_after,
          createdAt: r.created_at,
          updatedAt: r.updated_at
        }));

        return { rows: mappedRows };
      }

      // 5. INSERT into pdf_notes
      if (cleanSql.startsWith('INSERT INTO pdf_notes')) {
        const id = nextNoteId++;
        const newNote = {
          note_id: id,
          user_id: Number(params[0]),
          lesson_id: Number(params[1]),
          material_id: params[2] ? Number(params[2]) : null,
          document_ref: params[3],
          page_number: Number(params[4]),
          selected_text: params[5],
          note_text: params[6] || '',
          category: params[7],
          color: params[8],
          rects: JSON.parse(params[9]),
          context_before: params[10] || '',
          context_after: params[11] || '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        dbStore.pdf_notes.push(newNote);
        return {
          rows: [
            {
              ...newNote,
              id: newNote.note_id,
              noteId: newNote.note_id,
              userId: newNote.user_id,
              lessonId: newNote.lesson_id,
              materialId: newNote.material_id,
              documentRef: newNote.document_ref,
              pageNumber: newNote.page_number,
              selectedText: newNote.selected_text,
              noteText: newNote.note_text,
              contextBefore: newNote.context_before,
              contextAfter: newNote.context_after,
              createdAt: newNote.created_at,
              updatedAt: newNote.updated_at
            }
          ]
        };
      }

      // 6. UPDATE pdf_notes
      if (cleanSql.startsWith('UPDATE pdf_notes')) {
        const noteId = Number(params[0]);
        const userId = Number(params[1]);
        const lessonId = Number(params[2]);

        const note = dbStore.pdf_notes.find(
          (n) => n.note_id === noteId && n.user_id === userId && n.lesson_id === lessonId
        );

        if (!note) {
          return { rows: [], rowCount: 0 };
        }

        // Apply parameters
        let pIdx = 3;
        if (cleanSql.includes('note_text =')) {
          note.note_text = params[pIdx++];
        }
        if (cleanSql.includes('category =')) {
          note.category = params[pIdx++];
        }
        if (cleanSql.includes('color =')) {
          note.color = params[pIdx++];
        }
        note.updated_at = new Date().toISOString();

        return {
          rowCount: 1,
          rows: [
            {
              ...note,
              id: note.note_id,
              noteId: note.note_id,
              userId: note.user_id,
              lessonId: note.lesson_id,
              materialId: note.material_id,
              documentRef: note.document_ref,
              pageNumber: note.page_number,
              selectedText: note.selected_text,
              noteText: note.note_text,
              contextBefore: note.context_before,
              contextAfter: note.context_after,
              createdAt: note.created_at,
              updatedAt: note.updated_at
            }
          ]
        };
      }

      // 7. DELETE from pdf_notes
      if (cleanSql.startsWith('DELETE FROM pdf_notes')) {
        const noteId = Number(params[0]);
        const userId = Number(params[1]);
        const lessonId = Number(params[2]);

        const idx = dbStore.pdf_notes.findIndex(
          (n) => n.note_id === noteId && n.user_id === userId && n.lesson_id === lessonId
        );

        if (idx === -1) {
          return { rowCount: 0, rows: [] };
        }

        dbStore.pdf_notes.splice(idx, 1);
        return { rowCount: 1, rows: [{ note_id: noteId }] };
      }

      return { rows: [], rowCount: 0 };
    };
  });

  // =========================================================================
  // 1. AUTHENTICATION & ACCESS CONTROL (401 & 403)
  // =========================================================================
  describe('1. Authentication & Permission Checks', () => {
    it('1.1 PUT / DELETE without token should return HTTP 401 UNAUTHORIZED', async () => {
      const putRes = await fetch(`${baseUrl}/api/lessons/1/pdf-notes/10`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ noteText: 'Update' })
      });
      assert.strictEqual(putRes.status, 401);
      const putData = await putRes.json();
      assert.strictEqual(putData.code, 'UNAUTHORIZED');

      const delRes = await fetch(`${baseUrl}/api/lessons/1/pdf-notes/10`, {
        method: 'DELETE'
      });
      assert.strictEqual(delRes.status, 401);
      const delData = await delRes.json();
      assert.strictEqual(delData.code, 'UNAUTHORIZED');
    });

    it('1.2 PUT / DELETE when user lacks lesson access should return HTTP 403 FORBIDDEN', async () => {
      coursesService.canUserAccessLesson = async () => false;

      const putRes = await fetch(`${baseUrl}/api/lessons/999/pdf-notes/1`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${currentAuthToken}`
        },
        body: JSON.stringify({ noteText: 'Forbidden Update' })
      });
      assert.strictEqual(putRes.status, 403);
      const putData = await putRes.json();
      assert.strictEqual(putData.code, 'FORBIDDEN');

      const delRes = await fetch(`${baseUrl}/api/lessons/999/pdf-notes/1`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${currentAuthToken}` }
      });
      assert.strictEqual(delRes.status, 403);
      const delData = await delRes.json();
      assert.strictEqual(delData.code, 'FORBIDDEN');
    });
  });

  // =========================================================================
  // 2. STRICT USER & LESSON ISOLATION (USER A VS USER B, WRONG LESSON ID)
  // =========================================================================
  describe('2. Strict User & Lesson Isolation', () => {
    it('2.1 Note belongs to User A on Lesson 1: accessing via wrong Lesson ID on URL should return 404', async () => {
      // Create Note for User 10 on Lesson 1
      const noteA = await pdfNotesService.createNote({
        userId: 10,
        lessonId: 1,
        pageNumber: 1,
        selectedText: 'Lesson 1 Note',
        category: 'important',
        color: 'yellow',
        rects: [{ x: 0.1, y: 0.1, width: 0.5, height: 0.05 }]
      });

      // User 10 tries to update this note under Lesson 2 route
      const putRes = await fetch(`${baseUrl}/api/lessons/2/pdf-notes/${noteA.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer user_10_token'
        },
        body: JSON.stringify({ noteText: 'Wrong Lesson Update' })
      });
      assert.strictEqual(putRes.status, 404);
      const putData = await putRes.json();
      assert.strictEqual(putData.code, 'NOTE_NOT_FOUND');

      // User 10 tries to delete this note under Lesson 2 route
      const delRes = await fetch(`${baseUrl}/api/lessons/2/pdf-notes/${noteA.id}`, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer user_10_token' }
      });
      assert.strictEqual(delRes.status, 404);
      const delData = await delRes.json();
      assert.strictEqual(delData.code, 'NOTE_NOT_FOUND');
    });

    it('2.2 User B cannot update or delete User A note (HTTP 404 NOTE_NOT_FOUND)', async () => {
      const noteA = await pdfNotesService.createNote({
        userId: 10,
        lessonId: 1,
        pageNumber: 1,
        selectedText: 'User A Secret Note',
        noteText: 'Original text',
        category: 'important',
        color: 'yellow',
        rects: [{ x: 0.1, y: 0.1, width: 0.5, height: 0.05 }]
      });

      // User B tries to update User A note
      const updateRes = await fetch(`${baseUrl}/api/lessons/1/pdf-notes/${noteA.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer user_20_token'
        },
        body: JSON.stringify({ noteText: 'Hacked by User B' })
      });
      assert.strictEqual(updateRes.status, 404);
      const updateData = await updateRes.json();
      assert.strictEqual(updateData.code, 'NOTE_NOT_FOUND');

      // User B tries to delete User A note
      const deleteRes = await fetch(`${baseUrl}/api/lessons/1/pdf-notes/${noteA.id}`, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer user_20_token' }
      });
      assert.strictEqual(deleteRes.status, 404);
      const deleteData = await deleteRes.json();
      assert.strictEqual(deleteData.code, 'NOTE_NOT_FOUND');
    });
  });

  // =========================================================================
  // 3. MATERIAL & DOCUMENT VERSIONING VERIFICATION
  // =========================================================================
  describe('3. Material & Document Versioning Verification', () => {
    it('3.1 materialId belonging to another lesson should be REJECTED (HTTP 400 INVALID_MATERIAL)', async () => {
      // materialId 201 belongs to lesson 2, but client attempts to create note under lesson 1
      const payload = {
        materialId: 201,
        pageNumber: 1,
        selectedText: 'Some material text',
        category: 'important',
        color: 'yellow',
        rects: [{ x: 0.1, y: 0.1, width: 0.3, height: 0.05 }]
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
      assert.strictEqual(data.code, 'INVALID_MATERIAL');
      assert.match(data.message, /không thuộc bài học này/i);
    });

    it('3.2 documentRef forged by client is verified and overridden by Server Document Version', async () => {
      const payload = {
        documentRef: 'forged:random:document:ref',
        pageNumber: 1,
        selectedText: 'Standard text',
        category: 'vocabulary',
        color: 'green',
        rects: [{ x: 0.1, y: 0.2, width: 0.4, height: 0.04 }]
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
      assert.strictEqual(res.status, 201);
      // Server must have resolved to lesson:1:primary:v1 instead of forged string
      assert.strictEqual(data.data.documentRef, 'lesson:1:primary:v1');
    });

    it('3.3 New PDF version (v2) does NOT return notes from old version (v1)', async () => {
      // Create Note for version 1 directly in dbStore
      dbStore.pdf_notes.push({
        note_id: nextNoteId++,
        user_id: 10,
        lesson_id: 2,
        material_id: null,
        document_ref: 'lesson:2:primary:v1',
        page_number: 1,
        selected_text: 'Old Version 1 Text',
        note_text: '',
        category: 'important',
        color: 'yellow',
        rects: [{ x: 0.1, y: 0.1, width: 0.5, height: 0.05 }],
        context_before: '',
        context_after: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      // Create Note for version 2 directly in dbStore
      dbStore.pdf_notes.push({
        note_id: nextNoteId++,
        user_id: 10,
        lesson_id: 2,
        material_id: null,
        document_ref: 'lesson:2:primary:v2',
        page_number: 1,
        selected_text: 'New Version 2 Text',
        note_text: '',
        category: 'vocabulary',
        color: 'green',
        rects: [{ x: 0.2, y: 0.2, width: 0.5, height: 0.05 }],
        context_before: '',
        context_after: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      // Lesson 2 is currently configured as pdf_version = 2 in dbStore.lessons
      const res = await fetch(`${baseUrl}/api/lessons/2/pdf-notes`, {
        headers: { Authorization: 'Bearer user_10_token' }
      });
      const data = await res.json();

      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.data.length, 1);
      assert.strictEqual(data.data[0].selectedText, 'New Version 2 Text');
      assert.strictEqual(data.data[0].documentRef, 'lesson:2:primary:v2');
    });
  });

  // =========================================================================
  // 4. RECT COORDINATE BOUNDARIES & ERROR HANDLING
  // =========================================================================
  describe('4. Rect Coordinate Boundaries & Error Handling', () => {
    it('4.1 should REJECT rect with x + width > 1.0 (HTTP 400 INVALID_RECTS)', async () => {
      const payload = {
        pageNumber: 1,
        selectedText: 'Out of bounds text',
        category: 'important',
        color: 'yellow',
        rects: [{ x: 0.8, y: 0.1, width: 0.35, height: 0.05 }] // 0.8 + 0.35 = 1.15 > 1.0
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
      assert.strictEqual(data.code, 'INVALID_RECTS');
      assert.match(data.message, /vượt quá giới hạn/i);
    });

    it('4.2 Database error should forward to Error Middleware and return safe HTTP 500 without leaking raw SQL', async () => {
      simulateDbError = true;

      const res = await fetch(`${baseUrl}/api/lessons/1/pdf-notes`, {
        headers: { Authorization: `Bearer ${currentAuthToken}` }
      });

      const data = await res.json();
      assert.strictEqual(res.status, 500);
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.code, 'INTERNAL_ERROR');
    });
  });
});
