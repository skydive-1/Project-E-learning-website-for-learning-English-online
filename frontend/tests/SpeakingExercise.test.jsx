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
    chatbotService.askChatbotAudio.mockReset();
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
    chatbotService.askChatbotAudio.mockResolvedValue({
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

    // Advance and click stop
    await waitFor(() => {
      expect(screen.getByText(/Đang nói.../i)).toBeInTheDocument();
    });

    const stopBtn = screen.getByRole('button', { name: /Dừng & Chấm điểm/i });
    fireEvent.click(stopBtn);

    await waitFor(() => {
      expect(chatbotService.askChatbotAudio).toHaveBeenCalled();
    });

    // Check response rendered with new ~33% weights and Tham khảo label
    await waitFor(() => {
      expect(screen.getByText(/Điểm AI tham khảo:/i)).toBeInTheDocument();
      expect(screen.getByText(/92%/i)).toBeInTheDocument();
      expect(screen.getByText(/Phát âm \(~33%\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Khớp nội dung \(~33%\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Độ trôi chảy \(~33%\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Hoàn thành \(Tham khảo\)/i)).toBeInTheDocument();
    });
  });

  it('renders IELTS 4 components (25% each) and separate Relevance Gate status for Q&A', async () => {
    chatbotService.askChatbotAudio.mockResolvedValue({
      version: 'speaking-v2',
      mode: 'qa',
      overallScore: 85,
      components: {
        fluencyCoherence: 80,
        lexicalResource: 85,
        grammaticalRange: 90,
        pronunciation: 85,
        relevanceGate: 95
      },
      feedback: {
        general: 'Rất tốt! Câu trả lời trôi chảy và bám sát câu hỏi.'
      }
    });

    render(
      <SpeakingExercise
        lessonId={1}
        speakingQuestions="Where do you see yourself in five years?|Mục tiêu của bạn trong 5 năm tới là gì?"
      />
    );

    // Switch to Q&A tab
    const qaTabBtn = screen.getByText(/Phản xạ giao tiếp Q&A/i);
    fireEvent.click(qaTabBtn);

    // Record answer
    const startBtn = screen.getByRole('button', { name: /Trả lời câu hỏi bằng giọng nói/i });
    fireEvent.click(startBtn);

    await waitFor(() => {
      expect(screen.getByText(/Đang trả lời.../i)).toBeInTheDocument();
    });

    const stopBtn = screen.getByRole('button', { name: /Dừng & Nộp câu trả lời/i });
    fireEvent.click(stopBtn);

    // Check IELTS 4 components and Gate rendered
    await waitFor(() => {
      expect(screen.getByText(/Điểm thành phần Q&A \(Chuẩn IELTS\):/i)).toBeInTheDocument();
      expect(screen.getByText(/Trôi chảy & Mạch lạc \(25%\)/i)).toBeInTheDocument();
      expect(screen.getByText(/80%/i)).toBeInTheDocument();

      expect(screen.getByText(/Từ vựng \(25%\)/i)).toBeInTheDocument();
      expect(screen.getAllByText(/85%/i).length).toBeGreaterThan(0);

      expect(screen.getByText(/Ngữ pháp \(25%\)/i)).toBeInTheDocument();
      expect(screen.getByText(/90%/i)).toBeInTheDocument();

      expect(screen.getByText(/Phát âm \(25%\)/i)).toBeInTheDocument();

      // Gate check: has label, badge "Đạt", and no "%" next to it
      expect(screen.getByText(/Độ bám sát chủ đề \(Gate\):/i)).toBeInTheDocument();
      expect(screen.getByText('Đạt')).toBeInTheDocument();
      expect(screen.queryByText(/95%/i)).not.toBeInTheDocument();
    });
  });

  it('renders mild relevance warning when relevanceWarning exists and offTopic is false', async () => {
    chatbotService.askChatbotAudio.mockResolvedValue({
      version: 'speaking-v2',
      mode: 'qa',
      overallScore: 72,
      components: {
        fluencyCoherence: 70,
        lexicalResource: 75,
        grammaticalRange: 70,
        pronunciation: 73,
        relevanceGate: 45 // 30-59 range -> warning, no score cap
      },
      relevanceWarning: 'Câu trả lời chưa đúng trọng tâm câu hỏi (Relevance Gate < 60). Hãy bám sát chủ đề hơn.',
      offTopic: false,
      scoreCapApplied: false,
      feedback: {
        general: 'Cần bám sát chủ đề hơn.'
      }
    });

    render(
      <SpeakingExercise
        lessonId={1}
        speakingQuestions="Tell me about your favorite book.|Cuốn sách yêu thích của bạn là gì?"
      />
    );

    const qaTabBtn = screen.getByText(/Phản xạ giao tiếp Q&A/i);
    fireEvent.click(qaTabBtn);

    const startBtn = screen.getByRole('button', { name: /Trả lời câu hỏi bằng giọng nói/i });
    fireEvent.click(startBtn);

    await waitFor(() => {
      expect(screen.getByText(/Đang trả lời.../i)).toBeInTheDocument();
    });

    const stopBtn = screen.getByRole('button', { name: /Dừng & Nộp câu trả lời/i });
    fireEvent.click(stopBtn);

    await waitFor(() => {
      // Mild warning callout rendered
      expect(screen.getByText(/Câu trả lời chưa đúng trọng tâm câu hỏi \(Relevance Gate < 60\)\./i)).toBeInTheDocument();
      // Gate status shows "Cảnh báo"
      expect(screen.getByText('Cảnh báo')).toBeInTheDocument();
      // Overall score is not 0
      expect(screen.getByText(/72%/i)).toBeInTheDocument();
    });
  });

  it('renders severe off-topic alert and 0 overall score when relevanceGate is below 30', async () => {
    chatbotService.askChatbotAudio.mockResolvedValue({
      version: 'speaking-v2',
      mode: 'qa',
      overallScore: 0,
      components: {
        fluencyCoherence: 60,
        lexicalResource: 65,
        grammaticalRange: 60,
        pronunciation: 65,
        relevanceGate: 15 // < 30 -> Off-topic
      },
      relevanceWarning: 'Câu trả lời hoàn toàn lạc đề so với câu hỏi (Relevance Gate < 30). Điểm = 0.',
      offTopic: true,
      scoreCapApplied: true,
      scoreCapReason: 'Câu trả lời hoàn toàn lạc đề so với câu hỏi (Relevance Gate < 30). Điểm = 0.',
      feedback: {
        general: 'Lạc đề hoàn toàn.'
      }
    });

    render(
      <SpeakingExercise
        lessonId={1}
        speakingQuestions="What are the benefits of learning languages?|Lợi ích của việc học ngoại ngữ là gì?"
      />
    );

    const qaTabBtn = screen.getByText(/Phản xạ giao tiếp Q&A/i);
    fireEvent.click(qaTabBtn);

    const startBtn = screen.getByRole('button', { name: /Trả lời câu hỏi bằng giọng nói/i });
    fireEvent.click(startBtn);

    await waitFor(() => {
      expect(screen.getByText(/Đang trả lời.../i)).toBeInTheDocument();
    });

    const stopBtn = screen.getByRole('button', { name: /Dừng & Nộp câu trả lời/i });
    fireEvent.click(stopBtn);

    await waitFor(() => {
      // Severe alert rendered
      expect(screen.getByText(/Câu trả lời hoàn toàn lạc đề so với câu hỏi/i)).toBeInTheDocument();
      // Gate status badge shows "Lạc đề"
      expect(screen.getByText('Lạc đề')).toBeInTheDocument();
      // Overall score is 0%
      expect(screen.getByText('0%')).toBeInTheDocument();
    });
  });

  it('displays a friendly error banner and retry button on API failure instead of fake 0 score', async () => {
    chatbotService.askChatbotAudio.mockRejectedValue(new Error('Lỗi máy chủ AI: Quota 429'));

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

  it('handles null audioBlob gracefully without crashing', async () => {
    render(
      <SpeakingExercise
        lessonId={1}
        speakingSentences="Testing null blob safety"
      />
    );

    expect(screen.getByText(/Testing null blob safety/i)).toBeInTheDocument();
  });
});
