import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../../../config/api.config';
import Header from '../../../components/common/Header';
import AnimatedStatNumber from '../../../components/common/AnimatedStatNumber';
import Footer from '../../../components/common/Footer';
import { getCourseDetails } from '../../lessons/services/lessons.service';
import { useLanguage } from '../../../context/LanguageContext';
import { 
  FiSearch, FiBookOpen, FiAward, FiClock,
  FiCheckCircle, FiRefreshCw, FiAlertCircle, FiArrowRight,
  FiPlay, FiUser, FiLayers, FiX, FiActivity
} from 'react-icons/fi';

const getCourseLevel = (courseName, subjectName) => {
  const name = `${courseName || ''} ${subjectName || ''}`.toLowerCase();
  if (name.includes('căn bản') || name.includes('begin') || name.includes('cơ bản') || name.includes('nhập môn') || name.includes('elementary')) {
    return 'Beginner';
  }
  if (name.includes('communication') || name.includes('giao tiếp') || name.includes('conversation') || name.includes('business')) {
    return 'Intermediate';
  }
  if (name.includes('ielts') || name.includes('advanced') || name.includes('chuyên sâu') || name.includes('nâng cao') || name.includes('masterclass')) {
    return 'Advanced';
  }
  return 'Intermediate';
};

// Shimmer Skeleton matching exact card geometry
const MyCourseCardSkeleton = () => {
  return (
    <div className="flex flex-col bg-white dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl overflow-hidden shadow-sm animate-pulse">
      <div className="aspect-[16/10] w-full bg-slate-200 dark:bg-slate-800/60 relative" />
      <div className="p-5 flex flex-col flex-1 gap-3">
        <div className="h-4 w-24 bg-slate-200 dark:bg-slate-800 rounded-md" />
        <div className="h-5 w-4/5 bg-slate-200 dark:bg-slate-800 rounded-md" />
        <div className="h-4 w-1/2 bg-slate-200 dark:bg-slate-800 rounded-md" />
        <div className="mt-auto pt-4 border-t border-slate-100 dark:border-slate-800/80 flex flex-col gap-2">
          <div className="flex justify-between">
            <div className="h-3 w-12 bg-slate-200 dark:bg-slate-800 rounded" />
            <div className="h-3 w-8 bg-slate-200 dark:bg-slate-800 rounded" />
          </div>
          <div className="h-2 w-full bg-slate-200 dark:bg-slate-800 rounded-full" />
        </div>
      </div>
    </div>
  );
};

const MyCoursesPage = () => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const isEn = language === 'ENG';
  const locale = isEn ? 'en-US' : 'vi-VN';

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'in_progress', 'completed'

  // 1. Fetch all courses
  const {
    data: rawCourses = [],
    isLoading: isCoursesLoading,
    isFetching: isCoursesFetching,
    isError: isCoursesError,
    refetch: refetchCourses
  } = useQuery({
    queryKey: ['courses-raw'],
    queryFn: async () => {
      const response = await apiClient.get('/courses');
      return response.data.courses || [];
    }
  });

  // 2. Fetch details for each course to calculate the progress dynamically
  const {
    data: myCourses = [],
    isLoading: isProgressLoading,
    isFetching: isProgressFetching,
    isError: isProgressError,
    refetch: refetchProgress
  } = useQuery({
    queryKey: ['my-courses-progress', rawCourses.map(c => c.course_id).join(',')],
    queryFn: async () => {
      const coursesWithProgress = await Promise.all(
        rawCourses.map(async (c) => {
          try {
            const details = await getCourseDetails(c.course_id);
            return {
              id: `db-${c.course_id}`,
              title: c.course_name,
              instructor: c.instructor_name || 'Hệ thống E-Learning',
              image: c.thumbnail_url || '/images/hero_illustration.png',
              level: getCourseLevel(c.course_name, c.subject_name),
              subjectName: c.subject_name || 'Tiếng Anh',
              progress: details.progress || 0,
              lessonsCount: c.lessons_count || 0,
              sectionsCount: c.sections_count || 0,
              startDate: details.startDate || c.start_date,
              instructorId: details.instructorId || c.instructor_id
            };
          } catch (e) {
            console.error(`Error loading details for course ${c.course_id}:`, e);
            throw e;
          }
        })
      );
      return coursesWithProgress;
    },
    enabled: rawCourses.length > 0
  });

  const isLoading = isCoursesLoading || isProgressLoading;
  const isFetching = isCoursesFetching || isProgressFetching;
  const isError = isCoursesError || isProgressError;

  // Filter courses based on search & completion status
  const filteredCourses = myCourses.filter(c => {
    const matchSearch = (c.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                        (c.subjectName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                        (c.instructor || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    if (statusFilter === 'completed') {
      return matchSearch && c.progress === 100;
    }
    if (statusFilter === 'in_progress') {
      return matchSearch && c.progress >= 0 && c.progress < 100;
    }
    return matchSearch;
  });

  // Calculate statistics
  const totalCourses = myCourses.length;
  const completedCourses = myCourses.filter(c => c.progress === 100).length;
  const inProgressCourses = myCourses.filter(c => c.progress < 100).length;
  const averageProgress = totalCourses > 0 
    ? Math.round(myCourses.reduce((sum, c) => sum + c.progress, 0) / totalCourses) 
    : 0;

  const handleStartLearning = (course) => {
    const dbId = course.id?.startsWith('db-') ? course.id.slice(3) : null;
    if (dbId) navigate(`/lessons?courseId=${dbId}`);
  };

  const handleRetry = () => {
    if (isCoursesError) return refetchCourses();
    return refetchProgress();
  };

  const getLevelBadgeClasses = (level) => {
    switch (level) {
      case 'Beginner':
        return 'bg-emerald-500/90 text-white border-emerald-400/30';
      case 'Advanced':
        return 'bg-indigo-600/90 text-white border-indigo-400/30';
      default:
        return 'bg-blue-600/90 text-white border-blue-400/30';
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50/60 dark:bg-[#090d16] text-slate-900 dark:text-slate-100 transition-colors duration-200">
      <Header />

      <main className="flex-1 pt-28 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Header & Subtitle */}
          <div className="mb-8 sm:mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 mb-3">
              <FiBookOpen className="w-3.5 h-3.5" />
              <span>{isEn ? 'My Learning Dashboard' : 'Không gian học tập cá nhân'}</span>
            </div>
            
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              {isEn ? 'My Courses' : 'Bài học của tôi'}
            </h1>
            <p className="mt-2 text-sm sm:text-base text-slate-500 dark:text-slate-400 max-w-2xl leading-relaxed">
              {isEn
                ? 'Track your personalized learning path, resume in-progress lessons, and master English step by step.'
                : 'Theo dõi lộ trình học tập, hoàn thành bài giảng dở dang và nâng cao trình độ tiếng Anh mỗi ngày.'}
            </p>
          </div>

          {/* Apple-style Translucent Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-10">
            {/* Stat Card 1 */}
            <div className="group relative overflow-hidden bg-white/80 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 sm:p-6 shadow-sm hover:shadow-md transition-all duration-200">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {isEn ? 'Enrolled Courses' : 'Khóa học đã đăng ký'}
                </span>
                <div className="size-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center text-lg">
                  <FiBookOpen />
                </div>
              </div>
              <div className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                {isLoading || isError ? '—' : <AnimatedStatNumber value={totalCourses} />}
              </div>
              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                {isEn ? 'Active curriculums' : 'Chương trình đang theo học'}
              </p>
            </div>

            {/* Stat Card 2 */}
            <div className="group relative overflow-hidden bg-white/80 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 sm:p-6 shadow-sm hover:shadow-md transition-all duration-200">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {isEn ? 'Completed' : 'Khóa học hoàn thành'}
                </span>
                <div className="size-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-lg">
                  <FiCheckCircle />
                </div>
              </div>
              <div className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                {isLoading || isError ? '—' : <AnimatedStatNumber value={completedCourses} />}
              </div>
              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                {isEn ? '100% completion milestones' : 'Đạt mốc hoàn thành 100%'}
              </p>
            </div>

            {/* Stat Card 3 */}
            <div className="group relative overflow-hidden bg-white/80 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 sm:p-6 shadow-sm hover:shadow-md transition-all duration-200">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {isEn ? 'Average Progress' : 'Tiến độ trung bình'}
                </span>
                <div className="size-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center text-lg">
                  <FiAward />
                </div>
              </div>
              <div className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                {isLoading || isError ? '—' : <AnimatedStatNumber value={averageProgress} suffix="%" />}
              </div>
              {/* Mini Progress Track */}
              <div className="mt-2.5 h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all duration-700" 
                  style={{ width: `${averageProgress}%` }}
                />
              </div>
            </div>
          </div>

          {/* Filtering Segmented Control & Search Toolbar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-8">
            {/* Apple-style Segmented Control */}
            <div className="inline-flex p-1 rounded-xl bg-slate-200/70 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800/80 backdrop-blur-md self-start sm:self-auto gap-1">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all duration-200 active:scale-[0.98] ${
                  statusFilter === 'all'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {isEn ? 'All Courses' : 'Tất cả'} <span className="opacity-60 text-xs ml-1">({totalCourses})</span>
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('in_progress')}
                className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all duration-200 active:scale-[0.98] ${
                  statusFilter === 'in_progress'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {isEn ? 'In Progress' : 'Đang học'} <span className="opacity-60 text-xs ml-1">({inProgressCourses})</span>
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('completed')}
                className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all duration-200 active:scale-[0.98] ${
                  statusFilter === 'completed'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {isEn ? 'Completed' : 'Đã hoàn thành'} <span className="opacity-60 text-xs ml-1">({completedCourses})</span>
              </button>
            </div>

            {/* Search Box */}
            <div className="relative w-full sm:w-80">
              <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-base pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={isEn ? 'Search my courses...' : 'Tìm kiếm khóa học...'}
                className="w-full pl-10 pr-9 py-2 text-sm rounded-xl bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800/80 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all shadow-sm"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                >
                  <FiX className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Main Content: Loading, Error, Empty, or Cards Grid */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
              {[...Array(6)].map((_, i) => <MyCourseCardSkeleton key={i} />)}
            </div>
          ) : isError ? (
            <div role="alert" className="rounded-2xl bg-white/80 dark:bg-slate-900/60 border border-red-200/70 dark:border-red-900/40 p-12 text-center max-w-lg mx-auto shadow-sm">
              <FiAlertCircle className="size-12 text-rose-500 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                {isEn ? 'Could not load courses' : 'Không thể tải khóa học của bạn'}
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mb-6">
                {isEn ? 'Please check your connection and retry.' : 'Vui lòng kiểm tra kết nối mạng và bấm thử lại.'}
              </p>
              <button
                type="button"
                onClick={handleRetry}
                disabled={isFetching}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-all active:scale-[0.98] shadow-sm disabled:opacity-60"
              >
                <FiRefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
                <span>{isFetching ? (isEn ? 'Retrying...' : 'Đang thử lại...') : (isEn ? 'Retry' : 'Thử lại')}</span>
              </button>
            </div>
          ) : filteredCourses.length === 0 ? (
            <div className="rounded-3xl bg-white/80 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 p-12 sm:p-16 text-center max-w-md mx-auto shadow-sm">
              <div className="size-16 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center text-2xl mx-auto mb-4">
                <FiBookOpen />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                {searchTerm || statusFilter !== 'all'
                  ? (isEn ? 'No courses match your filter' : 'Không tìm thấy khóa học phù hợp')
                  : (isEn ? 'No enrolled courses yet' : 'Bạn chưa đăng ký khóa học nào')}
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
                {searchTerm || statusFilter !== 'all'
                  ? (isEn ? 'Try adjusting your search keywords or switching filters.' : 'Hãy thử thay đổi từ khóa tìm kiếm hoặc chọn lại trạng thái lọc.')
                  : (isEn ? 'Explore our curriculum to start your intelligent English learning journey.' : 'Khám phá ngay danh mục khóa học để bắt đầu hành trình nâng cao phản xạ tiếng Anh.')}
              </p>
              <button
                type="button"
                onClick={() => navigate('/courses')}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-all active:scale-[0.98] shadow-sm"
              >
                <span>{isEn ? 'Explore Courses' : 'Khám phá khóa học ngay'}</span>
                <FiArrowRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
              {filteredCourses.map((course) => {
                const startDate = course.startDate ? new Date(course.startDate) : null;
                const currentDate = new Date();
                const hasNotStarted = startDate && startDate > currentDate;
                const isCompleted = course.progress === 100;

                return (
                  <div
                    key={course.id}
                    onClick={() => handleStartLearning(course)}
                    className="group relative flex flex-col bg-white dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/80 dark:border-slate-800/80 rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-slate-200/50 dark:hover:shadow-blue-950/20 hover:-translate-y-1.5 cursor-pointer"
                  >
                    {/* Thumbnail Stage with 16:10 aspect ratio */}
                    <div className="relative w-full aspect-[16/10] overflow-hidden bg-slate-100 dark:bg-slate-800">
                      <img
                        src={course.image}
                        alt={course.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                        loading="lazy"
                      />
                      
                      {/* Soft dark vignette gradient overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/15 to-transparent pointer-events-none" />

                      {/* Top Badges */}
                      <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2 pointer-events-none">
                        {/* Level badge */}
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold shadow-sm backdrop-blur-md border ${getLevelBadgeClasses(course.level)}`}>
                          {course.level}
                        </span>

                        {/* Subject tag badge */}
                        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-black/50 text-white backdrop-blur-md border border-white/20">
                          {course.subjectName}
                        </span>
                      </div>

                      {/* Center Play Button on hover */}
                      <div className="absolute inset-0 m-auto size-12 rounded-full bg-white/95 dark:bg-slate-900/95 text-blue-600 dark:text-blue-400 shadow-xl flex items-center justify-center opacity-0 group-hover:opacity-100 group-hover:scale-100 scale-90 transition-all duration-300 backdrop-blur-sm pointer-events-none">
                        <FiPlay className="w-5 h-5 translate-x-0.5" />
                      </div>

                      {/* Bottom Image Notice if not started */}
                      {hasNotStarted && (
                        <div className="absolute bottom-2.5 left-3 right-3">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-500/95 text-white backdrop-blur-md shadow-sm">
                            <FiClock className="w-3.5 h-3.5" />
                            {isEn ? 'Opens:' : 'Chưa mở:'} {startDate.toLocaleDateString(locale, { day: '2-digit', month: '2-digit' })}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Card Body */}
                    <div className="p-5 flex flex-col flex-1 gap-3">
                      {/* Title */}
                      <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-2 leading-snug min-h-[48px]">
                        {course.title}
                      </h3>

                      {/* Instructor Info */}
                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <FiUser className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                        <span className="truncate">
                          {isEn ? 'Instructor:' : 'Giảng viên:'} <strong className="font-semibold text-slate-700 dark:text-slate-300">{course.instructor}</strong>
                        </span>
                      </div>

                      {/* Sections & Lessons Counts */}
                      <div className="flex items-center gap-4 text-xs text-slate-400 dark:text-slate-500">
                        <span className="flex items-center gap-1.5">
                          <FiLayers className="w-3.5 h-3.5" /> {course.sectionsCount} {isEn ? 'sections' : 'chương'}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1.5">
                          <FiClock className="w-3.5 h-3.5" /> {course.lessonsCount} {isEn ? 'lessons' : 'bài học'}
                        </span>
                      </div>

                      {/* Progress Bar Section */}
                      <div className="mt-auto pt-4 border-t border-slate-100 dark:border-slate-800/80">
                        <div className="flex items-center justify-between text-xs font-semibold mb-2">
                          <span className="text-slate-500 dark:text-slate-400">
                            {isEn ? 'Progress' : 'Tiến độ'}
                          </span>
                          <span className={isCompleted ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-blue-600 dark:text-blue-400 font-bold'}>
                            {course.progress}%
                          </span>
                        </div>
                        
                        {/* Progress Track */}
                        <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-700 ease-out ${
                              isCompleted
                                ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                                : 'bg-gradient-to-r from-blue-600 to-indigo-500'
                            }`}
                            style={{ width: `${course.progress}%` }}
                          />
                        </div>
                      </div>

                      {/* Action CTA Row */}
                      <div className="pt-2 flex items-center justify-between text-xs font-bold text-blue-600 dark:text-blue-400 group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors">
                        <span>
                          {hasNotStarted
                            ? (isEn ? 'View Schedule' : 'Xem lịch mở bài')
                            : (isCompleted
                                ? (isEn ? 'Review Course' : 'Ôn tập lại')
                                : (course.progress > 0
                                    ? (isEn ? 'Continue Learning' : 'Tiếp tục học ngay')
                                    : (isEn ? 'Start Course' : 'Bắt đầu học ngay')))}
                        </span>
                        <FiArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-200" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>
      </main>

      <Footer />
    </div>
  );
};

export default MyCoursesPage;
