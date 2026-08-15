import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import apiClient from '../../../config/api.config';
import { 
  FiArrowLeft, FiSave, FiUpload, FiTrash2, 
  FiPlus, FiMove, FiVideo, FiFileText, FiAlertCircle, FiLoader
} from 'react-icons/fi';
import Header from '../../../components/common/Header';
import Footer from '../../../components/common/Footer';
import { DateRangePicker, SingleDatePicker } from '../../../components/ui';
import InstructorCopyrightPolicyModal from '../components/InstructorCopyrightPolicyModal';
import { subtitlesService } from '../../lessons/services/subtitles.service';
import '../styles/instructor.scss';

const getRoleFromToken = () => {
  const token = localStorage.getItem('token');
  if (!token) return null;
  try {
    const payloadBase64 = token.split('.')[1];
    const payloadJson = atob(payloadBase64);
    const payload = JSON.parse(payloadJson);
    return parseInt(payload.roleId || payload.role);
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
  const { courseId } = useParams();
  const fileInputRef = useRef({});
  const isEditMode = !!courseId;

  // [TASK-FE-POL-01] State quản lý Modal Policy Bản quyền Giảng viên
  const [policyModalOpen, setPolicyModalOpen] = useState(false);

  // Auth check
  useEffect(() => {
    const role = getRoleFromToken();
    if (role !== 2 && role !== 1) { // Instructor or Admin
      navigate('/');
    }
  }, [navigate]);

  // Fetch course details for editing
  useEffect(() => {
    if (isEditMode) {
      const fetchCourse = async () => {
        try {
          setLoading(true);
          const response = await apiClient.get(`/courses/${courseId}`);
          if (response.data && response.data.success) {
            const course = response.data.course;
            setCourseName(course.course_name);
            setSubjectId(String(course.subject_id));
            if (course.start_date) setStartDate(typeof course.start_date === 'string' ? course.start_date.substring(0, 10) : getTodayCivilDate());
            if (course.end_date) setEndDate(typeof course.end_date === 'string' ? course.end_date.substring(0, 10) : getNextYearCivilDate());
            if (course.sections) {
              setSections(course.sections.map(sec => ({
                id: sec.section_id,
                title: sec.title,
                lessons: (sec.lessons || []).map(l => ({
                  id: l.lesson_id,
                  title: l.title,
                  type: l.content_type,
                  contentUrl: l.content_url,
                  uploading: false,
                  fileName: l.content_url ? l.content_url.split('/').pop() : '',
                  speakingSentences: l.speaking_sentences || '',
                  speakingQuestions: l.speaking_questions || ''
                }))
              })));
            }
          }
        } catch (err) {
          console.error('Lỗi khi tải thông tin khóa học để sửa:', err);
          setErrorMsg('Không thể tải thông tin chi tiết khóa học từ máy chủ.');
        } finally {
          setLoading(false);
        }
      };
      fetchCourse();
    }
  }, [courseId, isEditMode]);

  // States
  const [activeHubTab, setActiveHubTab] = useState('basic'); // 'basic', 'curriculum', 'speaking'
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
        { id: Date.now() + 1, title: '1. Chào mừng bạn đến với khóa học', type: 'video', contentUrl: '', uploading: false }
      ]
    }
  ]);

  const [expandedSpeaking, setExpandedSpeaking] = useState({});

  const [loading, setLoading] = useState(false);
  const [fetchingSubjects, setFetchingSubjects] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Fetch subjects
  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        const response = await apiClient.get('/courses/subjects');
        if (response.data && response.data.subjects) {
          setSubjects(response.data.subjects);
          if (response.data.subjects.length > 0) {
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
      alert('Phải có ít nhất 1 chương học.');
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
      speakingQuestions: ''
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

  // Upload File trực tiếp (Không làm gián đoạn việc soạn giáo trình)
  const triggerFileSelect = (sIdx, lIdx) => {
    const refKey = `${sIdx}-${lIdx}`;
    if (fileInputRef.current[refKey]) {
      fileInputRef.current[refKey].click();
    }
  };

  const handleFileChange = async (sIdx, lIdx, e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Set uploading state
    handleLessonChange(sIdx, lIdx, 'uploading', true);
    setErrorMsg('');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await apiClient.post('/courses/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      if (response.data && response.data.success) {
        const fileUrl = response.data.fileUrl;
        const mime = response.data.mimetype;
        const detectedType = mime && mime.includes('pdf') ? 'pdf' : 'video';

        const newSections = [...sections];
        newSections[sIdx].lessons[lIdx].contentUrl = fileUrl;
        newSections[sIdx].lessons[lIdx].type = detectedType;
        newSections[sIdx].lessons[lIdx].uploading = false;
        newSections[sIdx].lessons[lIdx].fileName = file.name;
        newSections[sIdx].lessons[lIdx].hasAcceptedPolicy = true;
        setSections(newSections);
      }
    } catch (err) {
      console.error('Lỗi khi tải file lên:', err);
      setErrorMsg(err.response?.data?.message || 'Lỗi khi tải file lên máy chủ.');
      handleLessonChange(sIdx, lIdx, 'uploading', false);
    }
  };

  // 1. Khi nhấn "Xuất bản khóa học": Validate khung bài giảng rồi mở Modal Cam kết Bản quyền [TASK-FE-POL-01]
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

    // Validate toàn bộ cấu trúc bài giảng khi Publish
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
        if (!lesson.contentUrl) {
          setErrorMsg(`Vui lòng tải lên nội dung (video/pdf) cho bài học "${lesson.title}".`);
          return;
        }
      }
    }

    setErrorMsg('');
    // Mở Modal Cam kết Bản quyền để Giảng viên ký xác nhận
    setPolicyModalOpen(true);
  };

  // 2. Thực hiện lưu hoặc xuất bản khóa học lên máy chủ
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

    for (let sIdx = 0; sIdx < sections.length; sIdx++) {
      const section = sections[sIdx];
      if (!section.title.trim()) {
        setErrorMsg(`Tên chương thứ ${sIdx + 1} không được để trống.`);
        return;
      }
    }

    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    // Nếu xuất bản (status = 1), ghi nhận chấp thuận bản quyền vào cơ sở dữ liệu
    if (status === 1) {
      try {
        await apiClient.post('/instructor/accept-policy', {
          signature: user?.full_name || user?.username || 'Giảng viên',
          courseName: courseName.trim()
        });
      } catch (policyErr) {
        console.debug('Lỗi ghi nhận accept-policy:', policyErr?.message);
      }
    }

    const payload = {
      courseName,
      subjectId: parseInt(subjectId),
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
          contentType: les.type, // 'video' or 'pdf'
          contentUrl: les.contentUrl,
          orderIndex: lIdx + 1,
          speakingSentences: les.speakingSentences || '',
          speakingQuestions: les.speakingQuestions || ''
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

  return (
    <div className="instructor-page">
      <Header />
      
      <main className="instructor-container editor-mode" style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '30px' }}>
        {/* Sidebar */}
        <div className="editor-sidebar">
          <button className="btn-back" onClick={() => navigate('/instructor/dashboard')}>
            <FiArrowLeft /> Back to Dashboard
          </button>
          
          <div className="course-nav-guide">
            <h3 style={{ textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-light, #64748b)', fontSize: '11px', fontWeight: '800', marginBottom: '16px' }}>Course Creation Hub</h3>
            <ul style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: 0, listStyle: 'none' }}>
              <li 
                onClick={() => setActiveHubTab('basic')}
                className={`hub-nav-item ${activeHubTab === 'basic' ? 'active' : ''}`}
              >
                📝 Thông tin khóa học
              </li>
              <li 
                onClick={() => setActiveHubTab('curriculum')}
                className={`hub-nav-item ${activeHubTab === 'curriculum' ? 'active' : ''}`}
              >
                📚 Chương trình học
              </li>
            </ul>
          </div>
        </div>

        {/* Content Area */}
        <div className="instructor-content">
          <header className="content-header" style={{ marginBottom: '24px' }}>
            <div className="header-text">
              <h1>{isEditMode ? 'Edit Course' : 'Create New Course'}</h1>
              <p>{isEditMode ? 'Update your course metadata and structure your curriculum below.' : 'Setup your course metadata and structure your curriculum below.'}</p>
            </div>
            <div className="header-actions">
              <button 
                className="btn-save-draft" 
                onClick={() => executeSubmitCourse(0)}
                disabled={loading}
              >
                <FiSave /> Save Draft
              </button>
              <button 
                className="btn-publish" 
                onClick={handleInitiatePublish}
                disabled={loading}
              >
                {loading ? <FiLoader className="spin" /> : <FiUpload />} Publish Course
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

          {/* Basic Course Info Form */}
          {activeHubTab === 'basic' && (
            <div className="course-basic-form" style={{
              padding: '24px', borderRadius: '20px', marginBottom: '32px'
            }}>
              <h2 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '16px' }} className="form-section-title">Thông tin khóa học cơ bản</h2>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                <div>
                  <label className="form-group-label" style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Tên khóa học *</label>
                  <input 
                    type="text" 
                    value={courseName}
                    onChange={(e) => setCourseName(e.target.value)}
                    placeholder="Ví dụ: Luyện thi IELTS mục tiêu 6.5+"
                    style={{
                      width: '100%', padding: '12px', borderRadius: '10px', fontSize: '14px'
                    }}
                  />
                </div>

                <div>
                  <label className="form-group-label" style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Môn học liên kết *</label>
                  {fetchingSubjects ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', color: 'var(--text-light, #64748b)' }}>
                      <FiLoader className="spin" /> Đang tải môn học...
                    </div>
                  ) : (
                    <select 
                      value={subjectId}
                      onChange={(e) => setSubjectId(e.target.value)}
                      style={{
                        width: '100%', padding: '12px', borderRadius: '10px', fontSize: '14px'
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
                  <label className="form-group-label" style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Ngày khai giảng</label>
                  <SingleDatePicker 
                    value={startDate}
                    rangeStart={startDate}
                    rangeEnd={endDate}
                    onChange={(val) => setStartDate(val)}
                    placeholder="Chọn ngày khai giảng"
                  />
                </div>
                <div>
                  <label className="form-group-label" style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Ngày kết thúc</label>
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

          {/* Curriculum Builder */}
          {activeHubTab === 'curriculum' && (
            <div className="curriculum-builder">
              <h2 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '4px' }} className="builder-title">Curriculum Builder</h2>
              <p style={{ fontSize: '14px', marginBottom: '20px' }} className="builder-subtitle">Thêm các chương học và bài giảng dưới dạng PDF hoặc Video để cấu thành khóa học của bạn.</p>

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
                      return (
                        <div key={lesson.id} className="lesson-item-edit" style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'stretch' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                            <div className="lesson-main" style={{ flex: 1 }}>
                              <FiMove className="drag-handle-small" />
                              <select 
                                value={lesson.type}
                                onChange={(e) => handleLessonChange(sIdx, lIdx, 'type', e.target.value)}
                                style={{ border: 'none', background: 'none', fontWeight: '600', color: '#64748b', marginRight: '8px', cursor: 'pointer' }}
                              >
                                <option value="video">Video</option>
                                <option value="pdf">PDF Document</option>
                              </select>
                              <input 
                                type="text"
                                value={lesson.title}
                                onChange={(e) => handleLessonChange(sIdx, lIdx, 'title', e.target.value)}
                                placeholder="Nhập tên bài học..."
                                style={{
                                  border: 'none', background: 'none', borderBottom: '1px dashed #cbd5e1', width: '60%', padding: '2px 4px', fontSize: '14px'
                                }}
                              />
                            </div>
                            
                            <div className="lesson-actions">
                              <input 
                                type="file" 
                                ref={el => fileInputRef.current[refKey] = el}
                                style={{ display: 'none' }}
                                onChange={(e) => handleFileChange(sIdx, lIdx, e)}
                                accept={lesson.type === 'video' ? 'video/*' : 'application/pdf'}
                              />
                              <button 
                                className="btn-edit-content" 
                                onClick={() => triggerFileSelect(sIdx, lIdx)}
                                disabled={lesson.uploading}
                                style={{
                                  background: lesson.contentUrl ? '#ecfdf5' : '',
                                  color: lesson.contentUrl ? '#059669' : '',
                                  borderColor: lesson.contentUrl ? '#a7f3d0' : ''
                                }}
                              >
                                {lesson.uploading ? (
                                  <><FiLoader className="spin" /> Tải lên...</>
                                ) : lesson.contentUrl ? (
                                  <><FiUpload /> Đã tải lên</>
                                ) : (
                                  <><FiUpload /> Chọn tệp</>
                                )}
                              </button>
                              <button className="btn-icon-small" onClick={() => handleDeleteLesson(sIdx, lIdx)} title="Xóa bài học">
                                <FiTrash2 />
                              </button>
                            </div>
                          </div>

                          {/* Toggle Speaking Configuration Button */}
                          <div style={{ marginLeft: '28px', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <button
                              type="button"
                              onClick={() => setExpandedSpeaking(prev => ({ ...prev, [lesson.id]: !prev[lesson.id] }))}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                background: 'none',
                                border: 'none',
                                color: '#4f46e5',
                                fontSize: '11px',
                                fontWeight: '750',
                                cursor: 'pointer',
                                padding: '4px 0',
                                outline: 'none'
                              }}
                            >
                              <span>💬</span>
                              <span style={{ textDecoration: 'underline' }}>
                                {expandedSpeaking[lesson.id] || lesson.speakingSentences || lesson.speakingQuestions
                                  ? 'Ẩn bài tập speaking'
                                  : 'Thêm bài tập speaking (tùy chọn)'
                                }
                              </span>
                            </button>

                            {/* Trigger AI Subtitle Generator for Video Lessons */}
                            {lesson.type === 'video' && lesson.id && (
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    setLoading(true);
                                    const result = await subtitlesService.generateSubtitles(lesson.id);
                                    alert(`✅ Đã tạo thành công ${result?.cues?.length || 0} câu phụ đề song ngữ bằng AI Gemini 2.5 Flash!`);
                                  } catch (err) {
                                    alert(`❌ Lỗi tạo phụ đề AI: ${err.message}`);
                                  } finally {
                                    setLoading(false);
                                  }
                                }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  background: 'none',
                                  border: 'none',
                                  color: '#0d9488',
                                  fontSize: '11px',
                                  fontWeight: '750',
                                  cursor: 'pointer',
                                  padding: '4px 0',
                                  outline: 'none'
                                }}
                                title="Tự động bóc băng lời thoại và dịch song ngữ bằng Gemini 2.5 Flash"
                              >
                                <span>✨</span>
                                <span style={{ textDecoration: 'underline' }}>⚡ Tạo phụ đề song ngữ AI (Gemini 2.5)</span>
                              </button>
                            )}

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
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  background: 'none',
                                  border: 'none',
                                  color: '#ef4444',
                                  fontSize: '11px',
                                  fontWeight: '700',
                                  cursor: 'pointer',
                                  padding: '4px 0',
                                  outline: 'none'
                                }}
                                title="Xóa bài tập Speaking"
                              >
                                <span>🗑️</span>
                                <span style={{ textDecoration: 'underline' }}>Xóa bài tập speaking</span>
                              </button>
                            )}
                          </div>

                          {/* Speaking configuration fields rendered inline if expanded or already has data */}
                          {(expandedSpeaking[lesson.id] || lesson.speakingSentences || lesson.speakingQuestions) && (
                            <div style={{
                              display: 'grid',
                              gridTemplateColumns: '1fr 1fr',
                              gap: '16px',
                              marginTop: '6px',
                              padding: '16px',
                              background: 'var(--bg-color, #f8fafc)',
                              borderRadius: '12px',
                              border: '1px solid var(--border-color, #e2e8f0)',
                              marginLeft: '28px'
                            }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <span style={{ fontSize: '11px', fontWeight: '700', display: 'flex', justifyContent: 'space-between' }} className="speaking-label">
                                  <span>1. Câu luyện phát âm AI (Đọc mẫu - Cú pháp: Tiếng Anh | Bản dịch):</span>
                                  <span style={{ fontWeight: '500', color: 'var(--text-light, #94a3b8)', fontSize: '10px', fontStyle: 'italic' }}>(Tùy chọn)</span>
                                </span>
                                <textarea
                                  value={lesson.speakingSentences || ''}
                                  onChange={(e) => handleLessonChange(sIdx, lIdx, 'speakingSentences', e.target.value)}
                                  placeholder="Ví dụ:&#10;Welcome to our speaking class. | Chào mừng bạn đến với lớp học.&#10;Practice makes perfect. | Luyện tập tạo nên sự hoàn hảo."
                                  rows={3}
                                  style={{
                                    width: '100%',
                                    padding: '8px 12px',
                                    borderRadius: '8px',
                                    border: '1px solid var(--border-color, #cbd5e1)',
                                    fontSize: '12px',
                                    outline: 'none',
                                    color: 'var(--text-color, #334155)',
                                    background: 'var(--input-bg, #ffffff)',
                                    resize: 'vertical'
                                  }}
                                />
                              </div>
                              
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <span style={{ fontSize: '11px', fontWeight: '700', display: 'flex', justifyContent: 'space-between' }} className="speaking-label">
                                  <span>2. Câu hỏi phản xạ nói Q&A (Cú pháp: Câu hỏi | Bản dịch):</span>
                                  <span style={{ fontWeight: '500', color: 'var(--text-light, #94a3b8)', fontSize: '10px', fontStyle: 'italic' }}>(Tùy chọn)</span>
                                </span>
                                <textarea
                                  value={lesson.speakingQuestions || ''}
                                  onChange={(e) => handleLessonChange(sIdx, lIdx, 'speakingQuestions', e.target.value)}
                                  placeholder="Ví dụ:&#10;What did you do last weekend? | Cuối tuần trước bạn đã làm gì?&#10;Tell me about your family. | Hãy chia sẻ về gia đình bạn."
                                  rows={3}
                                  style={{
                                    width: '100%',
                                    padding: '8px 12px',
                                    borderRadius: '8px',
                                    border: '1px solid var(--border-color, #cbd5e1)',
                                    fontSize: '12px',
                                    outline: 'none',
                                    color: 'var(--text-color, #334155)',
                                    background: 'var(--input-bg, #ffffff)',
                                    resize: 'vertical'
                                  }}
                                />
                              </div>
                            </div>
                          )}

                          {/* File details banner if uploaded */}
                          {lesson.contentUrl && (
                            <div style={{
                              fontSize: '12px', color: '#059669', background: '#f0fdf4', padding: '6px 12px', borderRadius: '6px',
                              marginLeft: '28px', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px'
                            }}>
                              {lesson.type === 'video' ? <FiVideo /> : <FiFileText />}
                              <span>Link file: <a href={`${(import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '')}${lesson.contentUrl}`} target="_blank" rel="noreferrer" style={{ color: '#059669', textDecoration: 'underline' }}>{lesson.fileName || 'Xem file bài giảng'}</a></span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    
                    <button className="btn-add-lesson" onClick={() => handleAddLesson(sIdx)}>
                      <FiPlus /> Add Lesson
                    </button>
                  </div>
                </div>
              ))}

              <button className="btn-add-section" onClick={handleAddSection}>
                <FiPlus /> Add New Section
              </button>
            </div>
          )}


        </div>
      </main>

      <Footer />
      
      {/* [TASK-FE-POL-01] Modal Cam kết Điều khoản & Bản quyền Giảng viên khi Xuất bản */}
      <InstructorCopyrightPolicyModal
        isOpen={policyModalOpen}
        onClose={() => setPolicyModalOpen(false)}
        onAccept={() => executeSubmitCourse(1)}
        courseName={courseName || 'Khóa học chưa đặt tên'}
        sectionsCount={sections.length}
        lessonsCount={sections.reduce((sum, s) => sum + (s.lessons?.length || 0), 0)}
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
