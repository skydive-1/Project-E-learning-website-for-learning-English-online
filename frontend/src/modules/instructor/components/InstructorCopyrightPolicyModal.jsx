/**
 * [TASK-FE-POL-01] Giao diện Modal Policy Bản quyền Giảng viên khi Xuất bản Khóa học
 * Author: NGUYỄN DŨNG QUỐC ANH (Frontend & AI UI Integration Developer)
 * Module: Instructor Course Management & Legal Compliance
 * Standard: Vietnam IP Law 2022, Decree 17/2023/ND-CP, DMCA & EdTech Copyright Protection
 */

import React, { useState, useRef, useEffect } from 'react';
import { 
  FiShield, 
  FiCheckSquare, 
  FiSquare, 
  FiAlertCircle, 
  FiX, 
  FiBookOpen, 
  FiFileText, 
  FiLayers,
  FiCheck
} from 'react-icons/fi';

const InstructorCopyrightPolicyModal = ({ 
  isOpen, 
  onClose, 
  onAccept, 
  courseName = '', 
  sectionsCount = 0, 
  lessonsCount = 0 
}) => {
  const [checkedOwnership, setCheckedOwnership] = useState(false);
  const [checkedLiability, setCheckedLiability] = useState(false);
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [scrollPercent, setScrollPercent] = useState(0);
  const [showScrollWarning, setShowScrollWarning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const policyContainerRef = useRef(null);

  // Reset state mỗi khi mở modal mới
  useEffect(() => {
    if (isOpen) {
      setCheckedOwnership(false);
      setCheckedLiability(false);
      setHasScrolledToBottom(false);
      setScrollPercent(0);
      setShowScrollWarning(false);
      setIsSubmitting(false);

      // Đợi DOM render để kiểm tra nếu văn bản ngắn hơn khung hiển thị (tự động mở khóa)
      const timer = setTimeout(() => {
        if (policyContainerRef.current) {
          const { scrollHeight, clientHeight } = policyContainerRef.current;
          if (scrollHeight <= clientHeight + 10) {
            setHasScrolledToBottom(true);
            setScrollPercent(100);
          }
        }
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Xử lý sự kiện cuộn văn bản điều khoản
  const handleScroll = () => {
    const container = policyContainerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const maxScroll = scrollHeight - clientHeight;

    if (maxScroll <= 0) {
      setHasScrolledToBottom(true);
      setScrollPercent(100);
      return;
    }

    const currentPercent = Math.min(100, Math.max(0, Math.round((scrollTop / maxScroll) * 100)));
    setScrollPercent(currentPercent);

    // Khi cuộn gần chạm đáy (cách đáy <= 25px) thì kích hoạt mở khóa
    if (maxScroll - scrollTop <= 25) {
      setHasScrolledToBottom(true);
      setShowScrollWarning(false);
    }
  };

  // Tương tác với Checkbox khi chưa cuộn hết
  const handleCheckboxClick = (type) => {
    if (!hasScrolledToBottom) {
      setShowScrollWarning(true);
      return;
    }

    if (type === 'ownership') {
      setCheckedOwnership(prev => !prev);
    } else if (type === 'liability') {
      setCheckedLiability(prev => !prev);
    }
  };

  const isFormValid = hasScrolledToBottom && checkedOwnership && checkedLiability;

  const handleConfirm = async () => {
    if (!isFormValid) return;
    setIsSubmitting(true);
    try {
      if (onAccept) {
        await onAccept();
      }
    } catch (err) {
      console.error('Lỗi khi xác nhận điều khoản bản quyền:', err);
    } finally {
      setIsSubmitting(false);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-3xl w-full overflow-hidden shadow-2xl transition-all scale-100 flex flex-col max-h-[92vh]">
        
        {/* Header Modal */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-slate-900 via-slate-850 to-indigo-950/50 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 text-xl shadow-inner shrink-0">
              <FiShield />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-mono font-extrabold uppercase tracking-widest text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/20">
                  VĂN BẢN QUY CHUẨN SỐ 102/QĐ-ELP
                </span>
                <span className="hidden sm:inline-block text-[10px] text-slate-400 font-medium">
                  • Bản quyền & Sở hữu Trí tuệ
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-bold text-slate-100 mt-0.5">
                Thỏa thuận Sở hữu Trí tuệ & Xuất bản Khóa học
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-all shrink-0"
            title="Đóng cửa sổ"
          >
            <FiX className="text-lg" />
          </button>
        </div>

        {/* Course Info Strip */}
        <div className="px-5 py-3 bg-slate-950/90 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center space-x-2.5 text-xs text-slate-300 min-w-0">
            <FiBookOpen className="text-indigo-400 shrink-0" />
            <span className="text-slate-400 shrink-0">Khóa học:</span>
            <span className="font-semibold text-indigo-300 truncate max-w-xs sm:max-w-md">
              {courseName || 'Khóa học chưa đặt tên'}
            </span>
          </div>

          {(sectionsCount > 0 || lessonsCount > 0) && (
            <div className="flex items-center space-x-3 text-[11px] text-slate-400">
              <span className="flex items-center space-x-1">
                <FiLayers className="text-slate-500" />
                <span>{sectionsCount} chương</span>
              </span>
              <span>•</span>
              <span className="text-slate-300 font-medium">{lessonsCount} bài học</span>
            </div>
          )}
        </div>

        {/* Progress bar line */}
        <div className="w-full h-1 bg-slate-800 shrink-0">
          <div 
            className="h-full bg-gradient-to-r from-indigo-500 via-sky-500 to-teal-400 transition-all duration-200"
            style={{ width: `${scrollPercent}%` }}
          />
        </div>

        {/* Modal Body / Scrollable Policy Content */}
        <div 
          ref={policyContainerRef}
          onScroll={handleScroll}
          className="p-5 sm:p-6 overflow-y-auto custom-scrollbar text-slate-300 text-xs leading-relaxed space-y-5 select-text"
        >
          {/* Căn cứ pháp lý uy tín */}
          <div className="p-4 rounded-2xl bg-indigo-950/30 border border-indigo-500/20 space-y-2">
            <div className="flex items-center space-x-2 text-indigo-300 font-bold text-xs uppercase tracking-wider">
              <FiFileText className="text-sm" />
              <span>CĂN CỨ PHÁP LÝ & QUY CHUẨN THI HÀNH</span>
            </div>
            <p className="text-[11.5px] text-slate-300/90 leading-normal">
              Quy định này được ban hành căn cứ theo các văn bản pháp luật hiện hành và tiêu chuẩn quốc tế về bảo hộ quyền tác giả đối với nội dung giáo dục số:
            </p>
            <ul className="text-[11px] text-slate-400 space-y-1 pl-4 list-disc marker:text-indigo-400">
              <li><strong>Luật Sở hữu trí tuệ số 50/2005/QH11</strong> (sửa đổi, bổ sung bởi Luật số 36/2009/QH12, Luật số 42/2019/QH14 và <strong>Luật số 07/2022/QH15</strong> có hiệu lực từ 01/01/2023).</li>
              <li><strong>Nghị định số 17/2023/NĐ-CP của Chính phủ</strong> quy định chi tiết một số điều và biện pháp thi hành Luật Sở hữu trí tuệ về quyền tác giả, quyền liên quan và trách nhiệm pháp lý của doanh nghiệp cung cấp dịch vụ trung gian mạng (EdTech/ISP).</li>
              <li><strong>Công ước Berne</strong> về bảo hộ các tác phẩm văn học và nghệ thuật mà Việt Nam là thành viên chính thức.</li>
              <li><strong>Đạo luật Bản quyền Thiên niên kỷ Kỹ thuật số (DMCA - 17 U.S.C. § 512)</strong> về cơ chế Thông báo và Gỡ bỏ nội dung vi phạm bản quyền trên không gian mạng (*Notice and Takedown*).</li>
              <li><strong>Luật Giao dịch điện tử số 20/2023/QH15</strong> về giá trị pháp lý của thông điệp dữ liệu và chữ ký điện tử.</li>
            </ul>
          </div>

          {/* Lời nhắc quan trọng */}
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start space-x-3 text-amber-200/90 text-xs">
            <FiAlertCircle className="text-amber-400 text-base shrink-0 mt-0.5" />
            <p>
              Quy chế này áp dụng <strong>bắt buộc</strong> đối với mọi Giảng viên trước khi phát hành khóa học công khai trên E-Learn Academy. Giảng viên vui lòng đọc kỹ toàn bộ điều khoản để hiểu rõ quyền lợi, nghĩa vụ pháp lý và trách nhiệm đối với tài nguyên giảng dạy.
            </p>
          </div>

          {/* Chi tiết các điều khoản */}
          <div className="space-y-4 text-slate-300">
            
            <section className="space-y-1.5">
              <h4 className="font-bold text-slate-100 text-xs uppercase tracking-wide text-indigo-300 flex items-center space-x-2">
                <span className="w-5 h-5 rounded-md bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-[10px] font-mono">01</span>
                <span>Điều 1: Khái niệm & Đối tượng Tài liệu được Bảo hộ</span>
              </h4>
              <p className="text-[12px] text-slate-300 pl-7">
                Tài liệu giảng dạy số trong phạm vi thỏa thuận này bao gồm nhưng không giới hạn: Các video bài giảng được ghi hình hoặc livestream, bài thuyết trình (Slides), đề cương khóa học, tệp âm thanh ghi âm giọng đọc chuẩn phát âm (Audio IELTS/Speaking), bộ câu hỏi trắc nghiệm đánh giá năng lực (Quizzes), tài liệu học tập bổ trợ (PDF, DOCX), mã nguồn lập trình bài tập và hình ảnh minh họa đính kèm. Toàn bộ các đối tượng nêu trên được pháp luật bảo hộ quyền tác giả theo quy định tại Điều 14 Luật Sở hữu trí tuệ 2022.
              </p>
            </section>

            <section className="space-y-1.5">
              <h4 className="font-bold text-slate-100 text-xs uppercase tracking-wide text-indigo-300 flex items-center space-x-2">
                <span className="w-5 h-5 rounded-md bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-[10px] font-mono">02</span>
                <span>Điều 2: Cam kết Quyền sở hữu Nguyên bản & Quyền sử dụng Hợp pháp</span>
              </h4>
              <div className="text-[12px] text-slate-300 pl-7 space-y-1.5">
                <p>
                  <strong>2.1 Tính nguyên bản:</strong> Giảng viên khẳng định và bảo đảm là tác giả trực tiếp sáng tạo ra nội dung hoặc có giấy phép ủy quyền, nhượng quyền sử dụng hợp pháp bằng văn bản từ chủ sở hữu quyền tác giả gốc đối với 100% nội dung xuất bản.
                </p>
                <p>
                  <strong>2.2 Nghiêm cấm tài liệu sao chép lậu:</strong> Giảng viên cam kết tuyệt đối không sử dụng bản scan, trích sao trái phép toàn bộ hoặc một phần giáo trình, sách bài tập, bộ đề thi của các Nhà xuất bản quốc tế (như Oxford University Press, Cambridge University Press, Macmillan, Pearson Education, National Geographic Learning...) hoặc các bộ đề thi khảo thí độc quyền (IELTS, TOEFL, TOEIC, GRE, GMAT) khi chưa có thỏa thuận nhượng quyền chính thức.
                </p>
                <p>
                  <strong>2.3 Tài sản truyền thông đi kèm:</strong> Mọi hình ảnh, video tư liệu phụ trợ, âm thanh hiệu ứng hoặc bản nhạc nền sử dụng trong bài giảng phải thuộc quyền sở hữu cá nhân, thuộc phạm vi công cộng (Public Domain), có giấy phép Creative Commons phù hợp (CC BY, CC0) hoặc đã mua bản quyền thương mại đầy đủ.
                </p>
              </div>
            </section>

            <section className="space-y-1.5">
              <h4 className="font-bold text-slate-100 text-xs uppercase tracking-wide text-indigo-300 flex items-center space-x-2">
                <span className="w-5 h-5 rounded-md bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-[10px] font-mono">03</span>
                <span>Điều 3: Giới hạn Trích dẫn Hợp pháp (Fair Use) & Trích dẫn Nguồn</span>
              </h4>
              <p className="text-[12px] text-slate-300 pl-7">
                Căn cứ theo Điều 25 và Điều 25a Luật Sở hữu trí tuệ 2022, Giảng viên được phép trích dẫn hợp lý tác phẩm đã công bố nhằm mục đích bình luận, phân tích hoặc minh họa trong bài học. Việc trích dẫn phải tuân thủ nghiêm ngặt: (i) Không làm sai lệch ý tưởng của tác giả gốc; (ii) Tỷ lệ trích dẫn ở mức tối thiểu cần thiết cho mục đích giảng dạy và không làm phương hại đến việc khai thác bình thường của tác phẩm gốc; (iii) Bắt buộc ghi nhận rõ ràng tên tác giả, tên tác phẩm và nguồn xuất bản gốc trong phần chú thích bài giảng.
              </p>
            </section>

            <section className="space-y-1.5">
              <h4 className="font-bold text-slate-100 text-xs uppercase tracking-wide text-indigo-300 flex items-center space-x-2">
                <span className="w-5 h-5 rounded-md bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-[10px] font-mono">04</span>
                <span>Điều 4: Cấp phép Phát hành Kỹ thuật số cho Nền tảng (Non-Exclusive License)</span>
              </h4>
              <p className="text-[12px] text-slate-300 pl-7">
                Giảng viên giữ nguyên quyền tác giả và quyền sở hữu đối với khóa học. Bằng việc đồng ý xuất bản, Giảng viên cấp cho E-Learn Academy giấy phép phân phối số <strong>phi độc quyền (Non-exclusive)</strong> trên phạm vi toàn cầu trong suốt thời gian khóa học niêm yết trên hệ thống để: lưu trữ, mã hóa luồng phát trực tuyến thích ứng (HLS adaptive streaming), phân phối cho học viên đã đăng ký hợp lệ, và sử dụng trích đoạn ngắn phục vụ hoạt động quảng bá khóa học của chính Giảng viên trên nền tảng.
              </p>
            </section>

            <section className="space-y-1.5">
              <h4 className="font-bold text-slate-100 text-xs uppercase tracking-wide text-indigo-300 flex items-center space-x-2">
                <span className="w-5 h-5 rounded-md bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-[10px] font-mono">05</span>
                <span>Điều 5: Công nghệ Bảo mật & Chống Tải Lậu của E-Learn Academy</span>
              </h4>
              <div className="text-[12px] text-slate-300 pl-7 space-y-1.5">
                <p>
                  Nhằm bảo vệ tối đa thành quả lao động trí tuệ của Giảng viên, E-Learn Academy triển khai đồng bộ các giải pháp công nghệ bảo vệ kỹ thuật số tiên tiến:
                </p>
                <ul className="list-disc pl-4 space-y-1 text-slate-400">
                  <li><strong>Forensic Dynamic Watermarking:</strong> Hiển thị mờ định danh Học viên (User ID, Email, IP và Thời gian phát) ngẫu nhiên trên màn hình phát video phục vụ truy vết pháp lý và răn đe phát tán, trích xuất trái phép.</li>
                  <li><strong>Mã hóa phân đoạn luồng truyền thông HLS (AES-128):</strong> Ngăn chặn các tiện ích mở rộng và phần mềm tự động trích xuất file video gốc (.mp4).</li>
                  <li><strong>Vô hiệu hóa sao chép văn bản (Content Shield):</strong> Khóa các thao tác copy nội dung bộ câu hỏi đề thi và tài liệu học tập độc quyền trên giao diện người học.</li>
                </ul>
              </div>
            </section>

            <section className="space-y-1.5">
              <h4 className="font-bold text-slate-100 text-xs uppercase tracking-wide text-indigo-300 flex items-center space-x-2">
                <span className="w-5 h-5 rounded-md bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-[10px] font-mono">06</span>
                <span>Điều 6: Quy trình Tiếp nhận Khiếu nại & Gỡ bỏ Nội dung (Chuẩn DMCA)</span>
              </h4>
              <div className="text-[12px] text-slate-300 pl-7 space-y-1.5">
                <p>
                  <strong>6.1 Cơ chế Notice & Takedown:</strong> Căn cứ quy định về trách nhiệm của doanh nghiệp cung cấp dịch vụ trung gian tại Điều 114 Nghị định 17/2023/NĐ-CP và DMCA 17 U.S.C. § 512, khi nhận được thông báo khiếu nại hợp lệ từ chủ thể quyền bên thứ ba, Ban Quản trị E-Learn Academy có quyền ngay lập tức tạm dừng hiển thị khóa học trong thời hạn 24 giờ để xác minh mà không phải chịu bất kỳ nghĩa vụ bồi thường nào đối với Giảng viên.
                </p>
                <p>
                  <strong>6.2 Quyền phản hồi khiếu nại (Counter-Notice):</strong> Giảng viên có quyền gửi văn bản phản hồi kèm tài liệu, chứng từ hợp pháp chứng minh quyền tác giả trong thời hạn 05 (năm) ngày làm việc. Nếu Giảng viên không phản hồi hoặc không chứng minh được tính hợp pháp, khóa học sẽ bị thu hồi và xóa bỏ vĩnh viễn.
                </p>
              </div>
            </section>

            <section className="space-y-1.5">
              <h4 className="font-bold text-slate-100 text-xs uppercase tracking-wide text-indigo-300 flex items-center space-x-2">
                <span className="w-5 h-5 rounded-md bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-[10px] font-mono">07</span>
                <span>Điều 7: Nghĩa vụ Miễn trừ & Bồi hoàn Thiệt hại (Indemnification)</span>
              </h4>
              <p className="text-[12px] text-slate-300 pl-7">
                Giảng viên hoàn toàn chịu trách nhiệm cá nhân, trách nhiệm dân sự và hình sự trước pháp luật đối với mọi khiếu nại phát sinh từ nội dung xuất bản. Giảng viên cam kết bồi thường toàn bộ mọi tổn thất vật chất, thiệt hại tài chính, án phí, chi phí thuê luật sư và các khoản phạt vi phạm hành chính mà E-Learn Academy phải gánh chịu do hành vi vi phạm quyền sở hữu trí tuệ hoặc vi phạm bản quyền từ nội dung của Giảng viên gây ra.
              </p>
            </section>

            <section className="space-y-1.5">
              <h4 className="font-bold text-slate-100 text-xs uppercase tracking-wide text-indigo-300 flex items-center space-x-2">
                <span className="w-5 h-5 rounded-md bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-[10px] font-mono">08</span>
                <span>Điều 8: Chế tài Xử lý Vi phạm & Chấm dứt Hợp tác</span>
              </h4>
              <div className="text-[12px] text-slate-300 pl-7 space-y-1.5">
                <p>
                  Trường hợp phát hiện vi phạm bản quyền, Ban Quản trị sẽ áp dụng các biện pháp chế tài:
                </p>
                <ul className="list-disc pl-4 space-y-1 text-slate-400">
                  <li>Xóa bỏ vĩnh viễn khóa học vi phạm khỏi hệ thống đào tạo.</li>
                  <li>Phong tỏa và khấu trừ toàn bộ doanh thu phát sinh từ khóa học vi phạm để thực hiện hoàn tiền cho học viên bị ảnh hưởng và chi trả bồi thường cho bên bị xâm phạm quyền.</li>
                  <li>Thu hồi vĩnh viễn quyền Giảng viên trên nền tảng.</li>
                  <li>Nếu hành vi vi phạm có dấu hiệu cấu thành tội phạm theo quy định tại <strong>Điều 225 Bộ luật Hình sự Việt Nam</strong> (Tội xâm phạm quyền tác giả, quyền liên quan), E-Learn Academy sẽ chuyển giao toàn bộ hồ sơ dữ liệu cho Cơ quan Cảnh sát Điều tra có thẩm quyền.</li>
                </ul>
              </div>
            </section>

            <section className="space-y-1.5 pt-2 border-t border-slate-800/80">
              <h4 className="font-bold text-slate-100 text-xs uppercase tracking-wide text-indigo-300 flex items-center space-x-2">
                <span className="w-5 h-5 rounded-md bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-[10px] font-mono">09</span>
                <span>Điều 9: Hiệu lực Thi hành & Xác nhận Điện tử</span>
              </h4>
              <p className="text-[12px] text-slate-300 pl-7">
                Thỏa thuận này có hiệu lực kể từ thời điểm Giảng viên xác nhận bằng thao tác bấm nút điện tử bên dưới. Căn cứ theo Luật Giao dịch điện tử số 20/2023/QH15, việc bấm xác nhận có giá trị pháp lý ràng buộc tương đương với văn bản có chữ ký trực tiếp của các bên.
              </p>
            </section>

          </div>

        </div>

        {/* Interactive Confirmation Checkboxes */}
        <div className="px-5 py-3 space-y-2.5 bg-slate-950/70 border-t border-slate-800 shrink-0">
          {showScrollWarning && (
            <p className="text-[11px] text-rose-400 font-medium animate-pulse">
              * Vui lòng cuộn chuột đọc hết chính sách đến dòng cuối cùng trước khi tích chọn cam kết.
            </p>
          )}
          
          {/* Checkbox 1 */}
          <div 
            onClick={() => handleCheckboxClick('ownership')}
            className={`flex items-start space-x-3 select-none p-2.5 rounded-xl border transition-all ${
              !hasScrolledToBottom
                ? 'opacity-60 cursor-not-allowed bg-slate-900/30 border-slate-800/60'
                : 'cursor-pointer hover:bg-slate-800/50 border-slate-800 bg-slate-900/60'
            }`}
          >
            <div className="mt-0.5 text-base shrink-0">
              {checkedOwnership ? (
                <FiCheckSquare className="text-teal-400" />
              ) : (
                <FiSquare className={!hasScrolledToBottom ? 'text-slate-600' : 'text-slate-400 group-hover:text-slate-300'} />
              )}
            </div>
            <span className={`text-xs leading-snug ${!hasScrolledToBottom ? 'text-slate-400' : 'text-slate-200 font-medium'}`}>
              <strong>1. Cam kết Quyền sở hữu Hợp pháp:</strong> Tôi cam kết sở hữu 100% bản quyền hoặc có quyền hợp pháp sử dụng và phân phối toàn bộ video, giáo trình, slide, audio phát âm và câu hỏi trắc nghiệm trong khóa học này theo đúng quy định của Luật Sở hữu trí tuệ.
            </span>
          </div>

          {/* Checkbox 2 */}
          <div 
            onClick={() => handleCheckboxClick('liability')}
            className={`flex items-start space-x-3 select-none p-2.5 rounded-xl border transition-all ${
              !hasScrolledToBottom
                ? 'opacity-60 cursor-not-allowed bg-slate-900/30 border-slate-800/60'
                : 'cursor-pointer hover:bg-slate-800/50 border-slate-800 bg-slate-900/60'
            }`}
          >
            <div className="mt-0.5 text-base shrink-0">
              {checkedLiability ? (
                <FiCheckSquare className="text-teal-400" />
              ) : (
                <FiSquare className={!hasScrolledToBottom ? 'text-slate-600' : 'text-slate-400 group-hover:text-slate-300'} />
              )}
            </div>
            <span className={`text-xs leading-snug ${!hasScrolledToBottom ? 'text-slate-400' : 'text-slate-200 font-medium'}`}>
              <strong>2. Cam kết Bồi hoàn & Trách nhiệm Pháp lý:</strong> Tôi chấp nhận hoàn toàn trách nhiệm cá nhân và pháp lý trước cơ quan chức năng, đồng thời cam kết bồi hoàn 100% thiệt hại tài chính và chi phí phát sinh cho E-Learn Academy nếu xảy ra bất kỳ tranh chấp bản quyền nào liên quan đến khóa học.
            </span>
          </div>

        </div>

        {/* Modal Footer / Action Buttons */}
        <div className="p-4 sm:p-5 bg-slate-950 border-t border-slate-800 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-850 transition-all cursor-pointer"
          >
            Hủy bỏ
          </button>

          <button
            type="button"
            disabled={!isFormValid || isSubmitting}
            onClick={handleConfirm}
            className={`px-5 py-2.5 sm:px-6 sm:py-2.5 rounded-xl text-xs font-bold transition-all shadow-lg flex items-center space-x-2 ${
              isFormValid && !isSubmitting
                ? 'bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-slate-950 shadow-emerald-500/20 cursor-pointer active:scale-95'
                : 'bg-slate-800/80 text-slate-500 cursor-not-allowed border border-slate-700/50'
            }`}
          >
            {isSubmitting ? (
              <span>Đang xuất bản...</span>
            ) : (
              <>
                <FiCheck className={isFormValid ? 'text-slate-950 font-extrabold' : 'text-slate-500'} />
                <span>Tôi Đồng Ý & Xuất Bản Khóa Học</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};

export default InstructorCopyrightPolicyModal;

