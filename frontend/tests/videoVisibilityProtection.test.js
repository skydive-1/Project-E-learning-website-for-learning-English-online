import { describe, expect, it, vi } from 'vitest';
import {
  getVisibilityBlackoutPolicy,
  getWindowBlurBlackoutPolicy,
  pauseLessonPlayback,
  resumeLessonPlayback
} from '../src/modules/lessons/utils/videoVisibilityProtection';

describe('video visibility protection', () => {
  it('pauses playback when the user changes browser tabs', () => {
    expect(getVisibilityBlackoutPolicy()).toEqual({
      blackout: true,
      pausePlayback: true
    });
  });

  it.each([
    { altPressed: true },
    { metaPressed: true },
    { preservePlayback: true }
  ])('keeps playback running for an operating-system window switch: %o', (modifiers) => {
    expect(getVisibilityBlackoutPolicy(modifiers)).toEqual({
      blackout: true,
      pausePlayback: false
    });
  });

  it('keeps playback running when the browser window loses focus', () => {
    expect(getWindowBlurBlackoutPolicy()).toEqual({
      blackout: true,
      pausePlayback: false
    });
  });

  it('pauses both an MP4 element and a YouTube iframe through the Player API', () => {
    const pause = vi.fn();
    const postMessage = vi.fn();
    const videoElement = { paused: false, pause };
    const iframe = {
      src: 'https://www.youtube.com/embed/KiNV60Ce7kE?enablejsapi=1',
      contentWindow: { postMessage }
    };
    const containerElement = { querySelector: vi.fn(() => iframe) };

    const shouldResume = pauseLessonPlayback({ videoElement, containerElement });

    expect(shouldResume).toBe(true);
    expect(pause).toHaveBeenCalledOnce();
    expect(containerElement.querySelector).toHaveBeenCalledWith(
      'iframe[src*="youtube.com/embed"], iframe[src*="youtube-nocookie.com/embed"]'
    );
    expect(postMessage).toHaveBeenCalledWith(
      JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] }),
      'https://www.youtube.com'
    );
  });

  it('resumes both MP4 and YouTube playback after returning to the lesson tab', () => {
    const play = vi.fn(() => Promise.resolve());
    const postMessage = vi.fn();
    const videoElement = { paused: true, play };
    const iframe = {
      src: 'https://www.youtube-nocookie.com/embed/KiNV60Ce7kE?enablejsapi=1',
      contentWindow: { postMessage }
    };
    const containerElement = { querySelector: vi.fn(() => iframe) };

    resumeLessonPlayback({ videoElement, containerElement });

    expect(play).toHaveBeenCalledOnce();
    expect(postMessage).toHaveBeenCalledWith(
      JSON.stringify({ event: 'command', func: 'playVideo', args: [] }),
      'https://www.youtube-nocookie.com'
    );
  });

  it('does not mark an already-paused MP4 for automatic resume', () => {
    const videoElement = { paused: true, pause: vi.fn() };
    const containerElement = { querySelector: vi.fn(() => null) };

    expect(pauseLessonPlayback({ videoElement, containerElement })).toBe(false);
    expect(videoElement.pause).not.toHaveBeenCalled();
  });
});
