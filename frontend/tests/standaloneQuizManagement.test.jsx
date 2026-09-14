import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 4, role_id: 1, full_name: 'Admin' } })
}));

vi.mock('../src/context/LanguageContext', () => ({
  useLanguage: () => ({ t: (s) => s })
}));

vi.mock('../src/context/ToastContext', () => ({
  useToast: () => vi.fn()
}));

const mockFreeQuizzes = [
  { id: 9, title: 'Bài tập AI: Information Technology', difficulty: 'Medium', timeLimit: 15, questions: [] },
  { id: 35, title: 'Basic English Review.', difficulty: 'Medium', timeLimit: 30, questions: [] }
];

const mockManagedQuizzes = [
  { quiz_id: 9, course_id: null, lesson_id: null, title: 'Bài tập AI: Information Technology', is_private: false, pin_code: null },
  { quiz_id: 35, course_id: null, lesson_id: null, title: 'Basic English Review.', is_private: false, pin_code: null },
  { quiz_id: 6, course_id: null, lesson_id: null, title: 'Learning well', is_private: true, pin_code: '212986' },
  // Lesson quizzes that MUST be filtered out
  { quiz_id: 58, course_id: 55, lesson_id: 171, title: 'Trắc nghiệm: IELTS Listening chủ đề Biology - Sinh học', is_private: false, pin_code: null },
  { quiz_id: 59, course_id: 45, lesson_id: 144, title: 'Trắc nghiệm: Mind map', is_private: false, pin_code: null },
  { quiz_id: 50, course_id: 44, lesson_id: 137, title: 'Trắc nghiệm: Video', is_private: false, pin_code: null }
];

vi.mock('../src/modules/quizzes/services/quizzes.service', () => ({
  getFreeQuizzesList: vi.fn(() => Promise.resolve(mockFreeQuizzes)),
  getAllQuizzesForManagement: vi.fn(() => Promise.resolve(mockManagedQuizzes)),
  deleteQuizById: vi.fn(() => Promise.resolve({ success: true })),
  createQuiz: vi.fn(),
  generateQuizAi: vi.fn(),
  generateQuizAiFromPdf: vi.fn(),
  getQuizByPin: vi.fn()
}));

import TestsAndQuizzesPanel from '../src/modules/courses/components/TestsAndQuizzesPanel';

describe('TestsAndQuizzesPanel Standalone Quizzes Scope', () => {
  it('displays only standalone quizzes in the Quản lý Đề & PIN modal and excludes lesson quizzes', async () => {
    render(
      <MemoryRouter>
        <TestsAndQuizzesPanel />
      </MemoryRouter>
    );

    // Click "Quản lý Đề & PIN" button
    const manageBtn = await screen.findByRole('button', { name: /Quản lý Đề & PIN/i });
    fireEvent.click(manageBtn);

    // Modal title appears
    expect(await screen.findByText(/Quản lý Đề thi & Tra cứu mã PIN/i)).toBeInTheDocument();
    const modalDialog = screen.getByText(/Quản lý Đề thi & Tra cứu mã PIN/i).closest('.manage-quiz-dialog');

    // Standalone quizzes must be present inside the manage modal
    expect(modalDialog).toHaveTextContent('Bài tập AI: Information Technology');
    expect(modalDialog).toHaveTextContent('Basic English Review.');
    expect(modalDialog).toHaveTextContent('Learning well');

    // Lesson quizzes must NOT be present
    expect(modalDialog).not.toHaveTextContent(/IELTS Listening chủ đề Biology/i);
    expect(modalDialog).not.toHaveTextContent(/Trắc nghiệm: Mind map/i);
    expect(modalDialog).not.toHaveTextContent(/Trắc nghiệm: Video/i);
  });
});
