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

// Global direct phrase translation mapping dictionary (Vietnamese -> English)
const directPhraseMap = {
  "Lộ trình học thông minh": "Smart Learning Roadmap",
  "Học theo lộ trình bài bản giúp bạn tiết kiệm 50% thời gian học tập mà vẫn đạt hiệu quả tối ưu.": "Structured roadmaps help you save 50% learning time with optimal efficiency.",
  "Khởi đầu": "Start",
  "Xác định trình độ": "Assess Level",
  "Tăng tốc": "Accelerate",
  "Học theo lộ trình": "Follow Roadmap",
  "Về đích": "Finish Line",
  "Làm chủ kỹ năng": "Master Skills",
  "Các lộ trình dành cho bạn": "Roadmaps For You",
  "Dựa trên mục tiêu sự nghiệp và trình độ hiện tại, hãy chọn cho mình một lộ trình phù hợp nhất.": "Choose the best path based on your career goals and current level.",
  "Xem chi tiết lộ trình": "View Roadmap Details",
  "Bạn sẽ học được:": "What you will learn:",
  "Tiếng Anh Cơ Bản": "Basic English",
  "Dành cho người mới bắt đầu hoặc mất gốc. Tập trung vào phát âm chuẩn IPA và ngữ pháp nền tảng.": "For beginners or zero foundation. Focuses on standard IPA pronunciation and core grammar.",
  "Lộ trình TOEIC 700+": "TOEIC 700+ Roadmap",
  "Xây dựng kỹ năng làm bài thi TOEIC chuyên sâu. Tập trung vào Listening & Reading thực chiến.": "Build in-depth TOEIC exam skills. Focuses on practical Listening & Reading.",
  "Lộ trình IELTS 6.5+": "IELTS 6.5+ Roadmap",
  "Rèn luyện 4 kỹ năng Nghe - Nói - Đọc - Viết toàn diện. Chuẩn bị vững chắc cho kỳ thi quốc tế.": "Comprehensive 4-skills practice for Listening, Speaking, Reading & Writing. Solid preparation for international exams.",
  "Tại sao nên học theo lộ trình?": "Why Learn With A Roadmap?",
  "Không lạc hướng:": "Stay Focused:",
  "Luôn biết mình cần học gì tiếp theo.": "Always know what to study next.",
  "Tiết kiệm thời gian:": "Save Time:",
  "Tập trung vào những kiến thức thực sự quan trọng.": "Focus on high-value essential skills.",
  "Kết quả bền vững:": "Sustainable Results:",
  "Xây dựng kiến thức từ gốc đến ngọn.": "Build strong foundation to advanced mastery.",
  "Khám phá các khóa học ngay": "Explore Courses Now",
  "Chi tiết các giai đoạn học tập:": "Detailed Learning Stages:",
  "Quản lý Đề thi & Mã PIN Riêng tư": "Manage Quizzes & Private PIN Codes",
  "Quản lý Đề thi & Mã PIN": "Manage Quizzes & PINs",
  "Tạo đề thi mới": "Create New Quiz",
  "Sân chơi tự luyện": "Practice Arena",
  "Vào chơi nhanh bằng PIN": "Join Quickly via PIN",
  "Nhập mã PIN bất kỳ để kết nối ngẫu nhiên và tham gia phòng chờ.": "Enter any PIN code to connect to the quiz room.",
  "Danh sách đề thi hiện có": "Available Quizzes List",
  "Bắt đầu thi": "Start Quiz",
  "Tham gia": "Join",
  "Nhập mã PIN...": "Enter PIN code...",
  "Dành riêng cho Giảng viên & Admin • Tra cứu mã PIN, xem câu hỏi hoặc xóa bài thi": "Exclusively for Instructors & Admins • Lookup PIN codes, view questions, or delete quizzes",
  "Tìm kiếm đề thi theo tên hoặc nhập Mã PIN (VD: 123456)...": "Search quiz by title or enter PIN Code (e.g. 123456)...",
  "Tất cả": "All",
  "🔒 Riêng tư": "🔒 Private",
  "🌐 Công khai": "🌐 Public",
  "Đã sao chép!": "Copied!",
  "Sao chép PIN": "Copy PIN",
  "Thi thử ngay": "Try Quiz Now",
  "Xóa đề thi": "Delete Quiz",
  "Đóng cửa sổ": "Close Window",
  "MÃ PIN THAM GIA:": "JOINING PIN CODE:",
  "Mẫu câu luyện đọc phát âm:": "Pronunciation Reading Sample:",
  "Nhập câu trả lời tự luận của bạn (tối đa 500 ký tự):": "Enter your essay response (max 500 characters):",
  "Viết câu trả lời hoặc đoạn văn ngắn của bạn bằng tiếng Anh...": "Write your answer or short paragraph in English...",
  "Nộp bài & Chấm điểm AI": "Submit & Score with AI",
  "AI Đang Chấm Điểm...": "AI Scoring...",
  "Nhận xét ngữ pháp & từ vựng:": "Grammar & Vocabulary Feedback:",
  "Nhận xét phát âm & ngữ điệu:": "Pronunciation & Intonation Feedback:",
  "Gợi ý câu trả lời tự nhiên hơn:": "More Natural Answer Suggestion:",
  "Điểm phản xạ:": "Reflex Score:",
  "Đã nhận diện giọng nói:": "Recognized Speech:",
  "Gửi câu trả lời": "Submit Answer",
  "Khóa học": "Courses",
  "Lộ trình": "Roadmap",
  "Trắc nghiệm": "Quizzes",
  "Tính năng": "Features",
  "Bảng giá": "Pricing",
  "Đăng nhập": "Login",
  "Đăng ký": "Register",
  "Trang cá nhân": "My Profile",
  "Quản trị hệ thống": "Admin Panel",
  "Quản lý khóa học": "Instructor Panel",
  "Bài học của tôi": "My Courses",
  "Đăng xuất": "Logout",
  "Học viên": "Student",
  "Giảng viên": "Instructor",
  "Miễn phí": "Free",
  "Đề xuất": "Recommended",
  "Mới": "New",
  "Thực tế": "Practical",
  "Dễ": "Easy",
  "Trung bình": "Medium",
  "Khó": "Hard",
  "Bài nói & Phát âm (AI Voice)": "Speaking & Pronunciation (AI Voice)",
  "Viết luận": "Essay Writing",
  "Chưa nhận diện được giọng nói (Chưa phát âm)": "No speech recognized (Not spoken yet)",
  "Chưa ghi nhận được câu trả lời có cấu trúc ngữ pháp và từ vựng. Bạn hãy thu âm lại một câu trả lời hoàn chỉnh nhé.": "No structured response recorded yet. Please re-record a complete response.",
  "Tín hiệu âm thanh thu được chưa đủ rõ ràng. Bạn hãy kiểm tra lại micro, ghé sát thiết bị và phát âm to me.": "Audio signal is not clear enough. Please check your microphone and speak louder.",
  "In my opinion, practicing English daily is the best way to improve fluency.": "In my opinion, practicing English daily is the best way to improve fluency.",
  "Giai đoạn 1 (Tháng 1)": "Stage 1 (Month 1)",
  "Giai đoạn 2 (Tháng 2)": "Stage 2 (Month 2)",
  "Giai đoạn 3 (Tháng 3-4)": "Stage 3 (Months 3-4)",
  "Giai đoạn 1 (Tháng 1-2)": "Stage 1 (Months 1-2)",
  "Giai đoạn 2 (Tháng 3-4)": "Stage 2 (Months 3-4)",
  "Giai đoạn 3 (Tháng 5-6)": "Stage 3 (Months 5-6)",
  "Giai đoạn 2 (Tháng 3-5)": "Stage 2 (Months 3-5)",
  "Giai đoạn 3 (Tháng 6-8)": "Stage 3 (Months 6-8)",
  "Chuẩn hóa Bảng Phiên âm IPA & Từ vựng Nền tảng": "Standardize IPA Pronunciation & Core Vocabulary",
  "Học cách phát âm chuẩn 44 âm trong bảng IPA, tập thói quen ghi âm và sửa lỗi bằng Trợ lý AI.": "Learn standard pronunciation of 44 IPA sounds, practice recording and AI correction.",
  "Ngữ pháp Căn bản & Ghép câu Giao tiếp": "Basic Grammar & Sentence Building",
  "Nắm vững 6 thì tiếng Anh thông dụng, cấu trúc câu giao tiếp hàng ngày và cách đặt câu hỏi phản xạ.": "Master 6 common English tenses, daily conversation sentence structures, and reflex questions.",
  "Thực hành Phản xạ Giao tiếp tự nhiên": "Natural Conversational Reflex Practice",
  "Luyện nói phản xạ Q&A theo tình huống thực tế (chào hỏi, mua sắm, chỉ đường, hỏi đáp bản thân).": "Practice Q&A speaking reflexes for real-life situations (greetings, shopping, directions, self-introductions).",
  "Củng cố Từ vựng TOEIC 600+ & Ngữ pháp trọng tâm": "Solidify TOEIC 600+ Vocabulary & Core Grammar",
  "Học bộ từ vựng 600 Essential Words for TOEIC, lấy lại nền tảng ngữ pháp câu ghép & mệnh đề quan hệ.": "Master 600 Essential Words for TOEIC, rebuild foundation of compound sentences & relative clauses.",
  "Phương pháp Giải đề Part 1 đến Part 7": "Exam Strategies for Part 1 to Part 7",
  "Bắt bài các bẫy thường gặp trong Part 1 (Hình ảnh), Part 2 (Hỏi đáp), Part 5 (Điền từ) và Part 7 (Đoạn văn).": "Identify common traps in Part 1 (Photos), Part 2 (Question-Response), Part 5 (Incomplete Sentences), and Part 7 (Reading Comprehension).",
  "Luyện đề Thực chiến & Chấm điểm AI": "Full Mock Practice & AI Scoring",
  "Làm đề thi thử trọn gói 200 câu trong 120 phút, phân tích lỗi sai chi tiết để đạt mốc TOEIC 700+.": "Take 200-question mock tests in 120 minutes with detailed AI error analysis to reach TOEIC 700+.",
  "Xây dựng Nền tảng Academic (IELTS Foundation)": "Build Academic IELTS Foundation",
  "Tích lũy từ vựng学术 theo 20 chủ đề IELTS quen thuộc (Environment, Technology, Education, Health).": "Build academic vocabulary across 20 common IELTS topics (Environment, Technology, Education, Health).",
  "Rèn luyện Chi tiết 4 Kỹ năng Nghe - Nói - Đọc - Viết": "In-depth 4-Skills Training (Listening, Speaking, Reading, Writing)",
  "Luyện Viết Essay Task 2 (Opinion, Discussion), luyện Nói Speaking Part 2-3 với AI chấm câu và từ vựng.": "Practice Task 2 Essay Writing (Opinion, Discussion), and Speaking Part 2-3 with AI sentence and vocabulary scoring.",
  "Luyện đề Cam-IELTS & Mock Test Thực tế": "Cambridge IELTS Practice & Real Mock Tests",
  "Giải đề Cambridge IELTS mới nhất, canh thời gian áp lực thực tế và hoàn thiện kỹ năng đạt Band 6.5+ - 7.5+.": "Solve latest Cambridge IELTS tests under real timed pressure to achieve Band 6.5+ - 7.5+."
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
    if (!key) return '';
    if (language === 'ENG') {
      return translations['ENG']?.[key] || directPhraseMap[key] || directPhraseMap[translations['VIE']?.[key]] || key;
    }
    return translations['VIE']?.[key] || key;
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
