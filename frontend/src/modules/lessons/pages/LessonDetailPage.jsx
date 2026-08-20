import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import {
  FiPlay, FiCheckSquare, FiSquare, FiFileText,
  FiArrowLeft, FiChevronDown, FiChevronUp, FiAward,
  FiBookOpen, FiDownload, FiCpu, FiClock, FiMic, FiGlobe
} from 'react-icons/fi';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Header from '../../../components/common/Header';
import Footer from '../../../components/common/Footer';
import { useAuth } from '../../../context/AuthContext';
import ChatBox from '../../chatbot/components/ChatBox';
import ErrorBoundary from '../../../components/common/ErrorBoundary';
import QuizContent from '../components/QuizContent';
import SpeakingExercise from '../components/SpeakingExercise';
import CaptionOverlay from '../components/CaptionOverlay';
import InteractiveTranscript from '../components/InteractiveTranscript';
const PdfStudyViewer = React.lazy(() => import('../components/PdfStudyViewer'));
const PdfNotesPanel = React.lazy(() => import('../components/PdfNotesPanel'));
import useStudyTimeTracker from '../hooks/useStudyTimeTracker';
import { subtitlesService } from '../services/subtitles.service';
import {
  fetchPdfNotes,
  createPdfNote,
  updatePdfNote,
  deletePdfNote
} from '../services/pdfNotes.service';
import shaka from 'shaka-player';
import {
  getCourseDetails,
  getLessonById,
  toggleLessonCompletion,
  getVideoTicket
} from '../services/lessons.service';

const WATERMARK_POSITIONS = [
  'top-3.5 left-3.5',
  'top-3.5 right-3.5',
  'bottom-3.5 left-3.5',
  'bottom-3.5 right-3.5',
  'top-1/2 left-3.5 -translate-y-1/2',
  'top-1/2 right-3.5 -translate-y-1/2'
];

const LessonDetailPage = () => {
  const navigate = useNavigate();
  const { lessonId } = useParams();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const shakaPlayerRef = useRef(null);
  const shakaAttachedToRef = useRef(null); // theo dõi element nào Shaka đang attach vào
  const isScreenRecordingDetectedRef = useRef(false);
  const blurTimeoutRef = useRef(null);
  const lastWarningTimeRef = useRef(0);
  const wasPlayingRef = useRef(false);
  const blackoutReasonRef = useRef('');

  const userRole = parseInt(user?.roleId || user?.role_id || user?.role, 10);
  const currentUserId = user?.userId || user?.user_id || user?.id;

  // States
  const [activeRightTab, setActiveRightTab] = useState("playlist"); // "playlist" or "ai"
  const [activeLeftTab, setActiveLeftTab] = useState("syllabus"); // "syllabus" or "resources"
  const [expandedSections, setExpandedSections] = useState({});
  const [optimisticLessonId, setOptimisticLessonId] = useState(null);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [ticketPlaybackUrl, setTicketPlaybackUrl] = useState(null);
  const autoRetryCountRef = useRef(0);

  // Countdown timer state
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  // Video & Screen Recording Protection States
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoError, setVideoError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [isScreenRecordingDetected, setIsScreenRecordingDetected] = useState(false);
  const [recordingDetectedMessage, setRecordingDetectedMessage] = useState('');
  // Smart AI Subtitles & Interactive Bilingual Transcript States
  const [subtitleData, setSubtitleData] = useState(null);
  const [captionMode, setCaptionMode] = useState('off'); // 'off' | 'en' | 'vi' | 'bilingual' (Mặc định tắt phụ đề, người dùng bật khi có nhu cầu)
  const [videoCurrentTime, setVideoCurrentTime] = useState(0);
  const [isGeneratingSubtitles, setIsGeneratingSubtitles] = useState(false);
  const [isCaptionMenuOpen, setIsCaptionMenuOpen] = useState(false);


  // Forensic Dynamic Watermark State
  const [watermarkPosIndex, setWatermarkPosIndex] = useState(0);

  // Refs for DRM and Video Control
  const blackoutLockUntilRef = useRef(0);
  const restoreTimeoutRef = useRef(null);

  // ⚡ Dynamic Forensic Watermark: Tự động đổi vị trí ngẫu nhiên mỗi 28s để chống cắt/làm mờ góc video
  useEffect(() => {
    const interval = setInterval(() => {
      setWatermarkPosIndex(prev => {
        let next = Math.floor(Math.random() * WATERMARK_POSITIONS.length);
        if (next === prev) next = (prev + 1) % WATERMARK_POSITIONS.length;
        return next;
      });
    }, 28000);
    return () => clearInterval(interval);
  }, []);

  const formatWatermarkTimestamp = (seconds) => {
    if (!seconds || isNaN(seconds) || seconds < 0) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // ⚡ 60 FPS Ultra-Smooth Video Time Tracking (Loại bỏ 100% hiện tượng khựng/trễ phụ đề)
  useEffect(() => {
    let animationFrameId;
    const trackTime = () => {
      if (videoRef.current && !videoRef.current.paused) {
        const t = videoRef.current.currentTime;
        setVideoCurrentTime(t);
      }
      animationFrameId = requestAnimationFrame(trackTime);
    };

    if (isVideoPlaying) {
      animationFrameId = requestAnimationFrame(trackTime);
    }
    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [isVideoPlaying]);

  // Lắng nghe sự thay đổi Fullscreen để giữ dấu bản quyền hiển thị đè lên Video ngay cả trong Chế độ Toàn Màn Hình
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFS = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement);
      setIsFullscreenMode(isFS);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
    };
  }, []);

  /**
   * ⚡ ĐỘNG CƠ CÔ LẬP MÀN HÌNH ĐEN DRM PHẢN HỒI TỨC THÌ CHUẨN APPLE / NETFLIX (Real-Time Reactive DRM Engine)
   * 
   * [PHẠM VI BẢO VỆ]:
   * - Ngăn chặn 100% các thao tác chụp màn hình từ bàn phím (PrintScreen, Win+Shift+S, Alt+PrtScn)
   * - Ngăn chặn chia sẻ màn hình qua getDisplayMedia của trình duyệt
   * - Tự động che đen khi người dùng chuyển tab (visibilitychange) hoặc mất focus (window blur)
   * 
   * [GIỚI HẠN KỸ THUẬT CLIENT-SIDE JAVASCRIPT]:
   * - Không thể phát hiện OBS Studio / Bandicam chạy chế độ Display Capture (Toàn màn hình) khi Tab vẫn giữ active focus
   *   (do hạn chế bảo mật Sandbox của trình duyệt web không thể can thiệp quét tiến trình hệ điều hành).
   * - Không thể ngăn chặn thiết bị Capture Card phần cứng hoặc quay phim trực tiếp bằng camera/điện thoại ngoại vi.
   * => Hệ thống sử dụng Forensic Watermark Động (Email + UserID + Timestamp mm:ss) để truy vết và xử lý bản quyền.
   * Xem tài liệu kỹ thuật chi tiết tại: GIOI_HAN_BAO_MAT_VIDEO.md
   */
  const isCapturingKeysRef = useRef(new Set());

  const triggerZeroLatencyBlackout = (reason) => {
    // 1. Thao tác DOM đồng bộ vi-giây (0ms Synchronous DOM Blackout)
    const shield = document.getElementById('netflix-drm-blackout-shield');
    if (shield) shield.style.display = 'block';
    const wrapper = document.getElementById('lesson-media-wrapper');
    if (wrapper) wrapper.style.display = 'none';

    // 2. Ẩn và tạm dừng phần tử video
    if (videoRef.current) {
      try {
        videoRef.current.style.opacity = '0';
        videoRef.current.style.visibility = 'hidden';
        if (!videoRef.current.paused) {
          wasPlayingRef.current = true;
          videoRef.current.pause();
        }
      } catch (err) { }
    }

    // 3. Xóa bộ nhớ đệm Clipboard ngay lập tức để triệt tiêu ảnh chụp
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText('').catch(() => {});
    }

    setIsScreenRecordingDetected(true);
    isScreenRecordingDetectedRef.current = true;
    blackoutReasonRef.current = reason || '';
    setRecordingDetectedMessage(reason || '');
  };

  const restoreDrmVideo = () => {
    // 1. Khôi phục DOM đồng bộ tức thì (0ms Instant Restore)
    const shield = document.getElementById('netflix-drm-blackout-shield');
    if (shield) shield.style.display = 'none';
    const wrapper = document.getElementById('lesson-media-wrapper');
    if (wrapper) wrapper.style.display = 'block';

    setIsScreenRecordingDetected(false);
    isScreenRecordingDetectedRef.current = false;
    blackoutReasonRef.current = '';
    setRecordingDetectedMessage('');

    if (videoRef.current) {
      try {
        videoRef.current.style.opacity = '1';
        videoRef.current.style.visibility = 'visible';
        // Tự động phát tiếp nếu trước khi che đen video đang phát
        if (wasPlayingRef.current) {
          videoRef.current.play().catch(() => {});
          wasPlayingRef.current = false;
        }
      } catch (_) {}
    }
  };

  // Van an toàn (Safety Valve): Tự động giải phóng màn hình đen nếu tab đã active và có focus trở lại
  useEffect(() => {
    const safetyInterval = setInterval(() => {
      if (isScreenRecordingDetectedRef.current) {
        const isTabActive = !document.hidden && document.hasFocus();
        const currentReason = blackoutReasonRef.current || '';
        const isBlurOrTabHidden = currentReason === 'Tab Hidden' || currentReason === 'Window Blur';

        // Chỉ tự động khôi phục nếu lý do là do chuyển tab/mất focus, KHÔNG can thiệp nếu đang bấm phím chụp màn hình
        if (isTabActive && isBlurOrTabHidden && isCapturingKeysRef.current.size === 0) {
          restoreDrmVideo();
        }
      }
    }, 1000);

    return () => clearInterval(safetyInterval);
  }, []);

  // Tua video an toàn (Click-to-Seek với Clamp 0 <= targetSec <= videoDuration)
  const handleSeekVideo = (seconds) => {
    if (!videoRef.current) return;
    const targetSec = Number(seconds);
    if (isNaN(targetSec) || !isFinite(targetSec) || targetSec < 0) return;

    const duration = videoRef.current.duration;
    const safeTime = (duration && isFinite(duration) && duration > 0)
      ? Math.min(Math.max(0, targetSec), duration)
      : Math.max(0, targetSec);

    videoRef.current.currentTime = safeTime;
    setVideoCurrentTime(safeTime);

    if (videoRef.current.paused) {
      videoRef.current.play().catch(() => {});
      setIsVideoPlaying(true);
    }
  };

  // Tự động tua video khi URL có tham số ?seek= (điều hướng từ thẻ bài học khác sang)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const seekParam = params.get('seek');
    if (seekParam) {
      const seekSec = parseFloat(seekParam);
      if (!isNaN(seekSec) && seekSec >= 0) {
        const timer = setTimeout(() => {
          handleSeekVideo(seekSec);
        }, 600);
        return () => clearTimeout(timer);
      }
    }
  }, [location.search, lessonId]);

  // Click vào video để tạm dừng hoặc phát tiếp (Play / Pause toggle)
  const toggleVideoPlayPause = (e) => {
    if (!videoRef.current) return;
    if (isScreenRecordingDetectedRef.current) return;

    if (videoRef.current.paused) {
      videoRef.current.play().catch(() => {});
      setIsVideoPlaying(true);
    } else {
      videoRef.current.pause();
      setIsVideoPlaying(false);
    }
  };

  // Hệ thống Tự động Bắt Sự Kiện Chống Chụp / Quay Màn hình Chuẩn Apple (Phản hồi tức thì 0ms trên cả Blur & Phím chụp)
  useEffect(() => {
    let isAltPressed = false;
    let isMetaPressed = false;

    const handleScreenCaptureKeys = (e) => {
      if (e.key === 'Alt' || e.code === 'AltLeft' || e.code === 'AltRight') {
        isAltPressed = (e.type === 'keydown');
      }
      if (e.key === 'Meta' || e.key === 'OS' || e.code === 'MetaLeft' || e.code === 'MetaRight' || e.keyCode === 91 || e.keyCode === 92) {
        isMetaPressed = (e.type === 'keydown');
      }

      const isAltActive = e.altKey || isAltPressed;
      const isMetaActive = e.metaKey || isMetaPressed;
      const isShiftActive = e.shiftKey;
      const isCtrlActive = e.ctrlKey;
      const keyLower = (e.key || '').toLowerCase();
      const codeUpper = (e.code || '').toUpperCase();

      // 1. Phát hiện PrintScreen
      const isPrtScn = e.key === 'PrintScreen' || e.key === 'Snapshot' || codeUpper === 'PRINTSCREEN' || e.keyCode === 44;

      // 2. Phát hiện Snipping Tool & macOS Screen Capture (Win + Shift + S, Cmd + Shift + 3/4/5)
      const isSnippingTool = (isMetaActive || isCtrlActive) && isShiftActive && (
        keyLower === 's' || codeUpper === 'KEYS' || e.keyCode === 83 ||
        keyLower === '3' || keyLower === '4' || keyLower === '5'
      );

      // 3. Phát hiện Xbox Game Bar (Win + G) & NVIDIA Instant Replay (Alt + Z, Alt + F9/F10)
      const isNvidia = isAltActive && (keyLower === 'z' || keyLower === 'f9' || keyLower === 'f10');
      const isXbox = isMetaActive && (keyLower === 'g' || (isAltActive && keyLower === 'r'));

      const isCaptureAttempt = isPrtScn || isSnippingTool || isNvidia || isXbox;

      if (e.type === 'keydown') {
        if (isCaptureAttempt) {
          isCapturingKeysRef.current.add(e.key || 'Capture');
          // ĐEN MÀN HÌNH ĐỒNG BỘ 0ms
          triggerZeroLatencyBlackout('Hệ thống bảo vệ bản quyền: Đã phát hiện thao tác chụp màn hình!');
          try {
            e.preventDefault();
            e.stopPropagation();
          } catch (_) { }
          return false;
        }
      } else if (e.type === 'keyup') {
        isCapturingKeysRef.current.clear();
        if (isCaptureAttempt || isPrtScn) {
          // Hết nhấn/hết chụp -> NHẢ VIDEO NGAY LẬP TỨC
          restoreDrmVideo();
        }
      }
    };

    // Khi Snipping Tool mở ra hoặc mất focus cửa sổ -> Đen ngay tức thì
    const handleWindowBlur = () => {
      triggerZeroLatencyBlackout('Window Blur');
    };

    // Khi người dùng quay trở lại cửa sổ hoặc đóng Snipping Tool -> Nhả video tức thì
    const handleWindowFocus = () => {
      isCapturingKeysRef.current.clear();
      restoreDrmVideo();
    };

    // Khi tab trình duyệt bị ẩn hoặc chuyển tab
    const handleVisibilityChange = () => {
      if (document.hidden) {
        triggerZeroLatencyBlackout('Tab Hidden');
      } else {
        isCapturingKeysRef.current.clear();
        restoreDrmVideo();
      }
    };

    window.addEventListener('keydown', handleScreenCaptureKeys, true);
    window.addEventListener('keyup', handleScreenCaptureKeys, true);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('keydown', handleScreenCaptureKeys, true);
      window.removeEventListener('keyup', handleScreenCaptureKeys, true);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('focus', handleWindowFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Chặn & phát hiện Extension / Trình duyệt kích hoạt getDisplayMedia (Screen Capture API cho OBS / Extensions)
  useEffect(() => {
    if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
      const originalGetDisplayMedia = navigator.mediaDevices.getDisplayMedia;
      navigator.mediaDevices.getDisplayMedia = function (...args) {
        if (videoRef.current) {
          videoRef.current.pause();
        }
        triggerZeroLatencyBlackout('Hệ thống phát hiện trình duyệt đang chia sẻ hoặc quay màn hình (OBS / Screen Extension)!');
        return originalGetDisplayMedia.apply(this, args);
      };
    }
  }, []);

  // Bảo mật video (chặn DevTools, chuột phải theo vai trò và cấu hình admin)
  useEffect(() => {
    // Lấy cấu hình bảo mật từ localStorage
    const getSecurityConfig = () => {
      const defaultConfig = {
        blockStudent: true,
        blockInstructor: false,
        blockF12: true,
        blockInspect: true,
        blockViewSource: true,
        blockRightClick: true
      };
      try {
        const saved = localStorage.getItem('admin_security_config');
        return saved ? JSON.parse(saved) : defaultConfig;
      } catch (e) {
        return defaultConfig;
      }
    };

    const config = getSecurityConfig();
    const isStudent = userRole === 3;
    const isInstructor = userRole === 2;
    const shouldBlock = (isStudent && config.blockStudent) || (isInstructor && config.blockInstructor);

    if (!shouldBlock) return;

    const handleKeyDown = (e) => {
      // Chặn phím F12
      if (config.blockF12 && (e.key === 'F12' || e.keyCode === 123)) {
        e.preventDefault();
        return false;
      }
      // Chặn Ctrl+Shift+I
      if (config.blockInspect && e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.keyCode === 73)) {
        e.preventDefault();
        return false;
      }
      // Chặn Ctrl+Shift+C
      if (config.blockInspect && e.ctrlKey && e.shiftKey && (e.key === 'C' || e.key === 'c' || e.keyCode === 67)) {
        e.preventDefault();
        return false;
      }
      // Chặn Ctrl+U
      if (config.blockViewSource && e.ctrlKey && (e.key === 'U' || e.key === 'u' || e.keyCode === 85)) {
        e.preventDefault();
        return false;
      }
    };

    const handleContextMenu = (e) => {
      if (config.blockRightClick) {
        e.preventDefault();
        return false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('contextmenu', handleContextMenu);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [userRole]);






  // Lắng nghe sự thay đổi của location để đổi tab tự động nếu cần
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tabParam = params.get('tab');
    if (tabParam === 'ai') {
      setActiveRightTab('ai');
    } else if (location.state?.activeTab) {
      setActiveRightTab(location.state.activeTab);
    }
  }, [location]);
  // 1. Tải thông tin meta của bài giảng để xác định courseId của bài giảng hiện tại
  const { data: initialLessonData } = useQuery({
    queryKey: ['lesson-meta', lessonId],
    queryFn: () => getLessonById(lessonId),
    enabled: !!lessonId
  });

  const searchParams = new URLSearchParams(location.search);
  const queryCourseId = searchParams.get('courseId');
  const courseIdToLoad = lessonId
    ? (initialLessonData?.courseId || null)
    : (queryCourseId ? parseInt(queryCourseId, 10) : 5);

  // 2. Tải chi tiết khóa học động dựa trên courseId có được
  const { data: course, isLoading: courseLoading } = useQuery({
    queryKey: ['course', courseIdToLoad],
    queryFn: () => getCourseDetails(courseIdToLoad),
    enabled: courseIdToLoad !== null
  });

  const startDate = course?.startDate ? new Date(course.startDate) : null;
  const currentDate = new Date();
  const hasNotStarted = startDate && startDate > currentDate;
  const isInstructorOrAdmin = user && (userRole === 1 || Number(currentUserId) === Number(course?.instructorId));
  const shouldLock = hasNotStarted && !isInstructorOrAdmin;

  useEffect(() => {
    if (!startDate || startDate <= currentDate) return;

    const updateCountdown = () => {
      const now = new Date().getTime();
      const distance = startDate.getTime() - now;

      if (distance < 0) {
        clearInterval(interval);
        queryClient.invalidateQueries({ queryKey: ['course', courseIdToLoad] });
        return;
      }

      const days = Math.floor(distance / (1000 * 60 * 60 * 24));
      const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);

      setCountdown({ days, hours, minutes, seconds });
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [course?.startDate]);

  // 3. Xác định targetLessonId thực tế (kết hợp optimistic state để phản hồi ngay lập tức < 50ms)
  const targetLessonId = optimisticLessonId || lessonId || (course?.sections?.[0]?.lessons?.[0]?.id || null);

  // Đồng bộ optimistic state với URL params khi navigate
  useEffect(() => {
    setOptimisticLessonId(lessonId || null);
  }, [lessonId]);

  // 4. Tải chi tiết bài học hiện tại (Sử dụng cache key 'lesson-detail' để tránh nhầm với playlist summary)
  const { data: currentLesson, isLoading: lessonLoading, isFetching: lessonFetching } = useQuery({
    queryKey: ['lesson-detail', targetLessonId],
    queryFn: () => getLessonById(targetLessonId),
    enabled: !!targetLessonId,
    staleTime: 1000 * 60 * 15
  });

  // Kiểm tra tính sẵn sàng thực sự của chi tiết bài học (Chống Race Condition out-of-order responses)
  const isDetailResolved = !lessonLoading && !!currentLesson && String(currentLesson.id) === String(targetLessonId);
  const isLessonLoading = !isDetailResolved || lessonLoading || (lessonFetching && String(currentLesson?.id) !== String(targetLessonId));

  const isLoading = (lessonId && !initialLessonData) || courseLoading;

  // Real-time Study Time Tracker: Tự động ghi nhận từng phút học thực tế vào Heatmap
  const isSpeakingLesson = String(targetLessonId).startsWith('speaking-') || !!currentLesson?.speakingSentences || !!currentLesson?.speakingQuestions;
  const isPdfLesson = currentLesson?.type === 'pdf';
  const isQuizLesson = String(targetLessonId).startsWith('quiz-') || !!currentLesson?.quizId;
  const activeActivityType = isQuizLesson ? 'quiz' : isSpeakingLesson ? 'speaking' : isPdfLesson ? 'pdf' : 'video';

  useStudyTimeTracker(targetLessonId, isVideoPlaying, activeActivityType);

  // PDF Notes States & TanStack Query Integration (TASK-PDF-SMART-NOTES-01 & 02)
  const pdfDocumentRef = currentLesson?.documentRef || (currentLesson ? `lesson:${currentLesson.id}:primary:v${currentLesson.pdfVersion || 1}` : '');
  const [activePdfPage, setActivePdfPage] = useState(1);
  const [selectedPdfNoteId, setSelectedPdfNoteId] = useState(null);
  const [activeGlowNoteId, setActiveGlowNoteId] = useState(null);
  const [isAreaSelectionMode, setIsAreaSelectionMode] = useState(false);

  // Reset trang và highlight state khi đổi bài học
  useEffect(() => {
    setActivePdfPage(1);
    setSelectedPdfNoteId(null);
    setActiveGlowNoteId(null);
    setIsAreaSelectionMode(false);
  }, [currentLesson?.id]);

  // Đồng bộ sidebar tab 2 chiều khi chuyển đổi giữa PDF và Video (TASK-PDF-SMART-NOTES-01-R1)
  useEffect(() => {
    if (isPdfLesson) {
      if (activeRightTab === 'transcript') {
        setActiveRightTab('notes');
      }
    } else {
      if (activeRightTab === 'notes') {
        setActiveRightTab('transcript');
      }
    }
  }, [isPdfLesson, activeRightTab]);

  // TanStack Query for PDF Notes
  const {
    data: pdfNotes = [],
    isLoading: isPdfNotesLoading
  } = useQuery({
    queryKey: ['pdf-notes', currentLesson?.id, pdfDocumentRef],
    queryFn: () => fetchPdfNotes(currentLesson?.id, pdfDocumentRef),
    enabled: !!currentLesson?.id && isPdfLesson && !!currentUserId,
    staleTime: 1000 * 60 * 5
  });

  // Create note mutation with Optimistic Update
  const createPdfNoteMutation = useMutation({
    mutationFn: (newNote) => createPdfNote(currentLesson?.id, { ...newNote, documentRef: pdfDocumentRef }),
    onMutate: async (newNote) => {
      await queryClient.cancelQueries({ queryKey: ['pdf-notes', currentLesson?.id, pdfDocumentRef] });
      const previousNotes = queryClient.getQueryData(['pdf-notes', currentLesson?.id, pdfDocumentRef]) || [];
      const tempId = 'temp-' + Date.now();
      const optimisticNote = {
        id: tempId,
        noteId: tempId,
        userId: currentUserId,
        lessonId: currentLesson?.id,
        documentRef: pdfDocumentRef,
        pageNumber: newNote.pageNumber,
        selectedText: newNote.selectedText,
        noteText: newNote.noteText || '',
        category: newNote.category,
        color: newNote.color,
        rects: newNote.rects,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      queryClient.setQueryData(['pdf-notes', currentLesson?.id, pdfDocumentRef], [...previousNotes, optimisticNote]);
      return { previousNotes };
    },
    onError: (err, newNote, context) => {
      if (context?.previousNotes) {
        queryClient.setQueryData(['pdf-notes', currentLesson?.id, pdfDocumentRef], context.previousNotes);
      }
      alert('Không thể tạo ghi chú: ' + (err?.response?.data?.message || err.message));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['pdf-notes', currentLesson?.id, pdfDocumentRef] });
    }
  });

  // Update note mutation
  const updatePdfNoteMutation = useMutation({
    mutationFn: ({ noteId, updateData }) => updatePdfNote(currentLesson?.id, noteId, updateData),
    onMutate: async ({ noteId, updateData }) => {
      await queryClient.cancelQueries({ queryKey: ['pdf-notes', currentLesson?.id, pdfDocumentRef] });
      const previousNotes = queryClient.getQueryData(['pdf-notes', currentLesson?.id, pdfDocumentRef]) || [];
      queryClient.setQueryData(
        ['pdf-notes', currentLesson?.id, pdfDocumentRef],
        previousNotes.map((n) => (String(n.id || n.noteId) === String(noteId) ? { ...n, ...updateData } : n))
      );
      return { previousNotes };
    },
    onError: (err, variables, context) => {
      if (context?.previousNotes) {
        queryClient.setQueryData(['pdf-notes', currentLesson?.id, pdfDocumentRef], context.previousNotes);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['pdf-notes', currentLesson?.id, pdfDocumentRef] });
    }
  });

  // Delete note mutation
  const deletePdfNoteMutation = useMutation({
    mutationFn: (noteId) => deletePdfNote(currentLesson?.id, noteId),
    onMutate: async (noteId) => {
      await queryClient.cancelQueries({ queryKey: ['pdf-notes', currentLesson?.id, pdfDocumentRef] });
      const previousNotes = queryClient.getQueryData(['pdf-notes', currentLesson?.id, pdfDocumentRef]) || [];
      queryClient.setQueryData(
        ['pdf-notes', currentLesson?.id, pdfDocumentRef],
        previousNotes.filter((n) => String(n.id || n.noteId) !== String(noteId))
      );
      return { previousNotes };
    },
    onError: (err, noteId, context) => {
      if (context?.previousNotes) {
        queryClient.setQueryData(['pdf-notes', currentLesson?.id, pdfDocumentRef], context.previousNotes);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['pdf-notes', currentLesson?.id, pdfDocumentRef] });
    }
  });

  const handleCreatePdfNote = async (noteData) => {
    return createPdfNoteMutation.mutateAsync(noteData);
  };

  const handleUpdatePdfNote = async (noteId, updateData) => {
    return updatePdfNoteMutation.mutateAsync({ noteId, updateData });
  };

  const handleDeletePdfNote = async (noteId) => {
    return deletePdfNoteMutation.mutateAsync(noteId);
  };

  const handleNavigateToPdfNote = (note) => {
    setActivePdfPage(Number(note.pageNumber));
    setSelectedPdfNoteId(note.id || note.noteId);
    setActiveGlowNoteId(note.id || note.noteId);
    setTimeout(() => {
      setActiveGlowNoteId(null);
    }, 1500);
  };

  // Tự động tải phụ đề khi đổi bài học (Đặt sau khi currentLesson đã được khai báo an toàn)
  useEffect(() => {
    if (!currentLesson?.id) return;
    const rawLessonId = currentLesson.id.toString().replace(/^(quiz|speaking)-/, '');
    subtitlesService.getSubtitles(rawLessonId).then(data => {
      if (data) {
        setSubtitleData(data);
      } else {
        setSubtitleData(null);
      }
    }).catch(() => {
      setSubtitleData(null);
    });
  }, [currentLesson?.id]);

  // Kích hoạt Gemini 2.5 Flash tạo lại phụ đề
  const handleGenerateSubtitles = async () => {
    if (!currentLesson?.id || isGeneratingSubtitles) return;
    const rawLessonId = currentLesson.id.toString().replace(/^(quiz|speaking)-/, '');
    setIsGeneratingSubtitles(true);
    try {
      const data = await subtitlesService.generateSubtitles(rawLessonId);
      if (data) {
        setSubtitleData(data);
      }
    } catch (err) {
      console.error("Lỗi sinh phụ đề AI Gemini:", err);
    } finally {
      setIsGeneratingSubtitles(false);
    }
  };

  const sanitizeUrl = (url) => {
    if (!url) return '';
    try {
      const u = new URL(url, window.location.origin);
      u.searchParams.delete('token');
      u.searchParams.delete('ticket');
      return u.toString();
    } catch {
      return String(url).split('?')[0];
    }
  };

  const handleVideoError = (e) => {
    setVideoLoading(false);
    setIsVideoPlaying(false);
    const mediaError = e?.target?.error;
    const code = mediaError?.code;
    const message = mediaError?.message || '';
    const networkState = e?.target?.networkState;
    const readyState = e?.target?.readyState;
    const rawUrl = ticketPlaybackUrl || currentLesson?.videoUrl || '';
    const cleanUrl = sanitizeUrl(rawUrl);

    console.warn('⚠️ [Video Player Error]:', {
      code,
      message,
      networkState,
      readyState,
      url: cleanUrl
    });

    // 🔄 Controlled Auto-Retry: Tự động xin lại ticket tối đa một lần cho cùng lesson
    const isInternal = currentLesson?.videoUrl && !currentLesson.videoUrl.startsWith('http');
    if (autoRetryCountRef.current < 1 && isInternal) {
      autoRetryCountRef.current += 1;
      setVideoLoading(true);
      setReloadKey(prev => prev + 1);
      return;
    }

    setVideoError({
      code,
      message: 'Không thể tải hoặc giải mã video. Nguồn video có thể chưa được tải lên hoặc vé phát video đã hết hạn.',
      sanitizedUrl: cleanUrl
    });
  };

  const handleRetryVideo = () => {
    setVideoError(null);
    setVideoLoading(true);
    setReloadKey(prev => prev + 1);
  };

  // Single-flight DASH ticket renewal refs
  const activeDashTicketRef = useRef(null);
  const renewalTimerRef = useRef(null);
  const renewalPromiseRef = useRef(null);

  // Video loading state — Lấy Video Ticket 60s cho internal MP4 / Khởi tạo Shaka Player cho DASH DRM / Phát trực tiếp external MP4
  // 🛡️ BỘ NẠP VIDEO BẢO MẬT (Short-Lived 60s Video Ticket & W3C ClearKey DASH DRM)
  useEffect(() => {
    const rawVideoUrl = currentLesson?.videoUrl;

    setVideoError(null);

    if (renewalTimerRef.current) {
      clearTimeout(renewalTimerRef.current);
      renewalTimerRef.current = null;
    }

    if (!rawVideoUrl || currentLesson?.type === 'pdf' || currentLesson?.type === 'quiz' || currentLesson?.type === 'speaking') {
      setTicketPlaybackUrl(null);
      setVideoLoading(false);
      if (shakaPlayerRef.current) {
        shakaPlayerRef.current.destroy().catch(() => {});
        shakaPlayerRef.current = null;
        shakaAttachedToRef.current = null;
      }
      return;
    }

    // Reset URL ngay lập tức khi đổi bài học để tránh hiển thị video cũ (stale video)
    setTicketPlaybackUrl(null);
    setVideoLoading(true);
    let active = true;

    const isDash = currentLesson?.playbackType === 'dash' ||
                   currentLesson?.isDrmProtected === true ||
                   (typeof rawVideoUrl === 'string' && rawVideoUrl.includes('.mpd'));

    const isExternal = !isDash && (rawVideoUrl.startsWith('http://') || rawVideoUrl.startsWith('https://'));

    // -------------------------------------------------------------
    // LUỒNG 1: Video Mã hóa DASH / W3C ClearKey DRM -> Sử dụng Shaka Player
    // -------------------------------------------------------------
    if (isDash) {
      if (!shaka || !shaka.Player || !shaka.Player.isBrowserSupported()) {
        setVideoLoading(false);
        setVideoError({
          code: 4,
          message: 'Trình duyệt hiện tại không hỗ trợ giải mã DRM DASH qua Shaka Player.'
        });
        return () => {
          active = false;
        };
      }

      const rawLessonId = String(currentLesson.id).replace(/^(quiz|speaking)-/, '');
      const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

      // Hàm gia hạn ticket đơn luồng an toàn (Single-Flight Proactive Renewal)
      const fetchOrRenewTicket = async () => {
        if (renewalPromiseRef.current) return renewalPromiseRef.current;
        renewalPromiseRef.current = (async () => {
          try {
            const ticketRes = await getVideoTicket(rawLessonId);
            if (ticketRes && ticketRes.ticket) {
              activeDashTicketRef.current = ticketRes.ticket;
              // Lên lịch gia hạn trước 15s (ở giây thứ 45 của vé 60s)
              if (renewalTimerRef.current) clearTimeout(renewalTimerRef.current);
              renewalTimerRef.current = setTimeout(() => {
                if (active) fetchOrRenewTicket().catch(() => {});
              }, 45000);
              return ticketRes.ticket;
            }
          } catch (e) {
            console.warn('⚠️ [DASH Ticket Renewal Error]:', e.message);
          } finally {
            renewalPromiseRef.current = null;
          }
          return activeDashTicketRef.current;
        })();
        return renewalPromiseRef.current;
      };

      fetchOrRenewTicket().then(ticket => {
        if (!active) return;

        if (shakaPlayerRef.current && shakaAttachedToRef.current !== videoRef.current) {
          shakaPlayerRef.current.destroy().catch(() => {});
          shakaPlayerRef.current = null;
          shakaAttachedToRef.current = null;
        }

        if (!shakaPlayerRef.current && videoRef.current) {
          const player = new shaka.Player(videoRef.current);
          shakaPlayerRef.current = player;
          shakaAttachedToRef.current = videoRef.current;

          const MANIFEST = shaka?.net?.NetworkingEngine?.RequestType?.MANIFEST ?? 0;
          const SEGMENT = shaka?.net?.NetworkingEngine?.RequestType?.SEGMENT ?? 2;
          const LICENSE = shaka?.net?.NetworkingEngine?.RequestType?.LICENSE ?? 1;

          player.getNetworkingEngine().registerRequestFilter((type, request) => {
            if (type === LICENSE) {
              const token = localStorage.getItem('token') || localStorage.getItem('auth_token');
              if (token) {
                request.headers['Authorization'] = `Bearer ${token}`;
              }
            } else if (type === MANIFEST || type === SEGMENT) {
              const currentTicket = activeDashTicketRef.current || ticket;
              if (currentTicket) {
                request.headers['X-Video-Ticket'] = currentTicket;
                if (request.uris && request.uris[0]) {
                  const sep = request.uris[0].includes('?') ? '&' : '?';
                  request.uris[0] = `${request.uris[0]}${sep}ticket=${encodeURIComponent(currentTicket)}`;
                }
              }
            }
          });
        }

        const licenseUrl = `${API_BASE_URL}/drm/license?lessonId=${rawLessonId}`;
        shakaPlayerRef.current?.configure({
          drm: { servers: { 'org.w3.clearkey': licenseUrl } }
        });

        // Điểm cuối DASH có bảo vệ
        const manifestUrl = `${API_BASE_URL}/lessons/dash/${rawLessonId}/manifest.mpd?ticket=${encodeURIComponent(ticket || '')}`;

        shakaPlayerRef.current?.load(manifestUrl)
          .then(() => {
            if (active) setVideoLoading(false);
          })
          .catch((err) => {
            if (!active) return;
            console.warn('⚠️ [Shaka DRM Error]:', err?.message || err);
            setVideoLoading(false);
            setVideoError({
              code: 4,
              message: 'Không thể giải mã hoặc phát luồng video DRM DASH.',
              sanitizedUrl: sanitizeUrl(manifestUrl)
            });
          });
      }).catch(err => {
        if (!active) return;
        setVideoLoading(false);
        setVideoError({
          code: 403,
          message: 'Không thể lấy vé xem luồng DASH bảo mật.'
        });
      });

      return () => {
        active = false;
        if (renewalTimerRef.current) {
          clearTimeout(renewalTimerRef.current);
          renewalTimerRef.current = null;
        }
      };
    }

    // Nếu không phải luồng DASH DRM -> Hủy Shaka Player instance nếu đang tồn tại
    if (shakaPlayerRef.current) {
      shakaPlayerRef.current.destroy().catch(() => {});
      shakaPlayerRef.current = null;
      shakaAttachedToRef.current = null;
    }

    // -------------------------------------------------------------
    // LUỒNG 2: Video Ngoài / CDN Trực tiếp -> Phát trực tiếp không qua ticket
    // -------------------------------------------------------------
    if (isExternal) {
      setTicketPlaybackUrl(rawVideoUrl);
      setVideoLoading(false);
      return () => {
        active = false;
      };
    }

    // -------------------------------------------------------------
    // LUỒNG 3: Video Nội bộ Bảo mật / Supabase Storage -> Lấy Video Ticket 60s
    // -------------------------------------------------------------
    const rawLessonId = String(currentLesson.id).replace(/^(quiz|speaking)-/, '');
    getVideoTicket(rawLessonId)
      .then((res) => {
        if (!active) return;
        if (res && res.streamUrl) {
          const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
          const backendHost = apiUrl.replace(/\/api\/?$/, '');
          const fullStreamUrl = res.streamUrl.startsWith('http')
            ? res.streamUrl
            : `${backendHost}${res.streamUrl.startsWith('/') ? '' : '/'}${res.streamUrl}`;
          setTicketPlaybackUrl(fullStreamUrl);
        } else {
          setVideoError({
            code: 403,
            message: 'Không nhận được vé phát video từ máy chủ.'
          });
        }
        setVideoLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        console.warn('⚠️ [Video Ticket Error]:', err?.response?.data || err.message);
        setVideoLoading(false);
        setVideoError({
          code: err?.response?.status || 403,
          message: err?.response?.data?.message || 'Không thể lấy vé phát video bài học. Vui lòng thử lại.'
        });
      });

    return () => {
      active = false;
    };
  }, [currentLesson?.id, currentLesson?.videoUrl, currentLesson?.type, currentLesson?.playbackType, currentLesson?.isDrmProtected, reloadKey]);

  // Reset autoRetry counter khi chuyển sang bài học khác
  useEffect(() => {
    autoRetryCountRef.current = 0;
  }, [currentLesson?.id]);

  // Cleanup Shaka Player khi component unmount
  useEffect(() => {
    return () => {
      if (shakaPlayerRef.current) {
        shakaPlayerRef.current.destroy().catch(() => {});
        shakaPlayerRef.current = null;
        shakaAttachedToRef.current = null;
      }
    };
  }, []);

  // Tự động mở rộng section chứa bài học hiện tại khi load xong dữ liệu
  useEffect(() => {
    if (targetLessonId && course?.sections) {
      const sectionExp = {};
      course.sections.forEach(sec => {
        const hasLesson = sec.lessons.some(l => String(l.id) === String(targetLessonId));
        if (hasLesson) {
          sectionExp[sec.id] = true;
        }
      });
      setExpandedSections(prev => ({ ...prev, ...sectionExp }));
    }
  }, [targetLessonId, course]);

  // Đổi bài học mới siêu mượt (< 50ms Optimistic UI)
  const handleSelectLesson = (id) => {
    setOptimisticLessonId(id);
    navigate(`/lessons/${id}`);
  };

  // Check hoàn thành bài học (Optimistic State Update < 50ms)
  const handleToggleComplete = async (e, id) => {
    e.stopPropagation(); // Ngăn kích hoạt click chọn bài học
    const cleanId = String(id).replace('quiz-', '').replace('speaking-', '');

    // 1. Cập nhật tức thì (< 50ms) trên Client Query Cache cho tất cả biến thể bài học (video, quiz, speaking)
    const toggleCompleted = (old) => old ? { ...old, completed: !old.completed } : old;
    queryClient.setQueryData(['lesson', id], toggleCompleted);
    queryClient.setQueryData(['lesson', cleanId], toggleCompleted);
    queryClient.setQueryData(['lesson', `quiz-${cleanId}`], toggleCompleted);
    queryClient.setQueryData(['lesson', `speaking-${cleanId}`], toggleCompleted);

    queryClient.setQueryData(['course', courseIdToLoad], (oldCourse) => {
      if (!oldCourse) return oldCourse;
      const updatedSections = oldCourse.sections.map(sec => ({
        ...sec,
        lessons: sec.lessons.map(l => {
          const lCleanId = String(l.id).replace('quiz-', '').replace('speaking-', '');
          return lCleanId === cleanId ? { ...l, completed: !l.completed } : l;
        })
      }));
      const all = updatedSections.flatMap(s => s.lessons);
      const comp = all.filter(l => l.completed).length;
      const prog = all.length > 0 ? Math.round((comp / all.length) * 100) : 0;
      return { ...oldCourse, sections: updatedSections, progress: prog };
    });

    try {
      await toggleLessonCompletion(id);

      // Khởi chạy reload ngầm của React Query để đồng bộ toàn cục
      queryClient.invalidateQueries({ queryKey: ['lesson', id] });
      queryClient.invalidateQueries({ queryKey: ['lesson', cleanId] });
      queryClient.invalidateQueries({ queryKey: ['course', courseIdToLoad] });
    } catch (error) {
      console.error("Lỗi cập nhật trạng thái bài học:", error);
    }
  };

  // Toggle thu gọn/mở rộng chương học
  const toggleSection = (sectionId) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  if (isLoading && !course) {
    return (
      <div className="min-h-screen flex flex-col font-sans" style={{ backgroundColor: 'var(--bg-color)', color: 'var(--text-color)' }}>
        <Header />

        {/* Main Content Area (Offset fixed Header) */}
        <main className="flex-grow pt-24 pb-8">
          <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 animate-pulse">

            {/* Breadcrumbs & Exit back to Homepage Skeleton */}
            <div className="flex justify-between items-center mb-5 shrink-0">
              <div style={{ height: '16px', width: '120px', backgroundColor: 'var(--border-color, #cbd5e1)', borderRadius: '4px', opacity: 0.2 }}></div>
              <div style={{ height: '32px', width: '200px', backgroundColor: 'var(--border-color, #cbd5e1)', borderRadius: '12px', opacity: 0.2 }}></div>
            </div>

            {/* 70/30 Grid Layout Skeleton */}
            <div className="grid grid-cols-10 gap-6 items-start">

              {/* Left Area Skeleton - 70% */}
              <div className="col-span-10 lg:col-span-7 flex flex-col space-y-6">
                {/* Video Block Skeleton */}
                <div className="rounded-2xl overflow-hidden aspect-video border border-slate-200 dark:border-slate-800 shadow-md relative" style={{ backgroundColor: 'var(--card-bg, #cbd5e1)', opacity: 0.2 }}></div>

                {/* Lesson title & description skeletons */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ height: '28px', width: '60%', backgroundColor: 'var(--border-color, #cbd5e1)', borderRadius: '6px', opacity: 0.2 }}></div>
                  <div style={{ height: '18px', width: '40%', backgroundColor: 'var(--border-color, #cbd5e1)', borderRadius: '6px', opacity: 0.2 }}></div>
                </div>
              </div>

              {/* Right Sidebar Area Skeleton - 30% */}
              <div className="col-span-10 lg:col-span-3 flex flex-col h-[calc(100vh-140px)] border rounded-2xl overflow-hidden shadow-sm" style={{ backgroundColor: 'var(--card-bg, #cbd5e1)', borderColor: 'var(--border-color)', opacity: 0.2 }}>
                {/* Sidebar header skeleton */}
                <div style={{ display: 'flex', height: '45px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color)' }}>
                  <div style={{ flex: 1, backgroundColor: 'var(--border-color)', opacity: 0.1 }}></div>
                  <div style={{ flex: 1, backgroundColor: 'var(--border-color)', opacity: 0.05 }}></div>
                </div>
                {/* Playlist skeletons */}
                <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {[...Array(4)].map((_, i) => (
                    <div key={i} style={{ border: '1px solid var(--border-color, #cbd5e1)', borderRadius: '12px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ height: '16px', width: '80%', backgroundColor: 'var(--border-color, #cbd5e1)', borderRadius: '4px' }}></div>
                      <div style={{ height: '12px', width: '40%', backgroundColor: 'var(--border-color, #cbd5e1)', borderRadius: '4px' }}></div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col font-sans" style={{ backgroundColor: 'var(--bg-color)', color: 'var(--text-color)' }}>
      <Header />

      {/* Main Content Area (Offset fixed Header) */}
      <main className="flex-grow pt-24 pb-8">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">

          {/* Breadcrumbs & Exit back to Homepage */}
          <div className="flex justify-between items-center mb-5 shrink-0">
            <button
              onClick={() => navigate('/')}
              className="flex items-center space-x-2 text-xs font-semibold text-slate-500 hover:text-smart-indigo transition-colors"
            >
              <FiArrowLeft />
              <span>Quay lại Trang chủ</span>
            </button>

            {course && (
              <div className="flex items-center space-x-3 bg-white border border-slate-200/60 shadow-sm px-4 py-2 rounded-xl text-xs font-medium text-slate-700" style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)', color: 'var(--text-color)' }}>
                <FiAward className="text-friendly-orange" />
                <span>Tiến độ học:</span>
                <div className="w-24 bg-slate-100 dark:bg-slate-700 rounded-full h-2 overflow-hidden border border-slate-200 dark:border-slate-650">
                  <div
                    className="bg-emerald-500 h-full transition-all duration-500"
                    style={{ width: `${course.progress}%` }}
                  ></div>
                </div>
                <span className="font-bold text-emerald-600 dark:text-emerald-450">{course.progress}%</span>
              </div>
            )}
          </div>

          {/* 70/30 Grid Layout */}
          {shouldLock ? (
            /* Premium Glassmorphic Countdown Lock Screen */
            <div className="w-full max-w-3xl mx-auto mt-6 bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 rounded-3xl p-8 md:p-12 shadow-xl text-center space-y-8 animate-fade relative overflow-hidden" style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)' }}>
              {/* Decorative Gradients */}
              <div className="absolute -top-16 -left-16 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none"></div>
              <div className="absolute -bottom-16 -right-16 w-32 h-32 bg-smart-indigo/10 rounded-full blur-2xl pointer-events-none"></div>

              <div className="space-y-4">
                <div className="w-20 h-20 rounded-2xl bg-amber-500/10 border-2 border-amber-500 flex items-center justify-center text-4xl text-amber-500 mx-auto shadow-md animate-bounce" style={{ animationDuration: '3s' }}>
                  ⏳
                </div>
                <h1 className="text-2xl md:text-3xl font-black text-slate-800 dark:text-slate-100 leading-tight" style={{ color: 'var(--text-color)' }}>
                  Khóa học chưa khai giảng!
                </h1>
                <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 font-semibold max-w-lg mx-auto leading-relaxed" style={{ color: 'var(--text-light)' }}>
                  Cảm ơn bạn đã quan tâm đến khóa học <strong>{course?.title}</strong>.
                  Hiện tại lớp học này chưa đến giờ mở, vui lòng quay lại khi đồng hồ đếm ngược kết thúc.
                </p>
              </div>

              {/* Countdown Numbers Grid */}
              <div className="grid grid-cols-4 gap-3 md:gap-4 max-w-md mx-auto pt-4 pb-2">
                {[
                  { label: 'Ngày', value: countdown.days },
                  { label: 'Giờ', value: countdown.hours },
                  { label: 'Phút', value: countdown.minutes },
                  { label: 'Giây', value: countdown.seconds }
                ].map((item, index) => (
                  <div
                    key={index}
                    className="flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-700/80 p-3 md:p-4.5 rounded-2xl shadow-inner"
                    style={{ backgroundColor: 'var(--bg-color)', borderColor: 'var(--border-color)' }}
                  >
                    <span className="text-2xl md:text-3xl font-black text-smart-indigo dark:text-indigo-400">
                      {String(item.value).padStart(2, '0')}
                    </span>
                    <span className="text-[10px] md:text-xs font-bold text-slate-400 dark:text-slate-505 uppercase tracking-wider mt-1">
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>

              {/* Expected Start Date Banner */}
              <div className="inline-block px-5 py-2.5 bg-amber-500/5 border border-amber-500/20 rounded-xl text-amber-700 dark:text-amber-405 text-xs md:text-sm font-extrabold max-w-md mx-auto">
                📅 Lịch khai giảng dự kiến: {startDate ? startDate.toLocaleDateString('vi-VN', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                }) : 'Đang cập nhật'}
              </div>

              <div className="pt-4 flex flex-col sm:flex-row gap-4 justify-center max-w-xs md:max-w-md mx-auto">
                <button
                  onClick={() => navigate('/courses')}
                  className="flex-1 py-3 px-6 bg-smart-indigo hover:bg-indigo-650 text-white font-bold text-xs uppercase rounded-xl tracking-wider active:scale-95 transition-all cursor-pointer shadow-md flex items-center justify-center gap-2"
                >
                  Khám phá khóa học khác
                </button>
                <button
                  onClick={() => navigate('/')}
                  className="flex-1 py-3 px-6 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-650 border border-slate-200 dark:border-slate-650 text-slate-750 dark:text-slate-200 font-bold text-xs uppercase rounded-xl tracking-wider active:scale-95 transition-all cursor-pointer flex items-center justify-center"
                  style={{ backgroundColor: 'var(--bg-color)', color: 'var(--text-color)', borderColor: 'var(--border-color)' }}
                >
                  Quay lại trang chủ
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

              {/* Left Area - 65%-70% (xl: 8 cols, lg: 7 cols) */}
              <div className="col-span-1 lg:col-span-7 xl:col-span-8 flex flex-col space-y-6">
                {!isDetailResolved ? (
                  <div className="w-full flex flex-col space-y-6 animate-pulse" style={{ opacity: 0.8 }}>
                    {/* Video/Document Block Skeleton */}
                    <div className="rounded-2xl overflow-hidden aspect-video border border-slate-200 dark:border-slate-800 shadow-md relative" style={{ backgroundColor: 'var(--card-bg, #cbd5e1)', opacity: 0.3 }}></div>
                    {/* Title and metadata skeleton */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ height: '28px', width: '60%', backgroundColor: 'var(--border-color, #cbd5e1)', borderRadius: '6px', opacity: 0.3 }}></div>
                      <div style={{ height: '18px', width: '40%', backgroundColor: 'var(--border-color, #cbd5e1)', borderRadius: '6px', opacity: 0.3 }}></div>
                    </div>
                  </div>
                ) : currentLesson?.type === 'quiz' || currentLesson?.type === 'quizz' ? (
                  <div className="w-full flex flex-col space-y-6">
                    <QuizContent
                      lessonId={currentLesson?.id ? currentLesson.id.replace('quiz-', '') : ''}
                      onComplete={async (score, total) => {
                        // Nếu đạt tối thiểu 50% số điểm (ví dụ: làm đúng 3/5 câu), tự động đánh dấu hoàn thành bài học tức thì < 50ms
                        if (score >= total / 2 && !currentLesson?.completed) {
                          try {
                            const fakeEvent = { stopPropagation: () => { } };
                            await handleToggleComplete(fakeEvent, currentLesson.id);
                          } catch (err) {
                            console.error("Lỗi tự động hoàn thành bài học khi làm trắc nghiệm:", err);
                          }
                        }
                      }}
                    />
                  </div>
                ) : currentLesson?.type === 'speaking' ? (
                  <div className="w-full flex flex-col space-y-6">
                    <SpeakingExercise
                      lessonId={currentLesson?.id ? currentLesson.id.replace('speaking-', '') : ''}
                      speakingSentences={currentLesson.speakingSentences}
                      speakingQuestions={currentLesson.speakingQuestions}
                      onComplete={async () => {
                        if (!currentLesson?.completed) {
                          try {
                            const fakeEvent = { stopPropagation: () => { } };
                            await handleToggleComplete(fakeEvent, currentLesson.id);
                          } catch (err) {
                            console.error("Lỗi tự động hoàn thành bài học khi luyện nói:", err);
                          }
                        }
                      }}
                    />
                  </div>
                ) : (
                  <div className="w-full flex flex-col space-y-6">

                    {/* Premium Video/Document Container with Layer 1 & Layer 2 Security Protections */}
                    <div
                      ref={containerRef}
                      className={`rounded-2xl overflow-hidden border border-slate-800 shadow-lg relative group select-none ${
                        isPdfLesson
                          ? 'w-full min-h-[580px] lg:h-[calc(100vh-110px)] bg-slate-900'
                          : 'bg-black aspect-video'
                      }`}
                      onContextMenu={(e) => e.preventDefault()}
                      onDragStart={(e) => e.preventDefault()}
                    >
                      {/* Netflix DRM Pure Pitch Black Surface Layer (#000000 Pitch Black Box - Đen thẩm tuyệt đối, không icon, không chữ) */}
                      <div
                        id="netflix-drm-blackout-shield"
                        style={{ display: isScreenRecordingDetected ? 'block' : 'none' }}
                        className="absolute inset-0 bg-black z-[9999] select-none cursor-default"
                        onClick={restoreDrmVideo}
                      />

                      {/* Media Wrapper Element for 0ms Instant Synchronous Blackout Removal */}
                      <div
                        id="lesson-media-wrapper"
                        style={{ display: isScreenRecordingDetected ? 'none' : 'block' }}
                        className="w-full h-full relative"
                      >
                        {currentLesson?.type === 'pdf' ? (
                          <React.Suspense
                            fallback={
                              <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center gap-4 bg-slate-900 text-slate-300">
                                <div className="w-10 h-10 border-4 border-slate-700 border-t-rose-500 rounded-full animate-spin"></div>
                                <span className="text-xs font-semibold">Đang chuẩn bị trình đọc PDF...</span>
                              </div>
                            }
                          >
                            <PdfStudyViewer
                              key={currentLesson?.id || 'pdf-viewer'}
                              pdfUrl={currentLesson.pdfUrl}
                              title={currentLesson.title}
                              user={user}
                              notes={pdfNotes}
                              selectedNoteId={selectedPdfNoteId}
                              activeGlowNoteId={activeGlowNoteId}
                              activePage={activePdfPage}
                              isAreaSelectionMode={isAreaSelectionMode}
                              onToggleAreaSelection={(val) => setIsAreaSelectionMode(val)}
                              onPageChange={(p) => setActivePdfPage(p)}
                              onCreateNote={handleCreatePdfNote}
                              onSelectNote={handleNavigateToPdfNote}
                            />
                          </React.Suspense>
                        ) : currentLesson?.videoUrl ? (
                          <>
                            {videoError ? (
                              <div className="w-full h-full flex flex-col items-center justify-center bg-slate-950 text-slate-200 p-6 text-center select-none">
                                <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-4 text-2xl shadow-lg">
                                  ⚠️
                                </div>
                                <h3 className="text-base sm:text-lg font-bold text-white mb-2">
                                  Không thể phát video bài học
                                </h3>
                                <p className="text-xs sm:text-sm text-slate-400 max-w-md mb-5 leading-relaxed">
                                  {videoError.message || 'Tệp video nguồn có thể chưa được tải lên hoặc đường dẫn không còn tồn tại.'}
                                </p>
                                <button
                                  type="button"
                                  onClick={handleRetryVideo}
                                  className="px-5 py-2.5 bg-smart-indigo hover:bg-indigo-600 text-white font-bold text-xs rounded-xl shadow-md transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
                                >
                                  <span>🔄 Thử tải lại video</span>
                                </button>
                              </div>
                            ) : (
                              <>
                                {videoLoading && (
                                  <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center z-10 rounded-2xl overflow-hidden gap-4 pointer-events-none">
                                    <div className="w-10 h-10 border-4 border-slate-700 border-t-teal-400 rounded-full animate-spin"></div>
                                    <span className="text-xs font-semibold text-teal-300 tracking-wider">Đang tải video...</span>
                                  </div>
                                )}

                                {/* Floating Smart Subtitle [CC] Pill on Video Player */}
                                <div className="absolute top-3 right-3 z-30 flex items-center gap-1.5 pointer-events-auto">
                                  <div className="relative">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setIsCaptionMenuOpen(!isCaptionMenuOpen);
                                      }}
                                      title="Tùy chọn Phụ đề Song ngữ (Captions)"
                                      className={`px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 backdrop-blur-md border transition-all cursor-pointer shadow-lg ${
                                        captionMode !== 'off'
                                          ? 'bg-teal-500/80 hover:bg-teal-500 text-white border-teal-400/40 shadow-teal-500/20'
                                          : 'bg-black/60 hover:bg-black/80 text-slate-300 border-white/10'
                                      }`}
                                    >
                                      <FiGlobe className="text-xs" />
                                      <span>CC {captionMode === 'bilingual' ? 'Song ngữ' : captionMode === 'en' ? 'EN' : captionMode === 'vi' ? 'VI' : 'Tắt'}</span>
                                    </button>

                                    {isCaptionMenuOpen && (
                                      <div
                                        onClick={(e) => e.stopPropagation()}
                                        className="absolute right-0 mt-1.5 w-48 bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 rounded-2xl shadow-2xl p-1.5 z-40 text-xs flex flex-col gap-1 animate-fade-in"
                                      >
                                        <button
                                          type="button"
                                          onClick={() => { setCaptionMode('bilingual'); setIsCaptionMenuOpen(false); }}
                                          className={`w-full text-left px-3 py-1.5 rounded-xl font-medium flex items-center justify-between transition-all cursor-pointer ${
                                            captionMode === 'bilingual' ? 'bg-teal-500/20 text-teal-300 font-bold' : 'text-slate-300 hover:bg-slate-800'
                                          }`}
                                        >
                                          <span>✨ Song ngữ (EN - VI)</span>
                                          {captionMode === 'bilingual' && <span className="w-1.5 h-1.5 rounded-full bg-teal-400"></span>}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => { setCaptionMode('en'); setIsCaptionMenuOpen(false); }}
                                          className={`w-full text-left px-3 py-1.5 rounded-xl font-medium flex items-center justify-between transition-all cursor-pointer ${
                                            captionMode === 'en' ? 'bg-teal-500/20 text-teal-300 font-bold' : 'text-slate-300 hover:bg-slate-800'
                                          }`}
                                        >
                                          <span>🇬🇧 Tiếng Anh (English)</span>
                                          {captionMode === 'en' && <span className="w-1.5 h-1.5 rounded-full bg-teal-400"></span>}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => { setCaptionMode('vi'); setIsCaptionMenuOpen(false); }}
                                          className={`w-full text-left px-3 py-1.5 rounded-xl font-medium flex items-center justify-between transition-all cursor-pointer ${
                                            captionMode === 'vi' ? 'bg-teal-500/20 text-teal-300 font-bold' : 'text-slate-300 hover:bg-slate-800'
                                          }`}
                                        >
                                          <span>🇻🇳 Tiếng Việt</span>
                                          {captionMode === 'vi' && <span className="w-1.5 h-1.5 rounded-full bg-teal-400"></span>}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => { setCaptionMode('off'); setIsCaptionMenuOpen(false); }}
                                          className={`w-full text-left px-3 py-1.5 rounded-xl font-medium flex items-center justify-between transition-all cursor-pointer ${
                                            captionMode === 'off' ? 'bg-rose-500/20 text-rose-300 font-bold' : 'text-slate-400 hover:bg-slate-800'
                                          }`}
                                        >
                                          <span>🚫 Tắt phụ đề</span>
                                          {captionMode === 'off' && <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>}
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                <video
                                  ref={videoRef}
                                  src={ticketPlaybackUrl || undefined}
                                  controls
                                  autoPlay
                                  preload="auto"
                                  controlsList="nodownload noremoteplayback nofullscreen"
                                  disablePictureInPicture
                                  disableRemotePlayback
                                  onClick={toggleVideoPlayPause}
                                  onTimeUpdate={(e) => setVideoCurrentTime(e.target.currentTime)}
                                  onContextMenu={(e) => e.preventDefault()}
                                  onDragStart={(e) => e.preventDefault()}
                                  onPlay={() => { setVideoLoading(false); setIsVideoPlaying(true); }}
                                  onPlaying={() => { setVideoLoading(false); setIsVideoPlaying(true); }}
                                  onPause={() => setIsVideoPlaying(false)}
                                  onEnded={() => setIsVideoPlaying(false)}
                                  onLoadedData={() => setVideoLoading(false)}
                                  onLoadedMetadata={() => setVideoLoading(false)}
                                  onCanPlay={() => setVideoLoading(false)}
                                  onWaiting={() => setVideoLoading(true)}
                                  onError={handleVideoError}
                                  className="w-full h-full object-contain pointer-events-auto cursor-pointer"
                                  data-no-download="true"
                                />

                                {/* Dynamic Video Forensic Security Watermark Badge */}
                                <div className={`absolute ${WATERMARK_POSITIONS[watermarkPosIndex]} pointer-events-none z-30 opacity-20 select-none font-mono text-[9px] sm:text-[10px] text-white bg-black/60 border border-white/20 px-2 py-0.5 rounded-full shadow-sm backdrop-blur-md flex items-center gap-1.5 transition-all duration-700 ease-in-out`}>
                                  <span>🔒 E-Learn Academy • {user?.email || 'Unknown User'}</span>
                                  <span className="text-white/40">•</span>
                                  <span>ID: {user?.id || user?.userId || currentUserId || 'N/A'}</span>
                                  <span className="text-white/40">•</span>
                                  <span className="text-emerald-300 font-bold">[{formatWatermarkTimestamp(videoCurrentTime)}]</span>
                                </div>

                                {/* Smart AI Bilingual Caption Overlay */}
                                <CaptionOverlay
                                  cues={subtitleData?.cues || []}
                                  currentTime={videoCurrentTime}
                                  mode={captionMode}
                                />
                              </>
                            )}
                          </>
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 bg-slate-900">
                            <FiPlay className="text-5xl animate-pulse mb-3" />
                            <span>Bài học không khả dụng.</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Lesson Details & Interactive Content */}
                    <div className="rounded-2xl border p-6 shadow-sm" style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)' }}>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b mb-6" style={{ borderBottomColor: 'var(--border-color)' }}>
                        <div>
                          <span className="text-[11px] font-bold uppercase tracking-wider text-smart-indigo bg-smart-indigo/5 px-2.5 py-1 rounded-md mb-2 inline-block">
                            Bài học chi tiết
                          </span>
                          <h1 className="text-lg sm:text-xl font-bold text-slate-800 dark:text-slate-100 mt-1" style={{ color: 'var(--text-color)' }}>
                            {currentLesson?.title}
                          </h1>
                        </div>

                        <button
                          onClick={(e) => handleToggleComplete(e, currentLesson?.id)}
                          style={{
                            backgroundColor: currentLesson?.completed ? 'rgba(16, 185, 129, 0.1)' : 'var(--card-bg)',
                            color: currentLesson?.completed ? '#10b981' : 'var(--text-color)',
                            borderColor: currentLesson?.completed ? 'rgba(16, 185, 129, 0.3)' : 'var(--border-color)',
                          }}
                          className="mt-3 sm:mt-0 flex items-center justify-center space-x-2 text-xs font-semibold px-4 py-2.5 rounded-xl transition-all border shrink-0 hover:opacity-90"
                        >
                          {currentLesson?.completed ? (
                            <>
                              <FiCheckSquare className="text-sm text-emerald-600" />
                              <span>Đã hoàn thành</span>
                            </>
                          ) : (
                            <>
                              <FiSquare className="text-sm" />
                              <span>Đánh dấu hoàn thành</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* Left Tabs Navigation */}
                      <div className="flex border-b space-x-6 text-sm mb-4 shrink-0" style={{ borderBottomColor: 'var(--border-color)' }}>
                        <button
                          onClick={() => setActiveLeftTab("syllabus")}
                          style={{ color: activeLeftTab === "syllabus" ? "#3b82f6" : "var(--text-light)" }}
                          className="pb-3.5 font-semibold transition-all relative"
                        >
                          <span>Giáo trình văn bản</span>
                          {activeLeftTab === "syllabus" && (
                            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full"></span>
                          )}
                        </button>

                        <button
                          onClick={() => setActiveLeftTab("resources")}
                          style={{ color: activeLeftTab === "resources" ? "#3b82f6" : "var(--text-light)" }}
                          className="pb-3.5 font-semibold transition-all relative"
                        >
                          <span>Tài liệu đính kèm ({currentLesson?.resources?.length || 0})</span>
                          {activeLeftTab === "resources" && (
                            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full"></span>
                          )}
                        </button>


                      </div>

                      {/* Left Tabs Content */}
                      <div className="min-h-[180px]">
                        {activeLeftTab === "syllabus" && (
                          <div className="text-sm leading-relaxed whitespace-pre-wrap animate-fade" style={{ color: 'var(--text-color)' }}>
                            <p className="font-semibold text-[14.5px] mb-3" style={{ color: 'var(--text-color)' }}>Tóm tắt nội dung bài học:</p>
                            <p className="mb-4 italic px-4 py-3 rounded-xl border" style={{ backgroundColor: 'var(--bg-color)', borderColor: 'var(--border-color)', color: 'var(--text-light)' }}>
                              {currentLesson?.description}
                            </p>
                            <div className="border p-4 rounded-xl shadow-inner text-[14px]" style={{ backgroundColor: 'var(--bg-color)', borderColor: 'var(--border-color)', color: 'var(--text-color)' }}>
                              {currentLesson?.content}
                            </div>
                          </div>
                        )}

                        {activeLeftTab === "resources" && (
                          <div className="space-y-3 animate-fade text-sm">
                            {currentLesson?.resources && currentLesson.resources.length > 0 ? (
                              currentLesson.resources.map((res, index) => (
                                <div
                                  key={index}
                                  className="flex items-center justify-between p-3.5 border rounded-xl hover:opacity-90 transition-colors shadow-sm"
                                  style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)' }}
                                >
                                  <div className="flex items-center space-x-3 overflow-hidden pr-3">
                                    <FiFileText className="text-smart-indigo text-lg shrink-0" />
                                    <div className="flex flex-col min-w-0">
                                      <span className="font-medium truncate" style={{ color: 'var(--text-color)' }}>{res.name}</span>
                                      {res.sizeKb > 0 && (
                                        <span className="text-[11px] opacity-60">
                                          {res.sizeKb >= 1024 ? `${(res.sizeKb / 1024).toFixed(1)} MB` : `${res.sizeKb} KB`}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <a
                                    href={res.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    download={res.name || true}
                                    className="flex items-center space-x-1 text-xs font-semibold text-smart-indigo hover:text-smart-indigo-hover bg-smart-indigo/5 hover:bg-smart-indigo/10 px-3 py-1.5 rounded-lg transition-colors shrink-0"
                                  >
                                    <FiDownload />
                                    <span>Tải xuống</span>
                                  </a>
                                </div>
                              ))
                            ) : (
                              <div className="text-center py-8 text-slate-400">
                                <FiBookOpen className="mx-auto text-3xl mb-2 text-slate-300" />
                                <p>Bài học này không đính kèm tài liệu bên ngoài.</p>
                              </div>
                            )}
                          </div>
                        )}


                      </div>
                    </div>
                  </div>
                )}
              </div>{/* end left area opacity wrapper */}

              {/* Right Sidebar Area - 35%-40% (xl: 4 cols, lg: 5 cols, desktop width ~440-480px, mobile 580px container) */}
              <div className="col-span-1 lg:col-span-5 xl:col-span-4 flex flex-col min-h-[520px] h-[580px] lg:h-[calc(100vh-110px)] lg:sticky lg:top-20 border rounded-2xl overflow-hidden shadow-sm transition-all duration-300" style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)' }}>

                {/* Sidebar Tabs Headers */}
                <div className="flex border-b shrink-0" style={{ backgroundColor: 'var(--bg-color)', borderBottomColor: 'var(--border-color)' }}>
                  <button
                    type="button"
                    onClick={() => setActiveRightTab("playlist")}
                    style={{
                      borderBottomColor: activeRightTab === "playlist" ? "#3b82f6" : "transparent",
                      color: activeRightTab === "playlist" ? "#3b82f6" : "var(--text-light)",
                      backgroundColor: activeRightTab === "playlist" ? "var(--card-bg)" : "var(--bg-color)",
                    }}
                    className="flex-1 py-3 text-[11px] font-bold uppercase tracking-wider flex items-center justify-center space-x-1 border-b-2 transition-all font-extrabold"
                  >
                    <FiBookOpen className="text-[12px]" />
                    <span>Bài học</span>
                  </button>

                  {isPdfLesson ? (
                    <button
                      type="button"
                      onClick={() => setActiveRightTab("notes")}
                      style={{
                        borderBottomColor: activeRightTab === "notes" ? "#f59e0b" : "transparent",
                        color: activeRightTab === "notes" ? "#f59e0b" : "var(--text-light)",
                        backgroundColor: activeRightTab === "notes" ? "var(--card-bg)" : "var(--bg-color)",
                      }}
                      className="flex-1 py-3 text-[11px] font-bold uppercase tracking-wider flex items-center justify-center space-x-1 border-b-2 transition-all font-extrabold"
                    >
                      <FiFileText className="text-[12px]" />
                      <span>Ghi chú</span>
                      {pdfNotes.length > 0 && (
                        <span className="ml-1 px-1.5 py-0.2 rounded-full text-[9.5px] bg-amber-500/20 text-amber-600 dark:text-amber-300 font-black">
                          {pdfNotes.length}
                        </span>
                      )}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setActiveRightTab("transcript")}
                      style={{
                        borderBottomColor: activeRightTab === "transcript" ? "#14b8a6" : "transparent",
                        color: activeRightTab === "transcript" ? "#14b8a6" : "var(--text-light)",
                        backgroundColor: activeRightTab === "transcript" ? "var(--card-bg)" : "var(--bg-color)",
                      }}
                      className="flex-1 py-3 text-[11px] font-bold uppercase tracking-wider flex items-center justify-center space-x-1 border-b-2 transition-all font-extrabold"
                    >
                      <FiGlobe className="text-[12px]" />
                      <span>Phụ đề AI</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setActiveRightTab("ai")}
                    style={{
                      borderBottomColor: activeRightTab === "ai" ? "#3b82f6" : "transparent",
                      color: activeRightTab === "ai" ? "#3b82f6" : "var(--text-light)",
                      backgroundColor: activeRightTab === "ai" ? "var(--card-bg)" : "var(--bg-color)",
                    }}
                    className="flex-1 py-3 text-[11px] font-bold uppercase tracking-wider flex items-center justify-center space-x-1 border-b-2 transition-all font-extrabold"
                  >
                    <FiCpu className="text-[12px]" />
                    <span>AI Chat</span>
                  </button>
                </div>

                {/* Sidebar Content Panel */}
                <div className="flex-1 overflow-hidden h-full relative" style={{ backgroundColor: 'var(--card-bg)' }}>

                  {/* Playlist View */}
                  {activeRightTab === "playlist" && course && (
                    <div className="h-full overflow-y-auto px-4 py-4 space-y-4">
                      {course.sections.map((sec) => {
                        const isExpanded = !!expandedSections[sec.id];
                        return (
                          <div key={sec.id} className="border rounded-xl overflow-hidden shadow-sm" style={{ borderColor: 'var(--border-color)' }}>
                            {/* Section Header Accordion */}
                            <div
                              onClick={() => toggleSection(sec.id)}
                              className="flex items-center justify-between px-3.5 py-3 hover:bg-slate-100/80 transition-colors cursor-pointer border-b"
                              style={{ backgroundColor: 'var(--bg-color)', borderBottomColor: 'var(--border-color)' }}
                            >
                              <h3 className="font-bold text-xs leading-snug pr-2" style={{ color: 'var(--text-color)' }}>
                                {sec.title}
                              </h3>
                              <span className="text-slate-400 shrink-0">
                                {isExpanded ? <FiChevronUp /> : <FiChevronDown />}
                              </span>
                            </div>

                            {/* Section Lessons List */}
                            {isExpanded && (
                              <div className="divide-y" style={{ backgroundColor: 'var(--card-bg)', divideColor: 'var(--border-color)' }}>
                                {sec.lessons.map((lesson) => {
                                  const isActive = String(targetLessonId) === String(lesson.id);
                                  const isQuiz = lesson.type === 'quiz';
                                  const isSpeaking = lesson.type === 'speaking';
                                  const isSubLesson = isQuiz || isSpeaking;
                                  return (
                                    <div
                                      key={lesson.id}
                                      onClick={() => handleSelectLesson(lesson.id)}
                                      style={{
                                        backgroundColor: isActive ? 'rgba(29, 78, 216, 0.08)' : (isSubLesson ? 'rgba(99, 102, 241, 0.03)' : 'transparent'),
                                        borderColor: isActive ? '#3b82f6' : (isSubLesson ? 'rgba(99, 102, 241, 0.2)' : 'transparent'),
                                      }}
                                      className={`flex items-start px-3.5 py-3 transition-colors cursor-pointer rounded-lg border-l-4 ${isSubLesson ? 'ml-4 border-dashed' : 'border-transparent'
                                        } hover:opacity-90`}
                                    >
                                      {/* Completion Checkbox */}
                                      <button
                                        type="button"
                                        onClick={(e) => handleToggleComplete(e, lesson.id)}
                                        className="mr-3 text-slate-400 hover:text-smart-indigo transition-colors flex-shrink-0 cursor-pointer pt-0.5"
                                        title={lesson.completed ? "Đã hoàn thành (Bấm để hủy)" : "Chưa hoàn thành (Bấm để đánh dấu)"}
                                      >
                                        {lesson.completed ? (
                                          <FiCheckSquare className="text-emerald-500 text-lg" />
                                        ) : (
                                          <FiSquare className="text-slate-400 hover:text-slate-600 text-lg" />
                                        )}
                                      </button>

                                      <div className="flex-grow min-w-0 pr-2">
                                        <div className="flex items-center space-x-2">
                                          <span
                                            className={`text-xs font-semibold leading-tight line-clamp-2 ${isActive ? 'text-smart-indigo font-bold' : ''
                                              }`}
                                            style={{ color: isActive ? '#3b82f6' : 'var(--text-color)' }}
                                          >
                                            {lesson.title}
                                          </span>
                                        </div>

                                        <div className="flex items-center space-x-3 mt-1.5 text-[11px] opacity-70">
                                          <span className="flex items-center space-x-1">
                                            {lesson.type === 'speaking' ? (
                                              <FiMic className="text-smart-indigo" />
                                            ) : lesson.type === 'pdf' ? (
                                              <FiFileText className="text-amber-500" />
                                            ) : (
                                              <FiPlay className="text-emerald-500" />
                                            )}
                                            <span>{lesson.duration}</span>
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* PDF Notes View */}
                  {activeRightTab === "notes" && isPdfLesson && (
                    <div className="h-full">
                      <React.Suspense
                        fallback={
                          <div className="flex items-center justify-center p-8 text-slate-400 text-xs">
                            Đang tải ghi chú...
                          </div>
                        }
                      >
                        <PdfNotesPanel
                          notes={pdfNotes}
                          isLoading={isPdfNotesLoading}
                          selectedNoteId={selectedPdfNoteId}
                          isAreaSelectionMode={isAreaSelectionMode}
                          onTriggerAreaSelection={() => setIsAreaSelectionMode((prev) => !prev)}
                          onNavigateToNote={handleNavigateToPdfNote}
                          onUpdateNote={handleUpdatePdfNote}
                          onDeleteNote={handleDeletePdfNote}
                        />
                      </React.Suspense>
                    </div>
                  )}

                  {/* Smart AI Interactive Transcript View */}
                  {activeRightTab === "transcript" && !isPdfLesson && (
                    <div className="h-full p-2">
                      <InteractiveTranscript
                        cues={subtitleData?.cues || []}
                        currentTime={videoCurrentTime}
                        onSeek={handleSeekVideo}
                        onGenerateSubtitles={handleGenerateSubtitles}
                        isGenerating={isGeneratingSubtitles}
                        lessonTitle={currentLesson?.title || ''}
                      />
                    </div>
                  )}

                  {/* AI Assistant ChatBox View */}
                  {activeRightTab === "ai" && (
                    <div className="h-full p-2">
                      <ErrorBoundary title="Không thể kết nối với Trợ lý AI" message="Khung hội thoại RAG AI đang tạm thời gián đoạn. Bạn vẫn có thể tiếp tục học bài giảng bằng video bình thường.">
                        <ChatBox 
                          lessonId={targetLessonId || currentLesson?.id} 
                          lessonTitle={currentLesson?.title || ''}
                          currentTime={videoCurrentTime} 
                          onSeekVideo={handleSeekVideo} 
                        />
                      </ErrorBoundary>
                    </div>
                  )}
                </div>
              </div>

            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default LessonDetailPage;
