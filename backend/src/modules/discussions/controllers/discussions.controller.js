const discussionsService = require('../services/discussions.service');

exports.getStudentLessonData = async (req, res, next) => {
  try {
    const data = await discussionsService.listStudentDiscussions(req.user, req.params.lessonId);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

exports.createDiscussion = async (req, res, next) => {
  try {
    const discussion = await discussionsService.createDiscussion(req.user, req.body || {});
    res.status(201).json({
      success: true,
      message: 'Đã gửi câu hỏi cho giảng viên',
      data: { discussion }
    });
  } catch (error) {
    next(error);
  }
};

exports.sendStudentMessage = async (req, res, next) => {
  try {
    const discussion = await discussionsService.sendStudentMessage(req.user, req.body || {});
    res.status(201).json({
      success: true,
      message: 'Đã gửi tin nhắn cho giảng viên',
      data: { discussion }
    });
  } catch (error) {
    next(error);
  }
};

exports.addReply = async (req, res, next) => {
  try {
    const discussion = await discussionsService.addReply(
      req.user,
      req.params.discussionId,
      req.body?.content,
      {
        aiResponse: req.body?.aiResponse,
        timestampSeconds: req.body?.timestampSeconds
      }
    );
    res.status(201).json({
      success: true,
      message: 'Đã gửi phản hồi',
      data: { discussion }
    });
  } catch (error) {
    next(error);
  }
};

exports.updateStatus = async (req, res, next) => {
  try {
    const discussion = await discussionsService.updateStatus(
      req.user,
      req.params.discussionId,
      req.body?.status
    );
    res.status(200).json({ success: true, data: { discussion } });
  } catch (error) {
    next(error);
  }
};

exports.markDiscussionRead = async (req, res, next) => {
  try {
    const result = await discussionsService.markDiscussionRead(req.user, req.params.discussionId);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

exports.getInstructorDiscussions = async (req, res, next) => {
  try {
    const discussions = await discussionsService.listInstructorDiscussions(req.user, req.query || {});
    res.status(200).json({ success: true, data: { discussions } });
  } catch (error) {
    next(error);
  }
};

exports.getInstructorSummary = async (req, res, next) => {
  try {
    const summary = await discussionsService.getInstructorSummary(req.user);
    res.status(200).json({ success: true, data: summary });
  } catch (error) {
    next(error);
  }
};

exports.getInstructorAnnouncements = async (req, res, next) => {
  try {
    const announcements = await discussionsService.listInstructorAnnouncements(req.user);
    res.status(200).json({ success: true, data: { announcements } });
  } catch (error) {
    next(error);
  }
};

exports.createAnnouncement = async (req, res, next) => {
  try {
    const announcement = await discussionsService.createAnnouncement(req.user, req.body || {});
    res.status(201).json({
      success: true,
      message: 'Đã phát hành thông báo khóa học',
      data: { announcement }
    });
  } catch (error) {
    next(error);
  }
};

exports.markAnnouncementRead = async (req, res, next) => {
  try {
    const result = await discussionsService.markAnnouncementRead(req.user, req.params.announcementId);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};
