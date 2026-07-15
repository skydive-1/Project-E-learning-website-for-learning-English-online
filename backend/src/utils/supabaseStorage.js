const supabase = require('../config/supabase');

/**
 * Tạo Signed URL cho video từ Supabase Storage
 * @param {string} filePath - Đường dẫn file trong bucket (ví dụ: 'courses/videos/lesson1.mp4')
 * @param {string} bucketName - Tên bucket (mặc định: 'videos' hoặc 'courses')
 * @param {number} expiresIn - Thời gian sống của URL (giây), mặc định 3600s = 1 giờ
 * @returns {Promise<string>} Signed URL
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
    if (filePath.includes('supabase.co')) {
      // Trích xuất path từ URL (giả sử URL có dạng https://[project].supabase.co/storage/v1/object/public/[bucket]/[path])
      try {
        const urlObj = new URL(filePath);
        const pathParts = urlObj.pathname.split('/');
        // Tìm vị trí của bucket, thường nằm sau /object/public/ hoặc /object/sign/
        const bucketIndex = pathParts.findIndex(p => p === 'public' || p === 'sign' || p === 'authenticated');
        if (bucketIndex !== -1 && pathParts.length > bucketIndex + 2) {
          bucketName = pathParts[bucketIndex + 1];
          finalPath = pathParts.slice(bucketIndex + 2).join('/');
        }
      } catch (e) {
        console.warn('Invalid Supabase URL format, using raw path', e);
      }
    }

    // Loại bỏ dấu / ở đầu nếu có
    finalPath = finalPath.replace(/^\//, '');

    // Default bucket nếu filepath chứa dạng courses/videos/... mà user không pass bucket, 
    // Tùy theo logic dự án, ta có thể hardcode hoặc parse. Ở đây default là 'videos'.
    // Nhưng nếu config bucketName được pass, dùng nó.

    const { data, error } = await supabase.storage
      .from(bucketName)
      .createSignedUrl(finalPath, expiresIn);

    if (error) {
      console.error('Error generating signed URL:', error.message);
      // Fallback về url cũ nếu lỗi
      return filePath;
    }

    return data.signedUrl;
  } catch (error) {
    console.error('Exception generating signed URL:', error);
    return filePath;
  }
};

module.exports = {
  generateSignedUrl
};
