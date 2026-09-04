import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import InstructorCopyrightPolicyModal from '../src/modules/instructor/components/InstructorCopyrightPolicyModal';

describe('InstructorCopyrightPolicyModal', () => {
  it('không render khi isOpen là false', () => {
    const { container } = render(
      <InstructorCopyrightPolicyModal isOpen={false} onClose={() => {}} onAccept={() => {}} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('hiển thị đầy đủ tiêu đề và nội dung chính sách pháp lý khi mở', () => {
    render(
      <InstructorCopyrightPolicyModal
        isOpen={true}
        onClose={() => {}}
        onAccept={() => {}}
        courseName="Luyện thi IELTS 7.5+ Cấp tốc"
        sectionsCount={5}
        lessonsCount={20}
      />
    );

    // Kiểm tra các căn cứ pháp luật và tiêu đề
    expect(screen.getByText(/Thỏa thuận Sở hữu Trí tuệ & Xuất bản Khóa học/i)).toBeInTheDocument();
    expect(screen.getByText(/VĂN BẢN QUY CHUẨN SỐ 102\/QĐ-ELP/i)).toBeInTheDocument();
    expect(screen.getByText(/Luật Sở hữu trí tuệ số 50\/2005\/QH11/i)).toBeInTheDocument();
    expect(screen.getByText(/Nghị định số 17\/2023\/NĐ-CP/i)).toBeInTheDocument();
    expect(screen.getByText(/Đạo luật Bản quyền Thiên niên kỷ Kỹ thuật số/i)).toBeInTheDocument();

    // Kiểm tra các điều khoản quan trọng
    expect(screen.getByText(/Điều 1: Khái niệm & Đối tượng Tài liệu được Bảo hộ/i)).toBeInTheDocument();
    expect(screen.getByText(/Điều 2: Cam kết Quyền sở hữu Nguyên bản & Quyền sử dụng Hợp pháp/i)).toBeInTheDocument();
    expect(screen.getByText(/Điều 5: Công nghệ Bảo mật & Chống Tải Lậu của E-Learn Academy/i)).toBeInTheDocument();
    expect(screen.getByText(/Điều 7: Nghĩa vụ Miễn trừ & Bồi hoàn Thiệt hại/i)).toBeInTheDocument();

    // Ban đầu nút xuất bản phải bị disabled
    const submitBtn = screen.getByRole('button', { name: /Tôi Đồng Ý & Xuất Bản Khóa Học/i });
    expect(submitBtn).toBeDisabled();
  });

  it('không cho phép tích chọn checkbox khi chưa cuộn hết văn bản', () => {
    render(
      <InstructorCopyrightPolicyModal
        isOpen={true}
        onClose={() => {}}
        onAccept={() => {}}
        courseName="Khóa học thử nghiệm"
      />
    );

    // Tìm dòng cam kết 1
    const checkbox1 = screen.getByText(/1. Cam kết Quyền sở hữu Hợp pháp/i).closest('div');
    fireEvent.click(checkbox1);

    // Vẫn hiển thị thông báo cần cuộn hết văn bản
    expect(screen.getByText(/Vui lòng cuộn chuột đọc hết chính sách/i)).toBeInTheDocument();

    // Nút xuất bản vẫn bị disabled
    const submitBtn = screen.getByRole('button', { name: /Tôi Đồng Ý & Xuất Bản Khóa Học/i });
    expect(submitBtn).toBeDisabled();
  });

  it('mở khóa checkbox khi cuộn văn bản xuống cuối', async () => {
    const mockAccept = vi.fn();
    const { container } = render(
      <InstructorCopyrightPolicyModal
        isOpen={true}
        onClose={() => {}}
        onAccept={mockAccept}
        courseName="Khóa học thử nghiệm"
      />
    );

    const scrollContainer = container.querySelector('.custom-scrollbar');
    expect(scrollContainer).toBeInTheDocument();

    // Giả lập cuộn chạm đáy
    Object.defineProperty(scrollContainer, 'scrollHeight', { value: 1000, configurable: true });
    Object.defineProperty(scrollContainer, 'clientHeight', { value: 400, configurable: true });
    Object.defineProperty(scrollContainer, 'scrollTop', { value: 590, configurable: true });

    await React.act(async () => {
      fireEvent.scroll(scrollContainer);
    });

    // Tích chọn cả 2 cam kết
    const checkbox1 = screen.getByText(/1. Cam kết Quyền sở hữu Hợp pháp/i).closest('div');
    const checkbox2 = screen.getByText(/2. Cam kết Bồi hoàn & Trách nhiệm Pháp lý/i).closest('div');

    await React.act(async () => {
      fireEvent.click(checkbox1);
      fireEvent.click(checkbox2);
    });

    // Lúc này nút xuất bản đã được kích hoạt
    const submitBtn = screen.getByRole('button', { name: /Tôi Đồng Ý & Xuất Bản Khóa Học/i });
    expect(submitBtn).not.toBeDisabled();

    // Bấm xuất bản
    await React.act(async () => {
      fireEvent.click(submitBtn);
    });
    expect(mockAccept).toHaveBeenCalledTimes(1);
  });
});
