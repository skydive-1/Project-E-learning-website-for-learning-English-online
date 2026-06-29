// Service quản lý dữ liệu trắc nghiệm (Quizzes) bằng LocalStorage
const LOCAL_STORAGE_KEY = 'lingomate_quizzes';

// Câu hỏi mẫu mặc định cho các bài học khóa học (Lesson Quizzes)
const defaultCourseQuizzes = {
  // Bài 12: Speaking Tenses (Thì thời gian trong văn nói)
  "12": [
    {
      id: "q-12-1",
      question: "Every morning, my brother __________ a cup of warm water before breakfast.",
      options: ["A. is drinking", "B. drinks", "C. drank", "D. will drink"],
      correctAnswer: "B",
      explanation: "Thì hiện tại đơn diễn tả một thói quen hàng ngày (Every morning). Chủ ngữ 'my brother' số ít nên động từ chia là 'drinks'."
    },
    {
      id: "q-12-2",
      question: "Yesterday, she __________ to the library to borrow some grammar books.",
      options: ["A. goes", "B. was going", "C. went", "D. will go"],
      correctAnswer: "C",
      explanation: "Dấu hiệu nhận biết 'Yesterday' chỉ hành động xảy ra và kết thúc trong quá khứ, chia thì Quá khứ đơn (went)."
    },
    {
      id: "q-12-3",
      question: "I promise I __________ you with your English homework tomorrow evening.",
      options: ["A. will help", "B. help", "C. helped", "D. helping"],
      correctAnswer: "A",
      explanation: "Dấu hiệu nhận biết lời hứa (I promise) kết hợp với mốc thời gian tương lai (tomorrow) dùng thì Tương lai đơn (will help)."
    },
    {
      id: "q-12-4",
      question: "Look! The students __________ English in the classroom.",
      options: ["A. practice", "B. are practicing", "C. practiced", "D. will practice"],
      correctAnswer: "B",
      explanation: "Từ cảm thán 'Look!' (Nhìn kìa!) báo hiệu hành động đang xảy ra tại thời điểm nói, chia thì Hiện tại tiếp diễn (are practicing)."
    },
    {
      id: "q-12-5",
      question: "At 8 PM yesterday, we __________ a video lesson on speaking reflexes.",
      options: ["A. watch", "B. are watching", "C. were watching", "D. will watch"],
      correctAnswer: "C",
      explanation: "Hành động đang diễn ra tại một thời điểm cụ thể trong quá khứ (At 8 PM yesterday) chia thì Quá khứ tiếp diễn (were watching)."
    }
  ],
  // Bài 13: Tag Questions (Câu hỏi đuôi)
  "13": [
    {
      id: "q-13-1",
      question: "You aren't going to the English club today, __________?",
      options: ["A. are you", "B. aren't you", "C. do you", "D. don't you"],
      correctAnswer: "A",
      explanation: "Mệnh đề chính ở thể phủ định (aren't), phần hỏi đuôi phải ở thể khẳng định (are you)."
    },
    {
      id: "q-13-2",
      question: "She plays the piano beautifully, __________?",
      options: ["A. is she", "B. does she", "C. doesn't she", "D. isn't she"],
      correctAnswer: "C",
      explanation: "Mệnh đề chính dùng động từ thường ở thể khẳng định (plays), phần hỏi đuôi dùng trợ động từ phù hợp ở thể phủ định (doesn't she)."
    },
    {
      id: "q-13-3",
      question: "Let's go out for a walk in the park, __________?",
      options: ["A. shall we", "B. will you", "C. do we", "D. don't we"],
      correctAnswer: "A",
      explanation: "Câu rủ rê bắt đầu bằng 'Let's' thì câu hỏi đuôi mặc định luôn là 'shall we'."
    },
    {
      id: "q-13-4",
      question: "He has never been to London before, __________?",
      options: ["A. hasn't he", "B. has he", "C. did he", "D. didn't he"],
      correctAnswer: "B",
      explanation: "Câu chứa trạng từ phủ định 'never' (chưa bao giờ), do đó mệnh đề chính mang nghĩa phủ định, phần hỏi đuôi phải ở thể khẳng định (has he)."
    },
    {
      id: "q-13-5",
      question: "Nobody called me last night, __________?",
      options: ["A. did they", "B. didn't they", "C. did he", "D. didn't he"],
      correctAnswer: "A",
      explanation: "Chủ ngữ phủ định 'Nobody' được thay thế bằng đại từ 'they' ở phần hỏi đuôi. Mệnh đề chính mang nghĩa phủ định nên đuôi phải là khẳng định (did they)."
    }
  ]
};

// Đề trắc nghiệm tự do giải trí (Entertainment/Standalone Quizzes)
const defaultFreeQuizzes = {
  "fun-1": {
    id: "fun-1",
    title: "English Slangs & Idioms Quiz",
    description: "Thử thách hiểu biết của bạn về tiếng lóng và các thành ngữ tiếng Anh giao tiếp thông dụng hàng ngày của người bản xứ.",
    difficulty: "Medium",
    timeLimit: 5, // phút
    questions: [
      {
        id: "q-fun1-1",
        question: "When someone says 'Break a leg!', what do they mean?",
        options: ["A. Go hurt yourself", "B. Good luck", "C. Hurry up", "D. Be quiet"],
        correctAnswer: "B",
        explanation: "'Break a leg' là thành ngữ tiếng Anh dùng để chúc ai đó may mắn trước khi họ lên sân khấu biểu diễn."
      },
      {
        id: "q-fun1-2",
        question: "If a task is 'a piece of cake', it is __________.",
        options: ["A. very delicious", "B. extremely easy", "C. complicated", "D. expensive"],
        correctAnswer: "B",
        explanation: "'A piece of cake' là thành ngữ ví von một việc gì đó cực kỳ dễ dàng để hoàn thành."
      },
      {
        id: "q-fun1-3",
        question: "What does 'cost an arm and a leg' mean?",
        options: ["A. Very cheap", "B. Painful", "C. Extremely expensive", "D. Dangerous"],
        correctAnswer: "C",
        explanation: "'Cost an arm and a leg' diễn tả một món đồ hoặc dịch vụ có giá cắt cổ, rất đắt đỏ."
      },
      {
        id: "q-fun1-4",
        question: "Choose the meaning of the slang: 'I feel under the weather today.'",
        options: ["A. I feel sick", "B. I like the weather", "C. I am happy", "D. I want to go out"],
        correctAnswer: "A",
        explanation: "'Under the weather' là trạng thái cảm thấy không được khỏe, mệt mỏi trong người."
      },
      {
        id: "q-fun1-5",
        question: "When you 'hit the sack', you __________.",
        options: ["A. play football", "B. clean the room", "C. go to sleep", "D. pack bags"],
        correctAnswer: "C",
        explanation: "'Hit the sack' (hoặc 'hit the hay') có nghĩa là đi ngủ."
      }
    ]
  },
  "fun-2": {
    id: "fun-2",
    title: "Travel English Essentials",
    description: "Trang bị các mẫu câu giao tiếp tiếng Anh thiết thực tại sân bay, khách sạn, nhà hàng khi đi du lịch nước ngoài.",
    difficulty: "Easy",
    timeLimit: 8, // phút
    questions: [
      {
        id: "q-fun2-1",
        question: "At the airport check-in counter, which phrase is used to ask for a seat near the window?",
        options: ["A. I'd like an aisle seat, please.", "B. I'd like a window seat, please.", "C. Can I sit on the wing?", "D. Where is the gate?"],
        correctAnswer: "B",
        explanation: "'Window seat' là ghế ngồi sát cửa sổ máy bay."
      },
      {
        id: "q-fun2-2",
        question: "When checking into a hotel, what should you ask if you want breakfast included?",
        options: ["A. Is breakfast free?", "B. Is breakfast included?", "C. What time is dinner?", "D. Do you have breakfast?"],
        correctAnswer: "B",
        explanation: "Cấu trúc thông dụng: 'Is breakfast included?' (Bữa sáng đã bao gồm trong tiền phòng chưa?)."
      },
      {
        id: "q-fun2-3",
        question: "In a restaurant, what is the most polite way to ask for the bill/check?",
        options: ["A. Bring me the bill!", "B. Could we have the bill, please?", "C. I want to pay now.", "D. Money, please."],
        correctAnswer: "B",
        explanation: "'Could we have the bill, please?' là cách hỏi tính tiền lịch sự nhất."
      },
      {
        id: "q-fun2-4",
        question: "What does a traveler mean when they ask: 'Where is the baggage claim?'",
        options: ["A. Nơi ký gửi hành lý", "B. Nơi nhận lại hành lý sau chuyến bay", "C. Nơi mua túi xách", "D. Quầy làm thủ tục"],
        correctAnswer: "B",
        explanation: "'Baggage claim' là khu vực băng chuyền lấy lại hành lý ký gửi sau khi hạ cánh."
      },
      {
        id: "q-fun2-5",
        question: "If you get lost and want to ask the way to the subway station, you say: __________",
        options: ["A. Where subway?", "B. Could you show me the way to the subway station, please?", "C. I want subway station.", "D. Take me to subway."],
        correctAnswer: "B",
        explanation: "Cách hỏi đường lịch sự: 'Could you show me the way to..., please?'"
      }
    ]
  }
};

// Lấy toàn bộ kho dữ liệu trắc nghiệm
export const getQuizzesData = () => {
  const data = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (!data) {
    // Khởi tạo dữ liệu mặc định
    const initialData = {
      courseQuizzes: defaultCourseQuizzes,
      freeQuizzes: defaultFreeQuizzes
    };
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(initialData));
    return initialData;
  }
  return JSON.parse(data);
};

// Lưu kho dữ liệu trắc nghiệm
const saveQuizzesData = (data) => {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
};

// ----------------------------------------------------
// 1. SERVICES CHO HỌC VIÊN
// ----------------------------------------------------

// Lấy danh sách câu hỏi của một bài học trong khóa học
export const getCourseQuizQuestions = (lessonId) => {
  const data = getQuizzesData();
  // Trả về câu hỏi nếu có, ngược lại nếu lessonId được cấu hình là quiz thì trả về mảng trống
  return data.courseQuizzes[String(lessonId)] || [];
};

// Lấy danh sách toàn bộ quizz tự do giải trí
export const getFreeQuizzesList = () => {
  const data = getQuizzesData();
  return Object.values(data.freeQuizzes);
};

// Lấy chi tiết một bài quizz tự do
export const getFreeQuizById = (quizId) => {
  const data = getQuizzesData();
  return data.freeQuizzes[String(quizId)] || null;
};

// ----------------------------------------------------
// 2. SERVICES CHO GIẢNG VIÊN (CRUD)
// ----------------------------------------------------

// Lưu/Cập nhật danh sách câu hỏi của một bài học
export const saveCourseQuizQuestions = (lessonId, questions) => {
  const data = getQuizzesData();
  data.courseQuizzes[String(lessonId)] = questions;
  saveQuizzesData(data);
  return true;
};

// Khôi phục dữ liệu gốc
export const resetToDefaultQuizzes = () => {
  localStorage.removeItem(LOCAL_STORAGE_KEY);
  return getQuizzesData();
};
