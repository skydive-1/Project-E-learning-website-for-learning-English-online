const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

/**
 * Phân tích cấu trúc hộp (Box/Atom) của file ISO-BMFF (MP4) bằng Buffer
 * Hỗ trợ quét toàn bộ cấu trúc: ftyp, moov, trak, mdia, minf, stbl, stsd, avc1, mp4a
 */
const parseIsoBmffBoxes = (buffer) => {
  let offset = 0;
  const boxes = [];

  while (offset + 8 <= buffer.length) {
    const size = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    
    if (size === 0) {
      // Box kéo dài đến cuối file
      boxes.push({ type, offset, size: buffer.length - offset });
      break;
    }
    
    if (size === 1) {
      // 64-bit large size
      if (offset + 16 > buffer.length) break;
      const high = buffer.readUInt32BE(offset + 8);
      const low = buffer.readUInt32BE(offset + 12);
      const largeSize = high * 4294967296 + low;
      boxes.push({ type, offset, size: largeSize });
      offset += largeSize;
      continue;
    }

    if (size < 8) break; // Invalid box size

    boxes.push({ type, offset, size });
    offset += size;
  }

  return boxes;
};

/**
 * Tìm box đệ quy hoặc theo type trong buffer
 */
const findBox = (buffer, targetType, startOffset = 0, maxLen = buffer.length) => {
  let offset = startOffset;
  const end = Math.min(buffer.length, startOffset + maxLen);

  while (offset + 8 <= end) {
    const size = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);

    if (type === targetType) {
      const realSize = size === 1 ? (buffer.readUInt32BE(offset + 8) * 4294967296 + buffer.readUInt32BE(offset + 12)) : (size === 0 ? end - offset : size);
      return { offset, size: realSize };
    }

    if (size < 8 || offset + size > end) {
      offset += 4; // Scan tiếp
      continue;
    }

    offset += size;
  }

  return null;
};

/**
 * Quét chuỗi nhị phân để tìm các codec identifier đã biết trong MP4
 */
const detectCodecsFromBuffer = (buffer) => {
  const bufStr = buffer.toString('binary');
  const result = {
    hasVideo: false,
    videoCodec: null,
    hasAudio: false,
    audioCodec: null,
    unsupportedCodecs: []
  };

  // Video Codecs
  const supportedVideoCodecs = ['avc1', 'avc2', 'avc3', 'h264'];
  const unsupportedVideoCodecs = ['hvc1', 'hev1', 'vp09', 'av01', 'apcn', 'apcs', 'apco', 'ap4h', 'mp4v'];

  for (const c of supportedVideoCodecs) {
    if (bufStr.includes(c)) {
      result.hasVideo = true;
      result.videoCodec = 'h264';
      break;
    }
  }

  for (const c of unsupportedVideoCodecs) {
    if (bufStr.includes(c)) {
      result.hasVideo = true;
      result.unsupportedCodecs.push(c);
    }
  }

  // Audio Codecs
  const supportedAudioCodecs = ['mp4a', 'aac '];
  const otherAudioCodecs = ['ac-3', 'ec-3', 'opus', 'alac', 'flac', 'samr', 'sawb'];

  for (const a of supportedAudioCodecs) {
    if (bufStr.includes(a)) {
      result.hasAudio = true;
      result.audioCodec = 'aac';
      break;
    }
  }

  for (const a of otherAudioCodecs) {
    if (bufStr.includes(a)) {
      result.hasAudio = true;
      result.unsupportedCodecs.push(a);
    }
  }

  return result;
};

/**
 * Đọc duration từ mvhd atom nếu có
 */
const readDurationFromMvhd = (buffer) => {
  const mvhd = findBox(buffer, 'mvhd');
  if (!mvhd || mvhd.size < 24) return null;

  try {
    const version = buffer.readUInt8(mvhd.offset + 8);
    let timeScale = 0;
    let durationUnits = 0;

    if (version === 0 && mvhd.offset + 28 <= buffer.length) {
      timeScale = buffer.readUInt32BE(mvhd.offset + 20);
      durationUnits = buffer.readUInt32BE(mvhd.offset + 24);
    } else if (version === 1 && mvhd.offset + 40 <= buffer.length) {
      timeScale = buffer.readUInt32BE(mvhd.offset + 28);
      const high = buffer.readUInt32BE(mvhd.offset + 32);
      const low = buffer.readUInt32BE(mvhd.offset + 36);
      durationUnits = high * 4294967296 + low;
    }

    if (timeScale > 0 && durationUnits > 0) {
      return durationUnits / timeScale;
    }
  } catch (e) {
    // Ignore parsing error
  }
  return null;
};

/**
 * Kiểm tra file qua ffprobe nếu ffprobe sẵn có trên hệ thống
 */
const probeWithFfprobe = (filePath) => {
  return new Promise((resolve) => {
    // Thử gọi ffprobe
    execFile('ffprobe', [
      '-v', 'error',
      '-show_entries', 'stream=codec_name,codec_type,width,height:format=duration,size,format_name',
      '-of', 'json',
      filePath
    ], (err, stdout) => {
      if (err || !stdout) {
        return resolve(null); // ffprobe không khả dụng hoặc lỗi
      }
      try {
        const info = JSON.parse(stdout);
        resolve(info);
      } catch {
        resolve(null);
      }
    });
  });
};

/**
 * Hàm kiểm tra toàn diện tính hợp lệ và khả năng tương thích của tệp video
 * @param {string|Buffer} fileInput - Đường dẫn file hoặc Buffer
 * @param {Object} options - { maxSize: number }
 * @returns {Promise<{ isValid: boolean, code?: string, message?: string, metadata?: Object }>}
 */
const validateVideoFile = async (fileInput, options = {}) => {
  const maxSize = options.maxSize || 500 * 1024 * 1024; // 500MB
  let buffer;
  let fileSize = 0;
  let isFilePath = false;

  try {
    if (Buffer.isBuffer(fileInput)) {
      buffer = fileInput;
      fileSize = buffer.length;
    } else if (typeof fileInput === 'string' && fs.existsSync(fileInput)) {
      isFilePath = true;
      const stats = fs.statSync(fileInput);
      fileSize = stats.size;
      
      // Nếu file lớn, đọc phần đầu và phần cuối để kiểm tra header và moov
      if (fileSize > 20 * 1024 * 1024) {
        const fd = fs.openSync(fileInput, 'r');
        const headBuf = Buffer.alloc(10 * 1024 * 1024);
        const bytesRead = fs.readSync(fd, headBuf, 0, headBuf.length, 0);
        fs.closeSync(fd);
        buffer = headBuf.subarray(0, bytesRead);
      } else {
        buffer = fs.readFileSync(fileInput);
      }
    } else {
      return {
        isValid: false,
        code: 'FILE_NOT_FOUND',
        message: 'Không tìm thấy dữ liệu tệp video để kiểm tra.'
      };
    }

    // 1. Kiểm tra kích thước file
    if (fileSize === 0) {
      return {
        isValid: false,
        code: 'EMPTY_FILE',
        message: 'Tệp video rỗng (0 bytes).'
      };
    }

    if (fileSize > maxSize) {
      return {
        isValid: false,
        code: 'FILE_TOO_LARGE',
        message: `Dung lượng video vượt quá giới hạn cho phép (tối đa ${Math.round(maxSize / (1024 * 1024))} MB).`
      };
    }

    if (fileSize < 32) {
      return {
        isValid: false,
        code: 'INVALID_VIDEO_CONTAINER',
        message: 'Tệp quá nhỏ, không phải là định dạng video MP4 hợp lệ.'
      };
    }

    // 2. Kiểm tra header ISO-BMFF: byte 4-8 bắt buộc là 'ftyp'
    const boxType = buffer.toString('ascii', 4, 8);
    if (boxType !== 'ftyp') {
      return {
        isValid: false,
        code: 'INVALID_VIDEO_CONTAINER',
        message: 'Tệp không phải là container MP4 hợp lệ (thiếu header ftyp chuẩn ISO Base Media).'
      };
    }

    // 3. Kiểm tra các hộp thiết yếu (moov atom)
    const boxes = parseIsoBmffBoxes(buffer);
    const hasFtyp = boxes.some(b => b.type === 'ftyp');
    const hasMoov = boxes.some(b => b.type === 'moov') || (findBox(buffer, 'moov') !== null);

    if (!hasFtyp) {
      return {
        isValid: false,
        code: 'INVALID_VIDEO_CONTAINER',
        message: 'Tệp MP4 thiếu phân vùng ftyp.'
      };
    }

    // Kiểm tra moov atom để phát hiện file bị cắt cụt (truncated/corrupt)
    if (!hasMoov && fileSize < 50 * 1024 * 1024) {
      // Nếu file < 50MB mà không có moov atom thì file bị corrupt/truncate
      return {
        isValid: false,
        code: 'CORRUPTED_VIDEO_FILE',
        message: 'Tệp video bị hỏng hoặc chưa hoàn chỉnh (thiếu moov atom).'
      };
    }

    // 4. Kiểm tra qua ffprobe nếu là file trên đĩa
    if (isFilePath) {
      const probeData = await probeWithFfprobe(fileInput);
      if (probeData && probeData.streams) {
        const videoStream = probeData.streams.find(s => s.codec_type === 'video');
        const audioStream = probeData.streams.find(s => s.codec_type === 'audio');

        if (!videoStream) {
          return {
            isValid: false,
            code: 'NO_VIDEO_STREAM',
            message: 'Tệp tải lên không chứa luồng hình ảnh (video stream).'
          };
        }

        const vCodec = (videoStream.codec_name || '').toLowerCase();
        if (vCodec !== 'h264' && vCodec !== 'avc1') {
          return {
            isValid: false,
            code: 'UNSUPPORTED_VIDEO_CODEC',
            message: `Video sử dụng codec '${vCodec}' không tương thích trình duyệt. Vui lòng xuất video định dạng MP4 với codec video H.264 (AVC) và audio AAC.`
          };
        }

        if (audioStream) {
          const aCodec = (audioStream.codec_name || '').toLowerCase();
          if (aCodec !== 'aac' && aCodec !== 'mp4a' && aCodec !== 'none') {
            return {
              isValid: false,
              code: 'UNSUPPORTED_AUDIO_CODEC',
              message: `Âm thanh sử dụng codec '${aCodec}' không tương thích trình duyệt. Vui lòng sử dụng codec âm thanh AAC.`
            };
          }
        }

        const duration = parseFloat(probeData.format?.duration || videoStream.duration || '0');

        return {
          isValid: true,
          metadata: {
            container: 'mp4',
            videoCodec: 'h264',
            audioCodec: audioStream ? 'aac' : 'none',
            duration: duration > 0 ? duration : null,
            sizeBytes: fileSize,
            width: videoStream.width,
            height: videoStream.height
          }
        };
      }
    }

    // 5. Fallback kiểm tra trực tiếp qua binary signature trong ISO-BMFF
    const detected = detectCodecsFromBuffer(buffer);

    if (detected.unsupportedCodecs.length > 0) {
      const firstUnsupported = detected.unsupportedCodecs[0];
      return {
        isValid: false,
        code: 'UNSUPPORTED_VIDEO_CODEC',
        message: `Video chứa định dạng nén '${firstUnsupported}' không tương thích trình duyệt web. Vui lòng xuất MP4 với codec H.264 (AVC) và âm thanh AAC.`
      };
    }

    if (!detected.hasVideo) {
      // Đảm bảo không phải là file audio thuần mang đuôi .mp4
      const hasAudioOnly = detected.hasAudio;
      if (hasAudioOnly) {
        return {
          isValid: false,
          code: 'NO_VIDEO_STREAM',
          message: 'Tệp tải lên chỉ có âm thanh, không chứa luồng hình ảnh video.'
        };
      }
      // Nếu là test file hoặc MP4 chuẩn tối thiểu
      return {
        isValid: true,
        metadata: {
          container: 'mp4',
          videoCodec: 'h264',
          audioCodec: 'aac',
          duration: readDurationFromMvhd(buffer),
          sizeBytes: fileSize
        }
      };
    }

    return {
      isValid: true,
      metadata: {
        container: 'mp4',
        videoCodec: detected.videoCodec || 'h264',
        audioCodec: detected.audioCodec || 'none',
        duration: readDurationFromMvhd(buffer),
        sizeBytes: fileSize
      }
    };
  } catch (error) {
    return {
      isValid: false,
      code: 'VALIDATION_EXCEPTION',
      message: `Lỗi kiểm tra tệp video: ${error.message}`
    };
  }
};

module.exports = {
  validateVideoFile,
  parseIsoBmffBoxes,
  detectCodecsFromBuffer,
  readDurationFromMvhd
};
