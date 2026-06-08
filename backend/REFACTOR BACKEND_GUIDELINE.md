# HƯỚNG DẪN CẤU TRÚC BACKEND & QUY CHUẨN PHÁT TRIỂN (BACKEND REFACTORING GUIDELINE)

Tài liệu này dành cho lập trình viên Backend tiếp nhận dự án để hiểu rõ cấu trúc thư mục mới, công nghệ sử dụng, lý do đằng sau các thay đổi và quy trình chuẩn để phát triển các tính năng tiếp theo.

---

## 1. Công nghệ & Ngôn ngữ sử dụng (Tech Stack)

*   **Ngôn ngữ lập trình:** JavaScript (ES6+, Node.js runtime).
*   **Framework chính:** Express.js (Phiên bản 5.x.x mới nhất).
*   **Module System:** CommonJS (`require` / `module.exports`).
*   **Database Client:** `pg` (PostgreSQL client).
*   **Cơ sở dữ liệu Vector:** Pinecone.
*   **AI Model SDK:** Google Gemini API.
*   **Các thư viện bổ trợ khác:** `bcryptjs` (mã hóa mật khẩu), `jsonwebtoken` (tạo và kiểm thực mã định danh JWT), `cors` (cho phép chia sẻ tài nguyên giữa các nguồn khác nhau - đặc biệt là cổng frontend `3000`), `dotenv` (quản lý biến môi trường).

---

## 2. Các phần việc đã hoàn thành (What Was Refactored)

*   **Tái cấu trúc Modular Monolith:** Chuẩn hóa toàn bộ các module (`auth`, `chatbot`, `courses`, `progress`) về mô hình phân lớp rõ ràng: **Routes $\rightarrow$ Controllers $\rightarrow$ Services**. Xóa hoàn toàn các file entry point cũ dạng `*.module.js` gây nhầm lẫn.
*   **Bảo mật hóa JWT_SECRET:** Loại bỏ chuỗi fallback bảo mật mặc định `your-super-secret-key-change-this`. Server sẽ báo lỗi fatal và tự dừng hoạt động ngay lập tức nếu khởi chạy thiếu cấu hình biến môi trường `JWT_SECRET`.
*   **Ngăn chặn tấn công DoS OOM:** Hạ giới hạn JSON và urlencoded request body xuống mức `1mb` (trước đó cấu hình mặc định là `50mb`), đảm bảo server không bị cạn kiệt tài nguyên Event Loop khi bị spam các payload cực lớn.
*   **Chuẩn hóa phản hồi lỗi RESTful:** Khắc phục lỗi "nuốt lỗi" ở chatbot. Tầng Service của chatbot hiện tại đã `throw ChatbotError` với Status Code `503` thay vì nuốt lỗi trả về payload chứa cờ error với Status Code `200`.
*   **Xây dựng bộ Validation tập trung:** Tạo middleware [validation.middleware.js](file:///d:/DO%20AN%20TOT%20NGHIEP%28MAIN%29/Project-E-learning-website-for-learning-English-online/backend/src/middleware/validation.middleware.js) hỗ trợ kiểm tra tính bắt buộc (`required`), định dạng (`isEmail`) và độ dài tối thiểu (`minLength`) cho dữ liệu đầu vào.
*   **Tách biệt AI Clients:** Khởi tạo [ai-clients.js](file:///d:/DO%20AN%20TOT%20NGHIEP%28MAIN%29/Project-E-learning-website-for-learning-English-online/backend/src/utils/ai-clients.js) làm lớp Infrastructure độc lập kết nối dịch vụ Gemini và Pinecone, tách biệt hoàn toàn khỏi tầng Business Logic.

---

## 3. Kiến trúc thư mục Backend

Thư mục `backend/src` được tổ chức như sau:

```text
backend/
├── src/
│   ├── middleware/
│   │   ├── auth.middleware.js       # Xác thực JWT Token gửi lên từ Client
│   │   ├── error.middleware.js      # Global Error Handler tập trung
│   │   ├── logger.middleware.js     # Ghi nhận log request của Server
│   │   └── validation.middleware.js  # Middleware Validate Schema đầu vào
│   │
│   ├── modules/                     # Các module chức năng độc lập
│   │   ├── auth/
│   │   │   ├── controllers/
│   │   │   │   └── auth.controller.js # Tiếp nhận request, gọi service, phản hồi
│   │   │   ├── services/
│   │   │   │   └── auth.service.js   # Xử lý logic đăng ký, đăng nhập
│   │   │   └── auth.routes.js        # Khai báo endpoint & schema validation
│   │   │
│   │   ├── chatbot/
│   │   │   ├── controllers/
│   │   │   │   └── chatbot.controller.js
│   │   │   ├── services/
│   │   │   │   └── chatbot.service.js
│   │   │   └── chatbot.routes.js
│   │   │
│   │   ├── courses/
│   │   │   ├── controllers/
│   │   │   │   └── courses.controller.js
│   │   │   ├── services/
│   │   │   │   └── courses.service.js
│   │   │   └── courses.routes.js
│   │   │
│   │   └── progress/
│   │       ├── controllers/
│   │       │   └── progress.controller.js
│   │       ├── services/
│   │       │   └── progress.service.js
│   │       └── progress.routes.js
│   │
│   ├── utils/
│   │   └── ai-clients.js             # Client wrapper kết nối Gemini/Pinecone
│   │
│   └── server.js                     # Cấu hình và khởi chạy Express App
└── .env                              # Cấu hình môi trường (Local / Production)
```

---

## 4. Hướng dẫn phát triển dành cho Backend Developer

### A. Khai báo Validation Schema trong File Routes
Trước khi request đi tới Controller, nó phải đi qua Middleware Validate. Hãy cấu hình Schema theo chuẩn sau trong file `*.routes.js`:

```javascript
const validate = require('../../middleware/validation.middleware');

const createItemSchema = {
  body: {
    title: { required: true, minLength: 3 },
    email: { required: true, isEmail: true }
  },
  params: {
    userId: { required: true }
  }
};

router.post('/:userId/items', validate(createItemSchema), controller.createItem);
```

### B. Xử lý lỗi trong Service và Controller
*   **Quy tắc ở Service:** Khi phát sinh lỗi kết nối DB hoặc lỗi logic nghiệp vụ, hãy tạo một đối tượng Error kèm thuộc tính `name` và `status` rồi ném (`throw`) ra ngoài:
    ```javascript
    const error = new Error('Tài nguyên không tìm thấy');
    error.name = 'ValidationError'; // Hoặc 'DatabaseError', 'ChatbotError'
    error.status = 404;
    throw error;
    ```
*   **Quy tắc ở Controller:** Luôn bọc hàm xử lý trong khối `try-catch` và chuyển tiếp lỗi sang `next(error)` để Global Error Middleware xử lý, đảm bảo ứng dụng không bao giờ bị crash:
    ```javascript
    exports.getItem = async (req, res, next) => {
      try {
        const data = await service.getItem(req.params.id);
        res.status(200).json({ success: true, data });
      } catch (error) {
        next(error);
      }
    };
    ```

### C. Khởi chạy dự án ở Local
1.  Di chuyển vào thư mục backend: `cd backend`
2.  Đảm bảo file `.env` đã được tạo và chứa:
    ```text
    PORT=5000
    JWT_SECRET=viet_ma_bi_mat_cua_ban_tai_day
    FRONTEND_URL=http://localhost:3000
    ```
3.  Cài đặt thư viện: `npm install`
4.  Chạy server ở chế độ phát triển: `npm run dev` (sử dụng nodemon tự động restart khi lưu file).
