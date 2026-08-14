const supabase = require('../config/supabase');

/**
 * Cache in-memory cho Signed URL của Supabase Storage
 * Key: `bucket::path`, Value: { url, expiresAt }
 * TTL = 55 phút — Signed URL sống 60 phút, cache trước 5 phút để tránh dùng URL gần hết hạn
 */
const signedUrlCache = new Map();
const CACHE_TTL_MS = 55 * 60 * 1000; // 55 phút

/**
 * Tạo Signed URL cho video từ Supabase Storage (có cache in-memory)
 * @param {string} filePath - Đường dẫn file trong bucket (ví dụ: 'courses/videos/lesson1.mp4')
 * @param {string} bucketName - Tên bucket (mặc định: 'videos')
 * @param {number} expiresIn - Thời gian sống của URL (giây), mặc định 3600s = 1 giờ
 * @returns {Promise<string>} Signed URL (hoặc filePath gốc nếu không cần ký)
 */
const generateSignedUrl = async (filePath, bucketName = 'videos', expiresIn = 3600) => {
  try {
    if (!filePath) return null;

    // Nếu filePath đã là http URL nhưng không phải supabase thì trả về luôn (vd youtube)
    if (filePath.startsWith('http') && !filePath.includes('supabase.co')) {
      return filePath;
    }

    // Xử lý nếu filePath chứa URL đầy đủ của Supabase
    let finalPath = filePath;
    let finalBucket = bucketName;
    if (filePath.includes('supabase.co')) {
      // Trích xuất path từ URL (dạng https://[project].supabase.co/storage/v1/object/public/[bucket]/[path])
      try {
        const urlObj = new URL(filePath);
        const pathParts = urlObj.pathname.split('/');
        // Tìm vị trí của bucket, thường nằm sau /object/public/ hoặc /object/sign/
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
    finalPath = finalPath.replace(/^\//, '');

    // Kiểm tra cache — tránh gọi Supabase API mỗi request
    const cacheKey = `${finalBucket}::${finalPath}`;
    const cached = signedUrlCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.url; // Cache hit — trả về ngay, 0ms
    }

    // Cache miss — gọi Supabase API để tạo Signed URL mới
    const { data, error } = await supabase.storage
      .from(finalBucket)
      .createSignedUrl(finalPath, expiresIn);

    if (error) {
      console.error('Error generating signed URL:', error.message);
      return filePath; // Fallback về url gốc
    }

    // Lưu vào cache với TTL 55 phút
    signedUrlCache.set(cacheKey, {
      url: data.signedUrl,
      expiresAt: Date.now() + CACHE_TTL_MS
    });

    return data.signedUrl;
  } catch (error) {
    console.error('Exception generating signed URL:', error);
    return filePath;
  }
};

/**
 * Xóa cache theo filePath cụ thể (dùng khi upload file mới)
 * @param {string} filePath
 * @param {string} bucketName
 */
const invalidateSignedUrlCache = (filePath, bucketName = 'videos') => {
  const cacheKey = `${bucketName}::${filePath.replace(/^\//, '')}`;
  signedUrlCache.delete(cacheKey);
};

/**
 * Xóa toàn bộ cache (dùng khi cần force refresh)
 */
const clearSignedUrlCache = () => {
  signedUrlCache.clear();
};

module.exports = {
  generateSignedUrl,
  invalidateSignedUrlCache,
  clearSignedUrlCache
};
