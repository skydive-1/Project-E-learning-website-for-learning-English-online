import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  getAdminAlerts: vi.fn(),
  connectAdminAlertsStream: vi.fn()
}));

vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({ user: { userId: 4, roleId: 1 } })
}));

vi.mock('../src/modules/admin/services/adminAlerts.service', () => ({
  getAdminAlerts: mocks.getAdminAlerts,
  connectAdminAlertsStream: mocks.connectAdminAlertsStream
}));

import AdminAlertsPanel from '../src/modules/admin/components/AdminAlertsPanel';

const snapshot = {
  generatedAt: '2026-09-10T02:00:00.000Z',
  source: 'PostgreSQL và telemetry runtime của backend',
  alerts: [{
    id: 'subtitle-generation-failures',
    type: 'failed_upload',
    severity: 'medium',
    title: 'Tạo phụ đề thất bại',
    message: '1 bài học có tác vụ phụ đề thất bại và cần được tạo lại.',
    timestamp: '2026-09-10T01:59:00.000Z',
    actionUrl: '/admin/dashboard?tab=courses',
    actionLabel: 'Quản lý khóa học',
    source: 'PostgreSQL · lesson_subtitles'
  }]
};

describe('AdminAlertsPanel', () => {
  beforeEach(() => {
    mocks.getAdminAlerts.mockResolvedValue(snapshot);
    mocks.connectAdminAlertsStream.mockImplementation(({ onStatus, onSnapshot }) => {
      queueMicrotask(() => {
        onStatus('live');
        onSnapshot(snapshot);
      });
      return {
        done: new Promise(() => {}),
        close: vi.fn()
      };
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('clears the loading state and renders observed alerts from the backend', async () => {
    render(<AdminAlertsPanel />);

    expect(screen.getByText('Đang đọc cảnh báo từ backend...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Tạo phụ đề thất bại')).toBeInTheDocument();
      expect(screen.getByText('Kết nối trực tiếp')).toBeInTheDocument();
    });

    expect(screen.queryByText('Đang đọc cảnh báo từ backend...')).not.toBeInTheDocument();
    expect(screen.getByText('Nguồn: PostgreSQL · lesson_subtitles')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Quản lý khóa học/ })).toHaveAttribute(
      'href',
      '/admin/dashboard?tab=courses'
    );
  });
});
