import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
// Giữ eager (tải ngay) chỉ những trang vào đầu tiên với tần suất cao nhất,
// để không có màn hình loading nháy khi vừa mở web. Mọi trang còn lại
// chuyển sang React.lazy() để mỗi route chỉ tải đúng code nó cần,
// thay vì gộp hết (kể cả Shaka Player, Recharts, react-pdf...) vào 1 bundle
// duy nhất tải cho MỌI người dùng bất kể họ vào trang nào.
import LoginPage from './modules/auth/pages/LoginPage';
import HomePage from './modules/homepage/pages/HomePage';
import AuthLayout from './modules/auth/components/AuthLayout';

const RegisterPage = lazy(() => import('./modules/auth/pages/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('./modules/auth/pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./modules/auth/pages/ResetPasswordPage'));
const ProfilePage = lazy(() => import('./modules/profile/pages/ProfilePage'));
const LessonDetailPage = lazy(() => import('./modules/lessons/pages/LessonDetailPage'));
const CourseListPage = lazy(() => import('./modules/courses/pages/CourseListPage'));
const MyCoursesPage = lazy(() => import('./modules/courses/pages/MyCoursesPage'));
const RoadmapPage = lazy(() => import('./modules/academy/pages/RoadmapPage'));
const RoadmapDetailPage = lazy(() => import('./modules/academy/pages/RoadmapDetailPage'));
const InstructorDashboard = lazy(() => import('./modules/instructor/pages/InstructorDashboard'));
const CourseEditor = lazy(() => import('./modules/instructor/pages/CourseEditor'));
const AdminDashboard = lazy(() => import('./modules/admin/pages/AdminDashboard'));
const QuizzesListPage = lazy(() => import('./modules/quizzes/pages/QuizzesListPage'));
const PlayQuizPage = lazy(() => import('./modules/quizzes/pages/PlayQuizPage'));
const AnalyticsDashboardPage = lazy(() => import('./modules/analytics/pages/AnalyticsDashboardPage'));

import ProtectedRoute from './components/common/ProtectedRoute';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { LanguageProvider } from './context/LanguageContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ErrorBoundary from './components/common/ErrorBoundary';
import GlobalChatbot from './components/common/GlobalChatbot';
import OfflineIndicator from './components/common/OfflineIndicator';
import MobileBottomNav from './components/common/MobileBottomNav';
import { GamificationProvider } from './context/GamificationContext';
import { ToastProvider } from './context/ToastContext';
import BadgeUnlockModal from './modules/gamification/components/BadgeUnlockModal';
import ClickParticleEffect from './components/common/ClickParticleEffect';
import RouteScrollManager from './components/common/RouteScrollManager';

// Fallback tối giản, không gây layout shift, hiển thị trong lúc chunk của
// route đang tải (thường chỉ vài chục-vài trăm ms trên mạng bình thường).
const RouteLoadingFallback = () => (
  <div
    role="status"
    aria-label="Đang tải trang"
    className="flex min-h-[40vh] w-full items-center justify-center"
  >
    <div className="size-8 animate-spin rounded-full border-2 border-slate-200 border-t-blue-500 dark:border-slate-700 dark:border-t-blue-400" />
  </div>
);

const queryClient = new QueryClient({
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

const AuthTokenRedirectHandler = () => {
  const navigate = useNavigate();
  React.useEffect(() => {
    const hash = window.location.hash;
    const search = window.location.search;
    if ((hash.includes('access_token=') || hash.includes('type=recovery') || search.includes('type=recovery')) && window.location.pathname !== '/reset-password') {
      navigate(`/reset-password${hash || search}`, { replace: true });
    }
  }, [navigate]);
  return null;
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <ThemeProvider>
          <LanguageProvider>
            <ToastProvider>
              <BrowserRouter>
                <RouteScrollManager />
                <AuthTokenRedirectHandler />
                <AuthProvider>
                  <GamificationProvider>
                  <Suspense fallback={<RouteLoadingFallback />}>
                  <Routes>
                    {/* Public Landing Route */}
                    <Route path="/" element={<HomePage />} />
                    <Route path="/courses" element={<CourseListPage />} />
                    <Route path="/academy" element={<RoadmapPage />} />
                    <Route path="/academy/:roadmapId" element={<RoadmapDetailPage />} />
                    
                    {/* Entertainment Standalone Quizzes */}
                    <Route path="/quizzes" element={<QuizzesListPage />} />
                    <Route path="/quizzes/play/:quizId" element={<PlayQuizPage />} />

                    {/* Auth Routes with Shared Layout */}
                    <Route element={<AuthLayout />}>
                      <Route path="/login" element={<LoginPage />} />
                      <Route path="/register" element={<RegisterPage />} />
                      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                      <Route path="/reset-password" element={<ResetPasswordPage />} />
                    </Route>

                    {/* Protected Routes */}
                    <Route
                      path="/profile"
                      element={
                        <ProtectedRoute>
                          <ProfilePage />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/my-courses"
                      element={
                        <ProtectedRoute>
                          <MyCoursesPage />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/analytics"
                      element={
                        <ProtectedRoute>
                          <AnalyticsDashboardPage />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/lessons"
                      element={
                        <ProtectedRoute>
                          <LessonDetailPage />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/lessons/:lessonId"
                      element={
                        <ProtectedRoute>
                          <LessonDetailPage />
                        </ProtectedRoute>
                      }
                    />

                    {/* Instructor Routes */}
                    <Route
                      path="/instructor/dashboard"
                      element={
                        <ProtectedRoute allowedRoles={[1, 2]}>
                          <InstructorDashboard />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/instructor/create-course"
                      element={
                        <ProtectedRoute allowedRoles={[1, 2]}>
                          <CourseEditor />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/instructor/edit-course/:courseId"
                      element={
                        <ProtectedRoute allowedRoles={[1, 2]}>
                          <CourseEditor />
                        </ProtectedRoute>
                      }
                    />

                    {/* Admin Routes */}
                    <Route
                      path="/admin/dashboard"
                      element={
                        <ProtectedRoute allowedRoles={[1]}>
                          <AdminDashboard />
                        </ProtectedRoute>
                      }
                    />

                    {/* Catch All - Redirect to home */}
                    <Route
                      path="*"
                      element={<Navigate to="/" replace />}
                    />
                  </Routes>
                  </Suspense>
                  <GlobalChatbot />
                  <MobileBottomNav />
                  <BadgeUnlockModal />
                  <OfflineIndicator />
                  <ClickParticleEffect />
                  </GamificationProvider>
                </AuthProvider>
              </BrowserRouter>
            </ToastProvider>
          </LanguageProvider>
        </ThemeProvider>
      </ErrorBoundary>
    </QueryClientProvider>
  );
}

export default App;
