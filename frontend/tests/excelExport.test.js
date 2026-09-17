import { describe, expect, it } from 'vitest';
import {
  AI_QUOTA_EXCEL_COLUMNS,
  USER_ANALYTICS_EXCEL_COLUMNS,
  buildAiQuotaExcelData,
  buildUserAnalyticsExcelData,
  formatReadableDate
} from '../src/modules/admin/utils/excelExport';
import writeExcelFile from 'write-excel-file/universal';

describe('Excel Export Utility (High-End Aesthetics)', () => {
  it('formats readable dates gracefully', () => {
    expect(formatReadableDate('2026-09-18T10:28:00.000Z')).toMatch(/^2026-09-18 \d{2}:28:00$/);
    expect(formatReadableDate(null)).toBe('-');
    expect(formatReadableDate('')).toBe('-');
  });

  it('builds styled AI Quota sheet data with all 15 columns, borders, and alignments', async () => {
    const mockUsers = [
      {
        user_id: 4,
        full_name: 'Quốc Anh',
        username: 'quocanh',
        email: 'quocanh@gmail.com',
        role_id: 1,
        used_tokens: 56286,
        max_tokens: 250000,
        usage_percentage: 23,
        used_questions_24h: 0,
        question_limit_24h: 50,
        questions_remaining_24h: 50,
        question_reset_at: '2026-09-18T10:28:00.004Z',
        question_quota_status: 'unused',
        last_ai_activity_at: '2026-09-17T03:59:54.790Z'
      },
      {
        user_id: 7,
        full_name: 'Nguyen Ly',
        username: 'nly',
        email: 'nly@gmail.com',
        role_id: 3,
        used_tokens: 37355,
        max_tokens: 250000,
        usage_percentage: 15,
        used_questions_24h: 7,
        question_limit_24h: 10,
        questions_remaining_24h: 3,
        question_reset_at: '2026-09-17T17:00:00.000Z',
        question_quota_status: 'warning',
        last_ai_activity_at: '2026-09-17T03:59:54.790Z'
      },
      {
        user_id: 10,
        full_name: 'VIP Student',
        username: 'vip',
        email: 'vip@gmail.com',
        role_id: 3,
        question_quota_unlimited: true,
        used_tokens: 1000,
        max_tokens: 250000,
        usage_percentage: 1,
        question_quota_status: 'unlimited'
      }
    ];

    const sheetData = buildAiQuotaExcelData(mockUsers);
    expect(sheetData).toHaveLength(4); // 1 header + 3 rows

    // Header validation
    const headerRow = sheetData[0];
    expect(headerRow).toHaveLength(15);
    expect(headerRow[0].value).toBe('STT');
    expect(headerRow[0].fontWeight).toBe('bold');
    expect(headerRow[0].backgroundColor).toBe('#1E293B');
    expect(headerRow[0].textColor).toBe('#FFFFFF');
    expect(headerRow[0].borderStyle).toBe('thin');

    // Data Row 1 (Admin)
    const row1 = sheetData[1];
    expect(row1).toHaveLength(15);
    expect(row1[0].value).toBe(1);
    expect(row1[2].value).toBe('Quốc Anh');
    expect(row1[2].fontWeight).toBe('bold');
    expect(row1[6].value).toBe(56286);
    expect(row1[6].format).toBe('#,##0');
    expect(row1[6].align).toBe('right');
    expect(row1[8].format).toBe('0%');
    expect(row1[13].value).toBe('Chưa sử dụng');

    // Data Row 2 (Zebra striping on odd index row)
    const row2 = sheetData[2];
    expect(row2[0].backgroundColor).toBe('#F8FAFC');
    expect(row2[13].value).toBe('Cảnh báo');

    // Data Row 3 (Unlimited questions handling)
    const row3 = sheetData[3];
    expect(row3[9].value).toBe('Không giới hạn');
    expect(row3[13].value).toBe('Không giới hạn');

    // Verify OpenXML generation
    const blob = await writeExcelFile(sheetData, {
      columns: AI_QUOTA_EXCEL_COLUMNS,
      stickyRowsCount: 1
    }).toBlob();
    expect(blob).toBeDefined();
    expect(blob.size).toBeGreaterThan(1000);
  });

  it('builds styled User Analytics sheet data with 12 columns and valid formatting', async () => {
    const mockLearners = [
      {
        user_id: 15,
        full_name: 'Lê Văn A',
        username: 'levana',
        email: 'a@example.com',
        engagement_status: 'active',
        progress_percent: 75,
        completed_lessons: 12,
        study_minutes: 180,
        average_quiz_score: 85.5,
        used_tokens: 4500,
        last_activity_at: '2026-09-17T08:30:00.000Z'
      }
    ];

    const statusMeta = {
      active: { label: 'Đang học tích cực' }
    };

    const sheetData = buildUserAnalyticsExcelData(mockLearners, statusMeta);
    expect(sheetData).toHaveLength(2); // 1 header + 1 row
    expect(sheetData[0]).toHaveLength(12);

    const dataRow = sheetData[1];
    expect(dataRow[0].value).toBe(1);
    expect(dataRow[2].value).toBe('Lê Văn A');
    expect(dataRow[5].value).toBe('Đang học tích cực');
    expect(dataRow[6].format).toBe('0%');
    expect(dataRow[7].format).toBe('#,##0');
    expect(dataRow[8].format).toBe('#,##0');

    // Verify OpenXML generation
    const blob = await writeExcelFile(sheetData, {
      columns: USER_ANALYTICS_EXCEL_COLUMNS,
      stickyRowsCount: 1
    }).toBlob();
    expect(blob).toBeDefined();
    expect(blob.size).toBeGreaterThan(1000);
  });
});
