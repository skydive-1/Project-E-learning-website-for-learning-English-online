import React, { useMemo } from 'react';
import { ExternalLink, Info, ShieldCheck } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
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
    docsUrl: 'https://ai.google.dev/gemini-api/docs/models/gemini-3.7-flash'
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
    model: 'gemini-3.1-flash-lite',
    inputLimit: 1_048_576,
    outputLimit: 65_536,
    outputLabel: null,
    updatedAt: '2026-07-21',
    docsUrl: 'https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-lite'
  },
  {
    model: 'gemini-embedding-001',
    inputLimit: 2_048,
    outputLimit: null,
    outputLabel: 'Vector ≤ 3.072 chiều',
    updatedAt: '2025-06',
    docsUrl: 'https://ai.google.dev/gemini-api/docs/embeddings'
  }
]);

const GeminiFreeTierReference = ({ models = [] }) => {
  const { language, t } = useLanguage();
  const locale = language === 'ENG' ? 'en-US' : 'vi-VN';
  const formatter = useMemo(() => new Intl.NumberFormat(locale), [locale]);

  const getProjectCap = (model) => {
    const match = models.find((item) => item.model === model);
    if (!match?.configured) return t('Chưa xác nhận');
    return `${formatter.format(match.caps.rpm)} RPM · ${formatter.format(match.caps.tpm)} TPM · ${formatter.format(match.caps.rpd)} RPD`;
  };

  return (
    <Card className="mb-6 bg-card/80 [--card-spacing:1.25rem]" aria-labelledby="gemini-free-tier-title">
      <CardHeader className="border-b">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary" aria-hidden="true">
            <ShieldCheck />
          </span>
          <div className="min-w-0">
            <CardTitle id="gemini-free-tier-title" className="text-lg tracking-tight">
              {t('Tham chiếu Gemini API Free Tier')}
            </CardTitle>
            <CardDescription className="mt-1 max-w-3xl leading-relaxed">
              {t('Giới hạn token là thông số chính thức theo model. RPM, TPM và RPD là cap của project, không phải một số cố định chung cho mọi tài khoản.')}
            </CardDescription>
          </div>
        </div>
        <CardAction>
          <Badge variant="secondary">{t('0₫ input / output')}</Badge>
        </CardAction>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground" role="note">
          <Info className="mt-0.5 shrink-0 text-foreground" aria-hidden="true" />
          <p className="leading-relaxed">
            {t('Google yêu cầu xem hạn mức request đang hoạt động trong AI Studio. Hệ thống chỉ tính phần trăm bằng cap admin đã xác nhận và tự cảnh báo khi nhận 429 từ Google.')}
            <span className="mt-1 block text-foreground">
              {t('Lưu ý dữ liệu: ở Free Tier, Google có thể dùng nội dung gửi lên để cải thiện sản phẩm; không gửi dữ liệu nhạy cảm.')}
            </span>
          </p>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('Model')}</TableHead>
              <TableHead>{t('Token đầu vào / request')}</TableHead>
              <TableHead>{t('Token đầu ra / request')}</TableHead>
              <TableHead>{t('Cap request của project')}</TableHead>
              <TableHead className="text-right">{t('Nguồn')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {FREE_TIER_MODELS.map((item) => (
              <TableRow key={item.model}>
                <TableCell className="font-mono font-medium">{item.model}</TableCell>
                <TableCell className="font-mono tabular-nums">{formatter.format(item.inputLimit)}</TableCell>
                <TableCell className="font-mono tabular-nums">
                  {item.outputLimit ? formatter.format(item.outputLimit) : t(item.outputLabel)}
                </TableCell>
                <TableCell>
                  <span className="font-medium text-foreground">{getProjectCap(item.model)}</span>
                </TableCell>
                <TableCell className="text-right">
                  <a
                    className="inline-flex min-h-11 items-center gap-1.5 font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    href={item.docsUrl}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`${t('Mở tài liệu model')} ${item.model}`}
                  >
                    {item.updatedAt}
                    <ExternalLink aria-hidden="true" />
                  </a>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      <CardFooter className="flex flex-wrap justify-between gap-3 text-xs text-muted-foreground">
        <span>{t('RPD đặt lại lúc 00:00 Pacific · giới hạn áp dụng theo project, không theo từng API key.')}</span>
        <span className="flex flex-wrap items-center gap-3">
          <a className="font-medium text-foreground hover:underline" href={PRICING_URL} target="_blank" rel="noreferrer">
            {t('Bảng giá chính thức')}
          </a>
          <a className="font-medium text-foreground hover:underline" href={RATE_LIMITS_URL} target="_blank" rel="noreferrer">
            {t('Cách tính rate limit')}
          </a>
          <a className="font-medium text-primary hover:underline" href={AI_STUDIO_USAGE_URL} target="_blank" rel="noreferrer">
            {t('Xem cap đang hoạt động')}
          </a>
        </span>
      </CardFooter>
    </Card>
  );
};

export { FREE_TIER_MODELS };
export default GeminiFreeTierReference;
