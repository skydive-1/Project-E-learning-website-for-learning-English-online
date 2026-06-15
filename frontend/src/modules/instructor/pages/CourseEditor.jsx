import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FiArrowLeft, FiSave, FiUpload, FiTrash2, 
  FiPlus, FiMove, FiVideo, FiFileText 
} from 'react-icons/fi';
import Header from '../../../components/common/Header';
import Footer from '../../../components/common/Footer';
import '../styles/instructor.scss';

const CourseEditor = () => {
  const navigate = useNavigate();
  const [sections, setSections] = useState([
    {
      id: 1,
      title: 'Chương 1: Giới thiệu',
      lessons: [
        { id: 101, title: '1. Chào mừng bạn đến với khóa học', type: 'video' }
      ]
    }
  ]);

  return (
    <div className="instructor-page">
      <Header />
      
      <main className="instructor-container editor-mode">
        <div className="editor-sidebar">
          <button className="btn-back" onClick={() => navigate('/instructor/dashboard')}>
            <FiArrowLeft /> Back to Dashboard
          </button>
          <div className="course-nav-guide">
            <h3>Course Creation Guide</h3>
            <ul>
              <li className="completed">Basic Information</li>
              <li className="active">Curriculum Builder</li>
              <li>Settings & Pricing</li>
              <li>Review & Publish</li>
            </ul>
          </div>
        </div>

        <div className="instructor-content">
          <header className="content-header">
            <div className="header-text">
              <h1>Curriculum Builder</h1>
              <p>Plan and manage your course content here. Drag and drop to reorder.</p>
            </div>
            <div className="header-actions">
              <button className="btn-save-draft"><FiSave /> Save Draft</button>
              <button className="btn-publish">Publish Course</button>
            </div>
          </header>

          <div className="curriculum-builder">
            {sections.map((section, sIdx) => (
              <div key={section.id} className="section-container">
                <div className="section-header-edit">
                  <div className="title-area">
                    <FiMove className="drag-handle" />
                    <input 
                      type="text" 
                      value={section.title} 
                      onChange={(e) => {
                        const newSections = [...sections];
                        newSections[sIdx].title = e.target.value;
                        setSections(newSections);
                      }}
                    />
                  </div>
                  <div className="section-actions">
                    <button className="btn-icon"><FiTrash2 /></button>
                  </div>
                </div>

                <div className="lessons-list">
                  {section.lessons.map((lesson, lIdx) => (
                    <div key={lesson.id} className="lesson-item-edit">
                      <div className="lesson-main">
                        <FiMove className="drag-handle-small" />
                        {lesson.type === 'video' ? <FiVideo /> : <FiFileText />}
                        <span className="lesson-title">{lesson.title}</span>
                      </div>
                      <div className="lesson-actions">
                        <button className="btn-edit-content"><FiUpload /> Content</button>
                        <button className="btn-icon-small"><FiTrash2 /></button>
                      </div>
                    </div>
                  ))}
                  <button className="btn-add-lesson">
                    <FiPlus /> Add Lesson
                  </button>
                </div>
              </div>
            ))}

            <button className="btn-add-section">
              <FiPlus /> Add New Section
            </button>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default CourseEditor;
