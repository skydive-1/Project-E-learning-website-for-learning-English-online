import React, { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { FiArrowLeft } from 'react-icons/fi';
import InteractiveLoginCharacters from '../../../components/auth/InteractiveLoginCharacters';
import '../styles/auth.scss';

const AuthLayout = () => {
  const navigate = useNavigate();
  const [authInteractiveState, setAuthInteractiveState] = useState({
    showPassword: false,
    isPasswordFocused: false,
    isEmailFocused: false
  });

  return (
    <div className="auth-wrapper">
      <div className="auth-split-card">
        {/* Left Pane - Characters Centered */}
        <div className="auth-left-pane">
          <div className="w-full flex items-center justify-between z-10">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-[#6047EC] flex items-center justify-center text-sm font-black text-white shadow-sm">
                E
              </div>
              <span className="brand-logo-text text-sm font-bold tracking-tight">
                E-Learn Academy
              </span>
            </div>
          </div>

          <div className="w-full flex-1 flex items-center justify-center my-auto py-4">
            <InteractiveLoginCharacters
              showPassword={authInteractiveState.showPassword}
              isPasswordFocused={authInteractiveState.isPasswordFocused}
              isEmailFocused={authInteractiveState.isEmailFocused}
            />
          </div>
        </div>

        {/* Right Pane - Form Area */}
        <div className="auth-right-pane">
          <button 
            type="button" 
            className="auth-back-nav" 
            onClick={() => navigate('/')}
            aria-label="Quay lại trang chủ"
          >
            <FiArrowLeft className="w-4 h-4" /> <span>Quay lại trang chủ</span>
          </button>
          <Outlet context={{ authInteractiveState, setAuthInteractiveState }} />
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
