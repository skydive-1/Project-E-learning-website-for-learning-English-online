import apiClient from '../../../config/api.config';
import { getCourseQuizQuestions, fetchAndCacheQuizzes } from '../../quizzes/services/quizzes.service';


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

// Hàm giải mã JWT token để lấy userId
export const getUserIdFromToken = () => {
  const token = localStorage.getItem('token');
  if (!token) return null;
  try {
    const payload = token.split('.')[1];
    // Giải mã Base64URL an toàn chống thiếu padding và ký tự đặc biệt
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const decoded = JSON.parse(atob(padded));
    return decoded.id;
  } catch (e) {
    console.error('Lỗi giải mã token:', e);
    return null;
  }
};

export const getCourseDetails = async (courseId = 1) => {
  try {
    // 1. Gọi API lấy chi tiết khóa học và tải quizzes đi kèm
    const [courseResponse] = await Promise.all([
      apiClient.get(`/courses/${courseId}`),
      fetchAndCacheQuizzes(courseId).catch(err => console.warn("Lỗi tải quizzes ngầm:", err.message))
    ]);
    const dbCourse = courseResponse.data.course;

    // 2. Lấy userId từ JWT token
    const userId = getUserIdFromToken();
    let completedLessonIds = [];

    // 3. Nếu có user, lấy danh sách tiến trình hoàn thành từ backend
    if (userId) {
      try {
        const progressResponse = await apiClient.get(`/progress/${userId}`);
        const progressList = progressResponse.data.progress || [];
        completedLessonIds = progressList
          .filter(p => p.is_completed)
          .map(p => p.lesson_id);
      } catch (err) {
        console.error("Lỗi lấy tiến trình từ backend:", err);
      }
    }

    // 4. Map dữ liệu từ DB sang định dạng Frontend mong đợi
    const mappedSections = dbCourse.sections.map((sec, secIdx) => {
      return {
        id: String(sec.section_id),
        title: sec.title,
        lessons: sec.lessons.flatMap(l => {
          // Bổ sung các thông tin mô tả chi tiết mặc định nếu DB không lưu trữ
          let description = 'Trong bài học này, bạn sẽ làm quen với lộ trình học và cách tương tác hiệu quả với Trợ lý ảo AI Assistant.';
          let content = 'Chào mừng bạn đến với lớp học English for Communication! Hãy sử dụng Chatbot AI ở góc bên phải để tương tác.';
          let duration = '05:00';

          // Giữ nguyên các tóm tắt mô tả phong phú cho 5 bài học mẫu
          if (l.order_index === 1 && secIdx === 0) {
            duration = '03:15';
            description = 'Trong bài học này, bạn sẽ làm quen với lộ trình học và cách tương tác hiệu quả với Trợ lý ảo AI Chatbot ở thanh bên phải để sửa lỗi phát âm và ngữ pháp.';
            content = `Chào mừng bạn đến với khóa học English for Communication!\n\nTrong bài đầu tiên này, chúng ta sẽ tìm hiểu:\n- Cách thiết lập mục tiêu học tiếng Anh giao tiếp hàng ngày.\n- Cách tận dụng Trợ lý AI (AI Assistant) bên cạnh video để đặt câu hỏi trực tiếp khi gặp cấu trúc ngữ pháp khó.\n- Cách thực hành luyện nói và đặt câu hỏi cho AI để ghi nhớ từ vựng.`;
          } else if (l.order_index === 2 && secIdx === 0) {
            duration = '05:42';
            description = 'Làm thế nào để dừng việc dịch nhẩm từ tiếng Việt sang tiếng Anh trước khi nói? Bài học sẽ chỉ ra tư duy suy nghĩ bằng tiếng Anh.';
            content = `Để giao tiếp trôi chảy, điều quan trọng nhất là loại bỏ thói quen dịch nhẩm:\n1. Liên kết trực tiếp hình ảnh/khái niệm với từ tiếng Anh (ví dụ nghĩ đến 'quả táo' -> thấy hình ảnh quả táo và bật ra 'apple' chứ không qua chữ tiếng Việt).\n2. Chấp nhận mắc lỗi: Đừng sợ sai ngữ pháp ở giai đoạn đầu.\n3. Đắm chìm trong ngôn ngữ: Sử dụng trợ lý AI để chat hội thoại hàng ngày.\n\n*Bài tập thực hành*: Hãy viết ra 5 câu đơn giản mô tả những vật dụng xung quanh bạn ngay bây giờ bằng tiếng Anh.`;
          } else if (l.order_index === 1 && secIdx === 1) {
            duration = '08:12';
            description = 'Trong văn nói, bạn không cần dùng hết 12 thì. Hãy tập trung làm chủ 3 thì cốt lõi: Hiện tại đơn, Quá khứ đơn, Tương lai đơn.';
            content = `Ba thì cốt lõi chiếm hơn 80% thời lượng giao tiếp hàng ngày:\n1. **Hiện tại đơn (Simple Present)**: Diễn tả thói quen, chân lý. (Ví dụ: I study English every day).\n2. **Quá khứ đơn (Simple Past)**: Diễn tả việc đã kết thúc. (Ví dụ: I learned 10 new words yesterday).\n3. **Tương lai đơn (Simple Future)**: Diễn tả dự định tức thời. (Ví dụ: I will call you tonight).\n\nHãy dùng Tab AI Assistant bên cạnh để gõ thử 3 câu ví dụ về cuộc sống của bạn sử dụng 3 thì trên và nhờ AI sửa lỗi ngữ pháp.`;
          } else if (l.order_index === 2 && secIdx === 1) {
            duration = '06:30';
            description = 'Cách đặt câu hỏi lịch sự, câu hỏi lựa chọn và cách lên giọng cuối câu hỏi để cuộc trò chuyện tự nhiên hơn.';
            content = `Luyện tập cách đặt câu hỏi:\n- Yes/No questions: Lên giọng ở cuối câu. (e.g., Do you like coffee? ↗)\n- Wh-questions: Xuống giọng ở cuối câu. (e.g., What is your favorite food? ↘)\n- Tag questions (Câu hỏi đuôi): Dùng để xác nhận thông tin. (e.g., You are a student, aren't you?)\n\n*Thực hành*: Nhờ AI Assistant đóng vai làm người bản xứ và đặt câu hỏi phỏng vấn bạn nhé.`;
          } else if (l.order_index === 1 && secIdx === 2) {
            duration = '10:15';
            description = 'Phân biệt nghe chủ động và nghe thụ động. Cách áp dụng phương pháp shadowing để rèn giọng điệu nói tiếng Anh.';
            content = `Phương pháp Shadowing (Nói đuổi):\n1. Nghe một câu tiếng Anh ngắn mẫu.\n2. Bắt chước ngay lập tức theo ngữ điệu, cách nhấn âm và nối âm của người nói.\n3. Ghi âm lại và tự so sánh để sửa đổi.\n\nHãy chat với AI Assistant cụm từ bạn nghe thấy trong video để xem bạn viết đúng chính tả chưa.`;
          }

          const resolvedUrl = l.content_url ? (l.content_url.startsWith('http') ? l.content_url : `http://localhost:5000${l.content_url}`) : '';
          
          const lessonObj = {
            id: String(l.lesson_id),
            title: l.title,
            duration: duration,
            type: l.content_type || 'video',
            videoUrl: l.content_type === 'video' ? resolvedUrl : null,
            pdfUrl: l.content_type === 'pdf' ? resolvedUrl : null,
            description: description,
            content: content,
            resources: l.content_type === 'pdf' ? [{ name: l.title + ' (PDF)', url: resolvedUrl }] : [],
            completed: completedLessonIds.includes(l.lesson_id)
          };

          // Check if lesson has quiz questions compiled
          const quizQuestions = getCourseQuizQuestions(l.lesson_id);
          if (quizQuestions && quizQuestions.length > 0) {
            const quizObj = {
              id: `quiz-${l.lesson_id}`,
              title: `📝 Trắc nghiệm: ${l.title}`,
              duration: `${quizQuestions.length} câu hỏi`,
              type: 'quiz',
              videoUrl: null,
              pdfUrl: null,
              description: `Bài tập trắc nghiệm luyện tập kiến thức cho bài học: ${l.title}`,
              content: '',
              resources: [],
              completed: completedLessonIds.includes(l.lesson_id)
            };
            return [lessonObj, quizObj];
          }

          return [lessonObj];
        })
      };
    });


    // 5. Tính toán tiến trình hoàn thành (%)
    const allLessons = mappedSections.flatMap(s => s.lessons);
    const completedCount = allLessons.filter(l => l.completed).length;
    const progressPercent = allLessons.length > 0 ? Math.round((completedCount / allLessons.length) * 100) : 0;

    return {
      id: String(dbCourse.course_id),
      title: dbCourse.course_name,
      instructor: "Dr. Alexander Wright",
      progress: progressPercent,
      sections: mappedSections
    };

  } catch (error) {
    console.error("Lỗi getCourseDetails từ Backend:", error);
    throw error;
  }
};

export const toggleLessonCompletion = async (lessonId) => {
  try {
    const cleanId = String(lessonId).replace('quiz-', '');
    const userId = getUserIdFromToken();
    if (!userId) throw new Error("Chưa đăng nhập");

    // Lấy tiến trình hiện tại để tìm trạng thái hoàn thành hiện tại
    const progressResponse = await apiClient.get(`/progress/${userId}`);
    const progressList = progressResponse.data.progress || [];
    const currentProgress = progressList.find(p => String(p.lesson_id) === String(cleanId));
    
    const newCompletedState = currentProgress ? !currentProgress.is_completed : true;

    // Gửi cập nhật lên backend
    await apiClient.post('/progress', {
      userId: userId,
      lessonId: parseInt(cleanId, 10),
      isCompleted: newCompletedState
    });

    return newCompletedState;
  } catch (error) {
    console.error("Lỗi toggleLessonCompletion lên backend:", error);
    throw error;
  }
};


export const getLessonById = async (lessonId) => {
  try {
    const isQuiz = String(lessonId).startsWith('quiz-');
    const cleanId = isQuiz ? lessonId.replace('quiz-', '') : lessonId;

    // 1. Lấy chi tiết bài học từ API backend
    const response = await apiClient.get(`/courses/lessons/${cleanId}`);
    const l = response.data.lesson;

    // 2. Lấy trạng thái hoàn thành từ backend
    const userId = getUserIdFromToken();
    let completed = false;
    if (userId) {
      try {
        const progressResponse = await apiClient.get(`/progress/${userId}`);
        const progressList = progressResponse.data.progress || [];
        const currentProgress = progressList.find(p => String(p.lesson_id) === String(cleanId));
        completed = currentProgress ? currentProgress.is_completed : false;
      } catch (err) {
        console.error("Lỗi lấy tiến trình của bài học:", err);
      }
    }

    // 3. Khớp nội dung tóm tắt giàu ngữ cảnh cho các bài học mẫu
    let description = 'Trong bài học này, bạn sẽ làm quen với lộ trình học và cách tương tác hiệu quả với Trợ lý ảo AI Assistant.';
    let content = 'Chào mừng bạn đến với lớp học English for Communication! Hãy sử dụng Chatbot AI ở góc bên phải để tương tác.';
    let duration = '05:00';

    if (String(cleanId) === '2') {
      duration = '03:15';
      description = 'Trong bài học này, bạn sẽ làm quen với lộ trình học và cách tương tác hiệu quả với Trợ lý ảo AI Chatbot ở thanh bên phải để sửa lỗi phát âm và ngữ pháp.';
      content = `Chào mừng bạn đến với khóa học English for Communication!\n\nTrong bài đầu tiên này, chúng ta sẽ tìm hiểu:\n- Cách thiết lập mục tiêu học tiếng Anh giao tiếp hàng ngày.\n- Cách tận dụng Trợ lý AI (AI Assistant) bên cạnh video để đặt câu hỏi trực tiếp khi gặp cấu trúc ngữ pháp khó.\n- Cách thực hành luyện nói và đặt câu hỏi cho AI để ghi nhớ từ vựng.`;
    } else if (String(cleanId) === '3') {
      duration = '05:42';
      description = 'Làm thế nào để dừng việc dịch nhẩm từ tiếng Việt sang tiếng Anh trước khi nói? Bài học sẽ chỉ ra tư duy suy nghĩ bằng tiếng Anh.';
      content = `Để giao tiếp trôi chảy, điều quan trọng nhất là loại bỏ thói quen dịch nhẩm:\n1. Liên kết trực tiếp hình ảnh/khái niệm với từ tiếng Anh (ví dụ nghĩ đến 'quả táo' -> thấy hình ảnh quả táo và bật ra 'apple' chứ không qua chữ tiếng Việt).\n2. Chấp nhận mắc lỗi: Đừng sợ sai ngữ pháp ở giai đoạn đầu.\n3. Đắm chìm trong ngôn ngữ: Sử dụng trợ lý AI để chat hội thoại hàng ngày.\n\n*Bài tập thực hành*: Hãy viết ra 5 câu đơn giản mô tả những vật dụng xung quanh bạn ngay bây giờ bằng tiếng Anh.`;
    } else if (String(cleanId) === '4') {
      duration = '08:12';
      description = 'Trong văn nói, bạn không cần dùng hết 12 thì. Hãy tập trung làm chủ 3 thì cốt lõi: Hiện tại đơn, Quá khứ đơn, Tương lai đơn.';
      content = `Ba thì cốt lõi chiếm hơn 80% thời lượng giao tiếp hàng ngày:\n1. **Hiện tại đơn (Simple Present)**: Diễn tả thói quen, chân lý. (Ví dụ: I study English every day).\n2. **Quá khứ đơn (Simple Past)**: Diễn tả việc đã kết thúc. (Ví dụ: I learned 10 new words yesterday).\n3. **Tương lai đơn (Simple Future)**: Diễn tả dự định tức thời. (Ví dụ: I will call you tonight).\n\nHãy dùng Tab AI Assistant bên cạnh để gõ thử 3 câu ví dụ về cuộc sống của bạn sử dụng 3 thì trên và nhờ AI sửa lỗi ngữ pháp.`;
    } else if (String(cleanId) === '5') {
      duration = '06:30';
      description = 'Cách đặt câu hỏi lịch sự, câu hỏi lựa chọn và cách lên giọng cuối câu hỏi để cuộc trò chuyện tự nhiên hơn.';
      content = `Luyện tập cách đặt câu hỏi:\n- Yes/No questions: Lên giọng ở cuối câu. (e.g., Do you like coffee? ↗)\n- Wh-questions: Xuống giọng ở cuối câu. (e.g., What is your favorite food? ↘)\n- Tag questions (Câu hỏi đuôi): Dùng để xác nhận thông tin. (e.g., You are a student, aren't you?)\n\n*Thực hành*: Nhờ AI Assistant đóng vai làm người bản xứ và đặt câu hỏi phỏng vấn bạn nhé.`;
    } else if (String(cleanId) === '6') {
      duration = '10:15';
      description = 'Phân biệt nghe chủ động và nghe thụ động. Cách áp dụng phương pháp shadowing để rèn giọng điệu nói tiếng Anh.';
      content = `Phương pháp Shadowing (Nói đuổi):\n1. Nghe một câu tiếng Anh ngắn mẫu.\n2. Bắt chước ngay lập tức theo ngữ điệu, cách nhấn âm và nối âm của người nói.\n3. Ghi âm lại và tự so sánh để sửa đổi.\n\nHãy chat với AI Assistant cụm từ bạn nghe thấy trong video để xem bạn viết đúng chính tả chưa.`;
    }

    const resolvedUrl = l.content_url ? (l.content_url.startsWith('http') ? l.content_url : `http://localhost:5000${l.content_url}`) : '';

    if (isQuiz) {
      let quizQuestions = getCourseQuizQuestions(cleanId);
      if (quizQuestions.length === 0 && l.course_id) {
        await fetchAndCacheQuizzes(l.course_id).catch(err => console.warn("Lỗi tải quizzes bổ sung:", err.message));
        quizQuestions = getCourseQuizQuestions(cleanId);
      }
      return {
        id: `quiz-${l.lesson_id}`,
        courseId: l.course_id,
        title: `📝 Trắc nghiệm: ${l.title}`,
        duration: `${quizQuestions.length} câu hỏi`,
        type: 'quiz',
        videoUrl: null,
        pdfUrl: null,
        description: `Bài tập trắc nghiệm luyện tập kiến thức cho bài học: ${l.title}`,
        content: '',
        resources: [],
        completed: completed
      };
    }

    return {
      id: String(l.lesson_id),
      courseId: l.course_id,
      title: l.title,
      duration: duration,
      type: l.content_type || 'video',
      videoUrl: l.content_type === 'video' ? resolvedUrl : null,
      pdfUrl: l.content_type === 'pdf' ? resolvedUrl : null,
      description: description,
      content: content,
      resources: l.content_type === 'pdf' ? [{ name: l.title + ' (PDF)', url: resolvedUrl }] : [],
      completed: completed
    };
  } catch (error) {
    console.error("Lỗi getLessonById từ Backend:", error);
    throw error;
  }
};
