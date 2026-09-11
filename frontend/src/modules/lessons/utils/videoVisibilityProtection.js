export const getVisibilityBlackoutPolicy = ({
  altPressed = false,
  metaPressed = false,
  preservePlayback = false
} = {}) => ({
  blackout: true,
  pausePlayback: !(altPressed || metaPressed || preservePlayback)
});

export const getWindowBlurBlackoutPolicy = () => ({
  blackout: true,
  pausePlayback: false
});

const getYouTubeIframe = (containerElement) => containerElement?.querySelector?.(
  'iframe[src*="youtube.com/embed"], iframe[src*="youtube-nocookie.com/embed"]'
);

export const pauseLessonPlayback = ({ videoElement, containerElement } = {}) => {
  let shouldResume = false;

  if (videoElement && !videoElement.paused) {
    shouldResume = true;
    videoElement.pause();
  }

  const iframe = getYouTubeIframe(containerElement);
  if (!iframe?.contentWindow) return shouldResume;

  // The YouTube iframe API cannot synchronously expose player state. A tab-hide
  // pause is therefore paired with a play command when the learner returns.
  shouldResume = true;

  let targetOrigin = 'https://www.youtube.com';
  try {
    targetOrigin = new URL(iframe.src).origin;
  } catch (_) {
    // Keep the safe YouTube default when an iframe URL cannot be parsed.
  }

  iframe.contentWindow.postMessage(
    JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] }),
    targetOrigin
  );

  return shouldResume;
};

export const resumeLessonPlayback = ({ videoElement, containerElement } = {}) => {
  if (videoElement?.paused) {
    videoElement.play().catch(() => {});
  }

  const iframe = getYouTubeIframe(containerElement);
  if (!iframe?.contentWindow) return;

  let targetOrigin = 'https://www.youtube.com';
  try {
    targetOrigin = new URL(iframe.src).origin;
  } catch (_) {
    // Keep the safe YouTube default when an iframe URL cannot be parsed.
  }

  iframe.contentWindow.postMessage(
    JSON.stringify({ event: 'command', func: 'playVideo', args: [] }),
    targetOrigin
  );
};
