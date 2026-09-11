import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  getAdminAlerts: vi.fn(),
  connectAdminAlertsStream: vi.fn(),
  cleanupAdminAlerts: vi.fn(),
  showToast: vi.fn()
}));

vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({ user: { userId: 4, roleId: 1 } })
}));

vi.mock('../src/context/ToastContext', () => ({
  useToast: () => mocks.showToast
}));

vi.mock('../src/modules/admin/services/adminAlerts.service', () => ({
  getAdminAlerts: mocks.getAdminAlerts,
  connectAdminAlertsStream: mocks.connectAdminAlertsStream,
  cleanupAdminAlerts: mocks.cleanupAdminAlerts
}));

import AdminAlertsPanel from '../src/modules/admin/components/AdminAlertsPanel';

const snapshot = {
  generatedAt: '2026-09-10T02:00:00.000Z',
  source: 'PostgreSQL và telemetry runtime của backend',
  alerts: [{
    id: 'subtitle-93',
    type: 'failed_upload',
    severity: 'medium',
    title: 'Tạo phụ đề thất bại',
    message: 'Bài “Listening 1” cần được tạo lại phụ đề.',
    timestamp: '2026-09-10T01:59:00.000Z',
    actionUrl: '/instructor/edit-course/37?tab=curriculum&lessonId=87&issue=subtitle-failed',
    actionLabel: 'Mở đúng bài học',
    source: 'PostgreSQL · lesson_subtitles · bài #87',
    entity: { type: 'subtitle', id: 93, courseId: 37, lessonId: 87 }
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

    expect(screen.queryByRole('heading', { name: 'Cảnh báo vận hành' })).not.toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Tạo phụ đề thất bại')).toBeInTheDocument();
      expect(screen.getByText('Kết nối trực tiếp')).toBeInTheDocument();
    });

    expect(screen.queryByText('Đang đọc cảnh báo từ backend...')).not.toBeInTheDocument();
    expect(screen.getByText('Nguồn: PostgreSQL · lesson_subtitles · bài #87')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Mở đúng bài học/ })).toHaveAttribute(
      'href',
      '/instructor/edit-course/37?tab=curriculum&lessonId=87&issue=subtitle-failed'
    );
  });

  it('stays hidden while monitoring when the backend reports no alerts', async () => {
    const healthySnapshot = { ...snapshot, alerts: [] };
    mocks.getAdminAlerts.mockResolvedValue(healthySnapshot);
    mocks.connectAdminAlertsStream.mockImplementation(({ onStatus, onSnapshot }) => {
      queueMicrotask(() => {
        onStatus('live');
        onSnapshot(healthySnapshot);
      });
      return {
        done: new Promise(() => {}),
        close: vi.fn()
      };
    });

    render(<AdminAlertsPanel />);

    await waitFor(() => expect(mocks.getAdminAlerts).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('heading', { name: 'Cảnh báo vận hành' })).not.toBeInTheDocument();
    expect(screen.queryByText('Không phát hiện vấn đề cần xử lý')).not.toBeInTheDocument();
  });

  it('removes a resolved alert and hides the whole panel immediately', async () => {
    let streamCallback;
    mocks.connectAdminAlertsStream.mockImplementation(({ onStatus, onSnapshot }) => {
      streamCallback = onSnapshot;
      queueMicrotask(() => {
        onStatus('live');
        onSnapshot(snapshot);
      });
      return {
        done: new Promise(() => {}),
        close: vi.fn()
      };
    });

    render(<AdminAlertsPanel />);

    await waitFor(() => {
      expect(screen.getByText('Tạo phụ đề thất bại')).toBeInTheDocument();
    });

    // Mô phỏng snapshot tiếp theo khi lỗi đã được Admin fix (danh sách alerts rỗng)
    const fixedSnapshot = { ...snapshot, alerts: [] };
    act(() => {
      streamCallback(fixedSnapshot);
    });

    await waitFor(() => {
      expect(mocks.showToast).toHaveBeenCalledWith(
        expect.stringContaining('Đã khắc phục xong'),
        'success',
        expect.any(Object)
      );
      expect(screen.queryByRole('heading', { name: 'Cảnh báo vận hành' })).not.toBeInTheDocument();
      expect(screen.queryByText('Tạo phụ đề thất bại')).not.toBeInTheDocument();
    });
  });
});
