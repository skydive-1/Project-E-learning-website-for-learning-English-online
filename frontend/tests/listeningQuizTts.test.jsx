import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

vi.mock('../src/context/GamificationContext', () => ({
  useGamification: () => ({ triggerBadgeUnlock: vi.fn() })
}));

vi.mock('../src/context/ToastContext', () => ({
  useToast: () => vi.fn()
}));

const mockListeningQuestion = {
  id: '171',
  question: 'Which cellular organelle is known as the powerhouse of the cell because it generates most of the chemical supply?',
  questionType: 'listening',
  options: ['Ribosome', 'Mitochondrion', 'Golgi apparatus', 'Endoplasmic reticulum'],
  correctAnswer: 'B'
};

vi.mock('../src/modules/quizzes/services/quizzes.service', () => ({
  getCourseQuizQuestions: vi.fn(),
  getFreeQuizById: vi.fn(),
  getCourseQuizByLessonId: () => ({
    id: '171',
    title: 'Trắc nghiệm: IELTS Listening chủ đề Biology - Sinh học',
    timeLimit: 15,
    questions: [mockListeningQuestion]
  }),
  submitQuizAttempt: vi.fn(),
  submitOpenClozeAnswer: vi.fn()
}));

import QuizContent from '../src/modules/lessons/components/QuizContent';

describe('Listening Quiz Question & British TTS Hardening', () => {
  let speakMock;
  let cancelMock;

  beforeEach(() => {
    speakMock = vi.fn();
    cancelMock = vi.fn();
    window.speechSynthesis = {
      speak: speakMock,
      cancel: cancelMock,
      getVoices: () => [
        { name: 'Microsoft Sonia Online (Natural)', lang: 'en-GB' },
        { name: 'Microsoft Ryan Online (Natural)', lang: 'en-GB' },
        { name: 'Google US English', lang: 'en-US' }
      ]
    };
  });

  it('does NOT show the secret listening question text on screen during the test', async () => {
    render(<QuizContent lessonId="171" />);

    // Must show the listening guidance prompt
    expect(await screen.findByText(/Lắng nghe câu hỏi và chọn đáp án chính xác bên dưới:/i)).toBeInTheDocument();

    // Must NOT reveal the raw question text
    expect(screen.queryByText(/Which cellular organelle is known as the powerhouse/i)).toBeNull();

    // Options A, B, C, D must still be rendered for selection
    expect(screen.getByText(/Mitochondrion/i)).toBeInTheDocument();
  });

  it('renders distinct Male and Female British voice buttons and speaks with respective voice', async () => {
    render(<QuizContent lessonId="171" />);

    const femaleBtn = await screen.findByRole('button', { name: /Giọng Nữ \(Anh - Anh\)/i });
    const maleBtn = screen.getByRole('button', { name: /Giọng Nam \(Anh - Anh\)/i });

    expect(femaleBtn).toBeInTheDocument();
    expect(maleBtn).toBeInTheDocument();

    // Test Female Voice TTS playback
    fireEvent.click(femaleBtn);
    expect(speakMock).toHaveBeenCalledTimes(1);
    const femaleUtterance = speakMock.mock.calls[0][0];
    expect(femaleUtterance.lang).toBe('en-GB');
    expect(femaleUtterance.voice?.name).toBe('Microsoft Sonia Online (Natural)');
    expect(femaleUtterance.pitch).toBe(1.05);

    // Test Male Voice TTS playback
    fireEvent.click(maleBtn);
    expect(cancelMock).toHaveBeenCalled();
    expect(speakMock).toHaveBeenCalledTimes(2);
    const maleUtterance = speakMock.mock.calls[1][0];
    expect(maleUtterance.lang).toBe('en-GB');
    expect(maleUtterance.voice?.name).toBe('Microsoft Ryan Online (Natural)');
    expect(maleUtterance.pitch).toBe(0.92);
  });
});
