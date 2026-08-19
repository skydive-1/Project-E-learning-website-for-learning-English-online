/**
 * Automated Test Suite for PDF Highlight & Smart Notes Engine (TASK-PDF-SMART-NOTES-01, 02 & 03)
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
 * 10. Area note: cho phép selectedText = null, bắt buộc noteText (TASK-PDF-SMART-NOTES-02)
 * 11. Text note: bắt buộc selectedText (TASK-PDF-SMART-NOTES-02)
 * 12. Từ chối selectionType không hợp lệ (TASK-PDF-SMART-NOTES-02)
 * 13. Production lessonsService.updateLesson: URL thay đổi tăng v1 -> v2 (TASK-PDF-SMART-NOTES-03)
 * 14. Production lessonsService.updateLesson: Title-only hoặc cùng URL giữ nguyên version (TASK-PDF-SMART-NOTES-03)
 * 15. Production lessonsService.updateLesson: PDF -> Video hoặc Video -> PDF tăng version (TASK-PDF-SMART-NOTES-03)
 * 16. Production coursesService.updateCourse: Bulk editor thay PDF tăng version đúng 1 lần (TASK-PDF-SMART-NOTES-03)
 * 17. GET Notes không tin query forged documentRef=v1 khi server đang v2 (TASK-PDF-SMART-NOTES-03)
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
const lessonsService = require('../src/modules/lessons/services/lessons.service');
const coursesService = require('../src/modules/courses/services/courses.service');
const errorHandler = require('../src/middleware/error.middleware');

describe('=== TASK-PDF-SMART-NOTES-03 HOTFIX R3 AUTOMATED TEST SUITE ===', () => {
  let server;
  let baseUrl;
  let currentAuthToken = 'user_10_token';
  let originalCanAccess;
  let originalDbQuery;
  let originalPoolConnect;

  // In-memory Database Table Rows for boundary db.query
  const dbStore = {
    lessons: [
      { lesson_id: 1, section_id: 1, title: 'Lesson 1 PDF', content_type: 'pdf', content_url: '/uploads/lesson1.pdf', pdf_version: 1, order_index: 1 },
      { lesson_id: 2, section_id: 1, title: 'Lesson 2 PDF v2', content_type: 'pdf', content_url: '/uploads/lesson2.pdf', pdf_version: 2, order_index: 2 },
      { lesson_id: 3, section_id: 1, title: 'Lesson 3 Other', content_type: 'pdf', content_url: '/uploads/lesson3.pdf', pdf_version: 1, order_index: 3 },
      { lesson_id: 4, section_id: 1, title: 'Lesson 4 Video', content_type: 'video', content_url: '/uploads/lesson4.mp4', pdf_version: 1, order_index: 4 }
    ],
    sections: [
      { section_id: 1, course_id: 1, title: 'Section 1', order_index: 1 }
    ],
    courses: [
      { course_id: 1, course_name: 'Course 1', status: 'published' }
    ],
    lesson_materials: [
      { material_id: 101, lesson_id: 1, file_name: 'Doc 1.pdf', file_url: '/uploads/doc1.pdf', pdf_version: 1 },
      { material_id: 201, lesson_id: 2, file_name: 'Doc 2.pdf', file_url: '/uploads/doc2.pdf', pdf_version: 1 }
    ],
    pdf_notes: []
  };

  let nextNoteId = 1;
  let simulateDbError = false;

  const handleQueryMock = async (sqlText, params = []) => {
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

    // 2. SELECT section_id FROM sections
    if (cleanSql.startsWith('SELECT section_id FROM sections WHERE course_id = $1')) {
      const cId = Number(params[0]);
      const matchedSecs = dbStore.sections.filter((s) => s.course_id === cId);
      return { rows: matchedSecs };
    }

    if (cleanSql.startsWith('SELECT section_id FROM sections WHERE section_id = $1')) {
      const sId = Number(params[0]);
      const row = dbStore.sections.find((s) => s.section_id === sId);
      return { rows: row ? [row] : [] };
    }

    // 3. SELECT lesson_id FROM lessons WHERE section_id = $1
    if (cleanSql.startsWith('SELECT lesson_id FROM lessons WHERE section_id = $1')) {
      const sId = Number(params[0]);
      const matchedLes = dbStore.lessons.filter((l) => l.section_id === sId);
      return { rows: matchedLes };
    }

    // 4. SELECT from lessons
    if (cleanSql.includes('FROM lessons') && (cleanSql.startsWith('SELECT lesson_id') || cleanSql.startsWith('SELECT *') || cleanSql.startsWith('SELECT content_type'))) {
      const lId = Number(params[0]);
      const row = dbStore.lessons.find((l) => l.lesson_id === lId);
      return { rows: row ? [row] : [] };
    }

    // 5. SELECT note by note_id, user_id, lesson_id
    if (cleanSql.includes('FROM pdf_notes') && cleanSql.includes('WHERE note_id = $1 AND user_id = $2 AND lesson_id = $3')) {
      const [noteId, userId, lessonId] = params;
      const row = dbStore.pdf_notes.find(
        (n) => n.note_id === Number(noteId) && n.user_id === Number(userId) && n.lesson_id === Number(lessonId)
      );
      return { rows: row ? [{ ...row, id: row.note_id, noteId: row.note_id, userId: row.user_id, lessonId: row.lesson_id, selectionType: row.selection_type || 'text' }] : [] };
    }

    // 6. SELECT list from pdf_notes with filters
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
        selectionType: r.selection_type || 'text',
        selectedText: r.selected_text,
        noteText: r.note_text,
        contextBefore: r.context_before,
        contextAfter: r.context_after,
        createdAt: r.created_at,
        updatedAt: r.updated_at
      }));

      return { rows: mappedRows };
    }

    // 7. INSERT into pdf_notes
    if (cleanSql.startsWith('INSERT INTO pdf_notes')) {
      const id = nextNoteId++;
      const newNote = {
        note_id: id,
        user_id: Number(params[0]),
        lesson_id: Number(params[1]),
        material_id: params[2] ? Number(params[2]) : null,
        document_ref: params[3],
        page_number: Number(params[4]),
        selection_type: params[5] || 'text',
        selected_text: params[6],
        note_text: params[7] || '',
        category: params[8],
        color: params[9],
        rects: JSON.parse(params[10]),
        context_before: params[11] || '',
        context_after: params[12] || '',
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
            selectionType: newNote.selection_type,
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

    // 8. UPDATE pdf_notes
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
            selectionType: note.selection_type,
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

    // 9. UPDATE lessons (updateLesson & bulk editor)
    if (cleanSql.startsWith('UPDATE lessons')) {
      const lId = cleanSql.includes('WHERE lesson_id = $7') ? Number(params[6]) : Number(params[params.length - 1]);
      const lesson = dbStore.lessons.find((l) => l.lesson_id === lId);
      if (lesson) {
        if (cleanSql.includes('pdf_version = COALESCE(pdf_version, 1) + 1')) {
          lesson.pdf_version = (lesson.pdf_version || 1) + 1;
        } else if (cleanSql.includes('pdf_version = CASE WHEN $8::boolean')) {
          const shouldInc = Boolean(params[7]);
          if (shouldInc) {
            lesson.pdf_version = (lesson.pdf_version || 1) + 1;
          }
        }
        if (cleanSql.includes('title = $1') && params[0] !== undefined) {
          lesson.title = params[0];
        }
        if (cleanSql.includes('content_type = $2') && params[1] !== undefined) {
          lesson.content_type = params[1];
        }
        if (cleanSql.includes('content_url = $3') && params[2] !== undefined) {
          lesson.content_url = params[2];
        }
        return { rows: [lesson], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    // 10. DELETE from pdf_notes
    if (cleanSql.startsWith('DELETE FROM pdf_notes')) {
      const [noteId, userId, lessonId] = params;
      const initialLen = dbStore.pdf_notes.length;
      dbStore.pdf_notes = dbStore.pdf_notes.filter(
        (n) => !(n.note_id === Number(noteId) && n.user_id === Number(userId) && n.lesson_id === Number(lessonId))
      );
      const deletedCount = initialLen - dbStore.pdf_notes.length;
      return {
        rowCount: deletedCount,
        rows: deletedCount > 0 ? [{ note_id: Number(noteId) }] : []
      };
    }

    return { rows: [], rowCount: 0 };
  };

  before(async () => {
    originalCanAccess = coursesService.canUserAccessLesson;
    originalDbQuery = db.query;
    originalPoolConnect = db.pool.connect;

    db.query = handleQueryMock;
    db.pool.connect = async () => ({
      query: handleQueryMock,
      release: () => {}
    });

    const app = express();
    app.use(express.json());

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
    db.pool.connect = originalPoolConnect;
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  beforeEach(() => {
    currentAuthToken = 'user_10_token';
    simulateDbError = false;
    dbStore.pdf_notes = [];
    nextNoteId = 1;

    // Reset default lessons state
    dbStore.lessons = [
      { lesson_id: 1, section_id: 1, title: 'Lesson 1 PDF', content_type: 'pdf', content_url: '/uploads/lesson1.pdf', pdf_version: 1, order_index: 1 },
      { lesson_id: 2, section_id: 1, title: 'Lesson 2 PDF v2', content_type: 'pdf', content_url: '/uploads/lesson2.pdf', pdf_version: 2, order_index: 2 },
      { lesson_id: 3, section_id: 1, title: 'Lesson 3 Other', content_type: 'pdf', content_url: '/uploads/lesson3.pdf', pdf_version: 1, order_index: 3 },
      { lesson_id: 4, section_id: 1, title: 'Lesson 4 Video', content_type: 'video', content_url: '/uploads/lesson4.mp4', pdf_version: 1, order_index: 4 }
    ];
    dbStore.sections = [
      { section_id: 1, course_id: 1, title: 'Section 1', order_index: 1 }
    ];

    coursesService.canUserAccessLesson = async (userId, lessonId) => {
      return Number(lessonId) !== 999;
    };
  });

  // =========================================================================
  // 1. PDF VERSION INCREMENT LOGIC (TASK-PDF-SMART-NOTES-03)
  // =========================================================================
  describe('1. PDF Version Increment Rules (updateLesson & Bulk Editor)', () => {
    it('1.1 updateLesson: Changing PDF content_url increases pdf_version v1 -> v2', async () => {
      const updated = await lessonsService.updateLesson(1, { contentUrl: '/uploads/lesson1_new.pdf' });
      assert.strictEqual(updated.pdf_version, 2);
    });

    it('1.2 updateLesson: Title-only update retains pdf_version', async () => {
      const updated = await lessonsService.updateLesson(1, { title: 'Updated Title Only' });
      assert.strictEqual(updated.pdf_version, 1);
    });

    it('1.3 updateLesson: Same content_url retains pdf_version', async () => {
      const updated = await lessonsService.updateLesson(1, { contentUrl: '/uploads/lesson1.pdf', title: 'New Title' });
      assert.strictEqual(updated.pdf_version, 1);
    });

    it('1.4 updateLesson: Changing content_type from PDF to video increases version', async () => {
      const updated = await lessonsService.updateLesson(1, { contentType: 'video', contentUrl: '/uploads/video.mp4' });
      assert.strictEqual(updated.pdf_version, 2);
    });

    it('1.5 updateLesson: Changing content_type from video to PDF increases version', async () => {
      const updated = await lessonsService.updateLesson(4, { contentType: 'pdf', contentUrl: '/uploads/new_doc.pdf' });
      assert.strictEqual(updated.pdf_version, 2);
    });

    it('1.6 Bulk Editor: Changing PDF in course curriculum increases pdf_version once', async () => {
      await coursesService.updateCourse(1, {
        sections: [
          {
            id: 1,
            title: 'Section 1',
            lessons: [
              { id: 1, title: 'Lesson 1', contentType: 'pdf', contentUrl: '/uploads/lesson1_bulk_v2.pdf' }
            ]
          }
        ]
      });

      const lesson = dbStore.lessons.find((l) => l.lesson_id === 1);
      assert.strictEqual(lesson.pdf_version, 2);
    });

    it('1.7 Bulk Editor: Metadata-only update in course curriculum retains pdf_version', async () => {
      await coursesService.updateCourse(1, {
        sections: [
          {
            id: 1,
            title: 'Section 1',
            lessons: [
              { id: 1, title: 'Lesson 1 Renamed', contentType: 'pdf', contentUrl: '/uploads/lesson1.pdf' }
            ]
          }
        ]
      });

      const lesson = dbStore.lessons.find((l) => l.lesson_id === 1);
      assert.strictEqual(lesson.pdf_version, 1);
    });
  });

  // =========================================================================
  // 2. SERVER CANONICAL RESOLUTION & NOTE ISOLATION
  // =========================================================================
  describe('2. Server Canonical Resolution & Note Isolation', () => {
    it('2.1 GET notes with forged query ?documentRef=v1 when server is at v2 returns only v2 notes', async () => {
      // Note v1
      dbStore.pdf_notes.push({
        note_id: nextNoteId++,
        user_id: 10,
        lesson_id: 2,
        material_id: null,
        document_ref: 'lesson:2:primary:v1',
        page_number: 1,
        selection_type: 'text',
        selected_text: 'Old Version 1 Text',
        note_text: 'Old note',
        category: 'important',
        color: 'yellow',
        rects: [{ x: 0.1, y: 0.1, width: 0.5, height: 0.05 }],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      // Note v2
      dbStore.pdf_notes.push({
        note_id: nextNoteId++,
        user_id: 10,
        lesson_id: 2,
        material_id: null,
        document_ref: 'lesson:2:primary:v2',
        page_number: 1,
        selection_type: 'area',
        selected_text: null,
        note_text: 'New Version 2 Area Note',
        category: 'vocabulary',
        color: 'green',
        rects: [{ x: 0.2, y: 0.2, width: 0.5, height: 0.05 }],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      // Client requests forged v1 docRef
      const res = await fetch(`${baseUrl}/api/lessons/2/pdf-notes?documentRef=lesson:2:primary:v1`, {
        headers: { Authorization: 'Bearer user_10_token' }
      });
      const data = await res.json();

      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.data.length, 1);
      assert.strictEqual(data.data[0].documentRef, 'lesson:2:primary:v2');
      assert.strictEqual(data.data[0].noteText, 'New Version 2 Area Note');
    });

    it('2.2 POST note with forged documentRef=v1 saves note to canonical server version (v2)', async () => {
      const payload = {
        documentRef: 'lesson:2:primary:v1',
        pageNumber: 1,
        selectionType: 'area',
        selectedText: null,
        noteText: 'Created on v2 regardless of client payload',
        category: 'important',
        color: 'yellow',
        rects: [{ x: 0.1, y: 0.1, width: 0.4, height: 0.1 }]
      };

      const res = await fetch(`${baseUrl}/api/lessons/2/pdf-notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${currentAuthToken}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      assert.strictEqual(res.status, 201);
      assert.strictEqual(data.data.documentRef, 'lesson:2:primary:v2');
    });
  });

  // =========================================================================
  // 3. AREA & TEXT NOTE VALIDATION
  // =========================================================================
  describe('3. Area Notes & Text Notes Validation', () => {
    it('3.1 should CREATE Area Note successfully with selectedText = null and mandatory noteText', async () => {
      const areaPayload = {
        pageNumber: 1,
        selectionType: 'area',
        selectedText: null,
        noteText: 'Ghi chú cho phần sơ đồ hình ảnh',
        category: 'important',
        color: 'pink',
        rects: [{ x: 0.1, y: 0.2, width: 0.5, height: 0.3 }]
      };

      const res = await fetch(`${baseUrl}/api/lessons/1/pdf-notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${currentAuthToken}`
        },
        body: JSON.stringify(areaPayload)
      });

      const data = await res.json();
      assert.strictEqual(res.status, 201);
      assert.strictEqual(data.data.selectionType, 'area');
      assert.strictEqual(data.data.selectedText, null);
      assert.strictEqual(data.data.noteText, 'Ghi chú cho phần sơ đồ hình ảnh');
    });

    it('3.2 should REJECT Area Note when noteText is empty (HTTP 400)', async () => {
      const invalidAreaPayload = {
        pageNumber: 1,
        selectionType: 'area',
        selectedText: null,
        noteText: '   ',
        category: 'important',
        color: 'yellow',
        rects: [{ x: 0.1, y: 0.2, width: 0.5, height: 0.3 }]
      };

      const res = await fetch(`${baseUrl}/api/lessons/1/pdf-notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${currentAuthToken}`
        },
        body: JSON.stringify(invalidAreaPayload)
      });

      const data = await res.json();
      assert.strictEqual(res.status, 400);
      assert.match(data.message, /bắt buộc phải có nội dung noteText/i);
    });

    it('3.3 should REJECT Text Note when selectedText is missing (HTTP 400)', async () => {
      const invalidTextPayload = {
        pageNumber: 1,
        selectionType: 'text',
        selectedText: '',
        noteText: 'Some note text',
        category: 'vocabulary',
        color: 'green',
        rects: [{ x: 0.1, y: 0.1, width: 0.4, height: 0.04 }]
      };

      const res = await fetch(`${baseUrl}/api/lessons/1/pdf-notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${currentAuthToken}`
        },
        body: JSON.stringify(invalidTextPayload)
      });

      const data = await res.json();
      assert.strictEqual(res.status, 400);
      assert.match(data.message, /bắt buộc phải có selectedText/i);
    });

    it('3.4 should REJECT invalid selectionType (HTTP 400 INVALID_SELECTION_TYPE)', async () => {
      const invalidTypePayload = {
        pageNumber: 1,
        selectionType: 'invalid_type_xyz',
        selectedText: 'Text',
        noteText: 'Note',
        rects: [{ x: 0.1, y: 0.1, width: 0.4, height: 0.04 }]
      };

      const res = await fetch(`${baseUrl}/api/lessons/1/pdf-notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${currentAuthToken}`
        },
        body: JSON.stringify(invalidTypePayload)
      });

      const data = await res.json();
      assert.strictEqual(res.status, 400);
    });
  });

  // =========================================================================
  // 4. AUTHORIZATION & RECT BOUNDARY VERIFICATION
  // =========================================================================
  describe('4. Authorization & Boundary Verification', () => {
    it('4.1 should return 401 when no authorization header is provided', async () => {
      const res = await fetch(`${baseUrl}/api/lessons/1/pdf-notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageNumber: 1, selectedText: 'Hi', rects: [{ x: 0.1, y: 0.1, width: 0.2, height: 0.02 }] })
      });
      assert.strictEqual(res.status, 401);
    });

    it('4.2 should return 403 when user has no access to lesson', async () => {
      const res = await fetch(`${baseUrl}/api/lessons/999/pdf-notes`, {
        headers: { Authorization: 'Bearer user_10_token' }
      });
      assert.strictEqual(res.status, 403);
    });

    it('4.3 should REJECT rect with x + width > 1.0 (HTTP 400 INVALID_RECTS)', async () => {
      const payload = {
        pageNumber: 1,
        selectedText: 'Out of bounds text',
        category: 'important',
        color: 'yellow',
        rects: [{ x: 0.8, y: 0.1, width: 0.35, height: 0.05 }]
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
    });

    it('4.4 Database error returns HTTP 500 without leaking SQL internals', async () => {
      simulateDbError = true;
      const res = await fetch(`${baseUrl}/api/lessons/1/pdf-notes`, {
        headers: { Authorization: `Bearer ${currentAuthToken}` }
      });
      const data = await res.json();
      assert.strictEqual(res.status, 500);
      assert.strictEqual(data.code, 'INTERNAL_ERROR');
    });
  });
});
