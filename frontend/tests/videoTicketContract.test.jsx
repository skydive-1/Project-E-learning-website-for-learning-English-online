import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../src/context/AuthContext';
import * as lessonsService from '../src/modules/lessons/services/lessons.service';
import apiClient from '../src/config/api.config';
import LessonDetailPage from '../src/modules/lessons/pages/LessonDetailPage';

// Mock shaka-player
vi.mock('shaka-player', () => {
  return {
    default: {
      Player: class {
        static isBrowserSupported() { return false; }
        destroy() { return Promise.resolve(); }
      }
    }
  };
});

// Mock auth service
vi.mock('../src/modules/auth/services/auth.service', () => ({
  getProfile: vi.fn().mockResolvedValue({
    user: { id: 1, userId: 1, email: 'student@example.com', roleId: 3, role_id: 3 }
  })
}));

// Mock subtitles service
vi.mock('../src/modules/lessons/services/subtitles.service', () => ({
  subtitlesService: {
    getSubtitles: vi.fn().mockResolvedValue({ cues: [] }),
    generateSubtitles: vi.fn().mockResolvedValue({ cues: [] })
  }
}));

// Mock pdfNotes service
vi.mock('../src/modules/lessons/services/pdfNotes.service', () => ({
  fetchPdfNotes: vi.fn().mockResolvedValue([]),
  createPdfNote: vi.fn().mockResolvedValue({}),
  updatePdfNote: vi.fn().mockResolvedValue({}),
  deletePdfNote: vi.fn().mockResolvedValue({})
}));

// Mock Header & Footer to simplify DOM
vi.mock('../src/components/common/Header', () => ({
  default: () => <div data-testid="mock-header">Header</div>
}));
vi.mock('../src/components/common/Footer', () => ({
  default: () => <div data-testid="mock-footer">Footer</div>
}));

// Test helper to trigger navigation within MemoryRouter
const TestNavigator = () => {
  const navigate = useNavigate();
  return (
    <div data-testid="test-navigator">
      <button data-testid="goto-lesson-44" onClick={() => navigate('/lessons/44')}>Lesson 44</button>
      <button data-testid="goto-lesson-45" onClick={() => navigate('/lessons/45')}>Lesson 45</button>
      <button data-testid="goto-lesson-46" onClick={() => navigate('/lessons/46')}>Lesson 46</button>
    </div>
  );
};

describe('🎬 Frontend Video Ticket Contract & Playback Test Suite (TASK-VIDEO-TICKET-CONTRACT-HOTFIX-01)', () => {
  let queryClient;
  let localStorageStore = {};

  const mockCourseData = {
    id: 5,
    title: 'English Master Course',
    progress: 50,
    sections: [
      {
        id: 101,
        title: 'Section 1',
        lessons: [
          {
            id: '44',
            title: 'Lesson 44 Video',
            type: 'video',
            content_type: 'video',
            videoUrl: 'courses/5/eb5f9f73/video44.mp4',
            content_url: 'courses/5/eb5f9f73/video44.mp4'
          },
          {
            id: '45',
            title: 'Lesson 45 Video',
            type: 'video',
            content_type: 'video',
            videoUrl: 'courses/5/eb5f9f73/video45.mp4',
            content_url: 'courses/5/eb5f9f73/video45.mp4'
          },
          {
            id: '46',
            title: 'Lesson 46 External CDN',
            type: 'video',
            content_type: 'video',
            videoUrl: 'https://cdn.example.com/external-video.mp4',
            content_url: 'https://cdn.example.com/external-video.mp4'
          }
        ]
      }
    ]
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorageStore = {
      token: 'mock-session-jwt-token-xyz'
    };

    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key) => localStorageStore[key] || null);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key, val) => {
      localStorageStore[key] = String(val);
    });

    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          staleTime: 1000 * 60 * 15
        }
      }
    });

    // Mock API client calls
    vi.spyOn(apiClient, 'get').mockImplementation(async (url) => {
      if (url.includes('/lessons/video/ticket/44')) {
        return {
          data: {
            success: true,
            ticket: 'ticket-44-shortlived-token',
            expiresIn: 60,
            streamUrl: '/api/lessons/video/stream/44?ticket=ticket-44-shortlived-token'
          }
        };
      }
      if (url.includes('/lessons/video/ticket/45')) {
        return {
          data: {
            success: true,
            ticket: 'ticket-45-shortlived-token',
            expiresIn: 60,
            streamUrl: '/api/lessons/video/stream/45?ticket=ticket-45-shortlived-token'
          }
        };
      }
      if (url.includes('/courses/5')) {
        return { data: { success: true, course: mockCourseData } };
      }
      if (url.includes('/lessons/44')) {
        return {
          data: {
            success: true,
            lesson: {
              lesson_id: 44,
              title: 'Lesson 44 Video',
              content_type: 'video',
              content_url: 'courses/5/eb5f9f73/video44.mp4',
              course_id: 5
            }
          }
        };
      }
      if (url.includes('/lessons/45')) {
        return {
          data: {
            success: true,
            lesson: {
              lesson_id: 45,
              title: 'Lesson 45 Video',
              content_type: 'video',
              content_url: 'courses/5/eb5f9f73/video45.mp4',
              course_id: 5
            }
          }
        };
      }
      if (url.includes('/lessons/46')) {
        return {
          data: {
            success: true,
            lesson: {
              lesson_id: 46,
              title: 'Lesson 46 External CDN',
              content_type: 'video',
              content_url: 'https://cdn.example.com/external-video.mp4',
              course_id: 5
            }
          }
        };
      }
      return { data: { success: true } };
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const renderLessonPage = (initialUrl = '/lessons/44') => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[initialUrl]}>
          <AuthProvider>
            <TestNavigator />
            <Routes>
              <Route path="/lessons/:lessonId" element={<LessonDetailPage />} />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  // Test 1: Active video lesson calls ticket endpoint exactly once
  it('1. Active video lesson calls ticket endpoint exactly once', async () => {
    const ticketSpy = vi.spyOn(lessonsService, 'getVideoTicket');

    renderLessonPage('/lessons/44');

    await waitFor(() => {
      const video = document.querySelector('video');
      expect(video).toBeTruthy();
      expect(video.src).toContain('/api/lessons/video/stream/44?ticket=ticket-44-shortlived-token');
    });

    expect(ticketSpy).toHaveBeenCalledTimes(1);
    expect(ticketSpy).toHaveBeenCalledWith('44');
  });

  // Test 2: No session JWT attached to video URL
  it('2. Does NOT attach session JWT to video URL', async () => {
    renderLessonPage('/lessons/44');

    await waitFor(() => {
      const video = document.querySelector('video');
      expect(video).toBeTruthy();
      expect(video.src).toBeTruthy();
      expect(video.src).not.toContain('mock-session-jwt-token-xyz');
      expect(video.src).not.toContain('token=');
      expect(video.src).toContain('ticket=ticket-44-shortlived-token');
    });
  });

  // Test 3: Switching lesson A -> B creates new ticket for B
  it('3. Switching lesson A -> B creates a new ticket for B', async () => {
    const ticketSpy = vi.spyOn(lessonsService, 'getVideoTicket');

    renderLessonPage('/lessons/44');

    await waitFor(() => {
      const video = document.querySelector('video');
      expect(video?.src).toContain('ticket-44-shortlived-token');
    });

    expect(ticketSpy).toHaveBeenCalledWith('44');

    // Click button to navigate to lesson 45 inside same router
    act(() => {
      fireEvent.click(screen.getByTestId('goto-lesson-45'));
    });

    await waitFor(() => {
      const video = document.querySelector('video');
      expect(video?.src).toContain('ticket-45-shortlived-token');
    });

    expect(ticketSpy).toHaveBeenCalledWith('45');
  });

  // Test 4: Delayed ticket response from A does not overwrite B
  it('4. Delayed ticket response from A does not overwrite B', async () => {
    let resolveTicketA;
    vi.spyOn(lessonsService, 'getVideoTicket').mockImplementation((id) => {
      if (String(id) === '44') {
        return new Promise((resolve) => {
          resolveTicketA = () => resolve({
            success: true,
            ticket: 'late-ticket-44',
            streamUrl: '/api/lessons/video/stream/44?ticket=late-ticket-44'
          });
        });
      }
      return Promise.resolve({
        success: true,
        ticket: 'fast-ticket-45',
        streamUrl: '/api/lessons/video/stream/45?ticket=fast-ticket-45'
      });
    });

    renderLessonPage('/lessons/44');

    // Navigate immediately to lesson 45 before A resolves
    act(() => {
      fireEvent.click(screen.getByTestId('goto-lesson-45'));
    });

    await waitFor(() => {
      const video = document.querySelector('video');
      expect(video?.src).toContain('fast-ticket-45');
    });

    // Now resolve late ticket A
    if (resolveTicketA) {
      act(() => {
        resolveTicketA();
      });
    }

    // Video must still be lesson 45's ticket, not overwritten by late ticket A
    await new Promise(r => setTimeout(r, 50));
    const video = document.querySelector('video');
    expect(video?.src).toContain('fast-ticket-45');
    expect(video?.src).not.toContain('late-ticket-44');
  });

  // Test 5: Retry only requests ticket at most once on error
  it('5. Auto-retry requests ticket at most once on playback error', async () => {
    const ticketSpy = vi.spyOn(lessonsService, 'getVideoTicket');

    renderLessonPage('/lessons/44');

    await waitFor(() => {
      const video = document.querySelector('video');
      expect(video).toBeTruthy();
    });

    expect(ticketSpy).toHaveBeenCalledTimes(1);

    const video = document.querySelector('video');
    // Simulate video playback error (triggering handleVideoError)
    act(() => {
      fireEvent.error(video, { target: { error: { code: 4, message: 'Format error' } } });
    });

    // Auto-retry should fire once
    await waitFor(() => {
      expect(ticketSpy).toHaveBeenCalledTimes(2);
    });

    // Second error should not auto-retry again (prevents infinite loop)
    act(() => {
      fireEvent.error(video, { target: { error: { code: 4, message: 'Format error again' } } });
    });

    // Wait a bit to ensure no further auto-retries occur
    await new Promise(r => setTimeout(r, 100));
    expect(ticketSpy).toHaveBeenCalledTimes(2);

    // Error UI with retry button should be visible
    expect(screen.getByText(/Không thể tải hoặc giải mã video/)).toBeTruthy();
    const retryBtn = screen.getByText(/Thử tải lại video/);
    expect(retryBtn).toBeTruthy();

    // Manual click on retry button should request ticket
    act(() => {
      fireEvent.click(retryBtn);
    });

    await waitFor(() => {
      expect(ticketSpy).toHaveBeenCalledTimes(3);
    });
  });

  // Test 6: External video does not call ticket endpoint
  it('6. Video external does not call ticket endpoint', async () => {
    const ticketSpy = vi.spyOn(lessonsService, 'getVideoTicket');

    renderLessonPage('/lessons/46');

    await waitFor(() => {
      const video = document.querySelector('video');
      expect(video).toBeTruthy();
      expect(video.src).toBe('https://cdn.example.com/external-video.mp4');
    });

    // Should NOT call ticket endpoint for external video
    expect(ticketSpy).not.toHaveBeenCalled();
  });

  // Test 7: Playlist prefetch does not generate tickets
  it('7. Playlist prefetch and lesson transformation does not generate tickets or session tokens in URLs', async () => {
    const ticketSpy = vi.spyOn(lessonsService, 'getVideoTicket');

    const transformed = await lessonsService.getLessonById(44);

    // Prefetching/mapping must not fetch ticket
    expect(ticketSpy).not.toHaveBeenCalled();
    // Transformed videoUrl must NOT have session token
    expect(transformed.videoUrl).not.toContain('token=');
    expect(transformed.videoUrl).toBe('courses/5/eb5f9f73/video44.mp4');
  });

  // Test 8: No UI access check flickering when switching lessons
  it('8. Does not flicker access check or break UI on lesson transition', async () => {
    renderLessonPage('/lessons/44');

    await waitFor(() => {
      expect(screen.getByText('Lesson 44 Video')).toBeTruthy();
    });

    // Content is rendered stably without access check error
    expect(screen.queryByText(/Đang kiểm tra quyền truy cập/)).toBeNull();
  });
});
