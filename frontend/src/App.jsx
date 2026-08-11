import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './modules/auth/pages/LoginPage';
import RegisterPage from './modules/auth/pages/RegisterPage';
import ForgotPasswordPage from './modules/auth/pages/ForgotPasswordPage';
import ResetPasswordPage from './modules/auth/pages/ResetPasswordPage';
import HomePage from './modules/homepage/pages/HomePage';
import AuthLayout from './modules/auth/components/AuthLayout';
import ProfilePage from './modules/profile/pages/ProfilePage';
import LessonDetailPage from './modules/lessons/pages/LessonDetailPage';
import CourseListPage from './modules/courses/pages/CourseListPage';
import MyCoursesPage from './modules/courses/pages/MyCoursesPage';
import RoadmapPage from './modules/academy/pages/RoadmapPage';
import InstructorDashboard from './modules/instructor/pages/InstructorDashboard';
import CourseEditor from './modules/instructor/pages/CourseEditor';
import ProtectedRoute from './components/common/ProtectedRoute';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { LanguageProvider } from './context/LanguageContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ErrorBoundary from './components/common/ErrorBoundary';
import QuizzesListPage from './modules/quizzes/pages/QuizzesListPage';
import PlayQuizPage from './modules/quizzes/pages/PlayQuizPage';
import GlobalChatbot from './components/common/GlobalChatbot';
import AnalyticsDashboardPage from './modules/analytics/pages/AnalyticsDashboardPage';
import { GamificationProvider } from './context/GamificationContext';
import BadgeUnlockModal from './modules/gamification/components/BadgeUnlockModal';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // Dữ liệu cache có hiệu lực trong 5 phút
      refetchOnWindowFocus: false // Không gọi lại API khi chuyển đổi cửa sổ
    }
  }
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <ThemeProvider>
          <LanguageProvider>
            <BrowserRouter>
              <AuthProvider>
                <GamificationProvider>
                  <Routes>
                    {/* Public Landing Route */}
                    <Route path="/" element={<HomePage />} />
                    <Route path="/courses" element={<CourseListPage />} />
                    <Route path="/academy" element={<RoadmapPage />} />
                    
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
                  <GlobalChatbot />
                  <BadgeUnlockModal />
                </GamificationProvider>
              </AuthProvider>
            </BrowserRouter>
          </LanguageProvider>
        </ThemeProvider>
      </ErrorBoundary>
    </QueryClientProvider>
  );
}

export default App;
