import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import Plyr from 'plyr';
import plyrIconUrl from '../../../assets/plyr.svg?url';
import 'plyr/dist/plyr.css';

const BLANK_VIDEO_DATA_URI = 'data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDE=';

const PLAYER_OPTIONS = {
  controls: [
    'play-large',
    'rewind',
    'play',
    'fast-forward',
    'progress',
    'current-time',
    'duration',
    'mute',
    'volume',
    'captions',
    'settings',
    'fullscreen'
  ],
  settings: ['captions', 'speed'],
  seekTime: 10,
  speed: {
    selected: 1,
    options: [0.5, 0.75, 1, 1.25, 1.5, 2]
  },
  keyboard: {
    focused: true,
    global: false
  },
  tooltips: {
    controls: true,
    seek: true
  },
  fullscreen: {
    enabled: true,
    fallback: true,
    iosNative: false,
    container: '#lesson-media-wrapper'
  },
  storage: {
    enabled: true,
    key: 'elearn.lesson-player'
  },
  captions: {
    active: false,
    language: 'auto',
    update: true
  },
  iconUrl: plyrIconUrl,
  blankVideo: BLANK_VIDEO_DATA_URI,
  clickToPlay: false,
  disableContextMenu: true,
  i18n: {
    restart: 'Phát lại',
    rewind: 'Lùi {seektime} giây',
    play: 'Phát',
    pause: 'Tạm dừng',
    fastForward: 'Tới {seektime} giây',
    seek: 'Tua',
    played: 'Đã phát',
    buffered: 'Đã tải',
    currentTime: 'Thời gian hiện tại',
    duration: 'Thời lượng',
    volume: 'Âm lượng',
    mute: 'Tắt tiếng',
    unmute: 'Bật tiếng',
    captions: 'Phụ đề',
    disabled: 'Tắt',
    enabled: 'Bật',
    enterFullscreen: 'Toàn màn hình',
    exitFullscreen: 'Thoát toàn màn hình',
    settings: 'Cài đặt',
    speed: 'Tốc độ',
    normal: 'Bình thường'
  }
};

const LessonVideoPlayer = forwardRef(function LessonVideoPlayer(
  {
    title = 'Video bài giảng',
    className = '',
    tracks = [],
    onError,
    onContextMenu,
    onDragStart,
    ...videoProps
  },
  forwardedRef
) {
  const videoElementRef = useRef(null);
  const playerRef = useRef(null);
  const isDestroyingRef = useRef(false);

  useImperativeHandle(forwardedRef, () => videoElementRef.current, []);

  useEffect(() => {
    const videoElement = videoElementRef.current;
    const supportsEnhancedPlayer = typeof globalThis.TextTrack !== 'undefined';
    if (!videoElement || !supportsEnhancedPlayer) return undefined;

    let disposed = false;
    let player = null;

    const initializationTimer = window.setTimeout(() => {
      if (disposed || !videoElementRef.current?.isConnected) return;
      isDestroyingRef.current = false;
      player = new Plyr(videoElementRef.current, {
        ...PLAYER_OPTIONS,
        title
      });
      playerRef.current = player;
    }, 0);

    return () => {
      disposed = true;
      window.clearTimeout(initializationTimer);
      if (!player) return;

      isDestroyingRef.current = true;
      if (playerRef.current === player) playerRef.current = null;
      player.destroy();
    };
  }, []);

  const handleMediaSurfaceClick = (event) => {
    const interactiveControl = event.target.closest(
      '[data-plyr], .plyr__controls, .plyr__menu, button, input, select, a, [role="menu"]'
    );
    if (interactiveControl) return;

    const videoElement = videoElementRef.current;
    if (!videoElement || isDestroyingRef.current) return;

    if (videoElement.paused || videoElement.ended) {
      videoElement.play().catch(() => {});
    } else {
      videoElement.pause();
    }
  };

  return (
    <div className="lesson-plyr-host size-full" onClick={handleMediaSurfaceClick}>
      <video
        ref={videoElementRef}
        aria-label={title}
        className={`lesson-plyr-video ${className}`.trim()}
        {...videoProps}
        data-idm-prevent-download="true"
        controlsList="nodownload noremoteplayback"
        disablePictureInPicture
        disableRemotePlayback
        onContextMenu={(event) => {
          event.preventDefault();
          onContextMenu?.(event);
        }}
        onDragStart={(event) => {
          event.preventDefault();
          onDragStart?.(event);
        }}
        onError={(event) => {
          if (!isDestroyingRef.current) onError?.(event);
        }}
      >
        {tracks.map((track) => (
          <track
            key={`${track.srcLang}-${track.label}`}
            kind="captions"
            src={track.src}
            srcLang={track.srcLang}
            label={track.label}
            default={Boolean(track.default)}
          />
        ))}
      </video>
    </div>
  );
});

export default LessonVideoPlayer;
