import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // Dữ liệu cache có hiệu lực trong 5 phút
      refetchOnWindowFocus: false, // Không gọi lại API khi chuyển đổi cửa sổ
      retry: (failureCount, error) => {
        const status = error?.response?.status;
        // 4xx cần người dùng hoặc server thay đổi trạng thái. Retry ngay lập tức
        // (đặc biệt với 429) chỉ làm tăng thêm tải và kéo dài màn hình skeleton.
        if (status >= 400 && status < 500) return false;
        return failureCount < 2;
      }
    }
  }
});

export default queryClient;
