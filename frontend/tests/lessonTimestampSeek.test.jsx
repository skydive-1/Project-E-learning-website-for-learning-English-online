import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../src/context/AuthContext';
import * as lessonsService from '../src/modules/lessons/services/lessons.service';
import LessonDetailPage from '../src/modules/lessons/pages/LessonDetailPage';
import LessonYouTubePlayer from '../src/modules/lessons/components/LessonYouTubePlayer';

const shakaLoadMock = vi.fn().mockResolvedValue();

vi.mock('shaka-player', () => {
  return {
    default: {
      Player: class {
        static isBrowserSupported() { return true; }
        configure = vi.fn();
        attach = vi.fn().mockResolvedValue();
        getNetworkingEngine() {
          return {
            registerRequestFilter: vi.fn()
          };
        }
        load = shakaLoadMock;
        destroy = vi.fn().mockResolvedValue();
        addEventListener = vi.fn();
        removeEventListener = vi.fn();
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
vi.mock('../src/modules/lessons/services/subtitles.service', () => ({
  subtitlesService: {
    getSubtitles: vi.fn().mockResolvedValue(null),
    getSubtitleStatus: vi.fn().mockResolvedValue({ status: 'none' })
  }
}));

vi.mock('../src/modules/auth/services/auth.service', () => ({
  getProfile: vi.fn().mockResolvedValue({
    user: { id: 1, userId: 1, email: 'user@example.com', roleId: 2 }
  })
}));

describe('Lesson timestamp seeking across 3 roles and players', () => {
  let queryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false }
      }
    });
    localStorage.setItem('token', 'mock_token');
    localStorage.setItem('user', JSON.stringify({ id: 1, userId: 1, roleId: 2 }));
  });

  it('passes seek parameter as startTime to Shaka Player load when loading DASH lesson', async () => {
    vi.spyOn(lessonsService, 'getLessonById').mockResolvedValue({
      id: 137,
      courseId: 44,
      title: 'Video',
      videoUrl: 'https://r2.example.com/manifest.mpd',
      playbackType: 'dash',
      type: 'video'
    });

    vi.spyOn(lessonsService, 'getCourseDetails').mockResolvedValue({
      course_id: 44,
      course_name: 'Động từ và Thời động từ - P1',
      sections: [{
        section_id: 1,
        title: 'Chương 1',
        lessons: [{
          id: 137,
          title: 'Video',
          videoUrl: 'https://r2.example.com/manifest.mpd',
          playbackType: 'dash',
          type: 'video'
        }]
      }]
    });

    vi.spyOn(lessonsService, 'getVideoTicket').mockResolvedValue({
      ticket: 'ticket-137-dash',
      playbackType: 'dash',
      expiresIn: 60
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/lessons/137?courseId=44&seek=1673']}>
          <AuthProvider>
            <Routes>
              <Route path="/lessons/:lessonId" element={<LessonDetailPage />} />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(shakaLoadMock).toHaveBeenCalled();
    });

    // Verify that shaka.load was called with the exact seek timestamp (1673 seconds = 27:53)
    const [calledUrl, calledStartTime] = shakaLoadMock.mock.calls[0];
    expect(calledUrl).toContain('137');
    expect(calledStartTime).toBe(1673);
  });

  it('allows Admin (Role 1) to navigate directly to lesson and seek to timestamp', async () => {
    localStorage.setItem('user', JSON.stringify({ id: 99, userId: 99, roleId: 1 }));

    vi.spyOn(lessonsService, 'getLessonById').mockResolvedValue({
      id: 137,
      courseId: 44,
      title: 'Video',
      videoUrl: 'https://r2.example.com/manifest.mpd',
      playbackType: 'dash',
      type: 'video'
    });

    vi.spyOn(lessonsService, 'getCourseDetails').mockResolvedValue({
      course_id: 44,
      course_name: 'Động từ và Thời động từ - P1',
      sections: [{
        section_id: 1,
        title: 'Chương 1',
        lessons: [{
          id: 137,
          title: 'Video',
          videoUrl: 'https://r2.example.com/manifest.mpd',
          playbackType: 'dash',
          type: 'video'
        }]
      }]
    });

    vi.spyOn(lessonsService, 'getVideoTicket').mockResolvedValue({
      ticket: 'ticket-admin-137',
      playbackType: 'dash',
      expiresIn: 60
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/lessons/137?courseId=44&seek=500']}>
          <AuthProvider>
            <Routes>
              <Route path="/lessons/:lessonId" element={<LessonDetailPage />} />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(shakaLoadMock).toHaveBeenCalled();
    });

    const [calledUrl, calledStartTime] = shakaLoadMock.mock.calls[0];
    expect(calledUrl).toContain('137');
    expect(calledStartTime).toBe(500);
  });

  it('allows Student (Role 3) to navigate to enrolled lesson and seek to timestamp', async () => {
    localStorage.setItem('user', JSON.stringify({ id: 30, userId: 30, roleId: 3 }));

    vi.spyOn(lessonsService, 'getLessonById').mockResolvedValue({
      id: 137,
      courseId: 44,
      title: 'Video',
      videoUrl: 'https://r2.example.com/manifest.mpd',
      playbackType: 'dash',
      type: 'video'
    });

    vi.spyOn(lessonsService, 'getCourseDetails').mockResolvedValue({
      course_id: 44,
      course_name: 'Động từ và Thời động từ - P1',
      sections: [{
        section_id: 1,
        title: 'Chương 1',
        lessons: [{
          id: 137,
          title: 'Video',
          videoUrl: 'https://r2.example.com/manifest.mpd',
          playbackType: 'dash',
          type: 'video'
        }]
      }]
    });

    vi.spyOn(lessonsService, 'getVideoTicket').mockResolvedValue({
      ticket: 'ticket-student-137',
      playbackType: 'dash',
      expiresIn: 60
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/lessons/137?courseId=44&seek=1673']}>
          <AuthProvider>
            <Routes>
              <Route path="/lessons/:lessonId" element={<LessonDetailPage />} />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(shakaLoadMock).toHaveBeenCalled();
    });

    const [calledUrl, calledStartTime] = shakaLoadMock.mock.calls[0];
    expect(calledUrl).toContain('137');
    expect(calledStartTime).toBe(1673);
  });

  it('includes start timestamp query in LessonYouTubePlayer embedUrl', () => {
    const { container } = render(
      <LessonYouTubePlayer
        lesson={{
          id: 50,
          title: 'YouTube English Lesson',
          youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          type: 'youtube'
        }}
        initialSeek={125}
      />
    );

    const iframe = container.querySelector('iframe');
    expect(iframe).toBeInTheDocument();
    expect(iframe.src).toContain('dQw4w9WgXcQ');
    expect(iframe.src).toContain('&start=125');
  });
});
