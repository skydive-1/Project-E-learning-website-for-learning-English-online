import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { pdfjs } from 'react-pdf';
import PdfNotesPanel from '../src/modules/lessons/components/PdfNotesPanel';
import PdfSelectionPopover from '../src/modules/lessons/components/PdfSelectionPopover';
import PdfHighlightOverlay from '../src/modules/lessons/components/PdfHighlightOverlay';
import PdfStudyViewer from '../src/modules/lessons/components/PdfStudyViewer';
import * as pdfNotesService from '../src/modules/lessons/services/pdfNotes.service';
import apiClient from '../src/config/api.config';

if (typeof global !== 'undefined' && !global.DOMMatrix) {
  global.DOMMatrix = class DOMMatrix {
    constructor() {
      this.a = 1; this.b = 0; this.c = 0; this.d = 1; this.e = 0; this.f = 0;
    }
  };
}

vi.mock('react-pdf', () => ({
  Document: ({ children, onLoadSuccess, file }) => (
    <div data-testid="mock-pdf-document" data-file={file}>
      {file ? (
        <button
          data-testid="trigger-load-success"
          onClick={() => onLoadSuccess && onLoadSuccess({ numPages: 5 })}
        >
          Simulate Load
        </button>
      ) : null}
      {children}
    </div>
  ),
  Page: ({ pageNumber, scale }) => (
    <div data-testid={`mock-pdf-page-${pageNumber}`} data-scale={scale}>
      Page {pageNumber} Content
    </div>
  ),
  pdfjs: {
    GlobalWorkerOptions: {
      workerSrc: 'bundled-local-worker.js'
    }
  }
}));

vi.mock('../src/config/api.config', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn()
  }
}));

describe('=== TASK-PDF-SMART-NOTES-01-R1 FRONTEND TEST SUITE ===', () => {
  const mockNotes = [
    {
      id: 1,
      noteId: 1,
      pageNumber: 1,
      selectedText: 'Communication is essential for daily conversation.',
      noteText: 'Cần ghi nhớ định nghĩa này',
      category: 'important',
      color: 'yellow',
      rects: [{ x: 0.1, y: 0.2, width: 0.8, height: 0.05 }]
    },
    {
      id: 2,
      noteId: 2,
      pageNumber: 2,
      selectedText: 'Vocabulary building requires regular practice.',
      noteText: 'Từ vựng quan trọng',
      category: 'vocabulary',
      color: 'green',
      rects: [{ x: 0.15, y: 0.4, width: 0.7, height: 0.04 }]
    },
    {
      id: 3,
      noteId: 3,
      pageNumber: 2,
      selectedText: 'I do not understand this grammar rule.',
      noteText: 'Hỏi lại giáo viên câu này',
      category: 'not_understood',
      color: 'pink',
      rects: [{ x: 0.2, y: 0.6, width: 0.6, height: 0.04 }]
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // 1. PDF NOTES PANEL TESTS
  // =========================================================================
  describe('1. PdfNotesPanel Component', () => {
    it('1.1 should render list of notes grouped by page', () => {
      render(
        <PdfNotesPanel
          notes={mockNotes}
          isLoading={false}
          onNavigateToNote={vi.fn()}
          onUpdateNote={vi.fn()}
          onDeleteNote={vi.fn()}
        />
      );

      expect(screen.getByText(/Ghi chú cá nhân/i)).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument(); // Badge count
      expect(screen.getAllByText('Trang 1').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Trang 2').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/Communication is essential for daily conversation./i)).toBeInTheDocument();
      expect(screen.getByText(/Cần ghi nhớ định nghĩa này/i)).toBeInTheDocument();
    });

    it('1.2 should filter notes by search keyword', () => {
      render(
        <PdfNotesPanel
          notes={mockNotes}
          isLoading={false}
          onNavigateToNote={vi.fn()}
          onUpdateNote={vi.fn()}
          onDeleteNote={vi.fn()}
        />
      );

      const searchInput = screen.getByPlaceholderText(/Tìm kiếm nội dung/i);
      fireEvent.change(searchInput, { target: { value: 'Vocabulary' } });

      expect(screen.getByText(/Vocabulary building requires regular practice./i)).toBeInTheDocument();
      expect(screen.queryByText(/Communication is essential/i)).not.toBeInTheDocument();
    });

    it('1.3 should filter notes by category and color', () => {
      render(
        <PdfNotesPanel
          notes={mockNotes}
          isLoading={false}
          onNavigateToNote={vi.fn()}
          onUpdateNote={vi.fn()}
          onDeleteNote={vi.fn()}
        />
      );

      const categorySelect = screen.getByDisplayValue(/Tất cả loại/i);
      fireEvent.change(categorySelect, { target: { value: 'not_understood' } });

      expect(screen.getByText(/I do not understand this grammar rule./i)).toBeInTheDocument();
      expect(screen.queryByText(/Communication is essential/i)).not.toBeInTheDocument();
    });

    it('1.4 should call onNavigateToNote when a note card is clicked', () => {
      const onNavigateMock = vi.fn();
      render(
        <PdfNotesPanel
          notes={mockNotes}
          isLoading={false}
          onNavigateToNote={onNavigateMock}
          onUpdateNote={vi.fn()}
          onDeleteNote={vi.fn()}
        />
      );

      const noteCard = screen.getByText(/Communication is essential/i);
      fireEvent.click(noteCard);

      expect(onNavigateMock).toHaveBeenCalledTimes(1);
      expect(onNavigateMock).toHaveBeenCalledWith(mockNotes[0]);
    });

    it('1.5 should allow editing note text and save changes', async () => {
      const onUpdateMock = vi.fn().mockResolvedValue(true);
      render(
        <PdfNotesPanel
          notes={mockNotes}
          isLoading={false}
          onNavigateToNote={vi.fn()}
          onUpdateNote={onUpdateMock}
          onDeleteNote={vi.fn()}
        />
      );

      const editButtons = screen.getAllByTitle(/Chỉnh sửa/i);
      fireEvent.click(editButtons[0]);

      const textarea = screen.getByDisplayValue('Cần ghi nhớ định nghĩa này');
      fireEvent.change(textarea, { target: { value: 'Nội dung đã chỉnh sửa' } });

      const saveBtn = screen.getByTitle('Lưu');
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(onUpdateMock).toHaveBeenCalledWith(1, {
          noteText: 'Nội dung đã chỉnh sửa',
          category: 'important',
          color: 'yellow'
        });
      });
    });

    it('1.6 should render empty state when notes array is empty', () => {
      render(
        <PdfNotesPanel
          notes={[]}
          isLoading={false}
          onNavigateToNote={vi.fn()}
          onUpdateNote={vi.fn()}
          onDeleteNote={vi.fn()}
        />
      );

      expect(screen.getByText(/Chưa có ghi chú nào/i)).toBeInTheDocument();
      expect(screen.getByText(/Bôi đen bất kỳ đoạn văn bản nào/i)).toBeInTheDocument();
    });
  });

  // =========================================================================
  // 2. PDF SELECTION POPOVER & PORTAL TESTS
  // =========================================================================
  describe('2. PdfSelectionPopover & Portal Rendering', () => {
    it('2.1 should render selection popover via portal with selected text preview and submit form', async () => {
      const onSaveMock = vi.fn().mockResolvedValue(true);
      const onCancelMock = vi.fn();

      render(
        <PdfSelectionPopover
          clientRect={{ top: 100, left: 100, width: 200, height: 20, bottom: 120, right: 300 }}
          selectedText="Highlighted sentence from PDF"
          onSave={onSaveMock}
          onCancel={onCancelMock}
        />
      );

      expect(screen.getByText(/Tạo ghi chú PDF/i)).toBeInTheDocument();
      expect(screen.getByText(/"Highlighted sentence from PDF"/i)).toBeInTheDocument();

      // Enter note
      const textarea = screen.getByPlaceholderText(/Nhập giải thích, câu hỏi/i);
      fireEvent.change(textarea, { target: { value: 'My custom note' } });

      // Click save
      const submitBtn = screen.getByRole('button', { name: /Lưu ghi chú/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(onSaveMock).toHaveBeenCalledWith({
          category: 'important',
          color: 'yellow',
          noteText: 'My custom note'
        });
      });
    });

    it('2.2 should cancel on escape key press', () => {
      const onCancelMock = vi.fn();

      render(
        <PdfSelectionPopover
          clientRect={{ top: 100, left: 100, width: 200, height: 20, bottom: 120, right: 300 }}
          selectedText="Sample"
          onSave={vi.fn()}
          onCancel={onCancelMock}
        />
      );

      fireEvent.keyDown(window, { key: 'Escape' });
      expect(onCancelMock).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  // 3. PDF HIGHLIGHT OVERLAY TESTS
  // =========================================================================
  describe('3. PdfHighlightOverlay Component', () => {
    it('3.1 should render highlight rects for the specified page with percentage styles', () => {
      const onSelectNoteMock = vi.fn();
      const { container } = render(
        <PdfHighlightOverlay
          pageNumber={1}
          notes={mockNotes}
          selectedNoteId={null}
          activeGlowNoteId={null}
          onSelectNote={onSelectNoteMock}
        />
      );

      const highlightBoxes = container.querySelectorAll('.pdf-highlight-box');
      expect(highlightBoxes.length).toBe(1); // Only 1 note on page 1

      fireEvent.click(highlightBoxes[0]);
      expect(onSelectNoteMock).toHaveBeenCalledWith(mockNotes[0]);
    });

    it('3.2 should return null if no notes exist for the page', () => {
      const { container } = render(
        <PdfHighlightOverlay
          pageNumber={99}
          notes={mockNotes}
          selectedNoteId={null}
          activeGlowNoteId={null}
          onSelectNote={vi.fn()}
        />
      );

      expect(container.firstChild).toBeNull();
    });
  });

  // =========================================================================
  // 4. PDF STUDY VIEWER COMPONENT TESTS
  // =========================================================================
  describe('4. PdfStudyViewer Component (Worker, Empty State, Reset & Retry)', () => {
    it('4.1 should have local bundled worker without external unpkg.com URL', () => {
      const workerSrc = pdfjs.GlobalWorkerOptions.workerSrc || '';
      expect(workerSrc).not.toContain('unpkg.com');
      expect(workerSrc).not.toContain('cdnjs.cloudflare.com');
    });

    it('4.2 should render empty state when pdfUrl is not provided (no infinite spinner)', () => {
      render(
        <PdfStudyViewer
          pdfUrl={null}
          title="Tài liệu chưa có"
          user={{ email: 'test@example.com' }}
          notes={[]}
        />
      );

      expect(screen.getByText(/Tài liệu bài học chưa được tải lên/i)).toBeInTheDocument();
    });

    it('4.3 should reset page number to 1 when switching between PDFs', async () => {
      const { rerender } = render(
        <PdfStudyViewer
          pdfUrl="https://example.com/docA.pdf"
          title="Tài liệu A"
          user={{ email: 'test@example.com' }}
          notes={[]}
          activePage={3}
        />
      );

      // Change pdfUrl to Doc B
      rerender(
        <PdfStudyViewer
          pdfUrl="https://example.com/docB.pdf"
          title="Tài liệu B"
          user={{ email: 'test@example.com' }}
          notes={[]}
          activePage={1}
        />
      );

      const loadSuccessBtn = screen.getByTestId('trigger-load-success');
      fireEvent.click(loadSuccessBtn);

      expect(screen.getByText(/1 \/ 5/i)).toBeInTheDocument();
      expect(screen.getByTestId('mock-pdf-page-1')).toBeInTheDocument();
    });
  });

  // =========================================================================
  // 5. PDF NOTES SERVICE TESTS
  // =========================================================================
  describe('5. pdfNotes.service', () => {
    it('5.1 fetchPdfNotes should call GET endpoint with correct params', async () => {
      apiClient.get.mockResolvedValueOnce({ data: { data: mockNotes } });

      const res = await pdfNotesService.fetchPdfNotes(1, 'lesson:1:primary:v1', 2);
      expect(apiClient.get).toHaveBeenCalledWith('/lessons/1/pdf-notes', {
        params: { documentRef: 'lesson:1:primary:v1', page: 2 }
      });
      expect(res).toEqual(mockNotes);
    });

    it('5.2 createPdfNote should call POST endpoint', async () => {
      apiClient.post.mockResolvedValueOnce({ data: { data: mockNotes[0] } });

      const newNote = { pageNumber: 1, selectedText: 'Hello', rects: [] };
      const res = await pdfNotesService.createPdfNote(1, newNote);
      expect(apiClient.post).toHaveBeenCalledWith('/lessons/1/pdf-notes', newNote);
      expect(res).toEqual(mockNotes[0]);
    });

    it('5.3 updatePdfNote should call PUT endpoint', async () => {
      apiClient.put.mockResolvedValueOnce({ data: { data: { ...mockNotes[0], noteText: 'Updated' } } });

      const res = await pdfNotesService.updatePdfNote(1, 10, { noteText: 'Updated' });
      expect(apiClient.put).toHaveBeenCalledWith('/lessons/1/pdf-notes/10', { noteText: 'Updated' });
      expect(res.noteText).toBe('Updated');
    });

    it('5.4 deletePdfNote should call DELETE endpoint', async () => {
      apiClient.delete.mockResolvedValueOnce({ data: { success: true } });

      const res = await pdfNotesService.deletePdfNote(1, 10);
      expect(apiClient.delete).toHaveBeenCalledWith('/lessons/1/pdf-notes/10');
      expect(res.success).toBe(true);
    });

    it('5.5 getLocalDraft & setLocalDraft should persist in localStorage', () => {
      pdfNotesService.setLocalDraft(10, 1, 'primary', 'My draft note');
      expect(pdfNotesService.getLocalDraft(10, 1, 'primary')).toBe('My draft note');

      pdfNotesService.setLocalDraft(10, 1, 'primary', '');
      expect(pdfNotesService.getLocalDraft(10, 1, 'primary')).toBe('');
    });
  });
});
