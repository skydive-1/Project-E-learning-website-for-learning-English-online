# -*- coding: utf-8 -*-
import sys
import docx
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn

def set_cell_background(cell, fill_hex):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{fill_hex}"/>')
    tcPr.append(shd)

def set_cell_margins(cell, top=140, bottom=140, left=180, right=180):
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = OxmlElement('w:tcMar')
    for m, val in [('w:top', top), ('w:bottom', bottom), ('w:left', left), ('w:right', right)]:
        node = OxmlElement(m)
        node.set(qn('w:w'), str(val))
        node.set(qn('w:type'), 'dxa')
        tcMar.append(node)
    tcPr.append(tcMar)

def add_table_borders(table):
    tblPr = table._tbl.tblPr
    borders = parse_xml(
        '<w:tblBorders %s>'
        '<w:top w:val="single" w:sz="6" w:space="0" w:color="1D4ED8"/>'
        '<w:bottom w:val="single" w:sz="6" w:space="0" w:color="1D4ED8"/>'
        '<w:left w:val="none"/>'
        '<w:right w:val="none"/>'
        '<w:insideH w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/>'
        '<w:insideV w:val="none"/>'
        '</w:tblBorders>' % nsdecls('w')
    )
    tblPr.append(borders)

def make_callout_box(doc, text_list, title="LƯU Ý QUAN TRỌNG"):
    # Create a single cell table for callout box
    table = doc.add_table(rows=1, cols=1)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    cell = table.cell(0, 0)
    set_cell_background(cell, "F8FAFC") # slate-50
    set_cell_margins(cell, top=200, bottom=200, left=250, right=200)
    
    # Left border only (thick Smart Indigo blue)
    tcPr = cell._tc.get_or_add_tcPr()
    borders = parse_xml(
        '<w:tcBorders %s>'
        '<w:top w:val="none"/>'
        '<w:bottom w:val="none"/>'
        '<w:left w:val="single" w:sz="36" w:space="0" w:color="1D4ED8"/>'
        '<w:right w:val="none"/>'
        '</w:tcBorders>' % nsdecls('w')
    )
    tcPr.append(borders)
    
    # Add content
    p = cell.paragraphs[0]
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(4)
    run_title = p.add_run(f"★ {title}\n")
    run_title.font.name = 'Times New Roman'
    run_title.font.size = Pt(11)
    run_title.font.bold = True
    run_title.font.color.rgb = RGBColor(29, 78, 216) # Smart Indigo
    
    for i, text in enumerate(text_list):
        run = p.add_run(text)
        run.font.name = 'Times New Roman'
        run.font.size = Pt(10.5)
        run.font.color.rgb = RGBColor(71, 85, 105) # Slate-600
        if i < len(text_list) - 1:
            p.add_run("\n")
            
    doc.add_paragraph().paragraph_format.space_before = Pt(6) # Empty spacing after callout

def main():
    doc = Document()
    
    # Set page size to A4
    for section in doc.sections:
        section.page_width = Inches(8.27)
        section.page_height = Inches(11.69)
        section.top_margin = Inches(1.0)     # 2.54 cm
        section.bottom_margin = Inches(1.0)  # 2.54 cm
        section.left_margin = Inches(1.18)   # 3.0 cm
        section.right_margin = Inches(0.78)  # 2.0 cm
        
    # Colors
    c_indigo = RGBColor(29, 78, 216) # #1d4ed8
    c_orange = RGBColor(255, 122, 48) # #ff7a30
    c_ink = RGBColor(15, 23, 42) # #0f172a
    
    # Normal Style configuration
    style = doc.styles['Normal']
    style.font.name = 'Times New Roman'
    style.font.size = Pt(13)
    style.font.color.rgb = c_ink
    style.paragraph_format.line_spacing = 1.3
    style.paragraph_format.space_after = Pt(6)
    
    # COVER / HEADER TITLE
    p_title = doc.add_paragraph()
    p_title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_title.paragraph_format.space_before = Pt(12)
    p_title.paragraph_format.space_after = Pt(18)
    
    run_sub = p_title.add_run("BÁO CÁO TIẾN ĐỘ DỰ ÁN ĐỒ ÁN TỐT NGHỆP\n")
    run_sub.font.size = Pt(14)
    run_sub.font.bold = True
    run_sub.font.color.rgb = c_orange
    
    run_main = p_title.add_run("WEBSITE E-LEARNING HỌC TIẾNG ANH TRỰC TUYẾN\nTÍCH HỢP TRỢ LÝ RAG CHATBOT AI VÀ PHÂN QUYỀN VIP\n")
    run_main.font.size = Pt(16)
    run_main.font.bold = True
    run_main.font.color.rgb = c_indigo
    
    run_time = p_title.add_run("(Cập nhật tiến độ dự án tính đến ngày 30/06/2026 - Chuẩn bị báo cáo ngày 02/07/2026)")
    run_time.font.size = Pt(11)
    run_time.font.italic = True
    run_time.font.color.rgb = RGBColor(100, 116, 139)
    
    # Metadata info box
    p_meta = doc.add_paragraph()
    p_meta.alignment = WD_ALIGN_PARAGRAPH.LEFT
    p_meta.paragraph_format.left_indent = Inches(0.5)
    p_meta.paragraph_format.space_after = Pt(24)
    
    def add_meta_line(p, label, value):
        r_lbl = p.add_run(f"• {label}: ")
        r_lbl.font.bold = True
        r_lbl.font.size = Pt(11)
        r_val = p.add_run(f"{value}\n")
        r_val.font.size = Pt(11)
        
    add_meta_line(p_meta, "Thành viên thực hiện", "Nguyễn Quốc Anh (Frontend & RAG AI), Trần Minh Liêm (Backend & AI), Nguyễn Hữu Chương (Database)")
    add_meta_line(p_meta, "Kiến trúc hệ thống", "Modular Monolith (Express JS / React JS 19 / PostgreSQL / VectorDB Pinecone)")
    add_meta_line(p_meta, "Tiến độ hiện tại", "Hoàn thành khoảng 85% - 90% khối lượng công việc, chuẩn bị báo cáo tiến độ và demo ngày 02/07/2026")
    add_meta_line(p_meta, "Nền tảng Database Cloud", "PostgreSQL (Supabase) + Pinecone Cloud Index (english-lessons) + Gemini AI Studio")
    
    # Horizontal Divider Line
    p_div = doc.add_paragraph()
    p_div.paragraph_format.space_after = Pt(12)
    r_div = p_div.add_run("_________________________________________________________________________________")
    r_div.font.color.rgb = RGBColor(226, 232, 240)
    r_div.font.bold = True

    # ----------------- SECTION 1 -----------------
    h1 = doc.add_paragraph()
    h1.paragraph_format.space_before = Pt(14)
    h1.paragraph_format.space_after = Pt(8)
    r = h1.add_run("I. TỔNG QUAN HỆ THỐNG VÀ TIẾN ĐỘ CHUNG DỰ ÁN")
    r.font.size = Pt(14)
    r.font.bold = True
    r.font.color.rgb = c_indigo
    
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p.add_run("Hệ thống E-learning học tiếng Anh trực tuyến được định vị theo tiêu chuẩn thiết kế và vận hành chuyên nghiệp của ")
    r_udemy = p.add_run("Udemy")
    r_udemy.font.bold = True
    p.add_run(". Định hướng cốt lõi của dự án là lấy người học làm trung tâm (Content-First), tối ưu hóa trải nghiệm xem bài giảng và tích hợp một ")
    r_tutor = p.add_run("Trợ lý học tập ảo thông minh (AI Learning Assistant)")
    r_tutor.font.bold = True
    p.add_run(" áp dụng kỹ thuật RAG (Retrieval-Augmented Generation) để hỗ trợ phản xạ ngôn ngữ, ngữ pháp và giải đáp thắc mắc của học viên trực tiếp theo nội dung bài học đang xem.")
    
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p.add_run("Kiến trúc phần mềm được lựa chọn là ")
    r_arch = p.add_run("Modular Monolith")
    r_arch.font.bold = True
    p.add_run(" nhằm giảm thiểu sự phức tạp khi triển khai, tiết kiệm chi phí vận hành máy chủ, nhưng vẫn bảo đảm tính module hóa rõ rệt ở cả frontend và backend giúp đội ngũ phát triển 3 người làm việc song song, không chồng chéo mã nguồn. Đến thời điểm hiện tại (cuối Sprint 3, chuẩn bị báo cáo tiến độ tuần này), dự án đã hoàn thành ")
    r_pct = p.add_run("khoảng 85% - 90% chặng đường")
    r_pct.font.bold = True
    r_pct.font.color.rgb = c_orange
    p.add_run(", các khung chức năng lớn của học viên, giảng viên, hệ thống trắc nghiệm và hạ tầng kết nối RAG AI thực tế đã hoạt động ổn định và liên thông hoàn toàn.")

    # ----------------- SECTION 2 -----------------
    h1 = doc.add_paragraph()
    h1.paragraph_format.space_before = Pt(14)
    h1.paragraph_format.space_after = Pt(8)
    r = h1.add_run("II. NHỮNG KẾT QUẢ ĐÃ ĐẠT ĐƯỢC (TÍNH ĐẾN 30/06/2026)")
    r.font.size = Pt(14)
    r.font.bold = True
    r.font.color.rgb = c_indigo
    
    p_sub = doc.add_paragraph()
    p_sub.add_run("1. Phân hệ Frontend (Nguyễn Quốc Anh):").font.bold = True
    p_sub.paragraph_format.space_after = Pt(4)
    
    def add_bullet(doc, bold_txt, normal_txt):
        p_b = doc.add_paragraph(style='List Bullet')
        p_b.paragraph_format.space_after = Pt(3)
        r_b = p_b.add_run(bold_txt)
        r_b.font.bold = True
        r_b.font.size = Pt(11)
        r_n = p_b.add_run(normal_txt)
        r_n.font.size = Pt(11)

    add_bullet(doc, "Responsive Web Design (RWD) hoàn thiện: ", "Toàn bộ giao diện hệ thống đã được tối ưu hóa hiển thị, tự động thích ứng mượt mà trên mọi thiết bị khác nhau bao gồm điện thoại di động, máy tính bảng và máy tính để bàn.")
    add_bullet(doc, "Tích hợp Giao diện Sáng/Tối (Light & Dark Mode): ", "Xây dựng hệ thống Context quản lý theme chung (ThemeContext.jsx) tích hợp nút chuyển đổi nhanh trên thanh công cụ Header. Cấu hình SCSS đồng bộ giúp chuyển đổi màu sắc, độ tương phản mượt mà, hạn chế mỏi mắt khi học tập lâu dài.")
    add_bullet(doc, "Trang cá nhân & Xác thực (Profile, Login, Register Pages): ", "Cho phép người dùng chỉnh sửa thông tin cá nhân, thay đổi ảnh đại diện. Tích hợp validation nhập liệu chặt chẽ ở form đăng ký/đăng nhập, lưu giữ JSON Web Token cục bộ tại localStorage để bảo mật các trang riêng tư (ProtectedRoute).")
    add_bullet(doc, "Trang chủ hệ thống (HomePage): ", "Giới thiệu các khóa học nổi bật, lộ trình học trực quan, danh mục bài học và biểu đồ tổng quan, tạo ấn tượng ban đầu hiện đại, sạch sẽ.")
    add_bullet(doc, "Trang danh sách khóa học (CourseListPage): ", "Hiển thị danh sách khóa học kèm hình ảnh thu nhỏ (thumbnail), phân loại môn học và mức độ phù hợp.")
    add_bullet(doc, "Lộ trình học trực quan (RoadmapPage): ", "Cung cấp cái nhìn tổng quan về lộ trình học từ cơ bản đến nâng cao dưới dạng Grid, sử dụng màu sắc phân loại trạng thái bài học.")
    add_bullet(doc, "Trang học tập bài giảng (LessonDetailPage): ", "Giao diện chính dành cho học viên, gồm khung phát video bài giảng chất lượng cao, khu vực xem giáo trình bằng văn bản (Syllabus text content), tài liệu đính kèm bên ngoài (Attachments) có nút tải xuống trực tiếp và thanh playlist bài học xếp theo dạng accordion gập/mở thông minh.")
    add_bullet(doc, "Khung chat Trợ lý ảo AI Assistant: ", "Sidebar trò chuyện bên phải video bài học được thiết kế tối ưu với bong bóng chat phân biệt màu sắc, hiệu ứng loading dấu ba chấm nhấp nháy chân thực, nút dọn dẹp lịch sử trò chuyện và các nút gợi ý câu hỏi nhanh (Quick Prompts) để người học click hỏi nhanh chatbot.")

    p_sub = doc.add_paragraph()
    p_sub.add_run("2. Phân hệ Backend & Kết nối AI (Trần Minh Liêm):").font.bold = True
    p_sub.paragraph_format.space_after = Pt(4)
    
    add_bullet(doc, "Tích hợp thực tế Gemini & Pinecone (Loại bỏ Mock): ", "Thay thế thành công toàn bộ mã giả lập (Mock Client) trước đây. Kết nối thực tế API Gemini API (sử dụng model gemini-2.5-flash và gemini-embedding-001) và cơ sở dữ liệu Vector Database Pinecone (Index: english-lessons, 768 chiều).")
    add_bullet(doc, "Xử lý RAG Chat thực tế: ", "Chatbot backend tiếp nhận câu hỏi của người dùng, tự động gọi Gemini tạo vector embedding của câu hỏi, thực hiện truy vấn độ tương đồng cosine trên Pinecone với bộ lọc lesson_id để trích xuất ngữ cảnh bổ trợ chính xác theo từng bài học cụ thể, sau đó tổng hợp câu trả lời gửi về client.")
    add_bullet(doc, "Lưu lịch sử chat (Chat History API): ", "Hiện thực hóa luồng lưu trữ lịch sử trò chuyện của học viên với AI. Phát triển các API endpoint GET/POST /api/chatbot/history liên kết chặt chẽ với cơ sở dữ liệu PostgreSQL (bảng ai_chat), tự động tải lại toàn bộ nội dung trò chuyện cũ khi học viên quay lại bài học.")
    add_bullet(doc, "Prompt Engineering tối ưu hóa: ", "Tinh chỉnh prompt hệ thống giúp Gemini đóng vai giáo viên tiếng Anh phản hồi tự nhiên, sinh động, định dạng markdown rõ ràng. Sử dụng IPA (phiên âm chuẩn) kèm ví dụ thực tế khi giải nghĩa từ vựng; loại bỏ hoàn toàn các câu trả lời rập khuôn kiểu máy móc.")
    add_bullet(doc, "Cấu hình Google Login (Google OAuth): ", "Thiết lập cấu hình xác thực OAuth với Google giúp người học có thể đăng nhập nhanh chóng bằng tài khoản Gmail cá nhân mà không cần tạo mật khẩu mới.")
    add_bullet(doc, "Module Quản lý Khóa học & Tiến trình học tập: ", "Các API CRUD khóa học bảo vệ bởi Database Transactions (giao dịch an toàn). API ghi nhận tiến trình học tập sử dụng UPSERT của PostgreSQL tránh lỗi race-condition hoặc trùng lặp bản ghi.")

    p_sub = doc.add_paragraph()
    p_sub.add_run("3. Phân hệ Trắc nghiệm tự luyện - Quizzes System (Nhóm phát triển):").font.bold = True
    p_sub.paragraph_format.space_after = Pt(4)
    
    add_bullet(doc, "Giao diện làm Quiz tương tác (PlayQuizPage): ", "Thiết kế bộ giao diện làm bài trắc nghiệm đẹp mắt, có đếm ngược thời gian, thanh tiến trình trực quan, hiển thị kết quả chấm điểm tức thì và đưa ra giải thích ngữ pháp chi tiết cho từng đáp án đúng/sai.")
    add_bullet(doc, "Tính năng AI sinh Quiz tự động (AI Quiz Generator): ", "Trên Dashboard của Giảng viên, tích hợp tính năng cho phép giáo viên nhập chủ đề (topic) và số câu hỏi mong muốn, hệ thống sẽ gọi Gemini AI tự động sinh bộ câu hỏi trắc nghiệm tiếng Anh tương ứng giúp giảm thời gian soạn giáo án của giáo viên.")
    add_bullet(doc, "Quản lý danh sách Quiz (QuizzesListPage): ", "Hiển thị danh sách các đề trắc nghiệm tự luyện chia theo độ khó (Easy, Medium, Hard), giới hạn thời gian làm bài, giúp học viên tự học dễ dàng.")

    p_sub = doc.add_paragraph()
    p_sub.add_run("4. Phân hệ Cơ sở dữ liệu (Nguyễn Hữu Chương):").font.bold = True
    p_sub.paragraph_format.space_after = Pt(4)
    
    p_db_desc = doc.add_paragraph()
    p_db_desc.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p_db_desc.add_run("Cơ sở dữ liệu PostgreSQL trực tuyến trên Supabase Cloud được thiết kế đồng bộ với hệ thống Backend thông qua 14 bảng quan hệ đã được chuẩn hóa. Bảng dưới đây thể hiện số lượng dữ liệu thực tế đang chạy ổn định trong quá trình phát triển:")

    # Table of DB row counts
    db_tables = [
        ("1", "users", "14", "Lưu thông tin tài khoản đăng nhập (Học viên, Giảng viên, Admin).", "Đã hoàn thành"),
        ("2", "roles", "3", "Quy định vai trò phân quyền (1: Admin, 2: Instructor, 3: Student).", "Đã hoàn thành"),
        ("3", "courses", "4", "Lưu trữ thông tin khóa học (tên, mô tả, giảng viên, giá tiền, trạng thái).", "Đã hoàn thành"),
        ("4", "sections", "6", "Lưu trữ các chương học lớn của từng khóa học.", "Đã hoàn thành"),
        ("5", "lessons", "11", "Lưu trữ các bài giảng chi tiết (video URL, tài liệu PDF, loại nội dung).", "Đã hoàn thành"),
        ("6", "subjects", "5", "Lưu trữ danh sách môn học hỗ trợ phân loại khóa học.", "Đã hoàn thành"),
        ("7", "user_progress", "1", "Theo dõi vết tiến độ xem bài giảng của học viên.", "Đã hoàn thành"),
        ("8", "ai_chat", "Hoạt động tốt", "Lưu trữ lịch sử chat của học viên với bot để tải lại trên UI.", "Đã hoàn thành"),
        ("9", "quizz", "0", "Lưu ngân hàng câu hỏi trắc nghiệm tự luyện (Hiện đang lưu tạm LocalStorage).", "Đang đồng bộ hóa"),
        ("10", "classes", "0", "Lưu thông tin lớp học (chức năng mở rộng).", "Đang phát triển"),
        ("11", "teachers", "0", "Thông tin chi tiết giảng viên liên kết.", "Đang phát triển"),
        ("12", "students", "0", "Thông tin chi tiết học viên liên kết.", "Đang phát triển"),
        ("13", "grades", "0", "Lưu điểm số bài kiểm tra của học viên.", "Đang phát triển"),
        ("14", "payments", "0", "Lưu lịch sử thanh toán mua khóa học VIP.", "Đang phát triển")
    ]
    
    table = doc.add_table(rows=1, cols=5)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    add_table_borders(table)
    
    # Headers styling
    hdr_cells = table.rows[0].cells
    headers = ["STT", "Tên Bảng (Table)", "Bản Ghi (Rows)", "Mô Tả Vai Trò", "Trạng Thái"]
    col_widths = [Inches(0.5), Inches(1.3), Inches(1.0), Inches(3.2), Inches(1.3)]
    
    for i, header_text in enumerate(headers):
        hdr_cells[i].text = header_text
        hdr_cells[i].width = col_widths[i]
        set_cell_background(hdr_cells[i], "1D4ED8") # Smart Indigo background
        set_cell_margins(hdr_cells[i], top=120, bottom=120, left=100, right=100)
        p = hdr_cells[i].paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        run = p.runs[0]
        run.font.bold = True
        run.font.size = Pt(10)
        run.font.color.rgb = RGBColor(255, 255, 255)
        
    for row_data in db_tables:
        row = table.add_row()
        for idx, text in enumerate(row_data):
            cell = row.cells[idx]
            cell.text = text
            cell.width = col_widths[idx]
            set_cell_margins(cell, top=100, bottom=100, left=100, right=100)
            p = cell.paragraphs[0]
            p.paragraph_format.line_spacing = 1.15
            p.paragraph_format.space_after = Pt(2)
            run = p.runs[0]
            run.font.size = Pt(9.5)
            
            # Alignments
            if idx in [0, 2, 4]:
                p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            else:
                p.alignment = WD_ALIGN_PARAGRAPH.LEFT
                
            # Shading for status
            if text in ["Đã hoàn thành"]:
                run.font.bold = True
                run.font.color.rgb = RGBColor(16, 185, 129) # Success Emerald Green
            elif text == "Đang đồng bộ hóa":
                run.font.bold = True
                run.font.color.rgb = c_orange
            elif text == "Đang phát triển":
                run.font.color.rgb = RGBColor(148, 163, 184) # Muted Gray

    doc.add_paragraph().paragraph_format.space_before = Pt(8)
    
    # Pipeline info
    p_pipeline = doc.add_paragraph()
    p_pipeline.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p_pipeline.add_run("Pipeline Huấn luyện RAG (rag-training/): ").font.bold = True
    p_pipeline.add_run("Đường ống Ingestion nạp tri thức viết bằng Python đã hoàn thiện cấu trúc Modular. Chương trình tự động đọc các tài liệu văn bản (.txt, .pdf), băm nhỏ thành các đoạn có độ gối đầu (overlap), gọi API Gemini chuyển đổi thành vector 768 chiều và tải lên Pinecone Vector Database Cloud.")

    # ----------------- SECTION 3 -----------------
    h1 = doc.add_paragraph()
    h1.paragraph_format.space_before = Pt(14)
    h1.paragraph_format.space_after = Pt(8)
    r = h1.add_run("III. NHỮNG HẠNG MỤC CHƯA ĐẠT ĐƯỢC VÀ HẠN CHẾ")
    r.font.size = Pt(14)
    r.font.bold = True
    r.font.color.rgb = c_indigo
    
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p.add_run("Bên cạnh các kết quả lớn đã đạt được để chuẩn bị báo cáo tiến độ, dự án vẫn còn một số điểm hạn chế và các chức năng chưa đạt được như mong muốn:")
    
    add_bullet(doc, "1. Dữ liệu Quizzes chưa đồng bộ về cơ sở dữ liệu Backend: ", "Hệ thống làm Quiz ở Frontend hiện vẫn đang quản lý và lưu giữ dữ liệu thông qua LocalStorage. Cần phát triển các API lưu trữ Quiz tập trung trên PostgreSQL (bảng quizz) để giáo viên có thể quản lý tập trung và học viên làm bài trên mọi thiết bị mà không bị mất tiến trình.")
    add_bullet(doc, "2. Các bảng dữ liệu mở rộng chưa được kích hoạt: ", "Các bảng bổ sung như classes (lớp học), teachers (giảng viên), students (học viên), grades (điểm số), và payments (thanh toán VIP) đã được khởi tạo cấu trúc trong database PostgreSQL nhưng chưa được viết API kết nối đầy đủ hoặc chưa được tích hợp lên giao diện người dùng.")
    add_bullet(doc, "3. Môi trường triển khai trực tuyến (Deployment Cloud): ", "Dự án hiện tại đang chạy tốt dưới môi trường phát triển cục bộ (localhost). Cần khẩn trương triển khai server backend lên Cloud (như Render hoặc Railway) và frontend React lên Cloud (như Vercel hoặc Netlify) để hội đồng phản biện có thể truy cập, kiểm thử trực tuyến mà không cần cài đặt code tại máy.")
    add_bullet(doc, "4. Thiếu bộ kiểm thử tự động (Automated Testing): ", "Dự án chưa có bộ Unit Test hoặc Integration Test tự động cho các API backend quan trọng, chủ yếu vẫn là kiểm thử thủ công và debug bằng log, điều này có thể gây rủi ro khi hệ thống phát triển quy mô lớn hơn.")

    make_callout_box(doc, [
        "Cần hoàn thiện đồng bộ dữ liệu Quiz từ LocalStorage về PostgreSQL trước ngày báo cáo chính thức.",
        "Tiến hành deploy thử nghiệm Frontend lên Vercel và Backend lên Render để hội đồng có thể thao tác demo trực tiếp.",
        "Tạo sẵn các tài khoản mẫu cho các vai trò: Học viên (Student), Giáo viên (Instructor), Quản trị viên (Admin) để phần demo trong buổi báo cáo diễn ra trơn tru."
    ], "KẾ HOẠCH HÀNH ĐỘNG KHẨN CẤP TRƯỚC BUỔI BÁO CÁO")

    # ----------------- SECTION 4 -----------------
    h1 = doc.add_paragraph()
    h1.paragraph_format.space_before = Pt(14)
    h1.paragraph_format.space_after = Pt(8)
    r = h1.add_run("IV. ĐÁNH GIÁ CHUNG VÀ KẾ HOẠCH BÁO CÁO")
    r.font.size = Pt(14)
    r.font.bold = True
    r.font.color.rgb = c_indigo
    
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p.add_run("Đến thời điểm hiện tại, dự án đã đạt được các cột mốc kỹ thuật rất quan trọng, đặc biệt là sự kết hợp nhuần nhuyễn giữa học tập video truyền thống và ")
    p.add_run("trợ lý học tập RAG AI thực tế").font.bold = True
    p.add_run(". Các thành viên đã phối hợp chặt chẽ, kiểm soát tốt cấu trúc mã nguồn thông qua mô hình Modular Monolith.")
    
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p.add_run("Để chuẩn bị tốt nhất cho buổi báo cáo tiến độ vào thứ Năm tuần này (02/07/2026), nhóm phát triển sẽ tập trung hoàn thiện giao diện demo, đảm bảo các kết nối Cloud luôn sẵn sàng và chuẩn bị slide thuyết trình nêu bật được giá trị cốt lõi là giải pháp trợ lý ảo thông minh giải đáp ngữ cảnh bài học.")
    
    # Bottom Signatures
    doc.add_paragraph().paragraph_format.space_before = Pt(24)
    p_sig = doc.add_paragraph()
    p_sig.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    p_sig.paragraph_format.right_indent = Inches(0.5)
    
    run_sig_date = p_sig.add_run("Hà Nội, ngày 30 tháng 06 năm 2026\n")
    run_sig_date.font.italic = True
    run_sig_date.font.size = Pt(11)
    
    run_sig_title = p_sig.add_run("ĐẠI DIỆN NHÓM PHÁT TRIỂN DỰ ÁN\n\n\n\n")
    run_sig_title.font.bold = True
    run_sig_title.font.size = Pt(11.5)
    
    run_sig_name = p_sig.add_run("Tập thể thành viên thực hiện đồ án")
    run_sig_name.font.bold = True
    run_sig_name.font.size = Pt(11.5)

    doc.save("Bao_Cao_Tien_Do_Du_An.docx")
    print("SUCCESS: Da tao thanh cong file Word bao cao tien do: Bao_Cao_Tien_Do_Du_An.docx")

if __name__ == "__main__":
    main()
