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
  FiCheckCircle,
  FiFileText,
  FiLayers
} from 'react-icons/fi';

import PdfHighlightOverlay from './PdfHighlightOverlay';
import PdfSelectionPopover from './PdfSelectionPopover';

// Cấu hình Worker tương thích với Vite & Browser ESM
if (typeof window !== 'undefined' && 'Worker' in window) {
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
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
  onPageChange,
  onCreateNote,
  onSelectNote
}) {
  const [numPages, setNumPages] = useState(null);
  const [currentPage, setCurrentPage] = useState(activePage || 1);
  const [scale, setScale] = useState(1.15); // Zoom 115% mặc định
  const [viewMode, setViewMode] = useState('single'); // 'single' hoặc 'continuous'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [watermarkPosIndex, setWatermarkPosIndex] = useState(0);

  // Selection Popover State
  const [selectionState, setSelectionState] = useState(null);
  // selectionState = { pageNumber, selectedText, rects, contextBefore, contextAfter, position: { top, left, width, height } }

  const containerRef = useRef(null);
  const pageRefs = useRef({});

  // Cập nhật watermark xoay vòng mỗi 25s chống quay lén
  useEffect(() => {
    const timer = setInterval(() => {
      setWatermarkPosIndex((prev) => (prev + 1) % WATERMARK_POSITIONS.length);
    }, 25000);
    return () => clearInterval(timer);
  }, []);

  // Đồng bộ trang khi có trigger chuyển trang từ bên ngoài (ví dụ nhấp note ở sidebar)
  useEffect(() => {
    if (activePage && activePage !== currentPage && numPages && activePage <= numPages) {
      setCurrentPage(activePage);
      if (viewMode === 'continuous' && pageRefs.current[activePage]) {
        pageRefs.current[activePage].scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [activePage, numPages, viewMode]);

  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
    setLoading(false);
    setError(null);
  };

  const onDocumentLoadError = (err) => {
    console.error('Lỗi tải tài liệu PDF:', err);
    setLoading(false);
    setError(err?.message || 'Không thể hiển thị tài liệu PDF. Vui lòng kiểm tra lại đường dẫn tệp.');
  };

  const handleZoomIn = () => setScale((prev) => Math.min(2.0, Number((prev + 0.15).toFixed(2))));
  const handleZoomOut = () => setScale((prev) => Math.max(0.75, Number((prev - 0.15).toFixed(2))));
  const handleFitWidth = () => setScale(1.0);

  const handlePrevPage = () => {
    if (currentPage > 1) {
      const p = currentPage - 1;
      setCurrentPage(p);
      if (onPageChange) onPageChange(p);
    }
  };

  const handleNextPage = () => {
    if (numPages && currentPage < numPages) {
      const p = currentPage + 1;
      setCurrentPage(p);
      if (onPageChange) onPageChange(p);
    }
  };

  /**
   * Bắt sự kiện chọn văn bản trong PDF (Text Selection)
   */
  const handleMouseUp = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
      return;
    }

    const selectedText = selection.toString().trim();
    if (!selectedText || selectedText.length < 2) {
      return;
    }

    const range = selection.getRangeAt(0);

    // Tìm phần tử trang PDF (.react-pdf__Page) chứa vùng chọn
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

    if (clientRects.length === 0 || pageRect.width === 0 || pageRect.height === 0) {
      return;
    }

    // Chuẩn hóa tọa độ theo tỷ lệ trang [0.0 - 1.0]
    const normalizedRects = clientRects.map((r) => ({
      x: Math.max(0, Math.min(1, Number(((r.left - pageRect.left) / pageRect.width).toFixed(4)))),
      y: Math.max(0, Math.min(1, Number(((r.top - pageRect.top) / pageRect.height).toFixed(4)))),
      width: Math.max(0.001, Math.min(1, Number((r.width / pageRect.width).toFixed(4)))),
      height: Math.max(0.001, Math.min(1, Number((r.height / pageRect.height).toFixed(4))))
    })).filter((r) => r.width > 0 && r.height > 0);

    if (normalizedRects.length === 0) return;

    // Vị trí mở popover (tương đối theo container tổng)
    const viewerRect = containerRef.current.getBoundingClientRect();
    const firstRect = clientRects[0];
    const lastRect = clientRects[clientRects.length - 1];

    const popoverPos = {
      top: lastRect.bottom - viewerRect.top + containerRef.current.scrollTop,
      left: firstRect.left - viewerRect.left + containerRef.current.scrollLeft,
      width: firstRect.width,
      height: firstRect.height
    };

    setSelectionState({
      pageNumber: pageNum,
      selectedText,
      rects: normalizedRects,
      contextBefore: '',
      contextAfter: '',
      position: popoverPos
    });
  }, [currentPage]);

  const handleSaveNote = async ({ category, color, noteText }) => {
    if (!selectionState || !onCreateNote) return;

    await onCreateNote({
      pageNumber: selectionState.pageNumber,
      selectedText: selectionState.selectedText,
      noteText,
      category,
      color,
      rects: selectionState.rects,
      contextBefore: selectionState.contextBefore,
      contextAfter: selectionState.contextAfter
    });

    // Clear selection
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
      onTouchEnd={handleMouseUp}
      className="pdf-study-viewer w-full h-full flex flex-col bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl relative select-none"
      style={{ minHeight: '520px' }}
    >
      {/* 1. Thanh điều khiển trên cùng (PDF Toolbar) */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-950/90 backdrop-blur-md border-b border-slate-800 z-30 text-xs text-slate-200">
        {/* Left: Title & Mode */}
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="w-7 h-7 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 font-bold shrink-0">
            <FiFileText />
          </div>
          <span className="font-semibold text-slate-200 truncate max-w-[200px] sm:max-w-xs" title={title}>
            {title}
          </span>
        </div>

        {/* Center: Pagination controls */}
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

        {/* Right: Zoom & View Mode Controls */}
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
            disabled={scale <= 0.75}
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
            title="Khớp chiều rộng (100%)"
          >
            <FiMaximize2 />
          </button>
        </div>
      </div>

      {/* 2. PDF Document Canvas & Overlay Scrollable Area */}
      <div
        className="flex-1 overflow-auto p-4 sm:p-6 flex flex-col items-center relative bg-slate-900/90 scroll-smooth"
        style={{ userSelect: 'text' }}
      >
        {/* PDF Security Watermark Badge */}
        <div
          className={`absolute ${WATERMARK_POSITIONS[watermarkPosIndex]} pointer-events-none z-30 opacity-25 select-none font-mono text-[9.5px] sm:text-[10.5px] text-slate-800 dark:text-slate-200 bg-white/80 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 px-3 py-1 rounded-full shadow-sm backdrop-blur-md flex items-center gap-1.5 transition-all duration-700 ease-in-out`}
        >
          <span>🔒 E-Learn Academy • {user?.email || 'Unknown User'}</span>
          <span className="text-slate-400">•</span>
          <span>ID: {user?.id || user?.userId || 'N/A'}</span>
        </div>

        {/* Diagonal Background Watermark */}
        <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden flex items-center justify-center opacity-5 select-none rotate-[-25deg]">
          <span className="font-mono text-2xl sm:text-3xl font-extrabold text-slate-300 tracking-widest whitespace-nowrap">
            {user?.email || 'Unknown User'} • COPYRIGHT PROTECTED
          </span>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="my-auto flex flex-col items-center justify-center p-8 text-center gap-4">
            <div className="w-10 h-10 border-4 border-slate-700 border-t-rose-500 rounded-full animate-spin"></div>
            <span className="text-xs font-semibold text-slate-300">Đang chuẩn bị hiển thị tài liệu PDF...</span>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="my-auto flex flex-col items-center justify-center p-8 bg-slate-950/80 border border-rose-500/30 rounded-2xl max-w-md text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/40 flex items-center justify-center text-rose-400 text-2xl mb-3 shadow-lg">
              <FiAlertTriangle />
            </div>
            <h4 className="text-sm font-bold text-white mb-1">Không thể tải tài liệu PDF</h4>
            <p className="text-xs text-slate-400 mb-4">{error}</p>
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                setError(null);
              }}
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
                return (
                  <div
                    key={`page_${pNum}`}
                    ref={(el) => (pageRefs.current[pNum] = el)}
                    className="relative bg-white shadow-2xl rounded-sm overflow-hidden transition-transform duration-200 border border-slate-200"
                    style={{ userSelect: 'text' }}
                  >
                    <Page
                      pageNumber={pNum}
                      scale={scale}
                      renderTextLayer={true}
                      renderAnnotationLayer={true}
                    />
                    <PdfHighlightOverlay
                      pageNumber={pNum}
                      notes={notes}
                      selectedNoteId={selectedNoteId}
                      activeGlowNoteId={activeGlowNoteId}
                      onSelectNote={onSelectNote}
                    />
                  </div>
                );
              })
            ) : (
              // Single Page Mode
              <div
                key={`single_page_${currentPage}`}
                className="relative bg-white shadow-2xl rounded-sm overflow-hidden transition-transform duration-200 border border-slate-200"
                style={{ userSelect: 'text' }}
              >
                <Page
                  pageNumber={currentPage}
                  scale={scale}
                  renderTextLayer={true}
                  renderAnnotationLayer={true}
                />
                <PdfHighlightOverlay
                  pageNumber={currentPage}
                  notes={notes}
                  selectedNoteId={selectedNoteId}
                  activeGlowNoteId={activeGlowNoteId}
                  onSelectNote={onSelectNote}
                />
              </div>
            )}
          </Document>
        )}

        {/* 3. Floating Selection Popover */}
        {selectionState && (
          <PdfSelectionPopover
            position={selectionState.position}
            selectedText={selectionState.selectedText}
            onSave={handleSaveNote}
            onCancel={handleCancelSelection}
          />
        )}
      </div>

      {/* 4. Global CSS styling for Text Layer selection accessibility */}
      <style>{`
        .pdf-study-viewer .react-pdf__Page__textContent {
          user-select: text !important;
          cursor: text !important;
          opacity: 0.25;
          mix-blend-mode: multiply;
        }
        .pdf-study-viewer .react-pdf__Page__textContent span {
          user-select: text !important;
        }
        .pdf-study-viewer .react-pdf__Page__textContent span::selection {
          background: rgba(59, 130, 246, 0.4) !important;
        }
      `}</style>
    </div>
  );
}
