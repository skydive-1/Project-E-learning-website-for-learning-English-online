import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LanguageProvider } from '../src/context/LanguageContext';
import AIQuotaUsageBoard from '../src/modules/admin/components/AIQuotaUsageBoard';
import { getAiQuotaAnalytics } from '../src/modules/admin/services/adminAnalytics.service';

vi.mock('../src/modules/admin/services/adminAnalytics.service', () => ({
  getAiQuotaAnalytics: vi.fn(),
  updateUserQuota: vi.fn(),
  resetUserAiToken: vi.fn(),
  resetBulkAiTokens: vi.fn(),
}));

const dashboardFixture = {
  summary: {
    total_used_tokens: 1200,
    total_max_tokens: 6000,
    total_remaining_tokens: 4800,
    active_ai_users_period: 1,
    total_ai_messages_period: 4,
    avg_tokens_per_active_user: 1200,
    estimatedCostUsd: '0.0001',
  },
  trends: [],
  recentAiLogs: [],
  users: [{
    user_id: 12,
    full_name: 'Nguyen An',
    username: 'an12',
    email: 'an@example.com',
    role_id: 3,
    max_tokens: 6000,
    used_tokens: 1200,
    remaining_tokens: 4800,
    usage_percentage: 20,
    quota_status: 'normal',
    used_questions_24h: 4,
    question_limit_24h: 10,
    questions_remaining_24h: 6,
    question_quota_unlimited: false,
    question_reset_at: '2026-08-29T12:00:00.000Z',
    question_usage_percentage: 40,
    question_quota_status: 'normal',
  }, {
    user_id: 13,
    full_name: 'Demo Instructor',
    username: 'instructor13',
    email: 'instructor@example.com',
    role_id: 2,
    used_tokens: 800,
    used_questions_24h: 3,
    question_limit_24h: 20,
    questions_remaining_24h: 17,
    question_quota_unlimited: false,
    question_reset_at: '2026-08-29T12:00:00.000Z',
    question_usage_percentage: 15,
    question_quota_status: 'normal',
  }, {
    user_id: 14,
    full_name: 'System Admin',
    username: 'admin14',
    email: 'admin@example.com',
    role_id: 1,
    used_tokens: 0,
    used_questions_24h: null,
    question_limit_24h: null,
    questions_remaining_24h: null,
    question_quota_unlimited: true,
    question_reset_at: null,
    question_usage_percentage: 0,
    question_quota_status: 'unlimited',
  }],
};

const renderBoard = () => render(
  <LanguageProvider>
    <AIQuotaUsageBoard />
  </LanguageProvider>,
);

describe('AI quota management translations', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  it('renders the complete management surface in English', async () => {
    window.localStorage.setItem('language', 'ENG');
    getAiQuotaAnalytics.mockResolvedValue(dashboardFixture);

    renderBoard();

    expect(await screen.findByText('Total model tokens used')).toBeInTheDocument();
    expect(screen.getByText('Users using AI')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reset all student question usage' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Usage Limit' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Questions / quota (today)' })).toBeInTheDocument();
    expect(screen.getByText('Student')).toBeInTheDocument();
    expect(screen.getByText('4 / 10')).toBeInTheDocument();
    expect(screen.getByText('3 / 20')).toBeInTheDocument();
    expect(screen.getByText('0 / 50')).toBeInTheDocument();
    expect(screen.getByText('50 questions remaining')).toBeInTheDocument();
  });

  it('renders a localized, actionable 404 state in Vietnamese', async () => {
    getAiQuotaAnalytics.mockRejectedValue({ response: { status: 404 } });

    renderBoard();

    expect(await screen.findByText(
      'API quản lý hạn mức AI chưa khả dụng. Hãy kiểm tra kết nối backend rồi thử lại.',
    )).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeInTheDocument();
    expect(screen.queryByText('Request failed with status code 404')).not.toBeInTheDocument();
  });

  it('labels provider backfill separately from per-request cost and learner attribution', async () => {
    window.localStorage.setItem('language', 'ENG');
    getAiQuotaAnalytics.mockResolvedValue({
      ...dashboardFixture,
      summary: {
        ...dashboardFixture.summary,
        total_model_tokens_period: 916284,
        backfilled_tokens_period: 916284,
        historical_tokens_excluded_from_cost: 916284,
      },
    });

    renderBoard();

    expect(await screen.findByText('916,284')).toBeInTheDocument();
    expect(screen.getByText(
      'Includes 916,284 aggregated historical tokens from Google AI Studio; they are not assigned to individual users.',
    )).toBeInTheDocument();
    expect(screen.getByText(
      'Cost excludes 916,284 backfilled tokens because Google does not provide per-request cost data.',
    )).toBeInTheDocument();
  });
});
