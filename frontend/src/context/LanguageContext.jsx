import React, { createContext, useContext, useEffect, useState } from 'react';

const LanguageContext = createContext();

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
};

// English translations
const EN = {
  nav: {
    courses: 'Programs',
    academy: 'Academy',
    quizzes: 'Quizzes',
    features: 'Featured',
    pricing: 'Pricing'
  },
  header: {
    lightMode: 'Switch to light mode',
    darkMode: 'Switch to dark mode',
    profile: 'My Profile',
    adminDashboard: 'Admin Dashboard',
    instructorDashboard: 'Manage Courses',
    myLessons: 'My Lessons',
    logout: 'Logout',
    login: 'Login',
    register: 'Register',
    student: 'Student',
    loading: 'Loading permissions...'
  },
  auth: {
    email: 'Email',
    password: 'Password',
    confirmPassword: 'Confirm Password',
    login: 'Login',
    register: 'Register',
    forgotPassword: 'Forgot Password?',
    backToLogin: 'Back to Login',
    resetPassword: 'Reset Password',
    username: 'Username',
    fullName: 'Full Name',
    rememberMe: 'Remember me',
    loginSuccess: 'Login successful! Redirecting...',
    registerSuccess: 'Registration successful! Please log in.',
    passwordMismatch: 'Passwords do not match',
    passwordTooShort: 'Password must be at least 6 characters'
  },
  courses: {
    title: 'Programs',
    description: 'Explore our comprehensive English learning programs',
    enrollButton: 'Enroll Now',
    viewDetails: 'View Details',
    students: 'students enrolled',
    lessons: 'lessons',
    duration: 'Duration',
    level: 'Level'
  },
  academy: {
    title: 'Learning Roadmap',
    description: 'Choose your learning path',
    basic: 'Basic English',
    toeic: 'TOEIC 700+',
    ielts: 'IELTS Mastery',
    skillsLearned: 'You will learn:',
    viewPath: 'View Path',
    proLabel: 'PRO'
  },
  quizzes: {
    title: 'Quizzes',
    startQuiz: 'Start Quiz',
    questions: 'questions',
    timeLimit: 'Time limit',
    difficulty: 'Difficulty',
    submit: 'Submit',
    result: 'Result'
  },
  profile: {
    myProfile: 'My Profile',
    username: 'Username',
    email: 'Email',
    fullName: 'Full Name',
    joinDate: 'Join Date',
    coursesEnrolled: 'Courses Enrolled',
    certificatesEarned: 'Certificates Earned',
    learningStats: 'Learning Statistics',
    changePassword: 'Change Password',
    oldPassword: 'Old Password',
    newPassword: 'New Password',
    confirmPassword: 'Confirm Password',
    save: 'Save Changes',
    updateSuccess: 'Profile updated successfully!'
  },
  errors: {
    emailError: 'Email or password is incorrect',
    networkError: 'Network error. Please try again.',
    unauthorized: 'You do not have permission to access this page',
    notFound: 'Page not found',
    serverError: 'Server error. Please try again later.'
  },
  common: {
    loading: 'Loading...',
    saving: 'Saving...',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    search: 'Search',
    filter: 'Filter',
    close: 'Close',
    yes: 'Yes',
    no: 'No',
    confirm: 'Confirm'
  }
};

// Vietnamese translations
const VI = {
  nav: {
    courses: 'Khóa học',
    academy: 'Lộ trình',
    quizzes: 'Trắc nghiệm',
    features: 'Tính năng',
    pricing: 'Bảng giá'
  },
  header: {
    lightMode: 'Chuyển sang chế độ sáng',
    darkMode: 'Chuyển sang chế độ tối',
    profile: 'Trang cá nhân',
    adminDashboard: 'Quản trị hệ thống',
    instructorDashboard: 'Quản lý khóa học',
    myLessons: 'Bài học của tôi',
    logout: 'Đăng xuất',
    login: 'Đăng nhập',
    register: 'Đăng ký',
    student: 'Học viên',
    loading: 'Đang kiểm tra quyền truy cập...'
  },
  auth: {
    email: 'Email',
    password: 'Mật khẩu',
    confirmPassword: 'Xác nhận mật khẩu',
    login: 'Đăng nhập',
    register: 'Đăng ký',
    forgotPassword: 'Quên mật khẩu?',
    backToLogin: 'Quay lại đăng nhập',
    resetPassword: 'Đặt lại mật khẩu',
    username: 'Tên người dùng',
    fullName: 'Họ và tên',
    rememberMe: 'Ghi nhớ tôi',
    loginSuccess: 'Đăng nhập thành công! Đang chuyển hướng...',
    registerSuccess: 'Đăng ký thành công! Vui lòng đăng nhập.',
    passwordMismatch: 'Mật khẩu không khớp',
    passwordTooShort: 'Mật khẩu phải có ít nhất 6 ký tự'
  },
  courses: {
    title: 'Khóa học',
    description: 'Khám phá các chương trình học tiếng Anh toàn diện của chúng tôi',
    enrollButton: 'Đăng ký',
    viewDetails: 'Xem chi tiết',
    students: 'học viên đã đăng ký',
    lessons: 'bài học',
    duration: 'Thời lượng',
    level: 'Trình độ'
  },
  academy: {
    title: 'Lộ trình học tập',
    description: 'Chọn con đường học tập của bạn',
    basic: 'Tiếng Anh Cơ bản',
    toeic: 'TOEIC 700+',
    ielts: 'IELTS Mastery',
    skillsLearned: 'Bạn sẽ học được:',
    viewPath: 'Xem lộ trình',
    proLabel: 'PRO'
  },
  quizzes: {
    title: 'Trắc nghiệm',
    startQuiz: 'Bắt đầu',
    questions: 'câu hỏi',
    timeLimit: 'Giới hạn thời gian',
    difficulty: 'Độ khó',
    submit: 'Nộp bài',
    result: 'Kết quả'
  },
  profile: {
    myProfile: 'Trang cá nhân',
    username: 'Tên người dùng',
    email: 'Email',
    fullName: 'Họ và tên',
    joinDate: 'Ngày tham gia',
    coursesEnrolled: 'Khóa học đã đăng ký',
    certificatesEarned: 'Chứng chỉ nhận được',
    learningStats: 'Thống kê học tập',
    changePassword: 'Đổi mật khẩu',
    oldPassword: 'Mật khẩu cũ',
    newPassword: 'Mật khẩu mới',
    confirmPassword: 'Xác nhận mật khẩu',
    save: 'Lưu thay đổi',
    updateSuccess: 'Cập nhật trang cá nhân thành công!'
  },
  errors: {
    emailError: 'Email hoặc mật khẩu không chính xác',
    networkError: 'Lỗi mạng. Vui lòng thử lại.',
    unauthorized: 'Bạn không có quyền truy cập trang này',
    notFound: 'Không tìm thấy trang',
    serverError: 'Lỗi máy chủ. Vui lòng thử lại sau.'
  },
  common: {
    loading: 'Đang tải...',
    saving: 'Đang lưu...',
    cancel: 'Hủy',
    delete: 'Xóa',
    edit: 'Sửa',
    search: 'Tìm kiếm',
    filter: 'Lọc',
    close: 'Đóng',
    yes: 'Có',
    no: 'Không',
    confirm: 'Xác nhận'
  }
};

const translations = {
  en: EN,
  vi: VI
};

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState(() => {
    // Check localStorage first
    const saved = localStorage.getItem('app-language');
    if (saved && ['en', 'vi'].includes(saved)) {
      return saved;
    }
    // Fall back to browser language or English
    const browserLang = navigator.language.split('-')[0];
    return ['en', 'vi'].includes(browserLang) ? browserLang : 'en';
  });

  // Save language to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('app-language', language);
    document.documentElement.lang = language;
  }, [language]);

  const changeLanguage = (lang) => {
    if (['en', 'vi'].includes(lang)) {
      setLanguage(lang);
    }
  };

  const t = (key) => {
    // key format: "section.key" e.g., "header.profile"
    const keys = key.split('.');
    let current = translations[language];
    
    for (const k of keys) {
      if (current && typeof current === 'object' && k in current) {
        current = current[k];
      } else {
        // Fallback to English if translation not found
        current = translations.en;
        for (const k of keys) {
          current = current?.[k];
        }
        return current || key;
      }
    }
    
    return current || key;
  };

  const value = {
    language,
    changeLanguage,
    t,
    isEnglish: language === 'en',
    isVietnamese: language === 'vi'
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};
