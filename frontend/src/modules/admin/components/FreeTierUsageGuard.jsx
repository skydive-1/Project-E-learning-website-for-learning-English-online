import React, { useMemo } from 'react';
import { FiAlertOctagon, FiAlertTriangle, FiCheckCircle, FiShield } from 'react-icons/fi';

import { useLanguage } from '../../../context/LanguageContext';

const DIMENSION_LABELS = { rpm: 'RPM', tpm: 'TPM', rpd: 'RPD' };

export const assessFreeTierUsage = (models = []) => models.map((model) => {
  const entries = Object.entries(model.percentUsed || {}).filter(([, value]) => Number.isFinite(value));
  const [peakDimension, peakPercent] = entries.sort((a, b) => b[1] - a[1])[0] || [null, null];
  const level = model.riskLevel || (!model.configured ? 'unconfigured'
    : peakPercent >= 100 ? 'exceeded'
      : peakPercent >= 85 ? 'critical'
        : peakPercent >= 70 ? 'warning' : 'healthy');
  return {
    ...model,
    peakDimension,
    peakPercent,
    level,
    headroomAtPeak: peakDimension ? model.headroom?.[peakDimension] : null
  };
});

const LEVEL_META = {
  exceeded: { icon: FiAlertOctagon, label: 'Đã vượt cap', tone: 'danger' },
  critical: { icon: FiAlertTriangle, label: 'Sát ngưỡng 429', tone: 'danger' },
  warning: { icon: FiAlertTriangle, label: 'Cần giảm nhịp', tone: 'warning' },
  healthy: { icon: FiCheckCircle, label: 'Trong ngưỡng an toàn', tone: 'healthy' },
  unconfigured: { icon: FiShield, label: 'Chưa thể giám sát', tone: 'muted' }
};

const FreeTierUsageGuard = ({ models = [], checkedAt }) => {
  const { language, t } = useLanguage();
  const assessed = useMemo(() => assessFreeTierUsage(models), [models]);
  const locale = language === 'ENG' ? 'en-US' : 'vi-VN';
  const numberFormatter = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const worst = assessed.find((item) => item.level === 'exceeded')
    || assessed.find((item) => item.level === 'critical')
    || assessed.find((item) => item.level === 'warning')
    || assessed.find((item) => item.level === 'unconfigured')
    || assessed[0];
  const meta = LEVEL_META[worst?.level || 'unconfigured'];
  const HeaderIcon = meta.icon;

  return (
    <section className={`free-tier-guard is-${meta.tone}`} aria-labelledby="free-tier-guard-title" aria-live="polite">
      <header>
        <div className="free-tier-guard__title">
          <HeaderIcon aria-hidden="true" />
          <div>
            <h2 id="free-tier-guard-title">{t('Free-tier Usage Guard')}</h2>
            <p>{t('Tự quét RPM, TPM và RPD mỗi 15 giây để phát hiện nguy cơ 429 trước khi chạm giới hạn.')}</p>
          </div>
        </div>
        <div className={`free-tier-guard__verdict is-${meta.tone}`}>
          <span>{t(meta.label)}</span>
          <small>{checkedAt ? new Date(checkedAt).toLocaleTimeString(locale) : '—'}</small>
        </div>
      </header>

      {assessed.length === 0 ? (
        <p className="free-tier-guard__empty">{t('Chưa có request Gemini nào để đánh giá.')}</p>
      ) : (
        <div className="free-tier-guard__rows">
          {assessed.map((item) => {
            const itemMeta = LEVEL_META[item.level];
            const ItemIcon = itemMeta.icon;
            return (
              <div className={`free-tier-guard__row is-${itemMeta.tone}`} key={item.model}>
                <ItemIcon aria-hidden="true" />
                <code>{item.model}</code>
                <span>{item.peakDimension ? DIMENSION_LABELS[item.peakDimension] : t('Chưa có cap')}</span>
                <strong>{item.peakPercent === null ? '—' : `${numberFormatter.format(item.peakPercent)}%`}</strong>
                <small>
                  {item.headroomAtPeak === null || item.headroomAtPeak === undefined
                    ? t('Lưu cap để bật cảnh báo chủ động')
                    : t('Còn {{count}} đơn vị trước cap', { count: numberFormatter.format(item.headroomAtPeak) })}
                </small>
              </div>
            );
          })}
        </div>
      )}

      <footer>
        {t('Guard đếm mọi request Gemini do backend gửi, kể cả request lỗi; Google AI Studio vẫn là nguồn đối chiếu cuối cùng.')}
      </footer>
    </section>
  );
};

export default FreeTierUsageGuard;
