# SCORING METHODOLOGY & ASSESSMENT SPECIFICATIONS
## HỆ THỐNG QUY CHUẨN VÀ THUẬT TOÁN ĐÁNH GIÁ ĐIỂM SỐ NĂNG LỰC TIẾNG ANH

---

### THÔNG TIN DỰ ÁN & THÀNH VIÊN NHÓM THỰC HIỆN
- **Dự án**: Website Học Tiếng Anh Trực Tuyến Tích Hợp AI & RAG Engine (E-Learning English Platform)
- **Thành viên nhóm thực hiện**:
  1. **NGUYỄN DŨNG QUỐC ANH** — Vai trò: Frontend & AI UI Integration Developer
  2. **NGUYỄN THANH LIÊM** — Vai trò: Backend & Security Developer
  3. **LÊ ĐÌNH CHƯƠNG** — Vai trò: Database Administrator & Infrastructure Specialist

---

## 1. TỔNG QUAN NGUYÊN TẮC THIẾT KẾ ĐÁNH GIÁ (ASSESSMENT PRINCIPLES)

Hệ thống đánh giá và chấm điểm năng lực tiếng Anh trực tuyến được thiết kế theo các nguyên lý cốt lõi:
1. **Backend Deterministic Ownership**: Toàn bộ công thức tính toán điểm tổng quát (`overallScore`), tỷ lệ phần trăm chính xác, điều kiện hoàn thành bài học (Mastery Learning threshold $\ge 50\%$) và quy tắc làm tròn được kiểm soát tất định tại Backend Node.js.
2. **International Standardization**: Căn cứ trực tiếp theo các khung khảo thí ngôn ngữ quốc tế:
   - **ETS** (TOEIC Listening & Reading, TOEFL iBT Speaking Rubrics & Relevance Gate).
   - **Pearson Education** (PTE Academic Score Guide — Read Aloud, Acoustic Scoring, WER).
   - **Cambridge / British Council / IDP** (IELTS Speaking & Writing Public Band Descriptors, B2 First / C1 Advanced Use of English).
3. **Defense-in-Depth & Anti-Leak Security**:
   - Triệt tiêu lỗ hổng Answer Leakage: Xóa hoàn toàn `correct_answer` khỏi payload trả về người học ở mọi endpoint công khai (`GET /api/quizzes/:courseId`, `/detail/:quizId`, `/join-by-pin/:pinCode`).
   - Ngăn chặn AI Hallucination: Buffer âm thanh $< 1500$ bytes tự động gán 0 điểm.

---

## 2. MA TRẬN PHƯƠNG PHÁP CHẤM ĐIỂM THEO TỪNG DẠNG CÂU HỎI

| Question Type | Tên Dạng Bài | Chuẩn Khảo Thí Tham Chiếu | Mô Hình / Công Thức Toán Học | Cơ Chế Tính Điểm |
| :--- | :--- | :--- | :--- | :--- |
| `multiple_choice` | Trắc nghiệm khách quan | **Dichotomous Scoring Model** (ETS TOEIC/TOEFL, SAT, Cambridge) | $\text{Score} = \text{round}\left(\frac{\text{Correct}}{\text{Total}} \times 100\right)$ | Đúng = 1 điểm, Sai = 0 điểm. Không trừ điểm câu sai. |
| `listening` | Nghe hiểu âm thanh | **Dichotomous Scoring Model** (ETS TOEIC Listening Section, IELTS Listening) | $\text{Score} = \text{round}\left(\frac{\text{Correct}}{\text{Total}} \times 100\right)$ | Giống hệt `multiple_choice` (Percentage-Correct). Kèm audio từ Cloudflare R2 (`audio_url`). Bản chất trắc nghiệm khách quan, không cần thêm nguồn ngoài mới. |
| `reading` | Đọc hiểu văn bản | **Dichotomous Scoring Model** (ETS TOEIC Reading Section, SAT, IELTS Reading) | $\text{Score} = \text{round}\left(\frac{\text{Correct}}{\text{Total}} \times 100\right)$ | Giống hệt `multiple_choice` (Percentage-Correct). Kèm đoạn văn (`passage_text`) và 4 lựa chọn A/B/C/D. Bản chất trắc nghiệm khách quan, không cần thêm nguồn ngoài mới. |
| `open_cloze` | Điền từ khuyết đoạn văn | **Cambridge English: Use of English** (B2 First / C1 Advanced) | $\text{GapScore} = \frac{\text{CorrectGaps}}{\text{TotalGaps}} \times 100$<br>$\text{CorrectCount} += \frac{\text{GapScore}}{100}$ | Chấm điểm độc lập từng ô trống (gap). Chuẩn hóa Unicode NFKC, so khớp không phân biệt hoa thường, hỗ trợ mảng đáp án tương đương (`acceptedAnswers`). |
| `writing` | Viết tự luận ngắn | **IELTS Writing Band Descriptors** (Task 1 & Task 2) | $\text{Score} = \text{round}\left(\frac{\text{TA} + \text{CC} + \text{LR} + \text{GRA}}{4}\right)$ | 4 tiêu chí cân bằng (25% mỗi tiêu chí): Task Achievement, Coherence & Cohesion, Lexical Resource, Grammatical Range & Accuracy. AI trả về feedback, lỗi sai và câu mẫu cải thiện. |
| `pronunciation` | Phát âm & Nói | **PTE Academic** (Pearson) & **IELTS Speaking** | $\text{Score} = \text{round}\left(\frac{\text{CA} + \text{OF} + \text{PR}}{3}\right)$ | 3 tiêu chí cấu thành (~33.33% mỗi tiêu chí): Content Accuracy (WER/Levenshtein), Oral Fluency, Pronunciation. Kèm hàng rào Relevance Gate chống lạc đề. |

---

## 3. CHI TIẾT CƠ CHẾ CHẤM ĐIỂM DẠNG LISTENING VÀ READING (BỔ SUNG MỚI)

### 3.1. Dạng câu hỏi Listening (Nghe hiểu âm thanh)
- **Bản chất**: Câu hỏi trắc nghiệm âm thanh (Audio-based Multiple Choice Question).
- **Quy trình tương tác**:
  1. Giảng viên tải lên file ghi âm (mp3, wav, m4a, ogg) hoặc nhập URL âm thanh. File được lưu trữ trên hạ tầng Cloudflare R2 (`audio_url`).
  2. Phía học viên: Giao diện phát HTML5 Audio Player cho phép học viên nghe đoạn âm thanh/hội thoại và chọn 1 trong 4 đáp án A/B/C/D.
  3. Phía Backend: Chấm điểm dựa trên mô hình **Dichotomous Scoring Model** (Percentage-Correct):
     - Mỗi câu trả lời đúng được tính 1 điểm.
     - Câu trả lời sai được tính 0 điểm.
     - Tổng điểm bài quiz được tính bằng tỷ lệ số câu đúng trên tổng số câu hỏi quy đổi về thang điểm 100 hoặc thang điểm 10:
       $$\text{ListeningScore} = \text{round}\left(\frac{\text{CorrectCount}}{\text{TotalQuestions}} \times 100\right)$$
- **Nguồn khảo thí tham chiếu**: ETS TOEIC Listening Comprehension (Part 1, 2, 3, 4) & IELTS Listening Section 1-4. Do bản chất thuần túy là trắc nghiệm khách quan chuẩn hóa, hệ thống kế thừa toàn bộ engine chấm trắc nghiệm hiện hữu, không cần bổ sung các nguồn ngoài phức tạp mới.

### 3.2. Dạng câu hỏi Reading (Đọc hiểu văn bản)
- **Bản chất**: Câu hỏi trắc nghiệm đọc hiểu ngữ liệu (Passage-based Multiple Choice Question).
- **Quy trình tương tác**:
  1. Giảng viên nhập đoạn văn bản đọc hiểu (`passage_text`), nội dung câu hỏi (`question_text`) và 4 phương án trả lời kèm đáp án đúng.
  2. Phía học viên: Giao diện hiển thị đoạn văn đọc hiểu trong một khung cuộn độc lập (Scrollable Reading Box) ở phía trên câu hỏi, giúp học viên dễ dàng vừa đọc đoạn văn vừa đối chiếu trả lời 4 lựa chọn A/B/C/D.
  3. Phía Backend: Tái sử dụng 100% logic chấm điểm trắc nghiệm khách quan (**Dichotomous Scoring Model** — Percentage-Correct):
     - Lựa chọn khớp với đáp án đúng: 1 điểm.
     - Lựa chọn khác hoặc bỏ trống: 0 điểm.
     - Công thức:
       $$\text{ReadingScore} = \text{round}\left(\frac{\text{CorrectCount}}{\text{TotalQuestions}} \times 100\right)$$
- **Nguồn khảo thí tham chiếu**: ETS TOEIC Reading Comprehension (Part 7 Reading Passages) & SAT Reading Test. Tương tự Listening, bản chất là trắc nghiệm khách quan nhị phân nên hoàn toàn đồng nhất với `multiple_choice`.

---

## 4. ĐỊNH HƯỚNG TÍCH HỢP RADAR CHART NĂNG LỰC (ANALYTICS SERVICE ROADMAP)

> [!NOTE]
> **Quyết định kỹ thuật có chủ đích**:
> Trong lần cập nhật này, hệ thống **CHƯA** cập nhật `analytic.service.js` (Radar Chart đa giác kỹ năng cho Kỹ năng Nghe / Listening và Đọc / Reading).
> **Lý do**:
> Radar Chart phản ánh năng lực thực tế của người học thông qua trung bình tích lũy dài hạn. Việc vội vàng đưa dữ liệu khi học viên chưa tích lũy đủ số lượt làm bài Listening/Reading thực tế sẽ gây sai lệch phân phối (skewed distribution) và làm biến dạng biểu đồ tổng quát. Mô-đun phân tích kỹ năng nghe/đọc trên Radar Chart sẽ được kích hoạt độc lập khi có đủ cơ sở dữ liệu mẫu thực tế.
