import React, { useState, useRef, useEffect } from 'react';
import { FiGlobe, FiCheck } from 'react-icons/fi';
import { useLanguage } from '../../context/LanguageContext';
import './LanguageSwitcher.scss';

const LanguageSwitcher = () => {
  const { language, changeLanguage } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const languages = [
    { code: 'en', label: 'EN', name: 'English' },
    { code: 'vi', label: 'VN', name: 'Tiếng Việt' }
  ];

  const handleLanguageChange = (lang) => {
    changeLanguage(lang);
    setIsOpen(false);
  };

  return (
    <div className="language-switcher" ref={wrapperRef}>
      <button
        className="language-switcher-btn"
        onClick={() => setIsOpen(!isOpen)}
        title="Switch language"
        aria-expanded={isOpen}
        aria-haspopup="menu"
      >
        <FiGlobe className="language-icon" />
        <span className="language-label">{languages.find(l => l.code === language)?.label}</span>
      </button>

      {isOpen && (
        <div className="language-dropdown" role="menu">
          {languages.map((lang) => (
            <button
              key={lang.code}
              className={`language-option ${language === lang.code ? 'active' : ''}`}
              onClick={() => handleLanguageChange(lang.code)}
              role="menuitem"
              aria-current={language === lang.code ? 'true' : 'false'}
            >
              <span className="lang-name">{lang.name}</span>
              {language === lang.code && <FiCheck className="check-icon" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default LanguageSwitcher;
