import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import apiClient from '../../../config/api.config';
import { 
  FiArrowLeft, FiSave, FiUpload, FiTrash2, 
  FiPlus, FiMove, FiVideo, FiFileText, FiAlertCircle, FiLoader,
  FiCheckCircle, FiEdit, FiSearch, FiLayers, FiBook, FiZap, FiMessageSquare
} from 'react-icons/fi';
import Header from '../../../components/common/Header';
import Footer from '../../../components/common/Footer';
import { SingleDatePicker } from '../../../components/ui';
import InstructorCopyrightPolicyModal from '../components/InstructorCopyrightPolicyModal';
import CreateQuizDialog from '../../courses/components/CreateQuizDialog';
import { 
  createQuiz, 
  generateQuizAi, 
  fetchAndCacheQuizzes,
  deleteQuizById
} from '../../quizzes/services/quizzes.service';
import { syncClozeGaps, validateClozeDraft, normalizeQuestion, normalizeQuestionsList } from '../../quizzes/utils/openCloze';
import { useToast } from '../../../context/ToastContext';
import '../styles/instructor.scss';

const isAllowedExternalMediaUrl = (url = '') => /^https?:\/\//i.test(url) && !/\.supabase\.co(?:\/|$)/i.test(url);

export const isMediaReadyForPublish = (lesson) => {
  if (isAllowedExternalMediaUrl(lesson.contentUrl)) return true;
  const hasClaimablePending = lesson.mediaStatus === 'PENDING' && lesson.uploadVerified === true &&
    lesson.pendingUploadId && lesson.storageKey && lesson.storageBucket && lesson.mimeType &&
    Number(lesson.sizeBytes) > 0 && lesson.checksumSha256;
  const isExistingReady = lesson.mediaStatus === 'READY' && lesson.uploadVerified === true;
  return Boolean(hasClaimablePending || isExistingReady);
};

export const applySuccessfulUploadToLesson = (lesson, upload, file = {}) => {
  const fileUrl = upload.fileUrl || upload.storageKey;
  const mimeType = upload.mimeType || upload.mimetype;
  const detectedType = mimeType?.includes('pdf') || upload.playbackType === 'pdf' ? 'pdf' : 'video';
  return {
    ...lesson,
    contentUrl: fileUrl,
    storageKey: upload.storageKey,
    storageBucket: upload.storageBucket || (detectedType === 'pdf' ? 'documents' : 'videos'),
    storageProvider: upload.storageProvider || 'r2',
    mimeType,
    sizeBytes: upload.sizeBytes || file.size,
    checksumSha256: upload.checksumSha256,
    mediaStatus: upload.mediaStatus || 'PENDING_AUDIT',
    pendingUploadId: upload.pendingUploadId,
    type: detectedType,
    uploading: false,
    uploadVerified: true,
    fileName: upload.originalName || file.name,
    hasAcceptedPolicy: true
  };
};

const getRoleFromToken = () => {
  const token = localStorage.getItem('token');
  if (!token) return null;
  try {
    const payloadBase64 = token.split('.')[1];
    const payloadJson = atob(payloadBase64);
    const payload = JSON.parse(payloadJson);
    return parseInt(payload.roleId || payload.role, 10);
  } catch (e) {
    return null;
  }
};

const getTodayCivilDate = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const getNextYearCivilDate = () => {
  const d = new Date();
  return `${d.getFullYear() + 1}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const CourseEditor = () => {
  const navigate = useNavigate();
  const showToast = useToast();
  const { courseId } = useParams();
  const fileInputRef = useRef({});
  const isEditMode = Boolean(courseId);

  // Modal Cam kết Bản quyền Giảng viên
  const [policyModalOpen, setPolicyModalOpen] = useState(false);

  // Auth check
  useEffect(() => {
    const role = getRoleFromToken();
    if (role !== 2 && role !== 1) { // Instructor or Admin
      navigate('/');
    }
  }, [navigate]);

  // Main Tabs in Course Creation Hub: 'basic', 'curriculum', 'quizzes'
  const [activeHubTab, setActiveHubTab] = useState('basic');
  const [subjects, setSubjects] = useState([]);
  const [courseName, setCourseName] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [startDate, setStartDate] = useState(getTodayCivilDate());
  const [endDate, setEndDate] = useState(getNextYearCivilDate());
  
  const [sections, setSections] = useState([
    {
      id: Date.now(),
      title: 'Chương 1: Giới thiệu',
      lessons: [
        { 
          id: Date.now() + 1, 
          title: '1. Chào mừng bạn đến với khóa học', 
          type: 'video', 
          contentUrl: '', 
          uploading: false,
          quizQuestions: [],
          quizTitle: '',
          quizDescription: '',
          quizDifficulty: 'Medium',
          quizTimeLimit: 15
        }
      ]
    }
  ]);

  const [expandedSpeaking, setExpandedSpeaking] = useState({});
  const [loading, setLoading] = useState(false);
  const [fetchingSubjects, setFetchingSubjects] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // ── Quizzes Dialog State ──────────────────────────────────────────────────
  const [quizDialogTarget, setQuizDialogTarget] = useState(null); // { sIdx, lIdx }
  const [quizDialogMode, setQuizDialogMode] = useState('manual'); // 'manual' | 'ai'
  const [quizDialogTitle, setQuizDialogTitle] = useState('');
  const [quizDialogDesc, setQuizDialogDesc] = useState('');
  const [quizDialogDifficulty, setQuizDialogDifficulty] = useState('Medium');
  const [quizDialogTimeLimit, setQuizDialogTimeLimit] = useState(15);
  const [quizDialogIsPrivate, setQuizDialogIsPrivate] = useState(false);
  const [quizDialogPinCode, setQuizDialogPinCode] = useState('');
  const [quizDialogQuestions, setQuizDialogQuestions] = useState([]);
  const [quizDialogSubmitting, setQuizDialogSubmitting] = useState(false);

  const [quizAiTopic, setQuizAiTopic] = useState('');
  const [quizAiCount, setQuizAiCount] = useState(5);
  const [quizAiTypes, setQuizAiTypes] = useState(['multiple_choice', 'open_cloze']);
  const [quizAiGenerating, setQuizAiGenerating] = useState(false);

  // Search & Filter in Quizzes Hub Tab
  const [quizHubSearch, setQuizHubSearch] = useState('');
  const [quizHubFilter, setQuizHubFilter] = useState('all'); // 'all' | 'with_quiz' | 'no_quiz'

  // Fetch course details for editing
  useEffect(() => {
    if (isEditMode) {
      const fetchCourse = async () => {
        try {
          setLoading(true);
          const [courseRes, quizzesData] = await Promise.all([
            apiClient.get(`/courses/${courseId}`),
            fetchAndCacheQuizzes(courseId)
          ]);

          if (courseRes.data && courseRes.data.success) {
            const course = courseRes.data.course;
            setCourseName(course.course_name || '');
            setSubjectId(String(course.subject_id || ''));
            if (course.start_date) setStartDate(typeof course.start_date === 'string' ? course.start_date.substring(0, 10) : getTodayCivilDate());
            if (course.end_date) setEndDate(typeof course.end_date === 'string' ? course.end_date.substring(0, 10) : getNextYearCivilDate());
            
            const quizByLessonId = {};
            if (Array.isArray(quizzesData)) {
              quizzesData.forEach(q => {
                if (q.lessonId) {
                  quizByLessonId[String(q.lessonId)] = q;
                }
              });
            }

            if (course.sections) {
              setSections(course.sections.map(sec => ({
                id: sec.section_id,
                title: sec.title,
                lessons: (sec.lessons || []).map(l => {
                  const isExternal = isAllowedExternalMediaUrl(l.content_url);
                  const status = l.media_status || l.mediaStatus || (isExternal ? 'READY' : 'PENDING_AUDIT');
                  const isVerified = status === 'READY' || isExternal;
                  const attachedQuiz = quizByLessonId[String(l.lesson_id)];

                  return {
                    id: l.lesson_id,
                    title: l.title,
                    type: l.content_type,
                    contentUrl: l.content_url,
                    storageKey: l.storage_key || l.storageKey || (!isExternal ? l.content_url : null),
                    storageBucket: l.storage_bucket || l.storageBucket || (l.content_type === 'pdf' ? 'documents' : 'videos'),
                    storageProvider: l.storage_provider || l.storageProvider || (isExternal ? 'external' : 'r2'),
                    mimeType: l.mime_type || l.mimeType || (l.content_type === 'pdf' ? 'application/pdf' : 'video/mp4'),
                    sizeBytes: l.size_bytes || l.sizeBytes || 0,
                    checksumSha256: l.checksum_sha256 || l.checksumSha256 || null,
                    mediaStatus: status,
                    pendingUploadId: null,
                    uploading: false,
                    uploadVerified: isVerified,
                    fileName: l.content_url ? l.content_url.split('/').pop() : '',
                    speakingSentences: l.speaking_sentences || '',
                    speakingQuestions: l.speaking_questions || '',
                    quizId: attachedQuiz?.id || null,
                    quizTitle: attachedQuiz?.title || '',
                    quizDescription: attachedQuiz?.description || '',
                    quizDifficulty: attachedQuiz?.difficulty || 'Medium',
                    quizTimeLimit: attachedQuiz?.timeLimit || 15,
                    quizQuestions: Array.isArray(attachedQuiz?.questions) ? normalizeQuestionsList(attachedQuiz.questions) : []
                  };
                })
              })));
            }
          }
        } catch (err) {
          console.error('Lỗi khi tải thông tin khóa học:', err);
          setErrorMsg('Không thể tải chi tiết khóa học từ máy chủ.');
        } finally {
          setLoading(false);
        }
      };
      fetchCourse();
    }
  }, [courseId, isEditMode]);

  // Fetch subjects
  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        const response = await apiClient.get('/courses/subjects');
        if (response.data && response.data.subjects) {
          setSubjects(response.data.subjects);
          if (response.data.subjects.length > 0 && !subjectId) {
            setSubjectId(response.data.subjects[0].subject_id.toString());
          }
        }
      } catch (err) {
        console.error('Lỗi khi lấy danh sách môn học:', err);
        setErrorMsg('Không thể kết nối máy chủ để lấy danh sách môn học.');
      } finally {
        setFetchingSubjects(false);
      }
    };
    fetchSubjects();
  }, []);

  // Handlers for Curriculum
  const handleAddSection = () => {
    setSections([
      ...sections,
      {
        id: Date.now(),
        title: `Chương ${sections.length + 1}: Tiêu đề chương`,
        lessons: []
      }
    ]);
  };

  const handleDeleteSection = (sIdx) => {
    if (sections.length === 1) {
      showToast('Khóa học phải có ít nhất 1 chương học.', 'warning');
      return;
    }
    const newSections = sections.filter((_, idx) => idx !== sIdx);
    setSections(newSections);
  };

  const handleSectionTitleChange = (sIdx, val) => {
    const newSections = [...sections];
    newSections[sIdx].title = val;
    setSections(newSections);
  };

  const handleAddLesson = (sIdx) => {
    const newSections = [...sections];
    newSections[sIdx].lessons.push({
      id: Date.now(),
      title: 'Bài học mới',
      type: 'video',
      contentUrl: '',
      uploading: false,
      speakingSentences: '',
      speakingQuestions: '',
      quizQuestions: [],
      quizTitle: '',
      quizDescription: '',
      quizDifficulty: 'Medium',
      quizTimeLimit: 15
    });
    setSections(newSections);
  };

  const handleDeleteLesson = (sIdx, lIdx) => {
    const newSections = [...sections];
    newSections[sIdx].lessons = newSections[sIdx].lessons.filter((_, idx) => idx !== lIdx);
    setSections(newSections);
  };

  const handleLessonChange = (sIdx, lIdx, key, value) => {
    const newSections = [...sections];
    newSections[sIdx].lessons[lIdx][key] = value;
    setSections(newSections);
  };

  // Upload File
  const triggerFileSelect = (sIdx, lIdx) => {
    const refKey = `${sIdx}-${lIdx}`;
    if (fileInputRef.current[refKey]) {
      fileInputRef.current[refKey].click();
    }
  };

  const handleFileChange = async (sIdx, lIdx, e) => {
    const file = e.target.files[0];
    if (!file) return;

    const MAX_VIDEO_SIZE_MB = 500;
    const MAX_PDF_SIZE_MB = 500;
    const ext = file.name.split('.').pop().toLowerCase();
    const isVideoFile = file.type.startsWith('video/') || ['mp4', 'mov', 'mkv', 'avi'].includes(ext);
    const isPdfFile = file.type === 'application/pdf' || ext === 'pdf';
    const lessonType = sections[sIdx].lessons[lIdx].type;

    if (lessonType === 'video' && !isVideoFile) {
      const msg = 'Bài học Video chỉ nhận file video MP4. Vui lòng chọn lại.';
      handleLessonChange(sIdx, lIdx, 'uploadError', msg);
      setErrorMsg(msg);
      return;
    }
    if (lessonType === 'pdf' && !isPdfFile) {
      const msg = 'Bài học PDF chỉ nhận file định dạng PDF. Vui lòng chọn lại.';
      handleLessonChange(sIdx, lIdx, 'uploadError', msg);
      setErrorMsg(msg);
      return;
    }
    if (isVideoFile && ext !== 'mp4') {
      const msg = `Định dạng .${ext} chưa được hỗ trợ. Vui lòng chuyển sang định dạng MP4 chuẩn.`;
      handleLessonChange(sIdx, lIdx, 'uploadError', msg);
      setErrorMsg(msg);
      return;
    }

    const fileSizeMB = file.size / (1024 * 1024);
    const maxSizeMB = isVideoFile ? MAX_VIDEO_SIZE_MB : MAX_PDF_SIZE_MB;
    if (fileSizeMB > maxSizeMB) {
      const msg = `Dung lượng tệp (${fileSizeMB.toFixed(1)} MB) vượt quá mức cho phép (${maxSizeMB} MB).`;
      handleLessonChange(sIdx, lIdx, 'uploadError', msg);
      setErrorMsg(msg);
      return;
    }

    const fileSizeFormatted = fileSizeMB >= 1
      ? `${fileSizeMB.toFixed(1)} MB`
      : `${(file.size / 1024).toFixed(0)} KB`;

    const newSections = [...sections];
    newSections[sIdx].lessons[lIdx] = {
      ...newSections[sIdx].lessons[lIdx],
      uploading: true,
      uploadError: null,
      uploadProgress: 0
    };
    setSections(newSections);
    setErrorMsg('');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await apiClient.post('/courses/upload', formData, {
        timeout: 300000,
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setSections(prev => {
              return prev.map((sec, si) => si !== sIdx ? sec : {
                ...sec,
                lessons: sec.lessons.map((les, li) => li !== lIdx ? les : {
                  ...les,
                  uploadProgress: percent
                })
              });
            });
          }
        }
      });

      if (response.data && response.data.success) {
        if (!response.data.pendingUploadId || !response.data.storageKey || !response.data.storageBucket ||
            !response.data.mimeType || !response.data.checksumSha256 || !Number(response.data.sizeBytes)) {
          throw new Error('Phản hồi thiếu metadata bắt buộc. Vui lòng thử tải lại.');
        }
        setSections(prev => {
          return prev.map((sec, si) => si !== sIdx ? sec : {
            ...sec,
            lessons: sec.lessons.map((les, li) => li !== lIdx ? les : {
              ...applySuccessfulUploadToLesson(les, response.data, file),
              uploadProgress: 100,
              fileSizeFormatted
            })
          });
        });
      } else {
        throw new Error(response.data?.message || 'Không thể xác thực tệp.');
      }
    } catch (err) {
      console.error('Lỗi khi tải file:', err);
      const errMsg = err.response?.data?.message || err.message || 'Lỗi khi tải file lên máy chủ.';
      setErrorMsg(errMsg);
      setSections(prev => {
        return prev.map((sec, si) => si !== sIdx ? sec : {
          ...sec,
          lessons: sec.lessons.map((les, li) => li !== lIdx ? les : {
            ...les,
            uploading: false,
            uploadVerified: false,
            uploadError: errMsg,
            uploadProgress: 0
          })
        });
      });
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  // ── Quizzes Handlers ──────────────────────────────────────────────────────
  const handleOpenQuizDialog = (sIdx, lIdx, initialMode = 'manual') => {
    const lesson = sections[sIdx].lessons[lIdx];
    setQuizDialogTarget({ sIdx, lIdx });
    setQuizDialogMode(initialMode);
    setQuizDialogTitle(lesson.quizTitle || `Trắc nghiệm: ${lesson.title}`);
    setQuizDialogDesc(lesson.quizDescription || `Bộ câu hỏi kiểm tra củng cố kiến thức cho bài học: ${lesson.title}`);
    setQuizDialogDifficulty(lesson.quizDifficulty || 'Medium');
    setQuizDialogTimeLimit(lesson.quizTimeLimit || 15);
    setQuizDialogQuestions(Array.isArray(lesson.quizQuestions) && lesson.quizQuestions.length > 0 ? [...lesson.quizQuestions] : [
      {
        question_text: '',
        question_type: 'multiple_choice',
        options: ['', '', '', ''],
        correct_answer: 'A',
        explanation: ''
      }
    ]);
    setQuizAiTopic(`${courseName ? `${courseName} - ` : ''}${lesson.title}`);
    setQuizAiCount(5);
    setQuizAiTypes(['multiple_choice', 'open_cloze']);
  };

  const handleAddQuizQuestion = (type = 'multiple_choice') => {
    setQuizDialogQuestions(prev => [
      ...prev,
      {
        question_text: '',
        question_type: type,
        options: type === 'multiple_choice' ? ['', '', '', ''] : [],
        correct_answer: type === 'multiple_choice' ? 'A' : '',
        explanation: ''
      }
    ]);
  };

  const handleGenerateAiQuiz = async () => {
    if (!quizAiTopic.trim()) {
      showToast('Vui lòng nhập chủ đề sinh câu hỏi.', 'warning');
      return;
    }
    if (quizAiTypes.length === 0) {
      showToast('Vui lòng chọn ít nhất một dạng câu hỏi.', 'warning');
      return;
    }
    try {
      setQuizAiGenerating(true);
      const res = await generateQuizAi({
        topic: quizAiTopic.trim(),
        count: quizAiCount,
        questionTypes: quizAiTypes
      });
      if (res && Array.isArray(res.questions) && res.questions.length > 0) {
        const normalized = normalizeQuestionsList(res.questions);
        setQuizDialogQuestions(normalized);
        setQuizDialogMode('manual');
        showToast(`Trợ lý AI đã tạo thành công ${normalized.length} câu hỏi!`, 'success');
      } else {
        showToast('Không nhận được câu hỏi từ AI. Vui lòng thử lại.', 'error');
      }
    } catch (err) {
      console.error('Lỗi sinh câu hỏi AI:', err);
      showToast(err.response?.data?.message || 'Không thể tạo câu hỏi từ AI.', 'error');
    } finally {
      setQuizAiGenerating(false);
    }
  };

  const handleSaveQuizDialog = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!quizDialogTitle.trim()) {
      showToast('Vui lòng nhập tiêu đề bài trắc nghiệm.', 'warning');
      return;
    }
    if (quizDialogQuestions.length === 0) {
      showToast('Đề thi phải có ít nhất 1 câu hỏi.', 'warning');
      return;
    }

    // Auto-normalize questions ensuring strictly valid formats
    const cleanedQuestions = normalizeQuestionsList(quizDialogQuestions);

    const invalidQuestion = cleanedQuestions.find(q => {
      const type = q.question_type || 'multiple_choice';
      if (!String(q.question_text || '').trim()) return true;
      if (type === 'multiple_choice') {
        return !Array.isArray(q.options)
          || q.options.length !== 4
          || q.options.some(opt => !String(opt).trim())
          || !/^[A-D]$/.test(String(q.correct_answer || ''));
      }
      if (type === 'pronunciation') return !String(q.correct_answer || '').trim();
      if (type === 'open_cloze') return Boolean(validateClozeDraft({ questionText: q.question_text, options: q.options }));
      return false;
    });

    if (invalidQuestion) {
      showToast('Vui lòng điền đầy đủ câu hỏi và đáp án hợp lệ cho từng mục.', 'warning');
      return;
    }

    if (!quizDialogTarget) return;
    const { sIdx, lIdx } = quizDialogTarget;
    const targetLesson = sections[sIdx].lessons[lIdx];

    const updatedSections = [...sections];
    updatedSections[sIdx].lessons[lIdx] = {
      ...targetLesson,
      quizTitle: quizDialogTitle.trim(),
      quizDescription: quizDialogDesc.trim(),
      quizDifficulty: quizDialogDifficulty,
      quizTimeLimit: quizDialogTimeLimit,
      quizQuestions: cleanedQuestions,
      quizDeleted: false
    };
    setSections(updatedSections);

    if (targetLesson.id && typeof targetLesson.id === 'number' && isEditMode) {
      try {
        setQuizDialogSubmitting(true);
        await createQuiz({
          title: quizDialogTitle.trim(),
          description: quizDialogDesc.trim(),
          difficulty: quizDialogDifficulty,
          timeLimit: quizDialogTimeLimit,
          isPrivate: false,
          pinCode: null,
          courseId: parseInt(courseId, 10),
          lessonId: targetLesson.id,
          questions: cleanedQuestions
        });
        showToast(`Đã lưu ${cleanedQuestions.length} câu hỏi cho bài học "${targetLesson.title}"!`, 'success');
      } catch (err) {
        console.warn('Lỗi lưu trực tiếp quiz:', err?.message);
        showToast(`Đã cập nhật câu hỏi cho bài học! Sẽ lưu cùng khóa học khi xuất bản.`, 'info');
      } finally {
        setQuizDialogSubmitting(false);
      }
    } else {
      showToast(`Đã cập nhật ${cleanedQuestions.length} câu hỏi vào bài học "${targetLesson.title}"!`, 'success');
    }

    setQuizDialogTarget(null);
  };

  const handleDeleteLessonQuiz = async (sIdx, lIdx) => {
    const lesson = sections[sIdx].lessons[lIdx];
    if (!window.confirm(`Bạn có chắc muốn xóa toàn bộ câu hỏi trắc nghiệm của bài học "${lesson.title}"?`)) {
      return;
    }

    if (lesson.quizId && isEditMode) {
      try {
        await deleteQuizById(lesson.quizId);
      } catch (err) {
        console.warn('Xóa quiz trên máy chủ:', err?.message);
      }
    }

    const updatedSections = [...sections];
    updatedSections[sIdx].lessons[lIdx] = {
      ...lesson,
      quizId: null,
      quizTitle: '',
      quizDescription: '',
      quizQuestions: [],
      quizDeleted: true
    };
    setSections(updatedSections);
    showToast(`Đã xóa bộ trắc nghiệm của bài học "${lesson.title}".`, 'info');
  };

  // Submit / Publish Course
  const handleInitiatePublish = () => {
    if (!courseName.trim()) {
      setErrorMsg('Vui lòng nhập tên khóa học.');
      return;
    }
    if (!subjectId) {
      setErrorMsg('Vui lòng chọn môn học.');
      return;
    }
    if (sections.length === 0) {
      setErrorMsg('Khóa học phải có ít nhất 1 chương.');
      return;
    }

    for (let sIdx = 0; sIdx < sections.length; sIdx++) {
      const section = sections[sIdx];
      if (!section.title.trim()) {
        setErrorMsg(`Tên chương thứ ${sIdx + 1} không được để trống.`);
        return;
      }
      if (section.lessons.length === 0) {
        setErrorMsg(`Chương "${section.title}" phải có ít nhất 1 bài học.`);
        return;
      }
      for (let lIdx = 0; lIdx < section.lessons.length; lIdx++) {
        const lesson = section.lessons[lIdx];
        if (!lesson.title.trim()) {
          setErrorMsg(`Tên bài học trong chương "${section.title}" không được để trống.`);
          return;
        }
        if (lesson.uploading) {
          setErrorMsg(`Bài học "${lesson.title}" đang được tải lên. Vui lòng chờ hoàn tất.`);
          return;
        }
        if (lesson.type === 'video' || lesson.type === 'pdf') {
          if (!lesson.contentUrl && !lesson.storageKey) {
            setErrorMsg(`Vui lòng tải lên nội dung (${lesson.type.toUpperCase()}) cho bài học "${lesson.title}".`);
            return;
          }
          if (!isMediaReadyForPublish(lesson)) {
            setErrorMsg(`Bài học "${lesson.title}" chưa sẵn sàng. Vui lòng tải lại tệp.`);
            return;
          }
        }
      }
    }

    setErrorMsg('');
    setPolicyModalOpen(true);
  };

  const executeSubmitCourse = async (status = 1) => {
    if (!courseName.trim()) {
      setErrorMsg('Vui lòng nhập tên khóa học.');
      return;
    }
    if (!subjectId) {
      setErrorMsg('Vui lòng chọn môn học.');
      return;
    }
    if (sections.length === 0) {
      setErrorMsg('Khóa học phải có ít nhất 1 chương.');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    const payload = {
      courseName,
      subjectId: parseInt(subjectId, 10),
      startDate,
      endDate,
      status, // 1: Published, 0: Draft
      sections: sections.map((sec, sIdx) => ({
        id: sec.id,
        title: sec.title,
        orderIndex: sIdx + 1,
        lessons: sec.lessons.map((les, lIdx) => ({
          id: les.id,
          title: les.title,
          contentType: les.type,
          contentUrl: les.contentUrl,
          storageProvider: les.storageProvider || (les.contentUrl ? (isAllowedExternalMediaUrl(les.contentUrl) ? 'external' : 'r2') : null),
          storageBucket: les.storageBucket || (les.contentUrl && !les.contentUrl.startsWith('http') ? (les.type === 'pdf' ? 'documents' : 'videos') : null),
          storageKey: les.storageKey || (les.contentUrl && !les.contentUrl.startsWith('http') ? les.contentUrl : null),
          mimeType: les.mimeType || (les.type === 'pdf' ? 'application/pdf' : (les.type === 'video' ? 'video/mp4' : null)),
          sizeBytes: les.sizeBytes || 0,
          checksumSha256: les.checksumSha256 || null,
          mediaStatus: les.mediaStatus || (les.contentUrl ? 'PENDING_AUDIT' : null),
          pendingUploadId: les.pendingUploadId || null,
          orderIndex: lIdx + 1,
          speakingSentences: les.speakingSentences || '',
          speakingQuestions: les.speakingQuestions || '',
          quizTitle: les.quizTitle || `Trắc nghiệm: ${les.title}`,
          quizDescription: les.quizDescription || `Bài kiểm tra cho bài học: ${les.title}`,
          quizDifficulty: les.quizDifficulty || 'Medium',
          quizTimeLimit: les.quizTimeLimit || 15,
          quizQuestions: normalizeQuestionsList(les.quizQuestions || []),
          quizDeleted: les.quizDeleted === true
        }))
      }))
    };

    try {
      const response = isEditMode
        ? await apiClient.put(`/courses/${courseId}`, payload)
        : await apiClient.post('/courses', payload);

      if (response.data && response.data.success) {
        setSuccessMsg(
          status === 0
            ? 'Đã lưu bản nháp khóa học thành công!'
            : (isEditMode ? 'Cập nhật & Xuất bản khóa học thành công!' : 'Tạo & Xuất bản khóa học thành công!')
        );
        setTimeout(() => {
          navigate('/instructor/dashboard');
        }, 1500);
      }
    } catch (err) {
      console.error('Lỗi lưu khóa học:', err);
      setErrorMsg(err.response?.data?.message || 'Có lỗi xảy ra khi lưu khóa học trên máy chủ.');
    } finally {
      setLoading(false);
      setPolicyModalOpen(false);
    }
  };

  // Quizzes Overview Calculations
  const allLessonsFlat = sections.flatMap((sec, sIdx) => 
    sec.lessons.map((les, lIdx) => ({
      ...les,
      sIdx,
      lIdx,
      sectionTitle: sec.title
    }))
  );
  const totalLessonsCount = allLessonsFlat.length;
  const lessonsWithQuizCount = allLessonsFlat.filter(l => Array.isArray(l.quizQuestions) && l.quizQuestions.length > 0).length;
  const totalQuestionsCount = allLessonsFlat.reduce((sum, l) => sum + (l.quizQuestions?.length || 0), 0);

  const filteredQuizzesLessons = allLessonsFlat.filter(l => {
    const hasQuiz = Array.isArray(l.quizQuestions) && l.quizQuestions.length > 0;
    if (quizHubFilter === 'with_quiz' && !hasQuiz) return false;
    if (quizHubFilter === 'no_quiz' && hasQuiz) return false;
    if (quizHubSearch.trim()) {
      const q = quizHubSearch.toLowerCase();
      return l.title.toLowerCase().includes(q) || l.sectionTitle.toLowerCase().includes(q) || (l.quizTitle && l.quizTitle.toLowerCase().includes(q));
    }
    return true;
  });

  return (
    <div className="instructor-page">
      <Header />
      
      <main className="instructor-container editor-mode" style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '30px' }}>
        {/* Left Navigation Sidebar */}
        <div className="editor-sidebar">
          <button className="btn-back" onClick={() => navigate('/instructor/dashboard')}>
            <FiArrowLeft /> Về bảng điều khiển
          </button>
          
          <div className="course-nav-guide">
            <div className="hub-title">Course Creation Hub</div>
            <ul className="hub-nav-list">
              <li 
                onClick={() => setActiveHubTab('basic')}
                className={`hub-nav-item ${activeHubTab === 'basic' ? 'active' : ''}`}
              >
                <FiFileText className="hub-tab-icon" />
                <span>Thông tin khóa học</span>
              </li>
              <li 
                onClick={() => setActiveHubTab('curriculum')}
                className={`hub-nav-item ${activeHubTab === 'curriculum' ? 'active' : ''}`}
              >
                <FiBook className="hub-tab-icon" />
                <span>Chương trình học</span>
              </li>
              <li 
                onClick={() => setActiveHubTab('quizzes')}
                className={`hub-nav-item ${activeHubTab === 'quizzes' ? 'active' : ''}`}
              >
                <FiLayers className="hub-tab-icon" />
                <span>Quản lý Quizzes</span>
                {totalQuestionsCount > 0 && (
                  <span className="badge-count">
                    {totalQuestionsCount}
                  </span>
                )}
              </li>
            </ul>
          </div>
        </div>

        {/* Content Area */}
        <div className="instructor-content">
          <header className="content-header" style={{ marginBottom: '24px' }}>
            <div className="header-text">
              <h1>{isEditMode ? 'Chỉnh sửa khóa học' : 'Tạo khóa học mới'}</h1>
            </div>
            <div className="header-actions">
              <button 
                className="btn-save-draft" 
                onClick={() => executeSubmitCourse(0)}
                disabled={loading}
              >
                <FiSave /> Lưu bản nháp
              </button>
              <button 
                className="btn-publish" 
                onClick={handleInitiatePublish}
                disabled={loading}
              >
                {loading ? <FiLoader className="spin" /> : <FiUpload />} Xuất bản khóa học
              </button>
            </div>
          </header>

          {/* Feedback Messages */}
          {errorMsg && (
            <div className="error-alert-banner" style={{
              background: '#fef2f2', border: '1px solid #fee2e2', color: '#b91c1c', 
              padding: '16px', borderRadius: '12px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px'
            }}>
              <FiAlertCircle /> <span>{errorMsg}</span>
            </div>
          )}
          {successMsg && (
            <div className="success-alert-banner" style={{
              background: '#f0fdf4', border: '1px solid #dcfce7', color: '#15803d', 
              padding: '16px', borderRadius: '12px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px'
            }}>
              <FiLoader className="spin" /> <span>{successMsg}</span>
            </div>
          )}

          {/* 1. Basic Course Info Form */}
          {activeHubTab === 'basic' && (
            <div className="course-basic-form" style={{
              padding: '24px', borderRadius: '12px', marginBottom: '32px'
            }}>
              <h2 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px' }} className="form-section-title">Thông tin khóa học cơ bản</h2>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                <div>
                  <label className="form-group-label" style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '8px' }}>Tên khóa học *</label>
                  <input 
                    type="text" 
                    value={courseName}
                    onChange={(e) => setCourseName(e.target.value)}
                    placeholder="Ví dụ: Luyện thi IELTS mục tiêu 6.5+"
                    style={{
                      width: '100%', padding: '12px', borderRadius: '8px', fontSize: '14px'
                    }}
                  />
                </div>

                <div>
                  <label className="form-group-label" style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '8px' }}>Môn học liên kết *</label>
                  {fetchingSubjects ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', color: 'var(--text-light, #64748b)' }}>
                      <FiLoader className="spin" /> Đang tải môn học...
                    </div>
                  ) : (
                    <select 
                      value={subjectId}
                      onChange={(e) => setSubjectId(e.target.value)}
                      style={{
                        width: '100%', padding: '12px', borderRadius: '8px', fontSize: '14px'
                      }}
                    >
                      {subjects.map(sub => (
                        <option key={sub.subject_id} value={sub.subject_id}>
                          {sub.subject_name} ({sub.credits} tín chỉ)
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div>
                  <label className="form-group-label" style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '8px' }}>Ngày khai giảng</label>
                  <SingleDatePicker 
                    value={startDate}
                    rangeStart={startDate}
                    rangeEnd={endDate}
                    onChange={(val) => setStartDate(val)}
                    placeholder="Chọn ngày khai giảng"
                  />
                </div>
                <div>
                  <label className="form-group-label" style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '8px' }}>Ngày kết thúc</label>
                  <SingleDatePicker 
                    value={endDate}
                    rangeStart={startDate}
                    rangeEnd={endDate}
                    onChange={(val) => setEndDate(val)}
                    placeholder="Chọn ngày kết thúc"
                    align="end"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 2. Curriculum Builder */}
          {activeHubTab === 'curriculum' && (
            <div className="curriculum-builder">
              <p className="builder-subtitle">Thêm các chương học, bài giảng video/PDF và gắn bài tập trắc nghiệm trực tiếp vào từng bài học.</p>

              {sections.map((section, sIdx) => (
                <div key={section.id} className="section-container">
                  {/* Section Header */}
                  <div className="section-header-edit">
                    <div className="title-area">
                      <FiMove className="drag-handle" />
                      <input 
                        type="text" 
                        value={section.title} 
                        onChange={(e) => handleSectionTitleChange(sIdx, e.target.value)}
                      />
                    </div>
                    <div className="section-actions">
                      <button className="btn-icon" onClick={() => handleDeleteSection(sIdx)} title="Xóa chương">
                        <FiTrash2 />
                      </button>
                    </div>
                  </div>

                  {/* Lessons List */}
                  <div className="lessons-list">
                    {section.lessons.map((lesson, lIdx) => {
                      const refKey = `${sIdx}-${lIdx}`;
                      const hasQuiz = Array.isArray(lesson.quizQuestions) && lesson.quizQuestions.length > 0;

                      return (
                        <div key={lesson.id} className="minimalist-lesson-card">
                          {/* Row 1: Drag, Type, Title Input, Media Upload Button, Delete Button */}
                          <div className="card-top-row">
                            <div className="drag-handle-wrapper" title="Kéo thả để sắp xếp bài học">
                              <FiMove className="drag-icon" />
                            </div>

                            <div className="type-select-wrapper">
                              <select 
                                value={lesson.type}
                                onChange={(e) => handleLessonChange(sIdx, lIdx, 'type', e.target.value)}
                                className="lesson-type-select"
                              >
                                <option value="video">Video</option>
                                <option value="pdf">PDF Document</option>
                              </select>
                            </div>

                            <div className="title-input-wrapper">
                              <input 
                                type="text"
                                className="lesson-title-input"
                                value={lesson.title}
                                onChange={(e) => handleLessonChange(sIdx, lIdx, 'title', e.target.value)}
                                placeholder="Nhập tên bài học..."
                              />
                            </div>

                            <div className="card-top-actions">
                              <input 
                                type="file" 
                                ref={el => fileInputRef.current[refKey] = el}
                                style={{ display: 'none' }}
                                onChange={(e) => handleFileChange(sIdx, lIdx, e)}
                                accept={lesson.type === 'video' ? 'video/mp4' : 'application/pdf'}
                              />
                              <button 
                                type="button"
                                className={`btn-upload-media ${lesson.contentUrl ? 'uploaded' : ''}`}
                                onClick={() => triggerFileSelect(sIdx, lIdx)}
                                disabled={lesson.uploading}
                                title={lesson.type === 'video'
                                  ? 'Chỉ nhận MP4 chuẩn (H.264/AAC) — Tối đa 500 MB'
                                  : 'Chỉ nhận PDF — Tối đa 500 MB'
                                }
                              >
                                {lesson.uploading ? (
                                  <><FiLoader className="spin" /> <span>Đang tải ({lesson.uploadProgress || 0}%)...</span></>
                                ) : (lesson.mediaStatus === 'MISSING_SOURCE' || lesson.mediaStatus === 'FAILED') ? (
                                  <><FiUpload /> <span>Cần tải lại</span></>
                                ) : lesson.mediaStatus === 'PENDING_AUDIT' ? (
                                  <><FiUpload /> <span>Chờ kiểm định</span></>
                                ) : lesson.contentUrl ? (
                                  <><FiCheckCircle /> <span>Đã tải lên</span></>
                                ) : (
                                  <><FiUpload /> <span>Tải lên {lesson.type === 'video' ? 'Video' : 'PDF'}</span></>
                                )}
                              </button>

                              <button 
                                type="button"
                                className="btn-delete-lesson" 
                                onClick={() => handleDeleteLesson(sIdx, lIdx)} 
                                title="Xóa bài học"
                              >
                                <FiTrash2 />
                              </button>
                            </div>
                          </div>

                          {/* Upload Progress Bar */}
                          {lesson.uploading && (
                            <div style={{ marginTop: '2px' }}>
                              <div style={{
                                width: '100%', height: '4px', background: 'var(--border-color, #e2e8f0)', borderRadius: '4px', overflow: 'hidden'
                              }}>
                                <div style={{
                                  width: `${lesson.uploadProgress || 0}%`,
                                  height: '100%',
                                  background: '#2563eb',
                                  borderRadius: '4px',
                                  transition: 'width 0.3s ease'
                                }} />
                              </div>
                              <span style={{ fontSize: '11px', color: 'var(--text-light, #64748b)', marginTop: '2px', display: 'block' }}>
                                Đang tải lên Cloudflare R2... {lesson.uploadProgress || 0}%
                              </span>
                            </div>
                          )}

                          {/* Warnings / Errors if any */}
                          {!lesson.uploading && (lesson.mediaStatus === 'MISSING_SOURCE' || lesson.mediaStatus === 'FAILED') && !lesson.uploadError && (
                            <div style={{
                              marginTop: '2px',
                              display: 'flex', alignItems: 'flex-start', gap: '8px',
                              padding: '6px 10px', borderRadius: '6px',
                              background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)',
                              fontSize: '12px', color: '#d97706', lineHeight: '1.4'
                            }}>
                              <FiAlertCircle style={{ flexShrink: 0, marginTop: '1px' }} />
                              <span><strong>Tệp nguồn bị mất:</strong> Vui lòng tải lại tệp tin cho bài học này.</span>
                            </div>
                          )}

                          {lesson.uploadError && !lesson.uploading && (
                            <div style={{
                              marginTop: '2px',
                              display: 'flex', alignItems: 'flex-start', gap: '8px',
                              padding: '6px 10px', borderRadius: '6px',
                              background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)',
                              fontSize: '12px', color: '#ef4444', lineHeight: '1.4'
                            }}>
                              <FiAlertCircle style={{ flexShrink: 0, marginTop: '1px' }} />
                              <span>{lesson.uploadError}</span>
                            </div>
                          )}

                          {/* Row 2: Left-aligned Feature Toolbar + Right-aligned File Info */}
                          <div className="card-bottom-row">
                            <div className="toolbar-left">
                              {hasQuiz ? (
                                <div className="quiz-configured-group">
                                  <span className="badge-quiz-active">
                                    <FiCheckCircle />
                                    <span>{lesson.quizQuestions.length} câu hỏi trắc nghiệm</span>
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenQuizDialog(sIdx, lIdx, 'manual')}
                                    className="btn-toolbar-link primary"
                                  >
                                    <FiEdit /> Sửa Quizzes
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenQuizDialog(sIdx, lIdx, 'ai')}
                                    className="btn-toolbar-link ai"
                                  >
                                    <FiZap /> Sinh thêm AI
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteLessonQuiz(sIdx, lIdx)}
                                    className="btn-toolbar-link danger"
                                    title="Xóa bộ trắc nghiệm bài học"
                                  >
                                    <FiTrash2 /> Xóa
                                  </button>
                                </div>
                              ) : (
                                <div className="quiz-create-group">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenQuizDialog(sIdx, lIdx, 'manual')}
                                    className="btn-toolbar-pill default"
                                  >
                                    <FiPlus /> Tạo Quizzes vào bài học
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenQuizDialog(sIdx, lIdx, 'ai')}
                                    className="btn-toolbar-pill ai"
                                  >
                                    <FiZap /> AI tạo Quizzes
                                  </button>
                                </div>
                              )}

                              <span className="toolbar-divider" />

                              {/* Speaking Exercise Toggle */}
                              <button
                                type="button"
                                onClick={() => setExpandedSpeaking(prev => ({ ...prev, [lesson.id]: !prev[lesson.id] }))}
                                className={`btn-speaking-pill ${expandedSpeaking[lesson.id] || lesson.speakingSentences || lesson.speakingQuestions ? 'active' : ''}`}
                              >
                                <FiMessageSquare />
                                <span>
                                  {expandedSpeaking[lesson.id] || lesson.speakingSentences || lesson.speakingQuestions
                                    ? 'Ẩn bài tập speaking'
                                    : 'Thêm bài tập speaking'
                                  }
                                </span>
                              </button>

                              {(lesson.speakingSentences || lesson.speakingQuestions) && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (window.confirm("Bạn có chắc chắn muốn xóa bài tập Speaking này?")) {
                                      handleLessonChange(sIdx, lIdx, 'speakingSentences', '');
                                      handleLessonChange(sIdx, lIdx, 'speakingQuestions', '');
                                      setExpandedSpeaking(prev => ({ ...prev, [lesson.id]: false }));
                                    }
                                  }}
                                  className="btn-toolbar-link danger"
                                  title="Xóa bài tập Speaking"
                                >
                                  <FiTrash2 />
                                  <span>Xóa speaking</span>
                                </button>
                              )}
                            </div>

                            {/* Right side of toolbar: File details info pill */}
                            {lesson.contentUrl && !lesson.uploading && (
                              <div className="toolbar-right">
                                <div className="media-info-pill">
                                  {lesson.type === 'video' ? <FiVideo className="media-icon" /> : <FiFileText className="media-icon" />}
                                  <span className="media-filename" title={lesson.fileName || lesson.contentUrl}>
                                    {lesson.fileName || 'Tài nguyên bài giảng'}
                                  </span>
                                  {lesson.fileSizeFormatted && (
                                    <span className="media-filesize">({lesson.fileSizeFormatted})</span>
                                  )}
                                  <span className="storage-badge">
                                    Cloudflare R2
                                  </span>
                                  {lesson.contentUrl.startsWith('http') && (
                                    <a href={lesson.contentUrl} target="_blank" rel="noreferrer" className="view-link">
                                      Xem tệp
                                    </a>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Speaking panel */}
                          {(expandedSpeaking[lesson.id] || lesson.speakingSentences || lesson.speakingQuestions) && (
                            <div className="card-speaking-panel">
                              <div className="speaking-col">
                                <span className="speaking-label">
                                  <span>1. Câu luyện phát âm AI (Đọc mẫu - Cú pháp: Tiếng Anh | Bản dịch):</span>
                                  <span className="optional-hint">(Tùy chọn)</span>
                                </span>
                                <textarea
                                  value={lesson.speakingSentences || ''}
                                  onChange={(e) => handleLessonChange(sIdx, lIdx, 'speakingSentences', e.target.value)}
                                  placeholder="Ví dụ:&#10;Welcome to our speaking class. | Chào mừng bạn đến với lớp học.&#10;Practice makes perfect. | Luyện tập tạo nên sự hoàn hảo."
                                  rows={3}
                                />
                              </div>
                              
                              <div className="speaking-col">
                                <span className="speaking-label">
                                  <span>2. Câu hỏi phản xạ nói Q&A (Cú pháp: Câu hỏi | Bản dịch):</span>
                                  <span className="optional-hint">(Tùy chọn)</span>
                                </span>
                                <textarea
                                  value={lesson.speakingQuestions || ''}
                                  onChange={(e) => handleLessonChange(sIdx, lIdx, 'speakingQuestions', e.target.value)}
                                  placeholder="Ví dụ:&#10;What did you do last weekend? | Cuối tuần trước bạn đã làm gì?&#10;Tell me about your family. | Hãy chia sẻ về gia đình bạn."
                                  rows={3}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    
                    <button className="btn-add-lesson" onClick={() => handleAddLesson(sIdx)}>
                      <FiPlus /> Thêm bài học
                    </button>
                  </div>
                </div>
              ))}

              <button className="btn-add-section" onClick={handleAddSection}>
                <FiPlus /> Thêm chương học mới
              </button>
            </div>
          )}

          {/* 3. Course Quizzes Hub Tab */}
          {activeHubTab === 'quizzes' && (
            <div className="course-quizzes-hub-panel">
              {/* Hub Header */}
              <div className="quizzes-hub-header">
                <div>
                  <h2>Quản lý Quizzes trong khóa học</h2>
                  <p>Tạo đề trắc nghiệm, bài tập tự luận và phát âm trực tiếp gắn liền vào từng bài học.</p>
                </div>
                <div className="hub-header-actions">
                  <button 
                    type="button"
                    onClick={() => {
                      if (sections.length === 0 || sections[0].lessons.length === 0) {
                        showToast('Vui lòng thêm ít nhất một bài học vào chương trình học trước.', 'warning');
                        return;
                      }
                      handleOpenQuizDialog(0, 0, 'ai');
                    }}
                    className="btn-hub-action ai"
                  >
                    <FiZap /> Tạo nhanh bằng AI
                  </button>
                  <button 
                    type="button"
                    onClick={() => {
                      if (sections.length === 0 || sections[0].lessons.length === 0) {
                        showToast('Vui lòng thêm ít nhất một bài học vào chương trình học trước.', 'warning');
                        return;
                      }
                      handleOpenQuizDialog(0, 0, 'manual');
                    }}
                    className="btn-hub-action primary"
                  >
                    <FiPlus /> Thêm bài tập trắc nghiệm
                  </button>
                </div>
              </div>

              {/* Metrics Bar (Bento Grid) */}
              <div className="quizzes-metrics-grid">
                <div className="metric-card">
                  <span className="metric-label">Tổng số bài học</span>
                  <div className="metric-value">{totalLessonsCount}</div>
                </div>
                <div className="metric-card">
                  <span className="metric-label">Bài học có Quizzes</span>
                  <div className="metric-value success">
                    {lessonsWithQuizCount} <span className="metric-sub">/ {totalLessonsCount}</span>
                  </div>
                </div>
                <div className="metric-card">
                  <span className="metric-label">Tổng số câu hỏi</span>
                  <div className="metric-value accent">{totalQuestionsCount}</div>
                </div>
              </div>

              {/* Search & Filter */}
              <div className="quizzes-filter-bar">
                <div className="filter-pills-group">
                  <button 
                    type="button" 
                    onClick={() => setQuizHubFilter('all')}
                    className={`filter-pill ${quizHubFilter === 'all' ? 'active-all' : ''}`}
                  >
                    Tất cả ({totalLessonsCount})
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setQuizHubFilter('with_quiz')}
                    className={`filter-pill ${quizHubFilter === 'with_quiz' ? 'active-with' : ''}`}
                  >
                    Đã có Quizzes ({lessonsWithQuizCount})
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setQuizHubFilter('no_quiz')}
                    className={`filter-pill ${quizHubFilter === 'no_quiz' ? 'active-no' : ''}`}
                  >
                    Chưa tạo Quizzes ({totalLessonsCount - lessonsWithQuizCount})
                  </button>
                </div>

                <div className="search-box-wrapper">
                  <FiSearch className="search-icon" />
                  <input 
                    type="text" 
                    placeholder="Tìm theo bài học hoặc chương..." 
                    value={quizHubSearch}
                    onChange={(e) => setQuizHubSearch(e.target.value)}
                  />
                </div>
              </div>

              {/* Lessons & Quizzes List */}
              <div className="quizzes-lessons-list">
                {filteredQuizzesLessons.length === 0 ? (
                  <div style={{
                    padding: '40px 20px', textAlign: 'center', background: 'var(--card-bg, #fff)',
                    borderRadius: '10px', border: '1px dashed var(--border-color, #cbd5e1)',
                    color: 'var(--text-light, #64748b)'
                  }}>
                    <FiLayers style={{ fontSize: '32px', color: 'var(--text-light, #cbd5e1)', marginBottom: '8px' }} />
                    <p style={{ margin: 0, fontWeight: '600', fontSize: '14px' }}>Không tìm thấy bài học nào phù hợp với bộ lọc.</p>
                  </div>
                ) : (
                  filteredQuizzesLessons.map((item) => {
                    const hasQuestions = Array.isArray(item.quizQuestions) && item.quizQuestions.length > 0;
                    return (
                      <div key={item.id} className="quiz-lesson-row">
                        <div className="lesson-info">
                          <div className="tags-row">
                            <span className="section-tag">
                              {item.sectionTitle}
                            </span>
                            <span className="type-tag">
                              {item.type === 'video' ? 'Video' : 'PDF Document'}
                            </span>
                          </div>

                          <h3 className="lesson-title-heading">
                            {item.title}
                          </h3>

                          {hasQuestions ? (
                            <div className="quiz-status-detail">
                              <span className="status-count">
                                <FiCheckCircle /> Đã có {item.quizQuestions.length} câu hỏi
                              </span>
                              <span className="status-dot">•</span>
                              <span className="status-meta">
                                Độ khó: <strong>{item.quizDifficulty || 'Medium'}</strong> ({item.quizTimeLimit || 15} phút)
                              </span>
                            </div>
                          ) : (
                            <span className="quiz-empty-hint">
                              Chưa thiết lập bộ câu hỏi trắc nghiệm cho bài học này
                            </span>
                          )}
                        </div>

                        {/* Action Buttons */}
                        <div className="actions-group">
                          {hasQuestions ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleOpenQuizDialog(item.sIdx, item.lIdx, 'manual')}
                                className="btn-row-action edit"
                              >
                                <FiEdit /> Chỉnh sửa Quizzes
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenQuizDialog(item.sIdx, item.lIdx, 'ai')}
                                className="btn-row-action ai"
                              >
                                <FiZap /> Sinh thêm AI
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteLessonQuiz(item.sIdx, item.lIdx)}
                                className="btn-row-action delete"
                                title="Xóa toàn bộ câu hỏi"
                              >
                                <FiTrash2 />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => handleOpenQuizDialog(item.sIdx, item.lIdx, 'manual')}
                                className="btn-row-action create"
                              >
                                <FiPlus /> Tạo câu hỏi
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenQuizDialog(item.sIdx, item.lIdx, 'ai')}
                                className="btn-row-action create-ai"
                              >
                                <FiZap /> AI tạo nhanh
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

        </div>
      </main>

      <Footer />
      
      {/* Modal Cam kết Bản quyền Giảng viên khi Xuất bản */}
      <InstructorCopyrightPolicyModal
        isOpen={policyModalOpen}
        onClose={() => setPolicyModalOpen(false)}
        onAccept={() => executeSubmitCourse(1)}
        courseName={courseName || 'Khóa học chưa đặt tên'}
        sectionsCount={sections.length}
        lessonsCount={sections.reduce((sum, s) => sum + (s.lessons?.length || 0), 0)}
      />

      {/* Modal Tạo & Chỉnh sửa Quizzes bài học (CreateQuizDialog) */}
      <CreateQuizDialog
        open={Boolean(quizDialogTarget)}
        onOpenChange={(isOpen) => {
          if (!isOpen) setQuizDialogTarget(null);
        }}
        createMode={quizDialogMode}
        onCreateModeChange={setQuizDialogMode}
        quizTitle={quizDialogTitle}
        onQuizTitleChange={setQuizDialogTitle}
        quizDescription={quizDialogDesc}
        onQuizDescriptionChange={setQuizDialogDesc}
        quizDifficulty={quizDialogDifficulty}
        onQuizDifficultyChange={setQuizDialogDifficulty}
        quizTimeLimit={quizDialogTimeLimit}
        onQuizTimeLimitChange={setQuizDialogTimeLimit}
        isPrivate={quizDialogIsPrivate}
        onPrivateChange={setQuizDialogIsPrivate}
        pinCode={quizDialogPinCode}
        onPinCodeChange={setQuizDialogPinCode}
        questions={quizDialogQuestions}
        onQuestionsChange={setQuizDialogQuestions}
        onAddQuestion={handleAddQuizQuestion}
        submitting={quizDialogSubmitting}
        onSubmit={handleSaveQuizDialog}
        aiTopic={quizAiTopic}
        onAiTopicChange={setQuizAiTopic}
        aiCount={quizAiCount}
        onAiCountChange={setQuizAiCount}
        aiTypes={quizAiTypes}
        onAiTypesChange={setQuizAiTypes}
        aiGenerating={quizAiGenerating}
        onGenerateAi={handleGenerateAiQuiz}
        canUseAi={true}
      />

      {/* Mini loading overlay for full publishing */}
      {loading && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.4)',
          display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, color: '#fff', fontSize: '18px', fontWeight: '700'
        }}>
          <div style={{ background: '#0f172a', padding: '32px', borderRadius: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
            <FiLoader className="spin" style={{ fontSize: '36px' }} />
            <span>Đang lưu thông tin khóa học...</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default CourseEditor;
