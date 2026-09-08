import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mediaMocks = vi.hoisted(() => ({
  ensureTicket: vi.fn().mockResolvedValue({ success: true, expiresIn: 60 })
}));

vi.mock('../src/services/protectedVideo.service', () => ({
  ensurePublicVideoTicket: mediaMocks.ensureTicket,
  getProtectedPublicVideoUrl: (assetId) => `https://api.example.test/api/media/video/stream/${assetId}`
}));

import ProtectedVideo from '../src/components/common/ProtectedVideo';

describe('ProtectedVideo', () => {
  afterEach(() => vi.clearAllMocks());

  it('waits for an HttpOnly ticket and never renders a public MP4 URL', async () => {
    const contextMenu = vi.fn();
    render(
      <ProtectedVideo
        assetId="tired-ai-full"
        aria-label="Protected decorative video"
        onContextMenu={contextMenu}
        muted
      />
    );

    const video = screen.getByLabelText('Protected decorative video');
    expect(video.getAttribute('src')).toBeNull();

    await waitFor(() => {
      expect(video.src).toBe('https://api.example.test/api/media/video/stream/tired-ai-full');
    });
    expect(video.src).not.toContain('/videos/');
    expect(video).toHaveAttribute('data-idm-prevent-download', 'true');
    expect(video).toHaveAttribute('controlslist', 'nodownload noremoteplayback');
    expect(video).toHaveAttribute('crossorigin', 'use-credentials');
    expect(video).toHaveAttribute('disablepictureinpicture');
    expect(video).toHaveAttribute('disableremoteplayback');

    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    fireEvent(video, event);
    expect(event.defaultPrevented).toBe(true);
    expect(contextMenu).toHaveBeenCalledTimes(1);
  });
});
