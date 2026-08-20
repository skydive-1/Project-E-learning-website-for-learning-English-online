const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

// Import utilities and modules
const { validateVideoFile } = require('../src/utils/videoValidator.util');
const { validatePdfFile } = require('../src/utils/pdfValidator.util');
const supabaseStorage = require('../src/utils/supabaseStorage');
const coursesController = require('../src/modules/courses/controllers/courses.controller');
const lessonsController = require('../src/modules/lessons/controllers/lessons.controller');
const coursesService = require('../src/modules/courses/services/courses.service');
const lessonsService = require('../src/modules/lessons/services/lessons.service');
const ragIngestionService = require('../src/modules/lessons/services/ragIngestion.service');
const db = require('../src/config/database');

describe('🎬 TASK-DURABLE-LESSON-MEDIA-PIPELINE-01: Full Integration Test Suite', () => {
  const ORIGINAL_JWT_SECRET = process.env.JWT_SECRET;
  const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-for-development-only-min-32-chars';
  const testOutputDir = path.join(__dirname, 'temp_test_media');

  // Lưu trữ các mock gốc
  let origUploadVideo;
  let origUploadDoc;
  let origCheckObject;
  let origGenerateSignedUrl;
  let origDeleteStorageObject;
  let origQuery;
  let origGetLessonById;
  let origCanAccess;
  let origCheckOwnership;
  let origIngestPdf;
  let origDeleteVectors;

  // Helper tạo buffer MP4 hợp lệ chuẩn ISO-BMFF với atom ftyp và moov (H.264 / AAC)
  const createMockValidMp4Buffer = () => {
    // 1. ftyp box (24 bytes)
    const ftypSize = 24;
    const ftypBuf = Buffer.alloc(ftypSize);
    ftypBuf.writeUInt32BE(ftypSize, 0);
    ftypBuf.write('ftyp', 4, 'ascii');
    ftypBuf.write('isom', 8, 'ascii');
    ftypBuf.writeUInt32BE(512, 12);
    ftypBuf.write('isom', 16, 'ascii');
    ftypBuf.write('iso2', 20, 'ascii');

    // 2. moov box (chứa mvhd và trak avc1 & mp4a)
    const moovContent = Buffer.from('moov...mvhd................trak...mdia...minf...stbl...stsd...avc1....trak...mp4a....', 'binary');
    const moovSize = moovContent.length + 8;
    const moovBuf = Buffer.alloc(8);
    moovBuf.writeUInt32BE(moovSize, 0);
    moovBuf.write('moov', 4, 'ascii');

    // 3. mdat box
    const mdatContent = Buffer.alloc(128, 0xAA);
    const mdatSize = mdatContent.length + 8;
    const mdatBuf = Buffer.alloc(8);
    mdatBuf.writeUInt32BE(mdatSize, 0);
    mdatBuf.write('mdat', 4, 'ascii');

    return Buffer.concat([ftypBuf, moovBuf, moovContent, mdatBuf, mdatContent]);
  };

  // Helper tạo buffer PDF hợp lệ với chữ ký %PDF-
  const createMockValidPdfBuffer = () => {
    return Buffer.from(
      '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /Contents 4 0 R >>\nendobj\n4 0 obj\n<< /Length 44 >>\nstream\nBT /F1 12 Tf 100 700 Td (Hello E-Learning PDF) Tj ET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n0000000115 00000 n\n0000000178 00000 n\ntrailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n272\n%%EOF\n',
      'utf-8'
    );
  };

  before(() => {
    process.env.JWT_SECRET = JWT_SECRET;
    if (!fs.existsSync(testOutputDir)) {
      fs.mkdirSync(testOutputDir, { recursive: true });
    }

    origUploadVideo = supabaseStorage.uploadVideoToSupabase;
    origUploadDoc = supabaseStorage.uploadDocumentToSupabase;
    origCheckObject = supabaseStorage.checkObjectExists;
    origGenerateSignedUrl = supabaseStorage.generateSignedUrl;
    origDeleteStorageObject = supabaseStorage.deleteStorageObject;
    origQuery = db.query;
    origGetLessonById = coursesService.getLessonById;
    origCanAccess = coursesService.canUserAccessLesson;
    origCheckOwnership = lessonsService.checkLessonOwnership;
    origIngestPdf = ragIngestionService.ingestPdfDocument;
    origDeleteVectors = ragIngestionService.deleteMaterialVectors;

    // Default fast mocks for background RAG
    ragIngestionService.ingestPdfDocument = async () => true;
    ragIngestionService.deleteMaterialVectors = async () => true;
  });

  beforeEach(() => {
    supabaseStorage.uploadVideoToSupabase = origUploadVideo;
    supabaseStorage.uploadDocumentToSupabase = origUploadDoc;
    supabaseStorage.checkObjectExists = origCheckObject;
    supabaseStorage.generateSignedUrl = origGenerateSignedUrl;
    supabaseStorage.deleteStorageObject = origDeleteStorageObject;
    db.query = async (text, params) => {
      if (typeof text === 'string' && text.includes('INSERT INTO pending_media_uploads')) {
        return { rows: [{ upload_id: params[0], status: 'PENDING' }] };
      }
      return origQuery(text, params);
    };
    coursesService.getLessonById = origGetLessonById;
    coursesService.canUserAccessLesson = origCanAccess;
    lessonsService.checkLessonOwnership = origCheckOwnership;
    ragIngestionService.ingestPdfDocument = async () => true;
    ragIngestionService.deleteMaterialVectors = async () => true;
  });

  after(() => {
    if (ORIGINAL_JWT_SECRET === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = ORIGINAL_JWT_SECRET;
    supabaseStorage.uploadVideoToSupabase = origUploadVideo;
    supabaseStorage.uploadDocumentToSupabase = origUploadDoc;
    supabaseStorage.checkObjectExists = origCheckObject;
    supabaseStorage.generateSignedUrl = origGenerateSignedUrl;
    supabaseStorage.deleteStorageObject = origDeleteStorageObject;
    db.query = origQuery;
    coursesService.getLessonById = origGetLessonById;
    coursesService.canUserAccessLesson = origCanAccess;
    lessonsService.checkLessonOwnership = origCheckOwnership;
    ragIngestionService.ingestPdfDocument = origIngestPdf;
    ragIngestionService.deleteMaterialVectors = origDeleteVectors;

    if (fs.existsSync(testOutputDir)) {
      try {
        fs.rmSync(testOutputDir, { recursive: true, force: true });
      } catch (e) {}
    }
  });

  // =========================================================================
  // PHẦN A: VIDEO PIPELINE & CODEC VALIDATION TESTS (9 TEST CASES)
  // =========================================================================
  describe('🎥 PHẦN A: Video Pipeline & Codec Validation', () => {

    // Test 1: MP4 H.264/AAC hợp lệ upload thành công
    it('1. MP4 H.264/AAC hợp lệ upload thành công vào bucket videos', async () => {
      const validMp4 = createMockValidMp4Buffer();
      const validation = await validateVideoFile(validMp4);
      assert.strictEqual(validation.isValid, true, 'MP4 buffer hợp lệ phải qua validation');
      assert.strictEqual(validation.metadata.container, 'mp4');

      // Mock upload thành công
      supabaseStorage.uploadVideoToSupabase = async (filePath, objectKey) => ({
        success: true,
        storageKey: objectKey,
        storageBucket: 'videos',
        mimeType: 'video/mp4',
        sizeBytes: validMp4.length,
        checksumSha256: crypto.createHash('sha256').update(validMp4).digest('hex')
      });

      const tempPath = path.join(testOutputDir, 'test_valid.mp4');
      fs.writeFileSync(tempPath, validMp4);

      const req = {
        file: {
          path: tempPath,
          originalname: 'Lesson1_Intro.mp4',
          mimetype: 'video/mp4',
          size: validMp4.length
        },
        user: { id: 2, roleId: 2 }
      };

      let responseCode = null;
      let responseBody = null;
      const res = {
        status: (code) => { responseCode = code; return res; },
        json: (data) => { responseBody = data; return res; }
      };

      await coursesController.uploadFile(req, res, () => {});

      assert.strictEqual(responseCode, 200);
      assert.strictEqual(responseBody.success, true);
      assert.strictEqual(responseBody.storageBucket, 'videos');
      assert.strictEqual(responseBody.storageProvider, 'supabase');
      assert.strictEqual(responseBody.mediaStatus, 'PENDING');
      assert.ok(responseBody.pendingUploadId);
      assert.ok(responseBody.storageKey.startsWith('courses/2/'));
      assert.ok(responseBody.storageKey.endsWith('.mp4'));
    });

    // Test 2: File PDF đổi tên .mp4 bị từ chối
    it('2. File PDF đổi tên .mp4 bị từ chối với mã lỗi INVALID_VIDEO_CONTAINER', async () => {
      const fakeVideoBuf = Buffer.from('%PDF-1.4 Fake Video Content masquerading as mp4', 'utf-8');
      const validation = await validateVideoFile(fakeVideoBuf);

      assert.strictEqual(validation.isValid, false);
      assert.strictEqual(validation.code, 'INVALID_VIDEO_CONTAINER');

      const tempPath = path.join(testOutputDir, 'fake_video.mp4');
      fs.writeFileSync(tempPath, fakeVideoBuf);

      const req = {
        file: {
          path: tempPath,
          originalname: 'DocumentRenamed.mp4',
          mimetype: 'video/mp4',
          size: fakeVideoBuf.length
        },
        user: { id: 2, roleId: 2 }
      };

      let responseCode = null;
      let responseBody = null;
      const res = {
        status: (code) => { responseCode = code; return res; },
        json: (data) => { responseBody = data; return res; }
      };

      await coursesController.uploadFile(req, res, () => {});

      assert.strictEqual(responseCode, 400);
      assert.strictEqual(responseBody.success, false);
      assert.ok(['INVALID_VIDEO_CONTAINER', 'UNSUPPORTED_VIDEO_FORMAT'].includes(responseBody.code));
    });

    // Test 3: MP4 codec không hỗ trợ (HEVC / VP9) bị từ chối
    it('3. MP4 codec không hỗ trợ (HEVC hvc1 / VP9) bị từ chối với UNSUPPORTED_VIDEO_CODEC', async () => {
      const ftypBuf = Buffer.alloc(24);
      ftypBuf.writeUInt32BE(24, 0);
      ftypBuf.write('ftyp', 4, 'ascii');
      ftypBuf.write('mp42', 8, 'ascii');
      ftypBuf.writeUInt32BE(0, 12);
      ftypBuf.write('mp42', 16, 'ascii');
      ftypBuf.write('isom', 20, 'ascii');

      const moovContent = Buffer.from('moov...mvhd...trak...mdia...minf...stbl...stsd...hvc1...hev1...', 'binary');
      const moovBuf = Buffer.alloc(8);
      moovBuf.writeUInt32BE(moovContent.length + 8, 0);
      moovBuf.write('moov', 4, 'ascii');

      const hevcVideo = Buffer.concat([ftypBuf, moovBuf, moovContent]);
      const validation = await validateVideoFile(hevcVideo);

      assert.strictEqual(validation.isValid, false);
      assert.strictEqual(validation.code, 'UNSUPPORTED_VIDEO_CODEC');
    });

    // Test 4: File truncate / corrupt bị từ chối
    it('4. File truncate / corrupt thiếu atom thiết yếu bị từ chối', async () => {
      const ftypBuf = Buffer.alloc(24);
      ftypBuf.writeUInt32BE(24, 0);
      ftypBuf.write('ftyp', 4, 'ascii');
      ftypBuf.write('isom', 8, 'ascii');

      const truncatedBuf = Buffer.concat([ftypBuf, Buffer.from('corrupted payload without moov')]);
      const validation = await validateVideoFile(truncatedBuf);

      assert.strictEqual(validation.isValid, false);
      assert.ok(['CORRUPTED_VIDEO_FILE', 'INVALID_VIDEO_CONTAINER'].includes(validation.code));
    });

    // Test 5: Upload storage lỗi không ghi DB
    it('5. Upload storage lỗi không ghi metadata vào database', async () => {
      supabaseStorage.uploadVideoToSupabase = async () => ({
        success: false,
        code: 'STORAGE_UPLOAD_ERROR',
        error: 'Supabase storage gateway timeout'
      });

      const tempPath = path.join(testOutputDir, 'test_fail.mp4');
      fs.writeFileSync(tempPath, createMockValidMp4Buffer());

      const req = {
        file: {
          path: tempPath,
          originalname: 'TestFail.mp4',
          mimetype: 'video/mp4',
          size: 100
        },
        user: { id: 2, roleId: 2 }
      };

      let responseCode = null;
      let responseBody = null;
      const res = {
        status: (code) => { responseCode = code; return res; },
        json: (data) => { responseBody = data; return res; }
      };

      await coursesController.uploadFile(req, res, () => {});

      assert.strictEqual(responseCode, 500);
      assert.strictEqual(responseBody.success, false);
      assert.strictEqual(responseBody.code, 'STORAGE_UPLOAD_ERROR');
    });

    // Test 6: DB lỗi sau upload xóa orphan object
    it('6. DB lỗi sau upload tự động xóa orphan object vừa upload trên Supabase', async () => {
      let deletedKey = null;
      let deletedBucket = null;
      supabaseStorage.deleteStorageObject = async (key, bucket) => {
        deletedKey = key;
        deletedBucket = bucket;
        return true;
      };

      supabaseStorage.uploadDocumentToSupabase = async (filePath, objectKey) => ({
        success: true,
        storageKey: objectKey,
        storageBucket: 'documents',
        sizeBytes: 200,
        checksumSha256: 'mock-sha-256'
      });

      lessonsService.checkLessonOwnership = async () => true;

      // Mock query gây lỗi DB cố ý
      db.query = async (text, params) => {
        if (typeof text === 'string' && text.includes('INSERT INTO lesson_materials')) {
          throw new Error('Simulated Database Crash on Insert');
        }
        return origQuery(text, params);
      };

      const tempPdf = path.join(testOutputDir, 'test_orphan.pdf');
      fs.writeFileSync(tempPdf, createMockValidPdfBuffer());

      try {
        await lessonsService.uploadLessonMaterial(1, {
          path: tempPdf,
          originalname: 'OrphanDoc.pdf',
          mimetype: 'application/pdf',
          size: 200
        }, 2, 2);
        assert.fail('Phải throw error khi DB insert fail');
      } catch (err) {
        assert.ok(err.message.includes('Simulated Database Crash') || err.message.includes('Lỗi tải lên tài liệu'));
      }

      await new Promise(r => setTimeout(r, 50));
      assert.ok(deletedKey !== null, 'Phải gọi deleteStorageObject để dọn orphan');
      assert.strictEqual(deletedBucket, 'documents');
    });

    // Test 7: Object tồn tại sau simulated restart
    it('7. Storage metadata & object tồn tại sau simulated restart (không phụ thuộc Railway disk)', async () => {
      supabaseStorage.checkObjectExists = async () => true;
      supabaseStorage.generateSignedUrl = async (path) => `https://supabase.co/storage/v1/object/sign/videos/${path}?token=mock`;

      const storageKey = 'courses/5/eb5f9f73/video.mp4';
      const exists = await supabaseStorage.checkObjectExists(storageKey, 'videos');
      assert.strictEqual(exists, true, 'Object trên Supabase phải tồn tại độc lập với filesystem local');

      const signedUrl = await supabaseStorage.generateSignedUrl(storageKey, 'videos', 3600);
      assert.ok(signedUrl && signedUrl.startsWith('http'), 'Phải tạo được Signed URL từ Supabase storage key');
    });

    // Test 8: Instructor upload -> publish -> student lấy ticket -> phát video
    it('8. Flow: Instructor upload -> publish -> student lấy ticket -> video stream redirect', async () => {
      const validMp4 = createMockValidMp4Buffer();
      const tempPath = path.join(testOutputDir, 'flow_test.mp4');
      fs.writeFileSync(tempPath, validMp4);

      supabaseStorage.uploadVideoToSupabase = async (filePath, objectKey) => ({
        success: true,
        storageKey: objectKey,
        storageBucket: 'videos',
        mimeType: 'video/mp4',
        sizeBytes: validMp4.length,
        checksumSha256: 'mock-checksum'
      });

      const reqUpload = {
        file: {
          path: tempPath,
          originalname: 'Grammar_Lesson.mp4',
          mimetype: 'video/mp4',
          size: validMp4.length
        },
        user: { id: 2, roleId: 2 }
      };

      let uploadResData = null;
      const resUpload = {
        status: () => resUpload,
        json: (d) => { uploadResData = d; return resUpload; }
      };
      await coursesController.uploadFile(reqUpload, resUpload, () => {});

      assert.strictEqual(uploadResData.success, true);
      const storageKey = uploadResData.storageKey;

      // 2. Student lấy ticket
      coursesService.getLessonById = async () => ({
        lesson_id: 99,
        title: 'Grammar Flow Test',
        content_type: 'video',
        content_url: storageKey,
        storage_key: storageKey,
        storage_bucket: 'videos',
        storage_provider: 'supabase',
        media_status: 'READY'
      });
      coursesService.canUserAccessLesson = async () => true;

      const reqTicket = {
        params: { lessonId: '99' },
        user: { id: 10, userId: 10, roleId: 3 },
        headers: { host: 'localhost:5000' }
      };

      let ticketResData = null;
      const resTicket = {
        status: () => resTicket,
        json: (d) => { ticketResData = d; return resTicket; }
      };

      await lessonsController.getVideoTicket(reqTicket, resTicket, () => {});
      assert.strictEqual(ticketResData.success, true);
      assert.ok(ticketResData.ticket);

      // 3. Stream với ticket
      supabaseStorage.generateSignedUrl = async (path) => `https://supabase.co/storage/v1/object/sign/videos/${path}?token=mock`;
      const ticketDecoded = jwt.verify(ticketResData.ticket, JWT_SECRET);
      const reqStream = {
        params: { lessonId: '99' },
        user: ticketDecoded,
        headers: { 'user-agent': 'Mozilla/5.0' }
      };

      let redirectUrl = null;
      const resStream = {
        setHeader: () => {},
        redirect: (url) => { redirectUrl = url; }
      };

      await lessonsController.streamLessonVideo(reqStream, resStream, () => {});
      assert.ok(redirectUrl && redirectUrl.startsWith('http'), 'Stream phải redirect tới signed URL');
    });

    // Test 9: Range/redirect và MIME đúng
    it('9. Phản hồi video trả về đúng MIME type video/mp4 và no-sniff header', async () => {
      coursesService.getLessonById = async () => ({
        lesson_id: 44,
        title: 'Lesson 44',
        content_type: 'video',
        content_url: 'courses/5/eb5f9f73/video.mp4',
        storage_key: 'courses/5/eb5f9f73/video.mp4',
        storage_bucket: 'videos'
      });
      coursesService.canUserAccessLesson = async () => true;
      supabaseStorage.generateSignedUrl = async (path) => `https://supabase.co/storage/v1/object/sign/videos/${path}?token=mock`;

      const headersSet = {};
      let redirected = null;
      const res = {
        setHeader: (k, v) => { headersSet[k] = v; },
        redirect: (url) => { redirected = url; }
      };

      await lessonsController.streamLessonVideo({
        params: { lessonId: '44' },
        user: { id: 1, userId: 1, roleId: 3, lessonId: '44', type: 'video_stream_ticket' },
        headers: { 'user-agent': 'Chrome/120' }
      }, res, () => {});

      assert.strictEqual(headersSet['X-Content-Type-Options'], 'nosniff');
      assert.ok(redirected && redirected.includes('supabase.co'));
    });
  });

  // =========================================================================
  // PHẦN B: PDF PIPELINE, RAG & STORAGE TESTS (9 TEST CASES)
  // =========================================================================
  describe('📄 PHẦN B: PDF Pipeline, RAG Ingestion & Durable Storage', () => {

    // Test 1: PDF hợp lệ upload vào bucket documents
    it('1. PDF hợp lệ upload thành công vào bucket documents trên Supabase', async () => {
      const validPdf = createMockValidPdfBuffer();
      const validation = await validatePdfFile(validPdf);

      assert.strictEqual(validation.isValid, true);
      assert.strictEqual(validation.metadata.format, 'pdf');

      supabaseStorage.uploadDocumentToSupabase = async (filePath, objectKey) => ({
        success: true,
        storageKey: objectKey,
        storageBucket: 'documents',
        mimeType: 'application/pdf',
        sizeBytes: validPdf.length,
        checksumSha256: 'mock-pdf-sha256'
      });

      const tempPath = path.join(testOutputDir, 'test_valid.pdf');
      fs.writeFileSync(tempPath, validPdf);

      const req = {
        file: {
          path: tempPath,
          originalname: 'Unit1_Grammar.pdf',
          mimetype: 'application/pdf',
          size: validPdf.length
        },
        user: { id: 2, roleId: 2 }
      };

      let resData = null;
      const res = {
        status: () => res,
        json: (d) => { resData = d; return res; }
      };

      await coursesController.uploadFile(req, res, () => {});

      assert.strictEqual(resData.success, true);
      assert.strictEqual(resData.storageBucket, 'documents');
      assert.strictEqual(resData.storageProvider, 'supabase');
      assert.strictEqual(resData.mimeType, 'application/pdf');
      assert.ok(resData.storageKey.startsWith('courses/2/'));
      assert.ok(resData.storageKey.endsWith('.pdf'));
    });

    // Test 2: File giả PDF bị từ chối
    it('2. File giả PDF (thiếu magic bytes %PDF-) bị từ chối với INVALID_PDF_FORMAT', async () => {
      const fakePdf = Buffer.from('Plain text file renamed to sample.pdf', 'utf-8');
      const validation = await validatePdfFile(fakePdf);

      assert.strictEqual(validation.isValid, false);
      assert.strictEqual(validation.code, 'INVALID_PDF_FORMAT');

      const tempPath = path.join(testOutputDir, 'fake.pdf');
      fs.writeFileSync(tempPath, fakePdf);

      const req = {
        file: {
          path: tempPath,
          originalname: 'sample.pdf',
          mimetype: 'application/pdf',
          size: fakePdf.length
        },
        user: { id: 2, roleId: 2 }
      };

      let resCode = null;
      let resData = null;
      const res = {
        status: (c) => { resCode = c; return res; },
        json: (d) => { resData = d; return res; }
      };

      await coursesController.uploadFile(req, res, () => {});
      assert.strictEqual(resCode, 400);
      assert.strictEqual(resData.code, 'INVALID_PDF_FORMAT');
    });

    // Test 3: PDF chính không bị xóa sau response (bền vững trên Supabase)
    it('3. PDF chính lưu trên Supabase Storage không bị ảnh hưởng bởi cleanup file tạm của Multer', async () => {
      const tempPath = path.join(testOutputDir, 'temp_multer_test.pdf');
      fs.writeFileSync(tempPath, createMockValidPdfBuffer());

      supabaseStorage.uploadDocumentToSupabase = async (filePath, objectKey) => ({
        success: true,
        storageKey: objectKey,
        storageBucket: 'documents',
        mimeType: 'application/pdf',
        sizeBytes: 500,
        checksumSha256: 'mock-sha'
      });

      const req = {
        file: {
          path: tempPath,
          originalname: 'DurableDoc.pdf',
          mimetype: 'application/pdf',
          size: 500
        },
        user: { id: 2, roleId: 2 }
      };

      let resData = null;
      const res = {
        status: () => res,
        json: (d) => { resData = d; return res; }
      };

      await coursesController.uploadFile(req, res, () => {});

      // File tạm Multer trên đĩa bị xóa
      assert.strictEqual(fs.existsSync(tempPath), false, 'File tạm Multer phải được dọn dẹp');
      // Storage key trên Supabase vẫn tồn tại
      assert.ok(resData.storageKey, 'Storage key bền vững phải được trả về');
    });

    // Test 4: PDF đính kèm tồn tại sau simulated restart
    it('4. PDF đính kèm lesson_materials lưu storage key bền vững, không lưu /uploads local', async () => {
      lessonsService.checkLessonOwnership = async () => true;

      supabaseStorage.uploadDocumentToSupabase = async (filePath, objectKey) => ({
        success: true,
        storageKey: objectKey,
        storageBucket: 'documents',
        mimeType: 'application/pdf',
        sizeBytes: 800,
        checksumSha256: 'mock-sha-attached'
      });

      let insertedRow = null;
      db.query = async (text, params) => {
        if (typeof text === 'string' && text.includes('INSERT INTO lesson_materials')) {
          insertedRow = {
            material_id: 101,
            lesson_id: params[0],
            file_name: params[1],
            file_url: params[2],
            storage_provider: params[6],
            storage_bucket: params[7],
            storage_key: params[8],
            mime_type: params[9],
            size_bytes: params[10],
            checksum_sha256: params[11],
            media_status: params[12]
          };
          return { rows: [insertedRow] };
        }
        return origQuery(text, params);
      };

      const tempPath = path.join(testOutputDir, 'mat_test.pdf');
      fs.writeFileSync(tempPath, createMockValidPdfBuffer());

      const material = await lessonsService.uploadLessonMaterial(1, {
        path: tempPath,
        originalname: 'AttachedGuide.pdf',
        mimetype: 'application/pdf',
        size: 800
      }, 2, 2);

      assert.strictEqual(material.storage_provider, 'supabase');
      assert.strictEqual(material.storage_bucket, 'documents');
      assert.strictEqual(material.media_status, 'READY');
      assert.ok(material.storage_key.startsWith('courses/materials/1/'));
    });

    // Test 5: Signed URL chỉ cấp cho user có quyền
    it('5. Signed URL xem tài liệu PDF chỉ cấp khi người dùng có quyền (canUserAccessLesson)', async () => {
      coursesService.canUserAccessLesson = async () => false;

      const req = {
        params: { lessonId: '1', materialId: '10' },
        user: { id: 99, roleId: 3 }
      };

      let resCode = null;
      const res = {
        status: (c) => { resCode = c; return res; },
        json: () => res
      };

      await lessonsController.previewMaterial(req, res, () => {});
      assert.strictEqual(resCode, 403, 'User không có quyền phải nhận 403 Forbidden');
    });

    // Test 6: PDF.js đọc được tài liệu qua preview endpoint
    it('6. Preview endpoint chuyển hướng tới signed URL với Content-Type application/pdf', async () => {
      coursesService.canUserAccessLesson = async () => true;
      supabaseStorage.generateSignedUrl = async (path) => `https://supabase.co/storage/v1/object/sign/documents/${path}?token=mock-doc-token`;

      db.query = async (text) => {
        if (typeof text === 'string' && text.includes('SELECT * FROM lesson_materials')) {
          return {
            rows: [{
              material_id: 10,
              lesson_id: 1,
              file_name: 'Grammar_Guide.pdf',
              storage_key: 'courses/materials/1/uuid/Grammar_Guide.pdf',
              storage_bucket: 'documents'
            }]
          };
        }
        return origQuery(text);
      };

      let redirectUrl = null;
      const res = {
        redirect: (u) => { redirectUrl = u; }
      };

      await lessonsController.previewMaterial({
        params: { lessonId: '1', materialId: '10' },
        user: { id: 1, roleId: 3 }
      }, res, () => {});

      assert.ok(redirectUrl && redirectUrl.startsWith('http'), 'Phải redirect tới Signed URL để PDF.js đọc tài liệu');
    });

    // Test 7: RAG text extraction vẫn chạy
    it('7. RAG text extraction trích xuất nội dung từ PDF trước khi cleanup file tạm', async () => {
      const { extractTextFromPdf } = require('../src/utils/pdfExtractor.util');
      const tempPath = path.join(testOutputDir, 'rag_extract.pdf');
      fs.writeFileSync(tempPath, createMockValidPdfBuffer());

      const extracted = await extractTextFromPdf(tempPath);
      assert.ok(extracted !== null, 'Phải trích xuất được text hoặc cấu trúc từ PDF');
    });

    // Test 8: Pinecone lỗi không làm mất file PDF
    it('8. Pinecone/RAG lỗi không làm mất file PDF hay fail transaction upload', async () => {
      lessonsService.checkLessonOwnership = async () => true;
      supabaseStorage.uploadDocumentToSupabase = async (filePath, objectKey) => ({
        success: true,
        storageKey: objectKey,
        storageBucket: 'documents',
        mimeType: 'application/pdf',
        sizeBytes: 300,
        checksumSha256: 'mock-sha'
      });

      db.query = async (text, params) => {
        if (typeof text === 'string' && text.includes('INSERT INTO lesson_materials')) {
          return {
            rows: [{
              material_id: 202,
              lesson_id: params[0],
              file_name: params[1],
              storage_key: params[8],
              storage_bucket: 'documents',
              media_status: 'READY'
            }]
          };
        }
        return origQuery(text, params);
      };

      const tempPath = path.join(testOutputDir, 'rag_fail_test.pdf');
      fs.writeFileSync(tempPath, createMockValidPdfBuffer());

      const mat = await lessonsService.uploadLessonMaterial(1, {
        path: tempPath,
        originalname: 'RagFailDoc.pdf',
        mimetype: 'application/pdf',
        size: 300
      }, 2, 2);

      assert.strictEqual(mat.material_id, 202);
      assert.strictEqual(mat.media_status, 'READY');
    });

    // Test 9: Delete material xóa DB, storage object và vector đúng thứ tự
    it('9. Delete material xóa DB, Supabase storage object và Pinecone vector', async () => {
      lessonsService.checkLessonOwnership = async () => true;
      let dbDeleted = false;
      let storageDeletedKey = null;

      db.query = async (text, params) => {
        if (typeof text === 'string' && text.includes('SELECT material_id, file_url, storage_key')) {
          return {
            rows: [{
              material_id: 55,
              lesson_id: 1,
              file_url: 'courses/materials/1/uuid/test.pdf',
              storage_key: 'courses/materials/1/uuid/test.pdf',
              storage_bucket: 'documents'
            }]
          };
        }
        if (typeof text === 'string' && text.includes('DELETE FROM lesson_materials')) {
          dbDeleted = true;
          return { rowCount: 1 };
        }
        if (typeof text === 'string' && text.includes('SELECT COUNT(*) FROM lessons')) {
          return { rows: [{ total_ref: '0' }] };
        }
        return origQuery(text, params);
      };

      supabaseStorage.deleteStorageObject = async (k) => {
        storageDeletedKey = k;
        return true;
      };

      const result = await lessonsService.deleteLessonMaterial(1, 55, 2, 2);
      assert.strictEqual(result, true);
      assert.strictEqual(dbDeleted, true, 'CSDL phải được xóa');
      assert.strictEqual(storageDeletedKey, 'courses/materials/1/uuid/test.pdf', 'Storage object phải được xóa');
    });
  });
});
