# Design

## Visual Theme
Hệ thống thiết kế tập trung vào sự rõ ràng, hiện đại và tiếp cận theo phong cách "Content-First" của Udemy, sử dụng bảng màu chuyên nghiệp để hỗ trợ việc học tập lâu dài.

## Color Palette
- **Primary (Smart Indigo):** `#1d4ed8` (OKLCH L 0.45 C 0.23 H 263) - Màu chủ đạo cho các hành chính và nhận diện thông minh.
- **Secondary (Friendly Orange):** `#ff7a30` (OKLCH L 0.68 C 0.19 H 45) - Màu tạo điểm nhấn, sự ấm áp và khích lệ.
- **Background:** `#f8fafc` - Nền xám xanh cực nhẹ giúp giảm mỏi mắt.
- **Text (Ink):** `#0f172a` - Màu chữ tối sâu để tối ưu hóa độ tương phản.
- **Success:** `#10b981` - Màu xanh lục cho các trạng thái hoàn thành.

## Typography
- **Primary Font:** `Outfit` (Sans-serif) - Sự cân bằng giữa hình học hiện đại và sự tiếp cận thân thiện.
- **Scale:** Sử dụng Modular Scale để đảm bảo phân cấp thị giác rõ ràng.
- **Line Length:** Giới hạn 65-75ch cho các nội dung bài học để tối ưu khả năng đọc.

## Components
- **Cards:** Border-radius 24px, đổ bóng nhẹ (`0 4px 20px rgba(0, 0, 0, 0.03)`), tập trung vào nội dung bên trong.
- **Buttons:** Border-radius 12px, transition mượt mà (0.2s), không sử dụng hiệu ứng bóng bẩy quá đà.
- **Inputs:** Bo tròn 20px, sử dụng icon Fi (Feather Icons) để tăng khả năng nhận diện.

## AI Integration UI
- **Chatbot:** Được thiết kế như một trợ lý thông minh luôn sẵn sàng, sử dụng hiệu ứng blur và backdrop-filter tinh tế.
- **Roadmap:** Hiển thị dưới dạng Grid trực quan, phân tách giai đoạn rõ ràng bằng màu sắc và icon.

## Motion & Interaction
- **Easing:** Sử dụng `cubic-bezier(0.165, 0.84, 0.44, 1)` cho các hiệu ứng hover.
- **Rule:** Không animate hình ảnh trên hover; tập trung vào thay đổi background hoặc border.
- **Reduced Motion:** Tất cả animations phải có phương án thay thế cho người dùng chọn chế độ giảm chuyển động.
