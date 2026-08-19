const fs = require('fs');
const path = require('path');
const { supabaseAdmin, supabaseClient } = require('../config/supabase');
const supabase = supabaseAdmin || require('../config/supabase');

/**
 * Cache in-memory cho Signed URL của Supabase Storage
 * Key: `bucket::path`, Value: { url, expiresAt }
 * TTL = 55 phút — Signed URL sống 60 phút, cache trước 5 phút để tránh dùng URL gần hết hạn
 */
const signedUrlCache = new Map();
const CACHE_TTL_MS = 55 * 60 * 1000; // 55 phút

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
 * Đảm bảo bucket 'videos' tồn tại trên Supabase Storage
 */
const ensureVideosBucketExists = async (bucketName = 'videos') => {
  try {
    const { data: buckets, error } = await supabaseAdmin.storage.listBuckets();
    if (error) {
      console.warn('⚠️ Không thể liệt kê danh sách buckets:', error.message);
      return false;
    }
    const exists = buckets && buckets.some(b => b.name === bucketName);
    if (!exists) {
      const { data, error: createError } = await supabaseAdmin.storage.createBucket(bucketName, {
        public: false,
        fileSizeLimit: 524288000 // 500MB
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

/**
 * Upload video trực tiếp lên Supabase Storage bucket 'videos'
 * @param {string|Buffer} fileInput - Đường dẫn file cục bộ hoặc Buffer
 * @param {string} objectKey - Đường dẫn lưu trữ (ví dụ: 'courses/1/uuid/video.mp4')
 * @param {string} mimeType - MIME type, bắt buộc là 'video/mp4'
 * @returns {Promise<{ success: boolean, storageKey?: string, error?: string }>}
 */
const uploadVideoToSupabase = async (fileInput, objectKey, mimeType = 'video/mp4') => {
  try {
    if (!objectKey) {
      return { success: false, error: 'Thiếu objectKey lưu trữ' };
    }

    // 1. Kiểm tra tính hợp lệ của MP4
    if (mimeType !== 'video/mp4') {
      return { success: false, error: `Định dạng MIME không hợp lệ (${mimeType}). Hệ thống chỉ chấp nhận 'video/mp4'.` };
    }

    if (!isValidMp4(fileInput)) {
      return { success: false, error: 'Tệp tải lên không phải là file MP4 hợp lệ (thiếu header ftyp chuẩn).' };
    }

    // 2. Chuẩn bị Buffer
    let fileBuffer;
    if (Buffer.isBuffer(fileInput)) {
      fileBuffer = fileInput;
    } else if (typeof fileInput === 'string' && fs.existsSync(fileInput)) {
      fileBuffer = fs.readFileSync(fileInput);
    } else {
      return { success: false, error: 'Không tìm thấy dữ liệu tệp video để tải lên.' };
    }

    // 3. Đảm bảo bucket sẵn sàng
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
      return { success: false, error: error.message };
    }

    // Xóa cache cũ nếu có
    invalidateSignedUrlCache(cleanObjectKey, 'videos');

    return {
      success: true,
      storageKey: cleanObjectKey
    };
  } catch (err) {
    console.error('❌ Exception khi upload video lên Supabase:', err);
    return { success: false, error: err.message };
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
    const cleanPath = objectKey.replace(/^\/+/, '');
    const { data, error } = await supabaseAdmin.storage
      .from(bucketName)
      .remove([cleanPath]);
    if (error) {
      console.warn(`⚠️ Không thể xóa object ${cleanPath}:`, error.message);
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
 * Tạo Signed URL cho video từ Supabase Storage (có cache in-memory)
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

    // Kiểm tra cache — tránh gọi Supabase API mỗi request
    const cacheKey = `${finalBucket}::${finalPath}`;
    const cached = signedUrlCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.url; // Cache hit — trả về ngay, 0ms
    }

    // Cache miss — gọi Supabase API để tạo Signed URL mới
    const { data, error } = await supabaseAdmin.storage
      .from(finalBucket)
      .createSignedUrl(finalPath, expiresIn);

    if (error) {
      console.warn(`⚠️ Lỗi tạo signed URL cho ${finalPath}:`, error.message);
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
  const cacheKey = `${bucketName}::${filePath.replace(/^\/+/, '')}`;
  signedUrlCache.delete(cacheKey);
};

/**
 * Xóa toàn bộ cache (dùng khi cần force refresh)
 */
const clearSignedUrlCache = () => {
  signedUrlCache.clear();
};

module.exports = {
  isValidMp4,
  ensureVideosBucketExists,
  uploadVideoToSupabase,
  checkObjectExists,
  deleteStorageObject,
  generateSignedUrl,
  invalidateSignedUrlCache,
  clearSignedUrlCache
};

