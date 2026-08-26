import React from 'react';
import { FiX, FiCheckCircle, FiRepeat, FiZap, FiAward } from 'react-icons/fi';
import { useLanguage } from '../../../context/LanguageContext';

const HowItWorksModal = ({ isOpen, onClose }) => {
  const { t } = useLanguage();
  if (!isOpen) return null;

  return (
    <div className="vocab-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="vocab-modal-card how-it-works-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="vocab-modal-header">
          <div className="header-info">
            <span className="collection-icon-badge">💡</span>
            <div>
              <h2 className="collection-modal-title">Cách thức học từ vựng hiệu quả</h2>
              <p className="modal-subtitle-text">Phương pháp Spaced Repetition (Lặp lại ngắt quãng) kết hợp Active Recall</p>
            </div>
          </div>
          <button type="button" className="btn-close-modal" onClick={onClose}>
            <FiX />
          </button>
        </div>

        <div className="how-it-works-content">
          <div className="step-card-row">
            <div className="step-badge">1</div>
            <div className="step-body">
              <h4>Chọn chủ đề & Khám phá từ mới</h4>
              <p>Mỗi bộ sưu tập được chọn lọc theo khung tham chiếu quốc tế CEFR (A1 đến C1). Nhấn vào bất kỳ chủ đề nào để mở bộ flashcard tương tác.</p>
            </div>
          </div>

          <div className="step-card-row">
            <div className="step-badge">2</div>
            <div className="step-body">
              <h4>Chủ động gợi nhớ (Active Recall)</h4>
              <p>Nhìn mặt trước của flashcard, nghe phát âm bản xứ và tự nhớ lại nghĩa tiếng Việt trước khi nhấn lật thẻ. Điều này giúp kích hoạt liên kết nơ-ron não bộ.</p>
            </div>
          </div>

          <div className="step-card-row">
            <div className="step-badge">3</div>
            <div className="step-body">
              <h4>Đánh giá trạng thái (Spaced Repetition)</h4>
              <p>
                Đánh dấu <strong className="text-amber-500">"Cần ôn lại"</strong> đối với từ khó nhớ hoặc <strong className="text-emerald-500">"Đã thuộc"</strong> khi bạn đã làm chủ từ đó. Hệ thống sẽ tự động tổng hợp tiến độ học ở cột bên phải.
              </p>
            </div>
          </div>

          <div className="step-card-row">
            <div className="step-badge">4</div>
            <div className="step-body">
              <h4>Tự thêm từ vựng cá nhân (+ Add)</h4>
              <p>Gặp từ mới khi đọc tài liệu hay xem video? Dùng nút <strong>"+ Add"</strong> để lưu ngay vào sổ tay từ vựng riêng của bạn.</p>
            </div>
          </div>

          <div className="how-it-works-footer-tip">
            <FiAward className="award-icon" />
            <span>Chỉ cần 10 phút luyện tập mỗi ngày cùng E-Learn Academy để tích lũy 300+ từ vựng chất lượng mỗi tháng!</span>
          </div>

          <button type="button" className="btn-got-it" onClick={onClose}>
            Đã hiểu, Bắt đầu học ngay!
          </button>
        </div>
      </div>
    </div>
  );
};

export default HowItWorksModal;
