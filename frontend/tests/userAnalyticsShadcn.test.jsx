import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import UserAnalyticsDashboard from '../src/modules/admin/components/UserAnalyticsDashboard';

const analyticsFixture = {
  generatedAt: '2026-08-25T08:00:00.000Z',
  overview: {
    total_learners: 1,
    active_learners: 1,
    new_learners: 1,
    lessons_completed: 4,
    study_minutes: 95,
    published_courses: 1,
    average_quiz_score: 88,
    ai_messages: 6,
    total_lessons: 12
  },
  engagement: { active: 1, attention: 0, inactive: 0 },
  trend: [],
  learners: [
    {
      user_id: 7,
      full_name: 'Nguyễn An',
      username: 'nguyenan',
      email: 'an@example.com',
      engagement_status: 'active',
      progress_percent: 42,
      completed_lessons: 5,
      available_lessons: 12,
      study_minutes: 95,
      quiz_attempts: 2,
      average_quiz_score: 88,
      last_activity_at: '2026-08-25T07:00:00.000Z',
      inactive_days: 0,
      period_completions: 4,
      ai_messages: 6,
      used_tokens: 1200,
      created_date: '2026-08-01T00:00:00.000Z'
    }
  ],
  courses: [
    {
      course_id: 3,
      course_name: 'English Foundations',
      learners: 1,
      completed_learners: 0,
      average_progress: 42
    }
  ]
};

describe('User Analytics shadcn dashboard', () => {
  it('renders the system pulse and learner progress from analytics data', () => {
    render(<UserAnalyticsDashboard initialData={analyticsFixture} />);

    expect(screen.getByRole('heading', { name: /User Analytics/i })).toBeInTheDocument();
    expect(screen.getAllByText('Nguyễn An').length).toBeGreaterThan(0);
    expect(screen.getByText('English Foundations')).toBeInTheDocument();
    expect(screen.getAllByText('42%').length).toBeGreaterThan(0);
  });
});
