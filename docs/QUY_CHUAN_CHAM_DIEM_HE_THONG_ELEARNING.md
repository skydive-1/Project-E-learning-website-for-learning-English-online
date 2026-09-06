# BÁO CÁO KỸ THUẬT: QUY CHUẨN VÀ THUẬT TOÁN CHẤM ĐIỂM HỆ THỐNG E-LEARNING
## (RAG AI Speaking Assessment, Quizzes Engine & Performance Measurement)

---

### THÔNG TIN DỰ ÁN & THÀNH VIÊN NHÓM THỰC HIỆN
- **Đồ án**: Website Học Tiếng Anh Trực Tuyến Tích Hợp AI & RAG Engine (E-Learning English Platform)
- **Thành viên nhóm thực hiện**:
  1. **NGUYỄN DŨNG QUỐC ANH** — Vai trò: Frontend & AI UI Integration Developer
  2. **NGUYỄN THANH LIÊM** — Vai trò: Backend & Security Developer
  3. **LÊ ĐÌNH CHƯƠNG** — Vai trò: Database Administrator & Infrastructure Specialist
- **Tệp tài liệu Word chính thức (.docx)**: `docs/QUY_CHUAN_CHAM_DIEM_HE_THONG_ELEARNING.docx`

---

## 1. NGUYÊN TẮC THIẾT KẾ VÀ KIẾN TRÚC ĐÁNH GIÁ (ASSESSMENT FRAMEWORK)

Hệ thống loại bỏ hoàn toàn các công thức tự chế (ad-hoc weights) hoặc việc để AI tự sinh điểm tổng kết (non-deterministic hallucination). Toàn bộ hệ thống được xây dựng trên 3 nguyên tắc nền tảng:

1. **Deterministic Backend Ownership (Backend làm chủ 100% công thức)**:
   - Mô hình AI (Gemini Multimodal / Gemini Flash) chỉ đóng vai trò **Feature Extractor** phân tích tín hiệu âm học (acoustic analysis) và trích xuất điểm thành phần (sub-scores).
   - Backend Node.js sở hữu hoàn toàn công thức toán học tính điểm tổng quát (`overallScore`), làm tròn số nguyên chuẩn, kiểm tra điều kiện rẽ nhánh và cơ chế phạt.

2. **100% Grounded in International Standards (Tuân thủ chuẩn quốc tế được công nhận)**:
   - Toàn bộ trọng số và tiêu chí đánh giá được kế thừa trực tiếp từ các tổ chức khảo thí ngôn ngữ hàng đầu thế giới: **Pearson Education** (chuẩn PTE Academic), **Cambridge / British Council / IDP** (chuẩn IELTS), **ETS** (chuẩn TOEFL iBT), và **NIST** (chuẩn Word Error Rate - WER).

3. **Defensive Anti-Cheat & Strict Validation Guardrails (Hàng rào bảo vệ chống gian lận)**:
   - Bộ lọc phát hiện im lặng (`buffer < 1500 bytes` tự động gán điểm 0, chống AI hallucination).
   - Bộ xác thực điểm nghiêm ngặt (`speakingValidator.js` cấm tự động ép clamp nếu dữ liệu trả về sai cấu trúc).
   - Bộ kiểm soát lạc đề **Relevance Gate** (theo chuẩn TOEFL iBT của ETS).

---

## 2. CƠ CHẾ RAG AI CHẤM ĐIỂM SPEAKING (SPEAKING ASSESSMENT ENGINE)

### 2.1. Dạng bài Read Aloud (Luyện đọc đoạn văn) — Chuẩn PTE Academic (Pearson)
- **Nguồn tham chiếu**: *PTE Academic Score Guide — Pearson Education (`pearsonpte.com`)*.
- **3 Tiêu chí cấu thành cân bằng tuyệt đối (~1/3 mỗi tiêu chí)**:
  1. **Content Accuracy (~33.33%)**: Đo lường mức độ người học đọc chính xác các từ mục tiêu trong văn bản. Điểm số giảm dần tương ứng với số từ bị bỏ sót (Deletions), đọc sai/thay thế (Substitutions), hoặc chèn từ lạ (Insertions).
  2. **Oral Fluency (~33.33%)**: Đánh giá nhịp điệu nói đều đặn, ngữ điệu tự nhiên, tốc độ nói phù hợp và không xuất hiện các khoảng ngắt nghỉ ngập ngừng bất thường, vấp từ hoặc tự sửa từ quá mức.
  3. **Pronunciation (~33.33%)**: Đánh giá độ rõ ràng và chuẩn xác của các âm vị (vowels & consonants), vị trí đặt trọng âm từ (word stress) và ngữ điệu toàn câu để người bản xứ có thể hiểu được trọn vẹn (intelligibility).

- **Công thức tính điểm**:
  $$\text{OverallScore} = \text{round}\left(\frac{\text{ContentAccuracy} + \text{OralFluency} + \text{Pronunciation}}{3}\right)$$

- **Thuật toán Căn chỉnh Từ vựng (Token Alignment) & Đo lường WER**:
  - **Xử lý Contractions 2 chiều**: Chuẩn hóa các từ viết tắt tiếng Anh thông dụng (`don't` $\leftrightarrow$ `do not`, `can't` $\leftrightarrow$ `cannot`, `i'm` $\leftrightarrow$ `i am`), tránh phạt oan người học khi đọc tách hoặc đọc tắt.
  - **Khoảng cách Levenshtein & Quy hoạch động**: So khớp chuỗi từ mục tiêu và chuỗi nhận dạng giọng nói, gắn nhãn từng từ: `correct`, `mispronounced`, `missing`, `substituted`, hoặc `uncertain`.
  - **Đo lường WER (NIST Standard)**:
    $$\text{WER} = \frac{S + D + I}{N}$$
  - **Công thức tính Content Accuracy**:
    $$\text{ContentAccuracy} = \max(0, \min(100, \text{round}((1 - \min(\text{WER}, 1.0)) \times 100)))$$

---

### 2.2. Dạng bài Conversational Q&A Speaking — Chuẩn IELTS Speaking Band Descriptors
- **Nguồn tham chiếu**: *IELTS Official Public Band Descriptors — British Council, IDP, Cambridge (`ielts.org`)*.
- **4 Tiêu chí IELTS chính thức (25% mỗi tiêu chí)**:
  1. **Fluency & Coherence (FC — 25%)**: Khả năng nói liên tục với tốc độ tự nhiên, không ngập ngừng kéo dài; khả năng liên kết ý tưởng bằng từ nối (cohesive devices).
  2. **Lexical Resource (LR — 25%)**: Vốn từ vựng phong phú, sử dụng chính xác các kết hợp từ (collocations), cụm từ học thuật và khả năng diễn đạt lại (paraphrase).
  3. **Grammatical Range & Accuracy (GRA — 25%)**: Sự đa dạng của cấu trúc câu (câu phức, câu ghép, câu điều kiện, câu bị động) và mức độ chuẩn xác ngữ pháp.
  4. **Pronunciation (PR — 25%)**: Phát âm chuẩn âm vị, nhấn đúng trọng âm từ và ngữ điệu câu (intonation), nhịp điệu dễ hiểu.

- **Công thức tính điểm**:
  $$\text{OverallScore} = \text{round}(0.25 \times \text{FC} + 0.25 \times \text{LR} + 0.25 \times \text{GRA} + 0.25 \times \text{PR})$$

---

### 2.3. Cơ chế Phân tầng Relevance Gate (Chống lạc đề) — Chuẩn TOEFL iBT Speaking (ETS)
- **Nguồn tham chiếu**: *TOEFL iBT Speaking Scoring Rubrics — Educational Testing Service ETS (`ets.org`)*: *"An off-topic response receives a score of 0"*.
- **Cơ chế phân tầng**:
  - **$\text{relevanceGate} < 30$ (Lạc đề hoàn toàn)**: $\text{OverallScore} = 0$, bật cờ `offTopic = true`. Hiển thị cảnh báo trả lời không liên quan tới câu hỏi theo chuẩn ETS TOEFL iBT.
  - **$30 \le \text{relevanceGate} < 60$ (Chưa sát trọng tâm)**: Giữ nguyên điểm tổng quát theo công thức IELTS, hiển thị cảnh báo hướng dẫn người học bám sát luận điểm hơn (không trừ điểm phát âm/ngữ pháp).
  - **$\text{relevanceGate} \ge 60$ (Đạt yêu cầu)**: Chấm điểm bình thường.

---

## 3. CƠ CHẾ CHẤM ĐIỂM QUIZZES VÀ CÁC DẠNG BÀI TẬP (EXERCISE ENGINE)

| Dạng bài tập | Chuẩn Quốc tế Áp dụng | Công thức Toán học Tất định | Cơ chế & Đặc điểm Kỹ thuật |
| :--- | :--- | :--- | :--- |
| **Multiple Choice** (Trắc nghiệm khách quan) | **Dichotomous Scoring Model** (SAT, TOEFL, TOEIC, Kahoot, Wayground) | $\text{Score} = \text{round}\left(\frac{\text{CorrectCount}}{\text{TotalQuestions}} \times 100\right)$ | Đúng = 1, Sai = 0. Không trừ điểm khi trả lời sai (No Negative Marking). |
| **Listening Quiz** (Nghe hiểu trắc nghiệm) | **Dichotomous Scoring Model** (ETS TOEIC / IELTS Listening) | $\text{Score} = \text{round}\left(\frac{\text{CorrectCount}}{\text{TotalQuestions}} \times 100\right)$ | Tái sử dụng 100% logic chấm trắc nghiệm khách quan (percentage-correct). Kèm tệp âm thanh Cloudflare R2 (`audio_url`). Đúng = 1, Sai = 0. Bản chất trắc nghiệm khách quan nên không cần thêm nguồn ngoài mới. |
| **Reading Quiz** (Đọc hiểu trắc nghiệm) | **Dichotomous Scoring Model** (ETS TOEIC / SAT / IELTS Reading) | $\text{Score} = \text{round}\left(\frac{\text{CorrectCount}}{\text{TotalQuestions}} \times 100\right)$ | Tái sử dụng 100% logic chấm trắc nghiệm khách quan (percentage-correct). Kèm đoạn văn đọc hiểu (`passage_text`). Đúng = 1, Sai = 0. Bản chất trắc nghiệm khách quan nên không cần thêm nguồn ngoài mới. |
| **Open Cloze** (Điền từ khuyết) | **Cambridge English: Use of English** (B2 First / C1 Advanced) | $\text{GapScore} = \frac{\text{CorrectGaps}}{\text{TotalGaps}} \times 100$<br>$\text{CorrectCount} += \frac{\text{GapScore}}{100}$ | Chấm độc lập từng chỗ trống (gap). Chuẩn hóa Unicode NFKC, Case-insensitive. Hỗ trợ tập đáp án tương đương hợp lệ (`acceptedAnswers`). |
| **Writing Evaluation** (Viết tự luận ngắn) | **IELTS Writing Public Band Descriptors** (ielts.org) | $\text{Score} = \text{round}\left(\frac{\text{TA} + \text{CC} + \text{LR} + \text{GRA}}{4}\right)$ | 4 Tiêu chí (25% mỗi cái): Task Achievement, Coherence & Cohesion, Lexical Resource, Grammatical Range & Accuracy. AI trả về phản hồi chi tiết, câu mẫu bản ngữ (`improved_sentence`) và danh sách lỗi. |
| **Audio Quiz** (Kiểm tra phát âm trong đề) | **PTE Academic** (Pearson) | $\text{Score} = \text{round}\left(\frac{\text{CA} + \text{OF} + \text{PR}}{3}\right)$ | 3 Tiêu chí cân bằng (~1/3 mỗi cái): Content Accuracy, Oral Fluency, Pronunciation. Kiểm tra buffer âm thanh < 1500 bytes chống gian lận. |

---

## 4. CÁC CƠ CHẾ ĐÁNH GIÁ VÀ HỆ THỐNG BỔ TRỢ KHÁC

### 4.1. Điều kiện Hoàn thành Bài học (Lesson Completion Gate)
- **Chuẩn tham chiếu**: **Mastery Learning Model (Benjamin Bloom, 1968)** và tiêu chuẩn kiểm soát đào tạo LMS (SCORM/xAPI Pass Criteria).
- **Quy tắc**:
  - $\text{LESSON\_COMPLETION\_SCORE\_THRESHOLD} = 50\%$.
  - Nếu bài học có bài kiểm tra (Quiz), học viên bắt buộc phải thi đạt điểm số cao nhất ($\text{best\_score}$) tối thiểu 50% thì hệ thống mới cho phép ghi nhận hoàn thành bài học (`user_progress.is_completed = true`).
  - Nếu chưa đạt 50%, hệ thống từ chối cập nhật trạng thái hoàn thành kèm thông báo lỗi mã `LESSON_COMPLETION_SCORE_TOO_LOW`.

### 4.2. Chuỗi học tập (Daily Streak) & Ma trận Huy hiệu (Badges)
- **Chuẩn thiết kế**: **Octalysis Gamification Framework (Yu-kai Chou)** & Chu trình thói quen Duolingo.
- **Thuật toán Rolling Monday Window**: Điểm chuỗi trong tuần được tính toán theo tuần hiện tại (Thứ Hai đến Chủ Nhật, tối đa 7 ngày/tuần).
- **Cơ chế Ân hạn 24 Giờ (Grace Period)**: Kiểm tra phiên học ngày hôm qua nếu hôm nay chưa học, bảo lưu chuỗi không làm gián đoạn nỗ lực của học viên.
- **Kỷ lục Chuỗi (Longest Streak)**: Lưu trữ vĩnh viễn $\max(\text{savedLongestStreak}, \text{currentStreak})$ trong CSDL.
- **Ma trận 8 Huy hiệu**:
  1. `first_lesson`: Hoàn thành bài học đầu tiên.
  2. `streak_3`: Duy trì chuỗi học 3 ngày liên tục.
  3. `streak_7`: Duy trì chuỗi học 7 ngày liên tục.
  4. `streak_30`: Bậc thầy kỷ luật, học 30 ngày liên tục.
  5. `quiz_master`: Đạt điểm tuyệt đối (100%) trong 5 bài Quiz.
  6. `ai_interactive`: Tương tác hỏi đáp với AI Chatbot trên 10 lần.
  7. `grammar_guru`: Hoàn thành toàn bộ bài tập ngữ pháp của khóa học.
  8. `speed_learner`: Hoàn thành xuất sắc 3 bài học trong cùng 1 ngày.

### 4.3. Bảng xếp hạng đề thi (Quiz Leaderboard)
- Mô hình sắp xếp đa tiêu chí: Ưu tiên 1: Điểm cao nhất (`score DESC`), Ưu tiên 2: Thời gian nộp bài sớm nhất (`completed_at ASC`).

### 4.4. Hệ thống RAG AI Context Retrieval & Semantic Scoring
- **Kiến trúc Hybrid RAG V2**:
  - **Dense Semantic Vector Search**: Google `text-embedding-004` (768 chiều), Pinecone Vector DB với Cosine Similarity.
  - **Sparse Lexical Search**: PostgreSQL Full-Text Search (`tsvector`, `tsquery`).
  - **Reciprocal Rank Fusion & Confidence Gate**: Hợp nhất và lọc bỏ ngữ cảnh dưới ngưỡng `CONFIDENCE_THRESHOLD`, chống tuyệt đối việc AI bịa đặt câu trả lời.

---

## 5. DANH MỤC TÀI LIỆU THAM CHIẾU QUỐC TẾ (OFFICIAL REFERENCES)

1. **Pearson Education**. (2023). *PTE Academic Score Guide: Scoring Criteria and Concordance Tables*. Pearson Language Tests. URL: [https://www.pearsonpte.com](https://www.pearsonpte.com)
2. **IELTS Partners** (British Council, IDP: IELTS Australia, Cambridge University Press & Assessment). (2023). *IELTS Speaking Band Descriptors (Public Version)*. URL: [https://www.ielts.org](https://www.ielts.org)
3. **IELTS Partners** (British Council, IDP: IELTS Australia, Cambridge University Press & Assessment). (2023). *IELTS Writing Band Descriptors (Task 1 & Task 2 Public Version)*. URL: [https://www.ielts.org](https://www.ielts.org)
4. **Educational Testing Service (ETS)**. (2022). *TOEFL iBT Speaking Scoring Rubrics: Independent and Integrated Tasks*. ETS Research Reports. URL: [https://www.ets.org](https://www.ets.org)
5. **Cambridge Assessment English**. (2021). *B2 First and C1 Advanced Handbook for Teachers: Reading and Use of English Marking Criteria*. University of Cambridge. URL: [https://www.cambridgeenglish.org](https://www.cambridgeenglish.org)
6. **National Institute of Standards and Technology (NIST)**. (1993). *Speech Recognition Benchmark Test Guidelines: Word Error Rate (WER) Measurement Specifications*. U.S. Department of Commerce.
7. **Levenshtein, V. I.** (1966). *Binary codes capable of correcting deletions, insertions, and reversals*. Soviet Physics Doklady, 10(8), 707-710.
8. **Bloom, B. S.** (1968). *Learning for mastery*. Instruction and Curriculum. Regional Education Laboratory for the Carolinas and Virginia.
9. **Chou, Y. K.** (2015). *Actionable Gamification: Beyond Points, Badges, and Leaderboards*. Octalysis Media.
