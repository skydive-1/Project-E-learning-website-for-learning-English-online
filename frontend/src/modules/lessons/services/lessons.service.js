import apiClient from '../../../config/api.config';
import { getCourseQuizQuestions, fetchAndCacheQuizzes } from '../../quizzes/services/quizzes.service';

const DEFAULT_API_BASE_URL = 'http://localhost:5000/api';
const getApiBaseUrl = () => {
  const configuredUrl = typeof import.meta.env.VITE_API_URL === 'string'
    ? import.meta.env.VITE_API_URL.trim()
    : '';
  const isMissing = !configuredUrl || /^(undefined|null)$/i.test(configuredUrl);
  return (isMissing ? DEFAULT_API_BASE_URL : configuredUrl).replace(/\/+$/, '');
};
const getBackendHost = () => getApiBaseUrl().replace(/\/api$/, '');

export const getLessonPdfUrl = (lessonId) => {
  const cleanId = String(lessonId).replace(/^(quiz|speaking)-/, '');
  return `${getApiBaseUrl()}/lessons/${encodeURIComponent(cleanId)}/pdf`;
};

/**
 * Lấy vé xem video bài học ngắn hạn (Short-lived 60s Ticket - TASK-VIDEO-TICKET-CONTRACT-HOTFIX-01)
 * Session JWT được truyền an toàn qua Authorization header của axios, không gắn vào query string.
 */
export const getVideoTicket = async (lessonId) => {
  const cleanId = String(lessonId).replace(/^(quiz|speaking)-/, '');
  // withCredentials là bắt buộc để backend đặt cookie vé HttpOnly. Native
  // <video> dùng cookie này nên ticket không còn xuất hiện trong URL phát.
  const response = await apiClient.get(`/lessons/video/ticket/${cleanId}`, {
    withCredentials: true
  });
  return response.data;
};

export const extractYouTubeVideoId = (url = '') => {
  if (!url) return null;
  const regExp = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/)([^"&?\/\s]{11})/i;
  const match = String(url).match(regExp);
  return match && match[1].length === 11 ? match[1] : null;
};

export const isYouTubeUrl = (url = '') => Boolean(extractYouTubeVideoId(url));

/**
 * Chỉ lưu URL canonical theo video ID. Việc này loại bỏ query tracking,
 * timestamp và cả trường hợp người dùng vô tình dán cùng một URL hai lần.
 */
export const normalizeYouTubeUrl = (url = '') => {
  const videoId = extractYouTubeVideoId(String(url || '').trim());
  return videoId ? `https://www.youtube.com/watch?v=${videoId}` : '';
};


// Hàm giải mã JWT token để lấy userId
export const getUserIdFromToken = () => {
  const token = localStorage.getItem('token');
  if (!token) return null;
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
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
      fetchAndCacheQuizzes(courseId)
    ]);
    const dbCourse = courseResponse.data?.course;

    if (!dbCourse) {
      return {
        id: String(courseId),
        title: "Khóa học không tồn tại",
        instructor: "Chưa rõ",
        progress: 0,
        sections: [],
        startDate: null,
        instructorId: null
      };
    }

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
    const mappedSections = dbCourse.sections.map((sec) => {
      return {
        id: String(sec.section_id),
        title: sec.title,
        lessons: sec.lessons.flatMap(l => {
          const description = typeof l.description === 'string' ? l.description : '';
          const content = typeof l.content === 'string' ? l.content : '';
          const duration = typeof l.duration === 'string' ? l.duration : '';

          const isYouTube = l.content_type === 'youtube' || isYouTubeUrl(l.content_url);
          let resolvedUrl = '';
          if (l.content_url) {
            if (isYouTube) {
              resolvedUrl = l.content_url;
            } else if (l.content_url.startsWith('http://') || l.content_url.startsWith('https://')) {
              // Không giữ URL video ngoài trong state/client DOM. Backend sẽ cấp
              // ticket và từ chối nguồn không thể bảo vệ.
              resolvedUrl = l.content_type === 'video' ? 'protected-video-source' : l.content_url;
            } else {
              if (l.content_type === 'video') {
                // Video nội bộ: Không gắn session JWT vào URL; Active lesson player sẽ xin ticket 60s riêng
                resolvedUrl = l.content_url;
              } else {
                resolvedUrl = `${getBackendHost()}${l.content_url}`;
              }
            }
          }
          if (l.content_type === 'pdf' && (l.content_url || l.storage_key)) {
            resolvedUrl = getLessonPdfUrl(l.lesson_id);
          }
          const isSpeakingType = l.content_type === 'speaking';
          
          const lessonObj = {
            id: String(l.lesson_id),
            title: isSpeakingType && !l.title.startsWith('Speaking:') ? `Speaking: ${l.title}` : l.title,
            duration: isSpeakingType ? 'Luyện phát âm AI' : (isYouTube && !duration ? 'YouTube' : duration),
            type: isYouTube ? 'youtube' : (l.content_type || 'video'),
            playbackType: isYouTube ? 'youtube' : (l.playbackType || (l.content_url && l.content_url.includes('.mpd') ? 'dash' : 'mp4')),
            isDrmProtected: isYouTube ? false : (l.isDrmProtected !== undefined ? l.isDrmProtected : (l.content_url && l.content_url.includes('.mpd'))),
            videoUrl: isYouTube ? null : (l.content_type === 'video' ? resolvedUrl : null),
            youtubeUrl: isYouTube ? (l.content_url || resolvedUrl) : null,
            contentUrl: l.content_url,
            pdfUrl: l.content_type === 'pdf' ? resolvedUrl : null,
            description: description,
            content: content,
            resources: l.content_type === 'pdf' ? [{ name: l.title + ' (PDF)', url: resolvedUrl }] : [],
            completed: completedLessonIds.includes(l.lesson_id),
            speakingSentences: l.speaking_sentences || l.speakingSentences || '',
            speakingQuestions: l.speaking_questions || l.speakingQuestions || ''
          };

          const resultList = [lessonObj];

          // Check if lesson has speaking exercises configured
          const speakingDbIds = ['1', '2', '3', '4', '5', '10', '11', '12', '13', '14', '25', '26', '27', '28', '29', '30'];
          const hasSpeaking = !isSpeakingType && (
                              (l.speaking_sentences && l.speaking_sentences.trim()) || 
                              (l.speaking_questions && l.speaking_questions.trim()) ||
                              speakingDbIds.includes(String(l.lesson_id))
          );
          if (hasSpeaking) {
            const speakingObj = {
              id: `speaking-${l.lesson_id}`,
              title: `Speaking: ${l.title}`,
              duration: `Luyện phát âm AI`,
              type: 'speaking',
              videoUrl: null,
              pdfUrl: null,
              description: `Bài tập phát âm và phản xạ nói với AI cho bài học: ${l.title}`,
              content: '',
              resources: [],
              completed: completedLessonIds.includes(l.lesson_id),
              speakingSentences: l.speaking_sentences || '',
              speakingQuestions: l.speaking_questions || ''
            };
            resultList.push(speakingObj);
          }

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
            resultList.push(quizObj);
          }

          return resultList;
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
      sections: mappedSections,
      startDate: dbCourse.start_date,
      instructorId: dbCourse.instructor_id
    };

  } catch (error) {
    console.error("Lỗi getCourseDetails từ Backend:", error);
    if (error.response && error.response.status === 404) {
      return {
        id: String(courseId),
        title: "Khóa học không tồn tại",
        instructor: "Chưa rõ",
        progress: 0,
        sections: [],
        startDate: null,
        instructorId: null
      };
    }
    throw error;
  }
};

export const toggleLessonCompletion = async (lessonId) => {
  try {
    const cleanId = String(lessonId).replace('quiz-', '').replace('speaking-', '');
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
    const isSpeaking = String(lessonId).startsWith('speaking-');
    let cleanId = lessonId;
    if (isQuiz) cleanId = lessonId.replace('quiz-', '');
    if (isSpeaking) cleanId = lessonId.replace('speaking-', '');

    // 1. Lấy chi tiết bài học từ API backend
    const response = await apiClient.get(`/courses/lessons/${cleanId}`);
    const l = response.data?.lesson;

    if (!l) {
      return null;
    }

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

    // Chỉ hiển thị nội dung do API trả về; không chèn dữ liệu bài học mẫu theo ID.
    const description = typeof l.description === 'string' ? l.description : '';
    const content = typeof l.content === 'string' ? l.content : '';
    const duration = typeof l.duration === 'string' ? l.duration : '';

    const isYouTube = l.content_type === 'youtube' || isYouTubeUrl(l.content_url);
    let resolvedUrl = '';
    if (l.content_url) {
      if (isYouTube) {
        resolvedUrl = l.content_url;
      } else if (l.content_url.startsWith('http://') || l.content_url.startsWith('https://')) {
        resolvedUrl = l.content_type === 'video' ? 'protected-video-source' : l.content_url;
      } else {
        if (l.content_type === 'video') {
          // Video nội bộ: Không gắn session JWT vào URL; Active lesson player sẽ xin ticket 60s riêng
          resolvedUrl = l.content_url;
        } else {
          resolvedUrl = `${getBackendHost()}${l.content_url}`;
        }
      }
    }
    if (l.content_type === 'pdf' && (l.content_url || l.storage_key)) {
      resolvedUrl = getLessonPdfUrl(l.lesson_id);
    }

    if (isQuiz) {
      let quizQuestions = getCourseQuizQuestions(cleanId);
      if (quizQuestions.length === 0 && l.course_id) {
        await fetchAndCacheQuizzes(l.course_id);
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

    if (isSpeaking) {
      return {
        id: `speaking-${l.lesson_id}`,
        courseId: l.course_id,
        title: `Speaking: ${l.title}`,
        duration: `Luyện phát âm AI`,
        type: 'speaking',
        videoUrl: null,
        pdfUrl: null,
        description: `Bài tập phát âm và phản xạ nói với AI cho bài học: ${l.title}`,
        content: '',
        resources: [],
        completed: completed,
        speakingSentences: l.speaking_sentences || '',
        speakingQuestions: l.speaking_questions || ''
      };
    }

    const isSpeakingType = l.content_type === 'speaking';
    
    // Map danh sách tài liệu đính kèm thực tế từ bảng lesson_materials
    let resolvedResources = [];
    if (l.materials && Array.isArray(l.materials)) {
      resolvedResources = l.materials.map(m => ({
        id: m.material_id || m.id,
        name: m.file_name || m.name,
        url: m.file_url ? (m.file_url.startsWith('http') ? m.file_url : `${getBackendHost()}${m.file_url}`) : (m.url || ''),
        fileType: m.file_type || m.fileType || 'application/pdf',
        sizeKb: m.file_size_kb || m.sizeKb || 0,
        createdAt: m.created_at || m.createdAt
      }));
    }

    if (resolvedResources.length === 0 && l.content_type === 'pdf' && resolvedUrl) {
      resolvedResources = [{ name: l.title + ' (PDF)', url: resolvedUrl, sizeKb: 0 }];
    }

    return {
      id: String(l.lesson_id),
      courseId: l.course_id,
      title: isSpeakingType && !l.title.startsWith('Speaking:') ? `Speaking: ${l.title}` : l.title,
      duration: isSpeakingType ? 'Luyện phát âm AI' : (isYouTube && !duration ? 'YouTube' : duration),
      type: isYouTube ? 'youtube' : (l.content_type || 'video'),
      playbackType: isYouTube ? 'youtube' : (l.playbackType || (l.content_url && l.content_url.includes('.mpd') ? 'dash' : 'mp4')),
      videoUrl: isYouTube ? null : (l.content_type === 'video' ? resolvedUrl : null),
      youtubeUrl: isYouTube ? (l.content_url || resolvedUrl) : null,
      contentUrl: l.content_url,
      isDrmProtected: isYouTube ? false : (l.isDrmProtected !== undefined ? l.isDrmProtected : (l.content_url && l.content_url.includes('.mpd'))),
      pdfUrl: l.content_type === 'pdf' ? resolvedUrl : null,
      description: description,
      content: content,
      resources: resolvedResources,
      completed: completed,
      speakingSentences: l.speaking_sentences || l.speakingSentences || '',
      speakingQuestions: l.speaking_questions || l.speakingQuestions || ''
    };
  } catch (error) {
    console.error("Lỗi getLessonById từ Backend:", error);
    if (error.response && error.response.status === 404) {
      return null;
    }
    throw error;
  }
};

/**
 * Lấy danh sách tài liệu đính kèm của bài học
 */
export const getLessonMaterials = async (lessonId) => {
  try {
    const cleanId = String(lessonId).replace(/^(quiz|speaking)-/, '');
    const response = await apiClient.get(`/lessons/${cleanId}/materials`);
    return response.data?.materials || [];
  } catch (error) {
    console.error("Lỗi getLessonMaterials:", error);
    throw error;
  }
};

/**
 * Tải lên tài liệu đính kèm cho bài học (Giảng viên / Admin)
 */
export const uploadLessonMaterial = async (lessonId, formData) => {
  const cleanId = String(lessonId).replace(/^(quiz|speaking)-/, '');
  const response = await apiClient.post(`/lessons/${cleanId}/materials`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return response.data?.material;
};

/**
 * Xóa tài liệu đính kèm (Giảng viên / Admin)
 */
export const deleteLessonMaterial = async (lessonId, materialId) => {
  const cleanId = String(lessonId).replace(/^(quiz|speaking)-/, '');
  const response = await apiClient.delete(`/lessons/${cleanId}/materials/${materialId}`);
  return response.data;
};
