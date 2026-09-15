import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FiBell, FiX, FiSearch, FiCheckCircle, 
  FiBookOpen, FiClock, FiUser, FiExternalLink, 
  FiCheck, FiFilter, FiInbox
} from 'react-icons/fi';
import { 
  getUserAnnouncements, 
  markAnnouncementRead,
  discussionApiErrorMessage 
} from '../../discussions/services/discussions.service';
import { useToast } from '../../../context/ToastContext';

const CourseAnnouncementsModal = ({ isOpen, onClose, onUnreadCountChange }) => {
  const navigate = useNavigate();
  const showToast = useToast();

  const [announcements, setAnnouncements] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCourseFilter, setSelectedCourseFilter] = useState('all');
  const [filterTab, setFilterTab] = useState('all'); // 'all' | 'unread'

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setIsLoading(true);
    setError('');

    getUserAnnouncements()
      .then((data) => {
        if (!isMounted) return;
        setAnnouncements(data || []);
        const unread = (data || []).filter(a => !a.isRead).length;
        onUnreadCountChange?.(unread);
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(discussionApiErrorMessage(err, 'Không thể tải danh sách thông báo.'));
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => { isMounted = false; };
  }, [isOpen, onUnreadCountChange]);

  // Danh sách các khóa học độc nhất để lọc
  const uniqueCourses = useMemo(() => {
    const map = new Map();
    announcements.forEach((ann) => {
      if (ann.courseId && ann.courseName && !map.has(String(ann.courseId))) {
        map.set(String(ann.courseId), ann.courseName);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [announcements]);

  // Lọc thông báo theo search query, course filter, và tab chưa đọc
  const filteredAnnouncements = useMemo(() => {
    return announcements.filter((ann) => {
      if (filterTab === 'unread' && ann.isRead) return false;
      if (selectedCourseFilter !== 'all' && String(ann.courseId) !== String(selectedCourseFilter)) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const titleMatch = ann.title?.toLowerCase().includes(query);
        const contentMatch = ann.content?.toLowerCase().includes(query);
        const courseMatch = ann.courseName?.toLowerCase().includes(query);
        const instructorMatch = ann.instructorName?.toLowerCase().includes(query);
        if (!titleMatch && !contentMatch && !courseMatch && !instructorMatch) return false;
      }
      return true;
    });
  }, [announcements, filterTab, selectedCourseFilter, searchQuery]);

  const unreadCount = useMemo(() => {
    return announcements.filter(a => !a.isRead).length;
  }, [announcements]);

  // Đánh dấu một thông báo là đã đọc
  const handleMarkAsRead = async (annId) => {
    try {
      await markAnnouncementRead(annId);
      setAnnouncements((prev) =>
        prev.map((item) => (item.id === annId ? { ...item, isRead: true } : item))
      );
      const nextUnread = Math.max(0, unreadCount - 1);
      onUnreadCountChange?.(nextUnread);
    } catch (err) {
      // Bỏ qua lỗi êm đẹp
    }
  };

  // Điều hướng tới khóa học và đánh dấu đã đọc
  const handleNavigateToCourse = (ann) => {
    if (!ann.isRead) {
      handleMarkAsRead(ann.id);
    }
    onClose();
    if (ann.courseName) {
      // Navigate đến /courses và pre-fill search bằng tên khóa học
      navigate(`/courses?search=${encodeURIComponent(ann.courseName)}`);
    } else if (ann.courseId) {
      navigate(`/courses`);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="vocab-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div 
        className="vocab-modal-card max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header modal */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-smart-indigo dark:text-blue-400 flex items-center justify-center text-lg border border-indigo-100 dark:border-indigo-900/50 shrink-0 shadow-2xs">
              <FiBell />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-100">
                  Thông báo từ Giảng viên & Khóa học
                </h2>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 text-[10px] font-extrabold rounded-full bg-rose-500 text-white animate-pulse">
                    {unreadCount} mới
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Cập nhật quan trọng, thông báo lịch học và tài liệu mới từ giảng viên
              </p>
            </div>
          </div>
          <button 
            type="button" 
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer" 
            onClick={onClose}
            title="Đóng"
          >
            <FiX className="text-lg" />
          </button>
        </div>

        {/* Thanh tìm kiếm & bộ lọc */}
        <div className="p-3.5 bg-slate-50/70 dark:bg-slate-900/60 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center gap-2.5 shrink-0">
          {/* Ô tìm kiếm */}
          <div className="relative w-full sm:flex-1">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm theo tiêu đề, nội dung, giảng viên..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-smart-indigo"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Lọc khóa học */}
            {uniqueCourses.length > 0 && (
              <select
                value={selectedCourseFilter}
                onChange={(e) => setSelectedCourseFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-none focus:border-smart-indigo cursor-pointer flex-1 sm:flex-none"
              >
                <option value="all">Tất cả khóa học ({uniqueCourses.length})</option>
                {uniqueCourses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}

            {/* Tabs: Tất cả / Chưa đọc */}
            <div className="flex items-center bg-slate-200/80 dark:bg-slate-800 p-0.5 rounded-lg text-xs font-semibold shrink-0">
              <button
                type="button"
                onClick={() => setFilterTab('all')}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  filterTab === 'all'
                    ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-800'
                }`}
              >
                Tất cả
              </button>
              <button
                type="button"
                onClick={() => setFilterTab('unread')}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1 ${
                  filterTab === 'unread'
                    ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-800'
                }`}
              >
                <span>Chưa đọc</span>
                {unreadCount > 0 && (
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Nội dung danh sách thông báo */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/40 dark:bg-slate-900/30">
          {isLoading ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-8 h-8 border-3 border-indigo-200 border-t-smart-indigo rounded-full animate-spin mx-auto" />
              <p className="text-xs text-slate-400">Đang tải thông báo khóa học...</p>
            </div>
          ) : error ? (
            <div className="py-12 px-4 text-center space-y-3">
              <p className="text-xs text-rose-500 font-semibold">{error}</p>
              <button
                type="button"
                onClick={() => {
                  setIsLoading(true);
                  setError('');
                  getUserAnnouncements()
                    .then((data) => {
                      const nextAnnouncements = data || [];
                      setAnnouncements(nextAnnouncements);
                      onUnreadCountChange?.(nextAnnouncements.filter(item => !item.isRead).length);
                    })
                    .catch((err) => {
                      setError(discussionApiErrorMessage(err, 'Không thể tải danh sách thông báo.'));
                    })
                    .finally(() => setIsLoading(false));
                }}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200 text-xs font-semibold rounded-lg"
              >
                Thử lại
              </button>
            </div>
          ) : filteredAnnouncements.length === 0 ? (
            <div className="py-16 px-4 text-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-300 dark:text-slate-600 flex items-center justify-center text-2xl mx-auto shadow-inner">
                <FiInbox />
              </div>
              <h4 className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300">
                {filterTab === 'unread' ? 'Không có thông báo mới chưa đọc' : 'Chưa có thông báo nào'}
              </h4>
              <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
                {filterTab === 'unread'
                  ? 'Bạn đã xem tất cả thông báo từ các khóa học!'
                  : 'Các thông báo từ giảng viên về lịch học, tài liệu bổ sung sẽ được hiển thị ở đây.'}
              </p>
            </div>
          ) : (
            filteredAnnouncements.map((ann) => {
              const isUnread = !ann.isRead;

              return (
                <div
                  key={ann.id}
                  className={`p-4 rounded-xl border transition-all space-y-2.5 relative shadow-2xs ${
                    isUnread
                      ? 'bg-white dark:bg-slate-800/95 border-indigo-200 dark:border-indigo-900/60 ring-1 ring-indigo-500/10'
                      : 'bg-white dark:bg-slate-800/60 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  {/* Dòng metadata trên cùng */}
                  <div className="flex items-center justify-between text-xs gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-blue-50 dark:bg-blue-950/60 text-smart-indigo dark:text-blue-400 border border-blue-200/60 dark:border-blue-900/40 truncate">
                        {ann.courseName}
                      </span>
                      {isUnread && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] font-extrabold bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 shrink-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                          Mới
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 text-[11px] text-slate-400 shrink-0">
                      <FiClock className="text-[10px]" />
                      <span>{ann.createdAt}</span>
                    </div>
                  </div>

                  {/* Tiêu đề thông báo */}
                  <h3 className="font-bold text-xs sm:text-[13.5px] text-slate-900 dark:text-slate-100 leading-snug">
                    {ann.title}
                  </h3>

                  {/* Nội dung thông báo */}
                  <div className="text-xs sm:text-[12.5px] text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap bg-slate-50/60 dark:bg-slate-900/40 p-3 rounded-lg border border-slate-100 dark:border-slate-800/60">
                    {ann.content}
                  </div>

                  {/* Dòng tác giả và nút hành động */}
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-smart-indigo dark:text-blue-300 flex items-center justify-center text-[9px] font-bold shrink-0">
                        {ann.instructorName?.[0] || 'T'}
                      </div>
                      <span className="truncate">Giảng viên: <strong className="text-slate-700 dark:text-slate-200 font-semibold">{ann.instructorName}</strong></span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {isUnread && (
                        <button
                          type="button"
                          onClick={() => handleMarkAsRead(ann.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[10.5px] font-semibold rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                        >
                          <FiCheck className="text-emerald-500" />
                          <span>Đã đọc</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleNavigateToCourse(ann)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[10.5px] font-bold rounded-lg bg-smart-indigo hover:bg-indigo-700 text-white transition-colors cursor-pointer shadow-2xs"
                      >
                        <span>Xem khóa học</span>
                        <FiExternalLink className="text-[10px]" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer modal */}
        <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 shrink-0">
          <span>Tổng số {announcements.length} thông báo</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};

export default CourseAnnouncementsModal;
