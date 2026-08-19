import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/TextLayer.css';
import 'react-pdf/dist/Page/AnnotationLayer.css';

import {
  FiZoomIn,
  FiZoomOut,
  FiMaximize2,
  FiChevronLeft,
  FiChevronRight,
  FiRefreshCw,
  FiAlertTriangle,
  FiFileText,
  FiLayers,
  FiInfo,
  FiCrop,
  FiPlusCircle,
  FiX
} from 'react-icons/fi';

import PdfHighlightOverlay from './PdfHighlightOverlay';
import PdfSelectionPopover from './PdfSelectionPopover';
import { mergePdfSelectionRects } from '../utils/pdfSelectionRects';

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

const WATERMARK_POSITIONS = [
  'top-4 left-4',
  'top-4 right-4',
  'bottom-4 left-4',
  'bottom-4 right-4',
  'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2'
];

export default function PdfStudyViewer({
  pdfUrl,
  title = 'Tài liệu bài học',
  user,
  notes = [],
  selectedNoteId,
  activeGlowNoteId,
  activePage = 1,
  isAreaSelectionMode = false,
  onToggleAreaSelection,
  onPageChange,
  onCreateNote,
  onSelectNote
}) {
  const [numPages, setNumPages] = useState(null);
  const [currentPage, setCurrentPage] = useState(activePage || 1);
  const [scale, setScale] = useState(1.15); // Zoom 115% mặc định
  const [viewMode, setViewMode] = useState('single'); // 'single' hoặc 'continuous'
  const [loading, setLoading] = useState(Boolean(pdfUrl));
  const [error, setError] = useState(null);
  const [documentRetryKey, setDocumentRetryKey] = useState(0);
  const [watermarkPosIndex, setWatermarkPosIndex] = useState(0);

  // Local Area Selection Mode state if not controlled from parent
  const [localAreaMode, setLocalAreaMode] = useState(false);
  const isAreaModeActive = isAreaSelectionMode !== undefined ? isAreaSelectionMode : localAreaMode;

  const toggleAreaMode = useCallback(() => {
    if (onToggleAreaSelection) {
      onToggleAreaSelection(!isAreaModeActive);
    } else {
      setLocalAreaMode((prev) => !prev);
    }
  }, [onToggleAreaSelection, isAreaModeActive]);

  // Live Dragging Rectangle State for Area Selection
  const [dragState, setDragState] = useState(null);
  // dragState = { pageNumber, startX, startY, currentX, currentY, pageRect }

  // Selection Popover State
  const [selectionState, setSelectionState] = useState(null);
  // selectionState = { selectionType: 'text' | 'area', pageNumber, selectedText, rects, clientRect }

  const containerRef = useRef(null);
  const pageRefs = useRef({});

  // 1. Reset state khi pdfUrl thay đổi
  useEffect(() => {
    setCurrentPage(1);
    setNumPages(null);
    setSelectionState(null);
    setDragState(null);
    if (pdfUrl) {
      setLoading(true);
      setError(null);
    } else {
      setLoading(false);
      setError(null);
    }
  }, [pdfUrl]);

  // 2. Xoay vòng vị trí watermark động mỗi 25s
  useEffect(() => {
    const timer = setInterval(() => {
      setWatermarkPosIndex((prev) => (prev + 1) % WATERMARK_POSITIONS.length);
    }, 25000);
    return () => clearInterval(timer);
  }, []);

  // 3. Đồng bộ trang khi có trigger chuyển trang từ bên ngoài
  useEffect(() => {
    if (activePage && activePage !== currentPage && numPages && activePage <= numPages) {
      setCurrentPage(activePage);
      if (viewMode === 'continuous' && pageRefs.current[activePage]) {
        pageRefs.current[activePage].scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [activePage, numPages, viewMode]);

  // 4. Continuous Mode IntersectionObserver
  useEffect(() => {
    if (viewMode !== 'continuous' || !numPages) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const pageNum = parseInt(entry.target.getAttribute('data-page-number'), 10);
            if (pageNum && pageNum !== currentPage) {
              setCurrentPage(pageNum);
              if (onPageChange) onPageChange(pageNum);
            }
          }
        });
      },
      { threshold: 0.5 }
    );

    Object.values(pageRefs.current).forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [viewMode, numPages, currentPage, onPageChange]);

  // 5. Lắng nghe phím Escape để hủy Area Selection Mode hoặc Popover
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (dragState) setDragState(null);
        if (selectionState) setSelectionState(null);
        if (isAreaModeActive) {
          if (onToggleAreaSelection) onToggleAreaSelection(false);
          else setLocalAreaMode(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dragState, selectionState, isAreaModeActive, onToggleAreaSelection]);

  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
    setLoading(false);
    setError(null);
    setCurrentPage((prev) => Math.min(Math.max(1, prev), numPages));
  };

  const onDocumentLoadError = (err) => {
    console.error('Lỗi tải tài liệu PDF:', err);
    setLoading(false);
    setError(err?.message || 'Không thể hiển thị tài liệu PDF. Vui lòng kiểm tra lại đường dẫn tệp.');
  };

  const handleZoomIn = () => {
    setScale((prev) => Math.min(2.0, Number((prev + 0.15).toFixed(2))));
    setSelectionState(null);
  };
  const handleZoomOut = () => {
    setScale((prev) => Math.max(0.6, Number((prev - 0.15).toFixed(2))));
    setSelectionState(null);
  };
  const handleFitWidth = () => {
    if (containerRef.current) {
      const containerWidth = containerRef.current.clientWidth;
      const calculatedScale = Math.max(0.6, Math.min(2.0, Number(((containerWidth - 48) / 650).toFixed(2))));
      setScale(calculatedScale);
    } else {
      setScale(1.0);
    }
    setSelectionState(null);
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      const p = currentPage - 1;
      setCurrentPage(p);
      setSelectionState(null);
      if (onPageChange) onPageChange(p);
    }
  };

  const handleNextPage = () => {
    if (numPages && currentPage < numPages) {
      const p = currentPage + 1;
      setCurrentPage(p);
      setSelectionState(null);
      if (onPageChange) onPageChange(p);
    }
  };

  const handleRetryLoad = () => {
    setDocumentRetryKey((k) => k + 1);
    setLoading(true);
    setError(null);
  };

  /**
   * =========================================================================
   * AREA SELECTION HANDLERS (Pointer / Mouse Dragging on PDF Pages)
   * =========================================================================
   */
  const handlePagePointerDown = (pageNum, e) => {
    if (!isAreaModeActive) return;

    // Chỉ bắt chuột trái (button === 0) hoặc touch
    if (e.button !== undefined && e.button !== 0) return;

    const pageElement = pageRefs.current[pageNum];
    if (!pageElement) return;

    const pageRect = pageElement.getBoundingClientRect();
    const clientX = e.clientX || (e.touches && e.touches[0]?.clientX);
    const clientY = e.clientY || (e.touches && e.touches[0]?.clientY);

    if (clientX === undefined || clientY === undefined) return;

    // Bắt đầu vẽ khoanh vùng
    setDragState({
      pageNumber: pageNum,
      startX: clientX,
      startY: clientY,
      currentX: clientX,
      currentY: clientY,
      pageRect
    });
    setSelectionState(null);
  };

  const handlePointerMove = useCallback((e) => {
    if (!dragState) return;

    const clientX = e.clientX || (e.touches && e.touches[0]?.clientX);
    const clientY = e.clientY || (e.touches && e.touches[0]?.clientY);

    if (clientX === undefined || clientY === undefined) return;

    setDragState((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        currentX: clientX,
        currentY: clientY
      };
    });
  }, [dragState]);

  const handlePointerUp = useCallback(() => {
    if (!dragState) return;

    const { pageNumber, startX, startY, currentX, currentY, pageRect } = dragState;
    setDragState(null);

    const minX = Math.min(startX, currentX);
    const maxX = Math.max(startX, currentX);
    const minY = Math.min(startY, currentY);
    const maxY = Math.max(startY, currentY);

    const pixelWidth = maxX - minX;
    const pixelHeight = maxY - minY;

    // Bỏ qua nếu vùng kéo quá nhỏ (< 8x8 px)
    if (pixelWidth < 8 || pixelHeight < 8) {
      return;
    }

    // Tính toán tọa độ chuẩn hóa [0.0 - 1.0] tương đối theo trang PDF
    let normX = Math.max(0, Math.min(1, (minX - pageRect.left) / pageRect.width));
    let normY = Math.max(0, Math.min(1, (minY - pageRect.top) / pageRect.height));
    let normW = Math.max(0.001, pixelWidth / pageRect.width);
    let normH = Math.max(0.001, pixelHeight / pageRect.height);

    // Đảm bảo không vượt quá giới hạn trang
    if (normX + normW > 1.0) normW = Math.max(0.001, 1.0 - normX);
    if (normY + normH > 1.0) normH = Math.max(0.001, 1.0 - normY);

    const normalizedRects = [
      {
        x: Number(normX.toFixed(4)),
        y: Number(normY.toFixed(4)),
        width: Number(normW.toFixed(4)),
        height: Number(normH.toFixed(4))
      }
    ];

    setSelectionState({
      selectionType: 'area',
      pageNumber,
      selectedText: null,
      rects: normalizedRects,
      clientRect: {
        top: minY,
        left: minX,
        width: pixelWidth,
        height: pixelHeight,
        bottom: maxY,
        right: maxX
      }
    });

    // Tắt area mode sau khi khoanh vùng thành công để hiển thị popover nhập ghi chú
    if (onToggleAreaSelection) onToggleAreaSelection(false);
    else setLocalAreaMode(false);
  }, [dragState, onToggleAreaSelection]);

  // Đăng ký event pointer toàn cục khi đang kéo vẽ vùng
  useEffect(() => {
    if (dragState) {
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
      window.addEventListener('pointercancel', handlePointerUp);
      return () => {
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
        window.removeEventListener('pointercancel', handlePointerUp);
      };
    }
  }, [dragState, handlePointerMove, handlePointerUp]);

  /**
   * =========================================================================
   * TEXT SELECTION HANDLER (Native Text Selection on Text PDF)
   * =========================================================================
   */
  const handleMouseUp = useCallback(() => {
    if (isAreaModeActive) return; // Nếu đang bật Area Selection Mode thì không bắt text selection

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
      return;
    }

    const selectedText = selection.toString().trim();
    if (!selectedText || selectedText.length < 2) {
      return;
    }

    const range = selection.getRangeAt(0);

    let container = range.commonAncestorContainer;
    if (container.nodeType === Node.TEXT_NODE) {
      container = container.parentElement;
    }

    const pageElement = container.closest('.react-pdf__Page');
    if (!pageElement) {
      return;
    }

    const pageNumAttr = pageElement.getAttribute('data-page-number');
    const pageNum = pageNumAttr ? parseInt(pageNumAttr, 10) : currentPage;

    const pageRect = pageElement.getBoundingClientRect();
    const clientRects = Array.from(range.getClientRects());
    const rangeBoundingRect = range.getBoundingClientRect();

    if (clientRects.length === 0 || pageRect.width === 0 || pageRect.height === 0) {
      return;
    }

    // Gộp các rect theo dòng hiển thị và chuẩn hóa tọa độ theo tỷ lệ trang [0.0 - 1.0]
    const normalizedRects = mergePdfSelectionRects(clientRects, pageRect);

    if (normalizedRects.length === 0) return;

    // Guard bảo vệ: Nếu sau khi gộp vẫn vượt quá 50 rects (vùng chọn quá dài)
    if (normalizedRects.length > 50) {
      alert('Đoạn được chọn quá dài. Vui lòng chia thành các ghi chú nhỏ hơn.');
      return;
    }

    setSelectionState({
      selectionType: 'text',
      pageNumber: pageNum,
      selectedText,
      rects: normalizedRects,
      clientRect: rangeBoundingRect
    });
  }, [currentPage, isAreaModeActive]);

  const handleSaveNote = async ({ category, color, noteText, selectionType }) => {
    if (!selectionState || !onCreateNote) return;

    await onCreateNote({
      pageNumber: selectionState.pageNumber,
      selectionType: selectionType || selectionState.selectionType || 'text',
      selectedText: selectionState.selectedText,
      noteText,
      category,
      color,
      rects: selectionState.rects
    });

    if (window.getSelection) {
      window.getSelection().removeAllRanges();
    }
    setSelectionState(null);
  };

  const handleCancelSelection = () => {
    if (window.getSelection) {
      window.getSelection().removeAllRanges();
    }
    setSelectionState(null);
  };

  return (
    <div
      ref={containerRef}
      onMouseUp={handleMouseUp}
      className={`pdf-study-viewer w-full h-full flex flex-col bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl relative select-none ${
        isAreaModeActive ? 'cursor-crosshair' : ''
      }`}
      style={{ minHeight: '520px' }}
    >
      {/* 1. Thanh điều khiển trên cùng (PDF Toolbar) */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-slate-950/90 backdrop-blur-md border-b border-slate-800 z-30 text-xs text-slate-200">
        {/* Left: Title & Quick "＋ Thêm ghi chú" Action */}
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="w-7 h-7 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 font-bold shrink-0">
            <FiFileText />
          </div>
          <span className="font-semibold text-slate-200 truncate max-w-[130px] sm:max-w-xs" title={title}>
            {title}
          </span>

          {/* Primary Action Button: "＋ Thêm ghi chú" */}
          {pdfUrl && (
            <button
              type="button"
              onClick={toggleAreaMode}
              aria-label="Thêm ghi chú vùng"
              aria-pressed={isAreaModeActive}
              title="Khoanh vùng trên PDF để tạo ghi chú"
              className={`ml-1 px-2.5 py-1.5 rounded-xl font-bold text-xs transition-all shadow-sm flex items-center gap-1.5 cursor-pointer ${
                isAreaModeActive
                  ? 'bg-rose-500 text-white ring-2 ring-rose-400 scale-105 animate-pulse'
                  : 'bg-smart-indigo hover:bg-indigo-600 active:scale-95 text-white'
              }`}
            >
              <FiPlusCircle className="text-sm" />
              <span className="hidden sm:inline">{isAreaModeActive ? 'Hủy chọn vùng' : '＋ Thêm ghi chú'}</span>
            </button>
          )}
        </div>

        {/* Center: Pagination controls */}
        {pdfUrl && (
          <div className="flex items-center gap-1.5 bg-slate-900/80 px-2 py-1 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={handlePrevPage}
              disabled={currentPage <= 1 || loading}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
              title="Trang trước"
            >
              <FiChevronLeft className="text-base" />
            </button>
            <span className="font-mono text-[11px] px-1 font-bold">
              {loading ? '...' : `${currentPage} / ${numPages || 1}`}
            </span>
            <button
              type="button"
              onClick={handleNextPage}
              disabled={!numPages || currentPage >= numPages || loading}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
              title="Trang tiếp theo"
            >
              <FiChevronRight className="text-base" />
            </button>
          </div>
        )}

        {/* Right: Zoom & View Mode Controls */}
        {pdfUrl && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setViewMode(viewMode === 'single' ? 'continuous' : 'single')}
              className={`p-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                viewMode === 'continuous'
                  ? 'bg-smart-indigo text-white border-indigo-400'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
              title={viewMode === 'continuous' ? 'Chế độ cuộn liên tục' : 'Chế độ từng trang'}
            >
              <FiLayers />
              <span className="hidden sm:inline">{viewMode === 'continuous' ? 'Cuộn' : 'Trang'}</span>
            </button>

            <div className="h-4 w-px bg-slate-800 mx-1"></div>

            <button
              type="button"
              onClick={handleZoomOut}
              disabled={scale <= 0.6}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 transition-colors cursor-pointer"
              title="Thu nhỏ (-)"
            >
              <FiZoomOut />
            </button>
            <span className="font-mono text-[11px] font-bold text-slate-400 w-10 text-center">
              {Math.round(scale * 100)}%
            </span>
            <button
              type="button"
              onClick={handleZoomIn}
              disabled={scale >= 2.0}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 transition-colors cursor-pointer"
              title="Phóng to (+)"
            >
              <FiZoomIn />
            </button>
            <button
              type="button"
              onClick={handleFitWidth}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              title="Khớp chiều rộng"
            >
              <FiMaximize2 />
            </button>
          </div>
        )}
      </div>

      {/* Floating Mode Banner when Area Selection is Active */}
      {isAreaModeActive && (
        <div className="bg-rose-500/90 text-white text-xs px-4 py-2 flex items-center justify-between shadow-lg z-25 backdrop-blur-md animate-fade">
          <div className="flex items-center gap-2">
            <FiCrop className="animate-spin text-sm" />
            <span className="font-medium">
              Kéo chuột để khoanh vùng cần ghi chú trên PDF • Nhấn <kbd className="bg-black/30 px-1.5 py-0.5 rounded font-mono text-[10.5px]">Esc</kbd> để hủy
            </span>
          </div>
          <button
            type="button"
            onClick={toggleAreaMode}
            className="p-1 hover:bg-black/20 rounded-lg cursor-pointer"
            title="Đóng chế độ khoanh vùng (Esc)"
          >
            <FiX />
          </button>
        </div>
      )}

      {/* 2. PDF Document Canvas & Scrollable Area */}
      <div
        className="flex-1 overflow-auto p-4 sm:p-6 flex flex-col items-center relative bg-slate-900/90 scroll-smooth"
        style={{ userSelect: isAreaModeActive ? 'none' : 'text' }}
      >
        {/* PDF Security Watermark Badge */}
        {pdfUrl && (
          <div
            className={`absolute ${WATERMARK_POSITIONS[watermarkPosIndex]} pointer-events-none z-30 opacity-25 select-none font-mono text-[9.5px] sm:text-[10.5px] text-slate-800 dark:text-slate-200 bg-white/80 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 px-3 py-1 rounded-full shadow-sm backdrop-blur-md flex items-center gap-1.5 transition-all duration-700 ease-in-out`}
          >
            <span>🔒 E-Learn Academy • {user?.email || 'Unknown User'}</span>
            <span className="text-slate-400">•</span>
            <span>ID: {user?.id || user?.userId || 'N/A'}</span>
          </div>
        )}

        {/* Trạng thái không có PDF URL */}
        {!pdfUrl && (
          <div className="my-auto flex flex-col items-center justify-center p-8 bg-slate-950/80 border border-slate-800 rounded-2xl max-w-md text-center">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 text-2xl mb-3 shadow-lg">
              <FiInfo />
            </div>
            <h4 className="text-sm font-bold text-white mb-1">Tài liệu bài học chưa được tải lên</h4>
            <p className="text-xs text-slate-400">Giảng viên chưa cập nhật tệp tài liệu PDF cho bài học này.</p>
          </div>
        )}

        {/* Loading State */}
        {pdfUrl && loading && (
          <div className="my-auto flex flex-col items-center justify-center p-8 text-center gap-4">
            <div className="w-10 h-10 border-4 border-slate-700 border-t-rose-500 rounded-full animate-spin"></div>
            <span className="text-xs font-semibold text-slate-300">Đang chuẩn bị hiển thị tài liệu PDF...</span>
          </div>
        )}

        {/* Error State */}
        {pdfUrl && error && !loading && (
          <div className="my-auto flex flex-col items-center justify-center p-8 bg-slate-950/80 border border-rose-500/30 rounded-2xl max-w-md text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/40 flex items-center justify-center text-rose-400 text-2xl mb-3 shadow-lg">
              <FiAlertTriangle />
            </div>
            <h4 className="text-sm font-bold text-white mb-1">Không thể tải tài liệu PDF</h4>
            <p className="text-xs text-slate-400 mb-4">{error}</p>
            <button
              type="button"
              onClick={handleRetryLoad}
              className="px-4 py-2 bg-smart-indigo hover:bg-indigo-600 text-white font-bold text-xs rounded-xl flex items-center gap-2 transition-all active:scale-95 cursor-pointer shadow-md"
            >
              <FiRefreshCw />
              <span>Thử tải lại</span>
            </button>
          </div>
        )}

        {/* PDF Pages Rendering */}
        {pdfUrl && (
          <Document
            key={`doc_retry_${documentRetryKey}_${pdfUrl}`}
            file={pdfUrl}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading={null}
            className="flex flex-col items-center gap-6"
          >
            {viewMode === 'continuous' ? (
              // Continuous Scroll: Render all pages
              Array.from(new Array(numPages || 0), (_, index) => {
                const pNum = index + 1;
                const isCurrentDraggingPage = dragState && dragState.pageNumber === pNum;

                let dragBox = null;
                if (isCurrentDraggingPage) {
                  const minX = Math.min(dragState.startX, dragState.currentX) - dragState.pageRect.left;
                  const minY = Math.min(dragState.startY, dragState.currentY) - dragState.pageRect.top;
                  const w = Math.abs(dragState.currentX - dragState.startX);
                  const h = Math.abs(dragState.currentY - dragState.startY);
                  dragBox = { minX, minY, w, h };
                }

                return (
                  <div
                    key={`page_${pNum}`}
                    data-page-number={pNum}
                    ref={(el) => (pageRefs.current[pNum] = el)}
                    onPointerDown={(e) => handlePagePointerDown(pNum, e)}
                    className={`relative bg-white shadow-2xl rounded-sm overflow-hidden transition-transform duration-200 border border-slate-200 ${
                      isAreaModeActive ? 'cursor-crosshair' : ''
                    }`}
                    style={{ userSelect: isAreaModeActive ? 'none' : 'text' }}
                  >
                    <Page
                      pageNumber={pNum}
                      scale={scale}
                      renderTextLayer={!isAreaModeActive}
                      renderAnnotationLayer={true}
                    />
                    <PdfHighlightOverlay
                      pageNumber={pNum}
                      notes={notes}
                      selectedNoteId={selectedNoteId}
                      activeGlowNoteId={activeGlowNoteId}
                      onSelectNote={onSelectNote}
                    />

                    {/* Live Dragging Rectangle */}
                    {dragBox && dragBox.w > 2 && dragBox.h > 2 && (
                      <div
                        className="absolute pointer-events-none z-30 bg-indigo-500/25 border-2 border-indigo-500 rounded-md shadow-md"
                        style={{
                          left: `${dragBox.minX}px`,
                          top: `${dragBox.minY}px`,
                          width: `${dragBox.w}px`,
                          height: `${dragBox.h}px`
                        }}
                      />
                    )}
                  </div>
                );
              })
            ) : (
              // Single Page Mode
              <div
                key={`single_page_${currentPage}`}
                data-page-number={currentPage}
                ref={(el) => (pageRefs.current[currentPage] = el)}
                onPointerDown={(e) => handlePagePointerDown(currentPage, e)}
                className={`relative bg-white shadow-2xl rounded-sm overflow-hidden transition-transform duration-200 border border-slate-200 ${
                  isAreaModeActive ? 'cursor-crosshair' : ''
                }`}
                style={{ userSelect: isAreaModeActive ? 'none' : 'text' }}
              >
                <Page
                  pageNumber={currentPage}
                  scale={scale}
                  renderTextLayer={!isAreaModeActive}
                  renderAnnotationLayer={true}
                />
                <PdfHighlightOverlay
                  pageNumber={currentPage}
                  notes={notes}
                  selectedNoteId={selectedNoteId}
                  activeGlowNoteId={activeGlowNoteId}
                  onSelectNote={onSelectNote}
                />

                {/* Live Dragging Rectangle for Single Page */}
                {dragState && dragState.pageNumber === currentPage && (
                  (() => {
                    const minX = Math.min(dragState.startX, dragState.currentX) - dragState.pageRect.left;
                    const minY = Math.min(dragState.startY, dragState.currentY) - dragState.pageRect.top;
                    const w = Math.abs(dragState.currentX - dragState.startX);
                    const h = Math.abs(dragState.currentY - dragState.startY);
                    if (w < 2 || h < 2) return null;
                    return (
                      <div
                        className="absolute pointer-events-none z-30 bg-indigo-500/25 border-2 border-indigo-500 rounded-md shadow-md"
                        style={{
                          left: `${minX}px`,
                          top: `${minY}px`,
                          width: `${w}px`,
                          height: `${h}px`
                        }}
                      />
                    );
                  })()
                )}
              </div>
            )}
          </Document>
        )}

        {/* 3. Floating Selection Popover (Text & Area Modes) */}
        {selectionState && (
          <PdfSelectionPopover
            clientRect={selectionState.clientRect}
            selectionType={selectionState.selectionType || 'text'}
            pageNumber={selectionState.pageNumber || currentPage}
            selectedText={selectionState.selectedText || ''}
            onSave={handleSaveNote}
            onCancel={handleCancelSelection}
          />
        )}
      </div>

      {/* 4. Global CSS styling for Text Layer selection accessibility */}
      <style>{`
        .pdf-study-viewer .react-pdf__Page__textContent {
          user-select: ${isAreaModeActive ? 'none !important' : 'text !important'};
          cursor: ${isAreaModeActive ? 'crosshair !important' : 'text !important'};
          opacity: 0.25;
          mix-blend-mode: multiply;
          pointer-events: ${isAreaModeActive ? 'none !important' : 'auto'};
        }
        .pdf-study-viewer .react-pdf__Page__textContent span {
          user-select: ${isAreaModeActive ? 'none !important' : 'text !important'};
        }
        .pdf-study-viewer .react-pdf__Page__textContent span::selection {
          background: rgba(59, 130, 246, 0.4) !important;
        }
      `}</style>
    </div>
  );
}
