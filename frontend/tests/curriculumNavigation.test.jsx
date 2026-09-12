import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import CurriculumSection from '../src/modules/homepage/components/CurriculumSection';

vi.mock('../src/context/LanguageContext', () => ({
  useLanguage: () => ({ t: (value) => value }),
}));

const MODULE_TITLES = [
  'Nền tảng phát âm chuẩn IPA & Ngữ điệu tự nhiên',
  'Phản xạ giao tiếp & Tư duy tiếng Anh trực diện',
  'Ngữ pháp ứng dụng & Viết luận chuyên nghiệp',
  'Thuyết trình, Đàm phán & Làm chủ môi trường quốc tế',
];

const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid="current-path">{location.pathname}</div>;
};

const renderCurriculum = () => render(
  <MemoryRouter initialEntries={['/']}>
    <Routes>
      <Route
        path="*"
        element={(
          <>
            <CurriculumSection />
            <LocationProbe />
          </>
        )}
      />
    </Routes>
  </MemoryRouter>,
);

describe('CurriculumSection academy navigation', () => {
  it.each(MODULE_TITLES)(
    'điều hướng nút lộ trình của tab "%s" sang /academy',
    (moduleTitle) => {
      renderCurriculum();

      const moduleCard = screen.getByText(moduleTitle).closest('.module-accordion-card');

      if (moduleTitle !== MODULE_TITLES[0]) {
        fireEvent.click(within(moduleCard).getByRole('button', { name: 'Expand module' }));
      }

      fireEvent.click(within(moduleCard).getByRole('button', { name: 'Khám phá lộ trình chi tiết' }));

      expect(screen.getByTestId('current-path')).toHaveTextContent('/academy');
    },
  );
});
