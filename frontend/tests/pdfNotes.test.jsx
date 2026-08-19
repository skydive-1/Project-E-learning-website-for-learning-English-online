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
    <div
      data-testid={`mock-pdf-page-${pageNumber}`}
      className="react-pdf__Page"
      data-page-number={pageNumber}
      data-scale={scale}
      style={{ width: '600px', height: '800px' }}
    >
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

describe('=== TASK-PDF-SMART-NOTES-03 FRONTEND TEST SUITE ===', () => {
  const mockNotes = [
    {
      id: 1,
      noteId: 1,
      pageNumber: 1,
      selectionType: 'text',
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
      selectionType: 'text',
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
      selectionType: 'area',
      selectedText: null,
      noteText: 'Phần sơ đồ cấu trúc câu này cần xem lại',
      category: 'not_understood',
      color: 'pink',
      rects: [{ x: 0.2, y: 0.6, width: 0.6, height: 0.15 }]
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // 1. PDF NOTES PANEL TESTS
  // =========================================================================
  describe('1. PdfNotesPanel Component (Area Notes & Button)', () => {
    it('1.1 should render list of notes including both Text Notes and Area Notes without null/undefined leak', () => {
      render(
        <PdfNotesPanel
          notes={mockNotes}
          isLoading={false}
          onTriggerAreaSelection={vi.fn()}
          onNavigateToNote={vi.fn()}
          onUpdateNote={vi.fn()}
          onDeleteNote={vi.fn()}
        />
      );

      expect(screen.getByText(/Ghi chú cá nhân/i)).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.getByText(/Communication is essential for daily conversation./i)).toBeInTheDocument();
      expect(screen.getByText(/Ghi chú vùng • Trang 2/i)).toBeInTheDocument();
      expect(screen.getByText(/Phần sơ đồ cấu trúc câu này cần xem lại/i)).toBeInTheDocument();
      expect(screen.queryByText(/null/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/undefined/i)).not.toBeInTheDocument();
    });

    it('1.2 should display "＋ Thêm ghi chú" button and trigger callback when clicked', () => {
      const onTriggerMock = vi.fn();
      render(
        <PdfNotesPanel
          notes={mockNotes}
          isLoading={false}
          onTriggerAreaSelection={onTriggerMock}
          onNavigateToNote={vi.fn()}
          onUpdateNote={vi.fn()}
          onDeleteNote={vi.fn()}
        />
      );

      const addBtn = screen.getByRole('button', { name: /Thêm ghi chú vùng/i });
      expect(addBtn).toBeInTheDocument();
      fireEvent.click(addBtn);
      expect(onTriggerMock).toHaveBeenCalledTimes(1);
    });

    it('1.3 should render Empty State with "＋ Thêm ghi chú" button when notes array is empty', () => {
      const onTriggerMock = vi.fn();
      render(
        <PdfNotesPanel
          notes={[]}
          isLoading={false}
          onTriggerAreaSelection={onTriggerMock}
          onNavigateToNote={vi.fn()}
          onUpdateNote={vi.fn()}
          onDeleteNote={vi.fn()}
        />
      );

      expect(screen.getByText(/Chưa có ghi chú/i)).toBeInTheDocument();
      expect(screen.getByText(/Bôi đen văn bản hoặc khoanh vùng bất kỳ trên PDF/i)).toBeInTheDocument();

      const addBtns = screen.getAllByRole('button', { name: /Thêm ghi chú vùng/i });
      expect(addBtns.length).toBe(2);
      fireEvent.click(addBtns[1]);
      expect(onTriggerMock).toHaveBeenCalledTimes(1);
    });

    it('1.4 should filter notes by search keyword across both text and area notes', () => {
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
      fireEvent.change(searchInput, { target: { value: 'sơ đồ' } });

      expect(screen.getByText(/Phần sơ đồ cấu trúc câu này cần xem lại/i)).toBeInTheDocument();
      expect(screen.queryByText(/Communication is essential/i)).not.toBeInTheDocument();
    });
  });

  // =========================================================================
  // 2. PDF SELECTION POPOVER TESTS
  // =========================================================================
  describe('2. PdfSelectionPopover Component (Area & Text & Scroll Dismiss)', () => {
    it('2.1 Area Note: should display area header and require noteText before submission', async () => {
      const onSaveMock = vi.fn().mockResolvedValue(true);
      const onCancelMock = vi.fn();

      render(
        <PdfSelectionPopover
          clientRect={{ top: 100, left: 100, width: 200, height: 100, bottom: 200, right: 300 }}
          selectionType="area"
          pageNumber={2}
          selectedText={null}
          onSave={onSaveMock}
          onCancel={onCancelMock}
        />
      );

      expect(screen.getByText(/Tạo ghi chú vùng/i)).toBeInTheDocument();
      expect(screen.getByText(/Vùng đã chọn • Trang 2/i)).toBeInTheDocument();

      const submitBtn = screen.getByRole('button', { name: /Lưu ghi chú/i });
      fireEvent.click(submitBtn);

      expect(screen.getByText(/Vui lòng nhập nội dung ghi chú cho vùng đã chọn/i)).toBeInTheDocument();
      expect(onSaveMock).not.toHaveBeenCalled();

      const textarea = screen.getByPlaceholderText(/Nhập ghi chú cho vùng vừa khoanh/i);
      fireEvent.change(textarea, { target: { value: 'Ghi chú sơ đồ hình ảnh' } });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(onSaveMock).toHaveBeenCalledWith({
          category: 'important',
          color: 'yellow',
          noteText: 'Ghi chú sơ đồ hình ảnh',
          selectionType: 'area'
        });
      });
    });

    it('2.2 Text Note: should display selectedText quote', async () => {
      const onSaveMock = vi.fn().mockResolvedValue(true);

      render(
        <PdfSelectionPopover
          clientRect={{ top: 100, left: 100, width: 200, height: 20, bottom: 120, right: 300 }}
          selectionType="text"
          pageNumber={1}
          selectedText="Important grammatical term"
          onSave={onSaveMock}
          onCancel={vi.fn()}
        />
      );

      expect(screen.getByText(/"Important grammatical term"/i)).toBeInTheDocument();
    });

    it('2.3 should cancel on escape key press', () => {
      const onCancelMock = vi.fn();

      render(
        <PdfSelectionPopover
          clientRect={{ top: 100, left: 100, width: 200, height: 20, bottom: 120, right: 300 }}
          selectionType="area"
          pageNumber={1}
          onSave={vi.fn()}
          onCancel={onCancelMock}
        />
      );

      fireEvent.keyDown(window, { key: 'Escape' });
      expect(onCancelMock).toHaveBeenCalledTimes(1);
    });

    it('2.4 should close popover on window scroll event', () => {
      const onCancelMock = vi.fn();

      render(
        <PdfSelectionPopover
          clientRect={{ top: 100, left: 100, width: 200, height: 20, bottom: 120, right: 300 }}
          selectionType="area"
          pageNumber={1}
          onSave={vi.fn()}
          onCancel={onCancelMock}
        />
      );

      fireEvent.scroll(window);
      expect(onCancelMock).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  // 3. PDF HIGHLIGHT OVERLAY TESTS
  // =========================================================================
  describe('3. PdfHighlightOverlay Component', () => {
    it('3.1 should render area notes with dashed border and text notes with solid underline', () => {
      const onSelectNoteMock = vi.fn();
      const { container } = render(
        <PdfHighlightOverlay
          pageNumber={2}
          notes={mockNotes}
          selectedNoteId={null}
          activeGlowNoteId={null}
          onSelectNote={onSelectNoteMock}
        />
      );

      const boxes = container.querySelectorAll('.pdf-highlight-box');
      expect(boxes.length).toBe(2);

      fireEvent.click(boxes[1]);
      expect(onSelectNoteMock).toHaveBeenCalledWith(mockNotes[2]);
    });
  });

  // =========================================================================
  // 4. PDF STUDY VIEWER COMPONENT TESTS (Toolbar, Dragging Simulation, Esc)
  // =========================================================================
  describe('4. PdfStudyViewer Component (Toolbar & Area Selection)', () => {
    it('4.1 should render "＋ Thêm ghi chú" button on toolbar and toggle area selection mode', () => {
      const onToggleMock = vi.fn();
      render(
        <PdfStudyViewer
          pdfUrl="https://example.com/document.pdf"
          title="Tài liệu mẫu"
          user={{ email: 'test@example.com' }}
          notes={[]}
          isAreaSelectionMode={false}
          onToggleAreaSelection={onToggleMock}
        />
      );

      const toolbarAddBtn = screen.getByRole('button', { name: /Thêm ghi chú vùng/i });
      expect(toolbarAddBtn).toBeInTheDocument();
      expect(toolbarAddBtn).toHaveAttribute('aria-pressed', 'false');

      fireEvent.click(toolbarAddBtn);
      expect(onToggleMock).toHaveBeenCalledWith(true);
    });

    it('4.2 when isAreaSelectionMode is true, should render floating guide banner', () => {
      render(
        <PdfStudyViewer
          pdfUrl="https://example.com/document.pdf"
          title="Tài liệu mẫu"
          user={{ email: 'test@example.com' }}
          notes={[]}
          isAreaSelectionMode={true}
          onToggleAreaSelection={vi.fn()}
        />
      );

      expect(screen.getByText(/Kéo chuột để khoanh vùng cần ghi chú trên PDF/i)).toBeInTheDocument();
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
  // 5. PDF NOTES SERVICE TESTS (No Forged documentRef)
  // =========================================================================
  describe('5. pdfNotes.service (Backend Canonical Resolution)', () => {
    it('5.1 fetchPdfNotes should call GET endpoint without sending documentRef', async () => {
      apiClient.get.mockResolvedValueOnce({ data: { data: mockNotes } });

      const res = await pdfNotesService.fetchPdfNotes(1, 101, 2);
      expect(apiClient.get).toHaveBeenCalledWith('/lessons/1/pdf-notes', {
        params: { materialId: 101, page: 2 }
      });
      expect(res).toEqual(mockNotes);
    });

    it('5.2 createPdfNote should send area note payload with selectionType = area and selectedText = null', async () => {
      apiClient.post.mockResolvedValueOnce({ data: { data: mockNotes[2] } });

      const newAreaNote = {
        materialId: null,
        pageNumber: 2,
        selectionType: 'area',
        selectedText: null,
        noteText: 'Phần sơ đồ cấu trúc câu này cần xem lại',
        category: 'important',
        color: 'yellow',
        rects: [{ x: 0.2, y: 0.6, width: 0.6, height: 0.15 }],
        contextBefore: '',
        contextAfter: ''
      };

      const res = await pdfNotesService.createPdfNote(1, newAreaNote);
      expect(apiClient.post).toHaveBeenCalledWith('/lessons/1/pdf-notes', newAreaNote);
      expect(res.selectionType).toBe('area');
      expect(res.selectedText).toBeNull();
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
  });
});
