import React, { useState, useEffect } from 'react';
import { ExternalLink, Copy, Check, ShieldCheck, Info } from 'lucide-react';
import { extractYouTubeVideoId } from '../services/lessons.service';

const YouTubeIcon = ({ className = 'size-4 text-red-500' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
  </svg>
);

/**
 * LessonYouTubePlayer Component
 * 
 * Minimalist, high-performance YouTube educational player with academic citation.
 * Built adhering to /impeccable, /shadcn, and /minimalist-ui standards:
 * - 16:9 responsive theater container
 * - youtube-nocookie.com privacy-friendly embed
 * - Clean metadata bar with YouTube attribution and external action buttons
 * - Transparent copyright citation & fair use disclaimer
 */
const LessonYouTubePlayer = ({
  lesson,
  title = '',
  onEnded,
  className = ''
}) => {
  const [copied, setCopied] = useState(false);
  const [isIframeLoaded, setIsIframeLoaded] = useState(false);

  const rawUrl = lesson?.youtubeUrl || lesson?.contentUrl || lesson?.content_url || lesson?.videoUrl || '';
  const videoId = extractYouTubeVideoId(rawUrl);
  const displayTitle = title || lesson?.title || 'Video bài giảng';

  useEffect(() => {
    setIsIframeLoaded(false);
  }, [videoId]);

  const handleCopyLink = () => {
    if (!rawUrl) return;
    navigator.clipboard.writeText(rawUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  const handleOpenExternal = () => {
    if (!rawUrl) return;
    const targetUrl = videoId ? `https://www.youtube.com/watch?v=${videoId}` : rawUrl;
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
  };

  if (!videoId) {
    return (
      <div className="size-full min-h-[360px] flex flex-col items-center justify-center bg-zinc-950 text-zinc-300 p-6 text-center border border-zinc-850 rounded-xl">
        <div className="size-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 mb-3">
          <Info className="size-5 text-amber-400" />
        </div>
        <h3 className="text-sm font-semibold text-zinc-100 mb-1">
          Chưa có liên kết YouTube hợp lệ
        </h3>
        <p className="text-xs text-zinc-400 max-w-sm mb-4">
          Bài học này được cấu hình loại YouTube nhưng đường dẫn video chưa đúng định dạng.
        </p>
        {rawUrl && (
          <code className="text-[11px] font-mono bg-zinc-900 text-zinc-300 px-3 py-1.5 rounded border border-zinc-800 max-w-md truncate">
            {rawUrl}
          </code>
        )}
      </div>
    );
  }

  const embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1&enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}`;

  return (
    <div className={`flex flex-col w-full bg-zinc-950 select-none overflow-hidden rounded-xl border border-zinc-800/80 ${className}`}>
      {/* Top Header Bar: YouTube Branding + Academic Attribution + Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-zinc-900/90 border-b border-zinc-800/80 text-xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 font-medium">
            <YouTubeIcon className="size-3.5 text-red-500" />
            <span className="text-[11px] font-semibold tracking-wide">YouTube Edu</span>
          </div>
          <span className="text-zinc-400 text-xs truncate max-w-[280px] sm:max-w-md font-medium">
            {displayTitle}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopyLink}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-[11px] font-medium transition-colors border border-zinc-700/60 cursor-pointer"
            title="Sao chép liên kết nguồn bài học"
          >
            {copied ? (
              <>
                <Check className="size-3 text-emerald-400" />
                <span className="text-emerald-400">Đã sao chép</span>
              </>
            ) : (
              <>
                <Copy className="size-3 text-zinc-400" />
                <span>Sao chép link</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleOpenExternal}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-[11px] font-medium transition-colors border border-zinc-700/60 cursor-pointer"
            title="Mở video trực tiếp trên YouTube"
          >
            <ExternalLink className="size-3 text-zinc-400" />
            <span>Mở trên YouTube</span>
          </button>
        </div>
      </div>

      {/* Main 16:9 Video Canvas */}
      <div className="relative w-full aspect-video bg-black flex items-center justify-center">
        {!isIframeLoaded && (
          <div className="absolute inset-0 bg-zinc-950 flex flex-col items-center justify-center gap-3 z-10">
            <div className="size-9 rounded-full border-2 border-zinc-800 border-t-red-500 animate-spin" />
            <span className="text-xs text-zinc-400 font-medium">
              Đang kết nối luồng phát YouTube...
            </span>
          </div>
        )}

        <iframe
          key={videoId}
          src={embedUrl}
          title={displayTitle}
          onLoad={() => setIsIframeLoaded(true)}
          className="size-full border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>

      {/* Minimalist Academic Source Citation / Fair Use Notice */}
      <div className="flex items-center justify-between gap-3 px-4 py-2 bg-zinc-900/60 border-t border-zinc-800/80 text-[11px] text-zinc-400">
        <div className="flex items-center gap-1.5 text-zinc-400">
          <ShieldCheck className="size-3.5 text-emerald-400 shrink-0" />
          <span>
            Học liệu tham khảo mở • Bản quyền nội dung gốc thuộc về kênh tác giả trên YouTube
          </span>
        </div>
        <span className="hidden sm:inline-block text-zinc-500 text-[10px] font-mono">
          ID: {videoId}
        </span>
      </div>
    </div>
  );
};

export default LessonYouTubePlayer;
