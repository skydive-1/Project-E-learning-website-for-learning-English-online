import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { LanguageProvider } from '../src/context/LanguageContext';
import AIQuotaControlCenter from '../src/modules/admin/components/AIQuotaControlCenter';
import {
  getAiQuotaAnalytics,
  getGeminiUsageTrends,
  getGeminiRateLimitCaps,
  getGeminiRateLimitStatus,
  updateGeminiRateLimitCaps
} from '../src/modules/admin/services/adminAnalytics.service';

vi.mock('../src/modules/admin/services/adminAnalytics.service', () => ({
  getAiQuotaAnalytics: vi.fn(),
  getGeminiUsageTrends: vi.fn(),
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
    getGeminiUsageTrends.mockResolvedValue({
      range: '30d', metric: 'tokens', unit: 'tokens', model: 'all',
      bucketSeconds: 86400, sourceRequested: 'auto', sourceUsed: 'backend',
      providerStatus: 'connected', availableModels: [], series: []
    });
    getGeminiRateLimitCaps.mockResolvedValue([]);
    getGeminiRateLimitStatus.mockResolvedValue({
      generatedAt: '2026-09-02T00:00:00.000Z',
      windows: { rpmSeconds: 60, tpmSeconds: 60, rpdTimezone: 'America/Los_Angeles' },
      models: [{
        model: 'gemini-3.7-flash',
        usage: { rpm: 7, tpm: 125000, rpd: 225 },
        caps: { rpm: 10, tpm: 250000, rpd: 250 },
        percentUsed: { rpm: 70, tpm: 50, rpd: 90 },
        headroom: { rpm: 3, tpm: 125000, rpd: 25 },
        requestStatus: {
          rpm: { success: 5, error: 2, pending: 0 },
          rpd: { success: 210, error: 15, pending: 0 }
        },
        riskLevel: 'critical',
        configured: true,
        updatedAt: '2026-09-02T00:00:00.000Z',
        updatedByName: 'Admin'
      }, {
        model: 'gemini-embedding-001',
        usage: { rpm: 0, tpm: 0, rpd: 0 },
        caps: { rpm: null, tpm: null, rpd: null },
        percentUsed: { rpm: null, tpm: null, rpd: null },
        headroom: { rpm: null, tpm: null, rpd: null },
        requestStatus: {
          rpm: { success: 0, error: 0, pending: 0 },
          rpd: { success: 0, error: 0, pending: 0 }
        },
        riskLevel: 'unconfigured',
        configured: false,
        updatedAt: null,
        updatedByName: null
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
    expect(screen.getAllByText('gemini-embedding-001').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Backend telemetry đang hoạt động')).toBeInTheDocument();
    expect(screen.getByText(/Tự làm mới mỗi 15 giây/)).toBeInTheDocument();
    expect(screen.getByText('Trực tiếp từ backend')).toBeInTheDocument();
    expect(screen.getByText(/Cập nhật cuối:/)).toBeInTheDocument();
    expect(screen.getByText('Đối chiếu Google Cloud Monitoring')).toBeInTheDocument();
    expect(screen.getByText('Chưa kết nối')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Mở Google AI Studio/i })).toHaveAttribute('href', 'https://aistudio.google.com/usage');
    expect(screen.getByRole('progressbar', { name: 'RPM gemini-3.7-flash' })).toHaveAttribute('aria-valuenow', '70');
    expect(screen.getByText('125.000')).toBeInTheDocument();
    expect(screen.getByText('Free-tier Usage Guard')).toBeInTheDocument();
    expect(screen.getByText('Sát ngưỡng 429')).toBeInTheDocument();
    expect(screen.getByText('Còn 25 đơn vị trước cap')).toBeInTheDocument();
    expect(screen.getByText('210 thành công')).toBeInTheDocument();
    expect(screen.getByText('15 lỗi')).toBeInTheDocument();
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

  it('forces a fresh status and cap request when Cập nhật ngay is clicked', async () => {
    render(
      <LanguageProvider>
        <AIQuotaControlCenter canManageCaps />
      </LanguageProvider>
    );

    fireEvent.click(screen.getByRole('tab', { name: /Rate Limits Google/i }));
    await screen.findAllByText('gemini-3.7-flash');
    getGeminiRateLimitStatus.mockClear();
    getGeminiRateLimitCaps.mockClear();

    fireEvent.click(screen.getByRole('button', { name: 'Cập nhật ngay' }));

    expect(await screen.findByRole('button', { name: 'Đang cập nhật' })).toBeDisabled();
    expect(screen.getByText('Đang đồng bộ telemetry từ backend...')).toBeInTheDocument();
    expect(document.querySelector('[data-slot="spinner"]')).toHaveClass('animate-spin');

    await waitFor(() => {
      expect(getGeminiRateLimitStatus).toHaveBeenCalledWith({ fresh: true });
      expect(getGeminiRateLimitCaps).toHaveBeenCalledWith({ fresh: true });
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Cập nhật ngay' })).toBeEnabled();
    }, { timeout: 2000 });
  });

  it('sends the explicitly saved model caps to the backend', async () => {
    render(
      <LanguageProvider>
        <AIQuotaControlCenter canManageCaps />
      </LanguageProvider>
    );

    fireEvent.click(screen.getByRole('tab', { name: /Rate Limits Google/i }));
    await screen.findAllByText('gemini-3.7-flash');
    fireEvent.click(screen.getAllByRole('button', { name: 'Lưu cap' })[0]);

    await waitFor(() => {
      expect(updateGeminiRateLimitCaps).toHaveBeenCalledWith(expect.objectContaining({
        model: 'gemini-3.5-flash-lite',
        rpmCap: 15,
        tpmCap: 250000,
        rpdCap: 1000
      }));
    });
  });
});
