import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    // Cập nhật trạng thái để lần render tiếp theo hiển thị giao diện fallback
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Bạn cũng có thể gửi báo cáo lỗi đến dịch vụ giám sát lỗi tại đây (như Sentry)
    console.error("ErrorBoundary đã bắt được lỗi:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      // Nếu có truyền fallback UI tùy chỉnh từ ngoài vào
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Giao diện fallback mặc định thân thiện
      return (
        <div style={{
          padding: '24px',
          border: '1px solid #fee2e2',
          backgroundColor: '#fef2f2',
          borderRadius: '12px',
          textAlign: 'center',
          fontFamily: 'sans-serif',
          margin: this.props.margin || '0'
        }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '15px', fontWeight: '700', color: '#991b1b' }}>
            {this.props.title || "Tính năng này tạm thời gặp sự cố"}
          </h3>
          <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#b91c1c', lineHeight: '1.5' }}>
            {this.props.message || "Đã xảy ra lỗi trong quá trình hiển thị. Bạn có thể tải lại trang hoặc reset trạng thái để thử lại."}
          </p>
          {this.state.error && (
            <div style={{
              margin: '0 auto 16px auto',
              padding: '10px 14px',
              backgroundColor: '#fff',
              border: '1px solid #fca5a5',
              borderRadius: '8px',
              maxWidth: '600px',
              textAlign: 'left',
              overflowX: 'auto',
              fontSize: '11px',
              fontFamily: 'monospace',
              color: '#7f1d1d'
            }}>
              <strong>Chi tiết lỗi:</strong> {this.state.error.toString()}
            </div>
          )}
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
            <button
              onClick={this.handleReset}
              style={{
                padding: '8px 14px',
                backgroundColor: '#ef4444',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'background-color 0.2s'
              }}
              onMouseOver={(e) => e.target.style.backgroundColor = '#dc2626'}
              onMouseOut={(e) => e.target.style.backgroundColor = '#ef4444'}
            >
              Thử lại
            </button>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '8px 14px',
                backgroundColor: '#fff',
                color: '#475569',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'background-color 0.2s'
              }}
              onMouseOver={(e) => e.target.style.backgroundColor = '#f8fafc'}
              onMouseOut={(e) => e.target.style.backgroundColor = '#fff'}
            >
              Tải lại trang
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
