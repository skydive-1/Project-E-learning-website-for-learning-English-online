const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { supabaseAdmin, supabaseClient } = require('../config/supabase');
const supabase = supabaseAdmin || require('../config/supabase');
const { validateVideoFile } = require('./videoValidator.util');
const { validatePdfFile } = require('./pdfValidator.util');

/**
 * Cache in-memory cho Signed URL của Supabase Storage
 * Key: `bucket::path`, Value: { url, expiresAt }
 * TTL = 55 phút — Signed URL sống 60 phút, cache trước 5 phút để tránh dùng URL gần hết hạn
 */
const signedUrlCache = new Map();
const CACHE_TTL_MS = 55 * 60 * 1000; // 55 phút

/**
 * Tính mã băm SHA-256 của Buffer hoặc File
 * @param {Buffer|string} fileInput 
 * @returns {string} SHA-256 hex string
 */
const computeSha256 = (fileInput) => {
  const hash = crypto.createHash('sha256');
  if (Buffer.isBuffer(fileInput)) {
    hash.update(fileInput);
  } else if (typeof fileInput === 'string' && fs.existsSync(fileInput)) {
    hash.update(fs.readFileSync(fileInput));
  }
  return hash.digest('hex');
};

/**
 * Kiểm tra xem một file/buffer có phải là định dạng MP4 hợp lệ dựa trên ISO Base Media (ftyp header)
 * @param {string|Buffer} fileInput - Đường dẫn file hoặc Buffer
 * @returns {boolean}
 */
const isValidMp4 = (fileInput) => {
  try {
    let headerBuffer;
    if (Buffer.isBuffer(fileInput)) {
      headerBuffer = fileInput.subarray(0, 16);
    } else if (typeof fileInput === 'string' && fs.existsSync(fileInput)) {
      const fd = fs.openSync(fileInput, 'r');
      headerBuffer = Buffer.alloc(16);
      fs.readSync(fd, headerBuffer, 0, 16, 0);
      fs.closeSync(fd);
    } else {
      return false;
    }

    if (headerBuffer.length < 8) return false;
    // Kiểm tra box type tại byte 4-8 là 'ftyp'
    const boxType = headerBuffer.toString('ascii', 4, 8);
    return boxType === 'ftyp';
  } catch (err) {
    console.warn('⚠️ Lỗi kiểm tra header MP4:', err.message);
    return false;
  }
};

/**
 * Đảm bảo một bucket private tồn tại trên Supabase Storage
 */
const ensureBucketExists = async (bucketName = 'videos', options = {}) => {
  try {
    if (!supabaseAdmin?.storage) return false;
    const { data: buckets, error } = await supabaseAdmin.storage.listBuckets();
    if (error) {
      console.warn(`⚠️ Không thể liệt kê danh sách buckets (${bucketName}):`, error.message);
      return false;
    }
    const exists = buckets && buckets.some(b => b.name === bucketName);
    if (!exists) {
      const fileSizeLimit = options.fileSizeLimit || (bucketName === 'videos' ? 524288000 : 52428800); // 500MB video, 50MB docs
      const { data, error: createError } = await supabaseAdmin.storage.createBucket(bucketName, {
        public: false, // Bắt buộc PRIVATE BUCKET
        fileSizeLimit
      });
      if (createError && !createError.message?.includes('already exists')) {
        console.error(`❌ Lỗi tạo bucket ${bucketName}:`, createError.message);
        return false;
      }
    }
    return true;
  } catch (e) {
    console.warn(`⚠️ Exception khi kiểm tra bucket ${bucketName}:`, e.message);
    return false;
  }
};

const ensureVideosBucketExists = async (bucketName = 'videos') => {
  return ensureBucketExists(bucketName, { fileSizeLimit: 524288000 });
};

const ensureDocumentsBucketExists = async (bucketName = 'documents') => {
  return ensureBucketExists(bucketName, { fileSizeLimit: 52428800 });
};

/**
 * Upload video trực tiếp lên Supabase Storage bucket 'videos'
 * @param {string|Buffer} fileInput - Đường dẫn file cục bộ hoặc Buffer
 * @param {string} objectKey - Đường dẫn lưu trữ (ví dụ: 'courses/1/uuid/video.mp4')
 * @param {string} mimeType - MIME type, bắt buộc là 'video/mp4'
 * @returns {Promise<{ success: boolean, storageKey?: string, storageBucket?: string, sizeBytes?: number, checksumSha256?: string, error?: string, code?: string }>}
 */
const uploadVideoToSupabase = async (fileInput, objectKey, mimeType = 'video/mp4') => {
  try {
    if (!objectKey) {
      return { success: false, code: 'MISSING_OBJECT_KEY', error: 'Thiếu objectKey lưu trữ' };
    }

    // 1. Deep Validation: MP4 Container, Moov atom, Codec H.264 & AAC
    const validation = await validateVideoFile(fileInput);
    if (!validation.isValid) {
      return {
        success: false,
        code: validation.code || 'INVALID_VIDEO',
        error: validation.message || 'Tệp video không hợp lệ.'
      };
    }

    // 2. Chuẩn bị Buffer & Metadata
    let fileBuffer;
    let sizeBytes = 0;
    if (Buffer.isBuffer(fileInput)) {
      fileBuffer = fileInput;
      sizeBytes = fileBuffer.length;
    } else if (typeof fileInput === 'string' && fs.existsSync(fileInput)) {
      fileBuffer = fs.readFileSync(fileInput);
      sizeBytes = fileBuffer.length;
    } else {
      return { success: false, code: 'FILE_NOT_FOUND', error: 'Không tìm thấy dữ liệu tệp video để tải lên.' };
    }

    const checksumSha256 = computeSha256(fileBuffer);

    // 3. Đảm bảo bucket 'videos' sẵn sàng
    await ensureVideosBucketExists('videos');

    const cleanObjectKey = objectKey.replace(/^\/+/, '');

    // 4. Upload lên Supabase Storage
    const { data, error } = await supabaseAdmin.storage
      .from('videos')
      .upload(cleanObjectKey, fileBuffer, {
        contentType: 'video/mp4',
        upsert: true
      });

    if (error) {
      console.error('❌ Lỗi upload video lên Supabase Storage:', error.message);
      return { success: false, code: 'STORAGE_UPLOAD_ERROR', error: error.message };
    }

    // 5. Kiểm tra xác thực object thực tế tồn tại trên storage
    const exists = await checkObjectExists(cleanObjectKey, 'videos');
    if (!exists) {
      console.error('❌ Xác minh object trên Supabase Storage thất bại sau khi upload:', cleanObjectKey);
      return { success: false, code: 'STORAGE_VERIFICATION_FAILED', error: 'Không thể xác minh tệp video trên máy chủ lưu trữ sau khi tải lên.' };
    }

    // Xóa cache cũ nếu có
    invalidateSignedUrlCache(cleanObjectKey, 'videos');

    return {
      success: true,
      storageKey: cleanObjectKey,
      storageBucket: 'videos',
      mimeType: 'video/mp4',
      sizeBytes,
      checksumSha256
    };
  } catch (err) {
    console.error('❌ Exception khi upload video lên Supabase:', err);
    return { success: false, code: 'STORAGE_EXCEPTION', error: err.message };
  }
};

/**
 * Upload tài liệu PDF trực tiếp lên Supabase Storage bucket 'documents'
 * @param {string|Buffer} fileInput - Đường dẫn file cục bộ hoặc Buffer
 * @param {string} objectKey - Đường dẫn lưu trữ (ví dụ: 'courses/1/uuid/document.pdf')
 * @param {string} mimeType - MIME type, bắt buộc là 'application/pdf'
 * @returns {Promise<{ success: boolean, storageKey?: string, storageBucket?: string, sizeBytes?: number, checksumSha256?: string, error?: string, code?: string }>}
 */
const uploadDocumentToSupabase = async (fileInput, objectKey, mimeType = 'application/pdf') => {
  try {
    if (!objectKey) {
      return { success: false, code: 'MISSING_OBJECT_KEY', error: 'Thiếu objectKey lưu trữ' };
    }

    // 1. Validate PDF magic bytes & format
    const validation = await validatePdfFile(fileInput);
    if (!validation.isValid) {
      return {
        success: false,
        code: validation.code || 'INVALID_PDF',
        error: validation.message || 'Tệp tài liệu PDF không hợp lệ.'
      };
    }

    // 2. Chuẩn bị Buffer & Metadata
    let fileBuffer;
    let sizeBytes = 0;
    if (Buffer.isBuffer(fileInput)) {
      fileBuffer = fileInput;
      sizeBytes = fileBuffer.length;
    } else if (typeof fileInput === 'string' && fs.existsSync(fileInput)) {
      fileBuffer = fs.readFileSync(fileInput);
      sizeBytes = fileBuffer.length;
    } else {
      return { success: false, code: 'FILE_NOT_FOUND', error: 'Không tìm thấy dữ liệu tệp PDF để tải lên.' };
    }

    const checksumSha256 = computeSha256(fileBuffer);

    // 3. Đảm bảo bucket 'documents' sẵn sàng
    await ensureDocumentsBucketExists('documents');

    const cleanObjectKey = objectKey.replace(/^\/+/, '');

    // 4. Upload lên Supabase Storage
    const { data, error } = await supabaseAdmin.storage
      .from('documents')
      .upload(cleanObjectKey, fileBuffer, {
        contentType: 'application/pdf',
        upsert: true
      });

    if (error) {
      console.error('❌ Lỗi upload PDF lên Supabase Storage:', error.message);
      return { success: false, code: 'STORAGE_UPLOAD_ERROR', error: error.message };
    }

    // 5. Kiểm tra xác thực object thực tế tồn tại trên storage
    const exists = await checkObjectExists(cleanObjectKey, 'documents');
    if (!exists) {
      console.error('❌ Xác minh PDF trên Supabase Storage thất bại sau khi upload:', cleanObjectKey);
      return { success: false, code: 'STORAGE_VERIFICATION_FAILED', error: 'Không thể xác minh tài liệu PDF trên máy chủ lưu trữ sau khi tải lên.' };
    }

    // Xóa cache cũ nếu có
    invalidateSignedUrlCache(cleanObjectKey, 'documents');

    return {
      success: true,
      storageKey: cleanObjectKey,
      storageBucket: 'documents',
      mimeType: 'application/pdf',
      sizeBytes,
      checksumSha256
    };
  } catch (err) {
    console.error('❌ Exception khi upload PDF lên Supabase:', err);
    return { success: false, code: 'STORAGE_EXCEPTION', error: err.message };
  }
};

/**
 * Kiểm tra xem một Storage Object có tồn tại trên Supabase hay không
 * @param {string} objectKey 
 * @param {string} bucketName 
 * @returns {Promise<boolean>}
 */
const checkObjectExists = async (objectKey, bucketName = 'videos') => {
  try {
    if (!objectKey) return false;
    if (!supabaseAdmin?.storage) return false;
    const cleanPath = objectKey.replace(/^\/+/, '');
    const { data, error } = await supabaseAdmin.storage
      .from(bucketName)
      .createSignedUrl(cleanPath, 60);
    return !error && !!data?.signedUrl;
  } catch {
    return false;
  }
};

/**
 * Xóa một Storage Object khỏi Supabase (dùng cho Orphan Asset cleanup)
 * @param {string} objectKey 
 * @param {string} bucketName 
 * @returns {Promise<boolean>}
 */
const deleteStorageObject = async (objectKey, bucketName = 'videos') => {
  try {
    if (!objectKey) return false;
    if (!supabaseAdmin?.storage) return false;
    const cleanPath = objectKey.replace(/^\/+/, '');
    const { data, error } = await supabaseAdmin.storage
      .from(bucketName)
      .remove([cleanPath]);
    if (error) {
      console.warn(`⚠️ Không thể xóa object ${cleanPath} khỏi ${bucketName}:`, error.message);
      return false;
    }
    invalidateSignedUrlCache(cleanPath, bucketName);
    return true;
  } catch (err) {
    console.warn(`⚠️ Exception khi xóa object ${objectKey}:`, err.message);
    return false;
  }
};

/**
 * Tạo Signed URL cho tài nguyên từ Supabase Storage (có cache in-memory)
 * @param {string} filePath - Đường dẫn file trong bucket (ví dụ: 'courses/1/uuid/video.mp4')
 * @param {string} bucketName - Tên bucket (mặc định: 'videos')
 * @param {number} expiresIn - Thời gian sống của URL (giây), mặc định 3600s = 1 giờ
 * @returns {Promise<string|null>} Signed URL hoặc null nếu không phải Supabase storage key
 */
const generateSignedUrl = async (filePath, bucketName = 'videos', expiresIn = 3600) => {
  try {
    if (!filePath) return null;

    // Không xử lý và không gọi Supabase cho đường dẫn local legacy
    if (filePath.startsWith('/uploads/')) {
      return null;
    }

    // Nếu filePath là link ngoài (vd: Youtube, Vimeo, CDN ngoài không thuộc Supabase)
    if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
      if (!filePath.includes('supabase.co')) {
        return filePath;
      }
    }

    // Xử lý nếu filePath chứa URL đầy đủ của Supabase
    let finalPath = filePath;
    let finalBucket = bucketName;
    if (filePath.includes('supabase.co')) {
      try {
        const urlObj = new URL(filePath);
        const pathParts = urlObj.pathname.split('/');
        const bucketIndex = pathParts.findIndex(p => p === 'public' || p === 'sign' || p === 'authenticated');
        if (bucketIndex !== -1 && pathParts.length > bucketIndex + 2) {
          finalBucket = pathParts[bucketIndex + 1];
          finalPath = pathParts.slice(bucketIndex + 2).join('/');
        }
      } catch (e) {
        console.warn('Invalid Supabase URL format, using raw path', e);
      }
    }

    // Loại bỏ dấu / ở đầu nếu có
    finalPath = finalPath.replace(/^\/+/, '');

    // Tự động nhận diện bucket nếu filePath có đuôi .pdf mà bucketName mặc định là 'videos'
    if (finalPath.endsWith('.pdf') && finalBucket === 'videos') {
      finalBucket = 'documents';
    }

    // Kiểm tra cache — tránh gọi Supabase API mỗi request
    const cacheKey = `${finalBucket}::${finalPath}`;
    const cached = signedUrlCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.url; // Cache hit — trả về ngay, 0ms
    }

    if (!supabaseAdmin?.storage) {
      return null;
    }

    // Cache miss — gọi Supabase API để tạo Signed URL mới
    const { data, error } = await supabaseAdmin.storage
      .from(finalBucket)
      .createSignedUrl(finalPath, expiresIn);

    if (error) {
      console.warn(`⚠️ Lỗi tạo signed URL cho ${finalPath} (${finalBucket}):`, error.message);
      return null;
    }

    // Lưu vào cache với TTL (trừ đi 5 phút dự phòng)
    const effectiveTtlMs = Math.max(60000, (expiresIn - 300) * 1000);
    signedUrlCache.set(cacheKey, {
      url: data.signedUrl,
      expiresAt: Date.now() + effectiveTtlMs
    });

    return data.signedUrl;
  } catch (error) {
    console.error('Exception generating signed URL:', error);
    return null;
  }
};

/**
 * Xóa cache theo filePath cụ thể (dùng khi upload file mới)
 * @param {string} filePath
 * @param {string} bucketName
 */
const invalidateSignedUrlCache = (filePath, bucketName = 'videos') => {
  const cleanPath = filePath.replace(/^\/+/, '');
  const cacheKey = `${bucketName}::${cleanPath}`;
  signedUrlCache.delete(cacheKey);
  // Cũng xóa trường hợp bucket documents
  if (cleanPath.endsWith('.pdf')) {
    signedUrlCache.delete(`documents::${cleanPath}`);
  }
};

/**
 * Xóa toàn bộ cache (dùng khi cần force refresh)
 */
const clearSignedUrlCache = () => {
  signedUrlCache.clear();
};

module.exports = {
  isValidMp4,
  computeSha256,
  ensureBucketExists,
  ensureVideosBucketExists,
  ensureDocumentsBucketExists,
  uploadVideoToSupabase,
  uploadDocumentToSupabase,
  checkObjectExists,
  deleteStorageObject,
  generateSignedUrl,
  invalidateSignedUrlCache,
  clearSignedUrlCache
};
