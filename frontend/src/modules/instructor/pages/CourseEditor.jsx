import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import apiClient from '../../../config/api.config';
import { 
  FiArrowLeft, FiSave, FiUpload, FiTrash2, 
  FiPlus, FiMove, FiVideo, FiFileText, FiAlertCircle, FiLoader,
  FiCheckCircle, FiEdit, FiSearch, FiLayers, FiBook, FiZap,
  FiEye, FiX, FiExternalLink, FiRefreshCw
} from 'react-icons/fi';
import Header from '../../../components/common/Header';
import Footer from '../../../components/common/Footer';
import { SingleDatePicker } from '../../../components/ui';
import InstructorCopyrightPolicyModal from '../components/InstructorCopyrightPolicyModal';
import CourseEditorLoadingModal from '../components/CourseEditorLoadingModal';
import MaterialPdfPreviewModal from '../components/MaterialPdfPreviewModal';
import CreateQuizDialog from '../../courses/components/CreateQuizDialog';
import { 
  createQuiz, 
  generateQuizAi, 
  generateQuizAiFromPdf,
  fetchQuizzesForCourseManagement,
  deleteQuizById
} from '../../quizzes/services/quizzes.service';
import { syncClozeGaps, validateClozeDraft, normalizeQuestion, normalizeQuestionsList } from '../../quizzes/utils/openCloze';
import { useToast } from '../../../context/ToastContext';
import { useLanguage } from '../../../context/LanguageContext';
import { 
  extractYouTubeVideoId, 
  isYouTubeUrl,
  normalizeYouTubeUrl,
  getLessonMaterials,
  uploadLessonMaterial,
  deleteLessonMaterial
} from '../../lessons/services/lessons.service';
import { withPdfAuthToken } from '../../lessons/utils/pdfAuthUrl';
import { subtitlesService } from '../../lessons/services/subtitles.service';
import '../styles/instructor.scss';

const YouTubeIcon = ({ className = 'media-icon', style = {} }) => (
  <svg className={className} style={{ width: 14, height: 14, fill: '#ef4444', ...style }} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
  </svg>
);

const YOUTUBE_NO_CAPTIONS_CODE = 'YOUTUBE_NO_CAPTIONS_AVAILABLE';

const ALERT_ISSUE_LABELS = {
  'missing-media-source': 'Tệp nguồn của media này đang bị thiếu.',
  'media-processing-failed': 'Media của bài học này xử lý thất bại.',
  'stale-upload': 'Phiên upload của bài học này đang bị treo hoặc đã hết hạn.',
  'storage-deletion-failed': 'Tệp của bài học này chưa được xóa khỏi kho lưu trữ.',
  'subtitle-failed': 'Tác vụ tạo phụ đề của bài học này đã thất bại.',
  'published-without-lessons': 'Khóa học đã xuất bản nhưng chưa có bài học.',
  'quiz-without-questions': 'Đề quiz này chưa có câu hỏi.'
};

const YouTubeSubtitleStatus = ({ lessonId }) => {
  const [subtitleState, setSubtitleState] = useState(null);
  const [retrying, setRetrying] = useState(false);
  const loadStatusRef = useRef(null);

  useEffect(() => {
    if (!lessonId) return undefined;

    let cancelled = false;
    let pollTimer = null;

    const loadStatus = async () => {
      try {
        const result = await subtitlesService.getSubtitleStatus(lessonId);
        if (cancelled) return;
        setSubtitleState(result);
        if (result.status === 'pending' || result.status === 'processing') {
          pollTimer = window.setTimeout(loadStatus, 5000);
        }
      } catch (error) {
        if (!cancelled) {
          console.warn(`[CourseEditor] Không thể lấy trạng thái phụ đề cho bài học ${lessonId}:`, error?.message);
          setSubtitleState(null);
        }
      }
    };

    loadStatusRef.current = loadStatus;
    loadStatus();
    return () => {
      cancelled = true;
      if (pollTimer) window.clearTimeout(pollTimer);
    };
  }, [lessonId]);

  const handleRetry = async () => {
    if (retrying) return;
    setRetrying(true);
    setSubtitleState((prev) => ({ ...(prev || {}), status: 'processing', message: null, code: null }));
    try {
      await subtitlesService.generateSubtitles(lessonId);
      setSubtitleState((prev) => ({ ...(prev || {}), status: 'ready', message: null, code: null }));
    } catch (error) {
      console.warn(`[CourseEditor] Không thể kích hoạt lại tạo phụ đề cho bài học ${lessonId}:`, error?.message);
      const message = error?.response?.data?.message || error?.message || 'Không thể tạo lại phụ đề lúc này.';
      setSubtitleState((prev) => ({ ...(prev || {}), status: 'failed', message }));
      loadStatusRef.current?.();
    } finally {
      setRetrying(false);
    }
  };

  if (!subtitleState || subtitleState.status === 'ready') return null;

  const noPublicCaptions = subtitleState.status === 'failed' && subtitleState.code === YOUTUBE_NO_CAPTIONS_CODE;
  const statusContent = noPublicCaptions
    ? {
        tone: 'error',
        icon: <FiAlertCircle aria-hidden="true" />,
        title: 'Video chưa có phụ đề công khai',
        detail: 'Bật auto-caption trên YouTube hoặc tải phụ đề thủ công cho bài học.'
      }
    : subtitleState.status === 'failed'
      ? {
          tone: 'error',
          icon: <FiAlertCircle aria-hidden="true" />,
          title: 'Tạo phụ đề thất bại',
          detail: subtitleState.message || 'Vui lòng thử lại sau.'
        }
    : subtitleState.status === 'pending' || subtitleState.status === 'processing'
          ? {
              tone: 'working',
              icon: <FiLoader className="subtitle-status-spinner" aria-hidden="true" />,
              title: 'Đang tạo phụ đề'
            }
          : {
              tone: 'empty',
              icon: <FiAlertCircle aria-hidden="true" />,
              title: 'Chưa có phụ đề'
            };

  return (
    <div
      className={`youtube-subtitle-status is-${statusContent.tone}`}
      role="status"
      aria-live="polite"
    >
      {statusContent.icon}
      <span>
        <strong>{statusContent.title}</strong>
        {statusContent.detail && <small>{statusContent.detail}</small>}
      </span>
      {subtitleState.status === 'failed' && (
        <button
          type="button"
          className="subtitle-status-retry-btn"
          onClick={handleRetry}
          disabled={retrying}
        >
          <FiFileText aria-hidden="true" />
          {retrying ? 'Đang gửi yêu cầu...' : 'Tạo lại phụ đề'}
        </button>
      )}
    </div>
  );
};

const isAllowedExternalMediaUrl = (url = '') => /^https?:\/\//i.test(url) && !/\.supabase\.co(?:\/|$)/i.test(url);

export const isMediaReadyForPublish = (lesson) => {
  if (lesson.type === 'youtube') {
    return isYouTubeUrl(lesson.youtubeUrl || lesson.contentUrl);
  }
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
  const { language, t } = useLanguage();
  const locale = language === 'ENG' ? 'en-US' : 'vi-VN';
  const { courseId } = useParams();
  const [searchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const targetLessonId = Number(searchParams.get('lessonId')) || null;
  const targetQuizId = Number(searchParams.get('quizId')) || null;
  const targetIssue = searchParams.get('issue') || '';
  const deepLinkHandledRef = useRef(false);
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
  const [focusedTarget, setFocusedTarget] = useState('');
  const [subjects, setSubjects] = useState([]);
  const [courseName, setCourseName] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [startDate, setStartDate] = useState(getTodayCivilDate());
  const [endDate, setEndDate] = useState(getNextYearCivilDate());
  const [courseStatus, setCourseStatus] = useState('draft');
  const isPublishedCourse = isEditMode && (
    courseStatus === 1 || courseStatus === '1' || courseStatus === 'published'
  );
  
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
  const [expandedMaterials, setExpandedMaterials] = useState({});
  const [uploadingMaterials, setUploadingMaterials] = useState({});
  const [stagedMaterials, setStagedMaterials] = useState({}); // { [lessonId]: File }
  const materialFileInputRef = useRef({});
  const [previewPdfModal, setPreviewPdfModal] = useState({ isOpen: false, url: '', file: null, downloadUrl: '', title: '', sizeKb: 0 });
  const [loadingState, setLoadingState] = useState('idle'); // 'idle' | 'fetching' | 'saving_draft' | 'publishing'
  const [loading, setLoading] = useState(false);
  const [fetchingSubjects, setFetchingSubjects] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [invalidFieldKey, setInvalidFieldKey] = useState(null);
  const [courseLoadFailure, setCourseLoadFailure] = useState(null);
  const [courseReloadKey, setCourseReloadKey] = useState(0);

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
          setLoadingState('fetching');
          const [courseResult, quizzesResult] = await Promise.allSettled([
            apiClient.get(`/courses/${courseId}`),
            fetchQuizzesForCourseManagement(courseId)
          ]);
          if (courseResult.status === 'rejected') throw courseResult.reason;

          const courseRes = courseResult.value;
          const quizzesData = quizzesResult.status === 'fulfilled' ? quizzesResult.value : [];
          if (quizzesResult.status === 'rejected') {
            console.warn('Không thể tải quiz của khóa học:', quizzesResult.reason);
          }
          if (!courseRes.data?.success || !courseRes.data?.course) {
            throw new Error('Phản hồi chi tiết khóa học không hợp lệ');
          }

          if (courseRes.data && courseRes.data.success) {
            const course = courseRes.data.course;
            setCourseName(course.course_name || '');
            setSubjectId(String(course.subject_id || ''));
            setCourseStatus(course.status ?? 'draft');
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

            // Nạp danh sách tài liệu đính kèm (PDF Materials) của các bài học
            const allLessonIds = (course.sections || [])
              .flatMap(sec => (sec.lessons || []).map(l => l.lesson_id))
              .filter(Boolean);

            const materialsMap = {};
            await Promise.allSettled(
              allLessonIds.map(async (lid) => {
                try {
                  const mats = await getLessonMaterials(lid);
                  materialsMap[lid] = mats;
                } catch (e) {
                  materialsMap[lid] = [];
                }
              })
            );

            if (course.sections) {
              setSections(course.sections.map(sec => ({
                id: sec.section_id,
                title: sec.title,
                lessons: (sec.lessons || []).map(l => {
                  const isYouTube = l.content_type === 'youtube' || isYouTubeUrl(l.content_url);
                  const isExternal = isAllowedExternalMediaUrl(l.content_url) || isYouTube;
                  const status = l.media_status || l.mediaStatus || (isExternal ? 'READY' : 'PENDING_AUDIT');
                  const isVerified = status === 'READY' || isExternal;
                  const attachedQuiz = quizByLessonId[String(l.lesson_id)];

                  return {
                    id: l.lesson_id,
                    isPersisted: true,
                    title: l.title,
                    type: isYouTube ? 'youtube' : l.content_type,
                    contentUrl: l.content_url,
                    youtubeUrl: isYouTube ? l.content_url : '',
                    storageKey: l.storage_key || l.storageKey || (!isExternal ? l.content_url : null),
                    storageBucket: l.storage_bucket || l.storageBucket || (l.content_type === 'pdf' ? 'documents' : (isYouTube ? 'youtube' : 'videos')),
                    storageProvider: l.storage_provider || l.storageProvider || (isYouTube ? 'youtube' : (isExternal ? 'external' : 'r2')),
                    mimeType: l.mime_type || l.mimeType || (l.content_type === 'pdf' ? 'application/pdf' : (isYouTube ? 'video/youtube' : 'video/mp4')),
                    sizeBytes: l.size_bytes || l.sizeBytes || 0,
                    checksumSha256: l.checksum_sha256 || l.checksumSha256 || null,
                    mediaStatus: isYouTube ? 'READY' : status,
                    pendingUploadId: null,
                    uploading: false,
                    uploadVerified: isVerified,
                    fileName: l.content_url ? l.content_url.split('/').pop() : '',
                    materials: materialsMap[l.lesson_id] || [],
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
          setCourseLoadFailure(null);
        } catch (err) {
          console.error('Lỗi khi tải thông tin khóa học:', err);
          const notFound = Number(err?.response?.status) === 404;
          setCourseLoadFailure({
            notFound,
            message: notFound
              ? 'Cảnh báo bạn vừa mở đã lỗi thời hoặc khóa học đã được xóa.'
              : 'Không thể tải chi tiết khóa học từ máy chủ.'
          });
        } finally {
          setLoading(false);
          setLoadingState('idle');
        }
      };
      fetchCourse();
    }
  }, [courseId, courseReloadKey, isEditMode]);

  useEffect(() => {
    if (loading || deepLinkHandledRef.current || (!targetLessonId && !targetQuizId && !targetIssue)) return undefined;

    const lesson = sections.flatMap((section) => section.lessons || []).find((item) => (
      (targetLessonId && Number(item.id) === targetLessonId)
      || (targetQuizId && Number(item.quizId) === targetQuizId)
    ));
    if ((targetLessonId || targetQuizId) && !lesson) return undefined;

    const destinationTab = requestedTab === 'quizzes' || targetQuizId ? 'quizzes' : 'curriculum';
    deepLinkHandledRef.current = true;
    setActiveHubTab(destinationTab);
    setQuizHubFilter('all');
    setQuizHubSearch('');

    if (!lesson) return undefined;

    const elementId = destinationTab === 'quizzes'
      ? `quiz-lesson-${lesson.id}`
      : `lesson-card-${lesson.id}`;
    setFocusedTarget(elementId);

    const scrollTimer = window.setTimeout(() => {
      const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      document.getElementById(elementId)?.scrollIntoView({
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
        block: 'center'
      });
    }, 80);
    const clearTimer = window.setTimeout(() => setFocusedTarget(''), 6000);
    return () => {
      window.clearTimeout(scrollTimer);
      window.clearTimeout(clearTimer);
    };
  }, [loading, requestedTab, sections, targetIssue, targetLessonId, targetQuizId]);

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
      youtubeUrl: '',
      uploading: false,
      materials: [],
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

    if (key === 'type' && value === 'youtube') {
      newSections[sIdx].lessons[lIdx].storageProvider = 'youtube';
      newSections[sIdx].lessons[lIdx].storageBucket = 'youtube';
      newSections[sIdx].lessons[lIdx].uploadVerified = true;
      newSections[sIdx].lessons[lIdx].mediaStatus = 'READY';
      if (newSections[sIdx].lessons[lIdx].youtubeUrl) {
        newSections[sIdx].lessons[lIdx].contentUrl = newSections[sIdx].lessons[lIdx].youtubeUrl;
      }
    } else if (key === 'youtubeUrl') {
      newSections[sIdx].lessons[lIdx].contentUrl = value;
      newSections[sIdx].lessons[lIdx].storageKey = value;
      newSections[sIdx].lessons[lIdx].storageProvider = 'youtube';
      newSections[sIdx].lessons[lIdx].storageBucket = 'youtube';
      newSections[sIdx].lessons[lIdx].uploadVerified = isYouTubeUrl(value);
      newSections[sIdx].lessons[lIdx].mediaStatus = isYouTubeUrl(value) ? 'READY' : 'PENDING';
    }

    setSections(newSections);
  };

  // Upload File
  const triggerFileSelect = (sIdx, lIdx) => {
    const refKey = `${sIdx}-${lIdx}`;
    if (fileInputRef.current[refKey]) {
      fileInputRef.current[refKey].click();
    }
  };

  // Upload & Delete PDF Materials (Tài liệu đính kèm bài học)
  const triggerMaterialFileSelect = (sIdx, lIdx) => {
    const refKey = `${sIdx}-${lIdx}`;
    if (materialFileInputRef.current[refKey]) {
      materialFileInputRef.current[refKey].click();
    }
  };

  const handleSelectMaterialFile = (sIdx, lIdx, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const lesson = sections[sIdx].lessons[lIdx];
    const isPersisted = typeof lesson.id === 'number' && lesson.id < 1000000000000;
    if (!isPersisted) {
      showToast('Vui lòng nhấn "Lưu bản nháp" hoặc "Xuất bản" để tạo bài học trên hệ thống trước khi đính kèm tài liệu PDF.', 'warning', { duration: 6000 });
      return;
    }

    const ext = file.name.split('.').pop().toLowerCase();
    if (ext !== 'pdf' && file.type !== 'application/pdf') {
      showToast('Hệ thống chỉ hỗ trợ tệp định dạng PDF. Vui lòng chọn tệp .pdf', 'warning');
      return;
    }

    const sizeMb = file.size / (1024 * 1024);
    if (sizeMb > 50) {
      showToast(`Dung lượng tệp (${sizeMb.toFixed(1)} MB) vượt quá giới hạn 50 MB.`, 'error');
      return;
    }

    setStagedMaterials(prev => ({ ...prev, [lesson.id]: file }));
    showToast(`Đã chọn tài liệu "${file.name}". Bạn có thể "Xem trước" ngay bây giờ hoặc nhấn "Tải tài liệu" để lưu vào bài học.`, 'info');
  };

  const handlePreviewStagedMaterial = (lessonId) => {
    const file = stagedMaterials[lessonId];
    if (!file) return;
    setPreviewPdfModal({
      isOpen: true,
      file,
      url: '',
      downloadUrl: '',
      title: file.name || 'Tài liệu PDF bài học',
      sizeKb: Math.round(file.size / 1024)
    });
  };

  const handleCancelStagedMaterial = (lessonId) => {
    setStagedMaterials(prev => {
      const copy = { ...prev };
      delete copy[lessonId];
      return copy;
    });
  };

  const handleConfirmUploadMaterial = async (sIdx, lIdx) => {
    const lesson = sections[sIdx].lessons[lIdx];
    const file = stagedMaterials[lesson.id];
    if (!file) return;

    setUploadingMaterials(prev => ({ ...prev, [lesson.id]: true }));
    const formData = new FormData();
    formData.append('file', file);

    try {
      const newMaterial = await uploadLessonMaterial(lesson.id, formData);
      if (newMaterial) {
        setSections(prev => prev.map((sec, si) => si !== sIdx ? sec : {
          ...sec,
          lessons: sec.lessons.map((les, li) => li !== lIdx ? les : {
            ...les,
            materials: [...(les.materials || []), newMaterial]
          })
        }));
        handleCancelStagedMaterial(lesson.id);
        showToast(`Đã tải lên tài liệu "${file.name}" thành công! Hệ thống AI đã tự động nạp nội dung để hỗ trợ học viên.`, 'success');
      }
    } catch (err) {
      console.error('Lỗi tải tài liệu PDF:', err);
      showToast(err.response?.data?.message || 'Không thể tải lên tài liệu PDF. Vui lòng thử lại.', 'error');
    } finally {
      setUploadingMaterials(prev => ({ ...prev, [lesson.id]: false }));
    }
  };

  const handleUploadMaterialFile = async (sIdx, lIdx, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const lesson = sections[sIdx].lessons[lIdx];
    const isPersisted = typeof lesson.id === 'number' && lesson.id < 1000000000000;
    if (!isPersisted) {
      showToast('Vui lòng nhấn "Lưu bản nháp" hoặc "Xuất bản" để tạo bài học trên hệ thống trước khi tải tài liệu PDF đính kèm.', 'warning', { duration: 6000 });
      return;
    }

    const ext = file.name.split('.').pop().toLowerCase();
    if (ext !== 'pdf' && file.type !== 'application/pdf') {
      showToast('Hệ thống chỉ hỗ trợ tệp định dạng PDF. Vui lòng chọn tệp .pdf', 'warning');
      return;
    }

    const sizeMb = file.size / (1024 * 1024);
    if (sizeMb > 50) {
      showToast(`Dung lượng tệp (${sizeMb.toFixed(1)} MB) vượt quá giới hạn 50 MB.`, 'error');
      return;
    }

    setUploadingMaterials(prev => ({ ...prev, [lesson.id]: true }));
    const formData = new FormData();
    formData.append('file', file);

    try {
      const newMaterial = await uploadLessonMaterial(lesson.id, formData);
      if (newMaterial) {
        setSections(prev => prev.map((sec, si) => si !== sIdx ? sec : {
          ...sec,
          lessons: sec.lessons.map((les, li) => li !== lIdx ? les : {
            ...les,
            materials: [...(les.materials || []), newMaterial]
          })
        }));
        showToast(`Đã tải lên tài liệu "${file.name}" thành công! Hệ thống AI đã tự động nạp nội dung để hỗ trợ học viên.`, 'success');
      }
    } catch (err) {
      console.error('Lỗi tải tài liệu PDF:', err);
      showToast(err.response?.data?.message || 'Không thể tải lên tài liệu PDF. Vui lòng thử lại.', 'error');
    } finally {
      setUploadingMaterials(prev => ({ ...prev, [lesson.id]: false }));
    }
  };

  const handleDeleteMaterial = async (sIdx, lIdx, materialId, materialName) => {
    if (!window.confirm(t(`Bạn có chắc chắn muốn xóa tài liệu "${materialName || 'này'}" khỏi bài học?`))) {
      return;
    }
    const lesson = sections[sIdx].lessons[lIdx];
    try {
      await deleteLessonMaterial(lesson.id, materialId);
      setSections(prev => prev.map((sec, si) => si !== sIdx ? sec : {
        ...sec,
        lessons: sec.lessons.map((les, li) => li !== lIdx ? les : {
          ...les,
          materials: (les.materials || []).filter(m => m.id !== materialId)
        })
      }));
      showToast('Đã xóa tài liệu đính kèm thành công.', 'info');
    } catch (err) {
      console.error('Lỗi xóa tài liệu:', err);
      showToast(err.response?.data?.message || 'Không thể xóa tài liệu. Vui lòng thử lại.', 'error');
    }
  };

  const handlePreviewMaterial = (mat) => {
    if (!mat) return;
    if (mat.file) {
      setPreviewPdfModal({
        isOpen: true,
        file: mat.file,
        url: '',
        downloadUrl: '',
        title: mat.name || mat.file.name || 'Tài liệu PDF bài học',
        sizeKb: Math.round(mat.file.size / 1024)
      });
      return;
    }
    if (!mat.url) return;
    const sep = mat.url.includes('?') ? '&' : '?';
    const previewUrl = withPdfAuthToken(`${mat.url}${sep}stream=true`);
    const downloadUrl = withPdfAuthToken(mat.url.replace('/preview', '/download'));
    setPreviewPdfModal({
      isOpen: true,
      url: previewUrl,
      file: null,
      downloadUrl,
      title: mat.name || 'Tài liệu PDF bài học',
      sizeKb: mat.sizeKb || Math.round((mat.sizeBytes || 0) / 1024)
    });
  };

  const handlePreviewLessonPdf = (lesson) => {
    if (!lesson) return;
    // 1. Nếu có file vừa chọn cục bộ chưa upload:
    const localFile = lesson.stagedPdfFile || lesson.localPdfFile;
    if (localFile) {
      setPreviewPdfModal({
        isOpen: true,
        file: localFile,
        url: '',
        downloadUrl: '',
        title: localFile.name || lesson.title || 'Bài giảng PDF',
        sizeKb: Math.round(localFile.size / 1024)
      });
      return;
    }
    // 2. Nếu đã upload lên server:
    if (lesson.contentUrl || lesson.storageKey) {
      const isPersisted = typeof lesson.id === 'number' && lesson.id < 1000000000000;
      const basePdfUrl = isPersisted
        ? `${apiClient.defaults.baseURL || '/api'}/lessons/${lesson.id}/pdf`
        : lesson.contentUrl;
      const sep = basePdfUrl.includes('?') ? '&' : '?';
      const previewUrl = withPdfAuthToken(`${basePdfUrl}${sep}stream=true`);
      const downloadUrl = isPersisted
        ? withPdfAuthToken(`${apiClient.defaults.baseURL || '/api'}/lessons/${lesson.id}/pdf/download`)
        : '';
      setPreviewPdfModal({
        isOpen: true,
        url: previewUrl,
        file: null,
        downloadUrl,
        title: lesson.fileName || lesson.title || 'Bài giảng PDF',
        sizeKb: lesson.sizeKb || (lesson.sizeBytes ? Math.round(lesson.sizeBytes / 1024) : 0)
      });
    }
  };

  const executeLessonFileUpload = async (sIdx, lIdx, file) => {
    if (!file) return;
    const isPdfFile = file.type === 'application/pdf' || file.name.split('.').pop().toLowerCase() === 'pdf';
    const fileSizeMB = file.size / (1024 * 1024);
    const fileSizeFormatted = fileSizeMB >= 1
      ? `${fileSizeMB.toFixed(1)} MB`
      : `${(file.size / 1024).toFixed(0)} KB`;

    setSections(prev => prev.map((sec, si) => si !== sIdx ? sec : {
      ...sec,
      lessons: sec.lessons.map((les, li) => li !== lIdx ? les : {
        ...les,
        localPdfFile: isPdfFile ? file : null,
        uploading: true,
        uploadError: null,
        uploadProgress: 0
      })
    }));
    setErrorMsg('');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('courseName', courseName.trim() || 'Khoa hoc chua dat ten');
    if (courseId) formData.append('courseId', String(courseId));
    formData.append('sectionName', sections[sIdx].title || `Chuong ${sIdx + 1}`);
    formData.append('sectionOrder', String(sIdx + 1));
    formData.append('lessonName', sections[sIdx].lessons[lIdx].title || `Bai ${lIdx + 1}`);
    formData.append('lessonOrder', String(lIdx + 1));

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
              stagedPdfFile: null,
              uploadProgress: 100,
              fileSizeFormatted
            })
          });
        });
        showToast(`Đã tải lên tệp "${file.name}" thành công!`, 'success');
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
    }
  };

  const handleUploadStagedLessonPdf = async (sIdx, lIdx) => {
    const lesson = sections[sIdx].lessons[lIdx];
    const file = lesson.stagedPdfFile || lesson.localPdfFile;
    if (!file) return;
    await executeLessonFileUpload(sIdx, lIdx, file);
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

    // Nếu là bài học PDF: Lưu vào stagedPdfFile để giảng viên xem trước trước khi tải lên
    if (lessonType === 'pdf') {
      const newSections = [...sections];
      newSections[sIdx].lessons[lIdx] = {
        ...newSections[sIdx].lessons[lIdx],
        stagedPdfFile: file,
        localPdfFile: file,
        fileName: file.name,
        fileSizeFormatted,
        uploadError: null
      };
      setSections(newSections);
      showToast(`Đã chọn bài giảng PDF "${file.name}". Bạn có thể "Xem trước" ngay bây giờ hoặc nhấn "Tải lên" để lưu.`, 'info');
      if (e.target) e.target.value = '';
      return;
    }

    // Với Video: Tải lên trực tiếp
    await executeLessonFileUpload(sIdx, lIdx, file);
    if (e.target) e.target.value = '';
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
    const isMultipleChoiceLike = ['multiple_choice', 'listening', 'reading'].includes(type);
    setQuizDialogQuestions(prev => [
      ...prev,
      {
        question_text: '',
        question_type: type,
        audio_url: type === 'listening' ? '' : undefined,
        passage_text: type === 'reading' ? '' : undefined,
        options: isMultipleChoiceLike ? ['', '', '', ''] : [],
        correct_answer: isMultipleChoiceLike ? 'A' : '',
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

  const handleGenerateAiQuizFromPdf = async ({ files, file, targetLevel, count, questionTypes, additionalNotes }) => {
    try {
      setQuizAiGenerating(true);
      const fileList = Array.isArray(files) && files.length > 0 ? files : (file ? [file] : []);
      const formData = new FormData();
      fileList.forEach(f => {
        formData.append('pdfs', f);
      });
      formData.append('targetLevel', targetLevel || 'auto');
      formData.append('count', String(count || 5));
      formData.append('questionTypes', JSON.stringify(questionTypes || ['multiple_choice']));
      if (additionalNotes) formData.append('additionalNotes', additionalNotes);

      const res = await generateQuizAiFromPdf(formData);
      if (res && Array.isArray(res.questions) && res.questions.length > 0) {
        const normalized = normalizeQuestionsList(res.questions);
        setQuizDialogQuestions(normalized);
        if (!quizDialogTitle || quizDialogTitle.startsWith('Trắc nghiệm') || quizDialogTitle.startsWith('Bài tập') || quizDialogTitle.startsWith('Quiz AI')) {
          if (fileList.length === 1) {
            const cleanName = fileList[0].name.replace(/\.[^/.]+$/, "");
            setQuizDialogTitle(`Quiz AI: ${cleanName}`);
          } else {
            setQuizDialogTitle(`Quiz AI: Tổng hợp ${fileList.length} đề thi PDF`);
          }
        }
        setQuizDialogMode('manual');
        showToast(`AI đã phân tích ${fileList.length} file PDF và tạo thành công ${normalized.length} câu hỏi!`, 'success');
      } else {
        showToast('Không nhận được câu hỏi từ AI. Vui lòng thử lại với file PDF khác.', 'error');
      }
    } catch (err) {
      console.error('Lỗi sinh câu hỏi từ nhiều PDF:', err);
      showToast(err.response?.data?.message || 'Không thể tạo câu hỏi từ các file PDF này.', 'error');
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
    if (!window.confirm(t(`Bạn có chắc muốn xóa toàn bộ câu hỏi trắc nghiệm của bài học "${lesson.title}"?`))) {
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
      setInvalidFieldKey('courseName');
      setActiveHubTab('basic');
      return;
    }
    if (!subjectId) {
      setErrorMsg('Vui lòng chọn môn học.');
      setInvalidFieldKey('subjectId');
      setActiveHubTab('basic');
      return;
    }
    if (sections.length === 0) {
      setErrorMsg('Khóa học phải có ít nhất 1 chương.');
      setActiveHubTab('curriculum');
      return;
    }

    for (let sIdx = 0; sIdx < sections.length; sIdx++) {
      const section = sections[sIdx];
      if (!section.title.trim()) {
        setErrorMsg(`Tên chương thứ ${sIdx + 1} không được để trống.`);
        setInvalidFieldKey(`section-${sIdx}`);
        setActiveHubTab('curriculum');
        return;
      }
      if (section.lessons.length === 0) {
        setErrorMsg(`Chương "${section.title}" phải có ít nhất 1 bài học.`);
        setActiveHubTab('curriculum');
        return;
      }
      for (let lIdx = 0; lIdx < section.lessons.length; lIdx++) {
        const lesson = section.lessons[lIdx];
        if (!lesson.title.trim()) {
          setErrorMsg(`Tên bài học trong chương "${section.title}" không được để trống.`);
          setInvalidFieldKey(`lesson-${sIdx}-${lIdx}`);
          setActiveHubTab('curriculum');
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
        } else if (lesson.type === 'youtube') {
          const ytUrl = lesson.youtubeUrl || lesson.contentUrl;
          if (!ytUrl || !isYouTubeUrl(ytUrl)) {
            setErrorMsg(`Vui lòng nhập đường link YouTube hợp lệ cho bài học "${lesson.title}".`);
            return;
          }
        }
      }
    }

    setErrorMsg('');
    if (isPublishedCourse) {
      executeSubmitCourse(1);
      return;
    }
    setPolicyModalOpen(true);
  };

  const executeSubmitCourse = async (status = 1) => {
    if (!courseName.trim()) {
      setErrorMsg('Vui lòng nhập tên khóa học.');
      setInvalidFieldKey('courseName');
      setActiveHubTab('basic');
      return;
    }
    if (!subjectId) {
      setErrorMsg('Vui lòng chọn môn học.');
      setInvalidFieldKey('subjectId');
      setActiveHubTab('basic');
      return;
    }
    if (sections.length === 0) {
      setErrorMsg('Khóa học phải có ít nhất 1 chương.');
      setActiveHubTab('curriculum');
      return;
    }

    setInvalidFieldKey(null);
    setLoading(true);
    setLoadingState(
      status === 0
        ? 'saving_draft'
        : (isPublishedCourse ? 'saving_changes' : 'publishing')
    );
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
        lessons: sec.lessons.map((les, lIdx) => {
          const youtubeUrl = les.type === 'youtube'
            ? normalizeYouTubeUrl(les.youtubeUrl || les.contentUrl)
            : '';

          return {
            id: les.id,
            title: les.title,
            contentType: les.type,
            contentUrl: les.type === 'youtube' ? youtubeUrl : les.contentUrl,
            storageProvider: les.type === 'youtube' ? 'youtube' : (les.storageProvider || (les.contentUrl ? (isAllowedExternalMediaUrl(les.contentUrl) ? 'external' : 'r2') : null)),
            storageBucket: les.type === 'youtube' ? null : (les.storageBucket || (les.contentUrl && !les.contentUrl.startsWith('http') ? (les.type === 'pdf' ? 'documents' : 'videos') : null)),
            storageKey: les.type === 'youtube' ? null : (les.storageKey || (les.contentUrl && !les.contentUrl.startsWith('http') ? les.contentUrl : null)),
            mimeType: les.type === 'youtube' ? 'video/youtube' : (les.mimeType || (les.type === 'pdf' ? 'application/pdf' : (les.type === 'video' ? 'video/mp4' : null))),
            sizeBytes: les.type === 'youtube' ? 0 : (les.sizeBytes || 0),
            checksumSha256: les.type === 'youtube' ? null : (les.checksumSha256 || null),
            mediaStatus: les.type === 'youtube' ? 'READY' : (les.mediaStatus || (les.contentUrl ? 'PENDING_AUDIT' : null)),
            pendingUploadId: les.type === 'youtube' ? null : (les.pendingUploadId || null),
            orderIndex: lIdx + 1,
            speakingSentences: les.speakingSentences || '',
            speakingQuestions: les.speakingQuestions || '',
            quizTitle: les.quizTitle || `Trắc nghiệm: ${les.title}`,
            quizDescription: les.quizDescription || `Bài kiểm tra cho bài học: ${les.title}`,
            quizDifficulty: les.quizDifficulty || 'Medium',
            quizTimeLimit: les.quizTimeLimit || 15,
            quizQuestions: normalizeQuestionsList(les.quizQuestions || []),
            quizDeleted: les.quizDeleted === true
          };
        })
      }))
    };

    try {
      const response = isEditMode
        ? await apiClient.put(`/courses/${courseId}`, payload)
        : await apiClient.post('/courses', payload);

      if (response.data && response.data.success) {
        if (status === 1) setCourseStatus('published');
        setSuccessMsg(
          status === 0
            ? 'Đã lưu bản nháp khóa học thành công!'
            : (isPublishedCourse
                ? 'Đã lưu thay đổi khóa học thành công!'
                : (isEditMode ? 'Cập nhật & Xuất bản khóa học thành công!' : 'Tạo & Xuất bản khóa học thành công!'))
        );
        setTimeout(() => {
          navigate('/instructor/dashboard');
        }, 1500);
      }
    } catch (err) {
      console.error('Lỗi lưu khóa học:', err);
      const message = err.response?.data?.message || 'Có lỗi xảy ra khi lưu khóa học trên máy chủ.';
      setErrorMsg(message);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setLoading(false);
      setLoadingState('idle');
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

  if (isEditMode && courseLoadFailure) {
    return (
      <div className="instructor-page">
        <Header />
        <main className="instructor-container course-unavailable-shell">
          <section className="course-unavailable-state" role="alert" aria-labelledby="course-unavailable-title">
            <span className="course-unavailable-icon" aria-hidden="true"><FiAlertCircle /></span>
            <p className="course-unavailable-eyebrow">Không thể mở nội dung</p>
            <h1 id="course-unavailable-title">
              {courseLoadFailure.notFound ? 'Khóa học không còn tồn tại' : 'Chưa tải được khóa học'}
            </h1>
            <p>{courseLoadFailure.message} Không có thay đổi nào được thực hiện trên trang này.</p>
            <div className="course-unavailable-actions">
              <button type="button" className="btn-back" onClick={() => navigate('/instructor/dashboard')}>
                <FiArrowLeft aria-hidden="true" /> Về bảng điều khiển
              </button>
              {!courseLoadFailure.notFound && (
                <button
                  type="button"
                  className="btn-publish"
                  onClick={() => setCourseReloadKey((value) => value + 1)}
                  disabled={loading}
                >
                  <FiRefreshCw className={loading ? 'spin' : ''} aria-hidden="true" />
                  {loading ? 'Đang tải lại...' : 'Thử tải lại'}
                </button>
              )}
            </div>
          </section>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="instructor-page">
      <Header />
      
      <main className="instructor-container editor-mode course-editor-grid">
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
              {!isPublishedCourse && (
                <button
                  className="btn-save-draft"
                  onClick={() => executeSubmitCourse(0)}
                  disabled={loading}
                >
                  <FiSave /> Lưu bản nháp
                </button>
              )}
              <button 
                className="btn-publish" 
                onClick={handleInitiatePublish}
                disabled={loading}
              >
                {loading
                  ? <FiLoader className="spin" />
                  : (isPublishedCourse ? <FiSave /> : <FiUpload />)}
                {isPublishedCourse ? 'Lưu thay đổi' : 'Xuất bản khóa học'}
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

          {targetIssue && ALERT_ISSUE_LABELS[targetIssue] && (
            <div className="alert-deep-link-notice" role="status">
              <FiAlertCircle aria-hidden="true" />
              <span><strong>Mở từ cảnh báo vận hành:</strong> {ALERT_ISSUE_LABELS[targetIssue]}</span>
            </div>
          )}

          {/* 1. Basic Course Info Form */}
          {activeHubTab === 'basic' && (
            <div className="course-basic-form" style={{
              padding: '24px', borderRadius: '12px', marginBottom: '32px'
            }}>
              <h2 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px' }} className="form-section-title">Thông tin khóa học cơ bản</h2>
              
              <div className="course-basic-grid" style={{ marginBottom: '20px' }}>
                <div>
                  <label className="form-group-label" style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '8px' }}>Tên khóa học *</label>
                  <input 
                    type="text" 
                    value={courseName}
                    onChange={(e) => {
                      setCourseName(e.target.value);
                      if (invalidFieldKey === 'courseName') setInvalidFieldKey(null);
                    }}
                    placeholder="Ví dụ: Luyện thi IELTS mục tiêu 6.5+"
                    className={invalidFieldKey === 'courseName' ? 'input-error-shake' : ''}
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
                      onChange={(e) => {
                        setSubjectId(e.target.value);
                        if (invalidFieldKey === 'subjectId') setInvalidFieldKey(null);
                      }}
                      className={invalidFieldKey === 'subjectId' ? 'input-error-shake' : ''}
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

              <div className="course-basic-grid">
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
                        onChange={(e) => {
                          handleSectionTitleChange(sIdx, e.target.value);
                          if (invalidFieldKey === `section-${sIdx}`) setInvalidFieldKey(null);
                        }}
                        className={invalidFieldKey === `section-${sIdx}` ? 'input-error-shake' : ''}
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
                        <div
                          key={lesson.id}
                          id={`lesson-card-${lesson.id}`}
                          className={`minimalist-lesson-card ${focusedTarget === `lesson-card-${lesson.id}` ? 'alert-target-focus' : ''}`}
                        >
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
                                <option value="youtube">YouTube Video</option>
                                <option value="pdf">PDF Document</option>
                              </select>
                            </div>

                            <div className="title-input-wrapper">
                              <input 
                                type="text"
                                className={`lesson-title-input ${invalidFieldKey === `lesson-${sIdx}-${lIdx}` ? 'input-error-shake' : ''}`}
                                value={lesson.title}
                                onChange={(e) => {
                                  handleLessonChange(sIdx, lIdx, 'title', e.target.value);
                                  if (invalidFieldKey === `lesson-${sIdx}-${lIdx}`) setInvalidFieldKey(null);
                                }}
                                placeholder="Nhập tên bài học..."
                              />
                            </div>

                            <div className="card-top-actions">
                              {lesson.type === 'youtube' ? (
                                <div className="youtube-url-input-group" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <div className="youtube-url-field" style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    background: 'rgba(15, 23, 42, 0.6)',
                                    border: `1px solid ${isYouTubeUrl(lesson.youtubeUrl || lesson.contentUrl) ? 'rgba(34, 197, 94, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
                                    borderRadius: '8px',
                                    padding: '5px 10px',
                                    minWidth: '280px'
                                  }}>
                                    <YouTubeIcon className="media-icon" style={{ width: 14, height: 14, flexShrink: 0 }} />
                                    <input
                                      type="url"
                                      value={lesson.youtubeUrl ?? (isYouTubeUrl(lesson.contentUrl) ? lesson.contentUrl : '')}
                                      onChange={(e) => handleLessonChange(sIdx, lIdx, 'youtubeUrl', e.target.value)}
                                      onBlur={(e) => {
                                        const normalizedUrl = normalizeYouTubeUrl(e.target.value);
                                        if (normalizedUrl) {
                                          handleLessonChange(sIdx, lIdx, 'youtubeUrl', normalizedUrl);
                                        }
                                      }}
                                      placeholder="https://www.youtube.com/watch?v=..."
                                      style={{
                                        background: 'transparent',
                                        border: 'none',
                                        outline: 'none',
                                        color: '#f8fafc',
                                        fontSize: '12px',
                                        width: '100%'
                                      }}
                                    />
                                  </div>
                                  {extractYouTubeVideoId(lesson.youtubeUrl || lesson.contentUrl) ? (
                                    <a
                                      href={`https://www.youtube.com/watch?v=${extractYouTubeVideoId(lesson.youtubeUrl || lesson.contentUrl)}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="btn-upload-media uploaded"
                                      style={{ textDecoration: 'none', padding: '6px 12px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                                      title="Mở video trên YouTube trong tab mới"
                                    >
                                      <FiExternalLink /> <span>Xem trên YouTube ↗</span>
                                    </a>
                                  ) : (
                                    <span style={{ fontSize: '11px', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                                      {lesson.youtubeUrl ? 'Link chưa chuẩn' : 'Chưa nhập link'}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <>
                                  <input 
                                    type="file" 
                                    ref={el => fileInputRef.current[refKey] = el}
                                    style={{ display: 'none' }}
                                    onChange={(e) => handleFileChange(sIdx, lIdx, e)}
                                    accept={lesson.type === 'video' ? 'video/mp4' : 'application/pdf'}
                                  />
                                   {lesson.type === 'pdf' && (lesson.stagedPdfFile || lesson.localPdfFile) && !lesson.contentUrl ? (
                                     <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                       <button 
                                         type="button"
                                         className="btn-upload-media"
                                         style={{ background: 'rgba(37, 99, 235, 0.1)', borderColor: '#2563eb', color: '#2563eb', fontWeight: 600 }}
                                         onClick={() => handlePreviewLessonPdf(lesson)}
                                         title="Xem trước bài giảng PDF bằng HTML5 Canvas trực tiếp trên website"
                                       >
                                         <FiEye /> <span>Xem trước</span>
                                       </button>
                                       <button 
                                         type="button"
                                         className="btn-upload-media"
                                         style={{ background: '#16a34a', borderColor: '#16a34a', color: '#ffffff', fontWeight: 600 }}
                                         onClick={() => handleUploadStagedLessonPdf(sIdx, lIdx)}
                                         disabled={lesson.uploading}
                                         title="Tải tệp PDF này lên máy chủ"
                                       >
                                         {lesson.uploading ? (
                                           <><FiLoader className="spin" /> <span>Đang tải ({lesson.uploadProgress || 0}%)...</span></>
                                         ) : (
                                           <><FiUpload /> <span>Tải lên</span></>
                                         )}
                                       </button>
                                       <button 
                                         type="button"
                                         className="btn-upload-media"
                                         onClick={() => triggerFileSelect(sIdx, lIdx)}
                                         disabled={lesson.uploading}
                                         title="Chọn tệp PDF khác"
                                       >
                                         <FiRefreshCw /> <span>Đổi tệp</span>
                                       </button>
                                     </div>
                                   ) : (
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
                                         <><FiUpload /> <span>{lesson.type === 'video' ? 'Tải lên Video' : 'Chọn tệp PDF'}</span></>
                                       )}
                                     </button>
                                   )}
                                </>
                              )}

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
                                  borderRadius: '4px'
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

                              {/* PDF Materials Toggle */}
                              <button
                                type="button"
                                onClick={() => setExpandedMaterials(prev => ({ ...prev, [lesson.id]: !prev[lesson.id] }))}
                                className={`btn-materials-pill ${(lesson.materials && lesson.materials.length > 0) || expandedMaterials[lesson.id] ? 'active' : ''}`}
                                title="Thêm tài liệu học tập hoặc slide PDF cho bài học"
                              >
                                <FiFileText className="media-pdf-icon" />
                                <span>
                                  {lesson.materials && lesson.materials.length > 0
                                    ? `Tài liệu PDF (${lesson.materials.length})`
                                    : 'Thêm tài liệu PDF'
                                  }
                                </span>
                              </button>
                            </div>

                            {/* Right side of toolbar: File details info pill */}
                            {lesson.type === 'youtube' ? (
                              <div className="toolbar-right">
                                <div className="media-info-pill" style={{ borderColor: 'rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.08)' }}>
                                  <YouTubeIcon className="media-icon" style={{ width: 14, height: 14, color: '#ef4444' }} />
                                  <span className="media-filename" title={lesson.youtubeUrl || lesson.contentUrl}>
                                    {extractYouTubeVideoId(lesson.youtubeUrl || lesson.contentUrl)
                                      ? `YouTube ID: ${extractYouTubeVideoId(lesson.youtubeUrl || lesson.contentUrl)}`
                                      : 'Chưa có link YouTube'}
                                  </span>
                                  <span className="storage-badge" style={{ background: '#ef4444', color: '#ffffff' }}>
                                    YouTube Embed
                                  </span>
                                  {extractYouTubeVideoId(lesson.youtubeUrl || lesson.contentUrl) && (
                                    <a 
                                      href={`https://www.youtube.com/watch?v=${extractYouTubeVideoId(lesson.youtubeUrl || lesson.contentUrl)}`} 
                                      target="_blank" 
                                      rel="noreferrer" 
                                      className="view-link"
                                    >
                                      Mở link ↗
                                    </a>
                                  )}
                                </div>
                                {lesson.isPersisted && <YouTubeSubtitleStatus lessonId={lesson.id} />}
                              </div>
                            ) : lesson.contentUrl && !lesson.uploading && (
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
                                  {lesson.type === 'pdf' ? (
                                    <button 
                                      type="button" 
                                      className="view-link"
                                      onClick={() => handlePreviewLessonPdf(lesson)}
                                      title="Xem trước bài giảng PDF trực tiếp trên website"
                                    >
                                      Xem trước
                                    </button>
                                  ) : lesson.contentUrl.startsWith('http') && (
                                    <a href={lesson.contentUrl} target="_blank" rel="noreferrer" className="view-link">
                                      Xem tệp
                                    </a>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* PDF Materials Panel */}
                          {expandedMaterials[lesson.id] && (
                            <div className="card-materials-panel">
                              <div className="materials-panel-header">
                                <div className="materials-header-title">
                                  <FiFileText className="title-icon" />
                                  <div>
                                    <h4>Tài liệu học tập & Slide PDF đính kèm</h4>
                                    <p>Học viên có thể xem trực tiếp qua trình đọc PDF chuyên dụng, ghi chú thông minh và tra cứu cùng Trợ lý AI.</p>
                                  </div>
                                </div>
                                <div className="materials-header-actions">
                                  <input
                                    type="file"
                                    accept="application/pdf"
                                    ref={el => materialFileInputRef.current[`${sIdx}-${lIdx}`] = el}
                                    style={{ display: 'none' }}
                                    onChange={(e) => handleSelectMaterialFile(sIdx, lIdx, e)}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => triggerMaterialFileSelect(sIdx, lIdx)}
                                    disabled={uploadingMaterials[lesson.id]}
                                    className="btn-upload-material"
                                    title="Chọn tệp PDF từ máy tính để xem trước hoặc tải lên (Tối đa 50 MB)"
                                  >
                                    <FiUpload />
                                    <span>Chọn tệp PDF</span>
                                  </button>
                                </div>
                              </div>

                              {/* Khối tài liệu vừa chọn (Chưa tải lên server) */}
                              {stagedMaterials[lesson.id] && (
                                <div className="staged-material-card">
                                  <div className="staged-material-info">
                                    <div className="staged-badge">
                                      <FiFileText />
                                      <span>Tài liệu vừa chọn (Chưa tải lên server)</span>
                                    </div>
                                    <div className="staged-filename" title={stagedMaterials[lesson.id].name}>
                                      {stagedMaterials[lesson.id].name}
                                    </div>
                                    <div className="staged-filesize">
                                      {Math.round(stagedMaterials[lesson.id].size / 1024)} KB • Sẵn sàng xem trước hoặc tải lên máy chủ
                                    </div>
                                  </div>
                                  <div className="staged-material-actions">
                                    <button
                                      type="button"
                                      className="btn-staged-action preview"
                                      onClick={() => handlePreviewStagedMaterial(lesson.id)}
                                      title="Xem trước tài liệu PDF ngay trên website bằng HTML5 Canvas"
                                    >
                                      <FiEye />
                                      <span>Xem trước</span>
                                    </button>
                                    <button
                                      type="button"
                                      className="btn-staged-action upload"
                                      disabled={uploadingMaterials[lesson.id]}
                                      onClick={() => handleConfirmUploadMaterial(sIdx, lIdx)}
                                      title="Tải tệp này lên lưu trữ Cloudflare R2"
                                    >
                                      {uploadingMaterials[lesson.id] ? (
                                        <>
                                          <FiLoader className="spin" />
                                          <span>Đang tải lên...</span>
                                        </>
                                      ) : (
                                        <>
                                          <FiUpload />
                                          <span>Tải tài liệu</span>
                                        </>
                                      )}
                                    </button>
                                    <button
                                      type="button"
                                      className="btn-staged-action cancel"
                                      disabled={uploadingMaterials[lesson.id]}
                                      onClick={() => handleCancelStagedMaterial(lesson.id)}
                                      title="Hủy chọn tệp này"
                                    >
                                      <FiX />
                                      <span>Hủy</span>
                                    </button>
                                  </div>
                                </div>
                              )}

                              {/* List of uploaded materials */}
                              {lesson.materials && lesson.materials.length > 0 ? (
                                <div className="materials-list">
                                  {lesson.materials.map((mat) => (
                                    <div key={mat.id} className="material-item-row">
                                      <div className="material-item-main">
                                        <span className="material-pdf-badge">PDF</span>
                                        <div className="material-meta-block">
                                          <span className="material-name" title={mat.name}>{mat.name}</span>
                                          <span className="material-details">
                                            {mat.sizeKb ? `${mat.sizeKb} KB` : (mat.sizeBytes ? `${Math.round(mat.sizeBytes / 1024)} KB` : 'Tài liệu học tập')}
                                            {mat.createdAt ? ` • Đã tải lên ${new Date(mat.createdAt).toLocaleDateString(locale)}` : ''}
                                          </span>
                                        </div>
                                      </div>
                                      <div className="material-item-actions">
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteMaterial(sIdx, lIdx, mat.id, mat.name)}
                                          className="btn-material-action delete"
                                          title="Xóa tài liệu này khỏi bài học"
                                        >
                                          <FiTrash2 />
                                          <span>Xóa</span>
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : !stagedMaterials[lesson.id] && (
                                <div className="materials-empty-state">
                                  <FiFileText className="empty-icon" />
                                  <span>Chưa có tài liệu đính kèm nào. Nhấn <strong>"Chọn tệp PDF"</strong> để xem trước và tải lên slide bài giảng hoặc tài liệu đọc cho bài học này.</span>
                                </div>
                              )}
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
                      <div
                        key={item.id}
                        id={`quiz-lesson-${item.id}`}
                        className={`quiz-lesson-row ${focusedTarget === `quiz-lesson-${item.id}` ? 'alert-target-focus' : ''}`}
                      >
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
        onGenerateAiFromPdf={handleGenerateAiQuizFromPdf}
        canUseAi={true}
      />

      {/* Impeccable Loading Modal (Initial load, saving draft, publishing) */}
      <CourseEditorLoadingModal
        isOpen={loadingState !== 'idle' || loading}
        mode={loadingState}
      />

      {/* In-App PDF Preview Modal (Không cần tải file về máy, mở trực tiếp) */}
      <MaterialPdfPreviewModal
        isOpen={previewPdfModal.isOpen}
        pdfUrl={previewPdfModal.url}
        file={previewPdfModal.file}
        downloadUrl={previewPdfModal.downloadUrl}
        title={previewPdfModal.title}
        sizeKb={previewPdfModal.sizeKb}
        onClose={() => setPreviewPdfModal(prev => ({ ...prev, isOpen: false, file: null }))}
      />
    </div>
  );
};

export default CourseEditor;
