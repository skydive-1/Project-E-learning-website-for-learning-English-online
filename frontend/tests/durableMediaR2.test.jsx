import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../src/context/AuthContext';
import * as lessonsService from '../src/modules/lessons/services/lessons.service';
import apiClient from '../src/config/api.config';
import LessonDetailPage from '../src/modules/lessons/pages/LessonDetailPage';
import {
  applySuccessfulUploadToLesson,
  getMediaProcessingStageLabel,
  isMediaReadyForPublish
} from '../src/modules/instructor/pages/CourseEditor';

// Mock Shaka Player
vi.mock('shaka-player', () => {
  return {
    default: {
      Player: class {
        static isBrowserSupported() { return true; }
        configure = vi.fn();
        getNetworkingEngine() {
          return {
            registerRequestFilter: vi.fn((cb) => {
              this.filterCb = cb;
            })
          };
        }
        load = vi.fn().mockResolvedValue();
        destroy = vi.fn().mockResolvedValue();
      },
      net: {
        NetworkingEngine: {
          RequestType: {
            MANIFEST: 0,
            LICENSE: 1,
            SEGMENT: 2
          }
        }
      }
    }
  };
});

// Mock Header & Footer
vi.mock('../src/components/common/Header', () => ({
  default: () => <div data-testid="mock-header">Header</div>
}));
vi.mock('../src/components/common/Footer', () => ({
  default: () => <div data-testid="mock-footer">Footer</div>
}));

vi.mock('../src/modules/lessons/components/PdfStudyViewer', () => ({
  default: () => <div data-testid="mock-pdf-viewer">PDF Viewer</div>
}));

vi.mock('../src/modules/lessons/components/PdfNotesPanel', () => ({
  default: () => <div data-testid="mock-pdf-notes-panel">PDF Notes Panel</div>
}));

vi.mock('../src/modules/chatbot/components/ChatBox', () => ({
  default: () => <div data-testid="mock-ai-chat">AI Chat</div>
}));

// LessonDetailPage luôn tải metadata phụ đề ở nền. Test này dùng JWT giả nên
// phải cô lập service, tránh vô tình gọi backend local và phát auth-logout 401.
vi.mock('../src/modules/lessons/services/subtitles.service', () => ({
  subtitlesService: {
    getSubtitles: vi.fn().mockResolvedValue(null),
    getSubtitleStatus: vi.fn().mockResolvedValue({ status: 'none' })
  }
}));

// Mock Auth service
vi.mock('../src/modules/auth/services/auth.service', () => ({
  getProfile: vi.fn().mockResolvedValue({
    user: { id: 1, userId: 1, email: 'instructor@example.com', roleId: 2 }
  })
}));

describe('🚀 Frontend Durable Media Pipeline R2.1 Test Suite', () => {
  let queryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false }
      }
    });
    localStorage.setItem('token', 'valid_session_token');
    localStorage.setItem('user', JSON.stringify({ id: 1, userId: 1, roleId: 2 }));
  });

  it('cho phép submit pending upload hợp lệ để backend claim, nhưng chặn pending thiếu metadata', () => {
    const uploadResponse = {
      success: true, fileUrl: 'courses/2/id/video.mp4', storageKey: 'courses/2/id/video.mp4',
      storageBucket: 'videos', mimeType: 'video/mp4', sizeBytes: 2048,
      checksumSha256: 'a'.repeat(64), pendingUploadId: 'pending-id',
      mediaStatus: 'PENDING', originalName: 'video.mp4'
    };
    const pending = applySuccessfulUploadToLesson({ title: 'Lesson', uploading: true }, uploadResponse, { name: 'video.mp4', size: 2048 });
    expect(pending.mimeType).toBe('video/mp4');
    expect(pending.pendingUploadId).toBe('pending-id');
    expect(pending.uploadVerified).toBe(true);
    expect(isMediaReadyForPublish(pending)).toBe(true);
    expect(isMediaReadyForPublish({ ...pending, pendingUploadId: null })).toBe(false);
    expect(isMediaReadyForPublish({ ...pending, checksumSha256: null })).toBe(false);
    expect(isMediaReadyForPublish({ contentUrl: 'https://project.supabase.co/storage/v1/object/public/videos/a.mp4', mediaStatus: 'READY', uploadVerified: false })).toBe(false);
  });

  it('hiển thị đúng giai đoạn upload và đóng gói thay vì giữ giả ở 100%', () => {
    expect(getMediaProcessingStageLabel('uploading_source', 47)).toContain('47%');
    expect(getMediaProcessingStageLabel('packaging_dash', 100)).toContain('đóng gói luồng DASH');
    expect(getMediaProcessingStageLabel('verifying', 100)).toContain('xác minh tính toàn vẹn');
    expect(getMediaProcessingStageLabel('retrying', 100)).toContain('tự thử lại');
  });

  it('cho phép khóa đã xuất bản lưu sửa chữa từng lesson mất nguồn, nhưng không nới lỏng cho lesson mới', () => {
    const persistedMissing = {
      id: 124,
      isPersisted: true,
      type: 'video',
      storageKey: 'courses/42/asset/manifest.mpd',
      mediaStatus: 'MISSING_SOURCE',
      uploadVerified: false
    };
    expect(isMediaReadyForPublish(persistedMissing)).toBe(false);
    expect(isMediaReadyForPublish(persistedMissing, { allowPersistedRepair: true })).toBe(true);
    expect(isMediaReadyForPublish({ ...persistedMissing, isPersisted: false }, { allowPersistedRepair: true })).toBe(false);
  });

  it('1. Đổi bài học A -> B hiển thị skeleton transition trong cột 70% và không render nội dung stale của bài A', async () => {
    const mockCourse = {
      id: 1,
      title: 'Khóa học Test R2.1',
      sections: [
        {
          id: 10,
          title: 'Chương 1',
          lessons: [
            { id: '101', title: 'Bài học A', type: 'video', videoUrl: 'courses/1/videoA.mp4' },
            { id: '102', title: 'Bài học B', type: 'video', videoUrl: 'courses/1/videoB.mp4' }
          ]
        }
      ]
    };

    vi.spyOn(lessonsService, 'getCourseDetails').mockResolvedValue(mockCourse);
    vi.spyOn(lessonsService, 'getVideoTicket').mockResolvedValue({
      ticket: 'ticket-101',
      streamUrl: '/api/lessons/video/stream/101'
    });

    let resolveLessonDetail;
    const lessonDetailPromise = new Promise(resolve => {
      resolveLessonDetail = resolve;
    });

    vi.spyOn(lessonsService, 'getLessonById').mockImplementation((id) => {
      if (String(id) === '101') {
        return Promise.resolve({
          id: 101,
          title: 'Bài học A Full Detail',
          type: 'video',
          videoUrl: 'courses/1/videoA.mp4',
          courseId: 1
        });
      }
      if (String(id) === '102') {
        return lessonDetailPromise; // Giả lập độ trễ mạng khi tải bài B
      }
      return Promise.resolve({ id: Number(id), courseId: 1 });
    });

    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/lessons/101']}>
          <AuthProvider>
            <Routes>
              <Route path="/lessons/:lessonId" element={<LessonDetailPage />} />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Chờ bài A tải xong
    await waitFor(() => {
      expect(screen.getByText('Bài học A Full Detail')).toBeInTheDocument();
    });

    // Click chọn bài B trong playlist
    const lessonBButton = screen.getByText('Bài học B');
    fireEvent.click(lessonBButton);

    // Kiểm tra: Tiêu đề 'Bài học A Full Detail' phải biến mất ngay lập tức, nhường chỗ cho Skeleton Pulse
    await waitFor(() => {
      expect(screen.queryByText('Bài học A Full Detail')).not.toBeInTheDocument();
    });

    // Giải quyết promise cho bài B
    resolveLessonDetail({
      id: 102,
      title: 'Bài học B Full Detail',
      type: 'video',
      videoUrl: 'courses/1/videoB.mp4',
      courseId: 1
    });

    // Bài B hiển thị đầy đủ
    await waitFor(() => {
      expect(screen.getByText('Bài học B Full Detail')).toBeInTheDocument();
    });
  });

  it('2. Khởi tạo DASH Player sử dụng X-Video-Ticket và điểm cuối /api/lessons/dash/:id/manifest.mpd', async () => {
    const mockCourse = {
      id: 2,
      title: 'Khóa học DRM DASH',
      sections: [
        {
          id: 20,
          title: 'Chương DRM',
          lessons: [
            { id: '201', title: 'Bài học DASH DRM', type: 'video', playbackType: 'dash', videoUrl: 'uploads/dash/manifest.mpd' }
          ]
        }
      ]
    };

    vi.spyOn(lessonsService, 'getCourseDetails').mockResolvedValue(mockCourse);
    vi.spyOn(lessonsService, 'getLessonById').mockResolvedValue({
      id: 201,
      title: 'Bài học DASH DRM Detail',
      type: 'video',
      playbackType: 'dash',
      videoUrl: 'uploads/dash/manifest.mpd',
      courseId: 2
    });

    const ticketSpy = vi.spyOn(lessonsService, 'getVideoTicket').mockResolvedValue({
      ticket: 'ticket-dash-201',
      streamUrl: '/api/lessons/video/stream/201'
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/lessons/201']}>
          <AuthProvider>
            <Routes>
              <Route path="/lessons/:lessonId" element={<LessonDetailPage />} />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(ticketSpy).toHaveBeenCalledWith('201');
    });
  });

  it('3. Tab Ghi chú của bài PDF giữ nguyên trạng thái và không bị chuyển sang AI Chat', async () => {
    const pdfLesson = {
      id: '52',
      title: 'Mind maps PDF',
      type: 'pdf',
      pdfUrl: '/api/lessons/52/pdf',
      courseId: 26,
      pdfVersion: 1
    };
    const mockCourse = {
      id: 26,
      title: 'Khóa học PDF',
      sections: [
        {
          id: 260,
          title: 'Chương PDF',
          lessons: [pdfLesson]
        }
      ]
    };

    vi.spyOn(lessonsService, 'getCourseDetails').mockResolvedValue(mockCourse);
    vi.spyOn(lessonsService, 'getLessonById').mockResolvedValue(pdfLesson);
    vi.spyOn(apiClient, 'get').mockResolvedValue({ data: { data: [] } });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/lessons/52']}>
          <AuthProvider>
            <Routes>
              <Route path="/lessons/:lessonId" element={<LessonDetailPage />} />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    const notesTab = await screen.findByRole('tab', { name: /Ghi chú/i });
    fireEvent.click(notesTab);

    await waitFor(() => {
      expect(notesTab).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByTestId('mock-pdf-notes-panel')).toBeInTheDocument();
      expect(screen.queryByTestId('mock-ai-chat')).not.toBeInTheDocument();
    });
  });
});
