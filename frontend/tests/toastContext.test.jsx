import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { ToastProvider, useToast } from '../src/context/ToastContext';

const ToastHarness = () => {
  const showToast = useToast();

  return (
    <div>
      <button onClick={() => showToast('Hoàn thành', 'success')}>Success</button>
      <button onClick={() => showToast('Có lỗi xảy ra', 'error')}>Error</button>
      <button onClick={() => showToast('Sắp hết giờ', 'warning', { duration: 6500 })}>Warning</button>
      <button onClick={() => showToast('Thông tin mới', 'info')}>Info</button>
    </div>
  );
};

describe('ToastProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('xếp chồng nhiều toast và áp dụng đúng live-region theo type', () => {
    render(
      <ToastProvider>
        <ToastHarness />
      </ToastProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Success' }));
    fireEvent.click(screen.getByRole('button', { name: 'Error' }));
    fireEvent.click(screen.getByRole('button', { name: 'Info' }));

    expect(screen.getByText('Hoàn thành')).toBeInTheDocument();
    expect(screen.getByText('Có lỗi xảy ra').closest('[role="alert"]')).toHaveAttribute('aria-live', 'assertive');
    expect(screen.getByText('Thông tin mới').closest('[role="status"]')).toHaveAttribute('aria-live', 'polite');
    expect(screen.getAllByLabelText('Đóng thông báo')).toHaveLength(3);
  });

  it('tự đóng theo timer mặc định và cho phép đóng thủ công', () => {
    render(
      <ToastProvider>
        <ToastHarness />
      </ToastProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Success' }));
    fireEvent.click(screen.getByRole('button', { name: 'Error' }));

    const errorToast = screen.getByText('Có lỗi xảy ra').closest('[role="alert"]');
    fireEvent.click(within(errorToast).getByRole('button', { name: 'Đóng thông báo' }));
    expect(screen.queryByText('Có lỗi xảy ra')).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(3500);
    });
    expect(screen.queryByText('Hoàn thành')).not.toBeInTheDocument();
  });

  it('tôn trọng duration kéo dài cho thông báo quan trọng', () => {
    render(
      <ToastProvider>
        <ToastHarness />
      </ToastProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Warning' }));

    act(() => {
      vi.advanceTimersByTime(3500);
    });
    expect(screen.getByText('Sắp hết giờ')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.queryByText('Sắp hết giờ')).not.toBeInTheDocument();
  });
});
