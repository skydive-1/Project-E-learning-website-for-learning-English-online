const { describe, test } = require('node:test');
const assert = require('node:assert/strict');

const {
  slugifyCourseName,
  buildCourseFolder,
  buildCourseAssetPrefix
} = require('../src/utils/mediaObjectKey.util');

describe('Course-scoped R2 object keys', () => {
  test('normalizes a Vietnamese course title into a stable folder', () => {
    assert.equal(slugifyCourseName('Tiếng Anh Giao Tiếp Cơ Bản'), 'tieng-anh-giao-tiep-co-ban');
    assert.equal(
      buildCourseFolder({ courseName: 'Tiếng Anh Giao Tiếp Cơ Bản', courseId: 12 }),
      'tieng-anh-giao-tiep-co-ban-12'
    );
  });

  test('builds separate video and document folders under the course', () => {
    assert.equal(
      buildCourseAssetPrefix({
        courseName: 'IELTS 6.5+', courseId: 7, mediaKind: 'video', assetId: 'asset-1'
      }),
      'courses/ielts-6-5-7/videos/asset-1'
    );
    assert.equal(
      buildCourseAssetPrefix({
        courseName: 'IELTS 6.5+', courseId: 7, mediaKind: 'pdf', assetId: 'asset-2'
      }),
      'courses/ielts-6-5-7/documents/asset-2'
    );
  });

  test('orders media by section and lesson for automatic course uploads', () => {
    assert.equal(
      buildCourseAssetPrefix({
        courseName: 'Tiếng Anh Giao Tiếp',
        courseId: 12,
        sectionName: 'Phát âm cơ bản',
        sectionOrder: 1,
        lessonName: 'Nguyên âm',
        lessonOrder: 2,
        mediaKind: 'video',
        assetId: 'asset-3'
      }),
      'courses/tieng-anh-giao-tiep-12/sections/01-phat-am-co-ban/lessons/02-nguyen-am/videos/asset-3'
    );
  });

  test('uses a deterministic draft fallback when a new course has no id yet', () => {
    assert.equal(
      buildCourseFolder({ courseName: 'Khóa mới', fallbackId: 'draft-25' }),
      'khoa-moi-draft-25'
    );
  });
});
