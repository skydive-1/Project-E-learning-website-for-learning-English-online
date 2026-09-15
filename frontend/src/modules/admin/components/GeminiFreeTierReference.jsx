import React, { useMemo } from 'react';
import {
  Calendar,
  Clock,
  Cpu,
  Database,
  ExternalLink,
  FileText,
  Info,
  RefreshCw,
  RotateCcw,
  RotateCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Zap
} from 'lucide-react';

import { Chip } from '@/components/base/badges/chip';
import { useLanguage } from '../../../context/LanguageContext';

const AI_STUDIO_USAGE_URL = 'https://aistudio.google.com/usage';
const RATE_LIMITS_URL = 'https://ai.google.dev/gemini-api/docs/rate-limits';
const PRICING_URL = 'https://ai.google.dev/gemini-api/docs/pricing';

const FREE_TIER_MODELS = Object.freeze([
  {
    model: 'gemini-3.7-flash',
    inputLimit: 1_048_576,
    outputLimit: 65_536,
    outputLabel: null,
    updatedAt: '2026-08-13',
    docsUrl: 'https://ai.google.dev/gemini-api/docs/models/gemini-3.7-flash',
    isPrimary: true
  },
  {
    model: 'gemini-3.6-flash',
    inputLimit: 1_048_576,
    outputLimit: 65_536,
    outputLabel: null,
    updatedAt: '2026-08-01',
    docsUrl: 'https://ai.google.dev/gemini-api/docs/models/gemini-3.6-flash'
  },
  {
    model: 'gemini-3.5-flash-lite',
    inputLimit: 1_048_576,
    outputLimit: 65_536,
    outputLabel: null,
    updatedAt: '2026-07-30',
    docsUrl: 'https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite'
  },
  {
    model: 'gemini-embedding-001',
    inputLimit: 2_048,
    outputLimit: null,
    outputLabel: 'Vector ≤ 3.072 chiều',
    updatedAt: '2025-06',
    docsUrl: 'https://ai.google.dev/gemini-api/docs/embeddings',
    isEmbedding: true
  }
]);

const GeminiFreeTierReference = ({ models = [], windows }) => {
  const { language, t } = useLanguage();
  const locale = language === 'ENG' ? 'en-US' : 'vi-VN';
  const formatter = useMemo(() => new Intl.NumberFormat(locale), [locale]);

  const nextResetDate = useMemo(() => {
    if (windows?.nextRpdResetAt) {
      const parsed = new Date(windows.nextRpdResetAt);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    const now = Date.now();
    const ptFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Los_Angeles',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const currentDay = ptFormatter.format(now);
    let cursor = Math.floor(now / 60_000) * 60_000 + 60_000;
    while (cursor <= now + 26 * 3600_000) {
      if (ptFormatter.format(cursor) !== currentDay) return new Date(cursor);
      cursor += 60_000;
    }
    return new Date(now + 24 * 3600_000);
  }, [windows?.nextRpdResetAt]);

  const vietnamResetTime = useMemo(() => {
    if (windows?.rpdResetVietnamTime) return windows.rpdResetVietnamTime;
    return new Intl.DateTimeFormat('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(nextResetDate);
  }, [windows?.rpdResetVietnamTime, nextResetDate]);

  const remainingHoursMinutes = useMemo(() => {
    const diffMs = Math.max(0, nextResetDate.getTime() - Date.now());
    const hours = Math.floor(diffMs / 3600_000);
    const minutes = Math.floor((diffMs % 3600_000) / 60_000);
    if (hours > 0) {
      return t('Còn {{hours}} giờ {{minutes}} phút', { hours, minutes });
    }
    return t('Còn {{minutes}} phút', { minutes });
  }, [nextResetDate, t]);

  const getModelCapInfo = (modelName) => {
    const match = models.find((item) => item.model === modelName);
    if (!match?.configured) {
      return { configured: false, label: t('Chưa xác nhận') };
    }
    return {
      configured: true,
      rpm: formatter.format(match.caps.rpm),
      tpm: formatter.format(match.caps.tpm),
      rpd: formatter.format(match.caps.rpd),
      fullText: `${formatter.format(match.caps.rpm)} RPM · ${formatter.format(match.caps.tpm)} TPM · ${formatter.format(match.caps.rpd)} RPD`
    };
  };

  return (
    <section
      className="mb-6 overflow-hidden rounded-2xl border border-separator-border bg-background-secondary-default shadow-card transition-all duration-200"
      aria-labelledby="gemini-free-tier-title"
    >
      {/* 1. Header (BoardUI Standard) */}
      <header className="flex flex-col gap-4 border-b border-separator-border p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex min-w-0 items-start gap-3.5">
          <div
            className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/10 text-blue-500 shadow-2xs dark:border-blue-400/30 dark:bg-blue-400/15 dark:text-blue-400"
            aria-hidden="true"
          >
            <ShieldCheck className="size-5" />
          </div>
          <div className="min-w-0">
            <h3 id="gemini-free-tier-title" className="text-title-3-bold text-text-primary tracking-tight">
              {t('Tham chiếu Gemini API Free Tier')}
            </h3>
            <p className="mt-0.5 max-w-3xl text-caption-1-regular text-text-secondary leading-relaxed">
              {t('Giới hạn token là thông số chính thức theo model. RPM, TPM và RPD là cap của project, không phải một số cố định chung cho mọi tài khoản.')}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Chip
            variant="bold"
            color="lime"
            className="gap-1.5 px-3 py-1 text-caption-1-semibold shadow-2xs"
          >
            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" aria-hidden="true" />
            {t('0₫ input / output')}
          </Chip>
        </div>
      </header>

      {/* 2. Content Body */}
      <div className="flex flex-col gap-5 p-5 sm:p-6">
        {/* Governance Notice Card */}
        <div
          className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 text-body-medium shadow-2xs transition-colors dark:border-blue-500/25 dark:bg-blue-950/20"
          role="note"
        >
          <div className="flex items-start gap-3">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-blue-500/15 text-blue-600 dark:text-blue-400 mt-0.5">
              <Info className="size-4" aria-hidden="true" />
            </div>
            <div className="flex-1 space-y-2.5 text-caption-1-regular leading-relaxed">
              <p className="text-text-secondary">
                {t('Google yêu cầu xem hạn mức request đang hoạt động trong AI Studio. Hệ thống chỉ tính phần trăm bằng cap admin đã xác nhận và tự cảnh báo khi nhận 429 từ Google.')}
              </p>
              <div className="inline-flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-caption-1-medium text-amber-800 dark:border-amber-400/25 dark:bg-amber-950/40 dark:text-amber-200">
                <ShieldAlert className="size-3.5 text-amber-600 dark:text-amber-400 shrink-0" aria-hidden="true" />
                <span>
                  {t('Lưu ý dữ liệu: ở Free Tier, Google có thể dùng nội dung gửi lên để cải thiện sản phẩm; không gửi dữ liệu nhạy cảm.')}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 2.1 Reset Schedule & Windows Card Grid */}
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
          {/* Card RPM */}
          <div className="flex flex-col justify-between rounded-xl border border-separator-border bg-background-primary-default p-4 shadow-2xs">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex size-7 items-center justify-center rounded-lg border border-blue-500/20 bg-blue-500/10 text-blue-500 dark:text-blue-400">
                    <RotateCcw className="size-3.5" />
                  </div>
                  <span className="font-mono text-body-medium font-bold text-text-primary">RPM</span>
                </div>
                <Chip variant="caption" color="blue" className="text-[11px] py-0 px-2">
                  {t('Cửa sổ trượt 60s')}
                </Chip>
              </div>
              <p className="text-caption-1-regular text-text-secondary leading-relaxed">
                {t('Google tính toán số request trong 60 giây gần nhất. Mỗi request sẽ tự động hoàn lại quota sau 60 giây kể từ khi gửi.')}
              </p>
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-separator-border/60 pt-2 text-[11px] text-text-tertiary">
              <span>{t('Chu kỳ reset')}</span>
              <span className="font-mono font-medium text-text-secondary">60s rolling</span>
            </div>
          </div>

          {/* Card TPM */}
          <div className="flex flex-col justify-between rounded-xl border border-separator-border bg-background-primary-default p-4 shadow-2xs">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex size-7 items-center justify-center rounded-lg border border-indigo-500/20 bg-indigo-500/10 text-indigo-500 dark:text-indigo-400">
                    <Zap className="size-3.5" />
                  </div>
                  <span className="font-mono text-body-medium font-bold text-text-primary">TPM</span>
                </div>
                <Chip variant="caption" color="indigo" className="text-[11px] py-0 px-2">
                  {t('Cửa sổ trượt 60s')}
                </Chip>
              </div>
              <p className="text-caption-1-regular text-text-secondary leading-relaxed">
                {t('Tính tổng token đầu vào và đầu ra trong 60 giây gần nhất. Lượng token được giải phóng dần sau 60 giây.')}
              </p>
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-separator-border/60 pt-2 text-[11px] text-text-tertiary">
              <span>{t('Chu kỳ reset')}</span>
              <span className="font-mono font-medium text-text-secondary">60s rolling</span>
            </div>
          </div>

          {/* Card RPD */}
          <div className="flex flex-col justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 shadow-2xs dark:border-emerald-500/25 dark:bg-emerald-950/15">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex size-7 items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-500 dark:text-emerald-400">
                    <Calendar className="size-3.5" />
                  </div>
                  <span className="font-mono text-body-medium font-bold text-text-primary">RPD</span>
                </div>
                <Chip variant="bold" color="emerald" className="text-[11px] py-0 px-2 font-mono">
                  {vietnamResetTime} VN (00:00 PT)
                </Chip>
              </div>
              <p className="text-caption-1-regular text-text-secondary leading-relaxed">
                {t('Đặt lại toàn bộ về 0 lúc 00:00 Pacific Time (PT) mỗi ngày. Giới hạn áp dụng chung trên toàn bộ Google Project.')}
              </p>
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-emerald-500/20 pt-2 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
              <span className="flex items-center gap-1">
                <Clock className="size-3 shrink-0" />
                {t('RPD reset kế tiếp')}
              </span>
              <span className="font-mono">{remainingHoursMinutes}</span>
            </div>
          </div>
        </div>

        {/* 2.2 ── Cơ chế tự phục hồi (Exponential Backoff) ──────────────── */}
        <div
          className="overflow-hidden rounded-xl border border-violet-500/25 bg-violet-500/5 shadow-2xs dark:border-violet-500/20 dark:bg-violet-950/15"
          role="note"
          aria-labelledby="backoff-mechanism-title"
        >
          {/* Header */}
          <div className="flex items-center gap-3 border-b border-violet-500/20 px-4 py-3">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-violet-500/25 bg-violet-500/15 text-violet-600 dark:text-violet-400">
              <RefreshCw className="size-3.5" aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
              <h4
                id="backoff-mechanism-title"
                className="text-body-medium font-semibold text-text-primary"
              >
                {t('Cơ chế tự phục hồi khi gặp lỗi hạ tầng (Exponential Backoff)')}
              </h4>
              <p className="text-caption-2-regular text-text-tertiary mt-0.5">
                {t('Áp dụng theo khuyến nghị của google.dev · Không cần can thiệp thủ công')}
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
              {t('Đang hoạt động')}
            </span>
          </div>

          <div className="flex flex-col gap-4 p-4">
            {/* Mô tả ngắn */}
            <p className="text-caption-1-regular text-text-secondary leading-relaxed">
              {t('Khi Google trả lỗi 503 (quá tải hạ tầng) hoặc 429 tạm thời (RPM), backend không báo lỗi ngay cho người dùng. Thay vào đó, hệ thống tự động chờ một khoảng thời gian tăng dần rồi thử lại — đúng như khuyến nghị chính thức từ')}
              {' '}
              <a
                href="https://ai.google.dev/gemini-api/docs/rate-limits#error-codes"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-violet-600 hover:text-violet-500 dark:text-violet-400 dark:hover:text-violet-300 underline underline-offset-2 font-medium"
              >
                google.dev
                <ExternalLink className="size-3 inline-block" aria-hidden="true" />
              </a>
              {t('.')}
            </p>

            {/* Flow diagram dạng timeline */}
            <div className="rounded-lg border border-violet-500/20 bg-background-primary-default p-4">
              <p className="mb-3 text-caption-1-semibold text-text-primary">
                {t('Luồng xử lý khi gặp lỗi 503 / 429 RPM:')}
              </p>
              <ol className="relative space-y-2.5 pl-6" aria-label={t('Các bước retry')}>
                {/* Step 1 */}
                <li className="relative">
                  <span
                    className="absolute -left-6 top-0.5 flex size-5 items-center justify-center rounded-full border border-violet-500/30 bg-violet-500/15 text-[10px] font-bold text-violet-600 dark:text-violet-400"
                    aria-hidden="true"
                  >
                    1
                  </span>
                  <div className="text-caption-1-regular text-text-secondary leading-relaxed">
                    <span className="font-semibold text-text-primary">{t('Attempt 1')}</span>
                    {' — '}
                    {t('Gọi Gemini API → nhận 503 hoặc 429 RPM')}
                  </div>
                </li>
                {/* Step 2 */}
                <li className="relative">
                  <span
                    className="absolute -left-6 top-0.5 flex size-5 items-center justify-center rounded-full border border-amber-500/30 bg-amber-500/15 text-[10px] font-bold text-amber-600 dark:text-amber-400"
                    aria-hidden="true"
                  >
                    2
                  </span>
                  <div className="text-caption-1-regular text-text-secondary leading-relaxed">
                    <span className="font-semibold text-text-primary">{t('Chờ 1 giây')}</span>
                    {' — '}
                    {t('Exponential backoff lần 1 · Không hiển thị lỗi cho người dùng')}
                  </div>
                </li>
                {/* Step 3 */}
                <li className="relative">
                  <span
                    className="absolute -left-6 top-0.5 flex size-5 items-center justify-center rounded-full border border-violet-500/30 bg-violet-500/15 text-[10px] font-bold text-violet-600 dark:text-violet-400"
                    aria-hidden="true"
                  >
                    3
                  </span>
                  <div className="text-caption-1-regular text-text-secondary leading-relaxed">
                    <span className="font-semibold text-text-primary">{t('Attempt 2')}</span>
                    {' — '}
                    {t('Thử lại cùng model → thành công ✓ hoặc nhận lỗi lần 2')}
                  </div>
                </li>
                {/* Step 4 */}
                <li className="relative">
                  <span
                    className="absolute -left-6 top-0.5 flex size-5 items-center justify-center rounded-full border border-amber-500/30 bg-amber-500/15 text-[10px] font-bold text-amber-600 dark:text-amber-400"
                    aria-hidden="true"
                  >
                    4
                  </span>
                  <div className="text-caption-1-regular text-text-secondary leading-relaxed">
                    <span className="font-semibold text-text-primary">{t('Chờ 2 giây')}</span>
                    {' — '}
                    {t('Exponential backoff lần 2 · Delay tăng gấp đôi (1s → 2s)')}
                  </div>
                </li>
                {/* Step 5 */}
                <li className="relative">
                  <span
                    className="absolute -left-6 top-0.5 flex size-5 items-center justify-center rounded-full border border-violet-500/30 bg-violet-500/15 text-[10px] font-bold text-violet-600 dark:text-violet-400"
                    aria-hidden="true"
                  >
                    5
                  </span>
                  <div className="text-caption-1-regular text-text-secondary leading-relaxed">
                    <span className="font-semibold text-text-primary">{t('Attempt 3')}</span>
                    {' — '}
                    {t('Thử lại lần cuối cùng model → thành công ✓ hoặc nhảy sang model kế tiếp')}
                  </div>
                </li>
                {/* Step 6 - fallback */}
                <li className="relative">
                  <span
                    className="absolute -left-6 top-0.5 flex size-5 items-center justify-center rounded-full border border-blue-500/30 bg-blue-500/15 text-[10px] font-bold text-blue-600 dark:text-blue-400"
                    aria-hidden="true"
                  >
                    6
                  </span>
                  <div className="text-caption-1-regular text-text-secondary leading-relaxed">
                    <span className="font-semibold text-text-primary">{t('Fallback model')}</span>
                    {' — '}
                    {t('Áp dụng lại 3 attempt + backoff cho model tiếp theo trong chuỗi (3.7 → 3.6 → 3.5-lite)')}
                  </div>
                </li>
              </ol>
            </div>

            {/* 3 Cards: Phân biệt lỗi */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {/* 503 */}
              <div className="rounded-lg border border-orange-500/25 bg-orange-500/8 p-3 dark:border-orange-500/20 dark:bg-orange-950/20">
                <div className="mb-1.5 flex items-center gap-2">
                  <RotateCw className="size-3.5 text-orange-500 dark:text-orange-400 shrink-0" aria-hidden="true" />
                  <span className="text-caption-1-semibold text-orange-700 dark:text-orange-300">503 Overload</span>
                </div>
                <p className="text-[11px] leading-relaxed text-text-secondary">
                  {t('Hạ tầng Google quá tải tạm thời. Luôn retry với backoff. Không phải lỗi hệ thống → ẩn khỏi cảnh báo.')}
                </p>
              </div>
              {/* 429 RPM */}
              <div className="rounded-lg border border-amber-500/25 bg-amber-500/8 p-3 dark:border-amber-500/20 dark:bg-amber-950/20">
                <div className="mb-1.5 flex items-center gap-2">
                  <RotateCw className="size-3.5 text-amber-500 dark:text-amber-400 shrink-0" aria-hidden="true" />
                  <span className="text-caption-1-semibold text-amber-700 dark:text-amber-300">429 RPM</span>
                </div>
                <p className="text-[11px] leading-relaxed text-text-secondary">
                  {t('Vượt lượt gọi/phút. Retry nếu retryAfter ≤ 4 giây (thoáng qua). Retry sau khi chờ ngắn.')}
                </p>
              </div>
              {/* 429 RPD */}
              <div className="rounded-lg border border-red-500/25 bg-red-500/8 p-3 dark:border-red-500/20 dark:bg-red-950/20">
                <div className="mb-1.5 flex items-center gap-2">
                  <RotateCcw className="size-3.5 text-red-500 dark:text-red-400 shrink-0" aria-hidden="true" />
                  <span className="text-caption-1-semibold text-red-700 dark:text-red-300">429 RPD</span>
                </div>
                <p className="text-[11px] leading-relaxed text-text-secondary">
                  {t('Hết quota cả ngày. Không retry — nhảy model ngay. Cooldown đến 00:00 Pacific. Hiển thị cảnh báo.')}
                </p>
              </div>
            </div>

            {/* Footer note */}
            <div className="flex items-start gap-2 rounded-lg border border-emerald-500/25 bg-emerald-500/8 px-3.5 py-2.5 dark:border-emerald-500/20 dark:bg-emerald-950/20">
              <ShieldCheck className="size-4 mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
              <p className="text-caption-1-regular text-text-secondary leading-relaxed">
                <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                  {t('Tại sao lỗi 503 không hiện trong bảng cảnh báo? ')}
                </span>
                {t('Vì đây là lỗi hạ tầng Google (không phải lỗi hệ thống). Backend đã xử lý tự động bằng retry. Nếu sau 3 lần thử model vẫn lỗi, hệ thống tự chuyển sang model khác trong chuỗi fallback mà không cần admin can thiệp.')}
              </p>
            </div>
          </div>
        </div>


        <div className="overflow-hidden rounded-xl border border-separator-border bg-background-primary-default shadow-2xs">
          <div className="w-full overflow-x-auto">
            <table className="bui-table">
              <thead>
                <tr>
                  <th scope="col">{t('Model')}</th>
                  <th scope="col">{t('Token đầu vào / request')}</th>
                  <th scope="col">{t('Token đầu ra / request')}</th>
                  <th scope="col">{t('Cap request của project')}</th>
                  <th scope="col" className="text-right">{t('Nguồn')}</th>
                </tr>
              </thead>
              <tbody>
                {FREE_TIER_MODELS.map((item) => {
                  const capInfo = getModelCapInfo(item.model);

                  return (
                    <tr key={item.model} className="transition-colors hover:bg-background-secondary-default/50">
                      {/* Model Name */}
                      <td>
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`flex size-7 shrink-0 items-center justify-center rounded-lg ${
                              item.isEmbedding
                                ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20'
                                : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                            }`}
                            aria-hidden="true"
                          >
                            {item.isEmbedding ? (
                              <Database className="size-3.5" />
                            ) : (
                              <Cpu className="size-3.5" />
                            )}
                          </div>
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-mono text-body-medium font-semibold text-text-primary">
                              {item.model}
                            </span>
                            {item.isPrimary && (
                              <Chip variant="caption" color="blue" className="text-[10px] py-0 px-1.5">
                                <Sparkles className="size-2.5 mr-0.5 inline-block text-amber-500 dark:text-amber-300" />
                                {t('Mặc định')}
                              </Chip>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Input Tokens */}
                      <td>
                        <div className="flex items-baseline gap-1 font-mono">
                          <span className="font-semibold tabular-nums text-text-primary">
                            {formatter.format(item.inputLimit)}
                          </span>
                          <span className="text-caption-2-regular text-text-tertiary">tokens</span>
                        </div>
                      </td>

                      {/* Output Tokens */}
                      <td>
                        {item.outputLimit ? (
                          <div className="flex items-baseline gap-1 font-mono">
                            <span className="font-semibold tabular-nums text-text-primary">
                              {formatter.format(item.outputLimit)}
                            </span>
                            <span className="text-caption-2-regular text-text-tertiary">tokens</span>
                          </div>
                        ) : (
                          <Chip variant="caption" color="purple" className="text-xs">
                            {t(item.outputLabel)}
                          </Chip>
                        )}
                      </td>

                      {/* Project Cap */}
                      <td>
                        {capInfo.configured ? (
                          <div
                            className="flex flex-wrap items-center gap-1.5 font-mono text-xs"
                            aria-label={capInfo.fullText}
                          >
                            <span className="rounded-md border border-blue-500/25 bg-blue-500/10 px-2 py-0.5 font-semibold text-blue-700 dark:text-blue-400">
                              {capInfo.rpm} RPM
                            </span>
                            <span className="text-text-tertiary font-bold">·</span>
                            <span className="rounded-md border border-indigo-500/25 bg-indigo-500/10 px-2 py-0.5 font-semibold text-indigo-700 dark:text-indigo-400">
                              {capInfo.tpm} TPM
                            </span>
                            <span className="text-text-tertiary font-bold">·</span>
                            <span className="rounded-md border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 font-semibold text-emerald-700 dark:text-emerald-400">
                              {capInfo.rpd} RPD
                            </span>
                          </div>
                        ) : (
                          <Chip variant="caption" color="neutral" className="text-text-tertiary text-xs">
                            {t('Chưa xác nhận')}
                          </Chip>
                        )}
                      </td>

                      {/* Documentation Source */}
                      <td className="text-right">
                        <a
                          className="inline-flex items-center gap-1.5 rounded-lg border border-separator-border bg-background-secondary-default px-2.5 py-1 text-caption-1-medium text-text-secondary shadow-2xs transition-all duration-150 hover:border-border-button-hover hover:bg-background-primary-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring"
                          href={item.docsUrl}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`${t('Mở tài liệu model')} ${item.model}`}
                        >
                          <span>{item.updatedAt}</span>
                          <ExternalLink className="size-3 text-text-tertiary" aria-hidden="true" />
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 4. Footer & Action Bar */}
      <footer className="flex flex-col gap-3.5 border-t border-separator-border bg-background-primary-default/50 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex items-center gap-2 text-caption-1-regular text-text-secondary">
          <Clock className="size-3.5 text-text-tertiary shrink-0" aria-hidden="true" />
          <span>
            {t('RPD đặt lại lúc 00:00 Pacific (tương ứng 14:00/15:00 giờ Việt Nam) · RPM/TPM là cửa sổ trượt 60 giây · Giới hạn áp dụng theo project, không theo từng API key.')}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <a
            className="inline-flex items-center gap-1.5 rounded-lg border border-separator-border bg-background-primary-default px-3 py-1.5 text-caption-1-medium text-text-secondary shadow-2xs transition-all hover:border-border-button-hover hover:bg-background-primary-hover hover:text-text-primary"
            href={PRICING_URL}
            target="_blank"
            rel="noreferrer"
          >
            <FileText className="size-3.5 text-text-tertiary" aria-hidden="true" />
            <span>{t('Bảng giá chính thức')}</span>
          </a>

          <a
            className="inline-flex items-center gap-1.5 rounded-lg border border-separator-border bg-background-primary-default px-3 py-1.5 text-caption-1-medium text-text-secondary shadow-2xs transition-all hover:border-border-button-hover hover:bg-background-primary-hover hover:text-text-primary"
            href={RATE_LIMITS_URL}
            target="_blank"
            rel="noreferrer"
          >
            <Info className="size-3.5 text-text-tertiary" aria-hidden="true" />
            <span>{t('Cách tính rate limit')}</span>
          </a>

          <a
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-caption-1-semibold text-white shadow-xs transition-all duration-150 hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring"
            href={AI_STUDIO_USAGE_URL}
            target="_blank"
            rel="noreferrer"
          >
            <span>{t('Xem cap đang hoạt động')}</span>
            <ExternalLink className="size-3.5" aria-hidden="true" />
          </a>
        </div>
      </footer>
    </section>
  );
};

export { FREE_TIER_MODELS };
export default GeminiFreeTierReference;

