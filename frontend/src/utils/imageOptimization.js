/**
 * Image Optimization Utilities
 * Helper functions for responsive images, WebP/AVIF support, and lazy loading
 */

/**
 * Generate responsive srcSet for an image
 * @param {string} baseUrl - Base image URL
 * @param {number[]} widths - Array of widths to generate
 * @param {string} format - Image format (webp, avif, jpg, png)
 * @returns {string} srcSet string
 */
export const generateSrcSet = (baseUrl, widths = [320, 480, 768, 1024, 1280, 1920], format = 'webp') => {
  // If baseUrl already has query params, use & instead of ?
  const separator = baseUrl.includes('?') ? '&' : '?';
  
  return widths
    .map(w => `${baseUrl}${separator}w=${w}&format=${format} ${w}w`)
    .join(', ');
};

/**
 * Generate sizes attribute for responsive images
 * @param {Object} breakpoints - Breakpoint map
 * @returns {string} sizes attribute value
 */
export const generateSizes = (breakpoints = {
  '(max-width: 320px)': '280px',
  '(max-width: 480px)': '440px',
  '(max-width: 768px)': '720px',
  '(max-width: 1024px)': '980px',
  '(max-width: 1280px)': '1200px',
  '(max-width: 1920px)': '1800px'
}) => {
  return Object.entries(breakpoints)
    .map(([query, size]) => `${query} ${size}`)
    .join(', ');
};

/**
 * Generate picture element sources for responsive images
 * @param {string} baseUrl - Base image URL
 * @param {Object} options - Options for generating sources
 * @returns {Object} Object with sources array and fallback src
 */
export const generatePictureSources = (baseUrl, options = {}) => {
  const {
    widths = [320, 480, 768, 1024, 1280, 1920],
    formats = ['avif', 'webp', 'jpg'],
    sizes
  } = options;

  const sources = formats.map(format => ({
    type: `image/${format}`,
    srcSet: generateSrcSet(baseUrl, widths, format)
  }));

  return {
    sources,
    src: `${baseUrl}?format=${formats[formats.length - 1]}`,
    sizes
  };
};

/**
 * Check if browser supports WebP
 * @returns {Promise<boolean>}
 */
export const checkWebPSupport = () => {
  return new Promise((resolve) => {
    const webP = new Image();
    webP.onload = webP.onerror = () => resolve(webP.height === 2);
    webP.src = 'data:image/webp;base64,UklGRjoAAABXRUJQVlA4IC4AAACyAgCdASoCAAIALmk0mk0iIiIiIgBoSygABc6WWgAA/veff/0PP8bA//LwYAAA';
  });
};

/**
 * Check if browser supports AVIF
 * @returns {Promise<boolean>}
 */
export const checkAVIFSupport = () => {
  return new Promise((resolve) => {
    const avif = new Image();
    avif.onload = avif.onerror = () => resolve(avif.height === 2);
    avif.src = 'data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1hZAAAASE9sdHJibm90aGJyYXN0aW5nIFJlY29yZGVyIFJlc29sdXRpb24gQXV0aG9yIHRvIGRldGVjdCBBVklGIGNvZGVjIE1haW5wcm9maWxlIGFuZCBQcm9maWxlIDEgaW4gYSBkaWZmZXJlbnQgZmlsZSBmYXN0aW5nIHRoYW4gaW1hZ2UgdHlwZQAAAAEAAABoZGF0YSAAAAA';
  });
};

/**
 * Get optimal image format based on browser support
 * @returns {Promise<string>} Best supported format (avif, webp, jpg)
 */
export const getOptimalImageFormat = async () => {
  if (await checkAVIFSupport()) return 'avif';
  if (await checkWebPSupport()) return 'webp';
  return 'jpg';
};

/**
 * Preload critical images
 * @param {string[]} urls - Array of image URLs to preload
 */
export const preloadImages = (urls) => {
  urls.forEach(url => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = url;
    document.head.appendChild(link);
  });
};

/**
 * Create responsive image URL with size and format
 * @param {string} baseUrl - Base image URL
 * @param {number} width - Target width
 * @param {string} format - Image format (webp, avif, jpg, png)
 * @returns {string} Optimized image URL
 */
export const createResponsiveImageUrl = (baseUrl, width, format = 'webp') => {
  const separator = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${separator}w=${width}&format=${format}`;
};

/**
 * Lazy load images using IntersectionObserver
 * @param {string} selector - CSS selector for images to lazy load
 * @param {Object} options - IntersectionObserver options
 */
export const lazyLoadImages = (selector = 'img[data-src]', options = {}) => {
  const images = document.querySelectorAll(selector);
  
  const observer = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        const src = img.dataset.src;
        const srcset = img.dataset.srcset;
        
        if (src) img.src = src;
        if (srcset) img.srcset = srcset;
        
        img.removeAttribute('data-src');
        img.removeAttribute('data-srcset');
        img.classList.add('loaded');
        observer.unobserve(img);
      }
    });
  }, {
    rootMargin: '100px 0px',
    threshold: 0.01,
    ...options
  });

  images.forEach(img => observer.observe(img));
  
  return observer;
};

/**
 * Add loading="lazy" to all images without it
 * @param {Element} container - Container element (default: document.body)
 */
export const addLazyLoading = (container = document.body) => {
  const images = container.querySelectorAll('img:not([loading])');
  images.forEach(img => {
    img.loading = 'lazy';
  });
};

/**
 * Add srcset for responsive images based on width attributes
 * @param {Element} container - Container element (default: document.body)
 */
export const enhanceResponsiveImages = (container = document.body) => {
  const images = container.querySelectorAll('img[width]:not([srcset])');
  
  images.forEach(img => {
    const width = parseInt(img.getAttribute('width')) || 800;
    const baseSrc = img.src;
    
    // Generate srcset with multiple sizes
    const widths = [Math.round(width * 0.5), width, Math.round(width * 1.5), width * 2];
    const srcset = generateSrcSet(baseSrc, widths.filter(w => w > 0 && w <= 2000));
    
    if (srcset) {
      img.srcset = srcset;
      img.sizes = img.sizes || '(max-width: 768px) 100vw 50vw';
    }
  });
};

/**
 * Blur placeholder while image loads
 * @param {HTMLImageElement} img - Image element
 * @param {string} blurDataUrl - Base64 encoded tiny blurred version
 */
export const addBlurPlaceholder = (img, blurDataUrl) => {
  const wrapper = document.createElement('div');
  wrapper.style.position = 'relative';
  wrapper.style.display = 'inline-block';
  
  const placeholder = document.createElement('img');
  placeholder.src = blurDataUrl;
  placeholder.style.cssText = `
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    filter: blur(20px);
    transform: scale(1.1);
    z-index: 0;
    pointer-events: none;
  `;
  
  img.style.cssText += `
    position: relative;
    z-index: 1;
    transition: opacity 0.3s ease;
  `;
  
  img.parentNode.insertBefore(wrapper, img);
  wrapper.appendChild(img);
  wrapper.insertBefore(placeholder, img);
};

export default {
  generateSrcSet,
  generateSizes,
  generatePictureSources,
  checkWebPSupport,
  checkAVIFSupport,
  getOptimalImageFormat,
  preloadImages,
  createResponsiveImageUrl,
  lazyLoadImages,
  addLazyLoading,
  enhanceResponsiveImages,
  addBlurPlaceholder
};