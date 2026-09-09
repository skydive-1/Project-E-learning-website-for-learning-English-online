import React, { useEffect, useState } from 'react';
import { 
  FiMessageSquare, FiBell, FiSearch, FiCheck, 
  FiClock, FiUser, FiSend, FiArrowLeft, FiPlus, 
  FiX, FiEye, FiCheckCircle, FiBookOpen, FiFilter 
} from 'react-icons/fi';
import { useToast } from '../../../context/ToastContext';
import { useAuth } from '../../../context/AuthContext';
import {
  createCourseAnnouncement,
  discussionApiErrorMessage,
  getInstructorAnnouncements,
  getInstructorDiscussions,
  markDiscussionRead,
  replyToDiscussion,
  updateDiscussionStatus
} from '../services/discussions.service';

/**
 * InstructorInteractionHub Component
 * - Trang quản lý Tương tác dành cho Giảng viên trong InstructorDashboard
 * - Hai chế độ: "Câu hỏi" (Master-Detail Q&A) và "Thông báo" (Course Announcements)
 * - Thiết kế đồng bộ hoàn hảo với hệ thống bảng điều khiển và AI Chat:
 *   + Nền trắng/slate, border slate mảnh, bo góc rounded-xl/2xl
 *   + Mobile: Chuyển đổi luồng 2 màn hình linh hoạt có nút quay lại
 *   + Dữ liệu được nạp và cập nhật qua Discussions API
 */
const InstructorInteractionHub = ({ courses = [], onPendingCountChange = null }) => {
  const showToast = useToast();
  const { user } = useAuth();

  // Chế độ chính: 'questions' (Câu hỏi) hoặc 'announcements' (Thông báo)
  const [activeMode, setActiveMode] = useState('questions');

  const [discussions, setDiscussions] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  // State chọn hội thoại & bộ lọc ở chế độ Câu hỏi
  const [selectedDiscussionId, setSelectedDiscussionId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCourse, setFilterCourse] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all'); // 'all' | 'pending' | 'answered' | 'resolved'
  const [replyText, setReplyText] = useState('');

  // State cho chế độ Thông báo (Modal tạo mới & Preview)
  const [isCreatingAnn, setIsCreatingAnn] = useState(false);
  const [annCourseId, setAnnCourseId] = useState(
    courses[0]?.course_id ? String(courses[0].course_id) : ''
  );
  const [annTitle, setAnnTitle] = useState('');
  const [annContent, setAnnContent] = useState('');

  useEffect(() => {
    let isCurrent = true;
    setIsLoading(true);
    setLoadError('');
    Promise.all([getInstructorDiscussions(), getInstructorAnnouncements()])
      .then(([threadData, announcementData]) => {
        if (!isCurrent) return;
        setDiscussions(threadData);
        setAnnouncements(announcementData);
        setSelectedDiscussionId(current => current || threadData[0]?.id || null);
      })
      .catch(error => {
        if (isCurrent) setLoadError(discussionApiErrorMessage(error, 'Không thể tải dữ liệu tương tác.'));
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });
    return () => { isCurrent = false; };
  }, [reloadToken]);

  // Cập nhật hộp thư nền để giảng viên nhận câu hỏi mới mà không cần tải lại trang.
  useEffect(() => {
    const refreshSilently = () => {
      if (document.visibilityState !== 'visible') return;
      getInstructorDiscussions()
        .then(threadData => {
          setDiscussions(threadData);
          setSelectedDiscussionId(current => (
            current && threadData.some(item => String(item.id) === String(current))
              ? current
              : threadData[0]?.id || null
          ));
          setLoadError('');
        })
        .catch(() => {});
    };

    const timerId = window.setInterval(refreshSilently, 10000);
    return () => window.clearInterval(timerId);
  }, []);

  useEffect(() => {
    if (!annCourseId && courses[0]?.course_id) {
      setAnnCourseId(String(courses[0].course_id));
    }
  }, [annCourseId, courses]);

  // Hội thoại đang chọn
  const activeDiscussion = discussions.find((d) => String(d.id) === String(selectedDiscussionId));

  // Bộ lọc danh sách câu hỏi
  const filteredDiscussions = discussions.filter((d) => {
    if (filterCourse !== 'all' && String(d.courseId) !== String(filterCourse)) {
      return false;
    }
    if (filterStatus !== 'all' && d.status !== filterStatus) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = d.title?.toLowerCase().includes(q);
      const matchContent = d.content?.toLowerCase().includes(q);
      const matchStudent = d.student?.name?.toLowerCase().includes(q);
      if (!matchTitle && !matchContent && !matchStudent) return false;
    }
    return true;
  });

  // Đếm số câu hỏi chờ trả lời
  const pendingCount = discussions.filter((d) => d.status === 'pending').length;

  useEffect(() => {
    onPendingCountChange?.(pendingCount);
  }, [onPendingCountChange, pendingCount]);

  useEffect(() => {
    if (!activeDiscussion?.unread) return;
    markDiscussionRead(activeDiscussion.id)
      .then(() => setDiscussions(prev => prev.map(item => (
        String(item.id) === String(activeDiscussion.id) ? { ...item, unread: false } : item
      ))))
      .catch(() => {});
  }, [activeDiscussion?.id, activeDiscussion?.unread]);

  // Xử lý gửi phản hồi từ Giảng viên
  const handleInstructorReply = async (e) => {
    e?.preventDefault();
    if (!replyText.trim() || !activeDiscussion || isSaving) return;
    setIsSaving(true);
    try {
      const updated = await replyToDiscussion(activeDiscussion.id, replyText.trim());
      setDiscussions(prev => prev.map(item => String(item.id) === String(updated.id) ? updated : item));
      setReplyText('');
      showToast('Đã gửi phản hồi cho học viên.', 'success');
    } catch (error) {
      showToast(discussionApiErrorMessage(error, 'Không thể gửi phản hồi lúc này.'), 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Đánh dấu đã giải đáp / Mở lại cuộc trao đổi
  const handleToggleResolved = async () => {
    if (!activeDiscussion || isSaving) return;
    const isCurrentlyResolved = activeDiscussion.status === 'resolved';
    const newStatus = isCurrentlyResolved ? 'answered' : 'resolved';
    setIsSaving(true);
    try {
      const updated = await updateDiscussionStatus(activeDiscussion.id, newStatus);
      setDiscussions(prev => prev.map(item => String(item.id) === String(updated.id) ? updated : item));
      showToast(isCurrentlyResolved ? 'Đã mở lại cuộc trao đổi.' : 'Đã đánh dấu câu hỏi đã giải đáp.', 'info');
    } catch (error) {
      showToast(discussionApiErrorMessage(error, 'Không thể cập nhật trạng thái.'), 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Xử lý tạo thông báo mới
  const handleCreateAnnouncement = async (e) => {
    e.preventDefault();
    if (!annTitle.trim() || !annContent.trim()) {
      showToast('Vui lòng điền đầy đủ tiêu đề và nội dung thông báo.', 'warning');
      return;
    }

    if (isSaving) return;
    setIsSaving(true);
    try {
      const newAnnouncement = await createCourseAnnouncement({
        courseId: annCourseId,
        title: annTitle.trim(),
        content: annContent.trim()
      });
      setAnnouncements(prev => [newAnnouncement, ...prev]);
      setIsCreatingAnn(false);
      setAnnTitle('');
      setAnnContent('');
      showToast('Đã phát hành thông báo đến học viên.', 'success');
    } catch (error) {
      showToast(discussionApiErrorMessage(error, 'Không thể phát hành thông báo.'), 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Helper render status badge
  const renderStatusBadge = (status) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200/70 dark:border-amber-800/50">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5"></span>
            Chờ phản hồi
          </span>
        );
      case 'answered':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 dark:bg-blue-950/40 text-smart-indigo dark:text-blue-400 border border-blue-200/70 dark:border-blue-800/50">
            <span className="w-1.5 h-1.5 rounded-full bg-smart-indigo mr-1.5"></span>
            Đã trả lời
          </span>
        );
      case 'resolved':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/70 dark:border-emerald-800/50">
            <FiCheck className="mr-1 text-[11px]" />
            Đã giải đáp
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Khu Vực Tương Tác */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight">
            Tương tác với học viên
          </h1>
          <p className="text-xs sm:text-[13.5px] text-slate-500 dark:text-slate-400 mt-1">
            Tiếp nhận, phản hồi các thắc mắc từ học viên và gửi thông báo quan trọng theo từng khóa học.
          </p>
        </div>

        {/* Chuyển đổi Sub-tabs: Câu hỏi vs Thông báo */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200/80 dark:border-slate-700/80 shrink-0 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveMode('questions')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeMode === 'questions'
                ? 'bg-white dark:bg-slate-700 text-smart-indigo dark:text-blue-400 shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <FiMessageSquare className="text-xs" />
            <span>Câu hỏi</span>
            {pendingCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[9.5px] bg-amber-500 text-white font-black">
                {pendingCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveMode('announcements')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeMode === 'announcements'
                ? 'bg-white dark:bg-slate-700 text-smart-indigo dark:text-blue-400 shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <FiBell className="text-xs" />
            <span>Thông báo</span>
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-center text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
          Đang tải câu hỏi và thông báo...
        </div>
      )}

      {loadError && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300" role="alert">
          <span>{loadError}</span>
          <button type="button" onClick={() => setReloadToken(value => value + 1)} className="shrink-0 rounded-lg bg-white px-3 py-1.5 font-bold text-amber-700 dark:bg-slate-800 dark:text-amber-300">
            Thử lại
          </button>
        </div>
      )}

      {/* =================================================================== */}
      {/* 2. CHẾ ĐỘ A: QUẢN LÝ CÂU HỎI (MASTER - DETAIL) */}
      {/* =================================================================== */}
      {activeMode === 'questions' && (
        <div className="space-y-4">
          {/* Thanh lọc & tìm kiếm */}
          <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 gap-3 bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80 shadow-2xs">
            {/* Ô tìm kiếm */}
            <div className="relative sm:col-span-1 md:col-span-2">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm theo tên học viên, tiêu đề..."
                className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-smart-indigo"
              />
            </div>

            {/* Lọc Khóa học */}
            <select
              value={filterCourse}
              onChange={(e) => setFilterCourse(e.target.value)}
              className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none focus:border-smart-indigo"
            >
              <option value="all">Tất cả khóa học</option>
              {courses.map((c) => (
                <option key={c.course_id} value={String(c.course_id)}>
                  {c.course_name}
                </option>
              ))}
            </select>

            {/* Lọc Trạng thái */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none focus:border-smart-indigo"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="pending">Chờ phản hồi ({pendingCount})</option>
              <option value="answered">Giảng viên đã trả lời</option>
              <option value="resolved">Đã giải đáp</option>
            </select>
          </div>

          {/* Khung Master-Detail: 2 Cột Desktop / 2 Màn hình Mobile */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[640px] rounded-2xl overflow-hidden border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-800 shadow-sm">
            {/* CỘT TRÁI: DANH SÁCH HỘI THOẠI (lg: 5 cols) */}
            <div
              className={`lg:col-span-5 border-r border-slate-200/80 dark:border-slate-700/80 flex flex-col h-full overflow-hidden ${
                selectedDiscussionId ? 'hidden lg:flex' : 'flex'
              }`}
            >
              <div className="p-3 border-b border-slate-200/80 dark:border-slate-700/80 bg-slate-50/60 dark:bg-slate-900/40 flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-300">
                <span>Danh sách câu hỏi ({filteredDiscussions.length})</span>
                <span className="text-[11px] text-slate-400 font-normal">
                  Cập nhật theo phiên
                </span>
              </div>

              <div className="flex-1 overflow-y-auto p-2.5 space-y-2 bg-slate-50/30 dark:bg-slate-900/30">
                {filteredDiscussions.map((item) => {
                  const isSelected = String(item.id) === String(selectedDiscussionId);

                  return (
                    <div
                      key={item.id}
                      onClick={() => setSelectedDiscussionId(item.id)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer relative shadow-2xs ${
                        isSelected
                          ? 'bg-blue-50/70 dark:bg-blue-950/40 border-smart-indigo dark:border-blue-500 shadow-xs'
                          : 'bg-white dark:bg-slate-800 border-slate-200/80 dark:border-slate-700/80 hover:border-slate-300 dark:hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-smart-indigo dark:text-blue-300 flex items-center justify-center text-[10px] font-bold shrink-0">
                            {item.student?.name?.[0] || 'S'}
                          </div>
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                            {item.student?.name}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 shrink-0">
                          {item.createdAt}
                        </span>
                      </div>

                      <h4 className="font-bold text-xs text-slate-900 dark:text-slate-100 line-clamp-1 mt-1.5">
                        {item.title}
                      </h4>

                      <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5 leading-relaxed">
                        {item.content}
                      </p>

                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 dark:border-slate-700/50 text-[10px]">
                        <span className="text-slate-500 dark:text-slate-400 truncate max-w-[140px]">
                          {item.lessonTitle}
                        </span>
                        {renderStatusBadge(item.status)}
                      </div>
                    </div>
                  );
                })}

                {/* Empty state khi không có câu hỏi */}
                {filteredDiscussions.length === 0 && (
                  <div className="py-12 px-4 text-center space-y-2">
                    <FiSearch className="text-2xl text-slate-300 dark:text-slate-600 mx-auto" />
                    <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                      Không tìm thấy câu hỏi nào
                    </p>
                    <p className="text-[11px] text-slate-400 max-w-[200px] mx-auto">
                      Hãy thử thay đổi từ khóa hoặc bộ lọc trạng thái.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* CỘT PHẢI: NỘI DUNG HỘI THOẠI ĐANG CHỌN (lg: 7 cols) */}
            <div
              className={`lg:col-span-7 flex flex-col h-full overflow-hidden ${
                !selectedDiscussionId ? 'hidden lg:flex' : 'flex'
              }`}
            >
              {activeDiscussion ? (
                <div className="flex flex-col h-full">
                  {/* Header hội thoại */}
                  <div className="px-4 py-3 border-b border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-800 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2 min-w-0">
                      {/* Nút quay lại trên Mobile */}
                      <button
                        type="button"
                        onClick={() => setSelectedDiscussionId(null)}
                        className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
                        title="Quay lại danh sách"
                      >
                        <FiArrowLeft className="text-base" />
                      </button>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-100 truncate">
                            {activeDiscussion.student?.name}
                          </h3>
                          {renderStatusBadge(activeDiscussion.status)}
                        </div>
                        <p className="text-[11px] text-slate-400 dark:text-slate-400 truncate">
                          Khóa học: {activeDiscussion.courseName} • {activeDiscussion.lessonTitle}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleToggleResolved}
                      disabled={isSaving}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                        activeDiscussion.status === 'resolved'
                          ? 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600'
                          : 'bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700'
                      }`}
                    >
                      {activeDiscussion.status === 'resolved' ? 'Mở lại' : '✓ Đã giải đáp'}
                    </button>
                  </div>

                  {/* Luồng tin nhắn */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/40 dark:bg-slate-900/40">
                    {/* Thắc mắc gốc của học viên */}
                    <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/90 dark:border-slate-700/80 shadow-2xs space-y-2">
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span className="font-bold text-slate-700 dark:text-slate-200">
                          {activeDiscussion.student?.name}
                        </span>
                        <span>{activeDiscussion.createdAt}</span>
                      </div>
                      <h4 className="font-bold text-xs sm:text-[13.5px] text-slate-900 dark:text-slate-100">
                        {activeDiscussion.title}
                      </h4>
                      <p className="text-xs sm:text-[13px] text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                        {activeDiscussion.content}
                      </p>

                      {activeDiscussion.aiResponse && (
                        <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-2.5 text-[11px] text-slate-600 dark:border-indigo-900/50 dark:bg-indigo-950/30 dark:text-slate-300">
                          <p className="mb-1 font-bold text-smart-indigo dark:text-blue-400">Phản hồi AI học viên đã chọn đính kèm</p>
                          <p className="whitespace-pre-wrap">{activeDiscussion.aiResponse}</p>
                        </div>
                      )}

                      {activeDiscussion.timestampFormatted && (
                        <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 text-xs flex items-center gap-1.5 text-smart-indigo dark:text-blue-400">
                          <FiClock className="text-xs" />
                          <span>Học viên gắn mốc bài giảng: {activeDiscussion.timestampFormatted}</span>
                        </div>
                      )}
                    </div>

                    {/* Danh sách phản hồi */}
                    {activeDiscussion.replies?.map((rep) => {
                      const isInst = rep.isInstructor;

                      return (
                        <div
                          key={rep.id}
                          className={`flex flex-col space-y-1 ${isInst ? 'items-end' : 'items-start'}`}
                        >
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 px-1">
                            <span className="font-semibold text-slate-600 dark:text-slate-300">
                              {isInst ? 'Bạn (Giảng viên)' : rep.author?.name}
                            </span>
                            <span>•</span>
                            <span>{rep.createdAt}</span>
                          </div>

                          <div
                            className={`max-w-[90%] px-4 py-3 rounded-2xl text-xs sm:text-[13px] leading-relaxed whitespace-pre-wrap ${
                              isInst
                                ? 'bg-smart-indigo text-white rounded-tr-xs shadow-sm shadow-indigo-600/10'
                                : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200/90 dark:border-slate-700/80 rounded-tl-xs shadow-2xs'
                            }`}
                          >
                            {rep.content}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Composer trả lời cho Giảng viên */}
                  <div className="p-3 bg-white dark:bg-slate-800 border-t border-slate-200/80 dark:border-slate-700/80 shrink-0">
                    <form onSubmit={handleInstructorReply} className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <input
                          type="text"
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder="Nhập câu trả lời cho học viên..."
                          className="w-full pl-3.5 pr-4 py-2.5 text-xs sm:text-[13px] bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-smart-indigo"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={!replyText.trim() || isSaving}
                        className="px-4 py-2.5 bg-smart-indigo hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-sm transition-all cursor-pointer shrink-0"
                      >
                        Gửi trả lời
                      </button>
                    </form>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
                  <FiMessageSquare className="text-3xl mb-2 text-slate-300 dark:text-slate-600" />
                  <p className="text-xs font-semibold">Chọn một cuộc hội thoại ở danh sách bên trái để xem chi tiết</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* 3. CHẾ ĐỘ B: QUẢN LÝ THÔNG BÁO (COURSE ANNOUNCEMENTS) */}
      {/* =================================================================== */}
      {activeMode === 'announcements' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200">
              Thông báo đã phát hành ({announcements.length})
            </h2>

            <button
              type="button"
              onClick={() => setIsCreatingAnn(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-smart-indigo hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm transition-colors cursor-pointer"
            >
              <FiPlus className="text-xs" />
              <span>Tạo thông báo mới</span>
            </button>
          </div>

          {/* Danh sách thông báo */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {announcements.map((ann) => (
              <div
                key={ann.id}
                className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-700/80 shadow-2xs space-y-2 hover:border-slate-300 transition-all"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 dark:bg-blue-950/60 text-smart-indigo dark:text-blue-400 border border-blue-200/60 dark:border-blue-900/40">
                    {ann.courseName}
                  </span>
                  <span className="text-[10.5px] text-slate-400">{ann.createdAt}</span>
                </div>

                <h3 className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-100">
                  {ann.title}
                </h3>

                <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-3 leading-relaxed">
                  {ann.content}
                </p>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-700/50 flex items-center justify-between text-[11px] text-slate-400">
                  <span>Người đăng: {ann.instructorName}</span>
                  <span>{ann.viewsCount} lượt tiếp cận</span>
                </div>
              </div>
            ))}
          </div>

          {/* Modal / Form Tạo thông báo kèm Live Preview */}
          {isCreatingAnn && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in">
              <div className="w-full max-w-2xl bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200/80 dark:border-slate-700/80 overflow-hidden">
                {/* Header modal */}
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200/80 dark:border-slate-700/80 bg-slate-50/60 dark:bg-slate-900/40">
                  <div className="flex items-center gap-2">
                    <FiBell className="text-smart-indigo text-base" />
                    <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">
                      Tạo thông báo khóa học mới
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsCreatingAnn(false)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
                  >
                    <FiX className="text-base" />
                  </button>
                </div>

                {/* Form & Live Preview 2 Cột */}
                <form onSubmit={handleCreateAnnouncement} className="p-5 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Cột 1: Nhập liệu */}
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                          Chọn khóa học nhận thông báo:
                        </label>
                        <select
                          value={annCourseId}
                          onChange={(e) => setAnnCourseId(e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none focus:border-smart-indigo"
                        >
                          {courses.map((c) => (
                            <option key={c.course_id} value={String(c.course_id)}>
                              {c.course_name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                          Tiêu đề thông báo:
                        </label>
                        <input
                          type="text"
                          value={annTitle}
                          onChange={(e) => setAnnTitle(e.target.value)}
                          placeholder="VD: Cập nhật tài liệu luyện đề tháng này..."
                          className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none focus:border-smart-indigo"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                          Nội dung chi tiết:
                        </label>
                        <textarea
                          rows={4}
                          value={annContent}
                          onChange={(e) => setAnnContent(e.target.value)}
                          placeholder="Nhập nội dung nhắc nhở hoặc hướng dẫn cho học viên..."
                          className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none focus:border-smart-indigo resize-none"
                          required
                        />
                      </div>
                    </div>

                    {/* Cột 2: Xem trước trực tiếp (Live Preview) */}
                    <div className="space-y-1.5">
                      <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
                        <FiEye /> Xem trước hiển thị phía học viên:
                      </span>
                      <div className="rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/60 dark:bg-blue-950/30 p-3 space-y-1.5 shadow-2xs">
                        <div className="flex items-center gap-1 text-[10px] font-bold text-smart-indigo dark:text-blue-300 uppercase">
                          <FiBell />
                          <span>Thông báo khóa học</span>
                        </div>
                        <div className="flex items-center justify-between text-[10.5px] text-slate-500">
                          <span className="font-semibold text-slate-700 dark:text-slate-200">
                            {user?.fullName || user?.name || 'Giảng viên phụ trách'}
                          </span>
                          <span>Vừa xong</span>
                        </div>
                        <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100 leading-snug">
                          {annTitle || 'Tiêu đề thông báo mẫu'}
                        </h4>
                        <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                          {annContent || 'Nội dung thông báo sẽ xuất hiện trực quan như thế này trên thanh hỗ trợ học viên.'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Nút hành động */}
                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-700/60">
                    <button
                      type="button"
                      onClick={() => setIsCreatingAnn(false)}
                      className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      disabled={!annTitle.trim() || !annContent.trim() || !annCourseId || isSaving}
                      className="px-4 py-2 bg-smart-indigo hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-sm transition-colors"
                    >
                      Phát hành thông báo
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default InstructorInteractionHub;
