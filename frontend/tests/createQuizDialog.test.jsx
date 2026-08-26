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
    expect(screen.getByText('Tạo đề thi mới')).toBeInTheDocument();
    expect(screen.getByLabelText('Tiêu đề đề thi *')).toHaveValue('Grammar review');
    expect(screen.getByLabelText('Đáp án A')).toHaveValue('Option A');
    expect(screen.getByRole('button', { name: /Xuất bản đề thi/i })).toHaveAttribute('form', 'manual-quiz-form');

    fireEvent.click(screen.getByRole('checkbox', { name: /Khóa bằng mã PIN riêng tư/i }));
    expect(screen.getByLabelText('Mã PIN (4–8 ký tự)')).toBeInTheDocument();
  });

  it('switches to the AI tab and submits a configured topic', () => {
    const onGenerateAi = vi.fn();
    render(<Harness onGenerateAi={onGenerateAi} />);

    fireEvent.click(screen.getByRole('tab', { name: /Sinh đề bằng AI/i }));

    expect(screen.getByLabelText('Chủ đề bài tập muốn AI tạo *')).toHaveValue('Travel English');
    fireEvent.click(screen.getByRole('button', { name: /Bắt đầu tạo câu hỏi AI/i }));
    expect(onGenerateAi).toHaveBeenCalledTimes(1);
  });
});
