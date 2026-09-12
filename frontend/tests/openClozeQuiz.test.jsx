import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import OpenClozeQuestion from '../src/modules/quizzes/components/OpenClozeQuestion';
import { getEffectiveQuestionType } from '../src/modules/quizzes/utils/questionType';
import {
  extractClozeGapIds,
  normalizeQuestionsList,
  syncClozeGaps,
  validateClozeDraft
} from '../src/modules/quizzes/utils/openCloze';

describe('Open Cloze quiz UI', () => {
  it('recognizes Open Cloze metadata and legacy marker templates', () => {
    expect(getEffectiveQuestionType({ questionType: 'open_cloze', options: [] })).toBe('open_cloze');
    expect(getEffectiveQuestionType({ question: 'AI {{1}} business.', options: [] })).toBe('open_cloze');
    expect(getEffectiveQuestionType({ questionType: 'speaking', options: [] })).toBe('pronunciation');
    expect(getEffectiveQuestionType({ question: 'Please read the following sentence aloud:', options: [] })).toBe('pronunciation');
    expect(getEffectiveQuestionType({ question: 'Write a short response.', correctAnswer: 'A model response.', options: [] })).toBe('writing');
  });

  it('extracts markers and keeps existing gap answers while editing a passage', () => {
    expect(extractClozeGapIds('A {{1}} B {{2}}')).toEqual(['1', '2']);
    expect(syncClozeGaps('A {{2}} B {{3}}', [
      { id: '2', answer: 'kept', acceptedAnswers: [], hint: '' }
    ])).toEqual([
      { id: '2', answer: 'kept', acceptedAnswers: [], hint: '' },
      { id: '3', answer: '', acceptedAnswers: [], hint: '' }
    ]);
  });

  it('validates missing gap answers in the authoring draft', () => {
    expect(validateClozeDraft({
      questionText: 'AI {{1}} business.',
      options: [{ id: '1', answer: '' }]
    })).toMatch(/Chưa nhập đáp án/);
  });

  it('renders inline word inputs and submits only when every gap is filled', () => {
    const onAnswerChange = vi.fn();
    const onSubmit = vi.fn(event => event.preventDefault());
    const question = {
      question: 'AI {{1}} how companies {{2}} data.',
      options: [
        { id: '1', inputSize: 8, hint: 'verb' },
        { id: '2', inputSize: 8, hint: 'verb' }
      ]
    };

    const { rerender } = render(
      <OpenClozeQuestion
        question={question}
        answers={{}}
        onAnswerChange={onAnswerChange}
        onSubmit={onSubmit}
      />
    );

    fireEvent.change(screen.getByLabelText('Đáp án cho chỗ trống 1'), { target: { value: 'changes' } });
    expect(onAnswerChange).toHaveBeenCalledWith('1', 'changes');
    expect(screen.getByRole('button', { name: /Nộp bài điền từ/i })).toBeDisabled();

    rerender(
      <OpenClozeQuestion
        question={question}
        answers={{ 1: 'changes', 2: 'organize' }}
        onAnswerChange={onAnswerChange}
        onSubmit={onSubmit}
      />
    );
    expect(screen.getByRole('button', { name: /Nộp bài điền từ/i })).toBeEnabled();
  });

  it('shows the correction beside an incorrect gap', () => {
    render(
      <OpenClozeQuestion
        question={{ question: 'AI {{1}} business.', options: [{ id: '1', inputSize: 8 }] }}
        answers={{ 1: 'change' }}
        onAnswerChange={() => {}}
        onSubmit={event => event.preventDefault()}
        disabled
        showSubmit={false}
        feedback={{
          results: [{ id: '1', studentAnswer: 'change', correctAnswer: 'changes', isCorrect: false }]
        }}
      />
    );

    expect(screen.getByText('change → changes')).toBeInTheDocument();
    expect(screen.getByLabelText('Đáp án cho chỗ trống 1')).toHaveAttribute('aria-invalid', 'true');
  });

  it('filters questions strictly by allowedTypes when specified', () => {
    const rawQuestions = [
      { questionType: 'multiple_choice', questionText: 'Q1', options: ['A. 1', 'B. 2', 'C. 3', 'D. 4'], correctAnswer: 'A' },
      { questionType: 'writing', questionText: 'Write an essay', options: [] },
      { questionType: 'pronunciation', questionText: 'Read aloud', options: [] },
      { questionType: 'listening', questionText: '[Audio Script]: Hello', options: ['A. 1', 'B. 2', 'C. 3', 'D. 4'], correctAnswer: 'A' },
      { questionType: 'open_cloze', questionText: 'Text {{1}}', options: [{ id: '1', answer: 'a' }] }
    ];

    const allowed = ['multiple_choice', 'open_cloze', 'listening'];
    const filtered = normalizeQuestionsList(rawQuestions, allowed);

    expect(filtered).toHaveLength(3);
    const types = filtered.map(q => q.question_type);
    expect(types).toEqual(['multiple_choice', 'listening', 'open_cloze']);
    expect(types).not.toContain('writing');
    expect(types).not.toContain('pronunciation');
  });
});
