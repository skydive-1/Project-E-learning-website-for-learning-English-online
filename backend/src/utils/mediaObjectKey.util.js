'use strict';

const path = require('path');

function slugifyCourseName(value) {
  return String(value || '')
    .trim()
    .replace(/[đĐ]/g, character => (character === 'Đ' ? 'D' : 'd'))
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function normalizeCourseId(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function buildCourseFolder({ courseName, courseId, fallbackId = 'draft' } = {}) {
  const normalizedId = normalizeCourseId(courseId);
  const slug = slugifyCourseName(courseName) || 'course';
  const suffix = normalizedId || String(fallbackId || 'draft').replace(/[^a-zA-Z0-9_-]/g, '-');
  return `${slug}-${suffix}`;
}

function buildOrderedFolder(order, title, fallbackTitle) {
  const parsedOrder = Number.parseInt(order, 10);
  const safeOrder = Number.isSafeInteger(parsedOrder) && parsedOrder > 0 ? parsedOrder : 0;
  const orderLabel = String(safeOrder).padStart(2, '0');
  const titleSlug = slugifyCourseName(title) || fallbackTitle;
  return `${orderLabel}-${titleSlug}`;
}

function buildCourseAssetPrefix({
  courseName,
  courseId,
  fallbackId,
  sectionName,
  sectionOrder,
  lessonName,
  lessonOrder,
  mediaKind,
  assetId
}) {
  const pluralKinds = {
    video: 'videos',
    pdf: 'documents',
    document: 'documents',
    audio: 'audio',
    image: 'images',
    subtitle: 'subtitles'
  };
  const kindFolder = pluralKinds[String(mediaKind || '').toLowerCase()] || 'media';
  const safeAssetId = String(assetId || '').replace(/[^a-zA-Z0-9_-]/g, '');
  if (!safeAssetId) throw new Error('assetId không hợp lệ');
  const parts = [
    'courses',
    buildCourseFolder({ courseName, courseId, fallbackId })
  ];
  if (sectionName || sectionOrder) {
    parts.push('sections', buildOrderedFolder(sectionOrder, sectionName, 'section'));
  }
  if (lessonName || lessonOrder) {
    parts.push('lessons', buildOrderedFolder(lessonOrder, lessonName, 'lesson'));
  }
  parts.push(kindFolder, safeAssetId);
  return path.posix.join(...parts);
}

module.exports = {
  slugifyCourseName,
  normalizeCourseId,
  buildCourseFolder,
  buildOrderedFolder,
  buildCourseAssetPrefix
};
