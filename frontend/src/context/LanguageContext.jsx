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
  "Nói nhiều hơn — Học nhanh hơn": "Speak More — Learn Faster",
  "Trải nghiệm môi trường thực hành tương tác chuyên sâu với trợ lý ảo giao tiếp thông minh. Bạn có cơ hội phản xạ liên tục 24/7, xóa tan nỗi sợ nói sai, tự tin làm chủ ngôn ngữ trong thời gian ngắn nhất.": "Experience an interactive, in-depth practice environment with an intelligent virtual tutor. Practice 24/7, overcome fear of speaking mistakes, and master English confidently in no time.",
  "Phản xạ tiếng Anh tự nhiên": "Natural English Reflexes",
  "Nâng cao khả năng nghe hiểu và phản hồi tự nhiên không cần dịch nhẩm.": "Enhance listening comprehension and respond naturally without translating in your head.",
  "Luyện nói trực tiếp, sửa lỗi tức thì": "Live Speaking Practice & Instant Correction",
  "Trợ lý AI giúp chỉnh âm chuẩn IPA và hướng dẫn cách diễn đạt hay hơn.": "AI assistant corrects IPA pronunciation and suggests more eloquent phrasing.",
  "Tiết kiệm thời gian & chi phí tối đa": "Save Time & Maximum Cost Efficiency",
  "Học tại nhà linh động, chi phí chỉ bằng 1/10 so với học trung tâm truyền thống.": "Flexible home learning at 1/10th the cost of traditional language centers.",
  "Khám phá khóa học ngay": "Explore Courses Now",
  "Vì sao chọn E-Learn Academy?": "Why Choose E-Learn Academy?",
  "Học tập đột phá với sự hỗ trợ của công nghệ hàng đầu và lộ trình thông minh.": "Breakthrough learning powered by leading technology and smart roadmaps.",
  "Hỗ Trợ 24/7": "24/7 Support",
  "Hệ thống chatbot AI luôn sẵn sàng hỗ trợ giải đáp mọi thắc mắc của bạn bất cứ thời điểm nào trong ngày.": "AI chatbot is available 24/7 to answer any of your learning questions.",
  "Học Phí Hợp Lý": "Affordable Tuition",
  "Mức đầu tư vô cùng tiết kiệm, mở ra cơ hội tiếp cận tri thức ngôn ngữ chất lượng cao cho mọi người.": "Extremely cost-effective investment, opening high-quality language learning to everyone.",
  "Lịch Học Linh Hoạt": "Flexible Schedule",
  "Tự do thiết kế thời gian học phù hợp với nhịp sống và công việc cá nhân của bạn mà không lo bị lỡ bài.": "Study at your own pace fitting your lifestyle without worrying about missing lessons.",
  "Phản Hồi Tiến Bộ": "Progress Tracking",
  "Hệ thống phân tích và báo cáo định kỳ chi tiết giúp bạn theo dõi sát sao lộ trình tiến bộ của bản thân.": "Detailed periodic progress analysis helping you track your learning growth closely.",
  "Cộng Đồng Năng Động": "Vibrant Community",
  "Giao lưu, kết nối và thực hành tiếng Anh cùng hàng ngàn học viên năng động trên khắp cả nước.": "Connect and practice English with thousands of active learners nationwide.",
  "Cam Kết Đầu Ra": "Guaranteed Outcomes",
  "Chương trình chuẩn đầu ra, cam kết hỗ trợ học lại miễn phí nếu học viên chưa đạt kết quả mục tiêu.": "Outcome-oriented curriculum with free re-enrollment support if target score is not achieved.",
  "Lộ trình học tập rõ ràng": "Clear Learning Path",
  "3 bước đơn giản giúp bạn bắt đầu hành trình chinh phục tiếng Anh hiệu quả": "3 simple steps to start your effective English learning journey",
  "Kiểm tra đầu vào": "Placement Assessment",
  "Thực hiện bài test nhanh miễn phí để xác định chính xác trình độ tiếng Anh hiện tại.": "Take a quick free test to accurately determine your current English proficiency level.",
  "Lộ trình cá nhân hóa": "Personalized Roadmap",
  "Thuật toán AI tự động thiết kế giáo trình riêng dựa trên điểm mạnh và điểm yếu của bạn.": "AI algorithms automatically design custom curriculum based on your strengths and weaknesses.",
  "Thực hành tương tác": "Interactive Practice",
  "Tham gia các bài học video sống động kết hợp luyện tập nói phản xạ trực tiếp với AI.": "Join interactive video lessons combined with direct AI speaking practice.",
  "Khóa học Video": "Video Courses",
  "Học mọi lúc mọi nơi với kho video bài giảng chất lượng cao được biên soạn kỹ lưỡng": "Learn anytime, anywhere with high-quality structured video lesson library",
  "Tiếng Anh Giao Tiếp Online": "Online Conversational English",
  "Luyện phản xạ nghe nói cơ bản, phát âm chuẩn tự nhiên trong các tình huống thực tế đời sống.": "Practice basic listening/speaking reflexes and natural pronunciation in daily scenarios.",
  "Luyện Thi IELTS v6.5 - Toàn Diện": "Comprehensive IELTS 6.5+ Prep",
  "Bí quyết làm bài thi hiệu quả cho cả 4 kỹ năng Nghe, Nói, Đọc, Viết chuẩn cấu trúc đề mới nhất.": "Effective exam strategies for Listening, Speaking, Reading, and Writing aligned with latest tests.",
  "Tiếng Anh Thương Mại & Công Sở": "Business & Workplace English",
  "Viết email, thuyết trình và đàm phán bằng tiếng Anh chuyên nghiệp tự tin nơi công sở.": "Write emails, give presentations, and negotiate professionally and confidently at work.",
  "Luyện trắc nghiệm vui giải trí": "Fun & Interactive Quizzes",
  "Thử thách phản xạ tiếng Anh nhanh với các đề trắc nghiệm chủ đề Tiếng lóng, Idioms, Từ vựng đời sống": "Test your rapid English reflexes with quizzes on Slang, Idioms, and Daily Vocabulary",
  "Thử thách hiểu biết của bạn về tiếng lóng và các thành ngữ tiếng Anh giao tiếp thông dụng hàng ngày của người bản xứ.": "Test your knowledge of native slang and common everyday English idioms.",
  "Hi! Cần trợ giúp học tiếng Anh? Chat với mình nhé! 👋": "Hi! Need help learning English? Chat with me! 👋",
  "Trò chuyện với trợ lý học tiếng Anh AI": "Chat with AI English Learning Tutor",
  "Chấm điểm bài viết tự động": "Automated Essay Scoring",
  "Gửi bài luận của bạn, AI sẽ phát hiện lỗi ngữ pháp, từ vựng và gợi ý viết lại trôi chảy hơn.": "Submit your essay, AI detects grammar & vocabulary errors and suggests fluent rewrites.",
  "Trò chuyện cùng AI 24/7": "Chat with AI 24/7",
  "Trải nghiệm người bạn bản xứ AI luôn sẵn sàng trò chuyện, trả lời ngữ pháp bất cứ khi nào bạn hỏi.": "Experience a native AI partner ready to talk and answer grammar questions anytime.",
  "Lộ trình học bài bản": "Structured Learning Path",
  "Hành trình cá nhân hóa giúp bạn làm chủ tiếng Anh từ con số 0": "Personalized journey helping you master English from zero",
  "GIAI ĐOẠN 1": "STAGE 1",
  "GIAI ĐOẠN 2": "STAGE 2",
  "GIAI ĐOẠN 3": "STAGE 3",
  "GIAI ĐOẠN 4": "STAGE 4",
  "Khởi động": "Warm-up",
  "Chuẩn hóa phát âm IPA": "Standardize IPA pronunciation",
  "Ngữ pháp nền tảng": "Foundational grammar",
  "Giao tiếp cơ bản": "Basic communication",
  "Sức bền": "Stamina",
  "Phản xạ nghe nói": "Listening/Speaking reflexes",
  "Từ vựng đa chủ đề": "Multi-topic vocabulary",
  "Tư duy tiếng Anh": "English mindset",
  "Bứt phá": "Breakthrough",
  "Thuyết trình chuyên sâu": "Advanced presentations",
  "Viết luận sắc bén": "Sharp essay writing",
  "Tranh biện tiếng Anh": "English debate",
  "Làm chủ ngôn ngữ": "Complete fluency",
  "Nghiên cứu khoa học": "Academic research",
  "Môi trường toàn cầu": "Global environment",
  "Đăng ký tư vấn miễn phí": "Register for Free Consultation",
  "Nhận ngay lộ trình cá nhân hóa và học thử miễn phí cùng AI": "Get personalized roadmap and free AI trial lesson immediately",
  "Họ và tên": "Full Name",
  "Địa chỉ Gmail của bạn": "Your Gmail Address",
  "Đăng ký ngay": "Register Now",
  "Đang gửi...": "Submitting...",
  "Đăng ký thành công!": "Registration Successful!",
  "Hệ thống đã tự động gửi": "System automatically sent your",
  "Lộ trình học cá nhân hóa": "Personalized Learning Roadmap",
  "vào Gmail của bạn. Vui lòng kiểm tra hộp thư!": "to your Gmail. Please check your inbox!",
  "Công cụ học tập AI": "AI Learning Tools",
  "Tối ưu hóa thời gian học tập nhờ các tính năng trợ lý công nghệ AI tiên tiến": "Optimize learning time with advanced AI features",
  "Luyện phát âm AI": "AI Pronunciation Practice",
  "Nói trực tiếp qua micro, công nghệ AI tự động chấm điểm và chỉ ra lỗi phát âm IPA chuẩn xác.": "Speak directly via mic, AI automatically scores and points out IPA errors.",
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
