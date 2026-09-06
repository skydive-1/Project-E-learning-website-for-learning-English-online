import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MaterialPdfPreviewModal from '../src/modules/instructor/components/MaterialPdfPreviewModal';

vi.mock('react-pdf', () => ({
  Document: ({ children }) => <div data-testid="mock-pdf-doc">{children}</div>,
  Page: () => <div>Page Mock</div>,
  pdfjs: { GlobalWorkerOptions: {} }
}));

describe('MaterialPdfPreviewModal Download Token Test Suite', () => {
  const MOCK_TOKEN = 'test-token-jwt-pdf-download-456';

  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('1. should include ?token= in anchor link.href when clicking download on protected PDF', () => {
    localStorage.setItem('token', MOCK_TOKEN);
    let createdAnchor = null;
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName, options) => {
      const el = originalCreateElement(tagName, options);
      if (tagName === 'a') {
        createdAnchor = el;
      }
      return el;
    });

    render(
      <MaterialPdfPreviewModal
        isOpen={true}
        pdfUrl="/api/lessons/12/pdf"
        downloadUrl="/api/lessons/12/pdf/download"
        title="Tài liệu mẫu"
        onClose={vi.fn()}
      />
    );

    const downloadBtn = screen.getByRole('button', { name: /Tải xuống/i });
    expect(downloadBtn).toBeInTheDocument();
    fireEvent.click(downloadBtn);

    expect(createdAnchor).not.toBeNull();
    expect(createdAnchor.href).toContain('/api/lessons/12/pdf/download');
    expect(createdAnchor.href).toContain(`token=${MOCK_TOKEN}`);
  });

  it('2. should append ?token= to materials download endpoint when clicked', () => {
    localStorage.setItem('token', MOCK_TOKEN);
    let capturedHref = '';
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName, options) => {
      const el = originalCreateElement(tagName, options);
      if (tagName === 'a') {
        const origClick = el.click.bind(el);
        el.click = () => {
          capturedHref = el.href;
          origClick();
        };
      }
      return el;
    });

    render(
      <MaterialPdfPreviewModal
        isOpen={true}
        pdfUrl="/api/lessons/15/materials/8/preview"
        downloadUrl="/api/lessons/15/materials/8/download"
        title="Tài liệu đính kèm"
        onClose={vi.fn()}
      />
    );

    const downloadBtn = screen.getByRole('button', { name: /Tải xuống/i });
    fireEvent.click(downloadBtn);

    expect(capturedHref).toContain('/api/lessons/15/materials/8/download');
    expect(capturedHref).toContain(`token=${MOCK_TOKEN}`);
  });
});
