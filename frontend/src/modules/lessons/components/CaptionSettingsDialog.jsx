import React, { useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FiRotateCcw, FiX } from 'react-icons/fi';
import {
  CHARACTER_EDGE_OPTIONS,
  DEFAULT_CAPTION_SETTINGS,
  FONT_FAMILY_OPTIONS,
  getCaptionVisualStyles
} from '../utils/captionSettings';

const FONT_SIZE_OPTIONS = [50, 75, 100, 125, 150, 175, 200];

function Field({ label, children }) {
  return (
    <label className="flex min-w-0 flex-col gap-2 text-xs font-semibold text-slate-200">
      <span>{label}</span>
      {children}
    </label>
  );
}

function ColorField({ label, value, onChange }) {
  return (
    <Field label={label}>
      <span className="flex h-10 items-center gap-2 rounded-xl bg-slate-950/70 px-2.5 ring-1 ring-inset ring-slate-700 focus-within:ring-2 focus-within:ring-teal-400">
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-label={label}
          className="h-6 w-8 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0"
        />
        <span className="font-mono text-[11px] font-medium uppercase text-slate-300">{value}</span>
      </span>
    </Field>
  );
}

function OpacityField({ label, value, onChange }) {
  return (
    <Field label={label}>
      <span className="flex h-10 items-center gap-3 rounded-xl bg-slate-950/70 px-3 ring-1 ring-inset ring-slate-700 focus-within:ring-2 focus-within:ring-teal-400">
        <input
          type="range"
          min="0"
          max="100"
          step="5"
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          aria-label={label}
          className="h-1.5 min-w-0 flex-1 cursor-pointer accent-teal-400"
        />
        <output className="w-9 text-right text-[11px] tabular-nums text-slate-300">{value}%</output>
      </span>
    </Field>
  );
}

export default function CaptionSettingsDialog({ open, value, onChange, onClose, returnFocusRef }) {
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const visualStyles = useMemo(() => getCaptionVisualStyles(value), [value]);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return undefined;

    const previousActiveElement = document.activeElement;
    closeButtonRef.current?.focus();

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      ));
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (previousActiveElement?.isConnected) {
        previousActiveElement.focus?.();
      } else {
        returnFocusRef?.current?.focus?.();
      }
    };
  }, [open, returnFocusRef]);

  if (!open || typeof document === 'undefined') return null;

  const update = (key, nextValue) => onChange({ ...value, [key]: nextValue });

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/80 p-3 sm:p-6"
      onMouseDown={(event) => {
        event.stopPropagation();
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="caption-settings-title"
        aria-describedby="caption-settings-description"
        onMouseDown={(event) => event.stopPropagation()}
        className="flex max-h-[calc(100vh-1.5rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-slate-900 text-slate-100 shadow-[0_24px_80px_rgba(0,0,0,0.55)] ring-1 ring-slate-700 sm:max-h-[calc(100vh-3rem)]"
      >
        <header className="flex items-start justify-between gap-5 border-b border-slate-700/80 px-5 py-4 sm:px-6">
          <div>
            <h2 id="caption-settings-title" className="text-base font-bold text-white sm:text-lg">
              Tùy chỉnh phụ đề
            </h2>
            <p id="caption-settings-description" className="mt-1 text-xs leading-relaxed text-slate-400 sm:text-sm">
              Thay đổi được áp dụng ngay và lưu cho những bài học tiếp theo.
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Đóng tùy chỉnh phụ đề"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-slate-300 transition-colors hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
          >
            <FiX aria-hidden="true" />
          </button>
        </header>

        <div className="overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
          <div className="mb-6 flex min-h-32 items-center justify-center overflow-hidden rounded-2xl bg-slate-950 px-4 py-6 ring-1 ring-inset ring-slate-700/80">
            <div
              className="max-w-[94%] rounded-xl px-4 py-3 text-center leading-relaxed"
              style={visualStyles.window}
            >
              <p className="font-semibold">
                <span className="box-decoration-clone px-1.5 py-0.5" style={visualStyles.line}>
                  Welcome to your English lesson.
                </span>
              </p>
              <p className="mt-1 text-[0.84em]">
                <span className="box-decoration-clone px-1.5 py-0.5" style={visualStyles.line}>
                  Chào mừng bạn đến với bài học tiếng Anh.
                </span>
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-x-5 gap-y-5 sm:grid-cols-2">
            <Field label="Họ phông chữ">
              <select
                value={value.fontFamily}
                onChange={(event) => update('fontFamily', event.target.value)}
                className="h-10 rounded-xl border-0 bg-slate-950/70 px-3 text-xs text-slate-100 ring-1 ring-inset ring-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-400"
              >
                {FONT_FAMILY_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </Field>

            <Field label="Cỡ chữ">
              <select
                value={value.fontSize}
                onChange={(event) => update('fontSize', Number(event.target.value))}
                className="h-10 rounded-xl border-0 bg-slate-950/70 px-3 text-xs text-slate-100 ring-1 ring-inset ring-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-400"
              >
                {FONT_SIZE_OPTIONS.map(size => (
                  <option key={size} value={size}>{size}%</option>
                ))}
              </select>
            </Field>

            <ColorField label="Màu phông chữ" value={value.fontColor} onChange={(next) => update('fontColor', next)} />
            <OpacityField label="Độ mờ phông chữ" value={value.fontOpacity} onChange={(next) => update('fontOpacity', next)} />
            <ColorField label="Màu nền" value={value.backgroundColor} onChange={(next) => update('backgroundColor', next)} />
            <OpacityField label="Độ mờ của nền" value={value.backgroundOpacity} onChange={(next) => update('backgroundOpacity', next)} />
            <ColorField label="Màu cửa sổ" value={value.windowColor} onChange={(next) => update('windowColor', next)} />
            <OpacityField label="Độ mờ cửa sổ" value={value.windowOpacity} onChange={(next) => update('windowOpacity', next)} />

            <Field label="Kiểu viền ký tự">
              <select
                value={value.characterEdge}
                onChange={(event) => update('characterEdge', event.target.value)}
                className="h-10 rounded-xl border-0 bg-slate-950/70 px-3 text-xs text-slate-100 ring-1 ring-inset ring-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-400"
              >
                {CHARACTER_EDGE_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </Field>
          </div>
        </div>

        <footer className="flex flex-col-reverse gap-2 border-t border-slate-700/80 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <button
            type="button"
            onClick={() => onChange({ ...DEFAULT_CAPTION_SETTINGS })}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-xs font-bold text-slate-300 transition-colors hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
          >
            <FiRotateCcw aria-hidden="true" />
            Đặt lại
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-xl bg-teal-500 px-5 text-xs font-bold text-teal-950 transition-colors hover:bg-teal-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
          >
            Hoàn tất
          </button>
        </footer>
      </section>
    </div>,
    document.body
  );
}
