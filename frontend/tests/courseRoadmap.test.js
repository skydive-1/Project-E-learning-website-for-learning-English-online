import { describe, expect, it } from 'vitest';
import { roadmapPaths } from '../src/modules/academy/data/roadmapPaths';
import {
  courseMatchesRoadmap,
  getCoursesForRoadmap,
  getRoadmapCatalogUrl
} from '../src/modules/academy/utils/courseRoadmap';

describe('academy course roadmap matching', () => {
  const basic = roadmapPaths.find((roadmap) => roadmap.id === 'basic');
  const toeic = roadmapPaths.find((roadmap) => roadmap.id === 'toeic');

  it('matches the current production basic course by subject 5', () => {
    expect(courseMatchesRoadmap({
      course_name: 'Tiếng Anh cơ bản',
      subject_id: 5,
      subject_name: 'English Grammar Essentials'
    }, basic)).toBe(true);
  });

  it('falls back to stable metadata when numeric subject ids differ', () => {
    expect(courseMatchesRoadmap({
      course_name: 'Luyện đề TOEIC 700',
      subject_id: 99,
      subject_name: 'Exam Preparation'
    }, toeic)).toBe(true);
  });

  it('uses explicit instructor metadata before legacy subject inference', () => {
    const course = {
      course_name: 'Khóa học luyện thi mới',
      subject_id: 5,
      academy_roadmap: 'toeic'
    };

    expect(courseMatchesRoadmap(course, basic)).toBe(false);
    expect(courseMatchesRoadmap(course, toeic)).toBe(true);
  });

  it('returns only matching courses and builds the filtered catalog URL', () => {
    const courses = [
      { course_id: 1, course_name: 'TOEIC Listening', subject_id: 2 },
      { course_id: 2, course_name: 'IELTS Writing', subject_id: 1 }
    ];

    expect(getCoursesForRoadmap(courses, toeic)).toEqual([courses[0]]);
    expect(getRoadmapCatalogUrl('toeic')).toBe('/courses?roadmap=toeic');
  });
});
