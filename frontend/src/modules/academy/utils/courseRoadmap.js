import apiClient from '../../../config/api.config';

export const ACADEMY_COURSES_QUERY_KEY = ['courses'];

const SUBJECT_ROADMAP_DEFAULTS = {
  1: 'ielts',
  2: 'toeic',
  4: 'basic',
  5: 'basic'
};

export const getDefaultRoadmapIdForSubject = (subjectId) => (
  SUBJECT_ROADMAP_DEFAULTS[String(subjectId)] || ''
);

export const fetchAcademyCourses = async () => {
  const response = await apiClient.get('/courses');
  if (!Array.isArray(response.data?.courses)) {
    throw new Error('Phản hồi danh sách khóa học không đúng định dạng.');
  }
  return response.data.courses;
};

const normalizeCatalogText = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();

const containsAnyTerm = (value, terms = []) => {
  const normalizedValue = normalizeCatalogText(value);
  return terms.some((term) => normalizedValue.includes(normalizeCatalogText(term)));
};

export const courseMatchesRoadmap = (course, roadmap) => {
  if (!course || !roadmap) return false;

  const explicitRoadmap = String(course.academy_roadmap || '').trim().toLowerCase();
  if (explicitRoadmap) return explicitRoadmap === roadmap.id;

  const subjectId = String(course.subject_id ?? '');
  const subjectIds = (roadmap.subjectFilters || [roadmap.subjectFilter])
    .filter(Boolean)
    .map(String);
  const searchableCourseText = [course.course_name, course.description].filter(Boolean).join(' ');

  return subjectIds.includes(subjectId)
    || containsAnyTerm(course.subject_name, roadmap.subjectTerms)
    || containsAnyTerm(searchableCourseText, roadmap.courseTerms);
};

export const getCoursesForRoadmap = (courses, roadmap) => (
  Array.isArray(courses) ? courses.filter((course) => courseMatchesRoadmap(course, roadmap)) : []
);

export const getRoadmapCatalogUrl = (roadmapId) => (
  `/courses?roadmap=${encodeURIComponent(roadmapId)}`
);
