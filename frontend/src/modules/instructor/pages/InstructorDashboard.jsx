import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  FiPlus, FiBook, FiUsers, FiTrendingUp, FiSettings, 
  FiEdit, FiTrash2, FiEye, FiMoreVertical 
} from 'react-icons/fi';
import Header from '../../../components/common/Header';
import Footer from '../../../components/common/Footer';
import '../styles/instructor.scss';

const InstructorDashboard = () => {
  const navigate = useNavigate();
  const [courses, setCourses] = useState([
    {
      id: 'course-1',
      title: 'IELTS Masterclass: Target Band 7.5+',
      students: 15600,
      rating: 4.9,
      status: 'Published',
      lastUpdated: '2026-06-10'
    },
    {
      id: 'course-2',
      title: 'Business English for Professionals',
      students: 8900,
      rating: 4.8,
      status: 'Published',
      lastUpdated: '2026-05-25'
    }
  ]);

  return (
    <div className="instructor-page">
      <Header />
      
      <main className="instructor-container">
        <div className="instructor-sidebar">
          <div className="sidebar-brand">
            <h2>Instructor Hub</h2>
          </div>
          <nav className="sidebar-nav">
            <button className="active"><FiBook /> My Courses</button>
            <button><FiUsers /> Students</button>
            <button><FiTrendingUp /> Performance</button>
            <button><FiSettings /> Settings</button>
          </nav>
        </div>

        <div className="instructor-content">
          <header className="content-header">
            <div className="header-text">
              <h1>My Courses</h1>
              <p>Manage your educational content and student engagement.</p>
            </div>
            <button className="btn-create-course" onClick={() => navigate('/instructor/create-course')}>
              <FiPlus /> Create New Course
            </button>
          </header>

          <div className="stats-overview">
            <div className="stat-card">
              <span className="stat-label">Total Students</span>
              <span className="stat-value">24,500</span>
              <span className="stat-change positive">+12% this month</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Course Ratings</span>
              <span className="stat-value">4.85</span>
              <span className="stat-change positive">+0.1 from last month</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Active Courses</span>
              <span className="stat-value">2</span>
              <span className="stat-change">Updated recently</span>
            </div>
          </div>

          <div className="course-list-table-wrapper">
            <table className="course-list-table">
              <thead>
                <tr>
                  <th>Course</th>
                  <th>Students</th>
                  <th>Rating</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {courses.map(course => (
                  <tr key={course.id}>
                    <td>
                      <div className="course-info-cell">
                        <div className="course-thumb-mini">
                          <img src="/images/hero_illustration.png" alt="" />
                        </div>
                        <div className="course-details">
                          <span className="course-name">{course.title}</span>
                          <span className="course-date">Updated {course.lastUpdated}</span>
                        </div>
                      </div>
                    </td>
                    <td>{course.students.toLocaleString()}</td>
                    <td><FiStar className="star-icon" /> {course.rating}</td>
                    <td><span className="status-badge published">{course.status}</span></td>
                    <td className="actions-cell">
                      <button className="action-btn" title="Edit"><FiEdit /></button>
                      <button className="action-btn" title="View"><FiEye /></button>
                      <button className="action-btn delete" title="Delete"><FiTrash2 /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

const FiStar = ({ className }) => (
  <svg className={className} stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 24 24" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"></path>
  </svg>
);

export default InstructorDashboard;
