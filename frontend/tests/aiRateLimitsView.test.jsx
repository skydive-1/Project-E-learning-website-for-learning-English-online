import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import { LanguageProvider } from '../src/context/LanguageContext';
import AIQuotaControlCenter from '../src/modules/admin/components/AIQuotaControlCenter';
import {
  getAiQuotaAnalytics,
  getGeminiUsageTrends,
  getGeminiRateLimitCaps,
  getGeminiRateLimitStatus,
  connectGeminiRateLimitStream,
  resetGeminiModelRouting,
  toggleAiModelLock,
  updateGeminiRateLimitCaps,
  simulateGeminiModelFallback
} from '../src/modules/admin/services/adminAnalytics.service';

vi.mock('../src/modules/admin/services/adminAnalytics.service', () => ({
  getAiQuotaAnalytics: vi.fn(),
  getGeminiUsageTrends: vi.fn(),
  getGeminiRateLimitCaps: vi.fn(),
  getGeminiRateLimitStatus: vi.fn(),
  connectGeminiRateLimitStream: vi.fn(),
  resetGeminiModelRouting: vi.fn(),
  toggleAiModelLock: vi.fn(),
  updateGeminiRateLimitCaps: vi.fn(),
  simulateGeminiModelFallback: vi.fn(),
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
  let streamHandlers;

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
    streamHandlers = null;
    connectGeminiRateLimitStream.mockImplementation((handlers) => {
      streamHandlers = handlers;
      queueMicrotask(() => handlers.onStatus?.('live', { source: 'backend_observed_telemetry' }));
      return { done: new Promise(() => {}), close: vi.fn() };
    });
    getGeminiRateLimitStatus.mockResolvedValue({
      generatedAt: '2026-09-02T00:00:00.000Z',
      windows: { rpmSeconds: 60, tpmSeconds: 60, rpdTimezone: 'America/Los_Angeles' },
      routing: {
        scope: 'process_instance',
        preferredModel: 'gemini-3.7-flash',
        effectiveModel: 'gemini-3.7-flash',
        fallbackOrder: ['gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite'],
        effectiveOrder: ['gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite'],
        lastSuccessfulModel: 'gemini-3.7-flash',
        lastSuccessfulAt: '2026-09-02T00:00:00.000Z',
        lastManualResetAt: null,
        coolingDown: []
      },
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
    resetGeminiModelRouting.mockResolvedValue({
      preferredModel: 'gemini-3.7-flash',
      effectiveModel: 'gemini-3.7-flash',
      fallbackOrder: ['gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite'],
      effectiveOrder: ['gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite'],
      lastSuccessfulModel: 'gemini-3.6-flash',
      lastSuccessfulAt: '2026-09-02T00:00:00.000Z',
      lastManualResetAt: '2026-09-02T00:01:00.000Z',
      coolingDown: []
    });
  });

  it('keeps learner usage separate from backend Gemini call telemetry', async () => {
    render(
      <LanguageProvider>
        <AIQuotaControlCenter canManageCaps />
      </LanguageProvider>
    );

    expect(await screen.findByText('Tổng token mô hình đã dùng')).toBeInTheDocument();
    expect(screen.queryByText('Mới')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /Lượt gọi Gemini từ backend/i }));

    expect((await screen.findAllByText('gemini-3.7-flash')).length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('gemini-embedding-001').length).toBeGreaterThanOrEqual(2);
    expect(await screen.findByText('Telemetry backend đang cập nhật theo sự kiện')).toBeInTheDocument();
    expect(screen.getByText('Fallback và tự phục hồi')).toBeInTheDocument();
    expect(screen.getByText('Đang ưu tiên model cao nhất')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Model ưu tiên đã sẵn sàng' })).toBeDisabled();
    expect(screen.getByText(/SSE cập nhật ngay sau mỗi lượt backend gọi AI/)).toBeInTheDocument();
    expect(screen.getByText('SSE từ backend')).toBeInTheDocument();
    expect(screen.getAllByText('BACKEND LIVE')).toHaveLength(2);
    expect(screen.getByText(/Cập nhật cuối:/)).toBeInTheDocument();
    expect(screen.getByText('Usage chính thức của Google')).toBeInTheDocument();
    expect(screen.getByText('Chỉ đối chiếu thủ công')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Mở Google AI Studio/i })).toHaveAttribute('href', 'https://aistudio.google.com/usage');
    expect(screen.getByText('Tham chiếu Gemini API Free Tier')).toBeInTheDocument();
    expect(screen.getAllByText('1.048.576').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/RPM, TPM và RPD là cap của project/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Xem cap đang hoạt động' })).toHaveAttribute('href', 'https://aistudio.google.com/usage');
    expect(screen.getByRole('progressbar', { name: 'Lượt gọi / 60s gemini-3.7-flash' })).toHaveAttribute('aria-valuenow', '70');
    expect(screen.getByText('125.000')).toBeInTheDocument();
    expect(screen.getByText('Giám sát lượt gọi backend')).toBeInTheDocument();
    expect(screen.getByText('Gần ngưỡng tham chiếu')).toBeInTheDocument();
    expect(screen.getByText('Còn 25 đơn vị trước ngưỡng tham chiếu')).toBeInTheDocument();
    expect(screen.getByText('210 thành công')).toBeInTheDocument();
    expect(screen.getAllByText('Cửa sổ trượt 60s').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('RPD reset kế tiếp')).toBeInTheDocument();
    expect(screen.getByText(/Giá trị mặc định/)).toBeInTheDocument();
  });

  it('updates every model card immediately when the backend SSE snapshot changes', async () => {
    render(
      <LanguageProvider>
        <AIQuotaControlCenter canManageCaps />
      </LanguageProvider>
    );

    fireEvent.click(screen.getByRole('tab', { name: /Lượt gọi Gemini từ backend/i }));
    await screen.findByText('Telemetry backend đang cập nhật theo sự kiện');

    const currentStatus = await getGeminiRateLimitStatus.mock.results[0].value;
    const nextStatus = {
      ...currentStatus,
      generatedAt: '2026-09-02T00:00:05.000Z',
      models: currentStatus.models.map((model) => model.model === 'gemini-3.7-flash'
        ? {
            ...model,
            usage: { ...model.usage, rpm: 8 },
            percentUsed: { ...model.percentUsed, rpm: 80 }
          }
        : model)
    };

    await act(async () => {
      streamHandlers.onSnapshot(nextStatus);
    });

    expect(screen.getByRole('progressbar', { name: 'Lượt gọi / 60s gemini-3.7-flash' })).toHaveAttribute('aria-valuenow', '80');
    expect(getGeminiRateLimitCaps).toHaveBeenCalledTimes(1);
  });

  it('restores the preferred model cooldown without issuing a probe request', async () => {
    const readyStatus = await getGeminiRateLimitStatus();
    getGeminiRateLimitStatus.mockClear();
    getGeminiRateLimitStatus.mockResolvedValue({
      ...readyStatus,
      routing: {
        ...readyStatus.routing,
        effectiveModel: 'gemini-3.6-flash',
        effectiveOrder: ['gemini-3.6-flash', 'gemini-3.5-flash-lite'],
        lastSuccessfulModel: 'gemini-3.6-flash',
        coolingDown: [{
          model: 'gemini-3.7-flash',
          retryAt: '2026-09-02T00:01:00.000Z',
          remainingMs: 60000,
          source: 'provider_retry_after'
        }]
      }
    });

    render(
      <LanguageProvider>
        <AIQuotaControlCenter canManageCaps />
      </LanguageProvider>
    );

    fireEvent.click(screen.getByRole('tab', { name: /Lượt gọi Gemini từ backend/i }));
    const restoreButton = await screen.findByRole('button', { name: 'Khôi phục model ưu tiên' });
    expect(restoreButton).toBeEnabled();
    fireEvent.click(restoreButton);

    await waitFor(() => {
      expect(resetGeminiModelRouting).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('button', { name: 'Model ưu tiên đã sẵn sàng' })).toBeDisabled();
      expect(screen.getByText('Đang ưu tiên model cao nhất')).toBeInTheDocument();
    });
  });

  it('shows RPD-exhausted models as skipped and keeps manual restore disabled', async () => {
    const readyStatus = await getGeminiRateLimitStatus();
    getGeminiRateLimitStatus.mockClear();
    getGeminiRateLimitStatus.mockResolvedValue({
      ...readyStatus,
      routing: {
        ...readyStatus.routing,
        effectiveModel: 'gemini-3.5-flash-lite',
        effectiveOrder: ['gemini-3.5-flash-lite'],
        coolingDown: [{
          model: 'gemini-3.7-flash',
          retryAt: '2026-09-12T07:00:01.000Z',
          remainingMs: 18000000,
          source: 'provider_rpd_pacific_reset',
          dimension: 'rpd',
          observedUsage: 20,
          cap: 20
        }, {
          model: 'gemini-3.6-flash',
          retryAt: '2026-09-12T07:00:01.000Z',
          remainingMs: 18000000,
          source: 'provider_rpd_pacific_reset',
          dimension: 'rpd',
          observedUsage: 28,
          cap: 20
        }]
      }
    });

    render(
      <LanguageProvider>
        <AIQuotaControlCenter canManageCaps />
      </LanguageProvider>
    );

    fireEvent.click(screen.getByRole('tab', { name: /Lượt gọi Gemini từ backend/i }));
    expect(await screen.findByText('Đang dùng model dự phòng')).toBeInTheDocument();
    expect(screen.getAllByText(/Google API từ chối · thử lại/)).toHaveLength(2);
    expect(screen.getByText(/Đang xử lý thay thế cho/).closest('div')).toHaveTextContent('gemini-3.5-flash-lite');
    const restoreButton = screen.getByRole('button', { name: 'Khôi phục model ưu tiên' });
    expect(restoreButton).toBeEnabled();
    fireEvent.click(restoreButton);
    await waitFor(() => {
      expect(resetGeminiModelRouting).toHaveBeenCalledTimes(1);
    });
  });

  it('supports the ARIA tabs keyboard interaction pattern', async () => {
    render(
      <LanguageProvider>
        <AIQuotaControlCenter canManageCaps />
      </LanguageProvider>
    );

    const usageTab = screen.getByRole('tab', { name: /Usage & quota học viên/i });
    const rateLimitTab = screen.getByRole('tab', { name: /Lượt gọi Gemini từ backend/i });
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

    fireEvent.click(screen.getByRole('tab', { name: /Lượt gọi Gemini từ backend/i }));
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

    fireEvent.click(screen.getByRole('tab', { name: /Lượt gọi Gemini từ backend/i }));
    await screen.findAllByText('gemini-3.7-flash');
    fireEvent.click(screen.getAllByRole('button', { name: 'Lưu cap' })[0]);

    await waitFor(() => {
      expect(updateGeminiRateLimitCaps).toHaveBeenCalledWith(expect.objectContaining({
        model: 'gemini-3.5-flash-lite',
        rpmCap: 15,
        tpmCap: 250000,
        rpdCap: 500
      }));
    });
  });

  it('allows admin to manually lock a model from the fallback lane', async () => {
    toggleAiModelLock.mockResolvedValue({
      scope: 'process_instance',
      preferredModel: 'gemini-3.7-flash',
      effectiveModel: 'gemini-3.7-flash',
      fallbackOrder: ['gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite'],
      effectiveOrder: ['gemini-3.7-flash', 'gemini-3.5-flash-lite'],
      lastSuccessfulModel: 'gemini-3.7-flash',
      lastSuccessfulAt: '2026-09-02T00:00:00.000Z',
      coolingDown: [],
      lockedModels: ['gemini-3.6-flash']
    });

    render(
      <LanguageProvider>
        <AIQuotaControlCenter canManageCaps />
      </LanguageProvider>
    );

    fireEvent.click(screen.getByRole('tab', { name: /Lượt gọi Gemini từ backend/i }));
    await screen.findAllByText('gemini-3.7-flash');

    const lockButtons = screen.getAllByRole('button', { name: /Khóa model/i });
    expect(lockButtons.length).toBeGreaterThan(0);

    fireEvent.click(lockButtons[0]);

    await waitFor(() => {
      expect(toggleAiModelLock).toHaveBeenCalledWith({
        model: expect.any(String),
        locked: true,
        reason: 'Admin manually locked model from dashboard'
      });
    });
  });

  it('allows admin to manually unlock a previously locked model', async () => {
    getGeminiRateLimitStatus.mockResolvedValueOnce({
      generatedAt: '2026-09-02T00:00:00.000Z',
      windows: { rpmSeconds: 60, tpmSeconds: 60, rpdTimezone: 'America/Los_Angeles' },
      routing: {
        scope: 'process_instance',
        preferredModel: 'gemini-3.7-flash',
        effectiveModel: 'gemini-3.7-flash',
        fallbackOrder: ['gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite'],
        effectiveOrder: ['gemini-3.7-flash', 'gemini-3.5-flash-lite'],
        lastSuccessfulModel: 'gemini-3.7-flash',
        lastSuccessfulAt: '2026-09-02T00:00:00.000Z',
        coolingDown: [],
        lockedModels: ['gemini-3.6-flash']
      },
      models: [{
        model: 'gemini-3.7-flash',
        usage: { rpm: 0, tpm: 0, rpd: 0 },
        caps: { rpm: 10, tpm: 250000, rpd: 250 },
        percentUsed: { rpm: 0, tpm: 0, rpd: 0 },
        headroom: { rpm: 10, tpm: 250000, rpd: 250 },
        requestStatus: { rpm: { success: 0, error: 0, pending: 0 }, rpd: { success: 0, error: 0, pending: 0 } },
        riskLevel: 'healthy',
        configured: true,
        updatedAt: '2026-09-02T00:00:00.000Z',
        updatedByName: 'Admin'
      }]
    });

    toggleAiModelLock.mockResolvedValue({
      scope: 'process_instance',
      preferredModel: 'gemini-3.7-flash',
      effectiveModel: 'gemini-3.7-flash',
      fallbackOrder: ['gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite'],
      effectiveOrder: ['gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite'],
      lastSuccessfulModel: 'gemini-3.7-flash',
      lastSuccessfulAt: '2026-09-02T00:00:00.000Z',
      coolingDown: [],
      lockedModels: []
    });

    render(
      <LanguageProvider>
        <AIQuotaControlCenter canManageCaps />
      </LanguageProvider>
    );

    fireEvent.click(screen.getByRole('tab', { name: /Lượt gọi Gemini từ backend/i }));
    expect(await screen.findByText('Admin đã khóa')).toBeInTheDocument();

    const unlockButton = screen.getByRole('button', { name: /Mở khóa model gemini-3.6-flash/i });
    expect(unlockButton).toBeInTheDocument();

    fireEvent.click(unlockButton);

    await waitFor(() => {
      expect(toggleAiModelLock).toHaveBeenCalledWith({
        model: 'gemini-3.6-flash',
        locked: false,
        reason: null
      });
    });
  });

  it('displays the fallback alert banner and active fallback badges when a model fails with 503', async () => {
    getGeminiRateLimitStatus.mockResolvedValueOnce({
      generatedAt: '2026-09-02T00:00:00.000Z',
      windows: { rpmSeconds: 60, tpmSeconds: 60, rpdTimezone: 'America/Los_Angeles' },
      routing: {
        scope: 'process_instance',
        preferredModel: 'gemini-3.7-flash',
        effectiveModel: 'gemini-3.6-flash',
        fallbackOrder: ['gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite'],
        effectiveOrder: ['gemini-3.6-flash', 'gemini-3.5-flash-lite'],
        lastSuccessfulModel: 'gemini-3.6-flash',
        lastSuccessfulAt: '2026-09-02T00:00:00.000Z',
        coolingDown: [{
          model: 'gemini-3.7-flash',
          retryAt: '2026-09-02T00:01:00.000Z',
          remainingMs: 60000,
          dimension: '503_unavailable',
          source: 'provider_503_unavailable'
        }],
        isFallbackActive: true,
        activeFallbackModel: 'gemini-3.6-flash',
        fallbackReason: 'HTTP 503 Service Unavailable (Tạm ngừng 60s)'
      },
      models: [{
        model: 'gemini-3.7-flash',
        usage: { rpm: 1, tpm: 1000, rpd: 5 },
        caps: { rpm: 10, tpm: 250000, rpd: 250 },
        percentUsed: { rpm: 10, tpm: 1, rpd: 2 },
        headroom: { rpm: 9, tpm: 249000, rpd: 245 },
        requestStatus: { rpm: { success: 0, error: 1, pending: 0 }, rpd: { success: 4, error: 1, pending: 0 } },
        riskLevel: 'healthy',
        configured: true,
        updatedAt: '2026-09-02T00:00:00.000Z',
        updatedByName: 'Admin'
      }, {
        model: 'gemini-3.6-flash',
        usage: { rpm: 2, tpm: 2000, rpd: 10 },
        caps: { rpm: 15, tpm: 300000, rpd: 300 },
        percentUsed: { rpm: 13, tpm: 1, rpd: 3 },
        headroom: { rpm: 13, tpm: 298000, rpd: 290 },
        requestStatus: { rpm: { success: 2, error: 0, pending: 0 }, rpd: { success: 10, error: 0, pending: 0 } },
        riskLevel: 'healthy',
        configured: true,
        updatedAt: '2026-09-02T00:00:00.000Z',
        updatedByName: 'Admin'
      }]
    });

    render(
      <LanguageProvider>
        <AIQuotaControlCenter canManageCaps />
      </LanguageProvider>
    );

    fireEvent.click(screen.getByRole('tab', { name: /Lượt gọi Gemini từ backend/i }));

    expect(await screen.findByText('HỆ THỐNG ĐANG TỰ ĐỘNG ĐIỀU PHỐI FALLBACK')).toBeInTheDocument();
    expect(screen.getByText('Đang fallback thay thế')).toBeInTheDocument();
    expect(screen.getByText('Lỗi 503 · Tạm dừng')).toBeInTheDocument();
    expect(screen.getByText('(Đang Fallback)')).toBeInTheDocument();
  });

  it('allows admin to trigger simulated 503 fallback testing', async () => {
    simulateGeminiModelFallback.mockResolvedValueOnce({
      model: 'gemini-3.7-flash',
      simulatedError: 503,
      routing: {
        preferredModel: 'gemini-3.7-flash',
        effectiveModel: 'gemini-3.6-flash',
        isFallbackActive: true,
        activeFallbackModel: 'gemini-3.6-flash',
        fallbackReason: 'Thử nghiệm mô phỏng HTTP 503 (60s)'
      }
    });

    render(
      <LanguageProvider>
        <AIQuotaControlCenter canManageCaps />
      </LanguageProvider>
    );

    fireEvent.click(screen.getByRole('tab', { name: /Lượt gọi Gemini từ backend/i }));
    await screen.findAllByText('gemini-3.7-flash');

    const testBtn = screen.getByRole('button', { name: /Test Fallback \(Mô phỏng 503\)/i });
    expect(testBtn).toBeInTheDocument();

    fireEvent.click(testBtn);

    await waitFor(() => {
      expect(simulateGeminiModelFallback).toHaveBeenCalledWith({
        model: 'gemini-3.7-flash',
        simulatedError: 503
      });
    });
  });
});
