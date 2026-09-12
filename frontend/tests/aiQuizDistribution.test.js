import { describe, expect, it } from 'vitest';
import {
  calculateExpectedAiDistribution,
  reconcileAiQuizResponse,
  validateAiQuizResponse
} from '../src/modules/quizzes/utils/aiQuizDistribution';

describe('AI quiz distribution contract', () => {
  it('calculates the same 2/2/1 distribution shown by the quiz dialog', () => {
    expect(calculateExpectedAiDistribution(5, ['multiple_choice', 'listening', 'reading'])).toEqual({
      total: 5,
      types: ['multiple_choice', 'listening', 'reading'],
      distribution: { multiple_choice: 2, listening: 2, reading: 1 }
    });
  });

  it('keeps the selected question count even when more question types are selected', () => {
    expect(calculateExpectedAiDistribution(3, ['multiple_choice', 'listening', 'reading', 'open_cloze'])).toEqual({
      total: 3,
      types: ['multiple_choice', 'listening', 'reading', 'open_cloze'],
      distribution: { multiple_choice: 1, listening: 1, reading: 1, open_cloze: 0 }
    });
  });

  it('rejects a partial two-question response instead of showing false success', () => {
    const result = validateAiQuizResponse({
      count: 5,
      questionTypes: ['multiple_choice', 'listening', 'reading'],
      questions: [
        { questionType: 'multiple_choice', questionText: 'Question 1', options: ['A', 'B', 'C', 'D'], correctAnswer: 'A' },
        { questionType: 'multiple_choice', questionText: 'Question 2', options: ['A', 'B', 'C', 'D'], correctAnswer: 'B' }
      ]
    });

    expect(result.valid).toBe(false);
    expect(result.message).toContain('2/5');
    expect(result.message).toContain('2 câu Nghe hiểu');
    expect(result.message).toContain('1 câu Đọc hiểu');
  });

  it('accepts an exact five-question response with all selected types', () => {
    const questions = [
      { questionType: 'multiple_choice', questionText: 'MC 1', options: ['A', 'B', 'C', 'D'], correctAnswer: 'A' },
      { questionType: 'listening', questionText: '[Audio Script] Listen 1', options: ['A', 'B', 'C', 'D'], correctAnswer: 'A' },
      { questionType: 'reading', questionText: 'Read 1', passageText: 'A passage.', options: ['A', 'B', 'C', 'D'], correctAnswer: 'A' },
      { questionType: 'multiple_choice', questionText: 'MC 2', options: ['A', 'B', 'C', 'D'], correctAnswer: 'B' },
      { questionType: 'listening', questionText: '[Audio Script] Listen 2', options: ['A', 'B', 'C', 'D'], correctAnswer: 'C' }
    ];

    const result = validateAiQuizResponse({
      questions,
      count: 5,
      questionTypes: ['multiple_choice', 'listening', 'reading']
    });

    expect(result.valid).toBe(true);
    expect(result.questions).toHaveLength(5);
  });

  it('automatically repairs a partial AI response into the requested 2/2/1 mix', () => {
    const result = reconcileAiQuizResponse({
      topic: 'history',
      count: 5,
      questionTypes: ['multiple_choice', 'open_cloze', 'listening'],
      questions: [
        { questionType: 'multiple_choice', questionText: 'MC 1', options: ['A', 'B', 'C', 'D'], correctAnswer: 'A' },
        { questionType: 'multiple_choice', questionText: 'MC 2', options: ['A', 'B', 'C', 'D'], correctAnswer: 'B' },
        { questionType: 'open_cloze', questionText: 'History {{1}} us.', options: [{ id: '1', answer: 'teaches' }], correctAnswer: '' }
      ]
    });

    const counts = result.questions.reduce((acc, question) => {
      acc[question.question_type] = (acc[question.question_type] || 0) + 1;
      return acc;
    }, {});

    expect(result.questions).toHaveLength(5);
    expect(counts).toEqual({ multiple_choice: 2, open_cloze: 2, listening: 1 });
    expect(result.questions.find(question => question.question_type === 'listening').question_text).not.toMatch(/Speaker\s+[A-Z]|\[Audio Script|\[Dialogue|\[Question/i);
    expect(result.repaired).toBe(true);
    expect(result.recoveredCount).toBe(2);
  });
});
