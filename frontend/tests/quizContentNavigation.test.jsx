import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

vi.mock('../src/context/GamificationContext', () => ({
  useGamification: () => ({ triggerBadgeUnlock: vi.fn() })
}));

vi.mock('../src/context/ToastContext', () => ({
  useToast: () => vi.fn()
}));

vi.mock('../src/modules/quizzes/services/quizzes.service', () => ({
  getCourseQuizQuestions: vi.fn(),
  getFreeQuizById: vi.fn(),
  getCourseQuizByLessonId: () => ({
    id: '49',
    title: 'Mixed lesson quiz',
    timeLimit: 15,
    questions: [
      {
        id: '1',
        question: 'Choose one answer.',
        questionType: 'multiple_choice',
        options: ['A. First', 'B. Second', 'C. Third', 'D. Fourth'],
        correctAnswer: 'A'
      },
      {
        id: '2',
        question: 'AI {{1}} useful.',
        questionType: 'open_cloze',
        options: [{ id: '1', inputSize: 8, hint: 'verb' }],
        correctAnswer: ''
      }
    ]
  }),
  submitQuizAttempt: vi.fn(),
  submitOpenClozeAnswer: vi.fn()
}));

import QuizContent, { formatQuizOption } from '../src/modules/lessons/components/QuizContent';

describe('QuizContent navigation hardening', () => {
  it('formats non-string multiple-choice options without throwing', () => {
    expect(formatQuizOption({ text: 'A. Object answer' })).toBe('Object answer');
    expect(formatQuizOption(42)).toBe('42');
    expect(formatQuizOption(null)).toBe('');
    expect(formatQuizOption('Apple')).toBe('Apple');
  });

  it('moves from a selected multiple-choice answer to Open Cloze without crashing', async () => {
    render(<QuizContent lessonId="49" />);

    fireEvent.click((await screen.findByText('First')).closest('button'));
    fireEvent.click(screen.getByRole('button', { name: /Sau/i }));

    expect(await screen.findByLabelText('Đáp án cho chỗ trống 1')).toBeInTheDocument();
    expect(screen.getByText(/Điền một từ hoặc cụm từ/i)).toBeInTheDocument();
  });
});
