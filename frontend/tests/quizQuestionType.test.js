import { describe, expect, it } from 'vitest';
import { getEffectiveQuestionType, getSpeakingTargetSentence, getSpeakingInstruction } from '../src/modules/quizzes/utils/questionType';

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

describe('speaking target sentence extraction', () => {
  it('extracts sentence from quotes in question text', () => {
    const q = {
      question: 'Read the following sentence aloud with correct pronunciation and intonation:\n"Artificial intelligence is transforming the landscape of modern information technology."'
    };
    expect(getSpeakingTargetSentence(q)).toBe('Artificial intelligence is transforming the landscape of modern information technology.');
  });

  it('uses correctAnswer when provided without prompt instruction', () => {
    const q = {
      question: 'Read the following sentence aloud:',
      correctAnswer: 'Cloud computing allows users to access data from anywhere.'
    };
    expect(getSpeakingTargetSentence(q)).toBe('Cloud computing allows users to access data from anywhere.');
  });

  it('extracts sentence after colon when no quotes exist', () => {
    const q = {
      question: 'Read the following sentence: Cybersecurity measures are essential to protect data.'
    };
    expect(getSpeakingTargetSentence(q)).toBe('Cybersecurity measures are essential to protect data.');
  });
});

describe('speaking instruction extraction', () => {
  it('extracts instruction before quoted target sentence', () => {
    const q = {
      question: 'Read the following sentence aloud with correct pronunciation and intonation:\n"Artificial intelligence is transforming the landscape of modern information technology."'
    };
    expect(getSpeakingInstruction(q)).toBe('Read the following sentence aloud with correct pronunciation and intonation.');
  });

  it('extracts instruction before colon', () => {
    const q = {
      question: 'Read the following sentence aloud: Cybersecurity measures are essential to protect data.'
    };
    expect(getSpeakingInstruction(q)).toBe('Read the following sentence aloud.');
  });

  it('provides a clean default instruction when prompt lacks prefix', () => {
    const q = {
      question: 'English is spoken by millions of people across the globe.'
    };
    expect(getSpeakingInstruction(q)).toBe('Read the following sentence aloud with clear pronunciation and natural intonation.');
  });
});

