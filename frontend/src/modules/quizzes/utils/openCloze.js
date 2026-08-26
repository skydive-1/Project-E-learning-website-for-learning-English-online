const GAP_MARKER_PATTERN = /\{\{\s*([A-Za-z0-9_-]+)\s*\}\}/g;

export const extractClozeGapIds = (template = '') => {
  const ids = [];
  GAP_MARKER_PATTERN.lastIndex = 0;
  let match;
  while ((match = GAP_MARKER_PATTERN.exec(String(template))) !== null) {
    ids.push(String(match[1]));
  }
  return ids;
};

export const syncClozeGaps = (template, currentGaps = []) => {
  const existingById = new Map((Array.isArray(currentGaps) ? currentGaps : [])
    .filter(gap => gap && typeof gap === 'object')
    .map(gap => [String(gap.id), gap]));

  return [...new Set(extractClozeGapIds(template))].map(id => ({
    id,
    answer: String(existingById.get(id)?.answer || ''),
    acceptedAnswers: Array.isArray(existingById.get(id)?.acceptedAnswers)
      ? existingById.get(id).acceptedAnswers
      : [],
    hint: String(existingById.get(id)?.hint || '')
  }));
};

export const tokenizeClozeTemplate = (template = '') => {
  const tokens = [];
  const text = String(template);
  let cursor = 0;
  let match;

  GAP_MARKER_PATTERN.lastIndex = 0;
  while ((match = GAP_MARKER_PATTERN.exec(text)) !== null) {
    if (match.index > cursor) tokens.push({ type: 'text', value: text.slice(cursor, match.index) });
    tokens.push({ type: 'gap', id: String(match[1]) });
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) tokens.push({ type: 'text', value: text.slice(cursor) });

  return tokens;
};

export const validateClozeDraft = (question) => {
  const gapIds = extractClozeGapIds(question?.questionText || '');
  if (gapIds.length === 0) return 'Hãy thêm ít nhất một chỗ trống bằng cú pháp {{1}}.';
  if (new Set(gapIds).size !== gapIds.length) return 'Mỗi mã chỗ trống phải là duy nhất.';

  const gaps = Array.isArray(question?.options) ? question.options : [];
  const gapsById = new Map(gaps.map(gap => [String(gap.id), gap]));
  const missing = gapIds.filter(id => !String(gapsById.get(id)?.answer || '').trim());
  return missing.length > 0 ? `Chưa nhập đáp án cho ô ${missing.join(', ')}.` : '';
};
