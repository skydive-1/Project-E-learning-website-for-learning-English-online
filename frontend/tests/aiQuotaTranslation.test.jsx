import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
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

    expect(await screen.findByText('Total tokens used')).toBeInTheDocument();
    expect(screen.getByText('Users using AI')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reset all student tokens' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Token quota (Used / Maximum)' })).toBeInTheDocument();
    expect(screen.getByText('Student')).toBeInTheDocument();

    fireEvent.click(screen.getByTitle('Change maximum token quota'));

    expect(screen.getByRole('heading', { name: 'Change student token quota' })).toBeInTheDocument();
    expect(screen.getByText('Choose a quota preset:')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save new quota' })).toBeInTheDocument();
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
});
