# Kế hoạch cải thiện & tác vụ ưu tiên — Dự án E‑Learning

Mục tiêu: biến repository hiện tại thành một ứng dụng E‑Learning an toàn, ổn định và có trải nghiệm người dùng mượt cho 3 vai trò (Student, Instructor, Admin), phù hợp để demo/triễn khai ở môi trường production nhỏ.

Tóm tắt ưu tiên (critical → nice‑to‑have)

1) Critical (sửa ngay trước demo/public)
- Sửa xử lý token trong URL (AuthTokenRedirectHandler) để không lưu access token / mật mã khôi phục trong URL hoặc lịch sử trình duyệt.
- Bảo vệ media endpoints (protected-media): đảm bảo upload/serve video cần xác thực + signed URL / streaming policy.
- Cứng hóa ProtectedRoute / useAuth: tránh hiển thị UI khi token expired; xử lý role rõ ràng.
- Thêm test tối thiểu cho auth/protected routes và một workflow CI để chạy test.

2) High (cải thiện UX)
- Sửa routes mơ hồ (/lessons vs /lessons/:id) và redirect hợp lý cho người chưa đăng nhập.
- Làm chatbot, hiệu ứng particle và modal gamification opt‑in / rate limited.
- Offline UX: hiển thị trạng thái cached, cho phép read‑only khi offline.

3) Medium
- Audit bundle size & lazy load mọi library nặng (Shaka, react-pdf, Recharts).
- Thêm accessibility checks (axe/lighthouse), keyboard nav, ARIA labels.
- Chuẩn hóa role mapping (enum string) và validate trên server.

4) Nice to have
- Add integration tests cho course CRUD, video playback, upload, DRM flows.
- Thêm monitoring / logging minimal (Sentry / in‑repo logs).

Kế hoạch hành động (thực thi bước‑bước)

A. Sửa nhanh (1–3 ngày)
1. Thay AuthTokenRedirectHandler bằng flow an toàn:
   - Parse chỉ params cần thiết từ hash/search (ví dụ type, access_token, state).
   - Nếu có access_token: gửi đến backend exchange (nếu cần) hoặc lưu tạm vào memory, sau đó history.replaceState để xóa hash từ URL.
   - Navigate đến /reset-password mà KHÔNG copy toàn bộ hash.

2. Cập nhật ProtectedRoute:
   - Kiểm tra rõ ràng authStatus === 'authenticated' vs 'unauthenticated' vs 'expired'.
   - Nếu role không đủ, redirect đến 403 page hoặc Home.

3. Bảo vệ media endpoints trên backend:
   - Yêu cầu auth cho tất cả route trả media (serve bằng signed URL hoặc trả stream chỉ sau khi kiểm tra auth).

4. Thêm GH Actions workflow minimal:
   - Chạy linter, unit tests (frontend + backend) trên PR.

B. Nâng cấp UX & vững chắc (1–2 tuần)
- Implement offline read‑only mode (cache API responses bằng react‑query + IndexedDB hoặc localForage).
- Throttle gamification modals, chatbot opt‑in.
- Bundle analyzer và lazy loading review.

C. Long term (2–4 tuần)
- Thiết kế DRM/streaming (HLS/DASH + Signed URLs + token validation).
- Tách dịch vụ (microservices) nếu cần: auth service, media service, api gateway.

Bản thay đổi code cụ thể gợi ý (ví dụ cần apply bằng PR)

1) AuthTokenRedirectHandler (thay thế App.jsx handler)
- Hành vi an toàn:
  - Nếu hash chứa access_token: lấy giá trị, gửi tới backend /auth/oauth/callback để exchange (nếu dùng token trực tiếp) — hoặc lưu vào memory via context và dùng cookie HttpOnly.
  - Xóa hash khỏi URL bằng history.replaceState hoặc navigate('', { replace: true }) mà KHÔNG append token.
  - Chỉ redirect khi state/expected callback khớp.

Ví dụ pseudo‑code (React):

```javascript
// Tóm tắt hành động
useEffect(() => {
  const { hash, search, pathname } = window.location;
  const params = parseHashOrSearch(hash || search);
  if (isOAuthCallback(params)) {
    // Option A: gửi mã sang backend để exchange và set httpOnly cookie
    await fetch('/api/auth/exchange', { method: 'POST', body: JSON.stringify(params) });
    // Xóa hash/search khỏi URL
    window.history.replaceState({}, document.title, pathname);
    // Navigate an toàn
    navigate('/reset-password', { replace: true });
  }
}, []);
```

2) ProtectedRoute (logic mẫu)
- Kiểm tra: if (authStatus === 'checking') show skeleton; if (authStatus === 'unauthenticated') navigate('/login'); if (authStatus === 'authenticated' && !allowedRoles.includes(user.role)) show 403.

Agent AI prompt (dưới) đã sẵn sàng để copy/paste.

Những file tôi sẽ tạo trong repo (nếu bạn đồng ý)
- IMPROVEMENT_PLAN.md (this file) — checklist & hướng dẫn
- AGENT_REFACTOR_PROMPT.md — prompt ready‑to‑use cho Agent AI để refactor toàn bộ project theo kiến trúc đề xuất
- PATCHES/README_CHANGES.md — PR‑ready snippets (AuthTokenRedirectHandler, ProtectedRoute, CI workflow) — tôi sẽ tạo nếu bạn đồng ý commit tự động.

Tiếp theo tôi có thể làm ngay (chọn 1):
- A: Tạo các file docs (IMPORVEMENT_PLAN.md + AGENT prompt) trong repo. (an toàn, non‑intrusive)
- B: Tạo các patch file + trực tiếp cập nhật 2 file frontend (App.jsx & ProtectedRoute.jsx) theo thay đổi an toàn (commit vào main). (thao tác can thiệp code trực tiếp)
- C: Cả hai (A + B).

Bạn muốn tôi tiếp tục theo A, B hay C?