import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AnalyticsDashboardPage from '../src/modules/analytics/pages/AnalyticsDashboardPage';
import * as analyticsService from '../src/modules/analytics/services/analytics.service';

vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 4, role_id: 1, full_name: 'Quốc Anh' } })
}));

vi.mock('../src/context/LanguageContext', () => ({
  useLanguage: () => ({ language: 'VIE', t: (s) => s })
}));

vi.mock('../src/components/common/Header', () => ({
  default: () => <div data-testid="mock-header">Header</div>
}));

vi.mock('../src/components/common/Footer', () => ({
  default: () => <div data-testid="mock-footer">Footer</div>
}));

// Recharts ResponsiveContainer needs size in jsdom
vi.mock('recharts', async () => {
  const actual = await vi.importActual('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({ children }) => <div style={{ width: 500, height: 300 }}>{children}</div>
  };
});

describe('Analytics Dashboard Time Range Filtering', () => {
  const mockHeatmap7 = [
    { date: '2026-09-08', count: 0, intensity: 0 },
    { date: '2026-09-09', count: 0, intensity: 0 },
    { date: '2026-09-10', count: 0, intensity: 0 },
    { date: '2026-09-11', count: 10, intensity: 1 },
    { date: '2026-09-12', count: 20, intensity: 2 },
    { date: '2026-09-13', count: 35, intensity: 3 },
    { date: '2026-09-14', count: 5, intensity: 1 }
  ];

  const mockHeatmap30 = Array.from({ length: 30 }, (_, i) => ({
    date: `2026-09-${String(i + 1).padStart(2, '0')}`,
    count: i * 2,
    intensity: i % 4
  }));

  const mockSummary = (range) => ({
    kpi: {
      totalStudyMinutes: range === '7days' ? 70 : range === 'year' ? 1200 : 300,
      totalStudyHours: range === '7days' ? '1.2' : range === 'year' ? '20.0' : '5.0',
      allTimeStudyHours: '20.0',
      completedLessonsCount: range === '7days' ? 1 : 4,
      allTimeCompletedLessonsCount: 4,
      totalQuizzesTaken: range === '7days' ? 1 : 2,
      allTimeQuizzesTaken: 2,
      avgQuizScorePercent: range === '7days' ? 80 : 75,
      allTimeAvgQuizScorePercent: 75,
      currentStreakDays: 4,
      weeklyGrowthPercent: range === '7days' ? -25.5 : 100,
      periodComparisonLabel: range === '7days' ? 'so với 7 ngày trước' : range === 'year' ? 'so với năm trước' : 'so với 30 ngày trước',
      activeRange: range
    },
    weeklyActivity: [
      { day: 'Thứ 2', minutes: 15 },
      { day: 'Thứ 3', minutes: 20 }
    ],
    quizTrends: [
      { week: 'Tuần 1', score: 80, attempts: 1 }
    ],
    courseCompletion: [
      { name: 'Đã hoàn thành', value: 1, color: '#10b981' }
    ],
    skillRadar: [
      { skill: 'Phát âm (Speaking)', A: 80, fullMark: 100 }
    ]
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(analyticsService, 'getUserHeatmapData').mockImplementation(async (range) => {
      if (range === '7days') return mockHeatmap7;
      return mockHeatmap30;
    });
    vi.spyOn(analyticsService, 'getUserAnalyticsSummary').mockImplementation(async (range) => {
      return mockSummary(range);
    });
  });

  it('loads with 30days by default, passing 30days to both heatmap and summary service', async () => {
    render(
      <MemoryRouter>
        <AnalyticsDashboardPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(analyticsService.getUserHeatmapData).toHaveBeenCalledWith('30days');
      expect(analyticsService.getUserAnalyticsSummary).toHaveBeenCalledWith('30days');
    });

    // Verify 30days title
    expect(await screen.findByText(/Biểu đồ Nhiệt độ rèn luyện 30 ngày qua/i)).toBeInTheDocument();
  });

  it('switches to 7days when 7 ngày button is clicked and fetches updated data', async () => {
    render(
      <MemoryRouter>
        <AnalyticsDashboardPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(analyticsService.getUserHeatmapData).toHaveBeenCalledWith('30days');
    });

    // Click 7 ngày button
    const btn7Days = screen.getByRole('button', { name: '7 ngày' });
    fireEvent.click(btn7Days);

    await waitFor(() => {
      expect(analyticsService.getUserHeatmapData).toHaveBeenCalledWith('7days');
      expect(analyticsService.getUserAnalyticsSummary).toHaveBeenCalledWith('7days');
    });

    // Verify 7days title and comparison text
    expect(await screen.findByText(/Biểu đồ Nhiệt độ rèn luyện 7 ngày qua/i)).toBeInTheDocument();
    expect(await screen.findByText(/so với 7 ngày trước/i)).toBeInTheDocument();
  });

  it('switches to year when Cả năm button is clicked and fetches updated data', async () => {
    render(
      <MemoryRouter>
        <AnalyticsDashboardPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(analyticsService.getUserHeatmapData).toHaveBeenCalledWith('30days');
    });

    // Click Cả năm button
    const btnYear = screen.getByRole('button', { name: 'Cả năm' });
    fireEvent.click(btnYear);

    await waitFor(() => {
      expect(analyticsService.getUserHeatmapData).toHaveBeenCalledWith('year');
      expect(analyticsService.getUserAnalyticsSummary).toHaveBeenCalledWith('year');
    });

    // Verify year title and comparison text
    expect(await screen.findByText(/Biểu đồ Nhiệt độ rèn luyện trong năm/i)).toBeInTheDocument();
    expect(await screen.findByText(/so với năm trước/i)).toBeInTheDocument();
  });
});
