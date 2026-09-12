import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import CreateQuizDialog from '../src/modules/courses/components/CreateQuizDialog';

const defaultQuestion = {
  question_text: 'Which sentence is correct?',
  question_type: 'multiple_choice',
  options: ['Option A', 'Option B', 'Option C', 'Option D'],
  correct_answer: 'A',
  explanation: ''
};

const Harness = ({ onGenerateAi = vi.fn() }) => {
  const [mode, setMode] = useState('manual');
  const [title, setTitle] = useState('Grammar review');
  const [description, setDescription] = useState('');
  const [difficulty, setDifficulty] = useState('Medium');
  const [timeLimit, setTimeLimit] = useState(15);
  const [isPrivate, setPrivate] = useState(false);
  const [pin, setPin] = useState('');
  const [questions, setQuestions] = useState([defaultQuestion]);
  const [topic, setTopic] = useState('Travel English');
  const [count, setCount] = useState(5);
  const [types, setTypes] = useState(['multiple_choice', 'open_cloze']);

  return (
    <CreateQuizDialog
      open
      onOpenChange={vi.fn()}
      createMode={mode}
      onCreateModeChange={setMode}
      quizTitle={title}
      onQuizTitleChange={setTitle}
      quizDescription={description}
      onQuizDescriptionChange={setDescription}
      quizDifficulty={difficulty}
      onQuizDifficultyChange={setDifficulty}
      quizTimeLimit={timeLimit}
      onQuizTimeLimitChange={setTimeLimit}
      isPrivate={isPrivate}
      onPrivateChange={setPrivate}
      pinCode={pin}
      onPinCodeChange={setPin}
      questions={questions}
      onQuestionsChange={setQuestions}
      onAddQuestion={vi.fn()}
      submitting={false}
      onSubmit={event => event.preventDefault()}
      aiTopic={topic}
      onAiTopicChange={setTopic}
      aiCount={count}
      onAiCountChange={setCount}
      aiTypes={types}
      onAiTypesChange={setTypes}
      aiGenerating={false}
      onGenerateAi={onGenerateAi}
    />
  );
};

describe('CreateQuizDialog shadcn UI', () => {
  it('renders the complete manual form and multiple-choice editor', () => {
    render(<Harness />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/Tạo đề thi/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Tiêu đề đề thi *')).toHaveValue('Grammar review');
    expect(screen.getByLabelText('Đáp án A')).toHaveValue('Option A');
    expect(screen.getByRole('button', { name: /Xuất bản đề thi/i })).toHaveAttribute('form', 'manual-quiz-form');

    fireEvent.click(screen.getByText('Khóa bằng mã PIN riêng tư'));
    expect(screen.getByPlaceholderText('MÃ PIN (VD: 882910)')).toBeInTheDocument();
  });

  it('switches to the AI tab and submits a configured topic', () => {
    const onGenerateAi = vi.fn();
    render(<Harness onGenerateAi={onGenerateAi} />);

    fireEvent.click(screen.getByRole('tab', { name: /Sinh đề bằng/i }));

    expect(screen.getByLabelText('Chủ đề bài tập muốn AI tạo *')).toHaveValue('Travel English');
    fireEvent.click(screen.getByRole('button', { name: /Bắt đầu tạo câu hỏi/i }));
    expect(onGenerateAi).toHaveBeenCalledTimes(1);
  });

  it('displays "Chưa chọn đáp án đúng" badge and red outline when question has no correct_answer', () => {
    const questionWithoutAnswer = {
      question_text: 'Sample question without answer',
      question_type: 'multiple_choice',
      options: ['Option A', 'Option B', 'Option C', 'Option D'],
      correct_answer: '',
      explanation: ''
    };

    const questions = [questionWithoutAnswer];
    render(
      <CreateQuizDialog
        open
        onOpenChange={vi.fn()}
        createMode="manual"
        onCreateModeChange={vi.fn()}
        quizTitle="Test Quiz"
        onQuizTitleChange={vi.fn()}
        quizDescription=""
        onQuizDescriptionChange={vi.fn()}
        quizDifficulty="Easy"
        onQuizDifficultyChange={vi.fn()}
        quizTimeLimit={10}
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

    expect(screen.getByText('Chưa chọn đáp án đúng')).toBeInTheDocument();
  });

  it('prevents form submission and scrolls to invalid question when correct_answer is missing', () => {
    const handleSubmit = vi.fn();
    const scrollIntoViewMock = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;

    const questions = [
      {
        question_text: 'Valid Question',
        question_type: 'multiple_choice',
        options: ['A1', 'B1', 'C1', 'D1'],
        correct_answer: 'A',
        explanation: ''
      },
      {
        question_text: 'Question without answer',
        question_type: 'multiple_choice',
        options: ['A2', 'B2', 'C2', 'D2'],
        correct_answer: '',
        explanation: ''
      }
    ];

    render(
      <CreateQuizDialog
        open
        onOpenChange={vi.fn()}
        createMode="manual"
        onCreateModeChange={vi.fn()}
        quizTitle="Test Quiz"
        onQuizTitleChange={vi.fn()}
        quizDescription=""
        onQuizDescriptionChange={vi.fn()}
        quizDifficulty="Easy"
        onQuizDifficultyChange={vi.fn()}
        quizTimeLimit={10}
        onQuizTimeLimitChange={vi.fn()}
        isPrivate={false}
        onPrivateChange={vi.fn()}
        pinCode=""
        onPinCodeChange={vi.fn()}
        questions={questions}
        onQuestionsChange={vi.fn()}
        onAddQuestion={vi.fn()}
        submitting={false}
        onSubmit={handleSubmit}
      />
    );

    const submitBtn = screen.getByRole('button', { name: /Xuất bản đề thi/i });
    fireEvent.click(submitBtn);

    // Form onSubmit must NOT have been called because validation blocked it
    expect(handleSubmit).not.toHaveBeenCalled();
    // Auto-scroll called on question card
    expect(scrollIntoViewMock).toHaveBeenCalled();
  });

  it('displays the Live Fair Distribution preview when question types are selected in AI mode', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('tab', { name: /Sinh đề bằng/i }));

    // Harness has count=5 and types=['multiple_choice', 'open_cloze'] -> 3 multiple choice + 2 open cloze = 5 questions
    expect(screen.getByText(/Phân bổ dự kiến:/i)).toBeInTheDocument();
    expect(screen.getByText('3 Trắc nghiệm')).toBeInTheDocument();
    expect(screen.getByText('2 Điền từ (Open Cloze)')).toBeInTheDocument();
    expect(screen.getByText('Tổng: 5 câu')).toBeInTheDocument();
  });

  it('keeps the chosen question count and flexibly assigns zero to overflow types', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('tab', { name: /Sinh đề bằng/i }));

    fireEvent.click(screen.getByRole('button', { name: /Tự luận \(Writing\)/i }));
    fireEvent.click(screen.getByRole('button', { name: /Nghe hiểu \(Listening\)/i }));
    fireEvent.change(screen.getByLabelText('Số lượng câu hỏi'), { target: { value: '3' } });

    expect(screen.getByLabelText('Số lượng câu hỏi')).toHaveValue('3');
    expect(screen.getByText('1 Trắc nghiệm')).toBeInTheDocument();
    expect(screen.getByText('1 Điền từ (Open Cloze)')).toBeInTheDocument();
    expect(screen.getByText('1 Tự luận (Writing)')).toBeInTheDocument();
    expect(screen.getByText('0 Nghe hiểu (Listening)')).toBeInTheDocument();
    expect(screen.getByText('Tổng: 3 câu')).toBeInTheDocument();
  });
});
