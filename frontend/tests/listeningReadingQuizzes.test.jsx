import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import getEffectiveQuestionType from '../src/modules/quizzes/utils/questionType';
import { normalizeQuestion, normalizeQuestionsList } from '../src/modules/quizzes/utils/openCloze';
import CreateQuizDialog from '../src/modules/courses/components/CreateQuizDialog';

describe('Listening & Reading Quiz Questions Support', () => {
  it('correctly detects question types using getEffectiveQuestionType', () => {
    const listeningQ = {
      question_type: 'listening',
      audio_url: 'https://r2.example.com/audio/sample.mp3',
      question_text: 'What is the speaker announcing?',
      options: ['Delay', 'Boarding', 'Gate change', 'Cancellation'],
      correct_answer: 'B'
    };

    const readingQ = {
      question_type: 'reading',
      passage_text: 'Artificial intelligence is reshaping education worldwide...',
      question_text: 'What is the main topic of the passage?',
      options: ['AI in Education', 'Global Trade', 'Social Media', 'Sports'],
      correct_answer: 'A'
    };

    expect(getEffectiveQuestionType(listeningQ)).toBe('listening');
    expect(getEffectiveQuestionType(readingQ)).toBe('reading');

    // Auto-detect by audio_url
    expect(getEffectiveQuestionType({ audio_url: 'https://cdn.com/audio.mp3', question: 'Listen' })).toBe('listening');
    // Auto-detect by passage_text
    expect(getEffectiveQuestionType({ passage_text: 'A long text...', question: 'Read' })).toBe('reading');
  });

  it('normalizes listening and reading questions retaining audio_url and passage_text', () => {
    const rawQuestions = [
      {
        question_text: 'Listen and choose the best summary.',
        question_type: 'listening',
        audio_url: 'courses/sample.mp3',
        options: ['A', 'B', 'C', 'D'],
        correct_answer: 'A'
      },
      {
        question_text: 'According to paragraph 2, why did the author leave?',
        question_type: 'reading',
        passage_text: 'In 2020, the team embarked on a journey...',
        options: ['Work', 'Holiday', 'Family', 'Weather'],
        correct_answer: 'C'
      }
    ];

    const normalized = normalizeQuestionsList(rawQuestions);

    expect(normalized[0].question_type).toBe('listening');
    expect(normalized[0].audio_url).toBe('courses/sample.mp3');
    expect(normalized[0].options).toHaveLength(4);

    expect(normalized[1].question_type).toBe('reading');
    expect(normalized[1].passage_text).toBe('In 2020, the team embarked on a journey...');
    expect(normalized[1].options).toHaveLength(4);
  });

  it('renders listening and reading question cards in CreateQuizDialog', () => {
    const questions = [
      {
        question_text: 'What did the man order?',
        question_type: 'listening',
        audio_url: 'https://example.com/listen.mp3',
        options: ['Tea', 'Coffee', 'Juice', 'Water'],
        correct_answer: 'B',
        explanation: 'He ordered a latte.'
      },
      {
        question_text: 'What is the passage primarily about?',
        question_type: 'reading',
        passage_text: 'The solar system consists of the Sun and everything bound to it by gravity...',
        options: ['Planets', 'The Solar System', 'Gravity', 'Stars'],
        correct_answer: 'B',
        explanation: 'Paragraph 1 introduces the system.'
      }
    ];

    render(
      <CreateQuizDialog
        open
        onOpenChange={vi.fn()}
        createMode="manual"
        onCreateModeChange={vi.fn()}
        quizTitle="Listening & Reading Test"
        onQuizTitleChange={vi.fn()}
        quizDescription="Comprehensive practice"
        onQuizDescriptionChange={vi.fn()}
        quizDifficulty="Medium"
        onQuizDifficultyChange={vi.fn()}
        quizTimeLimit={20}
        onQuizTimeLimitChange={vi.fn()}
        isPrivate={false}
        onPrivateChange={vi.fn()}
        pinCode=""
        onPinCodeChange={vi.fn()}
        questions={questions}
        onQuestionsChange={vi.fn()}
        onAddQuestion={vi.fn()}
        submitting={false}
        onSubmit={vi.fn()}
      />
    );

    // Check that both types are rendered with headers
    expect(screen.getAllByText('Nghe hiểu (Listening)').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Đọc hiểu (Reading)').length).toBeGreaterThan(0);

    // Check passage textarea
    expect(screen.getByLabelText(/Đoạn văn đọc hiểu/i)).toHaveValue(questions[1].passage_text);

    // Check audio input
    expect(screen.getByPlaceholderText(/Dán link audio/i)).toHaveValue(questions[0].audio_url);
  });
});
