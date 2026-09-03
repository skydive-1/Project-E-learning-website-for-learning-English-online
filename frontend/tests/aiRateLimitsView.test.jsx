import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { LanguageProvider } from '../src/context/LanguageContext';
import AIQuotaControlCenter from '../src/modules/admin/components/AIQuotaControlCenter';
import {
  getAiQuotaAnalytics,
  getGeminiRateLimitCaps,
  getGeminiRateLimitStatus,
  updateGeminiRateLimitCaps
} from '../src/modules/admin/services/adminAnalytics.service';

vi.mock('../src/modules/admin/services/adminAnalytics.service', () => ({
  getAiQuotaAnalytics: vi.fn(),
  getGeminiRateLimitCaps: vi.fn(),
  getGeminiRateLimitStatus: vi.fn(),
  updateGeminiRateLimitCaps: vi.fn(),
  updateUserQuota: vi.fn(),
  resetUserAiToken: vi.fn(),
  resetBulkAiTokens: vi.fn()
}));

const quotaFixture = {
  summary: {},
  trends: [],
  recentAiLogs: [],
  users: []
};

describe('Gemini Rate Limits admin view', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    getAiQuotaAnalytics.mockResolvedValue(quotaFixture);
    getGeminiRateLimitCaps.mockResolvedValue([]);
    getGeminiRateLimitStatus.mockResolvedValue({
      generatedAt: '2026-09-02T00:00:00.000Z',
      windows: { rpmSeconds: 60, tpmSeconds: 60, rpdTimezone: 'America/Los_Angeles' },
      models: [{
        model: 'gemini-3.7-flash',
        usage: { rpm: 7, tpm: 125000, rpd: 225 },
        caps: { rpm: 10, tpm: 250000, rpd: 250 },
        percentUsed: { rpm: 70, tpm: 50, rpd: 90 },
        configured: true,
        updatedAt: '2026-09-02T00:00:00.000Z',
        updatedByName: 'Admin'
      }]
    });
    updateGeminiRateLimitCaps.mockResolvedValue({ success: true });
  });

  it('keeps the existing usage view and exposes Google Rate Limits in a separate tab', async () => {
    render(
      <LanguageProvider>
        <AIQuotaControlCenter canManageCaps />
      </LanguageProvider>
    );

    expect(await screen.findByText('Tổng token mô hình đã dùng')).toBeInTheDocument();
    expect(screen.queryByText('Mới')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /Rate Limits Google/i }));

    expect((await screen.findAllByText('gemini-3.7-flash')).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Hai loại hạn mức, hai mốc đặt lại.')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'RPM gemini-3.7-flash' })).toHaveAttribute('aria-valuenow', '70');
    expect(screen.getByText('125.000')).toBeInTheDocument();
    expect(screen.getByText(/Giá trị mặc định/)).toBeInTheDocument();
  });

  it('supports the ARIA tabs keyboard interaction pattern', async () => {
    render(
      <LanguageProvider>
        <AIQuotaControlCenter canManageCaps />
      </LanguageProvider>
    );

    const usageTab = screen.getByRole('tab', { name: /Usage & quota học viên/i });
    const rateLimitTab = screen.getByRole('tab', { name: /Rate Limits Google/i });
    expect(usageTab).toHaveAttribute('tabindex', '0');
    expect(rateLimitTab).toHaveAttribute('tabindex', '-1');

    usageTab.focus();
    fireEvent.keyDown(usageTab, { key: 'ArrowRight' });

    await waitFor(() => {
      expect(rateLimitTab).toHaveFocus();
      expect(rateLimitTab).toHaveAttribute('aria-selected', 'true');
      expect(rateLimitTab).toHaveAttribute('tabindex', '0');
      expect(usageTab).toHaveAttribute('tabindex', '-1');
    });
  });

  it('sends the explicitly saved model caps to the backend', async () => {
    render(
      <LanguageProvider>
        <AIQuotaControlCenter canManageCaps />
      </LanguageProvider>
    );

    fireEvent.click(screen.getByRole('tab', { name: /Rate Limits Google/i }));
    await screen.findAllByText('gemini-3.7-flash');
    fireEvent.click(screen.getByRole('button', { name: 'Lưu cap' }));

    await waitFor(() => {
      expect(updateGeminiRateLimitCaps).toHaveBeenCalledWith(expect.objectContaining({
        model: 'gemini-3.7-flash',
        rpmCap: 10,
        tpmCap: 250000,
        rpdCap: 250
      }));
    });
  });
});
