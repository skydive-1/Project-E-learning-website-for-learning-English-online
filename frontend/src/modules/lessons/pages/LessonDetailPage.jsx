import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import {
  FiPlay, FiCheckSquare, FiSquare, FiFileText,
  FiArrowLeft, FiChevronDown, FiChevronUp, FiAward,
  FiBookOpen, FiDownload, FiCpu, FiClock, FiMic, FiGlobe
} from 'react-icons/fi';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Header from '../../../components/common/Header';
import Footer from '../../../components/common/Footer';
import { useAuth } from '../../../context/AuthContext';
import ChatBox from '../../chatbot/components/ChatBox';
import ErrorBoundary from '../../../components/common/ErrorBoundary';
import QuizContent from '../components/QuizContent';
import SpeakingExercise from '../components/SpeakingExercise';
import CaptionOverlay from '../components/CaptionOverlay';
import InteractiveTranscript from '../components/InteractiveTranscript';
import useStudyTimeTracker from '../hooks/useStudyTimeTracker';
import { subtitlesService } from '../services/subtitles.service';
import shaka from 'shaka-player';
import {
  getCourseDetails,
  getLessonById,
  toggleLessonCompletion
} from '../services/lessons.service';

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

  const userRole = parseInt(user?.roleId || user?.role_id || user?.role, 10);
  const currentUserId = user?.userId || user?.user_id || user?.id;

  // States
  const [activeRightTab, setActiveRightTab] = useState("playlist"); // "playlist" or "ai"
  const [activeLeftTab, setActiveLeftTab] = useState("syllabus"); // "syllabus" or "resources"
  const [expandedSections, setExpandedSections] = useState({});
  const [optimisticLessonId, setOptimisticLessonId] = useState(null);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [blobVideoUrl, setBlobVideoUrl] = useState(null);

  // Countdown timer state
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  // Video & Screen Recording Protection States
  const [videoLoading, setVideoLoading] = useState(false);
  const [isScreenRecordingDetected, setIsScreenRecordingDetected] = useState(false);
  // Smart AI Subtitles & Interactive Bilingual Transcript States
  const [subtitleData, setSubtitleData] = useState(null);
  const [captionMode, setCaptionMode] = useState('off'); // 'off' | 'en' | 'vi' | 'bilingual' (Mặc định tắt phụ đề, người dùng bật khi có nhu cầu)
  const [videoCurrentTime, setVideoCurrentTime] = useState(0);
  const [isGeneratingSubtitles, setIsGeneratingSubtitles] = useState(false);
  const [isCaptionMenuOpen, setIsCaptionMenuOpen] = useState(false);

  // Refs for DRM and Video Control
  const blackoutLockUntilRef = useRef(0);
  const restoreTimeoutRef = useRef(null);

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

  // ⚡ ĐỘNG CƠ CÔ LẬP MÀN HÌNH ĐEN DRM PHẢN HỒI TỨC THÌ CHUẨN APPLE / NETFLIX (Real-Time Reactive DRM Engine)
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
    setRecordingDetectedMessage('');

    if (videoRef.current) {
      try {
        videoRef.current.style.opacity = '1';
        videoRef.current.style.visibility = 'visible';
      } catch (_) {}
    }
  };

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

  // ⚡ TỰ ĐỘNG NẠP TRƯỚC BỘ NHỚ ĐỆM CLIENT (Client Memory Prefetching Engine)
  // Khi khóa học tải xong, tự động nạp tất cả bài học vào React Query cache để người dùng click chuyển bài tức thì (< 10ms)
  useEffect(() => {
    if (course?.sections) {
      course.sections.forEach((sec) => {
        sec.lessons.forEach((l) => {
          queryClient.setQueryData(['lesson', l.id], (old) => old || l);
          queryClient.prefetchQuery({
            queryKey: ['lesson', l.id],
            queryFn: () => getLessonById(l.id),
            staleTime: 1000 * 60 * 15
          });
        });
      });
    }
  }, [course, queryClient]);

  // Đồng bộ optimistic state với URL params khi navigate
  useEffect(() => {
    setOptimisticLessonId(lessonId || null);
  }, [lessonId]);

  // 4. Tải chi tiết bài học hiện tại với placeholderData để tránh giật lag UI khi chuyển bài
  const { data: currentLesson, isLoading: lessonLoading, isFetching: lessonFetching } = useQuery({
    queryKey: ['lesson', targetLessonId],
    queryFn: () => getLessonById(targetLessonId),
    enabled: !!targetLessonId,
    staleTime: 1000 * 60 * 15,
    placeholderData: (previousData) => previousData
  });

  const isLessonLoading = lessonLoading || (lessonFetching && String(currentLesson?.id) !== String(targetLessonId));

  const isLoading = (lessonId && !initialLessonData) || courseLoading || (targetLessonId && isLessonLoading);

  // Real-time Study Time Tracker: Tự động ghi nhận từng phút học thực tế vào Heatmap
  const isSpeakingLesson = String(targetLessonId).startsWith('speaking-') || !!currentLesson?.speakingSentences || !!currentLesson?.speakingQuestions;
  const isPdfLesson = currentLesson?.type === 'pdf';
  const isQuizLesson = String(targetLessonId).startsWith('quiz-') || !!currentLesson?.quizId;
  const activeActivityType = isQuizLesson ? 'quiz' : isSpeakingLesson ? 'speaking' : isPdfLesson ? 'pdf' : 'video';

  useStudyTimeTracker(targetLessonId, isVideoPlaying, activeActivityType);

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

  // Tua video đến thời gian mong muốn từ Interactive Transcript
  const handleSeekVideo = (seconds) => {
    if (videoRef.current) {
      videoRef.current.currentTime = seconds;
      if (videoRef.current.paused) {
        videoRef.current.play().catch(() => {});
        setIsVideoPlaying(true);
      }
    }
  };

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

  // Video loading state — browser tự stream qua HTTP Range Requests, không cần tải trước
  // 🛡️ BỘ NẠP VIDEO BẢO MẬT CHỐNG IDM & DOWNLOAD MANAGERS (Blob RAM Memory Masking & W3C ClearKey DRM)
  useEffect(() => {
    const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
    const rawVideoUrl = currentLesson?.videoUrl;

    if (!rawVideoUrl) {
      setBlobVideoUrl(null);
      setVideoLoading(false);
      return;
    }

    let active = true;
    let createdBlobUrl = null;

    const isDashOrHls = rawVideoUrl.includes('.mpd') || rawVideoUrl.includes('.m3u8');

    // 1. Đối với luồng MPEG-DASH / HLS: Nạp qua Shaka Player với W3C ClearKey DRM
    if (isDashOrHls) {
      if (shaka.Player && shaka.Player.isBrowserSupported() && videoRef.current) {
        if (shakaPlayerRef.current && shakaAttachedToRef.current !== videoRef.current) {
          shakaPlayerRef.current.destroy().catch(() => {});
          shakaPlayerRef.current = null;
          shakaAttachedToRef.current = null;
        }

        if (!shakaPlayerRef.current) {
          const player = new shaka.Player(videoRef.current);
          shakaPlayerRef.current = player;
          shakaAttachedToRef.current = videoRef.current;

          const token = localStorage.getItem('token') || localStorage.getItem('auth_token');
          if (token) {
            player.getNetworkingEngine().registerRequestFilter((type, request) => {
              if (type === shaka.net.NetworkingEngine.RequestType.LICENSE) {
                request.headers['Authorization'] = `Bearer ${token}`;
              }
            });
          }
        }

        const currentLessonId = currentLesson?.id || lessonId || 1;
        const licenseUrl = `${API_BASE_URL}/drm/license?lessonId=${currentLessonId}`;
        shakaPlayerRef.current.configure({
          drm: { servers: { 'org.w3.clearkey': licenseUrl } }
        });

        shakaPlayerRef.current.load(rawVideoUrl)
          .then(() => {
            if (active) setVideoLoading(false);
          })
          .catch(err => {
            console.warn('[Shaka DRM]: Lỗi nạp luồng DASH, fallback về Native Video:', err?.message || err);
            if (active && videoRef.current) {
              videoRef.current.src = rawVideoUrl;
              videoRef.current.load();
              setVideoLoading(false);
            }
          });
      }
      return;
    }

    // Nếu không phải luồng DASH/HLS DRM -> Hủy Shaka Player
    if (shakaPlayerRef.current) {
      shakaPlayerRef.current.destroy().catch(() => {});
      shakaPlayerRef.current = null;
      shakaAttachedToRef.current = null;
    }

    // 2. Đối với Video MP4 thông thường: Nạp qua In-Memory Blob Stream URL (Chống 100% IDM Sniffing)
    if (rawVideoUrl.startsWith('blob:')) {
      setBlobVideoUrl(rawVideoUrl);
      setVideoLoading(false);
      return;
    }

    const loadAntiIdmStream = async () => {
      try {
        setVideoLoading(true);
        const response = await fetch(rawVideoUrl, {
          headers: {
            'Accept': 'video/mp4,video/*;q=0.9,*/*;q=0.8'
          }
        });
        if (!response.ok) throw new Error(`HTTP error ${response.status}`);
        const blob = await response.blob();
        if (active) {
          createdBlobUrl = URL.createObjectURL(blob);
          setBlobVideoUrl(createdBlobUrl);
          setVideoLoading(false);
        }
      } catch (err) {
        // Fallback trực tiếp nếu fetch blob gặp lỗi CORS
        console.debug('[Anti-IDM DRM]: Streaming via direct channel:', err?.message);
        if (active) {
          setBlobVideoUrl(rawVideoUrl);
          setVideoLoading(false);
        }
      }
    };

    loadAntiIdmStream();

    return () => {
      active = false;
      if (createdBlobUrl) {
        URL.revokeObjectURL(createdBlobUrl);
      }
    };
  }, [currentLesson?.videoUrl, lessonId]);

  // Cleanup Shaka Player khi component unmount
  useEffect(() => {
    return () => {
      if (shakaPlayerRef.current) {
        shakaPlayerRef.current.destroy().catch(() => {});
        shakaPlayerRef.current = null;
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
            <div className="grid grid-cols-10 gap-6 items-start">

              {/* Left Area - 70% — Wrapper bọc ngoài để transition mượt khi chuyển bài */}
              <div
                className="col-span-10 lg:col-span-7 flex flex-col space-y-6"
                style={{
                  opacity: isLessonLoading ? 0.6 : 1,
                  transition: 'opacity 0.2s ease',
                  pointerEvents: isLessonLoading ? 'none' : 'auto'
                }}
              >
                {currentLesson?.type === 'quiz' || currentLesson?.type === 'quizz' ? (
                  <div className="col-span-10 lg:col-span-7 flex flex-col space-y-6">
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
                  <div className="col-span-10 lg:col-span-7 flex flex-col space-y-6">
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
                  <div className="col-span-10 lg:col-span-7 flex flex-col space-y-6">

                    {/* Premium Video/Document Container with Layer 1 & Layer 2 Security Protections */}
                    <div
                      ref={containerRef}
                      className="bg-black rounded-2xl overflow-hidden aspect-video border border-slate-800 shadow-lg relative group select-none"
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
                          <div className="w-full h-full relative" onContextMenu={(e) => e.preventDefault()}>
                            {/* PDF Security Watermark Badge */}
                            <div className="absolute bottom-4 right-4 pointer-events-none z-30 opacity-40 select-none font-mono text-[10px] sm:text-xs text-slate-800 bg-white/80 border border-slate-300 px-3 py-1 rounded-full shadow-md backdrop-blur-md flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping"></span>
                              <span>🔒 E-Learn Academy • {user?.email || 'quocanh26012004@gmail.com'}</span>
                              <span className="text-slate-400">•</span>
                              <span>ID: {user?.id || user?.userId || currentUserId || '4'}</span>
                            </div>

                            {/* PDF Diagonal Subtle Background Watermark */}
                            <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden flex items-center justify-center opacity-10 select-none rotate-[-25deg]">
                              <span className="font-mono text-xl sm:text-2xl font-extrabold text-slate-900 tracking-widest whitespace-nowrap">
                                {user?.email || 'quocanh26012004@gmail.com'} • E-LEARN ACADEMY COPYRIGHT
                              </span>
                            </div>

                            {/* PDF Embedded Document Viewer - Cho phép cuộn trang và tương tác đọc bài học */}
                            <iframe
                              key={currentLesson?.id || 'pdf'}
                              src={`${currentLesson.pdfUrl}#toolbar=0&navpanes=0`}
                              className="w-full h-full border-none bg-white pointer-events-auto"
                              title={currentLesson.title}
                              onContextMenu={(e) => e.preventDefault()}
                            />
                          </div>
                        ) : currentLesson?.videoUrl ? (
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
                              src={blobVideoUrl || undefined}
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
                              onError={() => { setVideoLoading(false); setIsVideoPlaying(false); }}
                              className="w-full h-full object-contain pointer-events-auto cursor-pointer"
                              data-no-download="true"
                            />

                            {/* Dynamic Video Forensic Security Watermark Badge */}
                            <div className="absolute top-3.5 left-3.5 pointer-events-none z-30 opacity-40 select-none font-mono text-[10px] sm:text-xs text-white bg-black/60 border border-white/20 px-2.5 py-1 rounded-full shadow-md backdrop-blur-md flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                              <span>🔒 E-Learn Academy • {user?.email || 'quocanh26012004@gmail.com'}</span>
                              <span className="text-white/40">•</span>
                              <span>ID: {user?.id || user?.userId || currentUserId || '4'}</span>
                            </div>

                            {/* Smart AI Bilingual Caption Overlay */}
                            <CaptionOverlay
                              cues={subtitleData?.cues || []}
                              currentTime={videoCurrentTime}
                              mode={captionMode}
                            />
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
                                  <div className="flex items-center space-x-3">
                                    <FiFileText className="text-smart-indigo text-lg shrink-0" />
                                    <span className="font-medium" style={{ color: 'var(--text-color)' }}>{res.name}</span>
                                  </div>
                                  <a
                                    href={res.url}
                                    className="flex items-center space-x-1 text-xs font-semibold text-smart-indigo hover:text-smart-indigo-hover bg-smart-indigo/5 hover:bg-smart-indigo/10 px-3 py-1.5 rounded-lg transition-colors"
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

              {/* Right Sidebar Area - 30% */}
              <div className="col-span-10 lg:col-span-3 flex flex-col h-[calc(100vh-140px)] lg:sticky lg:top-24 border rounded-2xl overflow-hidden shadow-sm" style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)' }}>

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
                                        onClick={(e) => handleToggleComplete(e, lesson.id)}
                                        className="mr-2.5 mt-0.5 text-slate-400 hover:text-emerald-500 transition-colors shrink-0"
                                      >
                                        {lesson.completed ? (
                                          <FiCheckSquare className="text-[14.5px] text-emerald-500" />
                                        ) : (
                                          <FiSquare className="text-[14.5px]" />
                                        )}
                                      </button>

                                      {/* Lesson Info */}
                                      <div className="flex-1 min-w-0">
                                        <p className="text-[12.5px] font-medium leading-relaxed mb-1 truncate-2-lines" style={{ color: isActive ? '#3b82f6' : 'var(--text-color)', fontWeight: isActive ? '700' : '500' }}>
                                          {lesson.title}
                                        </p>
                                        <div className="flex items-center text-[10px] text-slate-400 space-x-2">
                                          {isQuiz ? <FiCheckSquare /> : (isSpeaking ? <FiMic /> : <FiClock />)}
                                          <span>{lesson.duration}</span>
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

                  {/* Smart AI Interactive Transcript View */}
                  {activeRightTab === "transcript" && (
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
                        <ChatBox lessonId={targetLessonId || currentLesson?.id} />
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
