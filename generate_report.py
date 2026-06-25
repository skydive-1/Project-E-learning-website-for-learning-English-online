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
    
    run_time = p_title.add_run("(Cập nhật tiến độ dự án từ khi khởi tạo đến ngày 24/06/2026 - Giữa Sprint 3)")
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
    add_meta_line(p_meta, "Kiến trúc hệ thống", "Modular Monolith (Express JS / React JS / PostgreSQL / VectorDB Pinecone)")
    add_meta_line(p_meta, "Tiến độ Sprint hiện tại", "Sprint 3: Hiện thực hóa tính năng Tiến độ học tập & Trợ lý ảo RAG Chatbot (22/06 - 26/06/2026)")
    add_meta_line(p_meta, "Nền tảng Database Cloud", "PostgreSQL (Supabase) + Pinecone Cloud Index (english-lessons)")
    
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
    p.add_run(" nhằm giảm thiểu sự phức tạp khi triển khai, tiết kiệm chi phí vận hành máy chủ, nhưng vẫn bảo đảm tính module hóa rõ rệt ở cả frontend và backend giúp đội ngũ phát triển 3 người làm việc song song, không chồng chéo mã nguồn. Đến thời điểm hiện tại (giữa Sprint 3), dự án đã đi được khoảng ")
    r_pct = p.add_run("75% - 80% chặng đường")
    r_pct.font.bold = True
    r_pct.font.color.rgb = c_orange
    p.add_run(", các khung chức năng lớn của học viên, giảng viên và hạ tầng dữ liệu RAG đã hoạt động ổn định trên môi trường local và Supabase Cloud.")

    # ----------------- SECTION 2 -----------------
    h1 = doc.add_paragraph()
    h1.paragraph_format.space_before = Pt(14)
    h1.paragraph_format.space_after = Pt(8)
    r = h1.add_run("II. TIẾN ĐỘ CHI TIẾT PHÂN HỆ FRONTEND (QUỐC ANH)")
    r.font.size = Pt(14)
    r.font.bold = True
    r.font.color.rgb = c_indigo
    
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p.add_run("Phân hệ Frontend được xây dựng bằng thư viện ")
    p.add_run("ReactJS (phiên bản 19)").font.bold = True
    p.add_run(" kết hợp với công cụ biên dịch siêu tốc ")
    p.add_run("Vite").font.bold = True
    p.add_run(". Toàn bộ giao diện được cấu trúc theo mô hình Modular gọn gàng, chia nhỏ các luồng nghiệp vụ thành các thư mục độc lập (Homepage, Auth, Courses, Lessons, Profile, Instructor, Progress, Chatbot) giúp tăng khả năng tái sử dụng và bảo trì mã nguồn.")
    
    p_sub = doc.add_paragraph()
    p_sub.add_run("Các hạng mục và giao diện đã hoàn thành 100%:").font.bold = True
    p_sub.paragraph_format.space_after = Pt(4)
    
    def add_bullet(doc, bold_txt, normal_txt):
        p_b = doc.add_paragraph(style='List Bullet')
        p_b.paragraph_format.space_after = Pt(3)
        r_b = p_b.add_run(bold_txt)
        r_b.font.bold = True
        r_b.font.size = Pt(11)
        r_n = p_b.add_run(normal_txt)
        r_n.font.size = Pt(11)

    add_bullet(doc, "Trang chủ hệ thống (HomePage): ", "Giới thiệu các khóa học nổi bật, lộ trình học trực quan, danh mục bài học và biểu đồ tổng quan, tạo ấn tượng ban đầu hiện đại, sạch sẽ.")
    add_bullet(doc, "Trang danh sách khóa học (CourseListPage): ", "Hiển thị danh sách khóa học kèm hình ảnh thu nhỏ (thumbnail), phân loại môn học và mức độ phù hợp.")
    add_bullet(doc, "Lộ trình học trực quan (RoadmapPage): ", "Cung cấp cái nhìn tổng quan về lộ trình học từ cơ bản đến nâng cao dưới dạng Grid, sử dụng màu sắc phân loại trạng thái bài học.")
    add_bullet(doc, "Trang chi tiết học tập bài giảng (LessonDetailPage): ", "Giao diện chính dành cho học viên, gồm khung phát video bài giảng chất lượng cao (hoặc xem tài liệu PDF), khu vực xem giáo trình bằng văn bản (Syllabus text content), tài liệu đính kèm bên ngoài (Attachments) có nút tải xuống trực tiếp và thanh playlist bài học xếp theo dạng accordion gập/mở thông minh.")
    add_bullet(doc, "Khung chat Trợ lý ảo AI Assistant: ", "Nằm cố định sát cạnh video bài giảng ở Sidebar bên phải. Giao diện trò chuyện được thiết kế tối ưu với bong bóng chat phân biệt màu sắc, hiệu ứng loading dấu ba chấm nhấp nháy chân thực, nút dọn dẹp lịch sử trò chuyện và các nút gợi ý câu hỏi nhanh (Quick Prompts) để người học click hỏi nhanh chatbot.")
    add_bullet(doc, "Hệ thống Quản lý Giảng viên (Instructor Dashboard & CourseEditor): ", "Giao diện quản lý toàn diện dành cho giáo viên, cho phép xem danh sách khóa học đã tạo, tạo mới khóa học hoặc chỉnh sửa chi tiết các chương mục bài giảng, tích hợp trực tiếp API lưu trữ dữ liệu thời gian thực xuống database.")
    add_bullet(doc, "Trang cá nhân & Xác thực (Profile, Login, Register Pages): ", "Cho phép chỉnh sửa thông tin cá nhân, xem ảnh đại diện, tích hợp xác thực thông tin nhập liệu, lưu Token đăng nhập cục bộ (localStorage) để bảo mật các trang riêng tư thông qua ProtectedRoute.")
    add_bullet(doc, "Cơ chế phản hồi dự phòng thông minh (Fallback Answers): ", "Trường hợp API chatbot backend chưa kịp kết nối hoặc lỗi dịch vụ, Frontend tự động kích hoạt bộ dữ liệu câu hỏi thường gặp được biên soạn sẵn (ngữ pháp, từ vựng, bài tập thực hành...) kết hợp thời gian trễ ngẫu nhiên (1.2s - 2.5s) mô phỏng quá trình AI phản hồi thực tế.")

    # ----------------- SECTION 3 -----------------
    h1 = doc.add_paragraph()
    h1.paragraph_format.space_before = Pt(14)
    h1.paragraph_format.space_after = Pt(8)
    r = h1.add_run("III. TIẾN ĐỘ CHI TIẾT PHÂN HỆ BACKEND (MINH LIÊM)")
    r.font.size = Pt(14)
    r.font.bold = True
    r.font.color.rgb = c_indigo
    
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p.add_run("Phân hệ Backend chạy trên nền tảng ")
    p.add_run("Node.js và Express framework").font.bold = True
    p.add_run(", tổ chức theo kiến trúc Modular Monolith. Mã nguồn backend được chia thành các folder cô lập rõ ràng: auth, courses, lessons, progress, chatbot. Mỗi module quản lý đầy đủ từ routes, controllers đến services để đảm bảo lỗi ở một chức năng không làm ảnh hưởng đến các chức năng khác.")
    
    p_sub = doc.add_paragraph()
    p_sub.add_run("Các chức năng và API đã hoàn thiện:").font.bold = True
    p_sub.paragraph_format.space_after = Pt(4)
    
    add_bullet(doc, "Module Xác thực (Auth Module): ", "Triển khai thành công các API đăng ký tài khoản mới, mã hóa mật khẩu bảo mật bằng thư viện bcryptjs, đăng nhập sinh mã JSON Web Token (JWT) và Middleware authenticate kiểm tra token tự động tại các API nội bộ.")
    add_bullet(doc, "Module Khóa học (Courses Module): ", "Hoàn thành API lấy danh mục môn học, danh sách khóa học kèm theo số lượng chương (sections) và bài giảng (lessons) được tính toán bằng truy vấn SQL tối ưu. Đặc biệt, API tạo mới khóa học được bao bọc trong một Database Transaction (giao dịch an toàn), đảm bảo chèn đồng thời khóa học, các chương học và bài giảng con vào cơ sở dữ liệu cùng lúc; nếu có bất kỳ lỗi nào xảy ra, hệ thống tự động Rollback để tránh rác dữ liệu.")
    add_bullet(doc, "Module Tiến trình học tập (Progress Module): ", "API lấy danh sách bài học đã hoàn thành theo User ID và API ghi nhận trạng thái hoàn thành bài học. Dịch vụ này sử dụng truy vấn UPSERT (INSERT ON CONFLICT DO UPDATE) của PostgreSQL để tránh tạo ra các bản ghi trùng lặp và loại bỏ lỗi xung đột dữ liệu (race-condition) khi người dùng click liên tục.")
    add_bullet(doc, "Module Chatbot RAG (Chatbot Module): ", "Hoàn thiện API Endpoint POST /api/chatbot/ask yêu cầu xác thực người dùng. Dịch vụ này tiếp nhận câu hỏi của người dùng và lesson_id hiện tại, gọi dịch vụ RAG để trả về kết quả.")
    add_bullet(doc, "Middleware dùng chung: ", "Middleware kiểm tra hợp lệ dữ liệu (validation.middleware), ghi nhận hoạt động (logger.middleware) và bộ xử lý lỗi toàn cục (Global Error Handler) bắt giữ và format các thông báo lỗi chuyên nghiệp gửi về client.")

    make_callout_box(doc, [
        "Hạ tầng kết nối AI thực tế trong file backend/src/utils/ai-clients.js hiện đang ở dạng Mock/Giả lập.",
        "Cần khẩn trương ráp nối thư viện SDK Pinecone Client và Google Generative AI (@google/generative-ai) thực tế vào file này để hoàn tất tích hợp RAG.",
        "Key bảo mật GEMINI_API_KEY và PINECONE_API_KEY cần được Quốc Anh và Liêm chia sẻ và dán vào file cấu hình môi trường .env cục bộ."
    ], "HẠN CHẾ CẦN KHẮC PHỤC NGAY Ở BACKEND")

    # ----------------- SECTION 4 -----------------
    h1 = doc.add_paragraph()
    h1.paragraph_format.space_before = Pt(14)
    h1.paragraph_format.space_after = Pt(8)
    r = h1.add_run("IV. TIẾN ĐỘ PHÂN HỆ DATABASE & PIPELINE HUẤN LUYỆN AI RAG (CHƯƠNG & Q.ANH)")
    r.font.size = Pt(14)
    r.font.bold = True
    r.font.color.rgb = c_indigo
    
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p.add_run("Hệ thống lưu trữ sử dụng hai loại cơ sở dữ liệu bổ trợ cho nhau: ")
    p.add_run("PostgreSQL").font.bold = True
    p.add_run(" (lưu trữ thông tin nghiệp vụ quan hệ được cấu hình trên nền tảng Supabase Cloud) và ")
    p.add_run("Pinecone").font.bold = True
    p.add_run(" (lưu trữ dữ liệu vector phục vụ truy tìm tri thức ngữ cảnh cho Chatbot AI).")
    
    p_sub = doc.add_paragraph()
    p_sub.add_run("1. Khởi tạo Cơ sở dữ liệu PostgreSQL (Supabase)").font.bold = True
    p_sub.paragraph_format.space_after = Pt(4)
    
    p_db_desc = doc.add_paragraph()
    p_db_desc.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p_db_desc.add_run("Database đã được cấu hình trực tuyến và đồng bộ hóa với server backend thành công. Hiện tại, database có ")
    p_db_desc.add_run("14 bảng").font.bold = True
    p_db_desc.add_run(" đã khởi tạo. Dưới đây là bảng thống kê số lượng dữ liệu thực tế đang có trong database phục vụ quá trình phát triển:")

    # Table of DB row counts
    db_tables = [
        ("1", "users", "12", "Lưu thông tin tài khoản đăng nhập học viên, giảng viên và quản trị.", "Đã hoàn thành"),
        ("2", "roles", "3", "Quy định vai trò phân quyền (1: Admin, 2: Học viên, 3: Giảng viên).", "Đã hoàn thành"),
        ("3", "courses", "3", "Lưu trữ thông tin khóa học (tên, mô tả, giảng viên, giá tiền, trạng thái).", "Đã hoàn thành"),
        ("4", "sections", "5", "Lưu trữ các chương học lớn của từng khóa học.", "Đã hoàn thành"),
        ("5", "lessons", "8", "Lưu trữ các bài giảng chi tiết (video URL, tài liệu PDF, loại nội dung).", "Đã hoàn thành"),
        ("6", "subjects", "5", "Lưu trữ danh sách môn học hỗ trợ phân loại khóa học.", "Đã hoàn thành"),
        ("7", "user_progress", "1", "Theo dõi vết tiến độ xem bài giảng (hoàn thành hay chưa) của học viên.", "Đã hoàn thành"),
        ("8", "ai_chat", "0", "Lưu trữ lịch sử chat của học viên với bot để tải lại lịch sử giống Udemy.", "Cần ráp API thật"),
        ("9", "classes", "0", "Lưu thông tin lớp học (chức năng mở rộng).", "Đang phát triển"),
        ("10", "teachers", "0", "Thông tin chi tiết giảng viên liên kết.", "Đang phát triển"),
        ("11", "students", "0", "Thông tin chi tiết học viên liên kết.", "Đang phát triển"),
        ("12", "grades", "0", "Lưu điểm số bài kiểm tra của học viên.", "Đang phát triển"),
        ("13", "quizz", "0", "Lưu ngân hàng câu hỏi trắc nghiệm tự luyện.", "Đang phát triển"),
        ("14", "payments", "0", "Lưu lịch sử thanh toán mua khóa học VIP.", "Đang phát triển")
    ]
    
    table = doc.add_table(rows=1, cols=5)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    add_table_borders(table)
    
    # Headers styling
    hdr_cells = table.rows[0].cells
    headers = ["STT", "Tên Bảng (Table)", "Bản Ghi (Rows)", "Mô Tả Vai Trò", "Trạng Thái"]
    col_widths = [Inches(0.5), Inches(1.2), Inches(0.8), Inches(3.2), Inches(1.3)]
    
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
            if text == "Đã hoàn thành":
                run.font.bold = True
                run.font.color.rgb = RGBColor(16, 185, 129) # Success Emerald Green
            elif text == "Cần ráp API thật":
                run.font.bold = True
                run.font.color.rgb = c_orange
            elif text == "Đang phát triển":
                run.font.color.rgb = RGBColor(148, 163, 184) # Muted Gray

    doc.add_paragraph().paragraph_format.space_before = Pt(8)
    
    p_sub2 = doc.add_paragraph()
    p_sub2.add_run("2. Pipeline Huấn luyện AI RAG bằng Python (Quốc Anh)").font.bold = True
    p_sub2.paragraph_format.space_after = Pt(4)
    
    p_rag_desc = doc.add_paragraph()
    p_rag_desc.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p_rag_desc.add_run("Phục vụ việc nạp tri thức học tập cho Chatbot, Quốc Anh đã xây dựng hoàn thiện một đường ống huấn luyện (Training Ingestion Pipeline) độc lập đặt trong thư mục ")
    p_rag_desc.add_run("rag-training/").font.bold = True
    p_rag_desc.add_run(". Pipeline này viết bằng Python cấu trúc Modular rất bài bản và đã chạy thử nghiệm thành công với các file dữ liệu ngữ pháp tiếng Anh. Quy trình hoạt động của pipeline gồm các bước:")
    
    add_bullet(doc, "Bước 1 - Ingestion (Document Loader): ", "Đọc các tài liệu bổ trợ bài học định dạng .txt hoặc .pdf từ thư mục data/. Hiện tại đã chuẩn bị sẵn 3 file tài liệu bài học: lesson1-supplement.txt, lesson3-supplement.txt, lesson5-supplement.txt.")
    add_bullet(doc, "Bước 2 - Chunking (Text Chunker): ", "Băm nhỏ tài liệu văn bản dài thành các đoạn nhỏ (Chunks) có kích thước 200 - 300 từ và độ gối đầu (overlap) từ 20 - 50 từ để bảo toàn ngữ cảnh liền mạch giữa các câu.")
    add_bullet(doc, "Bước 3 - Embeddings (Gemini Embedder): ", "Khởi tạo kết nối Google Gemini API và gọi mô hình text-embedding-004 của Google để chuyển đổi các đoạn văn bản thành vector biểu diễn ngữ nghĩa 768 chiều.")
    add_bullet(doc, "Bước 4 - Vector DB Upload (Pinecone Store): ", "Kiểm tra và tự động khởi tạo Index english-lessons với số chiều 768, metric Cosine trên Pinecone Cloud (Free Tier Serverless spec AWS us-east-1). Thực hiện upload toàn bộ chunks vector kèm theo siêu dữ liệu (metadata) bao gồm lesson_id và nội dung text tương ứng.")
    add_bullet(doc, "Bước 5 - Đánh giá thử nghiệm (Evaluation): ", "Sử dụng các câu hỏi truy vấn thử nghiệm như 'How to learn English effectively?' và 'What is shadowing method?' để kiểm tra độ tương đồng tương đối và trích xuất đúng ngữ cảnh văn bản.")

    # ----------------- SECTION 5 -----------------
    h1 = doc.add_paragraph()
    h1.paragraph_format.space_before = Pt(14)
    h1.paragraph_format.space_after = Pt(8)
    r = h1.add_run("V. ĐÁNH GIÁ CHUNG VÀ KẾ HOẠCH HOÀN THIỆN TIẾP THEO")
    r.font.size = Pt(14)
    r.font.bold = True
    r.font.color.rgb = c_indigo
    
    p_sub3 = doc.add_paragraph()
    p_sub3.add_run("1. Ưu điểm nổi bật của hệ thống hiện tại").font.bold = True
    p_sub3.paragraph_format.space_after = Pt(4)
    
    add_bullet(doc, "Tính thực tiễn cao: ", "Sự kết hợp giữa bài giảng video Udemy và khung chat AI bên cạnh tạo nên sự đột phá trong cách học tập tương tác, giúp học viên giải quyết rào cản ngôn ngữ lập tức.")
    add_bullet(doc, "Kiến trúc rõ ràng: ", "Bảo đảm khả năng mở rộng tốt. Cấu trúc thư mục ngăn nắp giúp phân tách rạch ròi trách nhiệm của các thành viên trong nhóm.")
    add_bullet(doc, "Đồng bộ dữ liệu: ", "API Backend sử dụng transaction và upsert thông minh giúp hệ thống chạy mượt mà, bảo toàn tính đúng đắn của dữ liệu ngay cả khi có xung đột mạng.")
    
    p_sub4 = doc.add_paragraph()
    p_sub4.add_run("2. Các rủi ro và điểm nghẽn kỹ thuật (Hạn chế)").font.bold = True
    p_sub4.paragraph_format.space_after = Pt(4)
    
    add_bullet(doc, "Kết nối AI ở Backend bị Mock: ", "Như đã chỉ ra, backend mới mô phỏng phản hồi AI bằng mã tĩnh. Đây là điểm nghẽn lớn nhất ngăn cản chatbot RAG hoạt động thực tế trên UI.")
    add_bullet(doc, "Độ lệch cấu trúc bảng lịch sử chat: ", "Bảng ai_chat lưu trong cơ sở dữ liệu Supabase sử dụng cấu trúc student_id và sender_type, trong khi tài liệu thiết kế ban đầu đề xuất chat_history sử dụng user_id và sender. Cần thống nhất lại cấu trúc này trong code backend khi tiến hành kết nối.")
    add_bullet(doc, "Thiếu dữ liệu chat thực tế: ", "Hiện tại bảng ai_chat chưa có dòng dữ liệu nào do luồng chat thực tế chưa được kích hoạt liên thông.")
    
    p_sub5 = doc.add_paragraph()
    p_sub5.add_run("3. Kế hoạch hành động để hoàn thành Sprint 3 (Trước ngày 26/06/2026)").font.bold = True
    p_sub5.paragraph_format.space_after = Pt(4)
    
    p_plan = doc.add_paragraph()
    p_plan.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p_plan.add_run("Để kích hoạt thành công 'linh hồn' của đồ án trước hạn chót Sprint 3, nhóm cần ưu tiên thực hiện các công việc sau:")
    
    add_bullet(doc, "Nhiệm vụ 1 (Trần Minh Liêm): ", "Thay thế file mock backend/src/utils/ai-clients.js bằng mã nguồn tích hợp thực tế sử dụng SDK @google/generative-ai và @pinecone-database/pinecone. Thực hiện lọc dữ liệu vector theo đúng lesson_id bằng filter của Pinecone.")
    add_bullet(doc, "Nhiệm vụ 2 (Nguyễn Hữu Chương): ", "Cập nhật logic hoặc đồng bộ lại bảng ai_chat trong database Supabase, sẵn sàng hỗ trợ API lưu lịch sử tin nhắn của học viên khi trò chuyện.")
    add_bullet(doc, "Nhiệm vụ 3 (Nguyễn Quốc Anh): ", "Kiểm tra và lấy key từ Google AI Studio gửi cho Liêm. Chạy thử nghiệm toàn trình (End-to-End) luồng Chatbot từ giao diện React, gọi API Backend, truy vấn Pinecone Index, gửi prompt đến Gemini và trả phản hồi lại màn hình học viên.")
    
    # Bottom Signatures
    doc.add_paragraph().paragraph_format.space_before = Pt(24)
    p_sig = doc.add_paragraph()
    p_sig.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    p_sig.paragraph_format.right_indent = Inches(0.5)
    
    run_sig_date = p_sig.add_run("Hà Nội, ngày 24 tháng 06 năm 2026\n")
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
