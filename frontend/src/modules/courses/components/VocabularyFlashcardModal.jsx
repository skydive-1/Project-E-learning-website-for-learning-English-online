import React, { useState, useEffect, useCallback } from 'react';
import { FiX, FiVolume2, FiRotateCw, FiChevronLeft, FiChevronRight, FiCheckCircle, FiClock, FiBookOpen, FiList } from 'react-icons/fi';
import { useLanguage } from '../../../context/LanguageContext';
import { configureBritishEnglishUtterance } from '../../../utils/britishEnglishTts';

const VocabularyFlashcardModal = ({ collection, onClose, onUpdateWordProgress, userProgressMap = {} }) => {
  const { t } = useLanguage();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [activeTab, setActiveTab] = useState('flashcard'); // 'flashcard' | 'list'
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  const words = collection?.words || [];
  const currentWord = words[currentIndex] || {};

  // Hàm phát âm Audio giọng đọc bản xứ bằng Web Speech API (Nam - British)
  const speakWord = useCallback((text) => {
    if (!text || typeof window === 'undefined' || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      configureBritishEnglishUtterance(utterance, window.speechSynthesis, { gender: 'male', rate: 0.88 });
      setIsPlayingAudio(true);
      utterance.onend = () => setIsPlayingAudio(false);
      utterance.onerror = () => setIsPlayingAudio(false);
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('Speech synthesis not available', e);
      setIsPlayingAudio(false);
    }
  }, []);

  // Tự động phát âm khi chuyển sang từ mới trong chế độ flashcard
  useEffect(() => {
    setIsFlipped(false);
    if (currentWord?.word && activeTab === 'flashcard') {
      const timer = setTimeout(() => speakWord(currentWord.word), 300);
      return () => clearTimeout(timer);
    }
  }, [currentIndex, activeTab, currentWord?.word, speakWord]);

  // Hỗ trợ phím tắt bàn phím: Space để lật, Mũi tên trái/phải để chuyển từ
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === ' ' && activeTab === 'flashcard') {
        e.preventDefault();
        setIsFlipped(prev => !prev);
      } else if (e.key === 'ArrowRight' && activeTab === 'flashcard') {
        handleNext();
      } else if (e.key === 'ArrowLeft' && activeTab === 'flashcard') {
        handlePrev();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, words.length, currentIndex, onClose]);

  const handleNext = () => {
    if (currentIndex < words.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setCurrentIndex(0); // Lặp lại từ đầu nếu hết
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    } else {
      setCurrentIndex(words.length - 1);
    }
  };

  const handleMarkLearned = (wordId) => {
    if (onUpdateWordProgress) {
      onUpdateWordProgress(wordId, 'learned');
    }
    handleNext();
  };

  const handleMarkReview = (wordId) => {
    if (onUpdateWordProgress) {
      onUpdateWordProgress(wordId, 'learning');
    }
    handleNext();
  };

  if (!collection) return null;

  const currentStatus = userProgressMap[currentWord.id] || 'new';

  return (
    <div className="vocab-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="vocab-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="vocab-modal-header">
          <div className="header-info">
            <span className="collection-icon-badge">{collection.iconEmoji}</span>
            <div>
              <div className="collection-meta-row flex items-center gap-2 flex-wrap">
                <span className="cefr-badge">{collection.level}</span>
                <span className="words-total">{words.length} {t('words') || 'từ vựng'}</span>
              </div>
              <h2 className="collection-modal-title">{collection.title}</h2>
            </div>
          </div>

          <div className="header-actions">
            {/* View Switcher */}
            <div className="view-switch-tabs">
              <button 
                type="button"
                className={`tab-btn ${activeTab === 'flashcard' ? 'active' : ''}`}
                onClick={() => setActiveTab('flashcard')}
                title="Luyện tập Flashcard"
              >
                <FiRotateCw /> Flashcard
              </button>
              <button 
                type="button"
                className={`tab-btn ${activeTab === 'list' ? 'active' : ''}`}
                onClick={() => setActiveTab('list')}
                title="Danh sách từ"
              >
                <FiList /> Danh sách
              </button>
            </div>

            <button type="button" className="btn-close-modal" onClick={onClose} aria-label="Đóng">
              <FiX />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        {activeTab === 'flashcard' ? (
          <div className="flashcard-study-container">
            {/* Progress indicator */}
            <div className="flashcard-progress-bar-wrap">
              <div className="progress-text">
                <span>Thẻ {currentIndex + 1} / {words.length}</span>
                <span className="keyboard-tip">💡 Phím cách (Space) để lật • Mũi tên để chuyển</span>
              </div>
              <div className="progress-track">
                <div 
                  className="progress-fill" 
                  style={{ width: `${((currentIndex + 1) / words.length) * 100}%` }}
                />
              </div>
            </div>

            {/* 3D Flip Card */}
            <div 
              className={`flashcard-scene ${isFlipped ? 'is-flipped' : ''}`}
              onClick={() => setIsFlipped(!isFlipped)}
            >
              <div className="flashcard-inner">
                {/* Front side (English) */}
                <div className="flashcard-face flashcard-front">
                  <div className="card-top-tag">
                    <span className={`status-pill ${currentStatus}`}>
                      {currentStatus === 'learned' ? '✓ Đã thuộc' : currentStatus === 'learning' ? '⏳ Đang ôn' : '✨ Từ mới'}
                    </span>
                    <button 
                      type="button" 
                      className={`btn-tts-speaker ${isPlayingAudio ? 'playing' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        speakWord(currentWord.word);
                      }}
                      title="Nghe phát âm chuẩn (Nam - British)"
                    >
                      <FiVolume2 />
                    </button>
                  </div>

                  <div className="card-main-content">
                    <h3 className="target-word">{currentWord.word}</h3>
                    <p className="phonetic-ipa">{currentWord.ipa}</p>
                  </div>

                  <div className="card-bottom-hint">
                    <FiRotateCw />
                    <span>Nhấn để xem nghĩa tiếng Việt & Ví dụ</span>
                  </div>
                </div>

                {/* Back side (Vietnamese & Example) */}
                <div className="flashcard-face flashcard-back">
                  <div className="card-top-tag">
                    <span className="back-badge">Nghĩa & Ngữ cảnh</span>
                    <button 
                      type="button" 
                      className={`btn-tts-speaker ${isPlayingAudio ? 'playing' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        speakWord(currentWord.word);
                      }}
                      title="Nghe lại phát âm"
                    >
                      <FiVolume2 />
                    </button>
                  </div>

                  <div className="card-main-content">
                    <h4 className="vietnamese-meaning">{currentWord.meaning}</h4>
                    {currentWord.example && (
                      <div className="example-box">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <p className="example-title">Ví dụ mẫu:</p>
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              speakWord(currentWord.example);
                            }}
                            title="Nghe câu ví dụ bằng giọng Nam (British)"
                          >
                            <FiVolume2 className="text-xs" /> <span>Nghe ví dụ (Nam - British)</span>
                          </button>
                        </div>
                        <p className="example-sentence">"{currentWord.example}"</p>
                      </div>
                    )}
                  </div>

                  <div className="card-bottom-hint">
                    <FiRotateCw />
                    <span>Nhấn để lật lại mặt trước</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Flashcard Action Buttons */}
            <div className="flashcard-controls-row">
              <button 
                type="button" 
                className="btn-nav-card" 
                onClick={handlePrev}
                title="Từ trước"
              >
                <FiChevronLeft />
              </button>

              <div className="action-feedback-buttons">
                <button 
                  type="button" 
                  className="btn-mark-review"
                  onClick={() => handleMarkReview(currentWord.id)}
                >
                  <FiClock /> Cần ôn lại
                </button>
                <button 
                  type="button" 
                  className="btn-mark-learned"
                  onClick={() => handleMarkLearned(currentWord.id)}
                >
                  <FiCheckCircle /> Đã thuộc từ này
                </button>
              </div>

              <button 
                type="button" 
                className="btn-nav-card" 
                onClick={handleNext}
                title="Từ kế tiếp"
              >
                <FiChevronRight />
              </button>
            </div>
          </div>
        ) : (
          /* List View */
          <div className="vocab-list-view-container">
            <div className="vocab-table-header">
              <span>Từ vựng & Phiên âm</span>
              <span>Ý nghĩa tiếng Việt</span>
              <span>Ví dụ ngữ cảnh</span>
              <span>Trạng thái</span>
            </div>
            <div className="vocab-items-scroll">
              {words.map((item, idx) => {
                const status = userProgressMap[item.id] || 'new';
                return (
                  <div key={item.id || idx} className="vocab-list-row">
                    <div className="col-word">
                      <button 
                        type="button" 
                        className="btn-list-audio"
                        onClick={() => speakWord(item.word)}
                        title="Nghe phát âm"
                      >
                        <FiVolume2 />
                      </button>
                      <div>
                        <strong>{item.word}</strong>
                        <span className="list-ipa">{item.ipa}</span>
                      </div>
                    </div>
                    <div className="col-meaning">{item.meaning}</div>
                    <div className="col-example">
                      <div className="flex items-start gap-1.5">
                        <button
                          type="button"
                          className="btn-list-audio-example shrink-0 text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 mt-0.5 cursor-pointer"
                          onClick={() => speakWord(item.example)}
                          title="Nghe ví dụ (Nam - British)"
                        >
                          <FiVolume2 className="text-xs" />
                        </button>
                        <span>"{item.example}"</span>
                      </div>
                    </div>
                    <div className="col-status">
                      <select 
                        value={status}
                        onChange={(e) => onUpdateWordProgress && onUpdateWordProgress(item.id, e.target.value)}
                        className={`status-select ${status}`}
                      >
                        <option value="new">✨ Mới</option>
                        <option value="learning">⏳ Đang học</option>
                        <option value="learned">✓ Đã thuộc</option>
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VocabularyFlashcardModal;
