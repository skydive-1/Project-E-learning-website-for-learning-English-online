'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { describe, it } = require('node:test');
const coursesService = require('../src/modules/courses/services/courses.service');

describe('Academy roadmap course automation', () => {
  it('accepts an explicit supported roadmap as the source of truth', () => {
    assert.equal(
      coursesService._resolveAcademyRoadmap('TOEIC', { subjectId: 5 }),
      'toeic'
    );
  });

  it('infers roadmap metadata for backward-compatible subject ids', () => {
    assert.equal(coursesService._resolveAcademyRoadmap(undefined, { subjectId: 1 }), 'ielts');
    assert.equal(coursesService._resolveAcademyRoadmap(undefined, { subjectId: 2 }), 'toeic');
    assert.equal(coursesService._resolveAcademyRoadmap(undefined, { subjectId: 4 }), 'basic');
    assert.equal(coursesService._resolveAcademyRoadmap(undefined, { subjectId: 5 }), 'basic');
  });

  it('rejects unsupported roadmap values before they reach SQL', () => {
    assert.throws(
      () => coursesService._resolveAcademyRoadmap('advanced-plus', { subjectId: 1 }),
      (error) => error.code === 'INVALID_ACADEMY_ROADMAP' && error.status === 400
    );
  });

  it('prevents browser caching from hiding newly published courses', () => {
    const controllerSource = fs.readFileSync(
      path.join(__dirname, '../src/modules/courses/controllers/courses.controller.js'),
      'utf8'
    );
    assert.match(controllerSource, /res\.set\('Cache-Control', 'no-store'\)/);
  });
});
