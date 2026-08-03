import React from 'react';
import { Link } from 'react-router-dom';
import { FiBookOpen, FiGlobe, FiCode, FiDatabase, FiShield, FiHeart } from 'react-icons/fi';

const Footer = () => {
  return (
    <footer className="main-footer border-t border-teal-500/20 bg-slate-900/90 text-slate-300 py-12 backdrop-blur-md transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Brand Col */}
          <div className="md:col-span-1 space-y-4">
            <Link to="/" className="inline-flex items-center gap-2.5 text-xl font-extrabold text-teal-400 hover:text-teal-300 transition-colors">
              <div className="p-2 rounded-xl bg-teal-500/20 border border-teal-500/30 text-teal-400">
                <FiBookOpen className="w-5 h-5" />
              </div>
              <span className="tracking-tight">EngLearn Pro</span>
            </Link>
            <p className="text-xs text-slate-400 leading-relaxed">
              Nền tảng học tiếng Anh trực tuyến thế hệ mới tích hợp Trợ lý AI cá nhân hóa, phương pháp ghi nhớ phản xạ chủ động.
            </p>
            <div className="flex items-center space-x-3 text-slate-400">
              <span className="inline-flex items-center text-xs bg-teal-500/10 text-teal-400 border border-teal-500/20 px-2.5 py-1 rounded-full font-medium">
                <FiGlobe className="mr-1.5 w-3.5 h-3.5" /> Global English 2026
              </span>
            </div>
          </div>

          {/* Quick Navigation */}
          <div>
            <h3 className="text-sm font-semibold text-white tracking-wider uppercase mb-4">Khám phá</h3>
            <ul className="space-y-2.5 text-xs">
              <li><Link to="/courses" className="hover:text-teal-400 transition-colors">Chương trình học</Link></li>
              <li><Link to="/academy" className="hover:text-teal-400 transition-colors">Lộ trình Academy</Link></li>
              <li><Link to="/quizzes" className="hover:text-teal-400 transition-colors">Quiz & Trắc nghiệm</Link></li>
              <li><Link to="/my-courses" className="hover:text-teal-400 transition-colors">Khóa học của tôi</Link></li>
            </ul>
          </div>

          {/* Team Members & Roles (Mandatory Rule) */}
          <div className="md:col-span-2">
            <h3 className="text-sm font-semibold text-white tracking-wider uppercase mb-4 flex items-center gap-2">
              <FiCode className="text-teal-400" /> Đội Ngũ Thực Hiện Đồ Án
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/50 hover:border-teal-500/40 transition-colors">
                <p className="text-xs font-bold text-teal-300">NGUYỄN DŨNG QUỐC ANH</p>
                <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                  <FiCode className="w-3 h-3 text-teal-400 shrink-0" /> Frontend & AI UI Integration
                </p>
              </div>
              <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/50 hover:border-teal-500/40 transition-colors">
                <p className="text-xs font-bold text-teal-300">NGUYỄN THANH LIÊM</p>
                <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                  <FiShield className="w-3 h-3 text-emerald-400 shrink-0" /> Backend & Security
                </p>
              </div>
              <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/50 hover:border-teal-500/40 transition-colors">
                <p className="text-xs font-bold text-teal-300">LÊ ĐÌNH CHƯƠNG</p>
                <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                  <FiDatabase className="w-3 h-3 text-amber-400 shrink-0" /> Database & Infrastructure
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom copyright */}
        <div className="pt-6 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500">
          <p>© 2026 EngLearn Pro. All rights reserved.</p>
          <p className="flex items-center gap-1 mt-2 sm:mt-0">
            Phát triển với <FiHeart className="text-red-500 w-3.5 h-3.5" /> cho trải nghiệm học chuẩn Impeccable & UI-UX Pro Max
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

