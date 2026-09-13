import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PWAUpdatePrompt from '../src/components/common/PWAUpdatePrompt';

describe('PWAUpdatePrompt', () => {
  let originalServiceWorkerDescriptor;

  beforeEach(() => {
    originalServiceWorkerDescriptor = Object.getOwnPropertyDescriptor(navigator, 'serviceWorker');
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {},
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalServiceWorkerDescriptor) {
      Object.defineProperty(navigator, 'serviceWorker', originalServiceWorkerDescriptor);
    } else {
      delete navigator.serviceWorker;
    }
  });

  const renderPrompt = async ({ updateResult, user = { roleId: 1 } } = {}) => {
    let registrationOptions;
    const updateServiceWorker = updateResult || vi.fn().mockResolvedValue(undefined);
    const registerSW = vi.fn((options) => {
      registrationOptions = options;
      return updateServiceWorker;
    });
    const loadRegisterModule = vi.fn().mockResolvedValue({ registerSW });

    render(
      <PWAUpdatePrompt
        registrationEnabled
        loadRegisterModule={loadRegisterModule}
        user={user}
      />,
    );

    await waitFor(() => expect(registerSW).toHaveBeenCalledWith(expect.objectContaining({
      immediate: true,
      onNeedRefresh: expect.any(Function),
    })));

    return { registrationOptions, updateServiceWorker };
  };

  it('không reload và chỉ hiện lựa chọn khi có bản cập nhật', async () => {
    const { registrationOptions, updateServiceWorker } = await renderPrompt();

    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    act(() => registrationOptions.onNeedRefresh());

    expect(screen.getByRole('heading', { name: 'Có phiên bản mới' })).toBeInTheDocument();
    expect(updateServiceWorker).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Để sau' }));

    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
    expect(updateServiceWorker).not.toHaveBeenCalled();
  });

  it('chỉ kích hoạt service worker mới sau khi người dùng xác nhận', async () => {
    const { registrationOptions, updateServiceWorker } = await renderPrompt();

    act(() => registrationOptions.onNeedRefresh());
    fireEvent.click(screen.getByRole('button', { name: 'Cập nhật' }));

    expect(updateServiceWorker).toHaveBeenCalledTimes(1);
    expect(updateServiceWorker).toHaveBeenCalledWith(true);
    expect(screen.getByRole('button', { name: 'Đang cập nhật...' })).toBeDisabled();
  });

  it('giữ trang hoạt động và cho phép thử lại nếu kích hoạt thất bại', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const updateServiceWorker = vi.fn().mockRejectedValue(new Error('activation failed'));
    const { registrationOptions } = await renderPrompt({ updateResult: updateServiceWorker });

    act(() => registrationOptions.onNeedRefresh());
    fireEvent.click(screen.getByRole('button', { name: 'Cập nhật' }));

    expect(await screen.findByText('Không thể cập nhật ứng dụng. Bạn có thể tiếp tục học và thử lại sau.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cập nhật' })).toBeEnabled();
  });

  it('chỉ hiển thị thông báo cập nhật cho role admin, không hiển thị cho học viên và giảng viên', async () => {
    // 1. Kiểm tra role Học viên (roleId: 3) -> KHÔNG hiển thị
    const student = await renderPrompt({ user: { roleId: 3, role: 'student' } });
    act(() => student.registrationOptions.onNeedRefresh());
    expect(screen.queryByRole('heading', { name: 'Có phiên bản mới' })).not.toBeInTheDocument();

    // 2. Kiểm tra role Giảng viên (roleId: 2) -> KHÔNG hiển thị
    const instructor = await renderPrompt({ user: { roleId: 2, role: 'instructor' } });
    act(() => instructor.registrationOptions.onNeedRefresh());
    expect(screen.queryByRole('heading', { name: 'Có phiên bản mới' })).not.toBeInTheDocument();

    // 3. Kiểm tra khách vãng lai (user: null) -> KHÔNG hiển thị
    const guest = await renderPrompt({ user: null });
    act(() => guest.registrationOptions.onNeedRefresh());
    expect(screen.queryByRole('heading', { name: 'Có phiên bản mới' })).not.toBeInTheDocument();

    // 4. Kiểm tra role Admin (roleId: 1) -> ĐƯỢC HIỂN THỊ
    const admin = await renderPrompt({ user: { roleId: 1, role: 'admin' } });
    act(() => admin.registrationOptions.onNeedRefresh());
    expect(screen.getByRole('heading', { name: 'Có phiên bản mới' })).toBeInTheDocument();
  });
});
