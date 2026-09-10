const express = require('express');
const controller = require('./controllers/discussions.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const { createRateLimiter } = require('../../middleware/rateLimit.middleware');

const router = express.Router();

const writeLimiter = createRateLimiter({
  name: 'discussion-write',
  windowMs: 15 * 60 * 1000,
  limit: 60,
  // authenticate chạy trước limiter, nên khóa luôn dựa trên user id và không có IPv6 fallback.
  keyGenerator: req => `user:${req.user.id}`
});

router.use(authenticate);

// Instructor/admin endpoints must be declared before parameterized routes.
router.get('/instructor/threads', authorize([1, 2]), controller.getInstructorDiscussions);
router.get('/instructor/summary', authorize([1, 2]), controller.getInstructorSummary);
router.get('/instructor/announcements', authorize([1, 2]), controller.getInstructorAnnouncements);
router.post(
  '/instructor/announcements',
  authorize([1, 2]),
  writeLimiter,
  controller.createAnnouncement
);

router.get('/lesson/:lessonId', authorize([3]), controller.getStudentLessonData);
router.post('/messages', authorize([3]), writeLimiter, controller.sendStudentMessage);
router.post('/', authorize([3]), writeLimiter, controller.createDiscussion);
router.post('/:discussionId/replies', writeLimiter, controller.addReply);
router.patch('/:discussionId/status', writeLimiter, controller.updateStatus);
router.patch('/:discussionId/read', writeLimiter, controller.markDiscussionRead);
router.patch(
  '/announcements/:announcementId/read',
  authorize([3]),
  writeLimiter,
  controller.markAnnouncementRead
);

module.exports = router;
