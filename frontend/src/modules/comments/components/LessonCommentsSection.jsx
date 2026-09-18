import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  FiMessageSquare,
  FiHeart,
  FiCornerDownRight,
  FiSend,
  FiTrash2,
  FiEdit2,
  FiCheck,
  FiX,
  FiBookmark,
  FiClock,
  FiLoader,
  FiRefreshCw
} from 'react-icons/fi';
import {
  getLessonComments,
  createComment,
  toggleUpvoteComment,
  togglePinComment,
  updateComment,
  deleteComment
} from '../services/comments.service';
import { useToast } from '../../../context/ToastContext';

// Helper format thời gian tương đối
const formatRelativeTime = (timestamp) => {
  if (!timestamp) return '';
  const now = new Date();
  const date = new Date(timestamp);
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'Vừa xong';
  if (diffMin < 60) return `${diffMin} phút trước`;
  if (diffHour < 24) return `${diffHour} giờ trước`;
  if (diffDay < 7) return `${diffDay} ngày trước`;

  return date.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

export default function LessonCommentsSection({ lessonId, user, onCommentsCountChange }) {
  const showToast = useToast();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [newCommentText, setNewCommentText] = useState('');

  // Trạng thái phản hồi (reply) và chỉnh sửa (edit)
  const [replyingToId, setReplyingToId] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editText, setEditText] = useState('');

  const currentUserId = user?.id || user?.userId;
  const userRoleId = parseInt(user?.roleId || user?.role, 10);
  const isInstructorOrAdmin = userRoleId === 1 || userRoleId === 2;

  const onCommentsCountChangeRef = useRef(onCommentsCountChange);
  useEffect(() => {
    onCommentsCountChangeRef.current = onCommentsCountChange;
  }, [onCommentsCountChange]);

  // Tính tổng số bình luận (bao gồm cả replies)
  const calculateTotalComments = (list) => {
    let count = 0;
    list.forEach((c) => {
      count += 1;
      if (c.replies && Array.isArray(c.replies)) {
        count += c.replies.length;
      }
    });
    return count;
  };

  // Tải danh sách bình luận từ backend
  const fetchComments = useCallback(async (showIndicator = true) => {
    if (!lessonId) return;
    if (showIndicator) setLoading(true);
    setError('');
    try {
      const data = await getLessonComments(lessonId);
      setComments(data);
      if (onCommentsCountChangeRef.current) {
        onCommentsCountChangeRef.current(calculateTotalComments(data));
      }
    } catch (err) {
      console.error('Lỗi khi tải bình luận:', err);
      setError('Không thể tải bình luận bài học. Vui lòng thử lại.');
    } finally {
      if (showIndicator) setLoading(false);
    }
  }, [lessonId]);

  useEffect(() => {
    fetchComments(true);
  }, [fetchComments]);

  // Gửi bình luận gốc mới
  const handlePostRootComment = async (e) => {
    e.preventDefault();
    if (!newCommentText.trim()) return;

    setSubmitting(true);
    try {
      const created = await createComment(lessonId, { content: newCommentText.trim() });
      if (created) {
        setNewCommentText('');
        showToast('Đã đăng bình luận thành công!', 'success');
        await fetchComments(false);
      }
    } catch (err) {
      console.error('Lỗi gửi bình luận:', err);
      showToast(err.response?.data?.message || 'Không thể đăng bình luận lúc này', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Gửi phản hồi (Reply)
  const handlePostReply = async (parentId) => {
    if (!replyText.trim()) return;

    setSubmitting(true);
    try {
      const created = await createComment(lessonId, {
        content: replyText.trim(),
        parentId
      });
      if (created) {
        setReplyText('');
        setReplyingToId(null);
        showToast('Đã đăng phản hồi thành công!', 'success');
        await fetchComments(false);
      }
    } catch (err) {
      console.error('Lỗi gửi phản hồi:', err);
      showToast(err.response?.data?.message || 'Không thể đăng phản hồi', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Thả tim / Upvote bình luận (Toggle Upvote với Optimistic UI)
  const handleToggleUpvote = async (commentId) => {
    if (!currentUserId) {
      showToast('Vui lòng đăng nhập để bình chọn câu trả lời này!', 'warning');
      return;
    }

    // Cập nhật Optimistic tức thời trên UI
    setComments((prev) =>
      prev.map((root) => {
        if (root.comment_id === commentId) {
          const nextUpvoted = !root.is_upvoted;
          return {
            ...root,
            is_upvoted: nextUpvoted,
            upvotes_count: nextUpvoted ? (root.upvotes_count || 0) + 1 : Math.max(0, (root.upvotes_count || 0) - 1)
          };
        }
        if (root.replies && root.replies.length > 0) {
          return {
            ...root,
            replies: root.replies.map((rep) => {
              if (rep.comment_id === commentId) {
                const nextUpvoted = !rep.is_upvoted;
                return {
                  ...rep,
                  is_upvoted: nextUpvoted,
                  upvotes_count: nextUpvoted ? (rep.upvotes_count || 0) + 1 : Math.max(0, (rep.upvotes_count || 0) - 1)
                };
              }
              return rep;
            })
          };
        }
        return root;
      })
    );

    try {
      const res = await toggleUpvoteComment(commentId);
      if (res && res.upvotesCount !== undefined) {
        // Đồng bộ số liệu chính xác từ Server
        setComments((prev) =>
          prev.map((root) => {
            if (root.comment_id === commentId) {
              return { ...root, is_upvoted: res.upvoted, upvotes_count: res.upvotesCount };
            }
            if (root.replies && root.replies.length > 0) {
              return {
                ...root,
                replies: root.replies.map((rep) =>
                  rep.comment_id === commentId
                    ? { ...rep, is_upvoted: res.upvoted, upvotes_count: res.upvotesCount }
                    : rep
                )
              };
            }
            return root;
          })
        );
      }
    } catch (err) {
      console.error('Lỗi toggle upvote:', err);
      // Rollback lại state nếu lỗi
      fetchComments(false);
    }
  };

  // Ghim hoặc bỏ ghim bình luận
  const handleTogglePin = async (commentId) => {
    try {
      const res = await togglePinComment(commentId);
      showToast(res.isPinned ? 'Đã ghim bình luận lên đầu bài học' : 'Đã bỏ ghim bình luận', 'success');
      await fetchComments(false);
    } catch (err) {
      console.error('Lỗi ghim bình luận:', err);
      showToast(err.response?.data?.message || 'Không thể thay đổi trạng thái ghim', 'error');
    }
  };

  // Bắt đầu chỉnh sửa bình luận
  const handleStartEdit = (comment) => {
    setEditingCommentId(comment.comment_id);
    setEditText(comment.content);
  };

  // Lưu nội dung chỉnh sửa
  const handleSaveEdit = async (commentId) => {
    if (!editText.trim()) return;
    try {
      await updateComment(commentId, editText.trim());
      setEditingCommentId(null);
      setEditText('');
      showToast('Đã cập nhật bình luận!', 'success');
      await fetchComments(false);
    } catch (err) {
      console.error('Lỗi cập nhật bình luận:', err);
      showToast('Không thể cập nhật bình luận lúc này', 'error');
    }
  };

  // Xóa bình luận
  const handleDeleteComment = async (commentId) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa bình luận này?')) return;
    try {
      await deleteComment(commentId);
      showToast('Đã xóa bình luận thành công', 'info');
      await fetchComments(false);
    } catch (err) {
      console.error('Lỗi xóa bình luận:', err);
      showToast('Không thể xóa bình luận lúc này', 'error');
    }
  };

  // Render huy hiệu vai trò người dùng
  const renderRoleBadge = (roleId, roleName) => {
    const rId = parseInt(roleId, 10);
    if (rId === 1 || roleName === 'Admin') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-purple-500/15 text-purple-400 border border-purple-500/30">
          👑 Quản trị viên
        </span>
      );
    }
    if (rId === 2 || roleName === 'Instructor' || roleName === 'Giảng viên') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30">
          🎓 Giảng viên
        </span>
      );
    }
    return null;
  };

  // Component render từng comment item (dùng chung cho root và reply)
  const renderCommentCard = (comment, isReply = false) => {
    const isEditing = editingCommentId === comment.comment_id;
    const isAuthor = currentUserId && String(currentUserId) === String(comment.user_id);
    const canDelete = isAuthor || userRoleId === 1;

    return (
      <div
        key={comment.comment_id}
        className={`group p-4 rounded-xl border transition-all duration-200 ${
          comment.is_pinned
            ? 'bg-amber-500/5 border-amber-500/30 dark:bg-amber-950/10 shadow-sm'
            : 'hover:border-slate-700/60'
        }`}
        style={{
          backgroundColor: comment.is_pinned ? undefined : 'var(--card-bg)',
          borderColor: comment.is_pinned ? undefined : 'var(--border-color)'
        }}
      >
        {/* Header thông tin tác giả */}
        <div className="flex items-start justify-between gap-3 mb-2.5">
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Avatar */}
            {comment.user_avatar ? (
              <img
                src={comment.user_avatar}
                alt={comment.user_full_name}
                className="w-8 h-8 rounded-full object-cover ring-1 ring-slate-700 shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm">
                {(comment.user_full_name || 'U').charAt(0).toUpperCase()}
              </div>
            )}

            {/* Tên & Badge */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm leading-none" style={{ color: 'var(--text-color)' }}>
                {comment.user_full_name}
              </span>
              {renderRoleBadge(comment.user_role_id, comment.user_role)}
              {comment.is_pinned && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                  <FiBookmark className="text-xs" />
                  <span>Đã ghim</span>
                </span>
              )}
            </div>

            {/* Thời gian */}
            <div className="flex items-center text-xs opacity-50 gap-1 ml-auto sm:ml-0" title={comment.created_at}>
              <FiClock className="text-[10px]" />
              <span>{formatRelativeTime(comment.created_at)}</span>
            </div>
          </div>

          {/* Nút hành động tác giả/quản lý */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {isInstructorOrAdmin && !isReply && (
              <button
                type="button"
                onClick={() => handleTogglePin(comment.comment_id)}
                title={comment.is_pinned ? 'Bỏ ghim bình luận' : 'Ghim bình luận này lên đầu'}
                className={`p-1.5 rounded-lg text-xs transition-colors ${
                  comment.is_pinned
                    ? 'text-amber-400 bg-amber-500/10 hover:bg-amber-500/20'
                    : 'text-slate-400 hover:text-amber-400 hover:bg-slate-800'
                }`}
              >
                <FiBookmark />
              </button>
            )}

            {isAuthor && !isEditing && (
              <button
                type="button"
                onClick={() => handleStartEdit(comment)}
                title="Chỉnh sửa bình luận"
                className="p-1.5 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-slate-800 text-xs transition-colors"
              >
                <FiEdit2 />
              </button>
            )}

            {canDelete && !isEditing && (
              <button
                type="button"
                onClick={() => handleDeleteComment(comment.comment_id)}
                title="Xóa bình luận"
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 text-xs transition-colors"
              >
                <FiTrash2 />
              </button>
            )}
          </div>
        </div>

        {/* Nội dung bình luận */}
        {isEditing ? (
          <div className="space-y-2 mt-2">
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              rows={3}
              className="w-full p-2.5 text-sm rounded-lg border focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
              style={{
                backgroundColor: 'var(--bg-color)',
                borderColor: 'var(--border-color)',
                color: 'var(--text-color)'
              }}
            />
            <div className="flex items-center gap-2 justify-end">
              <button
                type="button"
                onClick={() => setEditingCommentId(null)}
                className="px-3 py-1 text-xs font-semibold rounded-lg border hover:bg-slate-800 transition-colors"
                style={{ borderColor: 'var(--border-color)', color: 'var(--text-light)' }}
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => handleSaveEdit(comment.comment_id)}
                className="px-3 py-1 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors flex items-center gap-1 shadow-sm"
              >
                <FiCheck />
                <span>Lưu thay đổi</span>
              </button>
            </div>
          </div>
        ) : (
          <div
            className="text-sm leading-relaxed whitespace-pre-wrap break-words"
            style={{ color: 'var(--text-color)' }}
          >
            {comment.reply_to_user_name && isReply && (
              <span className="text-blue-500 font-semibold mr-1.5 select-none">
                @{comment.reply_to_user_name}
              </span>
            )}
            {comment.content}
          </div>
        )}

        {/* Action bar: Upvote & Reply */}
        <div className="flex items-center gap-3 mt-3 pt-2 border-t text-xs" style={{ borderTopColor: 'var(--border-color)' }}>
          {/* Nút Upvote */}
          <button
            type="button"
            onClick={() => handleToggleUpvote(comment.comment_id)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-semibold transition-all duration-200 active:scale-95 ${
              comment.is_upvoted
                ? 'bg-rose-500/15 text-rose-500 font-bold border border-rose-500/30'
                : 'text-slate-400 hover:text-rose-500 hover:bg-rose-500/10'
            }`}
          >
            <FiHeart className={`text-sm ${comment.is_upvoted ? 'fill-rose-500 text-rose-500' : ''}`} />
            <span>{comment.upvotes_count > 0 ? comment.upvotes_count : 'Thích'}</span>
          </button>

          {/* Nút Trả lời (chỉ khả dụng nếu chưa mở reply box) */}
          {!isReply && (
            <button
              type="button"
              onClick={() => {
                if (replyingToId === comment.comment_id) {
                  setReplyingToId(null);
                  setReplyText('');
                } else {
                  setReplyingToId(comment.comment_id);
                  setReplyText('');
                }
              }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 font-semibold transition-colors"
            >
              <FiCornerDownRight className="text-sm" />
              <span>Trả lời</span>
            </button>
          )}
        </div>

        {/* Khung nhập phản hồi (Reply Box) */}
        {replyingToId === comment.comment_id && (
          <div className="mt-3 pt-3 border-t pl-2 sm:pl-4 space-y-2 animate-fade" style={{ borderTopColor: 'var(--border-color)' }}>
            <div className="flex items-start gap-2.5">
              <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-1">
                {(user?.full_name || 'U').charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 space-y-2">
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder={`Phản hồi cho ${comment.user_full_name}...`}
                  rows={2}
                  className="w-full p-2.5 text-xs rounded-xl border focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                  style={{
                    backgroundColor: 'var(--bg-color)',
                    borderColor: 'var(--border-color)',
                    color: 'var(--text-color)'
                  }}
                  autoFocus
                />
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setReplyingToId(null);
                      setReplyText('');
                    }}
                    className="px-3 py-1 text-xs font-semibold rounded-lg border hover:bg-slate-800 transition-colors"
                    style={{ borderColor: 'var(--border-color)', color: 'var(--text-light)' }}
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    disabled={submitting || !replyText.trim()}
                    onClick={() => handlePostReply(comment.comment_id)}
                    className="px-3.5 py-1 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white transition-colors flex items-center gap-1.5 shadow-sm"
                  >
                    {submitting ? <FiLoader className="animate-spin text-xs" /> : <FiSend className="text-xs" />}
                    <span>Gửi trả lời</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Danh sách các câu trả lời con (Replies) */}
        {comment.replies && comment.replies.length > 0 && (
          <div className="mt-3 pl-3 sm:pl-5 border-l-2 space-y-2.5" style={{ borderLeftColor: 'var(--border-color)' }}>
            {comment.replies.map((reply) => renderCommentCard(reply, true))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fade">
      {/* Khung tạo bình luận mới */}
      <form onSubmit={handlePostRootComment} className="p-4 rounded-2xl border shadow-sm transition-all" style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)' }}>
        <div className="flex items-start gap-3">
          {/* Avatar hiện tại */}
          {user?.profile_picture_url || user?.avatar ? (
            <img
              src={user.profile_picture_url || user.avatar}
              alt={user.full_name}
              className="w-9 h-9 rounded-full object-cover ring-2 ring-blue-500/30 shrink-0 mt-0.5"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5 shadow-sm">
              {(user?.full_name || 'U').charAt(0).toUpperCase()}
            </div>
          )}

          {/* Ô nhập nội dung */}
          <div className="flex-1 space-y-2.5">
            <textarea
              value={newCommentText}
              onChange={(e) => setNewCommentText(e.target.value)}
              placeholder="Đặt câu hỏi, chia sẻ suy nghĩ hoặc thảo luận về bài học này..."
              rows={3}
              className="w-full p-3 text-sm rounded-xl border focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all placeholder:text-slate-400 leading-relaxed"
              style={{
                backgroundColor: 'var(--bg-color)',
                borderColor: 'var(--border-color)',
                color: 'var(--text-color)'
              }}
            />
            <div className="flex items-center justify-end gap-2 flex-wrap">
              <button
                type="submit"
                disabled={submitting || !newCommentText.trim()}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-md hover:shadow-blue-500/20 disabled:opacity-50 transition-all cursor-pointer"
              >
                {submitting ? (
                  <>
                    <FiLoader className="animate-spin text-sm" />
                    <span>Đang gửi...</span>
                  </>
                ) : (
                  <>
                    <FiSend className="text-sm" />
                    <span>Gửi bình luận</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* Trạng thái tải và lỗi */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-10 gap-3 text-slate-400">
          <FiLoader className="animate-spin text-2xl text-blue-500" />
          <span className="text-xs font-semibold">Đang tải cuộc thảo luận bài học...</span>
        </div>
      )}

      {error && !loading && (
        <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-400 text-xs flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={() => fetchComments(true)}
            className="flex items-center gap-1 underline hover:opacity-80 font-bold"
          >
            <FiRefreshCw />
            <span>Thử lại</span>
          </button>
        </div>
      )}

      {/* Danh sách bình luận */}
      {!loading && !error && (
        <div className="space-y-4">
          {comments.length > 0 ? (
            comments.map((comment) => renderCommentCard(comment, false))
          ) : (
            <div className="text-center py-12 px-4 rounded-2xl border border-dashed text-slate-400" style={{ borderColor: 'var(--border-color)' }}>
              <div className="w-12 h-12 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center mx-auto mb-3">
                <FiMessageSquare className="text-2xl" />
              </div>
              <h4 className="font-semibold text-sm mb-1" style={{ color: 'var(--text-color)' }}>
                Chưa có bình luận nào
              </h4>
              <p className="text-xs max-w-sm mx-auto opacity-70 leading-relaxed">
                Hãy là người đầu tiên đặt câu hỏi hoặc chia sẻ góc nhìn của bạn về bài học này cùng cộng đồng!
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
