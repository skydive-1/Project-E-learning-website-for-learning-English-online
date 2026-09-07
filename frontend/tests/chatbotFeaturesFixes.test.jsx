import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { translateSuggestedQuestion } from '../src/modules/chatbot/utils/suggestedQuestionsTranslator';
import MessageList from '../src/modules/chatbot/components/MessageList';

describe('Chatbot Features & Fixes', () => {
  describe('translateSuggestedQuestion', () => {
    it('returns original question if language is VIE', () => {
      const q = 'Phân biệt chi tiết cách dùng tính từ đuôi -ed và -ing thế nào?';
      expect(translateSuggestedQuestion(q, 'VIE')).toBe(q);
    });

    it('translates adjective differentiation to English in ENG mode', () => {
      const q = 'Phân biệt chi tiết cách dùng tính từ đuôi -ed và -ing thế nào?';
      const translated = translateSuggestedQuestion(q, 'ENG');
      expect(translated).toBe('How to distinguish between -ed and -ing adjectives in detail?');
    });

    it('translates adjective order question to English in ENG mode', () => {
      const q = 'Quy tắc sắp xếp thứ tự các loại tính từ trong câu ra sao?';
      const translated = translateSuggestedQuestion(q, 'ENG');
      expect(translated).toBe('What is the rule for the order of adjective types in a sentence?');
    });

    it('translates video section question to English in ENG mode', () => {
      const q = 'Đoạn nào giải thích vị trí của tính từ trong câu?';
      const translated = translateSuggestedQuestion(q, 'ENG');
      expect(translated).toBe('Which part explains the position of adjectives in a sentence?');
    });

    it('translates common mistakes question to English in ENG mode', () => {
      const q = 'Lỗi sai phổ biến khi dùng tính từ chỉ cảm xúc là gì?';
      const translated = translateSuggestedQuestion(q, 'ENG');
      expect(translated).toBe('What are common mistakes when using emotional adjectives?');
    });

    it('preserves existing English questions without mangling', () => {
      const q = 'How can I practice pronunciation effectively?';
      expect(translateSuggestedQuestion(q, 'ENG')).toBe('How can I practice pronunciation effectively?');
    });
  });

  describe('MessageList scroll bottom button', () => {
    it('renders scroll-to-bottom floating button when showScrollBottomBtn is true', () => {
      const onScrollToBottom = vi.fn();
      render(
        <MessageList
          messages={[{ id: '1', sender: 'ai', text: 'Hello!' }]}
          isHistoryLoading={false}
          quizStates={{}}
          setQuizStates={vi.fn()}
          onSeekVideo={vi.fn()}
          onNavigate={vi.fn()}
          lessonId={1}
          messagesEndRef={{ current: null }}
          onScrollPosition={vi.fn()}
          showScrollBottomBtn={true}
          onScrollToBottom={onScrollToBottom}
        />
      );

      const btn = screen.getByRole('button', { name: /Cuộn xuống tin nhắn mới nhất/i });
      expect(btn).toBeInTheDocument();
      fireEvent.click(btn);
      expect(onScrollToBottom).toHaveBeenCalledTimes(1);
    });

    it('does not render scroll button when showScrollBottomBtn is false', () => {
      render(
        <MessageList
          messages={[{ id: '1', sender: 'ai', text: 'Hello!' }]}
          isHistoryLoading={false}
          quizStates={{}}
          setQuizStates={vi.fn()}
          onSeekVideo={vi.fn()}
          onNavigate={vi.fn()}
          lessonId={1}
          messagesEndRef={{ current: null }}
          onScrollPosition={vi.fn()}
          showScrollBottomBtn={false}
          onScrollToBottom={vi.fn()}
        />
      );

      expect(screen.queryByRole('button', { name: /Cuộn xuống tin nhắn mới nhất/i })).not.toBeInTheDocument();
    });
  });
});
