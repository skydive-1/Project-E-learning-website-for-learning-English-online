import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PdfNotesPanel from '../src/modules/lessons/components/PdfNotesPanel';
import PdfSelectionPopover from '../src/modules/lessons/components/PdfSelectionPopover';
import PdfHighlightOverlay from '../src/modules/lessons/components/PdfHighlightOverlay';
import * as pdfNotesService from '../src/modules/lessons/services/pdfNotes.service';
import apiClient from '../src/config/api.config';

vi.mock('../src/config/api.config', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn()
  }
}));

describe('=== TASK-PDF-SMART-NOTES-01 FRONTEND TEST SUITE ===', () => {
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

    it('1.3 should filter notes by category', () => {
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

      // Click Edit icon on first note
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
  // 2. PDF SELECTION POPOVER TESTS
  // =========================================================================
  describe('2. PdfSelectionPopover Component', () => {
    it('2.1 should render selection popover with selected text preview and submit form', async () => {
      const onSaveMock = vi.fn().mockResolvedValue(true);
      const onCancelMock = vi.fn();

      render(
        <PdfSelectionPopover
          position={{ top: 100, left: 100, width: 200, height: 20 }}
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
          position={{ top: 100, left: 100, width: 200, height: 20 }}
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
    it('3.1 should render highlight rects for the specified page', () => {
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
  // 4. PDF NOTES SERVICE TESTS
  // =========================================================================
  describe('4. pdfNotes.service', () => {
    it('4.1 fetchPdfNotes should call GET endpoint with correct params', async () => {
      apiClient.get.mockResolvedValueOnce({ data: { data: mockNotes } });

      const res = await pdfNotesService.fetchPdfNotes(1, 'lesson:1:primary', 2);
      expect(apiClient.get).toHaveBeenCalledWith('/lessons/1/pdf-notes', {
        params: { documentRef: 'lesson:1:primary', page: 2 }
      });
      expect(res).toEqual(mockNotes);
    });

    it('4.2 createPdfNote should call POST endpoint', async () => {
      apiClient.post.mockResolvedValueOnce({ data: { data: mockNotes[0] } });

      const newNote = { pageNumber: 1, selectedText: 'Hello', rects: [] };
      const res = await pdfNotesService.createPdfNote(1, newNote);
      expect(apiClient.post).toHaveBeenCalledWith('/lessons/1/pdf-notes', newNote);
      expect(res).toEqual(mockNotes[0]);
    });

    it('4.3 getLocalDraft & setLocalDraft should persist in localStorage', () => {
      pdfNotesService.setLocalDraft(10, 1, 'primary', 'My draft note');
      expect(pdfNotesService.getLocalDraft(10, 1, 'primary')).toBe('My draft note');

      pdfNotesService.setLocalDraft(10, 1, 'primary', '');
      expect(pdfNotesService.getLocalDraft(10, 1, 'primary')).toBe('');
    });
  });
});
