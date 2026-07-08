const fs = require('fs');
const path = require('path');
const lessonsService = require('../services/lessons.service');

exports.getLessonsByQuery = async (req, res, next) => {
  try {
    const { courseId, sectionId } = req.query;
    const lessons = await lessonsService.getLessonsByQuery({ courseId, sectionId });
    res.status(200).json({
      success: true,
      message: 'Lấy danh sách bài giảng thành công',
      lessons
    });
  } catch (error) {
    next(error);
  }
};

exports.createLesson = async (req, res, next) => {
  try {
    const lesson = await lessonsService.createLesson(req.body);
    res.status(201).json({
      success: true,
      message: 'Tạo bài giảng mới thành công',
      lesson
    });
  } catch (error) {
    next(error);
  }
};

exports.updateLesson = async (req, res, next) => {
  try {
    const { lessonId } = req.params;
    const lesson = await lessonsService.updateLesson(lessonId, req.body);
    if (!lesson) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy bài giảng để cập nhật'
      });
    }
    res.status(200).json({
      success: true,
      message: 'Cập nhật bài giảng thành công',
      lesson
    });
  } catch (error) {
    next(error);
  }
};

exports.deleteLesson = async (req, res, next) => {
  try {
    const { lessonId } = req.params;
    const result = await lessonsService.deleteLesson(lessonId);
    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy bài giảng để xóa'
      });
    }
    res.status(200).json({
      success: true,
      message: 'Xóa bài giảng thành công'
    });
  } catch (error) {
    next(error);
  }
};

exports.streamLessonVideo = async (req, res, next) => {
  try {
    const { lessonId } = req.params;
    const lesson = await lessonsService.getLessonById(lessonId);
    
    if (!lesson) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy bài giảng'
      });
    }

    if (lesson.content_type !== 'video' || !lesson.content_url) {
      return res.status(400).json({
        success: false,
        message: 'Bài giảng này không chứa tài nguyên video'
      });
    }

    const contentUrl = lesson.content_url;

    // Nếu là link video bên ngoài (http/https), redirect trực tiếp
    if (contentUrl.startsWith('http://') || contentUrl.startsWith('https://')) {
      return res.redirect(contentUrl);
    }

    // Đường dẫn file video cục bộ
    const filePath = path.resolve(__dirname, '../../../../', contentUrl.replace(/^\//, ''));

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'Tệp video không tồn tại trên hệ thống'
      });
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (start >= fileSize) {
        res.status(416).send('Requested range not satisfiable\n' + start + ' >= ' + fileSize);
        return;
      }

      const chunksize = (end - start) + 1;
      const file = fs.createReadStream(filePath, { start, end });
      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': 'video/mp4',
      };

      res.writeHead(206, head);
      file.pipe(res);
    } else {
      const head = {
        'Content-Length': fileSize,
        'Content-Type': 'video/mp4',
      };
      res.writeHead(200, head);
      fs.createReadStream(filePath).pipe(res);
    }
  } catch (error) {
    next(error);
  }
};
