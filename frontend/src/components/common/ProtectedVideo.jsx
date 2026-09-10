import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
  ensurePublicVideoTicket,
  getProtectedPublicVideoUrl
} from '../../services/protectedVideo.service';

const ProtectedVideo = forwardRef(function ProtectedVideo(
  { assetId, onContextMenu, onDragStart, onProtectionError, ...videoProps },
  forwardedRef
) {
  const videoRef = useRef(null);
  const [streamUrl, setStreamUrl] = useState('');

  useImperativeHandle(forwardedRef, () => videoRef.current, []);

  useEffect(() => {
    let active = true;

    ensurePublicVideoTicket()
      .then(() => {
        if (active) setStreamUrl(getProtectedPublicVideoUrl(assetId));
      })
      .catch((error) => {
        if (active) onProtectionError?.(error);
      });

    // Vé mặc định sống 60 giây. Mỗi 30 giây chỉ component đầu tiên thực sự gọi
    // API; các component còn lại dùng chung cache/promise và cookie mới.
    const renewalTimer = window.setInterval(() => {
      ensurePublicVideoTicket(35).catch((error) => {
        if (active) onProtectionError?.(error);
      });
    }, 30000);

    return () => {
      active = false;
      window.clearInterval(renewalTimer);
    };
  }, [assetId, onProtectionError]);

  const preventContextMenu = (event) => {
    event.preventDefault();
    onContextMenu?.(event);
  };

  const preventDragStart = (event) => {
    event.preventDefault();
    onDragStart?.(event);
  };

  return (
    <video
      {...videoProps}
      ref={videoRef}
      src={streamUrl || undefined}
      data-idm-prevent-download="true"
      crossOrigin="use-credentials"
      controlsList="nodownload noremoteplayback"
      disablePictureInPicture
      disableRemotePlayback
      onContextMenu={preventContextMenu}
      onDragStart={preventDragStart}
    />
  );
});

export default ProtectedVideo;
