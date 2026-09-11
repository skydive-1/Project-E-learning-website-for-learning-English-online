import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { LanguageProvider } from '../src/context/LanguageContext';
import GeminiUsageTrendChart from '../src/modules/admin/components/GeminiUsageTrendChart';
import { getGeminiUsageTrends } from '../src/modules/admin/services/adminAnalytics.service';

vi.mock('../src/modules/admin/services/adminAnalytics.service', () => ({
  getGeminiUsageTrends: vi.fn()
}));

const backendFixture = {
  range: '30d',
  metric: 'tokens',
  unit: 'tokens',
  model: 'all',
  bucketSeconds: 86400,
  sourceRequested: 'backend',
  sourceUsed: 'backend',
  providerStatus: 'connected',
  fallbackReason: null,
  startTime: '2026-08-10T00:00:00.000Z',
  endTime: '2026-09-08T00:00:00.000Z',
  sampledAt: '2026-09-07T23:58:00.000Z',
  expectedDelaySeconds: 0,
  availableModels: ['gemini-3.7-flash', 'gemini-embedding-001'],
  series: [
    { timestamp: '2026-09-07T00:00:00.000Z', model: 'gemini-3.7-flash', value: 1200 },
    { timestamp: '2026-09-07T00:00:00.000Z', model: 'gemini-embedding-001', value: 300 }
  ]
};

describe('Gemini usage trend chart', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    getGeminiUsageTrends.mockResolvedValue(backendFixture);
  });

  it('shows a compact operational summary and the zero-cost backend source', async () => {
    render(
      <LanguageProvider>
        <GeminiUsageTrendChart />
      </LanguageProvider>
    );

    expect(await screen.findByText('Backend telemetry')).toBeInTheDocument();
    expect(screen.getByLabelText('Khoảng thời gian')).toBeInTheDocument();
    expect(screen.getByLabelText('Chỉ số')).toBeInTheDocument();
    expect(screen.queryByLabelText('Nguồn dữ liệu')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Model')).toBeInTheDocument();
    expect(screen.getByText('Tổng trong kỳ')).toBeInTheDocument();
    expect(screen.getAllByText('1.500 token').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Telemetry nội bộ · 0₫')).toBeInTheDocument();
    expect(getGeminiUsageTrends).toHaveBeenCalledWith(expect.objectContaining({ source: 'backend' }));
    fireEvent.click(screen.getByLabelText('Model'));
    expect(await screen.findByText('gemini-3.7-flash')).toBeInTheDocument();
    expect(screen.getByText('gemini-embedding-001')).toBeInTheDocument();
  });

  it('forces a fresh request and animates the manual refresh action', async () => {
    let resolveRefresh;
    getGeminiUsageTrends
      .mockResolvedValueOnce(backendFixture)
      .mockImplementationOnce(() => new Promise((resolve) => { resolveRefresh = resolve; }));

    render(
      <LanguageProvider>
        <GeminiUsageTrendChart />
      </LanguageProvider>
    );
    await screen.findByText('Backend telemetry');
    fireEvent.click(screen.getByRole('button', { name: 'Cập nhật ngay' }));

    expect(screen.getByRole('button', { name: 'Đang cập nhật' })).toBeDisabled();
    expect(document.querySelector('[data-slot="spinner"]')).toHaveClass('animate-spin');
    expect(getGeminiUsageTrends).toHaveBeenLastCalledWith(expect.objectContaining({ fresh: true }));

    resolveRefresh(backendFixture);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Cập nhật ngay' })).toBeEnabled());
  });

  it('keeps the chart usable and explains when Google falls back to backend telemetry', async () => {
    getGeminiUsageTrends.mockResolvedValue({
      ...backendFixture,
      sourceUsed: 'backend',
      providerStatus: 'fallback',
      fallbackReason: 'GOOGLE_MONITORING_PERMISSION_DENIED'
    });

    render(
      <LanguageProvider>
        <GeminiUsageTrendChart />
      </LanguageProvider>
    );

    expect(await screen.findByText('Đang dùng dữ liệu dự phòng từ backend')).toBeInTheDocument();
    expect(screen.getByText(/chưa có quyền Monitoring Viewer/i)).toBeInTheDocument();
    expect(screen.getByText('Backend telemetry')).toBeInTheDocument();
  });
});
