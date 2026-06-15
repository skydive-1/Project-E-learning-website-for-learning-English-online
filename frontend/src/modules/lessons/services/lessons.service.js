/**
 * Lessons Service - Quản lý và cung cấp dữ liệu bài học giả lập phong phú kiểu Udemy
 */

const mockCourseData = {
  id: "course-1",
  title: "English for Communication & AI Interaction",
  instructor: "Dr. Alexander Wright",
  progress: 35, // percent
  sections: [
    {
      id: "sec-1",
      title: "Chương 1: Giới thiệu & Định hướng học tập",
      lessons: [
        {
          id: "lesson-1",
          title: "1. Chào mừng & Hướng dẫn học tập hiệu quả cùng AI Assistant",
          duration: "03:15",
          videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
          description: "Trong bài học này, bạn sẽ làm quen với lộ trình học và cách tương tác hiệu quả với Trợ lý ảo AI Chatbot ở thanh bên phải để sửa lỗi phát âm và ngữ pháp.",
          content: `Chào mừng bạn đến với khóa học English for Communication! 
          
Trong bài đầu tiên này, chúng ta sẽ tìm hiểu:
- Cách thiết lập mục tiêu học tiếng Anh giao tiếp hàng ngày.
- Cách tận dụng Trợ lý AI (AI Assistant) bên cạnh video để đặt câu hỏi trực tiếp khi gặp cấu trúc ngữ pháp khó.
- Cách thực hành luyện nói và đặt câu hỏi cho AI để ghi nhớ từ vựng.

Hãy chuẩn bị một cuốn sổ tay nhỏ và tai nghe có micro để thực hành nhé!`,
          resources: [
            { name: "Slide bài giảng Chương 1.pdf", url: "#" },
            { name: "Hướng dẫn cài đặt Extension phát âm.docx", url: "#" }
          ],
          completed: true
        },
        {
          id: "lesson-2",
          title: "2. Cài đặt tư duy phản xạ tiếng Anh (English Mindset)",
          duration: "05:42",
          videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
          description: "Làm thế nào để dừng việc dịch nhẩm từ tiếng Việt sang tiếng Anh trước khi nói? Bài học sẽ chỉ ra tư duy suy nghĩ bằng tiếng Anh.",
          content: `Để giao tiếp trôi chảy, điều quan trọng nhất là loại bỏ thói quen dịch nhẩm:
1. Liên kết trực tiếp hình ảnh/khái niệm với từ tiếng Anh (ví dụ nghĩ đến 'quả táo' -> thấy hình ảnh quả táo và bật ra 'apple' chứ không qua chữ tiếng Việt).
2. Chấp nhận mắc lỗi: Đừng sợ sai ngữ pháp ở giai đoạn đầu.
3. Đắm chìm trong ngôn ngữ: Sử dụng trợ lý AI để chat hội thoại hàng ngày.

*Bài tập thực hành*: Hãy viết ra 5 câu đơn giản mô tả những vật dụng xung quanh bạn ngay bây giờ bằng tiếng Anh.`,
          resources: [
            { name: "Tóm tắt từ vựng tư duy.pdf", url: "#" }
          ],
          completed: true
        }
      ]
    },
    {
      id: "sec-2",
      title: "Chương 2: Ngữ pháp phản xạ cơ bản (Reflexive Grammar)",
      lessons: [
        {
          id: "lesson-3",
          title: "3. Các thì thời gian trong văn phong nói (Speaking Tenses)",
          duration: "08:12",
          videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
          description: "Trong văn nói, bạn không cần dùng hết 12 thì. Hãy tập trung làm chủ 3 thì cốt lõi: Hiện tại đơn, Quá khứ đơn, Tương lai đơn.",
          content: `Ba thì cốt lõi chiếm hơn 80% thời lượng giao tiếp hàng ngày:
1. **Hiện tại đơn (Simple Present)**: Diễn tả thói quen, chân lý. (Ví dụ: I study English every day).
2. **Quá khứ đơn (Simple Past)**: Diễn tả việc đã kết thúc. (Ví dụ: I learned 10 new words yesterday).
3. **Tương lai đơn (Simple Future)**: Diễn tả dự định tức thời. (Ví dụ: I will call you tonight).

Hãy dùng Tab AI Assistant bên cạnh để gõ thử 3 câu ví dụ về cuộc sống của bạn sử dụng 3 thì trên và nhờ AI sửa lỗi ngữ pháp.`,
          resources: [
            { name: "Bảng chia động từ bất quy tắc thông dụng nhất.pdf", url: "#" }
          ],
          completed: false
        },
        {
          id: "lesson-4",
          title: "4. Cấu trúc câu hỏi đuôi & Câu nghi vấn tự nhiên",
          duration: "06:30",
          videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
          description: "Cách đặt câu hỏi lịch sự, câu hỏi lựa chọn và cách lên giọng cuối câu hỏi để cuộc trò chuyện tự nhiên hơn.",
          content: `Luyện tập cách đặt câu hỏi:
- Yes/No questions: Lên giọng ở cuối câu. (e.g., Do you like coffee? ↗)
- Wh-questions: Xuống giọng ở cuối câu. (e.g., What is your favorite food? ↘)
- Tag questions (Câu hỏi đuôi): Dùng để xác nhận thông tin. (e.g., You are a student, aren't you?)

*Thực hành*: Nhờ AI Assistant đóng vai làm người bản xứ và đặt câu hỏi phỏng vấn bạn nhé.`,
          resources: [],
          completed: false
        }
      ]
    },
    {
      id: "sec-3",
      title: "Chương 3: Luyện nghe và phản xạ hội thoại",
      lessons: [
        {
          id: "lesson-5",
          title: "5. Phương pháp nghe thụ động (Passive Listening) & nghe chép chính tả",
          duration: "10:15",
          videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4",
          description: "Phân biệt nghe chủ động và nghe thụ động. Cách áp dụng phương pháp shadowing để rèn giọng điệu nói tiếng Anh.",
          content: `Phương pháp Shadowing (Nói đuổi):
1. Nghe một câu tiếng Anh ngắn mẫu.
2. Bắt chước ngay lập tức theo ngữ điệu, cách nhấn âm và nối âm của người nói.
3. Ghi âm lại và tự so sánh để sửa đổi.

Hãy chat với AI Assistant cụm từ bạn nghe thấy trong video để xem bạn viết đúng chính tả chưa.`,
          resources: [
            { name: "Tập tin audio nghe chép chính tả buổi 1.mp3", url: "#" }
          ],
          completed: false
        }
      ]
    }
  ]
};

// Lưu tiến độ trong bộ nhớ cục bộ (localStorage)
const getLocalProgress = () => {
  const saved = localStorage.getItem("lessons_progress");
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      return {};
    }
  }
  
  // Khởi tạo tiến độ mặc định từ dữ liệu gốc
  const initialProgress = {};
  mockCourseData.sections.forEach(sec => {
    sec.lessons.forEach(l => {
      initialProgress[l.id] = l.completed;
    });
  });
  localStorage.setItem("lessons_progress", JSON.stringify(initialProgress));
  return initialProgress;
};

const saveLocalProgress = (progress) => {
  localStorage.setItem("lessons_progress", JSON.stringify(progress));
};

export const getCourseDetails = async () => {
  // Giả lập độ trễ mạng
  await new Promise(resolve => setTimeout(resolve, 300));
  
  const progressState = getLocalProgress();
  
  // Áp dụng tiến độ mới nhất vào dữ liệu khóa học
  const updatedSections = mockCourseData.sections.map(sec => ({
    ...sec,
    lessons: sec.lessons.map(l => ({
      ...l,
      completed: !!progressState[l.id]
    }))
  }));
  
  // Tính toán lại tỷ lệ phần trăm tiến độ
  const allLessons = updatedSections.flatMap(s => s.lessons);
  const completedCount = allLessons.filter(l => l.completed).length;
  const progressPercent = Math.round((completedCount / allLessons.length) * 100);
  
  return {
    ...mockCourseData,
    progress: progressPercent,
    sections: updatedSections
  };
};

export const toggleLessonCompletion = async (lessonId) => {
  const progressState = getLocalProgress();
  progressState[lessonId] = !progressState[lessonId];
  saveLocalProgress(progressState);
  
  return progressState;
};

export const getLessonById = async (lessonId) => {
  await new Promise(resolve => setTimeout(resolve, 200));
  const progressState = getLocalProgress();
  
  for (const sec of mockCourseData.sections) {
    const lesson = sec.lessons.find(l => l.id === lessonId);
    if (lesson) {
      return {
        ...lesson,
        completed: !!progressState[lesson.id]
      };
    }
  }
  
  // Trở về bài học đầu tiên nếu không tìm thấy
  return {
    ...mockCourseData.sections[0].lessons[0],
    completed: !!progressState[mockCourseData.sections[0].lessons[0].id]
  };
};
