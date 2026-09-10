/**
 * Real-time SSE Controller for Instructor Dashboard
 * Handles Server-Sent Events connections for real-time updates
 */

const jwt = require('jsonwebtoken');
const db = require('../../../config/database');

/**
 * Map of connected clients: userId -> { response, lastHeartbeat, events }
 */
const connectedClients = new Map();

/**
 * Send event to specific user
 * @param {number} userId - Target user ID
 * @param {string} event - Event name
 * @param {Object} data - Event data
 */
function sendToUser(userId, event, data) {
  const client = connectedClients.get(userId);
  if (client && !client.response.destroyed) {
    try {
      client.response.write(`event: ${event}\n`);
      client.response.write(`data: ${JSON.stringify(data)}\n\n`);
      return true;
    } catch (err) {
      console.error(`Failed to send SSE to user ${userId}:`, err);
      return false;
    }
  }
  return false;
}

/**
 * Broadcast event to all connected instructors
 * @param {string} event - Event name
 * @param {Object} data - Event data
 * @param {number} [excludeUserId] - User ID to exclude
 */
function broadcast(event, data, excludeUserId = null) {
  let sent = 0;
  connectedClients.forEach((client, userId) => {
    if (userId !== excludeUserId && !client.response.destroyed) {
      try {
        client.response.write(`event: ${event}\n`);
        client.response.write(`data: ${JSON.stringify(data)}\n\n`);
        sent++;
      } catch (err) {
        console.error(`Failed to broadcast to user ${userId}:`, err);
      }
    }
  });
  return sent;
}

/**
 * SSE Stream endpoint handler
 * GET /api/instructor/realtime/stream
 */
exports.stream = async (req, res, next) => {
  try {
    const user = req.user;
    const userId = user.id || user.userId;

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
    res.flushHeaders();

    // Store client connection
    const clientData = {
      response: res,
      userId,
      connectedAt: Date.now(),
      lastHeartbeat: Date.now(),
      events: new Set()
    };
    connectedClients.set(userId, clientData);

    console.log(`[SSE] Instructor ${userId} connected. Total clients: ${connectedClients.size}`);

    // Send initial connection confirmation
    res.write(`event: connected\n`);
    res.write(`data: ${JSON.stringify({ userId, timestamp: Date.now() })}\n\n`);

    // Heartbeat interval
    const heartbeatInterval = setInterval(() => {
      if (res.destroyed) {
        clearInterval(heartbeatInterval);
        return;
      }
      try {
        res.write(`event: heartbeat\n`);
        res.write(`data: ${JSON.stringify({ timestamp: Date.now() })}\n\n`);
      } catch (err) {
        clearInterval(heartbeatInterval);
      }
    }, 30000); // Every 30 seconds

    // Cleanup on disconnect
    req.on('close', () => {
      clearInterval(heartbeatInterval);
      connectedClients.delete(userId);
      console.log(`[SSE] Instructor ${userId} disconnected. Total clients: ${connectedClients.size}`);
    });

    // Keep connection alive (prevent timeout)
    req.on('error', (err) => {
      clearInterval(heartbeatInterval);
      connectedClients.delete(userId);
      console.error(`[SSE] Error for instructor ${userId}:`, err);
    });

  } catch (error) {
    console.error('[SSE] Stream error:', error);
    next(error);
  }
};

/**
 * Notify instructor of new discussion
 * @param {number} instructorId - Instructor user ID
 * @param {Object} discussion - Discussion data
 */
exports.notifyNewDiscussion = (instructorId, discussion) => {
  return sendToUser(instructorId, 'notification', {
    type: 'discussion_pending',
    discussionId: discussion.discussion_id,
    lessonId: discussion.lesson_id,
    studentId: discussion.student_id,
    studentName: discussion.student_name,
    title: discussion.title,
    preview: discussion.content?.substring(0, 100),
    timestamp: new Date().toISOString()
  });
};

/**
 * Notify instructor of discussion update (reply, status change)
 * @param {number} instructorId - Instructor user ID
 * @param {Object} discussion - Updated discussion data
 */
exports.notifyDiscussionUpdate = (instructorId, discussion) => {
  return sendToUser(instructorId, 'discussion_update', {
    discussionId: discussion.discussion_id,
    lessonId: discussion.lesson_id,
    status: discussion.status,
    hasNewReply: true,
    timestamp: new Date().toISOString()
  });
};

/**
 * Notify instructor of new student enrollment
 * @param {number} instructorId - Instructor user ID
 * @param {Object} enrollment - Enrollment data
 */
exports.notifyStudentEnrollment = (instructorId, enrollment) => {
  return sendToUser(instructorId, 'student_enrollment', {
    studentId: enrollment.student_id,
    studentName: enrollment.student_name,
    studentEmail: enrollment.student_email,
    courseId: enrollment.course_id,
    courseName: enrollment.course_name,
    enrolledAt: new Date().toISOString()
  });
};

/**
 * Notify instructor of quiz submission
 * @param {number} instructorId - Instructor user ID
 * @param {Object} submission - Quiz submission data
 */
exports.notifyQuizSubmission = (instructorId, submission) => {
  return sendToUser(instructorId, 'quiz_submission', {
    quizId: submission.quiz_id,
    lessonId: submission.lesson_id,
    studentId: submission.student_id,
    studentName: submission.student_name,
    score: submission.score,
    totalQuestions: submission.total_questions,
    submittedAt: new Date().toISOString()
  });
};

/**
 * Notify instructor of course update
 * @param {number} instructorId - Instructor user ID
 * @param {Object} course - Updated course data
 */
exports.notifyCourseUpdate = (instructorId, course) => {
  return sendToUser(instructorId, 'course_update', {
    courseId: course.course_id,
    title: course.course_name,
    status: course.status,
    updatedAt: new Date().toISOString()
  });
};

/**
 * Get count of connected clients
 * @returns {number}
 */
exports.getConnectedCount = () => connectedClients.size;

/**
 * Get list of connected user IDs
 * @returns {number[]}
 */
exports.getConnectedUsers = () => Array.from(connectedClients.keys());

/**
 * Close all connections (for graceful shutdown)
 */
exports.closeAll = () => {
  connectedClients.forEach((client, userId) => {
    try {
      res.write(`event: server_shutdown\n`);
      res.write(`data: ${JSON.stringify({ message: 'Server shutting down' })}\n\n`);
      client.response.end();
    } catch (err) {
      // Ignore
    }
  });
  connectedClients.clear();
};