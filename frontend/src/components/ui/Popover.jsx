import React, { useState, useRef, useEffect } from 'react';
import './date-picker.scss';

export const Popover = ({ trigger, children, align = 'start', className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  const toggleOpen = () => setIsOpen((prev) => !prev);
  const closePopover = () => setIsOpen(false);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        closePopover();
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        closePopover();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className={`popover-container ${className}`} ref={containerRef}>
      <div 
        className="popover-trigger" 
        onClick={toggleOpen}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleOpen();
          }
        }}
      >
        {typeof trigger === 'function' ? trigger({ isOpen }) : trigger}
      </div>

      {isOpen && (
        <div className={`popover-content ${align === 'end' ? 'align-end' : ''}`}>
          {typeof children === 'function' ? children({ close: closePopover }) : children}
        </div>
      )}
    </div>
  );
};
