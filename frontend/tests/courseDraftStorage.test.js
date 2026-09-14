import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildCourseDraftKey,
  loadCourseEditorDraft,
  removeCourseEditorDraft,
  saveCourseEditorDraft
} from '../src/modules/instructor/utils/courseDraftStorage';

describe('CourseEditor durable local drafts', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('scopes a draft to the current author and course', () => {
    expect(buildCourseDraftKey({ userId: 19, courseId: 42 })).toBe('19:42');
    expect(buildCourseDraftKey({ userId: 19 })).toBe('19:new');
  });

  it('round-trips the full course structure through the browser fallback', async () => {
    const originalIndexedDb = window.indexedDB;
    Object.defineProperty(window, 'indexedDB', { configurable: true, value: undefined });

    const snapshot = {
      version: 1,
      persistedCourseId: 42,
      courseName: 'IELTS Listening Intensive',
      subjectId: '1',
      academyRoadmap: 'ielts',
      sections: [{ id: 10, title: 'Chương 1', lessons: [{ id: 101, title: 'Bài 1', quizQuestions: [] }] }]
    };

    const result = await saveCourseEditorDraft('19:42', snapshot);
    const restored = await loadCourseEditorDraft('19:42');

    expect(result.storage).toBe('localStorage');
    expect(restored.snapshot).toEqual(snapshot);
    expect(restored.filesPreserved).toBe(true);

    await removeCourseEditorDraft('19:42');
    expect(await loadCourseEditorDraft('19:42')).toBeNull();

    Object.defineProperty(window, 'indexedDB', { configurable: true, value: originalIndexedDb });
  });

  it('keeps form data and reports when binary attachments need reselection in fallback mode', async () => {
    const originalIndexedDb = window.indexedDB;
    Object.defineProperty(window, 'indexedDB', { configurable: true, value: undefined });
    const pdf = new File(['draft'], 'lesson-notes.pdf', { type: 'application/pdf' });

    const result = await saveCourseEditorDraft(
      '19:new',
      { courseName: 'Khóa học đang soạn', sections: [] },
      { tempLesson: pdf }
    );
    const restored = await loadCourseEditorDraft('19:new');

    expect(result.filesPreserved).toBe(false);
    expect(restored.snapshot.courseName).toBe('Khóa học đang soạn');
    expect(restored.stagedMaterials).toEqual({});
    expect(restored.filesPreserved).toBe(false);

    Object.defineProperty(window, 'indexedDB', { configurable: true, value: originalIndexedDb });
  });
});
