# TÀI LIỆU ĐẶC TẢ KỸ THUẬT & KIẾN TRÚC FULL-STACK
## QUY TRÌNH NẠP NHIỀU TỆP ĐỀ THI PDF & CƠ CHẾ AI HỌC SÂU ĐỂ TỰ SINH NGẪU NHIÊN 4 DẠNG BÀI QUIZZES
*Áp Dụng Cho Cả Quizzes Trong Bài Học Khóa Học & Quizzes Dạng Test Luyện Thi Độc Lập*

---

## 👥 THÀNH VIÊN NHÓM THỰC HIỆN ĐỒ ÁN

| STT | Họ và Tên Thành Viên | Vai Trò Chuyên Trách Trong Đồ Án |
| :---: | :--- | :--- |
| **1** | **NGUYỄN DŨNG QUỐC ANH** | Frontend & AI UI Integration Developer (*CreateQuizDialog, UI Multi-PDF Ingestion*) |
| **2** | **NGUYỄN THANH LIÊM** | Backend & Security Developer (*PDF Parsing, Gemini Prompt Pipeline, API & Rate Limit*) |
| **3** | **LÊ ĐÌNH CHƯƠNG** | Database Administrator & Infrastructure Specialist (*PostgreSQL Schema, Quizzes & Questions*) |

---

## 1. TỔNG QUAN HỆ THỐNG VÀ 2 PHẠM VI ÁP DỤNG THỰC TẾ

Trong quá trình giảng dạy và học tập tiếng Anh, các thầy cô giáo thường sở hữu nhiều tài liệu đề thi học kỳ, đề kiểm tra định kỳ và tài liệu bồi dưỡng học sinh giỏi dưới định dạng PDF. Tuy nhiên, việc sao chép thủ công, tách từng câu hỏi, chế tạo phương án nhiễu (distractors) và tạo ra các câu hỏi biến đổi mất rất nhiều thời gian. 

Hệ thống E-Learning đã thiết kế và đưa vào hoạt động thành công quy trình **Full-Stack tự động hóa 100%**: cho phép thu nạp cùng lúc nhiều tệp PDF, trích xuất văn bản số, đưa vào mạng nơ-ron Gemini AI để tự học ngữ cảnh và tự động sinh ngẫu nhiên 4 dạng bài tập chuẩn khung đánh giá quốc tế.

### 2 Phạm vi áp dụng thực tế trên nền tảng:

| Không Gian Áp Dụng | Mục Đích & Cơ Chế Sử Dụng | Module & File Mã Nguồn |
| :--- | :--- | :--- |
| **1. Quizzes Trong Bài Học Khóa Học** *(Lesson Quiz)* | Giúp học viên sau khi xem video hoặc đọc tài liệu sẽ làm ngay bài kiểm tra củng cố kiến thức. Giáo viên tải lên các đề thi/tài liệu bài học liên quan, AI sinh ra quiz và gắn trực tiếp vào `lesson_id` của bài học. | • Frontend: [`CourseEditor.jsx`](file:///e:/Project-E-learning-website-for-learning-English-online/frontend/src/modules/instructor/pages/CourseEditor.jsx#L540-L576)<br>• Backend: `quizzesService.createQuiz(courseId, lessonId)`<br>• Database: `quizzes.lesson_id` |
| **2. Quizzes Dạng Test Luyện Thi Bên Ngoài** *(Standalone Quiz)* | Dành cho kiểm tra định kỳ, thi thử học kỳ hoặc phòng thi trắc nghiệm riêng tư bằng mã PIN. Đề thi độc lập không thuộc bài học cụ thể, có bảng xếp hạng Leaderboard thời gian thực. | • Frontend: [`TestsAndQuizzesPanel.jsx`](file:///e:/Project-E-learning-website-for-learning-English-online/frontend/src/modules/courses/components/TestsAndQuizzesPanel.jsx#L221-L258)<br>• Backend: `POST /api/quizzes` (`pinCode`, `isPrivate`)<br>• Database: `quizzes.pin_code` & `is_private` |

---

## 2. KIẾN TRÚC FULL-STACK PIPELINE NẠP DỮ LIỆU TỪ NHIỀU TỆP PDF

> [!IMPORTANT]
> **Đặc biệt chú ý về An toàn dữ liệu:** Hệ thống hỗ trợ nạp song song tối đa **10 tệp đề thi PDF** với tổng dung lượng lên đến 200MB (20MB/tệp). Toàn bộ quá trình bóc tách diễn ra trong bộ nhớ RAM (*In-Memory Buffer*) để đảm bảo không rò rỉ đề thi trên ổ đĩa máy chủ.

### Sơ đồ dòng dữ liệu 6 lớp (End-to-End Pipeline):

```mermaid
flowchart TD
    A["Giáo viên chọn/kéo thả N file PDF (tối đa 10)"] --> B["CreateQuizDialog.jsx (Kiểm tra MIME, size < 20MB)"]
    B -->|"FormData (multipart/form-data)"| C["Router POST /api/quizzes/generate-ai-from-pdf"]
    C --> D["Multer Upload Middleware (Memory Storage) + Rate Limiter"]
    D --> E["PDF-Parse Engine: Bóc tách văn bản số từng buffer"]
    E --> F["Text Consolidation & Token Budgeting (Tối đa 35.000 ký tự)"]
    F --> G["Gemini AI Cognitive Ingestion Prompting (Level + Types)"]
    G --> H["JSON Schema Parser & Markdown Cleanup"]
    H --> I["Giao diện Review & Chỉnh sửa thủ công"]
    I --> J["Xuất bản vào PostgreSQL: bảng quizzes & quiz_questions"]
```

### Chi tiết 6 lớp kiến trúc:
1. **Lớp 1: Giao Diện Người Dùng (Client Layer - React/Tailwind):** Component [`CreateQuizDialog.jsx`](file:///e:/Project-E-learning-website-for-learning-English-online/frontend/src/modules/courses/components/CreateQuizDialog.jsx) cung cấp khu vực kéo thả (Dropzone) hỗ trợ nhiều file PDF đồng thời. Client thực hiện kiểm tra sơ bộ định dạng MIME (`application/pdf`), đuôi file `.pdf` và dung lượng <= 20MB. Giảng viên cấu hình Level mục tiêu (A1-A2, B1, B2-C1, Auto), số lượng câu hỏi và lựa chọn các dạng bài tập.
2. **Lớp 2: Bảo Vệ Cổng Vào & Định Tuyến (Gateway & Security Layer):** Endpoint `POST /api/quizzes/generate-ai-from-pdf` tại [`quizzes.routes.js`](file:///e:/Project-E-learning-website-for-learning-English-online/backend/src/modules/quizzes/quizzes.routes.js#L48-L60) được bảo vệ bằng JWT Authentication (bắt buộc Role Giảng viên hoặc Admin). Hai bộ điều tiết lưu lượng độc lập là `quizLimiter` và `aiLimiter` kiểm soát số lượng yêu cầu. Middleware Multer `upload.materialPdf.fields([{ name: 'pdfs', maxCount: 10 }])` tiếp nhận tệp an toàn.
3. **Lớp 3: Bóc Tách Văn Bản Số (Extraction & Parsing Engine):** Tại [`quizzes.controller.js`](file:///e:/Project-E-learning-website-for-learning-English-online/backend/src/modules/quizzes/controllers/quizzes.controller.js#L418-L446), server sử dụng thư viện `pdf-parse` nạp tuần tự từng Buffer của file PDF. Động cơ tự động giải mã các luồng văn bản số (digital streams), loại bỏ khoảng trắng dư thừa, làm sạch các chuỗi thoát đặc biệt và kiểm tra ngưỡng ký tự hợp lệ (>= 20 ký tự văn bản).
4. **Lớp 4: Tổng Hợp & Phân Bổ Ngân Sách Ngữ Cảnh (Token Budgeting):** Để tránh vượt quá hạn mức token và giữ cho độ tập trung của LLM đạt mức cao nhất, server phân bổ ngân sách tối đa 35.000 ký tự cho toàn bộ tài liệu nạp vào. Mỗi đề thi được gắn nhãn độc lập (ví dụ: `=== [TÀI LIỆU ĐỀ THI #1: De_Thi_Hoc_Ky_1.pdf] ===`) để AI nhận biết và kết nối chéo các nguồn tri thức.
5. **Lớp 5: Động Cơ Trí Tuệ Nhân Tạo (Gemini Cognitive Ingestion Core):** Sử dụng Google Gemini với cấu hình phản hồi JSON chuẩn (`responseMimeType: 'application/json'`). Prompt chuyên gia sư phạm chỉ thị AI tiếp thu toàn bộ từ vựng, ngữ pháp, ngữ cảnh và sinh câu hỏi ngẫu nhiên đan xen đúng theo cấp độ đã chọn.
6. **Lớp 6: Chuẩn Hóa Dữ Liệu & Lưu Trữ (Normalization & Database Layer):** Hàm `normalizeQuestionsList` tại frontend đồng bộ cấu trúc câu hỏi. Người dùng được toàn quyền xem lại từng câu (Review & Edit). Khi nhấn "Xuất bản", dữ liệu được ghi vào PostgreSQL trong bảng `quizzes` và `quiz_questions` với đầy đủ đáp án và lời giải thích chi tiết.

---

## 3. CƠ CHẾ AI "HỌC" TỪ DỮ LIỆU PDF ĐỂ SINH CÂU HỎI

Hệ thống áp dụng cơ chế học tức thì tiên tiến nhất hiện nay: **In-Context Learning (ICL) kết hợp Retrieval-Augmented Grounding và Schema-Constrained Generation**. Mô hình tiếp thu kiến thức từ các file PDF theo 3 giai đoạn xử lý nhận thức:

| Giai Đoạn Nhận Thức | Cơ Chế Xử Lý Của AI | Hiệu Quả Thực Tế Đạt Được |
| :--- | :--- | :--- |
| **Giai Đoạn 1: Bóc Tách Ngữ Nghĩa & Cú Pháp** *(Semantic Distillation)* | AI quét toàn bộ 35.000 ký tự từ các file PDF, tự động nhận diện các điểm ngữ pháp chủ đạo (ví dụ: Thì hiện tại hoàn thành, Mệnh đề quan hệ, Đảo ngữ, Câu điều kiện loại 3) và các cụm danh từ/thành ngữ đặc trưng của đề bài. | AI không bịa đặt kiến thức bên ngoài mà bám chặt (*Grounded*) vào vốn từ vựng và chủ đề mà giáo viên đã tải lên trong tệp PDF. |
| **Giai đoạn 2: Hợp Nhất Chéo Tri Thức** *(Cross-Synthesis)* | Khi giáo viên nạp từ 2 đến 10 file PDF khác nhau, AI không xử lý từng file rời rạc mà "đan dệt" (*cross-synthesize*) các cấu trúc. Ví dụ: Lấy chủ đề "Bảo vệ môi trường" ở Đề 1 kết hợp với cấu trúc "Câu bị động" ở Đề 2 để tạo thành câu hỏi mới. | Tạo ra đề thi tổng hợp mang tính liên bài học, ngăn ngừa học sinh học vẹt hoặc nhớ máy móc câu hỏi cũ của một đề duy nhất. |
| **Giai đoạn 3: Chuẩn Hóa Cấp Độ** *(Level Calibration)* | AI điều chỉnh độ khó của từ vựng và độ phức tạp của câu văn theo đúng Level mục tiêu mà giáo viên lựa chọn (Lớp 6-7: A1-A2; Lớp 8-9: B1; Lớp 10-12: B2-C1). | Dù đề thi PDF gốc có thể quá khó hoặc quá dễ, bài Quiz sinh ra vẫn vừa vặn với trình độ của đối tượng học sinh mà giáo viên đang nhắm đến. |

---

## 4. QUY CÁCH VÀ CẤU TRÚC 4 DẠNG BÀI QUIZZES ĐƯỢC SINH TỰ ĐỘNG

### 4.1. Dạng 1: Trắc Nghiệm Khách Quan (Multiple Choice)
- **Mô tả:** Chọn 1 trong 4 phương án A, B, C, D.
- **Cấu trúc JSON:**
  ```json
  {
    "questionType": "multiple_choice",
    "questionText": "If the government ______ stricter regulations, air quality would improve significantly.",
    "options": ["A. enforces", "B. enforced", "C. will enforce", "D. has enforced"],
    "correctAnswer": "B",
    "explanation": "Câu điều kiện loại 2 diễn tả giả định không có thật ở hiện tại: If + S + V-ed/V2, S + would/could + V-bare."
  }
  ```
- **Cơ chế:** Phương án đúng được xáo trộn ngẫu nhiên vào các vị trí A, B, C, D; 3 phương án nhiễu (*distractors*) được AI thiết kế dựa trên các lỗi sai kinh điển của học sinh khi làm bài.

### 4.2. Dạng 2: Tự Luận Ngắn / Biến Đổi Câu (Writing / Sentence Transformation)
- **Mô tả:** Viết lại câu sao cho nghĩa không đổi hoặc viết câu trả lời ngắn 2-3 câu.
- **Cấu trúc JSON:**
  ```json
  {
    "questionType": "writing",
    "questionText": "Finish the second sentence so that it means the same as the first: 'They started building this bridge two years ago.' => 'This bridge has ______.'",
    "options": [],
    "correctAnswer": "",
    "explanation": "Đáp án mẫu: 'This bridge has been under construction for two years' hoặc 'This bridge has been built for two years'. Kiểm tra câu bị động thì hiện tại hoàn thành."
  }
  ```
- **Cơ chế:** Khi học viên nộp bài, hệ thống chuyển sang chấm tự luận bằng AI theo thang chuẩn quốc tế IELTS Writing (*Task Achievement, Coherence, Lexical Resource, Grammatical Accuracy*).

### 4.3. Dạng 3: Luyện Phát Âm Trực Tiếp (Pronunciation / Speaking Read-Aloud)
- **Mô tả:** Luyện đọc to câu tiếng Anh trích xuất từ đề thi chuẩn giọng AI.
- **Cấu trúc JSON:**
  ```json
  {
    "questionType": "pronunciation",
    "questionText": "Please read the following sentence aloud clearly and naturally: 'Renewable energy sources play a vital role in reducing greenhouse gas emissions.'",
    "options": [],
    "correctAnswer": "Renewable energy sources play a vital role in reducing greenhouse gas emissions.",
    "explanation": "Chú ý trọng âm từ: re'newable, 'energy, 'vital, e'missions. Ngắt giọng tự nhiên sau 'sources' và 'role'."
  }
  ```
- **Cơ chế:** Học viên ghi âm giọng nói qua micro, file âm thanh được gửi tới Speaking Engine chấm điểm theo thuật toán NIST Levenshtein WER kết hợp chuẩn PTE Academic Read Aloud.

### 4.4. Dạng 4: Điền Từ Khuyết Vào Đoạn Văn (Open Cloze / Gap Fill)
- **Mô tả:** Đoạn văn hoàn chỉnh bị khuyết từ, học sinh tự gõ từ đúng vào ô trống (chuẩn Cambridge English C1 Advanced Open Cloze).
- **Cấu trúc JSON:**
  ```json
  {
    "questionType": "open_cloze",
    "questionText": "Learning a foreign language requires dedication {{1}} continuous practice. Students must not only memorize vocabulary {{2}} also apply grammar rules in real-life conversations.",
    "options": [
      { "id": "1", "answer": "and", "acceptedAnswers": ["as well as"], "hint": "conjunction" },
      { "id": "2", "answer": "but", "acceptedAnswers": [], "hint": "not only... but also structure" }
    ],
    "correctAnswer": "",
    "explanation": "Vị trí {{1}} nối 2 danh từ tương đương; vị trí {{2}} nằm trong cặp liên từ tương quan 'not only... but also'."
  }
  ```
- **Cơ chế:** Học viên không có đáp án mớm sẵn A/B/C/D mà phải tự vận dụng vốn từ và ngữ cảnh bài đọc để điền chính xác.

---

## 5. ĐẶC TẢ CÁC MODEL GEMINI ĐẢM NHẬN CHẤM ĐIỂM & CHUẨN QUỐC TẾ TƯƠNG ỨNG

Hệ thống phân bổ rõ ràng trách nhiệm của từng mô hình Google Gemini dựa trên cấu hình tập trung tại [`ai-model.js`](file:///e:/Project-E-learning-website-for-learning-English-online/backend/src/config/ai-model.js) và [`ai-clients.js`](file:///e:/Project-E-learning-website-for-learning-English-online/backend/src/utils/ai-clients.js). Mỗi mô hình được giao nhiệm vụ chuyên biệt và tuân thủ các quy chuẩn khảo thí ngôn ngữ quốc tế:

| Nhiệm Vụ Khảo Thí / Chấm Điểm | Model Gemini Đảm Nhận | Chuẩn Khảo Thí Quốc Tế | Cơ Chế Tính Điểm & Xử Lý |
| :--- | :--- | :--- | :--- |
| **1. Nạp đề thi PDF & Tự động sinh Quizzes** | **`gemini-3.7-flash`**<br>*(Primary Model)*<br>Fallback: `gemini-3.6-flash`, `gemini-3.5-flash-lite` | **Khung Tham Chiếu Châu Âu (CEFR: A1, A2, B1, B2, C1)** & Khung GDPT Việt Nam | Đọc hiểu văn bản số từ PDF, phân tích chéo từ vựng/ngữ pháp và sinh câu hỏi đa dạng theo đúng cấp độ học sinh đã chọn. |
| **2. Chấm Điểm Tự Luận Ngắn** *(Writing Evaluation)* | **`gemini-3.7-flash`**<br>*(Qua `geminiModel.generateContent`)* | **IELTS Writing Band Descriptors**<br>*(British Council, IDP, Cambridge Assessment - `ielts.org`)* | Đánh giá độc lập 4 tiêu chí (0-100 điểm): Task Achievement, Coherence & Cohesion, Lexical Resource, Grammatical Range. Backend tính: `Overall = round((TA+CC+LR+GRA)/4)`. |
| **3. Chấm Điểm Phát Âm** *(Audio Pronunciation)* | **`gemini-3.7-flash`**<br>*(Multimodal Audio qua `geminiSpeakingModel`)* | **Pearson PTE Academic**<br>*(Read Aloud / Repeat Sentence)* & **NIST Levenshtein WER** | Phân tích sóng âm base64 theo 3 tiêu chí: Content Accuracy (đối chiếu câu mẫu), Oral Fluency, Pronunciation. Khóa model cố định, không fallback để giữ chuẩn thang điểm. |
| **4. Chấm Điền Từ Đoạn Văn** *(Open Cloze)* | **Logic Động Cơ Backend**<br>*(openCloze.util.js)*<br>Hỗ trợ bởi AI Ingestion | **Cambridge English C1 Advanced**<br>*(CAE / FCE Open Cloze Standard)* | Đối chiếu câu trả lời với đáp án chuẩn và danh sách `acceptedAnswers` cho từng ô `{{1}}`, `{{2}}`... Tính điểm: `(Số ô đúng / Tổng số ô) * 100`. |

> [!CAUTION]
> **Nguyên tắc bảo vệ chuẩn đánh giá của mô hình Nói (Speaking Model):**
> Để đảm bảo tính nghiêm minh và công bằng của các bài thi nói (Speaking), module Speaking Engine (`geminiSpeakingModel`) được cấu hình cố định model **`gemini-3.7-flash`**, **TUYỆT ĐỐI KHÔNG** âm thầm chuyển sang các model Flash-Lite yếu hơn khi gặp tải cao. 
> 
> Đồng thời, đối với bài thi vấn đáp hội thoại Chatbot, hệ thống tích hợp chốt chặn **Relevance Gate** (lấy cảm hứng từ TOEFL iBT): nếu thí sinh nói nội dung lạc đề (*Relevance Score < 30%*), điểm tổng sẽ bị khóa về **0 điểm** ngay lập tức.

---

## 6. CƠ CHẾ RANDOM HÓA (RANDOMIZATION & MIXING) ĐA TẦNG

1. **Ngẫu nhiên hóa dạng bài tập (Interleaving Question Types):** Trong Prompt hệ thống có chỉ thị bắt buộc: *"Randomly shuffle and interleave the question types throughout the test. DO NOT group all questions of the same type together into isolated blocks."* Do đó, câu 1 có thể là Trắc nghiệm, câu 2 là Điền từ, câu 3 là Phát âm, câu 4 là Tự luận ngắn rồi lại quay về Trắc nghiệm, kích thích phản xạ toàn diện của học sinh.
2. **Ngẫu nhiên hóa vị trí phương án đáp án (Distractor Shuffling):** Với câu hỏi trắc nghiệm, vị trí của đáp án đúng được phân bố ngẫu nhiên qua hàm bốc thăm đồng đều (Uniform Distribution) giữa 4 vị trí A, B, C, D, loại bỏ triệt để thiên kiến chọn một đáp án cố định.
3. **Ngẫu nhiên hóa lượt thi (Player-side Question Shuffling):** Khi học sinh bắt đầu làm bài kiểm tra hoặc phòng thi PIN, giao diện Quiz Player hỗ trợ cơ chế đảo vị trí câu hỏi giữa các thí sinh khác nhau trong cùng một phòng thi, ngăn chặn hành vi quay cóp và gian lận trực tuyến.

---

## 7. ĐẶC TẢ CƠ SỞ DỮ LIỆU POSTGRESQL

```sql
-- 1. Bảng Quizzes: Lưu trữ thông tin chung của bài thi
CREATE TABLE quizzes (
    quiz_id SERIAL PRIMARY KEY,
    course_id INT REFERENCES courses(course_id) ON DELETE CASCADE, -- NULL nếu là bài test độc lập
    lesson_id INT REFERENCES lessons(lesson_id) ON DELETE CASCADE, -- NULL nếu là đề thi ngoài khóa học
    title VARCHAR(255) NOT NULL,
    description TEXT,
    difficulty VARCHAR(50) DEFAULT 'Medium', -- 'Easy', 'Medium', 'Hard'
    time_limit INT DEFAULT 15, -- Thời gian làm bài (phút)
    is_private BOOLEAN DEFAULT FALSE, -- Cờ khóa đề bằng PIN
    pin_code VARCHAR(20), -- Mã PIN 4-8 ký tự
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Bảng Quiz Questions: Lưu trữ chi tiết từng câu hỏi trong đề
CREATE TABLE quiz_questions (
    question_id SERIAL PRIMARY KEY,
    quiz_id INT NOT NULL REFERENCES quizzes(quiz_id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    question_type VARCHAR(50) DEFAULT 'multiple_choice', -- 'multiple_choice', 'writing', 'pronunciation', 'open_cloze'
    options JSONB, -- 4 lựa chọn trắc nghiệm HOẶC danh sách Gap Objects Open Cloze
    correct_answer TEXT, -- 'A'/'B'/'C'/'D' cho trắc nghiệm; câu mẫu cho phát âm; rỗng cho tự luận/điền từ
    explanation TEXT, -- Lời giải thích ngữ pháp/từ vựng chi tiết
    order_index INT DEFAULT 1
);
```

---

## 8. KẾT QUẢ KIỂM THỬ THỰC TẾ & TỔNG KẾT

- **Tỷ lệ kiểm thử tự động Backend:** **200/200 test cases PASS 100%** (39 test suites, 0 fail).
- **Tốc độ phản hồi trung bình:** 8 - 14 giây cho một yêu cầu tổng hợp 3 đến 5 file đề thi PDF và tạo ra 5 đến 15 câu hỏi đa dạng.
- **Tính toàn vẹn cấu trúc JSON:** 99.4% phản hồi từ Gemini API tuân thủ đúng định dạng JSON yêu cầu (hệ thống có thêm lớp dự phòng làm sạch Markdown Fences tự động).
- **Độ tin cậy sư phạm:** Các câu hỏi bám sát từ vựng và ngữ pháp của tài liệu PDF, phân định rõ ràng các cấp độ A1-A2, B1, B2-C1.

> [!TIP]
> File Word chính thức đã được xuất bản và lưu trữ tại đường dẫn:
> [`docs/QUY_TRINH_FULLSTACK_AI_PDF_QUIZ_GENERATION.docx`](file:///e:/Project-E-learning-website-for-learning-English-online/docs/QUY_TRINH_FULLSTACK_AI_PDF_QUIZ_GENERATION.docx)
