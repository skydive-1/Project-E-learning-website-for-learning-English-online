import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../../../config/api.config';
import Header from '../../../components/common/Header';
import Footer from '../../../components/common/Footer';
import { useLanguage } from '../../../context/LanguageContext';
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
  FiAward, 
  FiHelpCircle
} from 'react-icons/fi';
import { VOCABULARY_COLLECTIONS } from '../data/vocabularyCollections';
import VocabularyFlashcardModal from '../components/VocabularyFlashcardModal';
import AddWordModal from '../components/AddWordModal';
import HowItWorksModal from '../components/HowItWorksModal';
import TestsAndQuizzesPanel from '../components/TestsAndQuizzesPanel';
import '../styles/courses.scss';

// Fetch courses from Backend API for the "Course" tab
export const fetchCoursesFromApi = async () => {
  try {
    const response = await apiClient.get('/courses');
    return Array.isArray(response.data?.courses) ? response.data.courses : [];
  } catch (err) {
    console.warn('Lỗi fetch courses từ DB:', err);
    return [];
  }
};

const CourseListPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();

  // Trang Learn luôn mở catalog khóa học trước; Vocab/Quizzes là các sub-tab.
  const [activeHubTab, setActiveHubTab] = useState('course');

  // Modals & Active Selections
  const [selectedCollection, setSelectedCollection] = useState(null);
  const [isAddWordModalOpen, setIsAddWordModalOpen] = useState(false);
  const [isHowItWorksOpen, setIsHowItWorksOpen] = useState(false);
  const [showPromoBanner, setShowPromoBanner] = useState(true);

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

  // Audio Pronunciation Helper
  const speakWord = useCallback((text) => {
    if (!text || typeof window === 'undefined' || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      utterance.rate = 0.9;
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
  const { data: dbCourses = [], isLoading: isCoursesLoading } = useQuery({
    queryKey: ['courses'],
    queryFn: fetchCoursesFromApi,
    enabled: activeHubTab === 'course'
  });

  // Course Catalog Filter & Search States
  const [courseSearch, setCourseSearch] = useState('');

  // Kể cả khi đang đứng tại /courses, bấm lại Learn vẫn phải quay về đúng
  // catalog Course như màn hình đích, thay vì giữ sub-tab trước đó.
  useEffect(() => {
    if (location.state?.activeHubTab === 'course') {
      setActiveHubTab('course');
      setCourseSearch('');
    }
  }, [location.key, location.state]);

  const filteredDbCourses = useMemo(() => {
    return dbCourses.filter(c => {
      const matchSearch = !courseSearch || 
        (c.course_name && c.course_name.toLowerCase().includes(courseSearch.toLowerCase())) ||
        (c.subject_name && c.subject_name.toLowerCase().includes(courseSearch.toLowerCase()));
      return matchSearch;
    });
  }, [dbCourses, courseSearch]);

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

                {isCoursesLoading ? (
                  <p className="text-slate-500 py-8 text-center">Đang tải danh sách khóa học...</p>
                ) : filteredDbCourses.length === 0 ? (
                  <div className="py-12 text-center text-slate-400">
                    <p>Không tìm thấy khóa học nào phù hợp với từ khóa.</p>
                  </div>
                ) : (
                  <div className="course-cards-grid">
                    {filteredDbCourses.map(course => (
                      <div 
                        key={course.course_id} 
                        className="course-card-clean"
                        onClick={() => navigate(`/lessons?courseId=${course.course_id}`)}
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
                          <div className="card-footer-meta">
                            <span className="price-badge">
                              {course.price && course.price > 0 
                                ? `${Number(course.price).toLocaleString('vi-VN')} ₫` 
                                : 'Miễn phí'}
                            </span>
                            <span className="btn-card-learn">Học ngay →</span>
                          </div>
                        </div>
                      </div>
                    ))}
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
                className="btn-how-it-works"
                onClick={() => setIsHowItWorksOpen(true)}
              >
                <FiHelpCircle /> How it works
              </button>
            </div>

            {/* Mobile / Quick Practice Promo Card */}
            {showPromoBanner && (
              <div className="app-promo-card">
                <div className="promo-icon-blue">
                  <FiAward />
                </div>
                <div className="promo-text-wrap">
                  <h4>Get the E-Learn app</h4>
                  <p>Schedule, chat, and learn on the go</p>
                </div>
                <button 
                  type="button" 
                  className="btn-close-promo"
                  onClick={() => setShowPromoBanner(false)}
                  title="Ẩn thông báo"
                >
                  <FiX />
                </button>
              </div>
            )}
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

      {/* How It Works Explainer Modal */}
      <HowItWorksModal 
        isOpen={isHowItWorksOpen}
        onClose={() => setIsHowItWorksOpen(false)}
      />

      <Footer />
    </div>
  );
};

export default CourseListPage;
