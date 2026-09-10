import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';

/**
 * LazyImage - Responsive image component with lazy loading
 * Features:
 * - IntersectionObserver-based lazy loading
 * - Responsive images with srcSet
 * - Placeholder while loading
 * - Error handling
 * - WebP/AVIF support via srcSet
 */
const LazyImage = ({ 
  src, 
  alt = '', 
  width, 
  height, 
  className = '', 
  style = {},
  srcSet,
  sizes,
  placeholder = '/placeholder.svg',
  loading = 'lazy',
  onLoad,
  onError
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const imgRef = useRef(null);

  useEffect(() => {
    if (loading !== 'lazy') {
      setIsInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer.unobserve(entry.target);
          }
        });
      },
      {
        rootMargin: '100px 0px',
        threshold: 0.01
      }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [loading]);

  const handleLoad = (e) => {
    setIsLoaded(true);
    onLoad?.(e);
  };

  const handleError = (e) => {
    setHasError(true);
    onError?.(e);
  };

  if (hasError) {
    return (
      <div
        ref={imgRef}
        className={`lazy-image-error ${className}`}
        style={{
          width: width || '100%',
          height: height || 'auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--bg-color, #f1f5f9)',
          color: 'var(--text-muted, #94a3b8)',
          fontSize: '0.875rem',
          ...style
        }}
        aria-hidden="true"
      >
        <span>Failed to load image</span>
      </div>
    );
  }

  return (
    <div
      ref={imgRef}
      className={`lazy-image-container ${className}`}
      style={{
        position: 'relative',
        width: width || '100%',
        height: height || 'auto',
        overflow: 'hidden',
        ...style
      }}
    >
      {!isLoaded && (
        <div
          className="lazy-image-placeholder"
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'var(--bg-color, #f1f5f9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: height || '200px'
          }}
          aria-hidden="true"
        >
          <div className="animate-pulse">
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              style={{ color: 'var(--border-color, #e2e8f0)' }}
            >
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          </div>
        </div>
      )}

      <img
        ref={imgRef}
        src={isInView ? src : placeholder}
        srcSet={isInView ? srcSet : undefined}
        sizes={sizes}
        alt={alt}
        width={width}
        height={height}
        loading={loading}
        onLoad={handleLoad}
        onError={handleError}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          opacity: isLoaded ? 1 : 0,
          transition: 'opacity 0.3s ease-in-out',
          display: 'block'
        }}
      />
    </div>
  );
};

LazyImage.propTypes = {
  src: PropTypes.string.isRequired,
  alt: PropTypes.string,
  width: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  height: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  className: PropTypes.string,
  style: PropTypes.object,
  srcSet: PropTypes.string,
  sizes: PropTypes.string,
  placeholder: PropTypes.string,
  loading: PropTypes.oneOf(['lazy', 'eager']),
  onLoad: PropTypes.func,
  onError: PropTypes.func
};

export default React.memo(LazyImage);