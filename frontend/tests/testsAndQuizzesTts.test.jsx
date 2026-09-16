import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

vi.mock('../src/context/ThemeContext', () => ({
  useTheme: () => ({ theme: 'light', toggleTheme: vi.fn() })
}));

vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({ user: { role_id: 1, full_name: 'Test Instructor' } })
}));

vi.mock('../src/context/LanguageContext', () => ({
  useLanguage: () => ({ t: (k) => k, language: 'VIE' })
}));

vi.mock('../src/context/ToastContext', () => ({
  useToast: () => vi.fn()
}));

vi.mock('../src/context/GamificationContext', () => ({
  useGamification: () => ({ reloadGamification: vi.fn() })
}));

const mockNavigate = vi.fn();
vi.mock(import('react-router-dom'), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ quizId: 'test-quiz-1' }),
    Link: ({ children, to, onClick, ...props }) => (
      <a href={to} onClick={onClick} {...props}>
        {children}
      </a>
    )
  };
});

vi.mock('../src/modules/quizzes/services/quizzes.service', () => ({
  getFreeQuizzesList: vi.fn().mockResolvedValue([]),
  getFreeQuizById: vi.fn().mockResolvedValue({
    id: 'test-quiz-1',
    title: 'Đề thi trắc nghiệm tổng hợp',
    timeLimit: 10,
    questions: [
      {
        id: 'q1',
        question: 'What is the main function of the respiratory system?',
        questionType: 'multiple_choice',
        options: ['Digestion', 'Gas exchange', 'Circulation', 'Locomotion'],
        correctAnswer: 'B'
      }
    ]
  }),
  getCourseQuizQuestions: vi.fn().mockResolvedValue([]),
  getCourseQuizByLessonId: vi.fn(),
  submitQuizAttempt: vi.fn().mockResolvedValue({}),
  getQuizLeaderboard: vi.fn().mockResolvedValue([])
}));

vi.mock('../src/modules/chatbot/services/quota.service', () => ({
  getAiQuotaStatus: vi.fn().mockResolvedValue({ isUnlimited: true })
}));

vi.mock('../src/modules/lessons/hooks/useStudyTimeTracker', () => ({
  default: vi.fn()
}));

import TestsAndQuizzesPanel from '../src/modules/courses/components/TestsAndQuizzesPanel';
import PlayQuizPage from '../src/modules/quizzes/pages/PlayQuizPage';

describe('Tests & Quizzes Panel and PlayQuizPage British Male TTS', () => {
  let speakMock;
  let cancelMock;

  beforeEach(() => {
    speakMock = vi.fn();
    cancelMock = vi.fn();
    window.speechSynthesis = {
      speak: speakMock,
      cancel: cancelMock,
      getVoices: () => [
        { name: 'Microsoft Ryan Online (Natural)', lang: 'en-GB' },
        { name: 'Microsoft Sonia Online (Natural)', lang: 'en-GB' }
      ]
    };

    global.SpeechSynthesisUtterance = class {
      constructor(text = '') {
        this.text = text;
        this.lang = '';
        this.pitch = 1;
        this.rate = 1;
        this.voice = null;
      }
    };
  });

  it('renders TestsAndQuizzesPanel cleanly without decorative voice banners', async () => {
    render(<TestsAndQuizzesPanel />);

    expect(screen.getByText(/Interactive Quizzes/i)).toBeInTheDocument();
    expect(screen.queryByText(/Giọng đọc đề thi & bài nghe:/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Nghe thử giọng Nam \(British\)/i })).not.toBeInTheDocument();
  });

  it('renders "Đọc câu hỏi (Nam - British)" on multiple choice questions in PlayQuizPage', async () => {
    render(<PlayQuizPage />);

    const startQuizBtn = await screen.findByRole('button', { name: /Bắt đầu chơi/i });
    fireEvent.click(startQuizBtn);

    const readQuestionBtn = await screen.findByRole('button', { name: /Đọc câu hỏi \(Nam - British\)/i });
    expect(readQuestionBtn).toBeInTheDocument();

    fireEvent.click(readQuestionBtn);

    expect(speakMock).toHaveBeenCalledTimes(1);
    const utterance = speakMock.mock.calls[0][0];
    expect(utterance.lang).toBe('en-GB');
    expect(utterance.pitch).toBe(0.92);
    expect(utterance.voice?.name).toBe('Microsoft Ryan Online (Natural)');
    expect(utterance.text).toContain('What is the main function of the respiratory system?');
  });

  it('renders both Male and Female British voice buttons in QuizContent even when audio_url is present', async () => {
    const QuizContent = (await import('../src/modules/lessons/components/QuizContent')).default;
    const { getCourseQuizByLessonId } = await import('../src/modules/quizzes/services/quizzes.service');

    getCourseQuizByLessonId.mockReturnValueOnce({
      id: 'audio-quiz-1',
      title: 'Bài nghe có file audio đính kèm',
      timeLimit: 10,
      questions: [
        {
          id: 'aq1',
          question: 'Listen to the conversation and answer.',
          questionType: 'listening',
          audio_url: 'https://r2.example.com/audio/sample.mp3',
          options: ['Option A', 'Option B', 'Option C', 'Option D'],
          correctAnswer: 'A'
        }
      ]
    });

    render(<QuizContent lessonId="audio-quiz-1" />);

    // Must show the audio element
    const audioElement = await screen.findByRole('button', { name: /Giọng Nữ \(Anh - Anh\)/i });
    expect(audioElement).toBeInTheDocument();

    const maleBtn = screen.getByRole('button', { name: /Giọng Nam \(Anh - Anh\)/i });
    expect(maleBtn).toBeInTheDocument();

    fireEvent.click(maleBtn);
    expect(speakMock).toHaveBeenCalled();
    const maleUtterance = speakMock.mock.calls[0][0];
    expect(maleUtterance.lang).toBe('en-GB');
    expect(maleUtterance.voice?.name).toBe('Microsoft Ryan Online (Natural)');
    expect(maleUtterance.pitch).toBe(0.92);
  });

  it('renders VocabularyFlashcardModal and speaks words with Male British voice', async () => {
    const VocabularyFlashcardModal = (await import('../src/modules/courses/components/VocabularyFlashcardModal')).default;

    const mockCollection = {
      id: 'col-1',
      title: 'Expressions for communicating',
      iconEmoji: '🗣️',
      level: 'B1',
      words: [
        {
          id: 'w1',
          word: 'keep in touch',
          ipa: '/ki:p ɪn tʌtʃ/',
          meaning: 'Giữ liên lạc',
          example: 'Let us keep in touch while you are abroad.'
        }
      ]
    };

    render(<VocabularyFlashcardModal collection={mockCollection} onClose={vi.fn()} />);

    expect(screen.queryByText(/🎙️ Giọng Nam \(British\)/i)).not.toBeInTheDocument();

    const speakerBtn = screen.getByTitle(/Nghe phát âm chuẩn \(Nam - British\)/i);
    expect(speakerBtn).toBeInTheDocument();

    fireEvent.click(speakerBtn);

    expect(speakMock).toHaveBeenCalled();
    const utterance = speakMock.mock.calls[speakMock.mock.calls.length - 1][0];
    expect(utterance.lang).toBe('en-GB');
    expect(utterance.pitch).toBe(0.92);
    expect(utterance.voice?.name).toBe('Microsoft Ryan Online (Natural)');
    expect(utterance.text).toBe('keep in touch');
  });
});

