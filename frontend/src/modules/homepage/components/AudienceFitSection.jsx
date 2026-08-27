import React from 'react';
import { FiX, FiCheck } from 'react-icons/fi';
import { useLanguage } from '../../../context/LanguageContext';

const NOT_FOR_YOU_ITEMS = [
  'Người chỉ tìm kiếm lý thuyết ngữ pháp hàn lâm, không muốn thực hành nghe nói',
  'Người muốn học nhồi nhét cấp tốc 1 đêm mà không duy trì thói quen luyện tập',
  'Người ngại mở micro hoặc không muốn nhận phản hồi sửa lỗi phát âm từ AI',
  'Người tìm kiếm video thụ động một chiều không có bài tập rèn phản xạ tương tác',
  'Người không có mục tiêu ứng dụng tiếng Anh vào học tập, công việc hay đời sống'
];

const FOR_YOU_ITEMS = [
  'Người mất gốc hoặc muốn lấy lại phản xạ giao tiếp tiếng Anh tự nhiên từ đầu',
  'Sinh viên & người đi làm cần chuẩn bị phỏng vấn, thuyết trình, viết email chuẩn mực',
  'Người bận rộn muốn tự do học 24/7 mọi lúc mọi nơi theo nhịp sống cá nhân',
  'Người muốn được sửa lỗi phát âm chuẩn xác từng âm IPA và chấm điểm viết tức thì',
  'Người hướng tới làm chủ ngôn ngữ và tự tin chinh phục các chứng chỉ quốc tế'
];

const AudienceFitSection = () => {
  const { t } = useLanguage();

  return (
    <section className="audience-fit-section">
      <div className="container">
        {/* Section Header with Handwritten Annotation */}
        <div className="section-header-annotated scroll-animate">
          <div className="annotation-wrapper">
            <span className="handwritten-annotation pink">Check again before enroll</span>
            <svg className="curved-arrow pink" viewBox="0 0 48 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M6 4C18 6 32 16 38 28M38 28L30 26M38 28L42 20" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h2 className="section-main-heading">
            {t('Is this for you?')}
          </h2>
          <p className="section-sub-desc">
            {t('Chúng tôi tin vào sự phù hợp và giá trị thực tế. Hãy cùng đối chiếu mục tiêu học tập của bạn nhé.')}
          </p>
        </div>

        {/* Dual Comparison Container (Light vs Dark) */}
        <div className="audience-comparison-shell scroll-animate">
          {/* Left Panel: NOT for you */}
          <div className="comparison-panel not-for-you-panel">
            <div className="panel-header">
              <div className="panel-badge-pill red">KHÔNG PHÙ HỢP NẾU</div>
              <h3 className="panel-heading">
                {t('This is not for you if:')}
              </h3>
            </div>
            <div className="panel-rows-stack">
              {NOT_FOR_YOU_ITEMS.map((item, idx) => (
                <div key={idx} className="comparison-row-item row-not-for-you">
                  <span className="row-icon-box red-icon">
                    <FiX />
                  </span>
                  <span className="row-text-content">{t(item)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right Panel: FOR you */}
          <div className="comparison-panel for-you-panel">
            <div className="panel-header">
              <div className="panel-badge-pill green">LỰA CHỌN HOÀN HẢO NẾU</div>
              <h3 className="panel-heading">
                {t('This is for you if:')}
              </h3>
            </div>
            <div className="panel-rows-stack">
              {FOR_YOU_ITEMS.map((item, idx) => (
                <div key={idx} className="comparison-row-item row-for-you">
                  <span className="row-icon-box green-icon">
                    <FiCheck />
                  </span>
                  <span className="row-text-content">{t(item)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AudienceFitSection;
