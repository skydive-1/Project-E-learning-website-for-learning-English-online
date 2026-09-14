const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const analyticsService = require('../src/modules/analytic/services/analytic.service');
const db = require('../src/config/database');

describe('Analytics Time Range Support (7days, 30days, year)', () => {
    it('getUserHeatmap forwards range and returns mapped rows', async () => {
        const originalQuery = db.query;
        try {
            const mockRows = [
                { study_date: '2026-09-08', total_minutes: '15' },
                { study_date: '2026-09-09', total_minutes: '0' }
            ];

            let capturedSql = '';
            let capturedParams = [];

            db.query = async (sql, params) => {
                capturedSql = sql;
                capturedParams = params;
                return { rows: mockRows };
            };

            // Test with range = '7days'
            const result7 = await analyticsService.getUserHeatmap(10, null, '7days');
            assert.deepEqual(result7, mockRows);
            assert.deepEqual(capturedParams, [10, '7days', null]);
            assert.ok(capturedSql.includes('WITH bounds AS'));

            // Test with year and range = 'year'
            await analyticsService.getUserHeatmap(10, 2026, 'year');
            assert.deepEqual(capturedParams, [10, 'year', '2026']);

            // Test with 2-arg call passing range as 2nd arg
            await analyticsService.getUserHeatmap(10, '30days');
            assert.deepEqual(capturedParams, [10, '30days', null]);
        } finally {
            db.query = originalQuery;
        }
    });

    it('getUserAnalyticsSummary calculates stats and comparison labels by range', async () => {
        const originalQuery = db.query;
        try {
            db.query = async (sql, params) => {
                if (sql.includes('learning_ss, bounds b')) {
                    return {
                        rows: [{
                            current_minutes: '90',
                            prev_minutes: '45',
                            all_time_minutes: '300'
                        }]
                    };
                }
                if (sql.includes('user_progress, bounds b')) {
                    return {
                        rows: [{
                            period_completed: '2',
                            all_time_completed: '5'
                        }]
                    };
                }
                if (sql.includes('quiz_attempts, bounds b')) {
                    return {
                        rows: [{
                            period_attempts: '3',
                            period_avg_score: '85.5',
                            all_time_attempts: '10',
                            all_time_avg_score: '78.0'
                        }]
                    };
                }
                if (sql.includes('EXTRACT(DOW FROM start_at)')) {
                    return {
                        rows: [{ dow: '1', minutes: '30' }]
                    };
                }
                if (sql.includes('WITH weeks AS')) {
                    return {
                        rows: [{ wk_start: '2026-09-01', minutes: '45' }]
                    };
                }
                if (sql.includes('WITH months AS')) {
                    return {
                        rows: [{ m: 1, minutes: '60' }]
                    };
                }
                if (sql.includes('TO_CHAR(completed_at, \'DD/MM\')')) {
                    return {
                        rows: [{ time_label: '14/09', attempts: '2', avg_score: '85' }]
                    };
                }
                if (sql.includes('DATE_TRUNC(\'week\', completed_at)')) {
                    return {
                        rows: [{ week_start: '2026-09-01', attempts: '2', avg_score: '80' }]
                    };
                }
                if (sql.includes('DATE_TRUNC(\'month\', completed_at)')) {
                    return {
                        rows: [{ month_start: '2026-09-01', month_label: 'Sep', attempts: '2', avg_score: '80' }]
                    };
                }
                if (sql.includes('course_stats AS')) {
                    return {
                        rows: [{ completed: '1', in_progress: '2', not_started: '3' }]
                    };
                }
                if (sql.includes('quiz_attempts qa')) {
                    return {
                        rows: [{ difficulty: 'Medium', avg_score: '85', cnt: '2' }]
                    };
                }
                if (sql.includes('DISTINCT (start_at::date)')) {
                    return {
                        rows: [{ day: new Date().toISOString().slice(0, 10) }]
                    };
                }
                return { rows: [] };
            };

            // 1. Range = 7days
            const summary7 = await analyticsService.getUserAnalyticsSummary(10, '7days');
            assert.equal(summary7.kpi.activeRange, '7days');
            assert.equal(summary7.kpi.periodComparisonLabel, 'so với 7 ngày trước');
            assert.equal(summary7.kpi.totalStudyMinutes, 90);
            assert.equal(summary7.kpi.totalStudyHours, '1.5');
            assert.equal(summary7.kpi.weeklyGrowthPercent, 100); // (90 - 45) / 45 * 100
            assert.equal(summary7.kpi.completedLessonsCount, 2);
            assert.equal(summary7.kpi.totalQuizzesTaken, 3);
            assert.equal(summary7.kpi.avgQuizScorePercent, 85.5);

            // 2. Range = 30days
            const summary30 = await analyticsService.getUserAnalyticsSummary(10, '30days');
            assert.equal(summary30.kpi.activeRange, '30days');
            assert.equal(summary30.kpi.periodComparisonLabel, 'so với 30 ngày trước');

            // 3. Range = year
            const summaryYear = await analyticsService.getUserAnalyticsSummary(10, 'year');
            assert.equal(summaryYear.kpi.activeRange, 'year');
            assert.equal(summaryYear.kpi.periodComparisonLabel, 'so với năm trước');
        } finally {
            db.query = originalQuery;
        }
    });
});
