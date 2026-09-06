import { describe, it, expect, beforeEach } from 'vitest';
import { withPdfAuthToken } from '../src/modules/lessons/utils/pdfAuthUrl';

describe('withPdfAuthToken Utility Test Suite', () => {
  const MOCK_TOKEN = 'mock-jwt-token-xyz-123';

  beforeEach(() => {
    localStorage.clear();
  });

  it('1. should return original url when url is empty or non-string', () => {
    localStorage.setItem('token', MOCK_TOKEN);
    expect(withPdfAuthToken('')).toBe('');
    expect(withPdfAuthToken(null)).toBe(null);
    expect(withPdfAuthToken(undefined)).toBe(undefined);
  });

  it('2. should return original url when there is no token in localStorage', () => {
    const url = '/api/lessons/42/pdf';
    expect(withPdfAuthToken(url)).toBe(url);
  });

  it('3. should append token to relative /lessons/:id/pdf route', () => {
    localStorage.setItem('token', MOCK_TOKEN);
    const result = withPdfAuthToken('/api/lessons/42/pdf');
    expect(result).toBe(`/api/lessons/42/pdf?token=${MOCK_TOKEN}`);
  });

  it('4. should append token to relative /lessons/:id/pdf/download route', () => {
    localStorage.setItem('token', MOCK_TOKEN);
    const result = withPdfAuthToken('/api/lessons/42/pdf/download');
    expect(result).toBe(`/api/lessons/42/pdf/download?token=${MOCK_TOKEN}`);
  });

  it('5. should append token to relative /lessons/:id/materials/:matId/preview route', () => {
    localStorage.setItem('token', MOCK_TOKEN);
    const result = withPdfAuthToken('/api/lessons/42/materials/7/preview');
    expect(result).toBe(`/api/lessons/42/materials/7/preview?token=${MOCK_TOKEN}`);
  });

  it('6. should append token to relative /lessons/:id/materials/:matId/download route', () => {
    localStorage.setItem('token', MOCK_TOKEN);
    const result = withPdfAuthToken('/api/lessons/42/materials/7/download');
    expect(result).toBe(`/api/lessons/42/materials/7/download?token=${MOCK_TOKEN}`);
  });

  it('7. should preserve existing query parameters and append token', () => {
    localStorage.setItem('token', MOCK_TOKEN);
    const result = withPdfAuthToken('/api/lessons/42/pdf?stream=true');
    expect(result).toBe(`/api/lessons/42/pdf?stream=true&token=${MOCK_TOKEN}`);
  });

  it('8. should append token to absolute URLs without altering origin or pathname', () => {
    localStorage.setItem('token', MOCK_TOKEN);
    const absUrl = 'https://api.example.com/api/lessons/99/pdf';
    const result = withPdfAuthToken(absUrl);
    expect(result).toBe(`https://api.example.com/api/lessons/99/pdf?token=${MOCK_TOKEN}`);
  });

  it('9. should NOT append token to non-protected routes', () => {
    localStorage.setItem('token', MOCK_TOKEN);
    expect(withPdfAuthToken('/api/courses/1')).toBe('/api/courses/1');
    expect(withPdfAuthToken('/api/lessons/42/subtitles')).toBe('/api/lessons/42/subtitles');
    expect(withPdfAuthToken('/uploads/course_covers/intro.jpg')).toBe('/uploads/course_covers/intro.jpg');
    expect(withPdfAuthToken('https://external-cdn.com/document.pdf')).toBe('https://external-cdn.com/document.pdf');
  });
});
