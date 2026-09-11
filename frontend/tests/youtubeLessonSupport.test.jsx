import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  extractYouTubeVideoId,
  isYouTubeUrl,
  normalizeYouTubeUrl
} from '../src/modules/lessons/services/lessons.service';
import LessonYouTubePlayer from '../src/modules/lessons/components/LessonYouTubePlayer';
import { isMediaReadyForPublish } from '../src/modules/instructor/pages/CourseEditor';

describe('YouTube Educational Lesson Support', () => {
  describe('extractYouTubeVideoId & isYouTubeUrl', () => {
    it('correctly parses standard watch?v= URLs', () => {
      const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
      expect(extractYouTubeVideoId(url)).toBe('dQw4w9WgXcQ');
      expect(isYouTubeUrl(url)).toBe(true);
    });

    it('correctly parses youtu.be short links', () => {
      const url = 'https://youtu.be/dQw4w9WgXcQ?t=10';
      expect(extractYouTubeVideoId(url)).toBe('dQw4w9WgXcQ');
      expect(isYouTubeUrl(url)).toBe(true);
    });

    it('correctly parses embed links', () => {
      const url = 'https://www.youtube.com/embed/dQw4w9WgXcQ';
      expect(extractYouTubeVideoId(url)).toBe('dQw4w9WgXcQ');
      expect(isYouTubeUrl(url)).toBe(true);
    });

    it('correctly parses shorts links', () => {
      const url = 'https://www.youtube.com/shorts/dQw4w9WgXcQ';
      expect(extractYouTubeVideoId(url)).toBe('dQw4w9WgXcQ');
      expect(isYouTubeUrl(url)).toBe(true);
    });

    it('returns null and false for non-youtube links', () => {
      expect(extractYouTubeVideoId('https://vimeo.com/123456')).toBeNull();
      expect(isYouTubeUrl('https://vimeo.com/123456')).toBe(false);
      expect(extractYouTubeVideoId('')).toBeNull();
      expect(isYouTubeUrl('')).toBe(false);
    });

    it('canonicalizes a duplicated pasted URL to one stable watch URL', () => {
      const duplicated = 'https://www.youtube.com/watch?v=KiNV60Ce7kE&t=283shttps://www.youtube.com/watch?v=KiNV60Ce7kE&t=283s';
      expect(normalizeYouTubeUrl(duplicated)).toBe(
        'https://www.youtube.com/watch?v=KiNV60Ce7kE'
      );
    });
  });

  describe('isMediaReadyForPublish with YouTube', () => {
    it('returns true for lesson of type youtube with valid youtubeUrl', () => {
      const lesson = {
        type: 'youtube',
        youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
      };
      expect(isMediaReadyForPublish(lesson)).toBe(true);
    });

    it('returns false for lesson of type youtube with invalid or missing url', () => {
      const lesson = {
        type: 'youtube',
        youtubeUrl: ''
      };
      expect(isMediaReadyForPublish(lesson)).toBe(false);
    });
  });

  describe('LessonYouTubePlayer component', () => {
    it('renders youtube-nocookie iframe with academic citation header and disclaimer', () => {
      const lesson = {
        id: '101',
        title: 'IELTS Listening Practice - Cambridge 18',
        type: 'youtube',
        youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
      };

      render(<LessonYouTubePlayer lesson={lesson} />);

      // Verify header branding and title
      expect(screen.getByText('YouTube Edu')).toBeDefined();
      expect(screen.getByText('IELTS Listening Practice - Cambridge 18')).toBeDefined();

      // Verify buttons
      expect(screen.getByText('Sao chép link')).toBeDefined();
      expect(screen.getByText('Mở trên YouTube')).toBeDefined();

      // Verify iframe src
      const iframe = screen.getByTitle('IELTS Listening Practice - Cambridge 18');
      expect(iframe).toBeDefined();
      expect(iframe.getAttribute('src')).toContain('youtube-nocookie.com/embed/dQw4w9WgXcQ');

      // Verify Academic citation notice
      expect(screen.getByText(/Học liệu tham khảo mở • Bản quyền nội dung gốc thuộc về kênh tác giả trên YouTube/i)).toBeDefined();
    });

    it('handles invalid youtube link gracefully', () => {
      const lesson = {
        id: '102',
        title: 'Broken YouTube Lesson',
        type: 'youtube',
        youtubeUrl: 'invalid-url'
      };

      render(<LessonYouTubePlayer lesson={lesson} />);
      expect(screen.getByText('Chưa có liên kết YouTube hợp lệ')).toBeDefined();
    });

    it('replaces the iframe when the URL changes for the same lesson', () => {
      const lesson = {
        id: '101',
        title: 'YouTube lesson',
        type: 'youtube',
        youtubeUrl: 'https://www.youtube.com/watch?v=aPpvAYp0xDc'
      };
      const { rerender } = render(<LessonYouTubePlayer lesson={lesson} />);

      rerender(
        <LessonYouTubePlayer
          lesson={{ ...lesson, youtubeUrl: 'https://www.youtube.com/watch?v=KiNV60Ce7kE' }}
        />
      );

      expect(screen.getByTitle('YouTube lesson').getAttribute('src')).toContain(
        'youtube-nocookie.com/embed/KiNV60Ce7kE'
      );
    });
  });
});
