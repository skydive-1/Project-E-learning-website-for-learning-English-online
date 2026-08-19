import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SpeakingExercise from '../src/modules/lessons/components/SpeakingExercise';
import * as chatbotService from '../src/modules/chatbot/services/chatbot.service';

vi.mock('../src/modules/chatbot/services/chatbot.service', () => ({
  askChatbotAudio: vi.fn()
}));

describe('SpeakingExercise Component React Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Read Aloud sentences tab by default', () => {
    render(
      <SpeakingExercise
        lessonId={1}
        speakingSentences="Welcome to the English communication course.|Chào mừng bạn đến với khóa học."
      />
    );

    expect(screen.getByText(/Luyện phát âm \(Read Aloud\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Welcome to the English communication course./i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Bắt đầu ghi âm/i })).toBeInTheDocument();
  });

  it('switches to Q&A tab and renders question items', () => {
    render(
      <SpeakingExercise
        lessonId={1}
        speakingQuestions="How do you practice English on a daily basis?|Bạn luyện nói tiếng Anh hàng ngày như thế nào?"
      />
    );

    const qaTabBtn = screen.getByText(/Phản xạ giao tiếp Q&A/i);
    fireEvent.click(qaTabBtn);

    expect(screen.getByText(/Chế độ hỏi đáp phản xạ/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Nghe AI hỏi/i })).toBeInTheDocument();
  });

  it('renders component score bars and word highlights on successful Read Aloud response', async () => {
    chatbotService.askChatbotAudio.mockResolvedValueOnce({
      version: 'speaking-v2',
      mode: 'read_aloud',
      overallScore: 92,
      components: {
        pronunciation: 90,
        contentAccuracy: 95,
        fluency: 90,
        completeness: 95
      },
      feedback: {
        pronunciation: 'Phát âm rất chuẩn.',
        fluency: 'Tốc độ đều đặn.',
        general: 'Bạn đọc rất tốt!'
      },
      words: [
        { word: 'welcome', textMatch: 'correct_text', acousticStatus: 'correct' },
        { word: 'to', textMatch: 'correct_text', acousticStatus: 'correct' }
      ]
    });

    render(
      <SpeakingExercise
        lessonId={1}
        speakingSentences="Welcome to"
      />
    );

    // Click start recording
    const startBtn = screen.getByRole('button', { name: /Bắt đầu ghi âm/i });
    fireEvent.click(startBtn);

    // Advance 2s and click stop
    await waitFor(() => {
      expect(screen.getByText(/Đang nói.../i)).toBeInTheDocument();
    });

    const stopBtn = screen.getByRole('button', { name: /Dừng & Chấm điểm/i });
    fireEvent.click(stopBtn);

    // Check response rendered
    await waitFor(() => {
      expect(screen.getByText(/Điểm AI tham khảo:/i)).toBeInTheDocument();
      expect(screen.getByText(/92%/i)).toBeInTheDocument();
      expect(screen.getByText(/Phát âm \(35%\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Khớp nội dung \(30%\)/i)).toBeInTheDocument();
    });
  });

  it('displays a friendly error banner and retry button on API failure instead of fake 0 score', async () => {
    chatbotService.askChatbotAudio.mockRejectedValueOnce(new Error('Lỗi máy chủ AI: Quota 429'));

    render(
      <SpeakingExercise
        lessonId={1}
        speakingSentences="Testing error handling"
      />
    );

    const startBtn = screen.getByRole('button', { name: /Bắt đầu ghi âm/i });
    fireEvent.click(startBtn);

    await waitFor(() => {
      expect(screen.getByText(/Đang nói.../i)).toBeInTheDocument();
    });

    const stopBtn = screen.getByRole('button', { name: /Dừng & Chấm điểm/i });
    fireEvent.click(stopBtn);

    await waitFor(() => {
      expect(screen.getByText(/Lỗi máy chủ AI: Quota 429/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Thử lại/i })).toBeInTheDocument();
      // Should NOT render 0% score badge
      expect(screen.queryByText(/Điểm AI tham khảo:/i)).not.toBeInTheDocument();
    });
  });
});
