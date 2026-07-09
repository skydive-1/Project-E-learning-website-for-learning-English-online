import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { 
  FiArrowLeft, FiSave, FiUpload, FiTrash2, 
  FiPlus, FiMove, FiVideo, FiFileText, FiAlertCircle, FiLoader
} from 'react-icons/fi';
import Header from '../../../components/common/Header';
import Footer from '../../../components/common/Footer';
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

const API_BASE_URL = 'http://localhost:5000/api';

const CustomDateInput = ({ value, onChange }) => {
  const [isFocused, setIsFocused] = useState(false);

  const formatDateForDisplay = (dateStr) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        padding: '12px 16px',
        borderRadius: '10px',
        border: '1px solid',
        borderColor: isFocused ? '#3b82f6' : '#cbd5e1',
        boxShadow: isFocused ? '0 0 0 2px rgba(59, 130, 246, 0.15)' : 'none',
        fontSize: '14px',
        backgroundColor: '#fff',
        color: '#1e293b',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        pointerEvents: 'none',
        zIndex: 1,
        transition: 'all 0.15s ease'
      }}>
        <span>{formatDateForDisplay(value) || 'Chọn ngày'}</span>
        <span style={{ color: '#94a3b8' }}>📅</span>
      </div>
      <input 
        type="date" 
        value={value || ''}
        onChange={onChange}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        style={{
          width: '100%',
          padding: '12px',
          borderRadius: '10px',
          border: '1px solid transparent',
          fontSize: '14px',
          opacity: 0,
          position: 'relative',
          zIndex: 2,
          cursor: 'pointer'
        }}
      />
    </div>
  );
};

const CourseEditor = () => {
  const navigate = useNavigate();
  const { courseId } = useParams();
  const fileInputRef = useRef({});
  const isEditMode = !!courseId;

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
          const token = localStorage.getItem('token');
          const response = await axios.get(`${API_BASE_URL}/courses/${courseId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (response.data && response.data.success) {
            const course = response.data.course;
            setCourseName(course.course_name);
            setSubjectId(String(course.subject_id));
            if (course.start_date) setStartDate(new Date(course.start_date).toISOString().substring(0, 10));
            if (course.end_date) setEndDate(new Date(course.end_date).toISOString().substring(0, 10));
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
  const [startDate, setStartDate] = useState(new Date().toISOString().substring(0, 10));
  const [endDate, setEndDate] = useState(() => {
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    return nextYear.toISOString().substring(0, 10);
  });
  
  const [sections, setSections] = useState([
    {
      id: Date.now(),
      title: 'Chương 1: Giới thiệu',
      lessons: [
        { id: Date.now() + 1, title: '1. Chào mừng bạn đến với khóa học', type: 'video', contentUrl: '', uploading: false }
      ]
    }
  ]);

  const [loading, setLoading] = useState(false);
  const [fetchingSubjects, setFetchingSubjects] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Fetch subjects
  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/courses/subjects`);
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

    // Set uploading state
    handleLessonChange(sIdx, lIdx, 'uploading', true);
    setErrorMsg('');

    const token = localStorage.getItem('token');
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post(`${API_BASE_URL}/courses/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${token}`
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
        setSections(newSections);
      }
    } catch (err) {
      console.error('Lỗi khi tải file lên:', err);
      setErrorMsg(err.response?.data?.message || 'Lỗi khi tải file lên máy chủ.');
      handleLessonChange(sIdx, lIdx, 'uploading', false);
    }
  };

  // Submit Course
  const handlePublishCourse = async (status = 1) => {
    if (!courseName.trim()) {
      setErrorMsg('Vui lòng nhập tên khóa học.');
      return;
    }
    if (!subjectId) {
      setErrorMsg('Vui lòng chọn môn học.');
      return;
    }

    // Validate curriculum structure
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
        if (!lesson.contentUrl) {
          setErrorMsg(`Vui lòng tải lên nội dung (video/pdf) cho bài học "${lesson.title}".`);
          return;
        }
      }
    }

    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    const token = localStorage.getItem('token');
    const payload = {
      courseName,
      subjectId: parseInt(subjectId),
      startDate,
      endDate,
      status, // 1: Active, 0: Inactive
      sections: sections.map((sec, sIdx) => ({
        title: sec.title,
        orderIndex: sIdx + 1,
        lessons: sec.lessons.map((les, lIdx) => ({
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
        ? await axios.put(`${API_BASE_URL}/courses/${courseId}`, payload, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          })
        : await axios.post(`${API_BASE_URL}/courses`, payload, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });

      if (response.data && response.data.success) {
        setSuccessMsg(isEditMode ? 'Cập nhật khóa học thành công!' : 'Tạo khóa học thành công!');
        setTimeout(() => {
          navigate('/instructor/dashboard');
        }, 1500);
      }
    } catch (err) {
      console.error('Lỗi lưu khóa học:', err);
      setErrorMsg(err.response?.data?.message || 'Có lỗi xảy ra khi lưu khóa học trên máy chủ.');
    } finally {
      setLoading(false);
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
            <h3 style={{ textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', fontSize: '11px', fontWeight: '800', marginBottom: '16px' }}>Course Creation Hub</h3>
            <ul style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: 0, listStyle: 'none' }}>
              <li 
                onClick={() => setActiveHubTab('basic')}
                style={{ 
                  cursor: 'pointer', 
                  padding: '12px 16px', 
                  borderRadius: '10px', 
                  fontSize: '13px', 
                  fontWeight: '700',
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '10px',
                  transition: 'all 0.2s',
                  background: activeHubTab === 'basic' ? '#eef2ff' : 'transparent',
                  color: activeHubTab === 'basic' ? '#4f46e5' : '#475569',
                  borderLeft: activeHubTab === 'basic' ? '3px solid #4f46e5' : '3px solid transparent'
                }}
              >
                📝 Thông tin khóa học
              </li>
              <li 
                onClick={() => setActiveHubTab('curriculum')}
                style={{ 
                  cursor: 'pointer', 
                  padding: '12px 16px', 
                  borderRadius: '10px', 
                  fontSize: '13px', 
                  fontWeight: '700',
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '10px',
                  transition: 'all 0.2s',
                  background: activeHubTab === 'curriculum' ? '#eef2ff' : 'transparent',
                  color: activeHubTab === 'curriculum' ? '#4f46e5' : '#475569',
                  borderLeft: activeHubTab === 'curriculum' ? '3px solid #4f46e5' : '3px solid transparent'
                }}
              >
                📚 Chương trình học
              </li>
              <li 
                onClick={() => setActiveHubTab('speaking')}
                style={{ 
                  cursor: 'pointer', 
                  padding: '12px 16px', 
                  borderRadius: '10px', 
                  fontSize: '13px', 
                  fontWeight: '700',
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '10px',
                  transition: 'all 0.2s',
                  background: activeHubTab === 'speaking' ? '#eef2ff' : 'transparent',
                  color: activeHubTab === 'speaking' ? '#4f46e5' : '#475569',
                  borderLeft: activeHubTab === 'speaking' ? '3px solid #4f46e5' : '3px solid transparent'
                }}
              >
                💬 Quản lý Speaking AI
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
                onClick={() => handlePublishCourse(0)}
                disabled={loading}
              >
                <FiSave /> Save Draft
              </button>
              <button 
                className="btn-publish" 
                onClick={() => handlePublishCourse(1)}
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
              background: '#ffffff', padding: '24px', borderRadius: '20px', border: '1px solid #e2e8f0', marginBottom: '32px'
            }}>
              <h2 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '16px', color: '#0f172a' }}>Thông tin khóa học cơ bản</h2>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#475569', marginBottom: '8px' }}>Tên khóa học *</label>
                  <input 
                    type="text" 
                    value={courseName}
                    onChange={(e) => setCourseName(e.target.value)}
                    placeholder="Ví dụ: Luyện thi IELTS mục tiêu 6.5+"
                    style={{
                      width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '14px'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#475569', marginBottom: '8px' }}>Môn học liên kết *</label>
                  {fetchingSubjects ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', color: '#64748b' }}>
                      <FiLoader className="spin" /> Đang tải môn học...
                    </div>
                  ) : (
                    <select 
                      value={subjectId}
                      onChange={(e) => setSubjectId(e.target.value)}
                      style={{
                        width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '14px', background: '#fff'
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
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#475569', marginBottom: '8px' }}>Ngày khai giảng</label>
                  <CustomDateInput 
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#475569', marginBottom: '8px' }}>Ngày kết thúc</label>
                  <CustomDateInput 
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Curriculum Builder */}
          {activeHubTab === 'curriculum' && (
            <div className="curriculum-builder">
              <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a', marginBottom: '4px' }}>Curriculum Builder</h2>
              <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '20px' }}>Thêm các chương học và bài giảng dưới dạng PDF hoặc Video để cấu thành khóa học của bạn.</p>

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

                          {/* File details banner if uploaded */}
                          {lesson.contentUrl && (
                            <div style={{
                              fontSize: '12px', color: '#059669', background: '#f0fdf4', padding: '6px 12px', borderRadius: '6px',
                              marginLeft: '28px', display: 'flex', alignItems: 'center', gap: '8px'
                            }}>
                              {lesson.type === 'video' ? <FiVideo /> : <FiFileText />}
                              <span>Link file: <a href={`http://localhost:5000${lesson.contentUrl}`} target="_blank" rel="noreferrer" style={{ color: '#059669', textDecoration: 'underline' }}>{lesson.fileName || 'Xem file bài giảng'}</a></span>
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

          {/* Speaking AI Hub Tab */}
          {activeHubTab === 'speaking' && (
            <div className="speaking-ai-manager" style={{
              background: '#ffffff', padding: '24px', borderRadius: '20px', border: '1px solid #e2e8f0', marginBottom: '32px'
            }}>
              <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a', marginBottom: '4px' }}>💬 Quản lý Speaking AI</h2>
              <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '24px' }}>Cấu hình bài tập luyện nói thông minh cho từng bài học để học viên thực hành luyện phát âm và phản xạ nói.</p>

              {sections.length === 0 || sections.every(s => s.lessons.length === 0) ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b', background: '#f8fafc', borderRadius: '16px', border: '1px dashed #cbd5e1' }}>
                  <FiAlertCircle style={{ fontSize: '24px', color: '#94a3b8', marginBottom: '8px' }} />
                  <p className="text-sm font-semibold">Chưa có chương học hoặc bài học nào.</p>
                  <p className="text-xs text-slate-400 mt-1">Vui lòng thiết lập cấu trúc chương trình học ở tab <strong>Chương trình học</strong> trước khi thêm câu luyện nói.</p>
                </div>
              ) : (
                sections.map((section, sIdx) => {
                  if (section.lessons.length === 0) return null;
                  return (
                    <div key={section.id} style={{ marginBottom: '28px', borderBottom: '1px solid #f1f5f9', paddingBottom: '24px' }}>
                      <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#1e293b', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '16px' }}>📁</span> {section.title}
                      </h3>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        {section.lessons.map((lesson, lIdx) => (
                          <div 
                            key={lesson.id} 
                            style={{ 
                              background: '#f8fafc', 
                              padding: '20px', 
                              borderRadius: '16px', 
                              border: '1px solid #e2e8f0',
                              marginLeft: '12px'
                            }}
                          >
                            <h4 style={{ fontSize: '14px', fontWeight: '700', color: '#334155', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
                              <span>📖</span> {lesson.title}
                            </h4>
                            
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <span style={{ fontSize: '12px', fontWeight: '700', color: '#475569', display: 'flex', justifyContent: 'space-between' }}>
                                  <span>1. Câu luyện phát âm AI - Đọc theo mẫu:</span>
                                  <span style={{ fontWeight: '500', color: '#94a3b8', fontSize: '11px', fontStyle: 'italic' }}>(Tùy chọn)</span>
                                </span>
                                <textarea
                                  value={lesson.speakingSentences || ''}
                                  onChange={(e) => handleLessonChange(sIdx, lIdx, 'speakingSentences', e.target.value)}
                                  placeholder="Ví dụ:&#10;Welcome to our speaking class.&#10;How are you doing today?"
                                  rows={4}
                                  style={{
                                    width: '100%',
                                    padding: '12px',
                                    borderRadius: '10px',
                                    border: '1px solid #cbd5e1',
                                    fontSize: '12.5px',
                                    outline: 'none',
                                    color: '#334155',
                                    fontFamily: 'monospace',
                                    background: '#ffffff',
                                    resize: 'vertical'
                                  }}
                                />
                              </div>
                              
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <span style={{ fontSize: '12px', fontWeight: '700', color: '#475569', display: 'flex', justifyContent: 'space-between' }}>
                                  <span>2. Câu hỏi phản xạ nói Q&A - Trả lời tự do:</span>
                                  <span style={{ fontWeight: '500', color: '#94a3b8', fontSize: '11px', fontStyle: 'italic' }}>(Tùy chọn)</span>
                                </span>
                                <textarea
                                  value={lesson.speakingQuestions || ''}
                                  onChange={(e) => handleLessonChange(sIdx, lIdx, 'speakingQuestions', e.target.value)}
                                  placeholder="Ví dụ:&#10;What did you do last weekend?&#10;Tell me about your family."
                                  rows={4}
                                  style={{
                                    width: '100%',
                                    padding: '12px',
                                    borderRadius: '10px',
                                    border: '1px solid #cbd5e1',
                                    fontSize: '12.5px',
                                    outline: 'none',
                                    color: '#334155',
                                    fontFamily: 'monospace',
                                    background: '#ffffff',
                                    resize: 'vertical'
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </main>

      <Footer />
      
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
