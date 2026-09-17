import React, { useState, useEffect, useCallback } from 'react';
import { 
  FiAward, FiClock, FiStar, FiRefreshCw, FiZap, FiUser, 
  FiCheckCircle, FiTrendingUp, FiArrowRight, FiShield, FiBookOpen 
} from 'react-icons/fi';
import { getGlobalQuizLeaderboard } from '../services/quizzes.service';
import { useAuth } from '../../../context/AuthContext';
import { useLanguage } from '../../../context/LanguageContext';
import { useNavigate } from 'react-router-dom';

const getRoleBadge = (roleId) => {
  const parsed = parseInt(roleId, 10);
  if (parsed === 1) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60">
        <FiShield className="text-[10px]" /> Quản trị viên
      </span>
    );
  }
  if (parsed === 2) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
        🎓 Giảng viên
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60">
      🎒 Học viên
    </span>
  );
};

const formatRelativeTime = (dateString, t) => {
  if (!dateString) return '—';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '—';
    const now = new Date();
    const diffMs = now - d;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return t('Vừa xong') || 'Vừa xong';
    if (diffMins < 60) return `${diffMins} phút trước`;
    if (diffHours < 24) return `${diffHours} giờ trước`;
    if (diffDays < 7) return `${diffDays} ngày trước`;
    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return '—';
  }
};

const AvatarDisplay = ({ avatar, name, className = 'w-10 h-10 text-sm' }) => {
  const initial = (name || 'U').trim().charAt(0).toUpperCase();
  if (avatar) {
    return (
      <img
        src={avatar}
        alt={name}
        className={`${className} rounded-full object-cover border border-slate-200 dark:border-slate-700 shadow-sm`}
        onError={(e) => {
          e.target.onerror = null;
          e.target.style.display = 'none';
          if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
        }}
      />
    );
  }
  return (
    <div
      className={`${className} rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 text-white font-black flex items-center justify-center shadow-sm uppercase select-none`}
    >
      {initial}
    </div>
  );
};

const GlobalLeaderboardSection = ({ onGoToQuizzes }) => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [timeframe, setTimeframe] = useState('all'); // 'all' | 'month' | 'week'
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const currentUserId = user ? parseInt(user.userId || user.user_id || user.id, 10) : null;

  const fetchLeaderboard = useCallback(async (isManualRefresh = false) => {
    try {
      if (isManualRefresh) setRefreshing(true);
      else setLoading(true);

      const data = await getGlobalQuizLeaderboard(timeframe, 20);
      setLeaderboard(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Lỗi tải Global Leaderboard:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [timeframe]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  const top1 = leaderboard[0] || null;
  const top2 = leaderboard[1] || null;
  const top3 = leaderboard[2] || null;
  const remainingRanks = leaderboard.slice(3);

  // Tìm vị trí của người dùng hiện tại
  const myRankEntry = currentUserId 
    ? leaderboard.find((item) => parseInt(item.user_id, 10) === currentUserId) 
    : null;

  return (
    <div className="w-full max-w-4xl animate-fade flex flex-col gap-8">
      {/* Header & Filter Controls */}
      <div className="bg-white dark:bg-slate-800/95 rounded-3xl p-6 sm:p-8 border border-slate-200/80 dark:border-slate-700/80 shadow-md flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="p-2 rounded-xl bg-amber-500/10 text-amber-500 dark:bg-amber-400/20 dark:text-amber-300">
              <FiAward className="text-xl" />
            </span>
            <span className="text-xs font-black uppercase tracking-widest text-amber-600 dark:text-amber-400">
              Hall of Fame
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight">
            {t('Bảng xếp hạng toàn hệ thống')}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-xl leading-relaxed">
            {t('Tôn vinh những người học xuất sắc nhất. Điểm số được tổng hợp từ kết quả cao nhất của mỗi đề thi (Fair-Play System).')}
          </p>
        </div>

        {/* Filter Pills & Refresh */}
        <div className="flex items-center gap-2 self-stretch md:self-auto justify-between md:justify-end flex-wrap">
          <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs font-bold">
            <button
              type="button"
              onClick={() => setTimeframe('all')}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                timeframe === 'all'
                  ? 'bg-white dark:bg-slate-800 text-smart-indigo dark:text-indigo-400 shadow-sm font-black'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              {t('Tất cả')}
            </button>
            <button
              type="button"
              onClick={() => setTimeframe('month')}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                timeframe === 'month'
                  ? 'bg-white dark:bg-slate-800 text-smart-indigo dark:text-indigo-400 shadow-sm font-black'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              {t('Tháng này')}
            </button>
            <button
              type="button"
              onClick={() => setTimeframe('week')}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                timeframe === 'week'
                  ? 'bg-white dark:bg-slate-800 text-smart-indigo dark:text-indigo-400 shadow-sm font-black'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              {t('Tuần này')}
            </button>
          </div>

          <button
            type="button"
            onClick={() => fetchLeaderboard(true)}
            disabled={loading || refreshing}
            title={t('Làm mới')}
            className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 transition-all cursor-pointer disabled:opacity-50"
          >
            <FiRefreshCw className={`${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Fair-Play Scoring Notice */}
      <div className="bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 rounded-2xl p-4 flex items-center gap-3 text-xs text-indigo-900 dark:text-indigo-200">
        <FiCheckCircle className="text-indigo-600 dark:text-indigo-400 text-lg flex-shrink-0" />
        <div>
          <span className="font-bold">Quy chế tính điểm công bằng: </span>
          <span>
            Hệ thống chỉ cộng điểm cao nhất (Best Score) mà bạn đạt được ở mỗi đề thi. Làm lại một đề thi nhiều lần sẽ không bị trùng điểm cày cuốc.
          </span>
        </div>
      </div>

      {/* Current User Status Banner (Vị trí của bạn) */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 shadow-lg border border-indigo-900/50 flex flex-col sm:flex-row items-center justify-between gap-6">
        {user ? (
          myRankEntry ? (
            <div className="flex items-center gap-4 w-full sm:w-auto">
              <div className="w-14 h-14 rounded-2xl bg-indigo-600/30 border border-indigo-400/30 flex flex-col items-center justify-center flex-shrink-0">
                <span className="text-[10px] uppercase font-bold text-indigo-300">Hạng</span>
                <span className="text-xl font-black text-amber-400">#{myRankEntry.rank}</span>
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-base font-black text-white">{myRankEntry.user_name}</h4>
                  {getRoleBadge(myRankEntry.role_id)}
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-300 mt-1 flex-wrap">
                  <span className="flex items-center gap-1 font-bold text-amber-300">
                    <FiStar className="fill-amber-300" /> {myRankEntry.total_score} điểm
                  </span>
                  <span>• {myRankEntry.total_quizzes_taken} đề đã thi</span>
                  <span>• TB {myRankEntry.average_score}%</span>
                  {myRankEntry.perfect_scores > 0 && (
                    <span className="text-emerald-400 font-bold">
                      • {myRankEntry.perfect_scores} lần điểm 100 💯
                    </span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 text-xl flex-shrink-0">
                <FiZap />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Bạn chưa có thứ hạng trong kỳ này</h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Làm ngay 1 đề thi trắc nghiệm để ghi danh vào Bảng xếp hạng toàn hệ thống!
                </p>
              </div>
            </div>
          )
        ) : (
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 text-xl flex-shrink-0">
              <FiUser />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">Đăng nhập để xem thứ hạng của bạn</h4>
              <p className="text-xs text-slate-400 mt-0.5">
                Tham gia thi trắc nghiệm, tích lũy điểm số và cạnh tranh thứ hạng với bạn học toàn quốc.
              </p>
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          {user ? (
            <button
              type="button"
              onClick={onGoToQuizzes}
              className="w-full sm:w-auto px-5 py-2.5 bg-smart-indigo hover:bg-indigo-600 text-white font-bold text-xs uppercase rounded-xl tracking-wider shadow-md transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
            >
              <span>{t('Làm đề thi ngay')}</span>
              <FiArrowRight />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="w-full sm:w-auto px-5 py-2.5 bg-smart-indigo hover:bg-indigo-600 text-white font-bold text-xs uppercase rounded-xl tracking-wider shadow-md transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
            >
              <span>{t('Đăng nhập')}</span>
              <FiArrowRight />
            </button>
          )}
        </div>
      </div>

      {/* Loading Skeleton */}
      {loading ? (
        <div className="flex flex-col gap-6 animate-pulse">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-64">
            <div className="bg-slate-200 dark:bg-slate-800 rounded-3xl h-full"></div>
            <div className="bg-slate-200 dark:bg-slate-800 rounded-3xl h-full"></div>
            <div className="bg-slate-200 dark:bg-slate-800 rounded-3xl h-full"></div>
          </div>
          <div className="h-64 bg-slate-200 dark:bg-slate-800 rounded-3xl"></div>
        </div>
      ) : leaderboard.length === 0 ? (
        /* Empty State */
        <div className="bg-white dark:bg-slate-800 rounded-3xl p-12 text-center border border-slate-200/80 dark:border-slate-700/80 flex flex-col items-center justify-center gap-4 shadow-sm">
          <div className="w-16 h-16 rounded-full bg-amber-500/10 dark:bg-amber-400/20 text-amber-500 dark:text-amber-300 flex items-center justify-center text-3xl">
            🏆
          </div>
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
            {t('Chưa có lượt thi nào trong khoảng thời gian này')}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md">
            {t('Hãy là người đầu tiên hoàn thành đề thi để chiếm lĩnh vị trí số 1 trên Bảng xếp hạng toàn hệ thống!')}
          </p>
          <button
            type="button"
            onClick={onGoToQuizzes}
            className="mt-2 px-6 py-2.5 bg-smart-indigo hover:bg-indigo-600 text-white font-bold text-xs uppercase rounded-xl tracking-wider shadow-md transition-all cursor-pointer"
          >
            {t('Chinh phục đề thi ngay')}
          </button>
        </div>
      ) : (
        <>
          {/* Top 3 Podium Visual */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end pt-6">
            {/* Rank 2 (Silver) */}
            <div className="order-2 md:order-1 bg-white dark:bg-slate-800/90 rounded-3xl p-6 border-2 border-slate-200 dark:border-slate-700 shadow-sm flex flex-col items-center text-center relative hover:shadow-md transition-all">
              <div className="absolute -top-5 w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 border-2 border-white dark:border-slate-800 flex items-center justify-center font-black text-slate-600 dark:text-slate-200 text-sm shadow-sm">
                🥈 2
              </div>
              {top2 ? (
                <>
                  <div className="mt-4 mb-3">
                    <AvatarDisplay avatar={top2.avatar} name={top2.user_name} className="w-16 h-16 text-lg" />
                  </div>
                  <h3 className="text-base font-black text-slate-800 dark:text-slate-100 truncate max-w-[200px]" title={top2.user_name}>
                    {top2.user_name}
                  </h3>
                  <div className="mt-1 mb-3">{getRoleBadge(top2.role_id)}</div>
                  <div className="w-full bg-slate-50 dark:bg-slate-900/60 rounded-2xl p-3 border border-slate-100 dark:border-slate-800/80 flex flex-col gap-1">
                    <span className="text-2xl font-black text-slate-700 dark:text-slate-200">
                      {top2.total_score} <span className="text-xs font-bold text-slate-400">pts</span>
                    </span>
                    <span className="text-[11px] text-slate-400 dark:text-slate-500 font-semibold">
                      {top2.total_quizzes_taken} đề • TB {top2.average_score}%
                    </span>
                  </div>
                </>
              ) : (
                <div className="py-12 text-slate-400 text-xs font-semibold">Chưa có dữ liệu</div>
              )}
            </div>

            {/* Rank 1 (Gold - Champion) */}
            <div className="order-1 md:order-2 bg-gradient-to-b from-amber-50/70 to-white dark:from-amber-950/30 dark:to-slate-800 rounded-3xl p-7 border-2 border-amber-400 dark:border-amber-500 shadow-xl shadow-amber-500/10 flex flex-col items-center text-center relative hover:scale-[1.02] transition-all">
              <div className="absolute -top-7 px-4 py-1 rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-900 font-black text-xs uppercase tracking-widest shadow-md flex items-center gap-1 border border-amber-200">
                👑 Quán quân
              </div>
              {top1 ? (
                <>
                  <div className="mt-3 mb-3 relative">
                    <div className="p-1 rounded-full bg-gradient-to-tr from-amber-400 via-yellow-300 to-amber-500 shadow-md">
                      <AvatarDisplay avatar={top1.avatar} name={top1.user_name} className="w-20 h-20 text-2xl" />
                    </div>
                  </div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white truncate max-w-[220px]" title={top1.user_name}>
                    {top1.user_name}
                  </h3>
                  <div className="mt-1 mb-3">{getRoleBadge(top1.role_id)}</div>
                  <div className="w-full bg-amber-100/50 dark:bg-amber-950/50 rounded-2xl p-4 border border-amber-200 dark:border-amber-900/60 flex flex-col gap-1">
                    <span className="text-3xl font-black text-amber-600 dark:text-amber-400 flex items-center justify-center gap-1">
                      <FiStar className="fill-amber-500 text-xl" /> {top1.total_score}{' '}
                      <span className="text-xs font-bold text-amber-700 dark:text-amber-300">pts</span>
                    </span>
                    <span className="text-xs text-amber-800/80 dark:text-amber-300/80 font-bold">
                      {top1.total_quizzes_taken} đề thi • TB {top1.average_score}%
                      {top1.perfect_scores > 0 && ` • 💯 ${top1.perfect_scores} lần`}
                    </span>
                  </div>
                </>
              ) : (
                <div className="py-12 text-slate-400 text-xs font-semibold">Chưa có dữ liệu</div>
              )}
            </div>

            {/* Rank 3 (Bronze) */}
            <div className="order-3 md:order-3 bg-white dark:bg-slate-800/90 rounded-3xl p-6 border-2 border-amber-800/30 dark:border-amber-900/50 shadow-sm flex flex-col items-center text-center relative hover:shadow-md transition-all">
              <div className="absolute -top-5 w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-950 border-2 border-white dark:border-slate-800 flex items-center justify-center font-black text-amber-800 dark:text-amber-400 text-sm shadow-sm">
                🥉 3
              </div>
              {top3 ? (
                <>
                  <div className="mt-4 mb-3">
                    <AvatarDisplay avatar={top3.avatar} name={top3.user_name} className="w-16 h-16 text-lg" />
                  </div>
                  <h3 className="text-base font-black text-slate-800 dark:text-slate-100 truncate max-w-[200px]" title={top3.user_name}>
                    {top3.user_name}
                  </h3>
                  <div className="mt-1 mb-3">{getRoleBadge(top3.role_id)}</div>
                  <div className="w-full bg-slate-50 dark:bg-slate-900/60 rounded-2xl p-3 border border-slate-100 dark:border-slate-800/80 flex flex-col gap-1">
                    <span className="text-2xl font-black text-slate-700 dark:text-slate-200">
                      {top3.total_score} <span className="text-xs font-bold text-slate-400">pts</span>
                    </span>
                    <span className="text-[11px] text-slate-400 dark:text-slate-500 font-semibold">
                      {top3.total_quizzes_taken} đề • TB {top3.average_score}%
                    </span>
                  </div>
                </>
              ) : (
                <div className="py-12 text-slate-400 text-xs font-semibold">Chưa có dữ liệu</div>
              )}
            </div>
          </div>

          {/* Ranks 4–20 Table */}
          {remainingRanks.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200/80 dark:border-slate-700/80 shadow-md overflow-hidden">
              <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-700/80 flex justify-between items-center">
                <h3 className="text-base font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
                  <FiTrendingUp className="text-smart-indigo dark:text-indigo-400" />
                  {t('Bảng xếp hạng chi tiết (Top 4 - 20)')}
                </h3>
                <span className="text-xs font-bold text-slate-400">
                  {remainingRanks.length} {t('người học')}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs sm:text-sm">
                  <thead>
                    <tr className="bg-slate-50/70 dark:bg-slate-900/40 text-slate-400 dark:text-slate-500 text-[11px] uppercase font-black tracking-wider border-b border-slate-100 dark:border-slate-700/60">
                      <th className="py-3 px-4 text-center w-16">Hạng</th>
                      <th className="py-3 px-4">Người học</th>
                      <th className="py-3 px-4 text-center">Tổng điểm</th>
                      <th className="py-3 px-4 text-center">Số đề đã thi</th>
                      <th className="py-3 px-4 text-center">Điểm TB</th>
                      <th className="py-3 px-4 text-center">Điểm 100/100</th>
                      <th className="py-3 px-4 text-right">Hoạt động</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                    {remainingRanks.map((item) => {
                      const isMe = currentUserId && parseInt(item.user_id, 10) === currentUserId;
                      return (
                        <tr
                          key={item.user_id}
                          className={`transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-700/30 ${
                            isMe
                              ? 'bg-indigo-50/60 dark:bg-indigo-950/40 font-bold border-l-4 border-l-smart-indigo'
                              : ''
                          }`}
                        >
                          <td className="py-3.5 px-4 text-center font-black text-slate-500 dark:text-slate-400">
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-700/80 text-xs">
                              #{item.rank}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <AvatarDisplay avatar={item.avatar} name={item.user_name} className="w-8 h-8 text-xs" />
                              <div className="flex flex-col">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-bold text-slate-800 dark:text-slate-200">
                                    {item.user_name}
                                  </span>
                                  {isMe && (
                                    <span className="px-1.5 py-0.2 rounded bg-indigo-500 text-white text-[9px] font-black uppercase">
                                      Bạn
                                    </span>
                                  )}
                                </div>
                                <div className="mt-0.5">{getRoleBadge(item.role_id)}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-center font-black text-smart-indigo dark:text-indigo-400">
                            {item.total_score}
                          </td>
                          <td className="py-3.5 px-4 text-center text-slate-600 dark:text-slate-300 font-semibold">
                            {item.total_quizzes_taken}
                          </td>
                          <td className="py-3.5 px-4 text-center text-slate-600 dark:text-slate-300 font-semibold">
                            {item.average_score}%
                          </td>
                          <td className="py-3.5 px-4 text-center text-slate-600 dark:text-slate-300">
                            {item.perfect_scores > 0 ? (
                              <span className="font-bold text-amber-500 dark:text-amber-400">
                                ⭐ {item.perfect_scores}
                              </span>
                            ) : (
                              '0'
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right text-slate-400 text-xs font-semibold">
                            {formatRelativeTime(item.last_activity_at, t)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default GlobalLeaderboardSection;
