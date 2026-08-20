import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiAlertCircle, FiCheck, FiChevronRight, FiCalendar, FiLoader, FiRefreshCw } from 'react-icons/fi';
import { useGamification } from '../../../context/GamificationContext';
import { useAuth } from '../../../context/AuthContext';

const FlameStreakWidget = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { streak, streakError, isGamificationLoading, reloadGamification } = useGamification();
  const [isOpen, setIsOpen] = useState(false);
  const widgetRef = useRef(null);

  if (!user) return null;

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (widgetRef.current && !widgetRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={widgetRef} className="relative inline-block text-left select-none z-40">
      {/* Header Widget Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-amber-500/10 via-rose-500/10 to-orange-500/10 border border-amber-500/30 hover:border-amber-500/60 shadow-sm hover:shadow-md transition-all active:scale-95 cursor-pointer font-bold text-xs"
        title="Bộ đếm chuỗi ngày học liên tiếp (Flame Streak)"
      >
        <span className="text-base" aria-hidden="true">🔥</span>
        <span className="font-black text-amber-700 dark:text-amber-300">
          {streakError
            ? 'Không khả dụng'
            : isGamificationLoading && !streak
              ? 'Đang tải...'
              : `${streak?.currentStreak ?? 0} Ngày`}
        </span>
      </button>

      {/* Glassmorphic Dropdown Popover */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-88 bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-2xl z-50 animate-fade space-y-4">
          
          {/* Header Banner */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-amber-500 to-rose-500 flex items-center justify-center text-white text-lg shadow-md animate-pulse">
                🔥
              </div>
              <div>
                <h4 className="font-extrabold text-sm text-slate-800 dark:text-slate-100 leading-snug">
                  Chuỗi Ngọn Lửa Luyện Tập
                </h4>
                <p className="text-[10.5px] font-bold text-slate-400">
                  Duy trì bài học mỗi ngày để bảo vệ chuỗi
                </p>
              </div>
            </div>
          </div>

          {streakError ? (
            <div className="rounded-2xl bg-rose-50 dark:bg-rose-950/30 p-4 text-center" role="alert">
              <FiAlertCircle className="mx-auto mb-2 text-2xl text-rose-600 dark:text-rose-400" aria-hidden="true" />
              <p className="text-sm font-bold text-rose-800 dark:text-rose-200">
                Không thể tải chuỗi học tập
              </p>
              <p className="mt-1 text-xs text-rose-700 dark:text-rose-300">
                Vui lòng thử lại sau.
              </p>
              <button
                type="button"
                onClick={reloadGamification}
                disabled={isGamificationLoading}
                className="mt-3 inline-flex items-center justify-center gap-2 rounded-xl bg-rose-700 px-4 py-2 text-xs font-bold text-white disabled:cursor-wait disabled:opacity-70"
              >
                <FiRefreshCw aria-hidden="true" />
                {isGamificationLoading ? 'Đang thử lại...' : 'Thử lại'}
              </button>
            </div>
          ) : isGamificationLoading && !streak ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm font-semibold text-slate-600 dark:text-slate-300" role="status">
              <FiLoader className="animate-spin" aria-hidden="true" />
              Đang tải chuỗi học tập...
            </div>
          ) : streak ? (
            <>

          {/* Key Stats Counter */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-2xl text-center">
              <span className="text-[10px] font-extrabold uppercase text-amber-600 dark:text-amber-400 tracking-wider block mb-0.5">
                Chuỗi hiện tại
              </span>
              <span className="text-2xl font-black text-amber-600 dark:text-amber-400">
                {streak?.currentStreak ?? 0} <span className="text-xs font-bold">Ngày 🔥</span>
              </span>
            </div>

            <div className="p-3 bg-indigo-500/5 border border-indigo-500/20 rounded-2xl text-center">
              <span className="text-[10px] font-extrabold uppercase text-indigo-600 dark:text-indigo-400 tracking-wider block mb-0.5">
                Kỷ lục chuỗi
              </span>
              <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                {streak?.longestStreak ?? 0} <span className="text-xs font-bold">Ngày 🏆</span>
              </span>
            </div>
          </div>

          {/* Weekly Attendance Checkin Grid */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs font-bold text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1">
                <FiCalendar className="text-amber-500" />
                <span>Nhật ký tuần này:</span>
              </span>
              <span className="text-emerald-500 font-extrabold">
                {(streak?.weeklyStatus || []).filter(d => d.active).length}/7 Ngày hoạt động
              </span>
            </div>

            <div className="grid grid-cols-7 gap-1.5">
              {(streak.weeklyStatus || []).map((item, idx) => (
                <div key={idx} className="flex flex-col items-center gap-1">
                  <div
                    className={`w-full aspect-square rounded-xl flex items-center justify-center text-xs font-bold shadow-sm transition-transform hover:scale-110 ${
                      item.active
                        ? 'bg-emerald-500 text-white shadow-emerald-500/30'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {item.active ? <FiCheck className="text-sm stroke-[3]" /> : item.day}
                  </div>
                  <span className="text-[9.5px] font-extrabold text-slate-400 dark:text-slate-500">
                    {item.day}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Navigation */}
          <div className="pt-2 space-y-2 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={() => {
                setIsOpen(false);
                navigate('/analytics');
              }}
              className="w-full py-2.5 px-3 bg-smart-indigo hover:bg-indigo-600 text-white font-bold text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-1 transition-all cursor-pointer shadow-md active:scale-98"
            >
              <span>Xem Bảng Phân Tích Analytics</span>
              <FiChevronRight />
            </button>
          </div>
            </>
          ) : null}

        </div>
      )}
    </div>
  );
};

export default FlameStreakWidget;
