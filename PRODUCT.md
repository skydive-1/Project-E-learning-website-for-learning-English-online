# Product

<!-- impeccable:product-schema 1 -->

## Platform
web

## Register

product

## Users
Học viên ở mọi lứa tuổi tại Việt Nam, từ người mới bắt đầu (con số 0) đến những người đang luyện thi IELTS hoặc muốn cải thiện khả năng giao tiếp tự tin.

## Product Purpose
Cung cấp một nền tảng học tiếng Anh trực tuyến toàn diện, tích hợp công nghệ AI (RAG Chatbot) để hỗ trợ phản xạ giao tiếp, học ngữ pháp và từ vựng theo lộ trình cá nhân hóa, giúp người học đạt được mục tiêu ngôn ngữ một cách hiệu quả và hiện đại.

## Brand Personality
- **Hiện đại (Modern):** Giao diện sạch sẽ, bắt kịp xu hướng công nghệ AI.
- **Thân thiện (Friendly):** Dễ tiếp cận cho mọi lứa tuổi, tạo cảm giác thoải mái khi học.
- **Thông minh (Smart):** Thể hiện qua sự hỗ trợ của AI và cách sắp xếp lộ trình học khoa học.
- **Cảm hứng:** Udemy (Sự chuyên nghiệp, rõ ràng và tập trung vào nội dung).

## Anti-references
- Tránh thiết kế quá lòe loẹt hoặc dùng quá nhiều màu sắc tương phản mạnh gây mỏi mắt.
- Không sử dụng quá nhiều hiệu ứng chuyển động (animations) gây xao nhãn quá trình học tập.
- Tránh các "AI slop" phổ biến như: chữ gradient quá đà, bo góc quá lớn kết hợp đổ bóng dày đặc kiểu cũ.

## Design Principles
- **Nội dung là trọng tâm (Content First):** Giống như Udemy, giao diện phải phục vụ việc học, bài giảng và tài liệu phải dễ đọc nhất.
- **Tương tác tinh tế (Subtle Interaction):** Các phản hồi giao diện (hover, click) cần nhẹ nhàng, đủ để xác nhận thao tác mà không gây mất tập trung.
- **Rõ ràng và Minh bạch (Clarity & Transparency):** Lộ trình học và sự hỗ trợ của AI phải được hiển thị một cách dễ hiểu, không gây bối rối cho người dùng mới.

## Accessibility & Inclusion
- Hỗ trợ tốt cho người dùng ở nhiều độ tuổi (font chữ rõ ràng, icon dễ hiểu).
- Tuân thủ các nguyên tắc cơ bản về độ tương phản để hỗ trợ học tập trong thời gian dài.
- Tùy chọn giảm chuyển động cho những người nhạy cảm.

## Evidence on Hand
- Frontend: `frontend\package.json` (React 19, Vite, Tailwind). Dev scripts: `npm start` → `vite`, `npm run build`.
- Backend: `backend\package.json` (Node/Express, @pinecone-database, @supabase, @google/generative-ai). Dev scripts: `npm run dev` → `nodemon src/server.js`, `npm start` → `node src/server.js`.
- Product copy (purpose, users) present in this file; no DESIGN.md required for init.

## Capabilities & Constraints
- Confirmed capabilities: AI-assisted learning via a RAG Chatbot (backend shows Pinecone/Supabase/Google GA libs), web frontend using React/Vite/Tailwind.
- Technical constraints: web-first deployment; server-side Node/Express; Postgres-compatible DB (pg) and Supabase integrations observed.
- Undecided facts (left open): deployment target and hosting provider; analytics/telemetry standard; exact content sources for RAG indexing.

## Operating Context
- Development commands: frontend uses `npm start` (vite), backend uses `npm run dev` (nodemon) and `npm start` for production.
- Primary artifacts: `frontend/` and `backend/` directories; developer workflow expects standard npm scripts.

## Positioning
Personalized AI-assisted English learning: combines course content and RAG-powered chat to make practice and remediation feel immediate and context-aware.

## Product Principles
1. Content-first: prioritize reading and lesson clarity over decorative UI.
2. AI-as-coach: AI augments learning without obscuring human-curated curriculum.
3. Low-friction access: minimize steps between intent and practice (fast session start, clear progress).


