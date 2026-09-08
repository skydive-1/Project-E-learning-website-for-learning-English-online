import { describe, expect, it } from 'vitest';

import { buildAiQuotaCsv, escapeCsvField } from '../src/modules/admin/utils/aiQuotaCsv';

describe('AI quota CSV report', () => {
  it('escapes commas, quotes, newlines and spreadsheet formulas safely', () => {
    expect(escapeCsvField('Nguyễn, "An"')).toBe('"Nguyễn, ""An"""');
    expect(escapeCsvField('=HYPERLINK("bad")')).toBe('"\'=HYPERLINK(""bad"")"');
  });

  it('exports one stable RFC-4180 column per metric', () => {
    const csv = buildAiQuotaCsv([{
      user_id: 7,
      full_name: 'Nguyễn, An',
      username: 'an07',
      email: 'an@example.com',
      role_id: 3,
      used_tokens: 1200,
      max_tokens: 6000,
      usage_percentage: 20,
      used_questions_24h: 4,
      question_limit_24h: 10,
      questions_remaining_24h: 6,
      question_quota_status: 'normal',
      question_reset_at: '2026-09-08T17:00:00.000Z',
      last_ai_activity_at: '2026-09-08T10:00:00.000Z'
    }]);

    const lines = csv.replace(/^\uFEFF/, '').split('\r\n');
    expect(lines).toHaveLength(2);
    expect(lines[0].split(',')).toHaveLength(15);
    expect(lines[1]).toContain('"Nguyễn, An"');
    expect(lines[1]).toContain('"1200","6000","20"');
    expect(lines[1]).toContain('"2026-09-08T17:00:00.000Z"');
  });
});
