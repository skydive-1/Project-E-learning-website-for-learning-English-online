import React, { createContext, useContext, useState, useEffect } from 'react';

const translations = {
  VIE: {
    // Header & Nav
    courses: "Khóa học",
    roadmap: "Lộ trình",
    quizzes: "Trắc nghiệm",
    features: "Tính năng",
    pricing: "Bảng giá",
    login: "Đăng nhập",
    register: "Đăng ký",
    profile: "Trang cá nhân",
    adminDashboard: "Quản trị hệ thống",
    instructorDashboard: "Quản lý khóa học",
    myCourses: "Bài học của tôi",
    logout: "Đăng xuất",
    student: "Học viên",
    switchLangTip: "Chuyển sang Tiếng Anh",

    // Hero / Home Page
    heroBadge: "🚀 Trợ Lý Học Tiếng Anh AI Thông Minh",
    heroTitlePrefix: "Chinh Phục Tiếng Anh Tự Nhiên Cùng",
    heroTitleSuffix: "E-Learn Academy",
    heroSubtitle: "Hệ thống học tập kết hợp trí tuệ nhân tạo AI RAG, luyện nghe video chuẩn bảo mật, thực hành nói phản xạ tự do và nhận xét phát âm chuyên sâu.",
    btnStartLearning: "Khám Phá Khóa Học",
    btnViewRoadmap: "Xem Lộ Trình Học",
    featuresTitle: "Tính Năng Nổi Bật",
    featuresSubtitle: "Học tập hiệu quả hơn với công nghệ AI đột phá",
    coursesTitle: "Khóa Học Tiêu Biểu",
    coursesSubtitle: "Được thiết kế chuẩn khung tham chiếu Châu Âu (CEFR)",
    aiTutorTitle: "Giao Tiếp & Phản Xạ Cùng AI",
    aiTutorSubtitle: "Trợ lý ảo 24/7 giải đáp mọi thắc mắc ngữ pháp và chấm điểm phát âm",

    // Course List Page
    allCourses: "Tất cả khóa học",
    beginner: "Cơ bản",
    intermediate: "Trung cấp",
    advanced: "Nâng cao",
    searchPlaceholder: "Tìm kiếm khóa học...",
    enrollNow: "Học ngay",
    viewDetail: "Xem chi tiết",
    lessonsCount: "bài học",

    // Quizzes Page
    quizzesHeaderTitle: "Bài Tập Trắc Nghiệm Phản Xạ",
    quizzesHeaderSubtitle: "Thực hành bài tập trắc nghiệm ngắn tương tác giúp củng cố từ vựng và ngữ pháp nhanh chóng.",
    startQuiz: "Làm bài ngay",
    correctAnswer: "Chính xác!",
    wrongAnswer: "Chưa đúng!",
    quizCompleted: "Hoàn thành bài tập!",
    yourScore: "Điểm số của bạn",
    playAgain: "Làm lại bài",
    nextQuestion: "Câu tiếp theo",
    viewResults: "Xem kết quả",

    // Roadmap Page
    roadmapHeaderTitle: "Lộ Trình Học Tập Chuẩn Quốc Tế",
    roadmapHeaderSubtitle: "Đi từng bước từ mất gốc đến giao tiếp tự tin và thành thạo tiếng Anh.",
    step1Title: "Giai Đoạn 1: Nền Tảng Từ Vựng & Phát Âm",
    step2Title: "Giai Đoạn 2: Ngữ Pháp & Phản Xạ Nói",
    step3Title: "Giai Đoạn 3: Giao Tiếp Tự Tin & Thành Thạo",

    // Chatbot AI
    aiAssistantTitle: "Trợ Lý Học Tiếng Anh AI",
    aiAssistantSub: "Học tập & Phản xạ tự do",
    tokenLimitLabel: "Hạn mức Token AI hôm nay",
    askInputPlaceholder: "Hỏi câu hỏi bất kỳ...",
    clearChatHistory: "Xóa lịch sử trò chuyện",

    // Profile & Misc
    myProgress: "Tiến độ học tập",
    accountSettings: "Cài đặt tài khoản",
    saveChanges: "Lưu thay đổi",
    loginRequired: "Vui lòng đăng nhập để sử dụng tính năng này"
  },
  ENG: {
    // Header & Nav
    courses: "Courses",
    roadmap: "Roadmap",
    quizzes: "Quizzes",
    features: "Features",
    pricing: "Pricing",
    login: "Login",
    register: "Register",
    profile: "My Profile",
    adminDashboard: "Admin Panel",
    instructorDashboard: "Instructor Panel",
    myCourses: "My Courses",
    logout: "Logout",
    student: "Student",
    switchLangTip: "Switch to Vietnamese",

    // Hero / Home Page
    heroBadge: "🚀 Smart AI English Learning Assistant",
    heroTitlePrefix: "Master English Naturally With",
    heroTitleSuffix: "E-Learn Academy",
    heroSubtitle: "An intelligent learning system combining AI RAG, secure video listening, free conversational speaking practice, and detailed pronunciation feedback.",
    btnStartLearning: "Explore Courses",
    btnViewRoadmap: "View Roadmap",
    featuresTitle: "Core Features",
    featuresSubtitle: "Learn more efficiently with breakthrough AI technology",
    coursesTitle: "Featured Courses",
    coursesSubtitle: "Designed according to standard CEFR framework",
    aiTutorTitle: "Speak & Practice With AI",
    aiTutorSubtitle: "Your 24/7 virtual tutor answering grammar questions and scoring pronunciation",

    // Course List Page
    allCourses: "All Courses",
    beginner: "Beginner",
    intermediate: "Intermediate",
    advanced: "Advanced",
    searchPlaceholder: "Search courses...",
    enrollNow: "Enroll Now",
    viewDetail: "View Details",
    lessonsCount: "lessons",

    // Quizzes Page
    quizzesHeaderTitle: "Interactive Quizzes",
    quizzesHeaderSubtitle: "Practice quick interactive quizzes to solidify your vocabulary and grammar rapidly.",
    startQuiz: "Start Quiz",
    correctAnswer: "Correct!",
    wrongAnswer: "Incorrect!",
    quizCompleted: "Quiz Completed!",
    yourScore: "Your Score",
    playAgain: "Play Again",
    nextQuestion: "Next Question",
    viewResults: "View Results",

    // Roadmap Page
    roadmapHeaderTitle: "International Standard Roadmap",
    roadmapHeaderSubtitle: "Step-by-step guidance from zero foundation to confident English fluency.",
    step1Title: "Stage 1: Vocabulary & Pronunciation Foundation",
    step2Title: "Stage 2: Grammar & Speaking Reflexes",
    step3Title: "Stage 3: Confident Fluency & Communication",

    // Chatbot AI
    aiAssistantTitle: "AI English Learning Assistant",
    aiAssistantSub: "Learning & Free Conversation",
    tokenLimitLabel: "Today's AI Token Limit",
    askInputPlaceholder: "Ask a question...",
    clearChatHistory: "Clear chat history",

    // Profile & Misc
    myProgress: "My Learning Progress",
    accountSettings: "Account Settings",
    saveChanges: "Save Changes",
    loginRequired: "Please log in to use this feature"
  }
};

const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState(() => {
    return localStorage.getItem('language') || 'VIE';
  });

  useEffect(() => {
    localStorage.setItem('language', language);
  }, [language]);

  const toggleLanguage = () => {
    setLanguage(prev => (prev === 'VIE' ? 'ENG' : 'VIE'));
  };

  const t = (key) => {
    return translations[language]?.[key] || translations['VIE']?.[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    return {
      language: 'VIE',
      setLanguage: () => {},
      toggleLanguage: () => {},
      t: (key) => translations.VIE[key] || key
    };
  }
  return context;
};
