import React from 'react';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const plyrMock = vi.hoisted(() => ({
  construct: vi.fn(),
  destroy: vi.fn()
}));

vi.mock('plyr', () => ({
  default: class MockPlyr {
    constructor(element, options) {
      plyrMock.construct(element, options);
      this.destroy = plyrMock.destroy;
    }
  }
}));

import LessonVideoPlayer from '../src/modules/lessons/components/LessonVideoPlayer';

describe('LessonVideoPlayer Plyr adapter', () => {
  const originalTextTrack = globalThis.TextTrack;

  beforeAll(() => {
    globalThis.TextTrack = class TextTrack {};
  });

  beforeEach(() => {
    plyrMock.construct.mockClear();
    plyrMock.destroy.mockClear();
  });

  afterEach(() => cleanup());

  afterAll(() => {
    if (originalTextTrack === undefined) delete globalThis.TextTrack;
    else globalThis.TextTrack = originalTextTrack;
  });

  it('uses native Plyr captions and renders WebVTT tracks on the shared video element', async () => {
    const videoRef = React.createRef();
    const tracks = [
      {
        srcLang: 'en-x-bilingual',
        label: 'Song ngữ (EN – VI)',
        src: 'blob:http://localhost/bilingual',
        default: true
      },
      {
        srcLang: 'en',
        label: 'English',
        src: 'blob:http://localhost/english'
      }
    ];

    const { unmount } = render(
      <React.StrictMode>
        <LessonVideoPlayer
          ref={videoRef}
          title="Bài học phát âm"
          src="/api/lessons/video/stream/42"
          controls
          tracks={tracks}
        />
      </React.StrictMode>
    );

    expect(videoRef.current).toBeInstanceOf(HTMLVideoElement);
    expect(videoRef.current).toHaveAttribute('data-idm-prevent-download', 'true');
    expect(videoRef.current).toHaveAttribute('controlslist', 'nodownload noremoteplayback');
    expect(videoRef.current.querySelectorAll('track')).toHaveLength(2);
    expect(videoRef.current.querySelector('track[default]')?.label).toBe('Song ngữ (EN – VI)');

    await waitFor(() => expect(plyrMock.construct).toHaveBeenCalledTimes(1));

    const [element, options] = plyrMock.construct.mock.calls[0];
    expect(element).toBe(videoRef.current);
    expect(options.title).toBe('Bài học phát âm');
    expect(options.controls).toEqual(expect.arrayContaining([
      'play-large',
      'progress',
      'captions',
      'settings',
      'fullscreen'
    ]));
    expect(options.settings).toEqual(['captions', 'speed']);
    expect(options.captions).toMatchObject({ active: false, update: true });
    expect(options.fullscreen.container).toBe('#lesson-media-wrapper');
    expect(options.iconUrl).toMatch(/\.svg(?:\?|$)/);
    expect(options.blankVideo).toMatch(/^data:video\/mp4;base64,/);
    expect(options.clickToPlay).toBe(false);

    const playSpy = vi.spyOn(videoRef.current, 'play').mockResolvedValue();
    fireEvent.click(videoRef.current);
    expect(playSpy).toHaveBeenCalledTimes(1);

    Object.defineProperty(videoRef.current, 'paused', {
      configurable: true,
      value: false
    });
    const pauseSpy = vi.spyOn(videoRef.current, 'pause').mockImplementation(() => {});
    fireEvent.click(videoRef.current);
    expect(pauseSpy).toHaveBeenCalledTimes(1);

    const controlsButton = document.createElement('button');
    controlsButton.dataset.plyr = 'play';
    videoRef.current.closest('.lesson-plyr-host').appendChild(controlsButton);
    fireEvent.click(controlsButton);
    expect(playSpy).toHaveBeenCalledTimes(1);
    expect(pauseSpy).toHaveBeenCalledTimes(1);

    unmount();
    expect(plyrMock.destroy).toHaveBeenCalledTimes(1);
  });
});
