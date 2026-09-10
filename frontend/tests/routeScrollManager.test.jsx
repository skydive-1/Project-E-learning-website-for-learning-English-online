import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Link, MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import RouteScrollManager from '../src/components/common/RouteScrollManager';

const NavigationFixture = () => {
  const navigate = useNavigate();
  return (
    <>
      <Link to="/next">Mở module tiếp theo</Link>
      <button type="button" onClick={() => navigate({ search: '?filter=ielts' }, { replace: true })}>
        Đổi bộ lọc
      </button>
      <button type="button" onClick={() => navigate(-1)}>Quay lại</button>
    </>
  );
};

const NextFixture = () => {
  const navigate = useNavigate();
  return (
    <>
      <h1>Module tiếp theo</h1>
      <button type="button" onClick={() => navigate(-1)}>Quay lại</button>
    </>
  );
};

const renderRouter = (initialEntries = ['/start'], initialIndex) => render(
  <MemoryRouter initialEntries={initialEntries} initialIndex={initialIndex}>
    <RouteScrollManager />
    <Routes>
      <Route path="/start" element={<NavigationFixture />} />
      <Route path="/next" element={<NextFixture />} />
      <Route path="/" element={<section id="features">Tính năng</section>} />
    </Routes>
  </MemoryRouter>
);

describe('RouteScrollManager', () => {
  let scrollIntoView;
  let originalScrollTo;
  let originalScrollIntoView;

  beforeEach(() => {
    originalScrollTo = window.scrollTo;
    originalScrollIntoView = Element.prototype.scrollIntoView;
    window.scrollTo = vi.fn();
    scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
  });

  afterEach(() => {
    window.scrollTo = originalScrollTo;
    Element.prototype.scrollIntoView = originalScrollIntoView;
    vi.restoreAllMocks();
  });

  it('resets to the top when navigating to another module', () => {
    renderRouter();
    fireEvent.click(screen.getByRole('link', { name: 'Mở module tiếp theo' }));

    expect(screen.getByRole('heading', { name: 'Module tiếp theo' })).toBeInTheDocument();
    expect(window.scrollTo).toHaveBeenLastCalledWith({ top: 0, left: 0, behavior: 'auto' });
  });

  it('preserves scroll for query-only filters and browser back navigation', () => {
    renderRouter(['/start', '/next'], 0);
    fireEvent.click(screen.getByRole('button', { name: 'Đổi bộ lọc' }));
    expect(window.scrollTo).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('link', { name: 'Mở module tiếp theo' }));
    window.scrollTo.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Quay lại' }));
    expect(screen.getByRole('link', { name: 'Mở module tiếp theo' })).toBeInTheDocument();
    expect(window.scrollTo).not.toHaveBeenCalled();
  });

  it('scrolls cross-route hash links to their real destination', () => {
    render(
      <MemoryRouter initialEntries={['/start']}>
        <RouteScrollManager />
        <Routes>
          <Route path="/start" element={<Link to="/#features">Mở tính năng</Link>} />
          <Route path="/" element={<section id="features">Tính năng</section>} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('link', { name: 'Mở tính năng' }));
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start', behavior: 'auto' });
  });
});
