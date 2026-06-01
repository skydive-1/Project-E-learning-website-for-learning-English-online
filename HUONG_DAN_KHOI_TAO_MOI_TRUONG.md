# 📚 HƯỚNG DẪN KHỞI TẠO MÔI TRƯỜNG LÀM VIỆC - DỰ ÁN E-LEARNING (CẬP NHẬT)

---

## 🎯 GIỚI THIỆU DỰ ÁN

**Sản phẩm:** Website E-learning học tiếng Anh tích hợp AI (Chatbot RAG, phân quyền VIP)

**Công nghệ:**
- **Frontend:** ReactJS (JavaScript thuần) + **Train AI RAG**
- **Backend:** Node.js/Express (JavaScript) + MyCliaude AI Assistant
- **Database:** PostgreSQL + pgvector
- **RAG Engine:** LangChain + Google Gemini + Pinecone (Vector Store)

**Cấu trúc nhóm & Trách nhiệm:**
- **Q.Anh:** Frontend + **Train & Deploy RAG Model**
- **Chương:** Database (PostgreSQL)
- **Liêm:** Backend (APIs) + **MyCliaude**

---

---

# 📱 HƯỚNG DẪN CHI TIẾT CHO Q.ANH (FRONTEND + RAG)

## ⚠️ LƯU Ý QUAN TRỌNG

**Q.Anh có 2 vai trò:**

1. **Frontend Developer** - Xây dựng UI/UX website học tiếng Anh
2. **RAG Engineer** - Train AI model để Chatbot trả lời câu hỏi

**Phân công RAG chi tiết:**

| Vai trò | Trách nhiệm |
|---------|------------|
| **Q.Anh (Frontend)** | ✅ Train RAG model, tạo embeddings, upload vectors |
| **Chương (Database)** | ⚙️ Lưu trữ & quản lý dữ liệu (PostgreSQL), vectors ở Pinecone |
| **Liêm (Backend)** | 🔌 Tạo API `/api/chatbot/ask` để frontend gọi |

---

## 1️⃣ CÀI ĐẶT PHẦN MỀM TIÊN QUYẾT (FRONTEND)

### Bước 1: Cài đặt Node.js

**Tại sao cần cài Node.js?**
- Node.js là nền tảng cho phép chạy JavaScript trên máy tính của bạn (ngoài trình duyệt).
- React cần Node.js để cài đặt thư viện, chạy server phát triển, và xây dựng ứng dụng.

**Hướng dẫn:**
1. Truy cập: [https://nodejs.org](https://nodejs.org)
2. Tải phiên bản **LTS** (Long Term Support) - đây là phiên bản ổn định nhất
3. Cài đặt bình thường, chọn "Next" và "Install"
4. Sau khi cài xong, mở **Command Prompt** (hoặc PowerShell) và gõ:
   ```bash
   node --version
   npm --version
   ```
   - Nếu hiện ra version number (ví dụ: v18.15.0) = cài đặt thành công ✅

**npm là gì?**
- npm = Node Package Manager
- npm giúp bạn tải về các thư viện, công cụ JavaScript mà dự án cần
- Nó tự động được cài khi bạn cài Node.js

### Bước 2: Cài đặt VS Code (Trình soạn thảo mã)

**Tại sao cần VS Code?**
- Đây là chương trình để viết code (giống như Notepad nhưng mạnh hơn nhiều)
- VS Code có tính năng hỗ trợ code tự động, tìm lỗi, và đẹp mắt

**Hướng dẫn:**
1. Truy cập: [https://code.visualstudio.com](https://code.visualstudio.com)
2. Tải bản cho Windows
3. Cài đặt bình thường

**Lập tức sau khi cài:**
- Mở VS Code
- Cài extension: "ES7+ React/Redux/React-Native snippets" (của dsznajder)
  - Điều này sẽ giúp bạn viết React code nhanh hơn

---

## 2️⃣ TẠO PROJECT REACTJS TRỐNG

### Bước 3: Mở Command Prompt và tạo project

**Câu lệnh:**
```bash
npx create-react-app frontend
```

**Giải thích từng từ:**
- `npx` = Công cụ để chạy các chương trình từ npm mà không cần cài đặt vĩnh viễn
- `create-react-app` = Công cụ chính thức của Facebook/Meta để tạo project React trống
- `frontend` = Tên thư mục dự án của bạn (bạn có thể đặt tên khác)

**Câu lệnh này sẽ:**
1. Tạo một thư mục tên `frontend`
2. Tạo tất cả file cấu trúc React cần thiết bên trong
3. Tự động cài đặt tất cả thư viện phụ thuộc (dependencies) - điều này mất 3-5 phút

**⏳ Đợi cho đến khi:**
- Dòng chữ "Happy hacking!" xuất hiện
- Terminal trở về trạng thái bình thường

---

## 3️⃣ CHẠY PROJECT LẦN ĐẦU TIÊN

### Bước 4: Vào thư mục project

```bash
cd frontend
```

**Giải thích:**
- `cd` = Change Directory (đi vào thư mục)
- `frontend` = Tên thư mục bạn vừa tạo
- Lệnh này khiến bạn "đi vào" thư mục project

### Bước 5: Chạy server phát triển

```bash
npm start
```

**Câu lệnh này sẽ:**
1. Khởi động một máy chủ phát triển trên máy tính bạn
2. Tự động mở trình duyệt và hiển thị trang web React
3. Theo dõi các thay đổi code của bạn - nếu bạn sửa file, trang web tự động cập nhật (hot reload)

**Kết quả bạn sẽ thấy:**
- Trình duyệt hiện ra trang có logo React quay vòng
- Địa chỉ: `http://localhost:3000`
- `localhost:3000` = "Máy tính của tôi, cổng 3000" - máy chủ chạy trên máy bạn

---

## 📋 TỔNG KẾT LỆNH CHO Q.ANH (PHẦN FRONTEND)

```bash
# 1. Tạo project React trống
npx create-react-app frontend

# 2. Vào thư mục project
cd frontend

# 3. Chạy server phát triển
npm start

# Kết quả: Trình duyệt tự động mở với trang web tại http://localhost:3000
```

---

## 🤖 PHẦN 2: TRAIN RAG MODEL (QUAN TRỌNG!)

**👉 Hãy xem file hướng dẫn riêng:**

- **[HUONG_DAN_RAG_PYTHON.md](./HUONG_DAN_RAG_PYTHON.md)** - Train RAG bằng Python (dễ hơn)
- **[HUONG_DAN_RAG_NODEJS.md](./HUONG_DAN_RAG_NODEJS.md)** - Train RAG bằng Node.js (cùng stack)

**Q.Anh cần chọn 1 trong 2 cách ở trên để train RAG model!**

---

---

# 🗄️ HƯỚNG DẪN CHI TIẾT CHO CHƯƠNG (DATABASE)

## 1️⃣ CÀI ĐẶT POSTGRESQL + PGADMIN

### Tại sao cần PostgreSQL?
- PostgreSQL là **hệ quản trị cơ sở dữ liệu** (DBMS)
- Nó lưu trữ tất cả dữ liệu của ứng dụng (tài khoản người dùng, bài học, tiến độ học, v.v.)
- PostgreSQL rất phổ biến, mạnh mẽ, và miễn phí

### Tại sao cần pgAdmin?
- pgAdmin là ứng dụng giao diện giúp bạn **quản lý dữ liệu một cách dễ dàng**
- Thay vì gõ lệnh phức tạp, bạn có thể nhấn chuột để tạo bảng, thêm dữ liệu, v.v.

### ⚠️ QUAN TRỌNG: Về pgvector

**pgvector là gì?**
- pgvector là **extension PostgreSQL** để lưu trữ vectors (dạng dữ liệu đặc biệt)

**Liệu Chương có cần pgvector không?**
- ❌ **KHÔNG** - Vectors được lưu ở **Pinecone** (vector database chuyên dụng)
- ✅ Chương chỉ cần biết pgvector tồn tại, nhưng không cần cài nó

**Chương cần làm gì?**
1. Cài PostgreSQL + pgAdmin
2. Tạo database cho ứng dụng (tên: `elearning_db`)
3. Tạo các bảng cần thiết (users, courses, lessons, progress)

---

### Bước 1: Tải PostgreSQL cho Windows

1. Truy cập: [https://www.postgresql.org/download/windows](https://www.postgresql.org/download/windows)
2. Nhấn vào liên kết "Download the installer"
3. Chọn **"Windows x86-64"** (nếu máy bạn là 64-bit, thường là vậy)
4. Tải file `.exe` về

---

### Bước 2: Cài đặt PostgreSQL

1. **Chạy file cài đặt vừa tải**
2. Khi hỏi **"Setup Language"** → Chọn "English" → Click "OK"
3. Khi hỏi **"Installation Directory"** → Giữ mặc định → Click "Next"
4. Khi hỏi **"Select Components to install"**:
   - ✅ PostgreSQL Server (cần)
   - ✅ pgAdmin 4 (cần - để quản lý database)
   - ⚠️ Stack Builder (không cần cài nữa, vì không dùng pgvector)
   - Click "Next"

5. **Nhập mật khẩu cho user "postgres"**:
   - Đây là tài khoản quản trị cơ sở dữ liệu
   - ⚠️ **GHI NHỚ MẬT KHẨU NÀY** - bạn sẽ cần nó sau
   - Ví dụ: `postgres123`
   - Click "Next"

6. Chọn **Port = 5432** (cổng mặc định) → Click "Next"
7. Chọn **Locale = English** → Click "Next"
8. Click "Next" cho các bước tiếp theo cho đến khi hoàn thành

---

### Bước 3: Mở pgAdmin

**Sau khi cài xong:**
1. Tìm **pgAdmin 4** trong Start Menu (Windows)
2. Nhấp đôi để mở
3. Trình duyệt sẽ mở trang giao diện pgAdmin
4. Nhập email và mật khẩu để đăng nhập (tạo tài khoản ngay lần đầu)

**Giao diện pgAdmin:**
- Bên trái: Cây thư mục hiển thị **Servers** → **PostgreSQL** → **Databases**
- Bên phải: Chi tiết thông tin

---

### Bước 4: Tạo Database mới

1. Mở **pgAdmin 4**
2. Chuột phải vào **Databases** → **Create** → **Database**
3. Tên: `elearning_db`
4. Owner: `postgres` (mặc định)
5. Click "Save"

---

## 📋 TỔNG KẾT CÀI ĐẶT CHO CHƯƠNG

| Bước | Hành động | Lý do |
|------|-----------|-------|
| 1 | Tải PostgreSQL từ `postgresql.org` | Cơ sở dữ liệu chính của dự án |
| 2 | Cài PostgreSQL + pgAdmin | pgAdmin để quản lý database dễ dàng |
| 3 | Ghi nhớ mật khẩu `postgres` | Cần để kết nối từ Backend |
| 4 | Tạo database `elearning_db` | Nơi lưu data ứng dụng |

---

---

# 🔧 HƯỚNG DẪN CHI TIẾT CHO LIÊM (BACKEND)

## PHẦN A: SETUP CƠ BẢN (LẦN ĐẦU)

## 1️⃣ TẠO PROJECT NODE.JS

### Bước 1: Tạo thư mục dự án Backend

Mở **Command Prompt** và gõ:

```bash
mkdir backend
cd backend
```

**Giải thích:**
- `mkdir` = Make Directory (tạo thư mục)
- `backend` = Tên thư mục dự án
- `cd backend` = Đi vào thư mục vừa tạo

---

### Bước 2: Khởi tạo project Node.js

```bash
npm init -y
```

**Giải thích:**
- `npm init` = Khởi tạo project Node.js mới
- `-y` = "Yes" tự động chấp nhận tất cả cài đặt mặc định
- Lệnh này sẽ tạo file **`package.json`** - file này chứa danh sách tất cả thư viện mà dự án cần

**File `package.json` trông như nào:**
```json
{
  "name": "backend",
  "version": "1.0.0",
  "description": "",
  "main": "index.js",
  "scripts": {
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "keywords": [],
  "author": "",
  "license": "ISC"
}
```

---

### Bước 3: Cài đặt Express (Framework Backend)

```bash
npm install express
```

**Giải thích:**
- `npm install` = Cài đặt package
- `express` = Tên package (framework để tạo server web)

**Lệnh này sẽ:**
1. Tải file Express từ npm repository (kho lưu trữ online)
2. Lưu vào thư mục **`node_modules`** trên máy bạn
3. Cập nhật file **`package.json`** để ghi nhớ rằng dự án cần Express

**Sau khi cài xong, `package.json` sẽ có thêm:**
```json
"dependencies": {
  "express": "^4.18.2"
}
```

---

## 2️⃣ TẠO FILE SERVER.JS ĐƠN GIẢN

### Bước 4: Tạo file `server.js`

**Tại sao tên là `server.js`?**
- `server.js` là tên quy ước cho file chính của backend
- Nó chứa code để khởi động máy chủ

**Cách tạo:**
1. Mở **VS Code**
2. Mở thư mục **`backend`** vào VS Code (File → Open Folder)
3. Tạo file mới: **Ctrl+N** hoặc Right-click → New File
4. Đặt tên: `server.js`

---

### Bước 5: Viết code "Hello World" đầu tiên

**Sao chép đoạn code này vào `server.js`:**

```javascript
// 1. Import thư viện Express
// - Lệnh này tải module Express vừa cài đặt
const express = require('express');

// 2. Tạo ứng dụng Express
// - app là đối tượng chứa tất cả cài đặt server
const app = express();

// 3. Định nghĩa cổng (port) mà server sẽ chạy
// - Port 5000 = "cửa" của máy chủ
// - Những request từ client sẽ gọi vào cổng này
const PORT = 5000;

// 4. Tạo route GET cho đường dẫn "/"
// - app.get(đường dẫn, hàm xử lý)
// - Khi người dùng truy cập http://localhost:5000, code này chạy
app.get('/', (req, res) => {
  // req = request (yêu cầu từ client)
  // res = response (trả lời từ server)
  
  // 5. Gửi lại dòng chữ "Hello World" cho client
  res.send('Hello World! Đây là Backend của dự án E-learning');
});

// 6. Khởi động server
// - Lệnh này để server lắng nghe các yêu cầu từ client
// - app.listen(port, hàm callback chạy khi server khởi động)
app.listen(PORT, () => {
  // 7. In ra console để biết server đã khởi động thành công
  console.log(`Server đang chạy tại http://localhost:${PORT}`);
});
```

---

### Bước 6: Chạy server

Gõ lệnh trong **Command Prompt** (ở thư mục `backend`):

```bash
node server.js
```

**Giải thích:**
- `node` = Chương trình để chạy file JavaScript
- `server.js` = File cần chạy

**Kết quả:**
- Console sẽ in: `Server đang chạy tại http://localhost:5000`
- Server đang hoạt động! ✅

---

### Bước 7: Kiểm tra trong trình duyệt

1. Mở **trình duyệt** (Chrome, Firefox, Edge)
2. Gõ vào thanh địa chỉ: `http://localhost:5000`
3. Bạn sẽ thấy: **"Hello World! Đây là Backend của dự án E-learning"**

🎉 **Chúc mừng! Bạn vừa tạo xong server backend đầu tiên!**

---

### Bước 8: Dừng server

Khi muốn dừng server, nhấn **Ctrl+C** trong Command Prompt.

---

## 📋 TỔNG KẾT LỆNH CHO LIÊM (PHẦN A - CƠ BẢN)

```bash
# 1. Tạo thư mục backend
mkdir backend
cd backend

# 2. Khởi tạo project Node.js
npm init -y

# 3. Cài đặt Express
npm install express

# 4. Tạo file server.js (xem ở trên để copy code)

# 5. Chạy server
node server.js

# Kết quả: Server chạy tại http://localhost:5000
```

---

## 🚀 PHẦN B: SỬ DỤNG MYCLAUDE ĐỂ TỚI ĨU HÓA BACKEND

**👉 Hãy xem file hướng dẫn riêng:** [HUONG_DAN_KHOI_TAO_MOI_TRUONG.md](./HUONG_DAN_KHOI_TAO_MOI_TRUONG_BACKEND.md) (phần MyCliaude - tương tự như phiên bản trước)

---

## 🔌 PHẦN C: API CHATBOT ENDPOINT

**Liêm cần tạo 1 API endpoint quan trọng:**

```javascript
// POST /api/chatbot/ask
// - Nhận câu hỏi từ frontend
// - Gọi Pinecone tìm documents liên quan
// - Gọi Gemini tạo trả lời
// - Trả lời cho frontend
```

**Hướng dẫn chi tiết sẽ được cập nhật sau khi Q.Anh setup Pinecone xong!**

---

---

# 🎓 GHI CHÚ CHUNG CHO CẢ NHÓ

## Cấu trúc dự án sau khi khởi tạo

```
Project-E-learning-website-for-learning-English-online/
├── frontend/                 (ReactJS - Q.Anh)
│   ├── node_modules/
│   ├── public/
│   ├── src/
│   ├── package.json
│   └── ...
│
├── backend/                  (Node.js/Express - Liêm)
│   ├── node_modules/
│   ├── server.js
│   ├── package.json
│   ├── routes/
│   ├── middlewares/
│   └── ...
│
├── rag-training/             (RAG Training - Q.Anh)
│   ├── train-rag.py          (hoặc train-rag.js)
│   ├── requirements.txt      (hoặc package.json)
│   ├── .env
│   └── ...
│
├── .env.example              (Template biến môi trường)
├── HUONG_DAN_KHOI_TAO_MOI_TRUONG.md (File này)
├── HUONG_DAN_RAG_PYTHON.md   (Option A - Python)
├── HUONG_DAN_RAG_NODEJS.md   (Option B - Node.js)
└── ...
```

---

## 📞 Q&A thường gặp

**Q: Q.Anh nên chọn Python hay Node.js để train RAG?**
A: 
- **Python** = Dễ hơn, nhiều tutorial, nhưng cần cài Python riêng
- **Node.js** = Cùng stack với frontend/backend, nhưng phức tạp hơn
- **Khuyến nghị:** Chọn Python (dễ hơn cho newbie)

**Q: Pinecone là gì? Có miễn phí không?**
A: Pinecone là vector database (lưu trữ vectors). Có free tier với:
- 100,000 vectors miễn phí
- 900 bài × 2000 embeddings/bài = ~1.8M embeddings (cần upgrade)

**Q: Tại sao không dùng pgvector?**
A: pgvector chậm hơn Pinecone cho 900+ documents. Pinecone được tối ưu hóa cho RAG.

**Q: API key Google Gemini có bao nhiêu free quota?**
A: 60 requests/phút miễn phí. Đủ cho dự án nhỏ.

---

## Tiếp theo (Bước 2)

Sau khi setup xong bước 1:

1. **Q.Anh:** Train RAG model (xem HUONG_DAN_RAG_*.md)
2. **Chương:** Thiết kế Schema Database (tạo bảng)
3. **Liêm:** Tạo API Chatbot + kết nối Pinecone

---

**Chúc team may mắn! 🚀**

*Generated by: Tech Lead*
*Date: 2026-06-01*
*Updated: 2026-06-01 - Full RAG Integration Guide*
