import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import { FiAlertCircle, FiCheckCircle, FiMail, FiRefreshCw } from 'react-icons/fi';
import { resendVerificationEmailApi, verifyEmailApi } from '../services/auth.service';

const maskEmail = (email) => {
  const [localPart, domain] = String(email || '').split('@');
  if (!localPart || !domain) return '';
  const visible = localPart.slice(0, Math.min(2, localPart.length));
  return `${visible}${'*'.repeat(Math.max(2, localPart.length - visible.length))}@${domain}`;
};

const VerifyEmailPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const setAuthInteractiveState = useOutletContext()?.setAuthInteractiveState;
  const initialToken = useRef(new URLSearchParams(location.search).get('token') || '').current;
  const initialRouteState = useRef(location.state || null).current;
  const verificationRequest = useRef(null);
  const [email, setEmail] = useState(initialRouteState?.email || '');
  const [status, setStatus] = useState(initialToken ? 'verifying' : 'pending');
  const [message, setMessage] = useState(
    initialRouteState?.deliveryAccepted === false
      ? 'Tài khoản đã được tạo nhưng thư chưa gửi thành công. Hãy thử gửi lại bên dưới.'
      : 'Chúng tôi đã gửi một liên kết xác minh. Vui lòng kiểm tra cả hộp thư rác.'
  );
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    setAuthInteractiveState?.((previous) => ({
      ...previous,
      showPassword: false,
      isPasswordFocused: false,
      isEmailFocused: false
    }));
  }, [setAuthInteractiveState]);

  useEffect(() => {
    if (!initialToken) return undefined;

    let cancelled = false;
    if (!verificationRequest.current) {
      navigate('/verify-email', { replace: true, state: initialRouteState });
      verificationRequest.current = verifyEmailApi({ token: initialToken });
    }

    verificationRequest.current
      .then((result) => {
        if (cancelled) return;
        setStatus('success');
        setMessage(result.message || 'Email đã được xác minh thành công.');
      })
      .catch((error) => {
        if (cancelled) return;
        setStatus('error');
        setMessage(
          error.response?.data?.message
          || 'Không thể xác minh email. Liên kết có thể đã hết hạn hoặc đã được sử dụng.'
        );
      });

    return () => {
      cancelled = true;
    };
  }, [initialRouteState, initialToken, navigate]);

  const handleResend = async (event) => {
    event.preventDefault();
    if (!email || isResending) return;

    setIsResending(true);
    try {
      const result = await resendVerificationEmailApi({ email });
      setStatus('sent');
      setMessage(result.message || 'Nếu tài khoản đang chờ xác minh, một email mới sẽ được gửi trong ít phút.');
    } catch (error) {
      setStatus('error');
      setMessage(error.response?.data?.message || 'Không thể gửi lại email xác minh. Vui lòng thử lại sau.');
    } finally {
      setIsResending(false);
    }
  };

  const isSuccess = status === 'success';
  const isError = status === 'error';

  return (
    <>
      <h2 className="welcome-title">Xác minh email</h2>
      <p className="welcome-subtitle">
        {isSuccess ? 'Tài khoản của bạn đã sẵn sàng.' : 'Hoàn tất bước này để bảo vệ tài khoản của bạn.'}
      </p>

      <div
        className={`verification-status ${isSuccess ? 'success' : isError ? 'error' : ''}`}
        role={isError ? 'alert' : 'status'}
        aria-live={isError ? 'assertive' : 'polite'}
      >
        <span className="verification-status-icon" aria-hidden="true">
          {status === 'verifying' && <span className="spinner" />}
          {isSuccess && <FiCheckCircle />}
          {isError && <FiAlertCircle />}
          {(status === 'pending' || status === 'sent') && <FiMail />}
        </span>
        <div>
          <strong>
            {status === 'verifying' && 'Đang kiểm tra liên kết...'}
            {isSuccess && 'Xác minh thành công'}
            {isError && 'Chưa thể xác minh'}
            {status === 'pending' && 'Kiểm tra hộp thư của bạn'}
            {status === 'sent' && 'Yêu cầu đã được tiếp nhận'}
          </strong>
          <p>{message}</p>
          {email && !isSuccess && <small>Đã gửi tới {maskEmail(email)}</small>}
        </div>
      </div>

      {isSuccess ? (
        <button type="button" className="submit-btn" onClick={() => navigate('/login', { replace: true })}>
          Đăng nhập ngay
        </button>
      ) : status !== 'verifying' && (
        <form onSubmit={handleResend}>
          <label className="auth-field-label" htmlFor="verification-email">Email đăng ký</label>
          <div className="form-group">
            <div className="input-wrapper">
              <FiMail className="input-icon" />
              <input
                type="email"
                id="verification-email"
                name="email"
                placeholder="Email đăng ký"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                maxLength={255}
                required
              />
            </div>
          </div>
          <button type="submit" className="submit-btn" disabled={isResending}>
            {isResending ? <span className="spinner" /> : <><FiRefreshCw aria-hidden="true" /> Gửi lại email xác minh</>}
          </button>
        </form>
      )}

      <button type="button" className="auth-secondary-action" onClick={() => navigate('/login')}>
        Quay lại đăng nhập
      </button>
    </>
  );
};

export default VerifyEmailPage;
