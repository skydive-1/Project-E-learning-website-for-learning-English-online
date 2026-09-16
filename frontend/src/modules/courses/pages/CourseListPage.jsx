import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../../config/api.config';
import Header from '../../../components/common/Header';
import { useLanguage } from '../../../context/LanguageContext';
import { useOptionalAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { 
  FiBookOpen, 
  FiBookmark, 
  FiCheckCircle, 
  FiPlus, 
  FiLock, 
  FiChevronRight, 
  FiVolume2, 
  FiSearch, 
  FiX, 
  FiBell,
  FiLayers
} from 'react-icons/fi';
import { VOCABULARY_COLLECTIONS } from '../data/vocabularyCollections';
import VocabularyFlashcardModal from '../components/VocabularyFlashcardModal';
import AddWordModal from '../components/AddWordModal';
import CourseAnnouncementsModal from '../components/CourseAnnouncementsModal';
import TestsAndQuizzesPanel from '../components/TestsAndQuizzesPanel';
import { getRoadmapById } from '../../academy/data/roadmapPaths';
import { courseMatchesRoadmap } from '../../academy/utils/courseRoadmap';
import { configureBritishEnglishUtterance } from '../../../utils/britishEnglishTts';
import '../styles/courses.scss';

// Fetch courses from Backend API for the "Course" tab
export const fetchCoursesFromApi = async () => {
  try {
    const response = await apiClient.get('/courses');
    if (!Array.isArray(response.data?.courses)) {
      throw new Error('Phản hồi danh sách khóa học không đúng định dạng.');
    }
    return response.data.courses;
  } catch (err) {
    console.error('Lỗi fetch courses từ DB:', err);
    throw err;
  }
};

export const fetchCourses = async (locale = 'vi-VN') => {
  const courses = await fetchCoursesFromApi();
  return courses.map(c => ({
    ...c,
    id: `db-${c.course_id}`,
    instructor: c.instructor_name || 'Giảng viên thật',
    rating: null,
    reviews: null,
    students: null,
    duration: null,
    price: c.price && Number(c.price) > 0 ? `${Number(c.price).toLocaleString(locale)} ₫` : 'Miễn phí'
  }));
};

const CourseListPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { language, t } = useLanguage();
  const locale = language === 'ENG' ? 'en-US' : 'vi-VN';

  // Trang Learn luôn mở catalog khóa học trước; Vocab/Quizzes là các sub-tab.
  const [activeHubTab, setActiveHubTab] = useState('course');

  // Modals & Active Selections
  const [selectedCollection, setSelectedCollection] = useState(null);
  const [isAddWordModalOpen, setIsAddWordModalOpen] = useState(false);
  const [isAnnouncementsOpen, setIsAnnouncementsOpen] = useState(false);
  const [unreadAnnCount, setUnreadAnnCount] = useState(0);

  const queryClient = useQueryClient();
  const showToast = useToast();
  const { user } = useOptionalAuth();

  // Danh sách ID các khóa học người dùng đã đăng ký (hoặc có tiến trình)
  const currentUserId = user?.id || user?.userId || user?.user_id;
  const { data: enrolledCourseIds = [] } = useQuery({
    queryKey: ['enrolled-course-ids', currentUserId],
    queryFn: async () => {
      try {
        const res = await apiClient.get('/courses/enrolled-ids');
        return res.data?.enrolledCourseIds || [];
      } catch (e) {
        return [];
      }
    },
    enabled: Boolean(currentUserId),
    staleTime: 0
  });

  const [enrollConfirmCourse, setEnrollConfirmCourse] = useState(null);
  const [isEnrolling, setIsEnrolling] = useState(false);

  const handlePromptEnroll = (course) => {
    if (!user) {
      showToast(language === 'ENG' ? 'Please log in to enroll in courses.' : 'Vui lòng đăng nhập để đăng ký khóa học.', 'info');
      navigate('/login');
      return;
    }
    setEnrollConfirmCourse(course);
  };

  const handleConfirmEnroll = async () => {
    if (!enrollConfirmCourse) return;
    setIsEnrolling(true);
    try {
      await apiClient.post(`/courses/${enrollConfirmCourse.course_id}/enroll`);
      queryClient.invalidateQueries({ queryKey: ['enrolled-course-ids'] });
      queryClient.invalidateQueries({ queryKey: ['my-courses-raw'] });
      queryClient.invalidateQueries({ queryKey: ['my-courses-progress'] });
      showToast(
        language === 'ENG' 
          ? 'Enrolled successfully! Redirecting to course lessons...' 
          : 'Đăng ký khóa học thành công! Đang chuyển đến bài học...', 
        'success'
      );
      const targetCourseId = enrollConfirmCourse.course_id;
      setEnrollConfirmCourse(null);
      navigate(`/lessons?courseId=${targetCourseId}`);
    } catch (err) {
      console.error('Lỗi đăng ký khóa học:', err);
      showToast(err.response?.data?.message || (language === 'ENG' ? 'Failed to enroll.' : 'Không thể đăng ký khóa học.'), 'error');
    } finally {
      setIsEnrolling(false);
    }
  };

  // User Custom Words & Progress State (Persisted in localStorage)
  const [customWords, setCustomWords] = useState(() => {
    try {
      const saved = localStorage.getItem('elearn_custom_words');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [userProgressMap, setUserProgressMap] = useState(() => {
    try {
      const saved = localStorage.getItem('elearn_vocab_progress');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('elearn_custom_words', JSON.stringify(customWords));
    } catch (e) {
      console.warn('Failed to save custom words to localStorage', e);
    }
  }, [customWords]);

  useEffect(() => {
    try {
      localStorage.setItem('elearn_vocab_progress', JSON.stringify(userProgressMap));
    } catch (e) {
      console.warn('Failed to save progress to localStorage', e);
    }
  }, [userProgressMap]);

  // Audio Pronunciation Helper (Nam - British)
  const speakWord = useCallback((text) => {
    if (!text || typeof window === 'undefined' || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      configureBritishEnglishUtterance(utterance, window.speechSynthesis, { gender: 'male', rate: 0.88 });
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn(e);
    }
  }, []);

  // Update progress for a specific word
  const handleUpdateWordProgress = (wordId, status) => {
    setUserProgressMap(prev => ({
      ...prev,
      [wordId]: status
    }));
  };

  // Add custom word
  const handleAddCustomWord = (newWord) => {
    setCustomWords(prev => [newWord, ...prev]);
    setUserProgressMap(prev => ({
      ...prev,
      [newWord.id]: 'learning'
    }));
  };

  // Remove custom word
  const handleRemoveCustomWord = (wordId) => {
    setCustomWords(prev => prev.filter(w => w.id !== wordId));
    setUserProgressMap(prev => {
      const copy = { ...prev };
      delete copy[wordId];
      return copy;
    });
  };

  // Calculate Progress Stats
  const { learningCount, learnedCount, newCount } = useMemo(() => {
    let learning = 0;
    let learned = 0;
    
    // Count all preset words in collections
    let totalPresetWords = 0;
    VOCABULARY_COLLECTIONS.forEach(col => {
      totalPresetWords += (col.words?.length || 0);
    });
    const totalWords = totalPresetWords + customWords.length;

    Object.values(userProgressMap).forEach(status => {
      if (status === 'learning') learning += 1;
      if (status === 'learned') learned += 1;
    });

    const newWords = Math.max(0, totalWords - learning - learned);

    return {
      learningCount: learning,
      learnedCount: learned,
      newCount: newWords
    };
  }, [userProgressMap, customWords]);

  // Query Backend Courses (When Course tab is selected)
  const {
    data: dbCourses = [],
    isLoading: isCoursesLoading,
    isFetching: isCoursesFetching,
    isError: isCoursesError,
    error: coursesError,
    refetch: refetchCourses
  } = useQuery({
    queryKey: ['courses'],
    queryFn: fetchCoursesFromApi,
    enabled: activeHubTab === 'course',
    staleTime: 30_000,
    refetchOnMount: 'always'
  });

  // Query Subjects from Backend
  const { data: dbSubjects = [] } = useQuery({
    queryKey: ['subjects'],
    queryFn: async () => {
      try {
        const response = await apiClient.get('/courses/subjects');
        return Array.isArray(response.data?.subjects) ? response.data.subjects : [];
      } catch {
        return [];
      }
    },
    enabled: activeHubTab === 'course'
  });

  // Subject Resolver for URL params (?subject=1, ?subject=ielts, etc.)
  const resolveSubjectId = useCallback((param) => {
    if (!param || param === 'all') return 'all';
    const clean = param.toString().toLowerCase().trim();
    if (['1', '2', '3', '4', '5'].includes(clean)) return clean;
    if (clean.includes('ielts')) return '1';
    if (clean.includes('toeic')) return '2';
    if (clean.includes('business') || clean.includes('thương mại')) return '3';
    if (clean.includes('general') || clean.includes('giao tiếp') || clean.includes('phản xạ')) return '4';
    if (clean.includes('grammar') || clean.includes('essential') || clean.includes('basic') || clean.includes('cơ bản')) return '5';
    const found = dbSubjects.find(s => 
      String(s.subject_id) === clean || 
      (s.subject_name && s.subject_name.toLowerCase() === clean)
    );
    return found ? String(found.subject_id) : clean;
  }, [dbSubjects]);

  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const selectedRoadmap = useMemo(
    () => getRoadmapById(searchParams.get('roadmap')),
    [searchParams]
  );

  // Course Catalog Filter & Search States
  const [selectedSubject, setSelectedSubject] = useState(() => {
    const rawParam = searchParams.get('subject') || searchParams.get('subject_id') || searchParams.get('category');
    return resolveSubjectId(rawParam);
  });

  const [courseSearch, setCourseSearch] = useState(() => searchParams.get('search') || '');

  // Sync with URL query parameter changes
  useEffect(() => {
    const rawParam = searchParams.get('subject') || searchParams.get('subject_id') || searchParams.get('category');
    if (rawParam) {
      setSelectedSubject(resolveSubjectId(rawParam));
    }
    const searchVal = searchParams.get('search');
    if (searchVal !== null && searchVal !== undefined) {
      setCourseSearch(searchVal);
    }
  }, [location.search, resolveSubjectId, searchParams]);

  // Kể cả khi đang đứng tại /courses, bấm lại Learn vẫn phải quay về đúng
  // catalog Course như màn hình đích, thay vì giữ sub-tab trước đó.
  useEffect(() => {
    if (location.state?.activeHubTab === 'course') {
      setActiveHubTab('course');
      setCourseSearch('');
      setSelectedSubject('all');
    }
  }, [location.key, location.state]);

  const handleSelectSubject = (subId) => {
    setSelectedSubject(subId);
    const params = new URLSearchParams(location.search);
    params.delete('roadmap');
    if (subId === 'all') {
      params.delete('subject');
      params.delete('subject_id');
      params.delete('category');
    } else {
      params.set('subject', subId);
    }
    const queryString = params.toString();
    navigate({ search: queryString ? `?${queryString}` : '' }, { replace: true });
  };

  const handleClearCatalogFilters = () => {
    setSelectedSubject('all');
    setCourseSearch('');
    const params = new URLSearchParams(location.search);
    ['roadmap', 'subject', 'subject_id', 'category', 'search'].forEach((key) => params.delete(key));
    const queryString = params.toString();
    navigate({ search: queryString ? `?${queryString}` : '' }, { replace: true });
  };

  const filteredDbCourses = useMemo(() => {
    return dbCourses.filter(c => {
      // 1. Text search filter
      const matchSearch = !courseSearch || 
        (c.course_name && c.course_name.toLowerCase().includes(courseSearch.toLowerCase())) ||
        (c.subject_name && c.subject_name.toLowerCase().includes(courseSearch.toLowerCase()));

      // 2. Subject filter
      let matchSubject = true;
      if (selectedSubject && selectedSubject !== 'all') {
        matchSubject = String(c.subject_id) === String(selectedSubject) ||
          (c.subject_name && (
            (selectedSubject === '1' && c.subject_name.toLowerCase().includes('ielts')) ||
            (selectedSubject === '2' && c.subject_name.toLowerCase().includes('toeic')) ||
            (selectedSubject === '3' && (c.subject_name.toLowerCase().includes('business') || c.subject_name.toLowerCase().includes('thương mại'))) ||
            (selectedSubject === '4' && (c.subject_name.toLowerCase().includes('general') || c.subject_name.toLowerCase().includes('giao tiếp'))) ||
            (selectedSubject === '5' && (c.subject_name.toLowerCase().includes('grammar') || c.subject_name.toLowerCase().includes('essential') || c.subject_name.toLowerCase().includes('basic') || c.subject_name.toLowerCase().includes('cơ bản')))
          ));
      }

      const matchRoadmap = !selectedRoadmap || courseMatchesRoadmap(c, selectedRoadmap);

      return matchSearch && matchSubject && matchRoadmap;
    });
  }, [dbCourses, courseSearch, selectedRoadmap, selectedSubject]);

  return (
    <div className="learning-hub-page">
      <Header />

      <main className="hub-container">
        <div className="hub-layout-grid">
          
          {/* ========================================================= */}
          {/* 1. LEFT COLUMN: SUB-NAVIGATION HUB (Course, Vocab, Quizzes) */}
          {/* ========================================================= */}
          <aside className="hub-left-nav" aria-label="Learning Sub Navigation">
            <ul className="subnav-list">
              <li>
                <button
                  type="button"
                  className={`subnav-item ${activeHubTab === 'course' ? 'active' : ''}`}
                  onClick={() => setActiveHubTab('course')}
                >
                  <FiBookOpen className="item-icon" />
                  <span>Course</span>
                </button>
              </li>

              <li>
                <button
                  type="button"
                  className={`subnav-item ${activeHubTab === 'vocab' ? 'active' : ''}`}
                  onClick={() => setActiveHubTab('vocab')}
                >
                  <FiBookmark className="item-icon" />
                  <span>Vocab</span>
                </button>
              </li>

              <li>
                <button
                  type="button"
                  className={`subnav-item ${activeHubTab === 'quizzes' ? 'active' : ''}`}
                  onClick={() => setActiveHubTab('quizzes')}
                >
                  <FiCheckCircle className="item-icon" />
                  <span>Tests & quizzes</span>
                </button>
              </li>
            </ul>
          </aside>

          {/* ========================================================= */}
          {/* 2. CENTER COLUMN: MAIN CONTENT (Vocab / Course / Quizzes) */}
          {/* ========================================================= */}
          <section className="hub-main-content">
            
            {/* VIEW 1: VOCABULARY HUB */}
            {activeHubTab === 'vocab' && (
              <>
                {/* Section Title */}
                <h1 className="section-vocab-title">Vocabulary</h1>

                {/* Practice Exercises Card */}
                <div 
                  className="practice-exercise-card"
                  onClick={() => setSelectedCollection(VOCABULARY_COLLECTIONS[0])}
                  role="button"
                  tabIndex={0}
                >
                  <div className="practice-left-block">
                    <div className="practice-icon-box">
                      <FiLock />
                    </div>
                    <div className="practice-info">
                      <h3>Practice exercises</h3>
                      <p>Add words from a popular collection to start practicing</p>
                    </div>
                  </div>
                  <button 
                    type="button" 
                    className="btn-practice-action"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedCollection(VOCABULARY_COLLECTIONS[0]);
                    }}
                  >
                    Bắt đầu luyện
                  </button>
                </div>

                {/* Words Section */}
                <div className="words-header-row">
                  <h3>Words</h3>
                  <button 
                    type="button" 
                    className="btn-add-word"
                    onClick={() => setIsAddWordModalOpen(true)}
                  >
                    <FiPlus /> Add
                  </button>
                </div>

                {/* Words Container: Shows Custom Words or Clean Skeletons */}
                <div className="personal-words-container">
                  {customWords.length > 0 ? (
                    <div className="user-words-tags-grid">
                      {customWords.map(item => (
                        <div key={item.id} className="user-word-chip">
                          <span className="word-txt">{item.word}</span>
                          <span className="word-ipa">{item.ipa}</span>
                          <button 
                            type="button" 
                            className="btn-chip-audio"
                            onClick={() => speakWord(item.word)}
                            title="Nghe phát âm"
                          >
                            <FiVolume2 />
                          </button>
                          <button 
                            type="button" 
                            className="btn-remove-chip"
                            onClick={() => handleRemoveCustomWord(item.id)}
                            title="Xóa từ"
                          >
                            <FiX />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="skeleton-placeholder-box">
                      <div className="skeleton-line short"></div>
                      <div className="skeleton-line long"></div>
                    </div>
                  )}
                </div>

                {/* Collections Section */}
                <div className="collections-header-block">
                  <h3>Collections</h3>
                  <p>Words grouped by popular themes</p>
                </div>

                {/* 20 Themed Collections List (Matching Preply Layout) */}
                <div className="collections-vertical-list">
                  {VOCABULARY_COLLECTIONS.map(col => (
                    <div 
                      key={col.id}
                      className="collection-row-card"
                      onClick={() => setSelectedCollection(col)}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="col-thumb-box">
                        <span>{col.iconEmoji}</span>
                      </div>
                      <div className="col-text-body">
                        <h4 className="col-name">{col.title}</h4>
                        <p className="col-sub">
                          <span>{col.wordCount} words,</span>
                          <span className="cefr-tag">{col.level}</span>
                        </p>
                      </div>
                      <FiChevronRight className="col-arrow-icon" />
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* VIEW 2: COURSE CATALOG */}
            {activeHubTab === 'course' && (
              <div className="course-catalog-view">
                <div className="catalog-search-header">
                  <h2>Khóa học Video & Lộ trình chuẩn CEFR</h2>
                  <div className="catalog-search-bar">
                    <FiSearch className="search-icon" />
                    <input 
                      type="text"
                      placeholder="Tìm kiếm khóa học..."
                      value={courseSearch}
                      onChange={(e) => setCourseSearch(e.target.value)}
                    />
                    {courseSearch && (
                      <button className="btn-clear-search" onClick={() => setCourseSearch('')}>
                        <FiX />
                      </button>
                    )}
                  </div>
                </div>

                {selectedRoadmap && (
                  <div className="catalog-roadmap-context" role="status">
                    <span>
                      {t('Đang xem khóa học cho lộ trình')}{' '}
                      <strong>{t(selectedRoadmap.title)}</strong>
                    </span>
                    <Link to="/academy">{t('Đổi lộ trình')}</Link>
                  </div>
                )}

                {/* Category Filter Tags */}
                {dbSubjects.length > 0 && (
                  <div className="catalog-filter-tags">
                    <button
                      type="button"
                      className={selectedSubject === 'all' ? 'active' : ''}
                      onClick={() => handleSelectSubject('all')}
                    >
                      {t('Tất cả')}
                    </button>
                    {dbSubjects.map((sub) => (
                      <button
                        key={sub.subject_id}
                        type="button"
                        className={selectedSubject === String(sub.subject_id) ? 'active' : ''}
                        onClick={() => handleSelectSubject(String(sub.subject_id))}
                      >
                        {t(sub.subject_name)}
                      </button>
                    ))}
                  </div>
                )}

                {isCoursesError ? (
                  <div role="alert" className="py-10 text-center text-slate-700 dark:text-slate-200">
                    <p className="font-semibold">Không thể tải danh sách khóa học, vui lòng thử lại sau.</p>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{coursesError?.message}</p>
                    <button
                      type="button"
                      onClick={() => refetchCourses()}
                      disabled={isCoursesFetching}
                      className="mt-4 min-h-11 rounded-xl bg-smart-indigo px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-70"
                    >
                      {isCoursesFetching ? 'Đang thử lại...' : 'Thử lại'}
                    </button>
                  </div>
                ) : isCoursesLoading ? (
                  <p className="text-slate-500 py-8 text-center">Đang tải danh sách khóa học...</p>
                ) : filteredDbCourses.length === 0 ? (
                  <div role="status" className="py-12 text-center text-slate-400">
                    {selectedSubject !== 'all' || selectedRoadmap ? (
                      <>
                        <p className="text-base font-semibold text-slate-700 dark:text-slate-300">
                          {t('Hiện chưa có khóa học phù hợp')}
                        </p>
                        <span className="sr-only">Hiện cho có khóa học phù hợp</span>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                          {t('Khóa học cho danh mục này đang được phát triển và sẽ sớm ra mắt.')}
                        </p>
                        <button
                          type="button"
                          onClick={handleClearCatalogFilters}
                          className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-all shadow-sm"
                        >
                          {t('Xem tất cả khóa học')}
                        </button>
                      </>
                    ) : courseSearch ? (
                      <p>{t('Không tìm thấy khóa học nào phù hợp với từ khóa.')}</p>
                    ) : (
                      <p>{t('Chưa có khóa học nào.')}</p>
                    )}
                  </div>
                ) : (
                  <div className="course-cards-grid">
                    {filteredDbCourses.map(course => {
                      const isEnrolled = enrolledCourseIds.includes(course.course_id);

                      return (
                        <div 
                          key={course.course_id} 
                          className="course-card-clean"
                          onClick={() => isEnrolled ? navigate(`/lessons?courseId=${course.course_id}`) : handlePromptEnroll(course)}
                        >
                          <div className="card-media-wrap">
                            <img 
                              src={course.thumbnail_url || '/images/hero_illustration.png'} 
                              alt={course.course_name} 
                            />
                            <span className="level-chip">{course.subject_name || 'General'}</span>
                          </div>
                          <div className="card-content-wrap">
                            <h4 className="course-title-text">{course.course_name}</h4>
                            <p className="instructor-sub">{course.instructor_name || 'E-Learn Academy'}</p>
                            <div className="card-stats-sub">
                              <span className="stat-item">
                                <FiLayers /> {course.sections_count || 0} {language === 'ENG' ? 'chapters' : 'chương'}
                              </span>
                              <span className="stat-dot">•</span>
                              <span className="stat-item">
                                <FiBookOpen /> {course.lessons_count || 0} {language === 'ENG' ? 'lessons' : 'bài học'}
                              </span>
                            </div>
                            <div className="card-footer-meta">
                              <span className="price-badge">
                                {course.price && course.price > 0 
                                  ? `${Number(course.price).toLocaleString(locale)} ₫`
                                  : (language === 'ENG' ? 'Free' : 'Miễn phí')}
                              </span>
                              {isEnrolled ? (
                                <span className="btn-card-learn enrolled">
                                  {language === 'ENG' ? 'Learn now →' : 'Vào học ngay →'}
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handlePromptEnroll(course);
                                  }}
                                  className="btn-card-enroll"
                                >
                                  {language === 'ENG' ? 'Enroll' : 'Đăng ký học'}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* VIEW 3: TESTS & QUIZZES UNIFIED PANEL */}
            {activeHubTab === 'quizzes' && (
              <TestsAndQuizzesPanel />
            )}

          </section>

          {/* ========================================================= */}
          {/* 3. RIGHT COLUMN: PROGRESS TRACKING & PROMO WIDGETS       */}
          {/* ========================================================= */}
          <aside className="hub-right-sidebar">
            {/* Your progress Widget */}
            <div className="progress-widget-card">
              <h3 className="widget-title">Your progress</h3>
              
              <div className="pills-group">
                <div className="progress-pill-row learning">
                  <span>Đang học (Learning)</span>
                  <span className="pill-count">{learningCount} learning</span>
                </div>

                <div className="progress-pill-row learned">
                  <span>Đã thuộc (Learned)</span>
                  <span className="pill-count">{learnedCount} learned</span>
                </div>

                <div className="progress-pill-row new-words">
                  <span>Từ mới (New words)</span>
                  <span className="pill-count">{newCount} new</span>
                </div>
              </div>

              <button 
                type="button" 
                className="btn-how-it-works flex items-center justify-center gap-2 relative cursor-pointer"
                onClick={() => setIsAnnouncementsOpen(true)}
              >
                <FiBell className="text-sm text-smart-indigo dark:text-blue-400" />
                <span>Thông báo</span>
                {unreadAnnCount > 0 && (
                  <span className="inline-flex items-center justify-center px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-rose-500 text-white animate-pulse">
                    {unreadAnnCount}
                  </span>
                )}
              </button>
            </div>

          </aside>

        </div>
      </main>

      {/* Interactive Flashcard Study Modal */}
      {selectedCollection && (
        <VocabularyFlashcardModal 
          collection={selectedCollection}
          onClose={() => setSelectedCollection(null)}
          onUpdateWordProgress={handleUpdateWordProgress}
          userProgressMap={userProgressMap}
        />
      )}

      {/* Add Custom Word Modal */}
      <AddWordModal 
        isOpen={isAddWordModalOpen}
        onClose={() => setIsAddWordModalOpen(false)}
        onAddWord={handleAddCustomWord}
      />

      {/* Course & Instructor Announcements Modal */}
      <CourseAnnouncementsModal 
        isOpen={isAnnouncementsOpen}
        onClose={() => setIsAnnouncementsOpen(false)}
        onUnreadCountChange={setUnreadAnnCount}
      />

      {/* Course Enrollment Confirmation Modal */}
      {enrollConfirmCourse && (
        <div 
          className="vocab-modal-backdrop" 
          onClick={() => !isEnrolling && setEnrollConfirmCourse(null)} 
          role="dialog" 
          aria-modal="true"
        >
          <div 
            className="vocab-modal-card max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-6 flex flex-col gap-4 animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center text-xl shadow-md shrink-0">
                  <FiBookOpen />
                </div>
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-smart-indigo dark:text-blue-400">
                    {language === 'ENG' ? 'Course Enrollment' : 'Đăng ký khóa học'}
                  </span>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-tight mt-0.5">
                    {language === 'ENG' ? 'Are you sure you want to enroll?' : 'Bạn chắc chắn muốn đăng ký học chứ?'}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                disabled={isEnrolling}
                onClick={() => setEnrollConfirmCourse(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Đóng"
              >
                <FiX className="text-lg" />
              </button>
            </div>

            {/* Mini preview card */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 flex items-center gap-3.5">
              <img 
                src={enrollConfirmCourse.thumbnail_url || '/images/hero_illustration.png'} 
                alt={enrollConfirmCourse.course_name} 
                className="w-16 h-14 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <h4 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
                  {enrollConfirmCourse.course_name}
                </h4>
                <p className="text-[11.5px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                  {enrollConfirmCourse.instructor_name || 'E-Learn Academy'}
                </p>
                <span className="inline-block mt-1 text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40">
                  {enrollConfirmCourse.price && enrollConfirmCourse.price > 0 
                    ? `${Number(enrollConfirmCourse.price).toLocaleString(locale)} ₫`
                    : (language === 'ENG' ? 'Free' : 'Miễn phí')}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {language === 'ENG'
                ? 'Enrolling will add this course to "My Courses", allowing you to track your syllabus progress and save learning achievements.'
                : 'Sau khi đăng ký, khóa học sẽ được lưu vào mục "Bài học của tôi", cho phép bạn theo dõi tiến độ bài giảng và lưu kết quả học tập.'}
            </p>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                disabled={isEnrolling}
                onClick={() => setEnrollConfirmCourse(null)}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
              >
                {language === 'ENG' ? 'Cancel' : 'Hủy'}
              </button>
              <button
                type="button"
                disabled={isEnrolling}
                onClick={handleConfirmEnroll}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-smart-indigo hover:bg-indigo-700 shadow-md shadow-indigo-500/20 active:scale-[0.98] transition-all cursor-pointer flex items-center gap-2 disabled:opacity-70"
              >
                {isEnrolling && <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                <span>{language === 'ENG' ? 'Confirm & Learn' : 'Đồng ý & Vào học'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CourseListPage;
