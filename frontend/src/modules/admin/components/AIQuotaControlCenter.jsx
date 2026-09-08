import React, { useRef, useState } from 'react';
import { FiActivity, FiBarChart2 } from 'react-icons/fi';

import { useLanguage } from '../../../context/LanguageContext';
import AIQuotaUsageBoard from './AIQuotaUsageBoard';
import AIRateLimitsView from './AIRateLimitsView';
import '../styles/ai-rate-limits.scss';

const AIQuotaControlCenter = ({ canManageCaps = false }) => {
  const { t } = useLanguage();
  const [activeView, setActiveView] = useState('usage');
  const tabRefs = useRef({});

  const handleTabKeyDown = (event) => {
    const views = ['usage', 'rate-limits'];
    const currentIndex = views.indexOf(activeView);
    let nextIndex = currentIndex;

    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % views.length;
    else if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + views.length) % views.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = views.length - 1;
    else return;

    event.preventDefault();
    const nextView = views[nextIndex];
    setActiveView(nextView);
    tabRefs.current[nextView]?.focus();
  };

  return (
    <section className="ai-control-center" aria-label={t('Trung tâm quản lý AI')}>
      <div className="ai-control-switcher" role="tablist" aria-label={t('Chọn loại hạn mức AI')}>
        <button
          type="button"
          id="ai-usage-tab"
          ref={(node) => { tabRefs.current.usage = node; }}
          role="tab"
          aria-controls="ai-control-panel"
          aria-selected={activeView === 'usage'}
          tabIndex={activeView === 'usage' ? 0 : -1}
          className={activeView === 'usage' ? 'is-active' : ''}
          onClick={() => setActiveView('usage')}
          onKeyDown={handleTabKeyDown}
        >
          <FiBarChart2 aria-hidden="true" />
          <span>
            <strong>{t('Usage & quota học viên')}</strong>
            <small>{t('Lịch sử 30 ngày · đặt lại theo giờ Việt Nam')}</small>
          </span>
        </button>
        <button
          type="button"
          id="ai-rate-limits-tab"
          ref={(node) => { tabRefs.current['rate-limits'] = node; }}
          role="tab"
          aria-controls="ai-control-panel"
          aria-selected={activeView === 'rate-limits'}
          tabIndex={activeView === 'rate-limits' ? 0 : -1}
          className={activeView === 'rate-limits' ? 'is-active' : ''}
          onClick={() => setActiveView('rate-limits')}
          onKeyDown={handleTabKeyDown}
        >
          <FiActivity aria-hidden="true" />
          <span>
            <strong>{t('Rate Limits Google')}</strong>
            <small>RPM · TPM · RPD (Pacific Time)</small>
          </span>
        </button>
      </div>

      <div
        id="ai-control-panel"
        role="tabpanel"
        aria-labelledby={activeView === 'usage' ? 'ai-usage-tab' : 'ai-rate-limits-tab'}
      >
        {activeView === 'usage'
          ? <AIQuotaUsageBoard onOpenRateLimits={() => setActiveView('rate-limits')} />
          : <AIRateLimitsView canManageCaps={canManageCaps} />}
      </div>
    </section>
  );
};

export default AIQuotaControlCenter;
