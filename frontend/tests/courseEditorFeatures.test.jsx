import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CourseEditorLoadingModal from '../src/modules/instructor/components/CourseEditorLoadingModal';
import MaterialPdfPreviewModal from '../src/modules/instructor/components/MaterialPdfPreviewModal';

if (typeof global !== 'undefined' && !global.DOMMatrix) {
  global.DOMMatrix = class DOMMatrix {
    constructor() {
      this.a = 1; this.b = 0; this.c = 0; this.d = 1; this.e = 0; this.f = 0;
    }
  };
}

vi.mock('react-pdf', () => ({
  Document: ({ children, onLoadSuccess }) => {
    React.useEffect(() => {
      onLoadSuccess?.({ numPages: 3 });
    }, [onLoadSuccess]);
    return <div data-testid="mock-pdf-document">{children}</div>;
  },
  Page: ({ pageNumber }) => <div data-testid="mock-pdf-page">Page {pageNumber}</div>,
  pdfjs: {
    GlobalWorkerOptions: { workerSrc: '' }
  }
}));

describe('CourseEditorLoadingModal Component (Impeccable Design)', () => {
  it('does not render anything when isOpen is false', () => {
    const { container } = render(
      <CourseEditorLoadingModal isOpen={false} mode="fetching" />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders fetching mode with accurate title, badge and orbital spinner', () => {
    render(
      <CourseEditorLoadingModal isOpen={true} mode="fetching" />
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Đồng bộ đám mây')).toBeInTheDocument();
    expect(screen.getByText('Đang tải dữ liệu khóa học')).toBeInTheDocument();
    expect(screen.getByText(/Đang đồng bộ cấu trúc chương mục, video bài giảng/i)).toBeInTheDocument();
    expect(screen.getByText('Kết nối máy chủ học viện...')).toBeInTheDocument();
  });

  it('renders saving_draft mode when user saves draft', () => {
    render(
      <CourseEditorLoadingModal isOpen={true} mode="saving_draft" />
    );

    expect(screen.getByText('Lưu nháp an toàn')).toBeInTheDocument();
    expect(screen.getByText('Đang lưu bản nháp khóa học')).toBeInTheDocument();
    expect(screen.getByText(/Lưu trữ an toàn các thay đổi/i)).toBeInTheDocument();
    expect(screen.getByText('Kiểm tra cấu trúc bài giảng...')).toBeInTheDocument();
  });

  it('renders publishing mode when user publishes course', () => {
    render(
      <CourseEditorLoadingModal isOpen={true} mode="publishing" />
    );

    expect(screen.getByText('Kích hoạt khóa học')).toBeInTheDocument();
    expect(screen.getByText('Đang xuất bản khóa học')).toBeInTheDocument();
    expect(screen.getByText(/Kiểm định chất lượng, xác thực media và kích hoạt khóa học/i)).toBeInTheDocument();
    expect(screen.getByText('Kiểm tra chuẩn bản quyền giảng viên...')).toBeInTheDocument();
  });

  it('allows customTitle and customSubtitle overrides', () => {
    render(
      <CourseEditorLoadingModal
        isOpen={true}
        mode="fetching"
        customTitle="Đang khởi tạo bài giảng..."
        customSubtitle="Đang nạp bộ trích xuất PDF..."
      />
    );

    expect(screen.getByText('Đang khởi tạo bài giảng...')).toBeInTheDocument();
    expect(screen.getByText('Đang nạp bộ trích xuất PDF...')).toBeInTheDocument();
  });
});

vi.mock('../src/components/common/Header', () => ({
  default: () => <header data-testid="header">Header</header>
}));

vi.mock('../src/components/common/Footer', () => ({
  default: () => <footer data-testid="footer">Footer</footer>
}));

vi.mock('../src/config/api.config', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn()
  }
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useParams: () => ({ courseId: '37' })
  };
});

import apiClient from '../src/config/api.config';
import CourseEditor from '../src/modules/instructor/pages/CourseEditor';
import { BrowserRouter } from 'react-router-dom';

describe('CourseEditor Curriculum Screen (Replacing Speaking with PDF Materials)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('token', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwicm9sZUlkIjoyfQ.test');

    apiClient.get.mockImplementation((url) => {
      if (url === '/courses/subjects') {
        return Promise.resolve({
          data: { subjects: [{ subject_id: 1, name: 'IELTS Masterclass' }] }
        });
      }
      if (url === '/courses/37') {
        return Promise.resolve({
          data: {
            success: true,
            course: {
              course_id: 37,
              course_name: 'IELTS Intensive 6.5+',
              subject_id: 1,
              status: 'draft',
              sections: [
                {
                  section_id: 10,
                  title: 'Chương 1: 4 chủ đề',
                  lessons: [
                    {
                      lesson_id: 101,
                      title: 'IELTS Listening chủ đề Biology',
                      content_type: 'youtube',
                      content_url: 'https://www.youtube.com/watch?v=KINV60CeJkc',
                      speaking_sentences: '',
                      speaking_questions: '',
                      media_status: 'READY'
                    }
                  ]
                }
              ]
            }
          }
        });
      }
      if (url.includes('/materials')) {
        return Promise.resolve({
          data: {
            success: true,
            materials: [
              {
                id: 501,
                name: 'Biology_Vocabulary_Sheet.pdf',
                url: 'https://example.com/bio.pdf',
                sizeKb: 1200,
                createdAt: '2026-09-01T00:00:00Z'
              }
            ]
          }
        });
      }
      if (url === '/lessons/101/subtitle-status') {
        return Promise.resolve({
          data: {
            success: true,
            data: {
              lessonId: 101,
              status: 'failed',
              code: 'YOUTUBE_NO_CAPTIONS_AVAILABLE',
              message: 'Video YouTube này không có phụ đề công khai. Vui lòng bật auto-caption trên YouTube hoặc tải phụ đề thủ công cho bài học.',
              updatedAt: '2026-09-07T00:00:00.000Z'
            }
          }
        });
      }
      if (url.includes('/quizzes')) {
        return Promise.resolve({
          data: { success: true, quizzes: [] }
        });
      }
      return Promise.resolve({ data: {} });
    });
  });

  it('replaces "Thêm bài tập speaking" with "Tài liệu PDF" in the curriculum lesson toolbar', async () => {
    render(
      <BrowserRouter>
        <CourseEditor />
      </BrowserRouter>
    );

    // Switch to Curriculum tab
    await waitFor(() => {
      expect(screen.getByText(/Chương trình học/i)).toBeInTheDocument();
    });

    const curriculumTab = screen.getByText(/Chương trình học/i);
    fireEvent.click(curriculumTab);

    // Ensure lesson card is rendered
    await waitFor(() => {
      expect(screen.getByDisplayValue('IELTS Listening chủ đề Biology')).toBeInTheDocument();
    });

    // "Thêm bài tập speaking" MUST NOT exist anywhere
    expect(screen.queryByText(/Thêm bài tập speaking/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Ẩn bài tập speaking/i)).not.toBeInTheDocument();

    // "Tài liệu PDF" button MUST exist
    const pdfMaterialsBtn = screen.getByRole('button', { name: /Tài liệu PDF/i });
    expect(pdfMaterialsBtn).toBeInTheDocument();

    // Click to expand PDF Materials panel
    fireEvent.click(pdfMaterialsBtn);

    // Verify panel header and controls
    expect(screen.getByText(/Tài liệu học tập & Slide PDF đính kèm/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Tải lên tài liệu PDF|Chọn tệp PDF/i })).toBeInTheDocument();
    expect(screen.getByText('Biology_Vocabulary_Sheet.pdf')).toBeInTheDocument();
    expect(screen.getByText(/1200 KB/i)).toBeInTheDocument();

    // Verify uploaded material has delete button and does NOT have "Xem trước" (đã xóa sau khi upload)
    expect(screen.getByTitle(/Xóa tài liệu này khỏi bài học/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Xem trước/i })).not.toBeInTheDocument();

    // Select a new PDF file (Chưa upload)
    const fileInput = document.querySelector('input[type="file"][accept="application/pdf"]');
    const mockStagedFile = new File(['%PDF-1.4 test'], 'New_Staged_Doc.pdf', { type: 'application/pdf' });
    mockStagedFile.arrayBuffer = vi.fn().mockResolvedValue(new ArrayBuffer(32));
    fireEvent.change(fileInput, { target: { files: [mockStagedFile] } });

    // Verify Staged Card appears with "Tải tài liệu" and "Xem trước"
    expect(screen.getByText('New_Staged_Doc.pdf')).toBeInTheDocument();
    expect(screen.getByText(/Tài liệu vừa chọn/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Tải tài liệu/i })).toBeInTheDocument();

    const previewBtn = screen.getByRole('button', { name: /Xem trước/i });
    expect(previewBtn).toBeInTheDocument();
    fireEvent.click(previewBtn);

    // Verify In-App Modal is rendered
    expect(screen.getByRole('dialog', { hidden: true })).toBeInTheDocument();
    expect(screen.getByText('Định dạng PDF')).toBeInTheDocument();

    // Verify close button closes the modal
    const closeBtn = screen.getByRole('button', { name: /Đóng cửa sổ xem trước/i });
    expect(closeBtn).toBeInTheDocument();
    fireEvent.click(closeBtn);
  });

  it('shows instructors the actionable YouTube public-caption failure', async () => {
    render(
      <BrowserRouter>
        <CourseEditor />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Chương trình học/i)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText(/Chương trình học/i));

    const statusTitle = await screen.findByText('Video chưa có phụ đề công khai');
    expect(statusTitle.closest('[role="status"]')).toHaveAttribute('aria-live', 'polite');
    expect(
      screen.getByText('Bật auto-caption trên YouTube hoặc tải phụ đề thủ công cho bài học.')
    ).toBeInTheDocument();
  });

  it('handles local PDF file (chưa upload) using URL.createObjectURL and URL.revokeObjectURL', async () => {
    const createObjectURLMock = vi.fn().mockReturnValue('blob:http://localhost:3001/mock-uuid');
    const revokeObjectURLMock = vi.fn();
    window.URL.createObjectURL = createObjectURLMock;
    window.URL.revokeObjectURL = revokeObjectURLMock;

    const mockFile = new File(['%PDF-1.4 mock content'], 'Draft_Unit_Lesson.pdf', {
      type: 'application/pdf'
    });
    mockFile.arrayBuffer = vi.fn().mockResolvedValue(new ArrayBuffer(64));

    const onClose = vi.fn();
    const { unmount } = render(
      <MaterialPdfPreviewModal
        isOpen={true}
        file={mockFile}
        title="Draft_Unit_Lesson.pdf"
        sizeKb={15}
        onClose={onClose}
      />
    );

    // Verify createObjectURL called with file
    expect(createObjectURLMock).toHaveBeenCalledWith(mockFile);
    expect(screen.getByText('Draft_Unit_Lesson.pdf')).toBeInTheDocument();
    expect(screen.getByText('Tệp cục bộ (Chưa upload)')).toBeInTheDocument();

    // Verify separate Download button exists
    const downloadBtn = screen.getByRole('button', { name: /Tải xuống tệp PDF/i });
    expect(downloadBtn).toBeInTheDocument();

    // Verify revokeObjectURL called on unmount
    unmount();
    expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:http://localhost:3001/mock-uuid');
  });

  it('renders remote PDF, provides pagination & zoom, and separate download button', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(128))
    });

    const onClose = vi.fn();
    const onDownload = vi.fn();

    render(
      <MaterialPdfPreviewModal
        isOpen={true}
        pdfUrl="http://localhost:5000/api/lessons/1/materials/10/preview?stream=true"
        title="Official_Grammar_Guide.pdf"
        sizeKb={256}
        onClose={onClose}
        onDownload={onDownload}
      />
    );

    // Verify remote PDF fetched
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('preview?stream=true'),
        expect.any(Object)
      );
    });

    expect(screen.getByText('Official_Grammar_Guide.pdf')).toBeInTheDocument();
    expect(screen.getByText('Xem trực tiếp an toàn')).toBeInTheDocument();

    // Verify pagination and zoom controls
    await waitFor(() => {
      expect(screen.getByText(/Trang 1 \/ 3/i)).toBeInTheDocument();
    });

    // Verify clicking download button triggers onDownload
    const downloadBtn = screen.getByRole('button', { name: /Tải xuống tệp PDF/i });
    expect(downloadBtn).toBeInTheDocument();
    fireEvent.click(downloadBtn);
    expect(onDownload).toHaveBeenCalledTimes(1);
  });
});
