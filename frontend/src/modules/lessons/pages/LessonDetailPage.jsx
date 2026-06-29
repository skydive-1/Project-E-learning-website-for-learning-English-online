import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { 
  FiPlay, FiCheckSquare, FiSquare, FiFileText, 
  FiArrowLeft, FiChevronDown, FiChevronUp, FiAward, 
  FiBookOpen, FiDownload, FiCpu, FiClock 
} from 'react-icons/fi';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Header from '../../../components/common/Header';
import ChatBox from '../../chatbot/components/ChatBox';
import ErrorBoundary from '../../../components/common/ErrorBoundary';
import QuizContent from '../components/QuizContent';
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

  // States
  const [activeRightTab, setActiveRightTab] = useState("playlist"); // "playlist" or "ai"
  const [activeLeftTab, setActiveLeftTab] = useState("syllabus"); // "syllabus" or "resources"
  const [expandedSections, setExpandedSections] = useState({});

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

  // 3. Xác định targetLessonId thực tế (nếu URL không có lessonId, lấy bài đầu tiên của khóa học làm mặc định)
  const targetLessonId = lessonId || (course?.sections?.[0]?.lessons?.[0]?.id || null);

  // 4. Tải chi tiết bài học hiện tại để hiển thị
  const { data: currentLesson, isLoading: lessonLoading } = useQuery({
    queryKey: ['lesson', targetLessonId],
    queryFn: () => getLessonById(targetLessonId),
    enabled: !!targetLessonId
  });

  const isLoading = (lessonId && !initialLessonData) || courseLoading || (targetLessonId && lessonLoading);

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

  // Đổi bài học mới
  const handleSelectLesson = (id) => {
    navigate(`/lessons/${id}`);
  };

  // Check hoàn thành bài học
  const handleToggleComplete = async (e, id) => {
    e.stopPropagation(); // Ngăn kích hoạt click chọn bài học
    try {
      await toggleLessonCompletion(id);
      
      // Khởi chạy reload ngầm của React Query để đồng bộ toàn cục
      queryClient.invalidateQueries({ queryKey: ['lesson', id] });
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
      <div className="min-h-screen flex flex-col justify-center items-center" style={{ backgroundColor: 'var(--bg-color)', color: 'var(--text-color)' }}>
        <div className="w-12 h-12 border-4 border-slate-200 border-t-smart-indigo rounded-full animate-spin"></div>
        <p className="mt-4 text-sm font-semibold text-slate-500">Đang chuẩn bị lớp học...</p>
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
          <div className="grid grid-cols-10 gap-6 items-start">
            
            {/* Left Area - 70% */}
            {currentLesson?.type === 'quiz' || currentLesson?.type === 'quizz' ? (
              <div className="col-span-10 lg:col-span-7 flex flex-col space-y-6">
                <QuizContent 
                  lessonId={currentLesson.id.replace('quiz-', '')} 
                  onComplete={async (score, total) => {
                    // Nếu đạt tối thiểu 50% số điểm (ví dụ: làm đúng 3/5 câu), tự động đánh dấu hoàn thành bài học
                    if (score >= total / 2 && !currentLesson.completed) {
                      try {
                        await toggleLessonCompletion(currentLesson.id);
                        queryClient.invalidateQueries({ queryKey: ['lesson', currentLesson.id] });
                        queryClient.invalidateQueries({ queryKey: ['course', courseIdToLoad] });
                      } catch (err) {
                        console.error("Lỗi tự động hoàn thành bài học khi làm trắc nghiệm:", err);
                      }
                    }
                  }}
                />
              </div>
            ) : (
              <div className="col-span-10 lg:col-span-7 flex flex-col space-y-6">
                
                {/* Premium Video Container */}
                <div className="bg-black rounded-2xl overflow-hidden aspect-video border border-slate-800 shadow-lg relative group">
                  {currentLesson?.type === 'pdf' ? (
                    <iframe 
                      key={currentLesson.id}
                      src={currentLesson.pdfUrl} 
                      className="w-full h-full border-none bg-white"
                      title={currentLesson.title}
                    />
                  ) : currentLesson?.videoUrl ? (
                    <video 
                      key={currentLesson.id}
                      src={currentLesson.videoUrl} 
                      controls 
                      autoPlay
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 bg-slate-900">
                      <FiPlay className="text-5xl animate-pulse mb-3" />
                      <span>Video bài giảng không khả dụng.</span>
                    </div>
                  )}
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
                      onClick={(e) => handleToggleComplete(e, currentLesson.id)}
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
                  className="flex-1 py-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center space-x-2 border-b-2 transition-all font-extrabold"
                >
                  <FiBookOpen className="text-[13px]" />
                  <span>Danh sách bài học</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveRightTab("ai")}
                  style={{
                    borderBottomColor: activeRightTab === "ai" ? "#3b82f6" : "transparent",
                    color: activeRightTab === "ai" ? "#3b82f6" : "var(--text-light)",
                    backgroundColor: activeRightTab === "ai" ? "var(--card-bg)" : "var(--bg-color)",
                  }}
                  className="flex-1 py-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center space-x-2 border-b-2 transition-all font-extrabold"
                >
                  <FiCpu className="text-[13px]" />
                  <span>AI Assistant</span>
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
                                const isActive = currentLesson && currentLesson.id === lesson.id;
                                const isQuiz = lesson.type === 'quiz';
                                return (
                                  <div 
                                    key={lesson.id}
                                    onClick={() => handleSelectLesson(lesson.id)}
                                    style={{
                                      backgroundColor: isActive ? 'rgba(29, 78, 216, 0.08)' : (isQuiz ? 'rgba(99, 102, 241, 0.03)' : 'transparent'),
                                      borderColor: isActive ? '#3b82f6' : (isQuiz ? 'rgba(99, 102, 241, 0.2)' : 'transparent'),
                                    }}
                                    className={`flex items-start px-3.5 py-3 transition-colors cursor-pointer rounded-lg border-l-4 ${
                                      isQuiz ? 'ml-4 border-dashed' : 'border-transparent'
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
                                        {isQuiz ? <FiCheckSquare /> : <FiClock />}
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

                {/* AI Assistant ChatBox View */}
                {activeRightTab === "ai" && (
                  <div className="h-full p-2">
                    <ErrorBoundary title="Không thể kết nối với Trợ lý AI" message="Khung hội thoại RAG AI đang tạm thời gián đoạn. Bạn vẫn có thể tiếp tục học bài giảng bằng video bình thường.">
                      <ChatBox lessonId={currentLesson?.id || targetLessonId} />
                    </ErrorBoundary>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
};

export default LessonDetailPage;
