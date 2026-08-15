/**
 * InteractiveTranscript Component - Bảng Kịch bản & Phụ đề Tương tác Song ngữ Đồng bộ
 * Author: NGUYỄN DŨNG QUỐC ANH (Frontend & AI UI Integration Lead)
 */

import React, { useState, useEffect, useRef } from 'react';
import { FiPlay, FiSearch, FiVolume2, FiCopy, FiCheck, FiZap, FiDownload, FiGlobe, FiX } from 'react-icons/fi';

export default function InteractiveTranscript({
  cues = [],
  currentTime = 0,
  onSeek,
  onGenerateSubtitles,
  isGenerating = false,
  lessonTitle = ''
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedWord, setSelectedWord] = useState(null);
  const [isCopied, setIsCopied] = useState(false);
  const activeCueRef = useRef(null);
  const containerRef = useRef(null);

  // Tìm câu đang phát hiện tại
  const activeIndex = cues.findIndex(
    cue => currentTime >= cue.start && currentTime <= cue.end
  );

  // Tự động cuộn theo câu đang phát
  useEffect(() => {
    if (activeCueRef.current && containerRef.current) {
      activeCueRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest'
      });
    }
  }, [activeIndex]);

  // Lọc theo từ khóa tìm kiếm
  const filteredCues = cues.filter(cue => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (cue.en || '').toLowerCase().includes(term) || (cue.vi || '').toLowerCase().includes(term);
  });

  // Phát âm từ vựng bằng Web Speech API
  const speakWord = (wordText) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(wordText);
      utterance.lang = 'en-US';
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    }
  };

  // Tra cứu từ vựng nhanh
  const handleWordClick = (e, word) => {
    e.stopPropagation();
    const cleanWord = word.replace(/[^a-zA-Z]/g, '').trim();
    if (!cleanWord || cleanWord.length < 2) return;

    setSelectedWord({
      word: cleanWord,
      rect: e.currentTarget.getBoundingClientRect()
    });
    speakWord(cleanWord);
  };

  // Sao chép toàn bộ kịch bản
  const handleCopyTranscript = () => {
    const text = cues.map(c => `[${c.startFormatted || formatSeconds(c.start)}] ${c.en}\n-> ${c.vi}`).join('\n\n');
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  // Tải về file WebVTT
  const handleDownloadVtt = () => {
    let vttContent = "WEBVTT\n\n";
    cues.forEach((c, idx) => {
      vttContent += `${idx + 1}\n${c.startFormatted || formatSeconds(c.start)} --> ${c.endFormatted || formatSeconds(c.end)}\n${c.en}\n${c.vi}\n\n`;
    });
    const blob = new Blob([vttContent], { type: 'text/vtt;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${lessonTitle ? lessonTitle.replace(/\s+/g, '_') : 'lesson'}_transcript.vtt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  function formatSeconds(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  return (
    <div className="flex flex-col h-full bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800 shadow-xl overflow-hidden">
      {/* Header Panel */}
      <div className="p-4 border-b border-slate-800/80 bg-slate-950/40 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
              <FiGlobe className="text-base" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide">Kịch Bản & Phụ Đề AI</h3>
              <p className="text-[11px] text-slate-400">Đồng bộ song ngữ • Click câu để tua video</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {onGenerateSubtitles && (
              <button
                onClick={onGenerateSubtitles}
                disabled={isGenerating}
                title="Tạo lại phụ đề bằng Gemini 2.5 Flash"
                className="p-2 rounded-xl bg-gradient-to-r from-teal-500/20 to-indigo-500/20 hover:from-teal-500/30 hover:to-indigo-500/30 border border-teal-500/30 text-teal-300 text-xs font-semibold flex items-center gap-1 transition-all disabled:opacity-50 cursor-pointer"
              >
                <FiZap className={`text-xs ${isGenerating ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">{isGenerating ? 'Đang tạo...' : 'AI Gemini'}</span>
              </button>
            )}
            <button
              onClick={handleCopyTranscript}
              title="Sao chép kịch bản"
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-all cursor-pointer"
            >
              {isCopied ? <FiCheck className="text-teal-400" /> : <FiCopy />}
            </button>
            <button
              onClick={handleDownloadVtt}
              title="Tải tệp phụ đề .vtt"
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-all cursor-pointer"
            >
              <FiDownload />
            </button>
          </div>
        </div>

        {/* Search Filter Bar */}
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
          <input
            type="text"
            placeholder="Tìm kiếm từ vựng hoặc câu thoại..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900/90 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500/60 transition-all"
          />
        </div>
      </div>

      {/* Transcript List Scroll Area */}
      <div ref={containerRef} className="flex-1 overflow-y-auto p-3 space-y-2.5 custom-scrollbar">
        {filteredCues.length === 0 ? (
          <div className="text-center py-12 px-4 flex flex-col items-center justify-center text-slate-400">
            <FiGlobe className="text-4xl text-slate-600 mb-3 animate-pulse" />
            <p className="text-xs font-medium text-slate-300">Chưa có dữ liệu phụ đề kịch bản</p>
            {onGenerateSubtitles && (
              <button
                onClick={onGenerateSubtitles}
                disabled={isGenerating}
                className="mt-3 px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white text-xs font-bold rounded-xl shadow-lg shadow-teal-500/20 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <FiZap />
                <span>{isGenerating ? 'Đang phân tích...' : 'Tạo Phụ Đề AI Ngay'}</span>
              </button>
            )}
          </div>
        ) : (
          filteredCues.map((cue, index) => {
            const isCurrent = cues[activeIndex]?.id === cue.id;
            const words = (cue.en || '').split(' ');

            return (
              <div
                key={cue.id || index}
                ref={isCurrent ? activeCueRef : null}
                onClick={() => onSeek && onSeek(cue.start)}
                className={`p-3 rounded-xl border transition-all cursor-pointer group select-none relative ${
                  isCurrent
                    ? 'bg-teal-500/15 border-teal-500/50 shadow-md shadow-teal-500/10'
                    : 'bg-slate-950/30 hover:bg-slate-800/40 border-slate-800/60'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <span
                    className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 transition-all ${
                      isCurrent
                        ? 'bg-teal-500 text-slate-950 shadow-sm'
                        : 'bg-slate-800 text-slate-400 group-hover:bg-slate-700 group-hover:text-teal-300'
                    }`}
                  >
                    <FiPlay className="text-[9px]" />
                    {formatSeconds(cue.start)}
                  </span>

                  {isCurrent && (
                    <span className="flex items-center gap-1 text-[10px] font-semibold text-teal-400 animate-pulse">
                      <span className="w-1.5 h-1.5 rounded-full bg-teal-400"></span>
                      Đang phát
                    </span>
                  )}
                </div>

                {/* English sentence with Clickable Vocabulary Words */}
                <p className={`text-xs sm:text-sm font-semibold leading-relaxed tracking-wide ${isCurrent ? 'text-teal-200' : 'text-slate-200'}`}>
                  {words.map((w, wIdx) => (
                    <span
                      key={wIdx}
                      onClick={(e) => handleWordClick(e, w)}
                      title={`Click để tra từ & phát âm: "${w.replace(/[^a-zA-Z]/g, '')}"`}
                      className="hover:text-amber-300 hover:underline hover:decoration-amber-400/60 hover:bg-amber-400/10 px-0.5 rounded transition-all cursor-pointer inline-block"
                    >
                      {w}{' '}
                    </span>
                  ))}
                </p>

                {/* Vietnamese Translation */}
                <p className="text-[11px] sm:text-xs font-normal text-slate-400 mt-1 leading-snug">
                  {cue.vi}
                </p>
              </div>
            );
          })
        )}
      </div>

      {/* Mini Word Lookup Popover */}
      {selectedWord && (
        <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-2">
            <button
              onClick={() => speakWord(selectedWord.word)}
              className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 flex items-center justify-center transition-all cursor-pointer"
            >
              <FiVolume2 />
            </button>
            <div>
              <p className="text-xs font-bold text-amber-300">{selectedWord.word}</p>
              <p className="text-[10px] text-slate-400">Tra cứu nhanh từ vựng bài học</p>
            </div>
          </div>
          <button
            onClick={() => setSelectedWord(null)}
            className="text-slate-400 hover:text-white text-xs p-1"
          >
            <FiX />
          </button>
        </div>
      )}
    </div>
  );
}
