import React, { useState } from 'react';
import { FiX, FiPlus, FiVolume2, FiCheck, FiBook } from 'react-icons/fi';
import { useLanguage } from '../../../context/LanguageContext';

const AddWordModal = ({ isOpen, onClose, onAddWord }) => {
  const { t } = useLanguage();
  const [word, setWord] = useState('');
  const [ipa, setIpa] = useState('');
  const [meaning, setMeaning] = useState('');
  const [example, setExample] = useState('');
  const [level, setLevel] = useState('A2');
  const [collectionName, setCollectionName] = useState('My Notebook');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!word.trim() || !meaning.trim()) {
      setError('Vui lòng nhập từ vựng và nghĩa tiếng Việt');
      return;
    }

    const newWordItem = {
      id: `custom-${Date.now()}`,
      word: word.trim(),
      ipa: ipa.trim() || `/${word.trim().toLowerCase()}/`,
      meaning: meaning.trim(),
      example: example.trim() || `I practice using "${word.trim()}" in daily conversation.`,
      level: level,
      collectionName: collectionName.trim() || 'My Notebook',
      createdAt: new Date().toISOString()
    };

    if (onAddWord) {
      onAddWord(newWordItem);
    }

    // Reset & close
    setWord('');
    setIpa('');
    setMeaning('');
    setExample('');
    setError('');
    onClose();
  };

  return (
    <div className="vocab-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="vocab-modal-card add-word-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="vocab-modal-header">
          <div className="header-info">
            <span className="collection-icon-badge">📝</span>
            <div>
              <h2 className="collection-modal-title">Thêm từ vựng mới</h2>
              <p className="modal-subtitle-text">Tạo sổ tay từ vựng cá nhân để ôn tập flashcard mỗi ngày</p>
            </div>
          </div>
          <button type="button" className="btn-close-modal" onClick={onClose}>
            <FiX />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="add-word-form">
          {error && <div className="form-alert-error">{error}</div>}

          <div className="form-grid-2">
            <div className="form-group">
              <label htmlFor="input-word">Từ / Cụm từ tiếng Anh <span className="req">*</span></label>
              <input 
                id="input-word"
                type="text" 
                placeholder="VD: Breakthrough, Keep in touch..." 
                value={word}
                onChange={(e) => setWord(e.target.value)}
                autoFocus
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="input-ipa">Phiên âm IPA (Tùy chọn)</label>
              <input 
                id="input-ipa"
                type="text" 
                placeholder="VD: /ˈbreɪkθruː/" 
                value={ipa}
                onChange={(e) => setIpa(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="input-meaning">Nghĩa tiếng Việt <span className="req">*</span></label>
            <input 
              id="input-meaning"
              type="text" 
              placeholder="VD: bước đột phá, thành tựu quan trọng..." 
              value={meaning}
              onChange={(e) => setMeaning(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="input-example">Câu ví dụ thực tế</label>
            <textarea 
              id="input-example"
              rows={2}
              placeholder="VD: This AI technology represents a major breakthrough in language learning."
              value={example}
              onChange={(e) => setExample(e.target.value)}
            />
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label htmlFor="input-level">Cấp độ CEFR</label>
              <select 
                id="input-level"
                value={level} 
                onChange={(e) => setLevel(e.target.value)}
              >
                <option value="A1">A1 - Sơ cấp (Beginner)</option>
                <option value="A2">A2 - Cơ bản (Elementary)</option>
                <option value="B1">B1 - Trung cấp (Intermediate)</option>
                <option value="B2">B2 - Trung cao cấp (Upper-Intermediate)</option>
                <option value="C1">C1 - Nâng cao (Advanced)</option>
                <option value="C2">C2 - Thành thạo (Mastery)</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="input-collection">Nhóm / Bộ sưu tập</label>
              <input 
                id="input-collection"
                type="text"
                value={collectionName}
                onChange={(e) => setCollectionName(e.target.value)}
                placeholder="VD: My Notebook, Business Vocab..."
              />
            </div>
          </div>

          <div className="form-footer-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>
              Hủy bỏ
            </button>
            <button type="submit" className="btn-submit-word">
              <FiPlus /> Lưu vào sổ từ vựng
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddWordModal;
