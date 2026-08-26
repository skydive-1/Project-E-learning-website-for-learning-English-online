import { describe, expect, it } from 'vitest';
import { getEffectiveQuestionType } from '../src/modules/quizzes/utils/questionType';

describe('quiz question type normalization', () => {
  it('honors explicit Writing and Speaking metadata', () => {
    expect(getEffectiveQuestionType({ questionType: 'writing', options: [] })).toBe('writing');
    expect(getEffectiveQuestionType({ question_type: 'speaking', options: [] })).toBe('pronunciation');
    expect(getEffectiveQuestionType({ question_type: 'read-aloud', options: [] })).toBe('pronunciation');
  });

  it('recognizes a read-aloud prompt even when legacy API mislabeled it', () => {
    expect(getEffectiveQuestionType({
      questionType: 'multiple_choice',
      question: 'Please read the following sentence aloud:',
      options: []
    })).toBe('pronunciation');
  });

  it('uses a non-option expected answer as the pronunciation sentence', () => {
    expect(getEffectiveQuestionType({
      options: [],
      correctAnswer: 'English has become a global language.'
    })).toBe('pronunciation');
  });

  it('keeps an open Describe prompt as Writing', () => {
    expect(getEffectiveQuestionType({
      question: 'Describe two global challenges in 2-3 sentences.',
      options: [],
      correctAnswer: ''
    })).toBe('writing');
  });

  it('keeps questions with answer options as multiple choice', () => {
    expect(getEffectiveQuestionType({
      question: 'Choose the correct answer.',
      options: ['Option A', 'Option B'],
      correctAnswer: 'A'
    })).toBe('multiple_choice');
  });
});
