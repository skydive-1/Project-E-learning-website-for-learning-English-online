/**
 * Comments Routes - Định nghĩa các endpoints cho Module thảo luận & bình luận bài học
 */

const express = require('express');
const router = express.Router();
const commentsController = require('./controllers/comments.controller');
const { authenticate } = require('../../middleware/auth.middleware');

// Áp dụng middleware authenticate cho toàn bộ các endpoints bình luận
router.use(authenticate);

// GET /api/comments/lesson/:lessonId - Lấy danh sách bình luận (threaded)
router.get('/lesson/:lessonId', commentsController.getCommentsByLesson);

// POST /api/comments/lesson/:lessonId - Đăng bình luận mới / phản hồi
router.post('/lesson/:lessonId', commentsController.createComment);

// PUT /api/comments/:commentId - Chỉnh sửa nội dung bình luận
router.put('/:commentId', commentsController.updateComment);

// DELETE /api/comments/:commentId - Xóa bình luận
router.delete('/:commentId', commentsController.deleteComment);

// POST /api/comments/:commentId/upvote - Thả tim/Upvote hoặc bỏ upvote bình luận
router.post('/:commentId/upvote', commentsController.toggleUpvote);

// PUT /api/comments/:commentId/pin - Ghim hoặc bỏ ghim bình luận (Chỉ Giảng viên/Admin)
router.put('/:commentId/pin', commentsController.togglePin);

/**
 * @swagger
 * tags:
 *   name: Comments
 *   description: Hệ thống Thảo luận & Bình luận Bài học (Lesson Discussion)
 */

/**
 * @swagger
 * /api/comments/lesson/{lessonId}:
 *   get:
 *     summary: Lấy danh sách bình luận của bài học (threaded comments)
 *     description: Lấy danh sách bình luận của một bài học cụ thể, được tổ chức theo dạng cây phân cấp (cha-con), sắp xếp nổi bật bình luận được ghim.
 *     tags: [Comments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: lessonId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID của bài học
 *     responses:
 *       200:
 *         description: Lấy danh sách thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Lấy danh sách bình luận thành công
 *                 comments:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       comment_id:
 *                         type: integer
 *                       lesson_id:
 *                         type: integer
 *                       user_id:
 *                         type: integer
 *                       parent_id:
 *                         type: integer
 *                         nullable: true
 *                       content:
 *                         type: string
 *                       is_pinned:
 *                         type: boolean
 *                       created_at:
 *                         type: string
 *                       updated_at:
 *                         type: string
 *                       user_full_name:
 *                         type: string
 *                       user_avatar:
 *                         type: string
 *                         nullable: true
 *                       user_role:
 *                         type: string
 *                       user_role_id:
 *                         type: integer
 *                       reply_to_user_id:
 *                         type: integer
 *                         nullable: true
 *                       reply_to_user_name:
 *                         type: string
 *                         nullable: true
 *                       upvotes_count:
 *                         type: integer
 *                       is_upvoted:
 *                         type: boolean
 *                       replies:
 *                         type: array
 *                         items:
 *                           type: object
 *       404:
 *         description: Bài học không tồn tại
 * 
 *   post:
 *     summary: Đăng bình luận mới hoặc phản hồi bình luận khác
 *     description: Gửi bình luận mới vào bài học. Nếu muốn phản hồi bình luận khác, hãy truyền parentId trong request body.
 *     tags: [Comments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: lessonId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID của bài học
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *                 description: Nội dung bình luận
 *                 example: Bài giảng này rất hay và chi tiết, cảm ơn thầy!
 *               parentId:
 *                 type: integer
 *                 description: ID của bình luận cha nếu là phản hồi (reply)
 *                 example: null
 *     responses:
 *       201:
 *         description: Đăng bình luận thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Đăng bình luận thành công
 *                 comment:
 *                   type: object
 *       400:
 *         description: Dữ liệu đầu vào không hợp lệ hoặc bình luận cha không thuộc bài học này
 *       404:
 *         description: Bài học không tồn tại
 */

/**
 * @swagger
 * /api/comments/{commentId}:
 *   put:
 *     summary: Chỉnh sửa nội dung bình luận
 *     description: Cho phép người dùng chỉnh sửa nội dung bình luận chính mình.
 *     tags: [Comments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID của bình luận cần sửa
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *                 description: Nội dung bình luận mới
 *                 example: Bài giảng này cực kỳ hữu ích!
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 *       403:
 *         description: Không có quyền chỉnh sửa bình luận của người khác
 *       404:
 *         description: Bình luận không tồn tại
 * 
 *   delete:
 *     summary: Xóa bình luận
 *     description: Cho phép người sở hữu bình luận, giảng viên của khóa học hoặc admin xóa bình luận.
 *     tags: [Comments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID của bình luận cần xóa
 *     responses:
 *       200:
 *         description: Xóa thành công
 *       403:
 *         description: Không có quyền xóa
 *       404:
 *         description: Bình luận không tồn tại
 */

/**
 * @swagger
 * /api/comments/{commentId}/upvote:
 *   post:
 *     summary: Thả tim / Upvote bình luận (Toggle)
 *     description: Tăng/giảm lượt upvote cho bình luận. Nếu người dùng chưa upvote, hành động này sẽ thêm upvote. Nếu đã upvote, hành động này sẽ gỡ bỏ upvote.
 *     tags: [Comments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID của bình luận
 *     responses:
 *       200:
 *         description: Upvote/Bỏ upvote thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Đã upvote bình luận
 *                 upvoted:
 *                   type: boolean
 *                   example: true
 *                 upvotesCount:
 *                   type: integer
 *                   example: 5
 *       404:
 *         description: Bình luận không tồn tại
 */

/**
 * @swagger
 * /api/comments/{commentId}/pin:
 *   put:
 *     summary: Ghim hoặc Bỏ ghim bình luận (Chỉ dành cho Giảng viên / Admin)
 *     description: Cho phép Giảng viên của khóa học hoặc Admin ghim một bình luận lên đầu bài thảo luận (Chỉ cho phép ghim 1 bình luận nổi bật nhất tại 1 thời điểm trong 1 bài học, bình luận ghim trước đó sẽ tự động gỡ ghim).
 *     tags: [Comments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID của bình luận
 *     responses:
 *       200:
 *         description: Thực hiện thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 isPinned:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Ghim bình luận thành công
 *       403:
 *         description: Bạn không có quyền ghim bình luận của bài học này
 *       404:
 *         description: Bình luận không tồn tại
 */

module.exports = router;
