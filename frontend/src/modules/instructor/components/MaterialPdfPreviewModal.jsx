import React, { useState, useEffect, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/TextLayer.css';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import {
  FiFileText,
  FiX,
  FiChevronLeft,
  FiChevronRight,
  FiZoomIn,
  FiZoomOut,
  FiLayers,
  FiRotateCw,
  FiLoader,
  FiAlertCircle,
  FiDownload
} from 'react-icons/fi';

// Cấu hình Bundled Worker cục bộ tương thích hoàn toàn với Vite và không phụ thuộc CDN bên ngoài
if (typeof window !== 'undefined') {
  try {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString();
  } catch (e) {
    console.warn('Cảnh báo nạp worker PDF:', e.message);
  }
}

/**
 * In-App PDF Preview Modal chuyên dụng (Canvas React-PDF & In-Memory ArrayBuffer)
 * 1. Với PDF vừa được giảng viên chọn nhưng CHƯA UPLOAD:
 *    - Dùng URL.createObjectURL(file) tạo Blob URL
 *    - Tự động gọi URL.revokeObjectURL() khi đóng/hủy để tránh rò rỉ bộ nhớ
 * 2. Với PDF ĐÃ UPLOAD lên server:
 *    - Dùng fetch() nạp ArrayBuffer vào bộ nhớ RAM trình duyệt, vẽ thẳng lên HTML5 Canvas
 *    - Không dùng window.open hoặc <a href>, IDM hoàn toàn không thể bắt link tải về
 * 3. Tách rõ hai hành vi:
 *    - Xem trước: Dựng trang và đọc trực tiếp trên website
 *    - Tải xuống: Chỉ tải khi người dùng chủ động nhấn nút "Tải xuống"
 */
const MaterialPdfPreviewModal = ({
  isOpen,
  pdfUrl,
  file,
  downloadUrl,
  title = 'Tài liệu PDF bài học',
  sizeKb = 0,
  onClose,
  onDownload
}) => {
  const [pdfData, setPdfData] = useState(null);
  const [blobUrl, setBlobUrl] = useState(null);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.15);
  const [viewMode, setViewMode] = useState('single'); // 'single' | 'continuous'
  const [retryCount, setRetryCount] = useState(0);

  // Quản lý nạp PDF an toàn & giải phóng Blob URL
  useEffect(() => {
    if (!isOpen || (!pdfUrl && !file)) {
      setPdfData(null);
      setNumPages(null);
      setPageNumber(1);
      return;
    }

    let isCancelled = false;
    let localBlobUrl = null;
    setFetchLoading(true);
    setFetchError(null);
    setPageNumber(1);

    // =========================================================================
    // YÊU CẦU 1: File vừa được chọn nhưng CHƯA UPLOAD lên máy chủ
    // =========================================================================
    if (file) {
      try {
        localBlobUrl = URL.createObjectURL(file);
        setBlobUrl(localBlobUrl);

        file.arrayBuffer()
          .then((buffer) => {
            if (!isCancelled) {
              setPdfData({ data: new Uint8Array(buffer) });
            }
          })
          .catch((err) => {
            if (!isCancelled) {
              console.error('Lỗi đọc tệp tin PDF cục bộ:', err);
              setFetchError('Không thể đọc dữ liệu từ tệp tin vừa chọn.');
              setFetchLoading(false);
            }
          });
      } catch (err) {
        if (!isCancelled) {
          setFetchError('Lỗi tạo đường dẫn Blob xem trước cục bộ.');
          setFetchLoading(false);
        }
      }

      // Cleanup giải phóng bộ nhớ URL.createObjectURL tránh memory leak
      return () => {
        isCancelled = true;
        if (localBlobUrl) {
          URL.revokeObjectURL(localBlobUrl);
        }
        setBlobUrl(null);
      };
    }

    // =========================================================================
    // YÊU CẦU 2: File ĐÃ UPLOAD lên máy chủ
    // Fetch dữ liệu nhị phân vào RAM rồi render bằng Canvas, tránh IDM chặn URL
    // =========================================================================
    const loadRemotePdfBytes = async () => {
      try {
        const token = localStorage.getItem('token');
        const headers = {
          'Accept': 'application/pdf, application/octet-stream'
        };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(pdfUrl, {
          method: 'GET',
          headers,
          credentials: 'include'
        });

        if (!response.ok) {
          throw new Error(`Máy chủ phản hồi mã lỗi HTTP ${response.status}`);
        }

        const buffer = await response.arrayBuffer();
        if (!isCancelled) {
          setPdfData({ data: new Uint8Array(buffer) });
        }
      } catch (err) {
        if (!isCancelled) {
          console.error('Lỗi nạp dữ liệu PDF từ máy chủ:', err);
          setFetchError(err.message || 'Không thể nạp tệp PDF từ máy chủ.');
          setFetchLoading(false);
        }
      }
    };

    loadRemotePdfBytes();

    return () => {
      isCancelled = true;
    };
  }, [isOpen, pdfUrl, file, retryCount]);

  // Đóng bằng phím ESC & điều khiển mũi tên khi xem từng trang
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose?.();
      } else if (viewMode === 'single' && (e.key === 'ArrowRight' || e.key === 'PageDown')) {
        setPageNumber(prev => (numPages ? Math.min(prev + 1, numPages) : prev));
      } else if (viewMode === 'single' && (e.key === 'ArrowLeft' || e.key === 'PageUp')) {
        setPageNumber(prev => Math.max(prev - 1, 1));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, onClose, numPages, viewMode]);

  const onDocumentLoadSuccess = useCallback(({ numPages }) => {
    setNumPages(numPages);
    setPageNumber(1);
    setFetchLoading(false);
    setFetchError(null);
  }, []);

  const onDocumentLoadError = useCallback((err) => {
    console.error('Lỗi phân tích cú pháp PDF qua Canvas:', err);
    setFetchError(err?.message || 'Không thể hiển thị tài liệu PDF.');
    setFetchLoading(false);
  }, []);

  const handleZoomIn = () => setScale(prev => Math.min(prev + 0.15, 2.5));
  const handleZoomOut = () => setScale(prev => Math.max(prev - 0.15, 0.6));
  const handleResetZoom = () => setScale(1.15);

  const handlePrevPage = () => setPageNumber(prev => Math.max(prev - 1, 1));
  const handleNextPage = () => setPageNumber(prev => (numPages ? Math.min(prev + 1, numPages) : prev));
  const handleRetry = () => setRetryCount(prev => prev + 1);

  // =========================================================================
  // YÊU CẦU 4: Tách rõ hành vi Tải xuống (Chỉ tải khi người dùng nhấn nút này)
  // =========================================================================
  const handleDownloadFile = () => {
    if (onDownload) {
      onDownload();
      return;
    }

    const downloadFileName = title.toLowerCase().endsWith('.pdf') ? title : `${title}.pdf`;

    // Nếu có file cục bộ đã tạo Blob URL:
    if (file && blobUrl) {
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = file.name || downloadFileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    // Nếu có endpoint download riêng từ backend (Content-Disposition: attachment):
    if (downloadUrl) {
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = downloadFileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    // Fallback: Tạo download từ dữ liệu RAM ArrayBuffer
    if (pdfData?.data) {
      const blob = new Blob([pdfData.data], { type: 'application/pdf' });
      const tempUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = tempUrl;
      link.download = downloadFileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(tempUrl), 1000);
    }
  };

  if (!isOpen || (!pdfUrl && !file)) return null;

  const displayTitle = file ? file.name : (title || 'Tài liệu PDF bài học');
  const calcSizeKb = file ? Math.round(file.size / 1024) : sizeKb;
  const formattedSize = calcSizeKb
    ? (calcSizeKb >= 1024 ? `${(calcSizeKb / 1024).toFixed(1)} MB` : `${calcSizeKb} KB`)
    : null;

  return (
    <div
      className="material-preview-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="material-pdf-preview-title"
      onClick={onClose}
    >
      <div
        className="material-preview-modal-container"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Toolbar */}
        <div className="material-preview-header">
          <div className="preview-header-left">
            <div className="pdf-icon-badge">
              <FiFileText />
            </div>
            <div className="preview-title-block">
              <h3 id="material-pdf-preview-title" className="preview-title" title={displayTitle}>
                {displayTitle}
              </h3>
              <div className="preview-meta-tags">
                <span className="badge-format">Định dạng PDF</span>
                {formattedSize && <span className="badge-size">{formattedSize}</span>}
                <span className="badge-status">
                  {file ? 'Tệp cục bộ (Chưa upload)' : 'Xem trực tiếp an toàn'}
                </span>
              </div>
            </div>
          </div>

          {/* Center Navigation Controls */}
          {numPages && (
            <div className="preview-header-center">
              {/* Pagination Controls */}
              {viewMode === 'single' && (
                <div className="page-nav-controls">
                  <button
                    type="button"
                    onClick={handlePrevPage}
                    disabled={pageNumber <= 1}
                    className="btn-toolbar-nav"
                    title="Trang trước (Mũi tên trái)"
                    aria-label="Trang trước"
                  >
                    <FiChevronLeft />
                  </button>
                  <span className="page-counter-badge">
                    Trang {pageNumber} / {numPages}
                  </span>
                  <button
                    type="button"
                    onClick={handleNextPage}
                    disabled={pageNumber >= numPages}
                    className="btn-toolbar-nav"
                    title="Trang tiếp (Mũi tên phải)"
                    aria-label="Trang tiếp theo"
                  >
                    <FiChevronRight />
                  </button>
                </div>
              )}

              {/* View Mode Toggle: Single vs Continuous */}
              <div className="view-mode-controls">
                <button
                  type="button"
                  onClick={() => setViewMode(prev => prev === 'single' ? 'continuous' : 'single')}
                  className={`btn-view-mode ${viewMode === 'continuous' ? 'active' : ''}`}
                  title={viewMode === 'continuous' ? 'Chuyển sang xem từng trang' : 'Chuyển sang cuộn tất cả các trang'}
                >
                  <FiLayers />
                  <span>{viewMode === 'continuous' ? 'Cuộn' : 'Từng trang'}</span>
                </button>
              </div>

              {/* Zoom Controls */}
              <div className="zoom-controls">
                <button
                  type="button"
                  onClick={handleZoomOut}
                  disabled={scale <= 0.6}
                  className="btn-toolbar-nav"
                  title="Thu nhỏ (-)"
                  aria-label="Thu nhỏ"
                >
                  <FiZoomOut />
                </button>
                <button
                  type="button"
                  onClick={handleResetZoom}
                  className="btn-zoom-level"
                  title="Mức thu phóng (Nhấn để reset về 115%)"
                >
                  {Math.round(scale * 100)}%
                </button>
                <button
                  type="button"
                  onClick={handleZoomIn}
                  disabled={scale >= 2.5}
                  className="btn-toolbar-nav"
                  title="Phóng to (+)"
                  aria-label="Phóng to"
                >
                  <FiZoomIn />
                </button>
              </div>
            </div>
          )}

          {/* Right Actions: Download & Close */}
          <div className="preview-header-actions">
            <button
              type="button"
              onClick={handleDownloadFile}
              className="btn-preview-action download"
              title="Tải tệp PDF về máy"
              aria-label="Tải xuống tệp PDF"
            >
              <FiDownload />
              <span>Tải xuống</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="btn-preview-action close"
              title="Đóng cửa sổ xem trước (ESC)"
              aria-label="Đóng cửa sổ xem trước"
            >
              <FiX />
            </button>
          </div>
        </div>

        {/* Content Body: Canvas Render */}
        <div className="material-preview-body">
          {fetchLoading && (
            <div className="preview-canvas-loader">
              <FiLoader className="spin-loader" />
              <span>Đang đọc dữ liệu và dựng trang PDF an toàn...</span>
            </div>
          )}

          {fetchError ? (
            <div className="preview-error-state">
              <FiAlertCircle className="error-icon" />
              <h4>Không thể tải trước tài liệu PDF</h4>
              <p>{fetchError}</p>
              <button
                type="button"
                onClick={handleRetry}
                className="btn-retry-pdf"
              >
                <FiRotateCw />
                <span>Thử tải lại</span>
              </button>
            </div>
          ) : (
            pdfData && (
              <div className="pdf-canvas-viewport">
                <Document
                  file={pdfData}
                  onLoadSuccess={onDocumentLoadSuccess}
                  onLoadError={onDocumentLoadError}
                  loading={null}
                  className="pdf-react-document"
                >
                  {viewMode === 'continuous' ? (
                    // Continuous Scroll View
                    Array.from(new Array(numPages || 0), (_, index) => (
                      <div key={`page_${index + 1}`} className="pdf-page-card-wrapper">
                        <div className="page-watermark-number">Trang {index + 1}</div>
                        <Page
                          pageNumber={index + 1}
                          scale={scale}
                          renderTextLayer={true}
                          renderAnnotationLayer={false}
                          className="pdf-react-page"
                        />
                      </div>
                    ))
                  ) : (
                    // Single Page View
                    <div className="pdf-page-card-wrapper">
                      <Page
                        pageNumber={pageNumber}
                        scale={scale}
                        renderTextLayer={true}
                        renderAnnotationLayer={false}
                        className="pdf-react-page"
                      />
                    </div>
                  )}
                </Document>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default MaterialPdfPreviewModal;
