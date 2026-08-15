/**
 * [TASK-FE-POL-01] Giao diện Modal Policy Bản quyền Giảng viên khi Xuất bản Khóa học
 * Author: NGUYỄN DŨNG QUỐC ANH (Frontend & AI UI Integration Developer)
 * Module: Instructor Course Management & Legal Compliance
 */

import React, { useState } from 'react';
import { FiShield, FiCheckSquare, FiSquare, FiAlertCircle, FiX, FiBookOpen } from 'react-icons/fi';

const InstructorCopyrightPolicyModal = ({ isOpen, onClose, onAccept, courseName = '', sectionsCount = 0, lessonsCount = 0 }) => {
  const [checkedOwnership, setCheckedOwnership] = useState(false);
  const [checkedLiability, setCheckedLiability] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const isFormValid = checkedOwnership && checkedLiability;

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
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl transition-all scale-100">
        
        {/* Header Modal */}
        <div className="p-6 bg-gradient-to-r from-slate-900 via-slate-850 to-indigo-950/50 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 text-xl shadow-inner">
              <FiShield />
            </div>
            <div>
              <span className="text-[10px] font-mono font-extrabold uppercase tracking-widest text-indigo-400">
                KHOẢN 102 • CAM KẾT PHÁP LÝ & BẢN QUYỀN
              </span>
              <h2 className="text-lg font-bold text-slate-100">
                Thỏa thuận Sở hữu Trí tuệ & Xuất bản Khóa học
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-all"
          >
            <FiX className="text-lg" />
          </button>
        </div>

        {/* Modal Body / Policy Content */}
        <div className="p-6 space-y-5 max-h-[60vh] overflow-y-auto custom-scrollbar text-slate-300 text-xs sm:text-sm leading-relaxed">
          
          {courseName && (
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center space-x-3 text-slate-200">
              <FiBookOpen className="text-indigo-400 text-lg shrink-0" />
              <div className="truncate">
                <span className="text-[11px] text-slate-400 block">Khóa học chuẩn bị xuất bản công khai:</span>
                <span className="font-semibold text-xs text-indigo-300 truncate block">{courseName}</span>
              </div>
            </div>
          )}

          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-start space-x-3 text-amber-200/90 text-xs">
            <FiAlertCircle className="text-amber-400 text-lg shrink-0 mt-0.5" />
            <p>
              Quy định này áp dụng bắt buộc cho tất cả Giảng viên khi xuất bản khóa học công khai lên hệ thống E-Learn Academy nhằm bảo vệ quyền tác giả và tính hợp pháp của tài liệu giảng dạy.
            </p>
          </div>

          <div className="space-y-3 pt-1">
            <h4 className="font-bold text-slate-100 text-xs uppercase tracking-wider text-indigo-400">
              Điều khoản Chi tiết về Bản quyền & Trách nhiệm Nội dung:
            </h4>

            <div className="space-y-2.5 text-slate-300 text-xs pl-2 border-l-2 border-indigo-500/30">
              <p>
                <strong>1. Cam kết Quyền sở hữu Hợp pháp:</strong> Giảng viên khẳng định là tác giả duy nhất hoặc có đầy đủ giấy phép, bản quyền hợp pháp từ chủ sở hữu gốc đối với toàn bộ giáo trình, video bài giảng, tài liệu PDF và bài tập trong khóa học.
              </p>
              <p>
                <strong>2. Miễn trừ Trách nhiệm cho Nền tảng:</strong> Hệ thống E-Learn Academy được miễn trừ toàn bộ nghĩa vụ pháp lý, bồi thường tài chính hoặc các khiếu nại phát sinh từ bên thứ ba liên quan đến vi phạm bản quyền tác giả từ nội dung của Giảng viên.
              </p>
              <p>
                <strong>3. Quyền Tạm dừng & Gỡ bỏ:</strong> Ban quản trị hệ thống có quyền ngay lập tức tạm dừng hiển thị, thu hồi quyền truy cập hoặc gỡ bỏ khóa học nếu phát hiện có dấu hiệu sao chép, vi phạm bản quyền mà không cần báo trước.
              </p>
            </div>
          </div>

          {/* Interactive Confirmation Checkboxes */}
          <div className="pt-3 space-y-3 border-t border-slate-800">
            <div 
              onClick={() => setCheckedOwnership(!checkedOwnership)}
              className="flex items-start space-x-3 cursor-pointer select-none group p-3 rounded-xl hover:bg-slate-800/40 transition-all"
            >
              <div className="mt-0.5 text-indigo-400 text-lg shrink-0">
                {checkedOwnership ? <FiCheckSquare className="text-teal-400" /> : <FiSquare className="text-slate-500 group-hover:text-slate-400" />}
              </div>
              <span className="text-xs text-slate-200 font-medium">
                Tôi cam kết sở hữu 100% bản quyền hoặc có quyền hợp pháp sử dụng và phân phối toàn bộ nội dung trong khóa học này trên E-Learn Academy.
              </span>
            </div>

            <div 
              onClick={() => setCheckedLiability(!checkedLiability)}
              className="flex items-start space-x-3 cursor-pointer select-none group p-3 rounded-xl hover:bg-slate-800/40 transition-all"
            >
              <div className="mt-0.5 text-indigo-400 text-lg shrink-0">
                {checkedLiability ? <FiCheckSquare className="text-teal-400" /> : <FiSquare className="text-slate-500 group-hover:text-slate-400" />}
              </div>
              <span className="text-xs text-slate-200 font-medium">
                Tôi chấp nhận hoàn toàn trách nhiệm cá nhân và pháp lý trước cơ quan chức năng nếu xảy ra bất kỳ tranh chấp bản quyền nào liên quan đến khóa học.
              </span>
            </div>
          </div>

        </div>

        {/* Modal Footer / Action Buttons */}
        <div className="p-5 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-850 transition-all"
          >
            Hủy bỏ
          </button>

          <button
            type="button"
            disabled={!isFormValid || isSubmitting}
            onClick={handleConfirm}
            className={`px-6 py-2.5 rounded-xl text-xs font-bold transition-all shadow-lg flex items-center space-x-2 ${
              isFormValid && !isSubmitting
                ? 'bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-slate-950 shadow-emerald-500/20 cursor-pointer active:scale-95'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
            }`}
          >
            <span>{isSubmitting ? 'Đang xuất bản...' : 'Tôi Đồng Ý & Xuất Bản Khóa Học'}</span>
          </button>
        </div>

      </div>
    </div>
  );
};

export default InstructorCopyrightPolicyModal;
