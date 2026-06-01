# 📚 HƯỚNG DẪN KHỞI TẠO MÔI TRƯỜNG LÀM VIỆC - DỰ ÁN E-LEARNING

---

## 🎯 GIỚI THIỆU DỰ ÁN

**Sản phẩm:** Website E-learning học tiếng Anh tích hợp AI (Chatbot RAG, phân quyền VIP)

**Công nghệ:**
- **Frontend:** ReactJS (JavaScript thuần)
- **Backend:** Node.js/Express (JavaScript) + MyCliaude AI Assistant
- **Database:** PostgreSQL + pgvector

**Cấu trúc nhóm:**
- **Q.Anh:** Frontend
- **Chương:** Database
- **Liêm:** Backend

---

---

# 📱 HƯỚNG DẪN CHI TIẾT CHO Q.ANH (FRONTEND)

## 1️⃣ CÀI ĐẶT PHẦN MỀM TIÊN QUYẾT

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

## 3️⃣ CHẠY PROJECT LẦN ĐẦUTIÊN

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

## 📋 TỔNG KẾT LệNH CHO Q.ANH

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
   - ✅ Stack Builder (tuỳ chọn, có thể bỏ)
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

---

## 2️⃣ HIỂU KHÁI NIỆM PGVECTOR

### Vector là gì? (Giải thích cấp 3)

**Hình dung nôm na:**
- Một **vector** là một **danh sách các con số**
- Ví dụ: `[0.5, 0.2, 0.8, 0.1]` là một vector 4 chiều
- Những con số này **đại diện cho ý nghĩa** của một từ hoặc câu

**Ví dụ thực tế:**
```
Từ "good" (tốt)    → [0.5, 0.8, 0.9, 0.2]
Từ "bad" (xấu)     → [0.2, 0.1, 0.1, 0.9]
Từ "excellent"     → [0.6, 0.9, 0.95, 0.1]
```

**Tại sao điều này hữu ích?**
- Máy tính có thể **so sánh** các vector này
- Nếu "good" và "excellent" có vector giống nhau → chúng có ý nghĩa gần giống nhau
- Điều này là nền tảng của **AI hiểu ngôn ngữ tự nhiên**

---

### Chatbot RAG cần pgvector vì sao?

**RAG = Retrieval Augmented Generation**

**Quy trình hoạt động:**

```
1. Người dùng hỏi: "Làm thế nào để học tiếng Anh hiệu quả?"
   ↓
2. Hệ thống chuyển câu hỏi thành vector (số hóa ý nghĩa)
   ↓
3. Tìm kiếm trong database: "Trong pgvector, tìm các bài viết có vector giống nhất"
   ↓
4. Lấy các bài viết liên quan nhất ra
   ↓
5. Đưa những bài viết này cho ChatGPT/Claude
   ↓
6. ChatGPT trả lời dựa vào thông tin từ database
   ↓
7. Trả lời: "Bạn nên luyện nghe đều đặn, học từ vựng theo chủ đề..."
```

**Tóm lại:** pgvector cho phép database **hiểu và so sánh ý nghĩa** → Chatbot của bạn sẽ thông minh hơn! 🧠

---

## 3️⃣ CÀI ĐẶT VÀ BẬT EXTENSION PGVECTOR

### Bước 4: Kiểm tra phiên bản PostgreSQL

1. Mở **Command Prompt** và gõ:
   ```bash
   psql --version
   ```
   - Nếu hiện ra version (ví dụ: psql 15.2) = OK ✅

2. Kết nối vào PostgreSQL:
   ```bash
   psql -U postgres
   ```
   - Nhập mật khẩu bạn đã tạo lúc cài đặt (ví dụ: `postgres123`)
   - Bạn sẽ thấy: `postgres=#` → Bạn đã kết nối thành công!

---

### Bước 5: Cài đặt pgvector từ Terminal

**Cách 1: Dễ nhất (Khuyến nghị)**

Thoát khỏi psql bằng cách gõ:
```sql
\q
```

Rồi tìm Stack Builder (được cài lúc nước nước):
1. Mở **pgAdmin 4**
2. Tools menu → **Stack Builder**
3. Chọn **PostgreSQL 15 (hoặc version của bạn)**
4. Category: Chọn **"Spatial Extensions"**
5. Tìm **pgvector** → Nhấn chọn
6. Cài đặt theo hướng dẫn

---

### Bước 6: Bật pgvector trong Database

1. Mở **pgAdmin 4**
2. Trái cây: **Servers** → **PostgreSQL 15** → **Databases** → **postgres**
3. Khi click vào **postgres**, bên phải sẽ hiện "Dashboard"

4. Tìm **SQL Editor** (hay gõ tổ hợp phím hỏi để tìm)
5. Gõ lệnh này:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```
6. Nhấn nút **"Execute"** (hoặc F5)
7. Nếu thấy thông báo "Query returned successfully" → Thành công! ✅

---

## 📋 TỔNG KẾT CÀI ĐẶT CHO CHƯƠNG

| Bước | Hành động | Lý do |
|------|-----------|-------|
| 1 | Tải PostgreSQL từ `postgresql.org` | Cơ sở dữ liệu chính của dự án |
| 2 | Cài PostgreSQL + pgAdmin | pgAdmin để quản lý database dễ dàng |
| 3 | Ghi nhớ mật khẩu `postgres` | Cần để kết nối từ Backend |
| 4 | Mở pgAdmin → Tạo database mới | Nơi lưu data ứng dụng |
| 5 | Cài extension pgvector | Cần cho AI tìm hiểu câu hỏi của user |
| 6 | Bật pgvector: `CREATE EXTENSION vector;` | Kích hoạt tính năng tìm kiếm giống nhân |

---

---

# 🔧 HƯỚNG DẪN CHI TIẾT CHO LIÊM (BACKEND)

## 🎓 PHẦN A: SETUP CƠ BẢN (LẦN ĐẦU)

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

---

## 🚀 PHẦN B: SỬ DỤNG MYCLAUDE ĐỂ TỚI ĨU HÓA BACKEND (NÂNG CAO)

### MyCliaude là gì?

**MyCliaude** (stellarlinkco/myclaude) là một công cụ **AI-powered development automation** giúp bạn:
- ✅ Viết code nhanh hơn bằng cách sử dụng AI (Claude, GPT-4, Gemini, v.v.)
- ✅ Tự động refactor, optimize, debug code
- ✅ Tạo test cases, documentation tự động
- ✅ Giải pháp phức tạp mà bạn có thể không biết cách làm

**Tại sao Liêm cần MyCliaude?**
- Backend cần nhiều APIs phức tạp: xác thực người dùng, kết nối database, xử lý dữ liệu, v.v.
- Thay vì Google từng lỗi, Liêm có thể hỏi AI để tạo code sẵn sàng
- MyCliaude sẽ giúp code của bạn tuân theo **best practices** (cách làm tốt nhất)

---

### Bước 1: Cài đặt MyCliaude

```bash
# Cài đặt (chọn codeagent-wrapper và do module)
npx github:stellarlinkco/myclaude
```

**Giải thích:**
- Lệnh này sẽ tải công cụ MyCliaude về máy
- Chọn các module theo hướng dẫn (recommend: `codeagent-wrapper` + `do` module)
- Sau khi cài xong, bạn có thể dùng lệnh `codeagent-wrapper`

---

### Bước 2: Kiểm tra cài đặt thành công

```bash
codeagent-wrapper --version
```

**Kết quả:**
- Nếu hiện ra version (ví dụ: `1.0.0`) = cài đặt thành công ✅
- Nếu lỗi "command not found" = chưa cài đúng, cài lại từ bước 1

---

### Bước 3: Sử dụng MyCliaude để tạo APIs

**Ví dụ 1: Tạo API xác thực người dùng (User Authentication)**

Trong thư mục `backend`, gõ:

```bash
codeagent-wrapper --backend claude "Tạo API xác thực người dùng cho dự án E-learning:
- Endpoint POST /auth/register: Đăng ký tài khoản mới
- Endpoint POST /auth/login: Đăng nhập bằng email + password
- Sử dụng JWT token để xác thực
- Hash password bằng bcrypt
- Database sử dụng PostgreSQL
- Trả về JSON responses (success/error)"
```

**MyCliaude sẽ:**
1. ✅ Phân tích yêu cầu của bạn
2. ✅ Viết code xác thực hoàn chỉnh
3. ✅ Tạo middleware JWT
4. ✅ Thêm error handling
5. ✅ Tạo comments giải thích code

---

**Ví dụ 2: Kết nối PostgreSQL vào Backend**

```bash
codeagent-wrapper --backend claude "Tạo module kết nối PostgreSQL cho Node.js Express:
- Sử dụng pg package (npm install pg)
- Cấu hình connection pool
- Tạo hàm execute queries an toàn
- Có error handling và logging
- File: src/db/connection.js"
```

---

**Ví dụ 3: Tạo API Chatbot (RAG)**

```bash
codeagent-wrapper --backend claude "Tạo API Chatbot RAG cho dự án E-learning:
- Endpoint POST /api/chatbot/ask
- Input: câu hỏi tiếng Anh từ user
- Output: trả lời từ LLM (Claude/GPT-4)
- Kết nối với pgvector để tìm kiếm context từ database
- Có rate limiting (giới hạn số lần hỏi)
- Trả về JSON response"
```

---

### Bước 4: Sử dụng MyCliaude để Debug/Fix Lỗi

**Nếu Liêm gặp lỗi:**

```bash
codeagent-wrapper --backend claude - <<'EOF'
Lỗi trong code Express của em:
Error: Cannot read property 'email' of undefined
Ở file routes/auth.js, dòng 15

Code hiện tại:
```javascript
app.post('/auth/register', (req, res) => {
  const email = req.body.email;
  // ...
});
```

Hãy giúp em fix lỗi này và giải thích tại sao?
EOF
```

**MyCliaude sẽ:**
- ✅ Phân tích lỗi
- ✅ Gợi ý fix
- ✅ Giải thích nguyên nhân
- ✅ Cung cấp code cải tiến

---

### Bước 5: Chạy code được tạo bởi MyCliaude

**Sau khi MyCliaude tạo code xong:**

1. Copy code được tạo vào file `server.js` hoặc tạo file mới (ví dụ: `auth.js`)
2. Cài đặt dependencies cần thiết:
   ```bash
   npm install pg bcryptjs jsonwebtoken
   ```
3. Chạy server:
   ```bash
   node server.js
   ```
4. Test APIs bằng Postman hoặc cURL:
   ```bash
   curl -X POST http://localhost:5000/auth/register \
     -H "Content-Type: application/json" \
     -d '{"email":"user@example.com","password":"123456"}'
   ```

---

## 💡 PROMPT MẪU CHO LIÊM SỬ DỤNG MYCLAUDE

### Prompt mẫu 1: Tạo feature hoàn chỉnh

```
"Tạo feature hoàn chỉnh cho dự án E-learning:
- Tên: Quản lý khóa học (Course Management)
- Endpoints cần có:
  * GET /api/courses - Lấy danh sách khóa học
  * POST /api/courses - Tạo khóa học mới (chỉ admin)
  * GET /api/courses/:id - Lấy chi tiết khóa học
  * PUT /api/courses/:id - Cập nhật khóa học
  * DELETE /api/courses/:id - Xóa khóa học
- Database: PostgreSQL, bảng 'courses'
- Authentication: Sử dụng JWT token
- Validation: Kiểm tra input trước khi save
- Error handling: Trả về HTTP status code đúng
- Comments: Giải thích tiếng Việt từng phần"
```

---

### Prompt mẫu 2: Fix lỗi + explain

```
"Lỗi trong code backend của em:
[PASTE LỖI VÀ CODE]

Hỏi:
1. Tại sao bị lỗi?
2. Cách fix?
3. Cách phòng tránh lần sau?"
```

---

### Prompt mẫu 3: Tối ưu hóa (Optimize)

```
"Tối ưu hóa code này để performance tốt hơn:
[PASTE CODE]

Yêu cầu:
- Thêm caching (Redis tuỳ chọn)
- Giảm số lần query database
- Thêm pagination nếu query nhiều records
- Có comments giải thích"
```

---

### Prompt mẫu 4: Test cases

```
"Viết test cases cho API này:
- Endpoint: POST /api/auth/login
- Input: email + password
- Expected: Trả về JWT token nếu đúng
- Use Jest + Supertest
- Test cases: valid credentials, invalid email, wrong password, user not found"
```

---

## 📋 TỔNG KẾT LỆNH CHO LIÊM (PHẦN B - MYCLAUDE)

```bash
# 1. Cài đặt MyCliaude
npx github:stellarlinkco/myclaude

# 2. Kiểm tra cài đặt
codeagent-wrapper --version

# 3. Tạo feature (ví dụ: authentication)
codeagent-wrapper --backend claude "Tạo API xác thực người dùng..."

# 4. Tạo API (ví dụ: chatbot)
codeagent-wrapper --backend claude "Tạo API Chatbot RAG..."

# 5. Debug lỗi (dùng HEREDOC)
codeagent-wrapper --backend claude - <<'EOF'
[PASTE LỖI VÀ CODE]
EOF

# 6. Cài dependencies
npm install pg bcryptjs jsonwebtoken

# 7. Chạy server
node server.js
```

---

---

# 🎓 GHI CHÚ CHUNG CHO CẢ NHÓ

## Các lệnh hữu ích để nhớ

```bash
# Quay lại thư mục cha (lên một cấp)
cd ..

# Liệt kê các file/thư mục trong thư mục hiện tại
ls                  # trên Mac/Linux
dir                 # trên Windows

# Xóa thư mục
rmdir tên_thư_mục

# Xóa file
del tên_file

# Kiểm tra port đang được sử dụng (Windows)
netstat -ano | findstr :5000

# Kill process đang chạy trên port
taskkill /PID <PID> /F
```

---

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
│   ├── routes/              (Tạo sau khi dùng MyCliaude)
│   │   ├── auth.js
│   │   ├── courses.js
│   │   └── chatbot.js
│   ├── middlewares/         (JWT, validation, v.v.)
│   ├── db/                  (PostgreSQL connection)
│   └── ...
│
├── database/                 (PostgreSQL - Chương)
│   └── [Chương quản lý từ pgAdmin]
│
└── HUONG_DAN_KHOI_TAO_MOI_TRUONG.md (File này)
```

---

## Các câu hỏi thường gặp

**Q: Lệnh `npm` không được tìm thấy?**
A: Bạn chưa cài Node.js. Cài lại theo bước 1 của Q.Anh.

**Q: Port 5000/3000 đã được sử dụng?**
A: Thay đổi số port trong code. Ví dụ: `const PORT = 8000;`

**Q: Quên mật khẩu PostgreSQL?**
A: Phải cài lại PostgreSQL. Cài đặt sẽ hỏi lại mật khẩu.

**Q: MyCliaude command không hoạt động?**
A: 
1. Kiểm tra lại cài đặt: `codeagent-wrapper --version`
2. Nếu lỗi, cài lại: `npx github:stellarlinkco/myclaude --force`
3. Đảm bảo máy có kết nối internet

**Q: MyCliaude tạo code nhưng chạy có lỗi?**
A: 
1. Kiểm tra có cài đủ dependencies: `npm install`
2. Xem lỗi cụ thể: `node server.js`
3. Hỏi MyCliaude để debug: `codeagent-wrapper --backend claude - <<'EOF' [PASTE LỖI] EOF`

---

## Tiếp theo (Bước 2)

Sau khi tất cả thành viên khởi tạo xong, Tech Lead sẽ hướng dẫn:

1. **Q.Anh:** Học React cơ bản (Component, State, Props) + kết nối Frontend với Backend
2. **Chương:** Thiết kế Schema Database (tạo các bảng cho courses, users, vectors, v.v.)
3. **Liêm:** Tạo thêm APIs (Courses, Lessons, User Progress) + kết nối pgvector cho Chatbot

---

## Mẹo nhỏ cho Liêm: Dùng MyCliaude hiệu quả

✅ **Nên làm:**
- Hỏi MyCliaude các task cụ thể (tạo API, debug lỗi, refactor)
- Giải thích rõ ràng yêu cầu (input, output, database schema)
- Để MyCliaude tạo code, rồi bạn review và adjust nhỏ
- Hỏi lại nếu không hiểu code được tạo

❌ **Không nên:**
- Hỏi quá chung chung ("Làm backend")
- Copy-paste code mà không hiểu
- Dùng MyCliaude thay vì tự học (balance learning + productivity)

---

**Chúc team may mắn! 🚀**

*Generated by: Tech Lead*
*Date: 2026-06-01*
*Updated: 2026-06-01 - Added MyCliaude Integration Guide*
