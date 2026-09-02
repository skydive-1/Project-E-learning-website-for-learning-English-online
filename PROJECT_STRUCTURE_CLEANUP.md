# Biên bản sắp xếp cấu trúc dự án

Ngày bắt đầu: 02/09/2026  
Trạng thái ban đầu: **PROPOSED, chưa di chuyển file**

Biên bản này được tạo trước mọi thao tác di chuyển. Working tree sạch tại thời điểm kiểm kê; commit gần nhất là `9213518`. Repo không có thư mục `.github`, vì vậy không có workflow CI nội bộ để cập nhật. Các điểm gọi file được tìm trong ba `package.json`, hai Dockerfile, `docker-compose.yml`, `vercel.json`, README, backend scripts, frontend và `rag-training/`.

## 1. Cây thư mục trước và cây đề xuất

### Trước khi sắp xếp, top 2 levels

```text
repo/
├── backend/
│   ├── src/
│   ├── scripts/
│   ├── tests/
│   ├── migrations/
│   ├── uploads/
│   ├── backups/
│   └── 19 utility JS/SQL nằm lẫn ở backend root
├── frontend/
├── rag-training/
├── scratch/
├── videos/
├── 7 JSON benchmark/snapshot ở repo root
├── 4 utility JS/Python ở repo root
├── 1 DOCX có emoji và tên tiếng Việt ở repo root
└── các file cấu hình/tài liệu chính
```

### Cây đề xuất, ghi nhận trước khi áp dụng

```text
repo/
├── backend/
│   ├── src/
│   ├── scripts/
│   ├── tests/
│   ├── migrations/
│   ├── tools/
│   │   ├── data/
│   │   ├── data-fixes/
│   │   ├── debug/
│   │   ├── media/
│   │   ├── migrations-adhoc/
│   │   └── seed/
│   └── uploads/
├── frontend/
├── rag-training/
│   ├── results/
│   │   ├── benchmarks/
│   │   └── snapshots/
│   └── tools/
├── docs/
│   ├── reports/
│   └── tools/
├── _archive/
│   └── scratch/
├── _needs-review/
│   └── media/
└── file cấu hình và tài liệu dự án chính
```

Không có top-level folder nào ngoài `docs/`, `_archive/` và `_needs-review/`; cả ba đều được prompt cleanup cho phép. `backend/scripts/` giữ các script vận hành/benchmark đã có. `backend/tools/` nhận utility chạy thủ công vốn đang nằm sai chỗ.

## 2. Danh sách di chuyển dự kiến

### Utility backend

| Đường dẫn cũ | Đường dẫn dự kiến |
|---|---|
| `inspect_db.js` | `backend/tools/debug/inspect-database-full.js` |
| `backend/inspect_db.js` | `backend/tools/debug/inspect-database-summary.js` |
| `backend/debug_analytics.js` | `backend/tools/debug/inspect-analytics.js` |
| `backend/debug_heatmap.js` | `backend/tools/debug/inspect-heatmap.js` |
| `backend/debug_heatmap_new.js` | `backend/tools/debug/inspect-heatmap-v2.js` |
| `backend/debug_sessions.js` | `backend/tools/debug/inspect-sessions.js` |
| `backend/inspect_courses.js` | `backend/tools/debug/inspect-courses.js` |
| `backend/inspect_full.js` | `backend/tools/debug/inspect-database-content.js` |
| `backend/inspect_quiz_tables.js` | `backend/tools/debug/inspect-quiz-tables.js` |
| `backend/inspect_quizz_schema.js` | `backend/tools/debug/inspect-quiz-schema.js` |
| `backend/list_modules.js` | `backend/tools/debug/list-project-modules.js` |
| `backend/export_prod_data.js` | `backend/tools/data/export-production-data.js` |
| `backend/migrate_quizzes.js` | `backend/tools/migrations-adhoc/migrate-quizzes.js` |
| `backend/migrate_supabase_to_docker.js` | `backend/tools/migrations-adhoc/migrate-supabase-to-docker.js` |
| `backend/package_drm_video.js` | `backend/tools/media/package-drm-video.js` |
| `seed_free_creative_quiz.js` | `backend/tools/seed/seed-free-creative-quiz.js` |
| `backend/seed_full_7min_subtitles.js` | `backend/tools/seed/seed-full-7min-subtitles.js` |
| `backend/seed_subtitles.js` | `backend/tools/seed/seed-subtitles.js` |
| `backend/seed_prod_data.sql` | `backend/tools/seed/seed-production-data.sql` |
| `backend/update_accurate_subtitles.js` | `backend/tools/data-fixes/update-accurate-subtitles.js` |
| `backend/update_verbatim_subtitles.js` | `backend/tools/data-fixes/update-verbatim-subtitles.js` |

Hai file tên `inspect_db.js` không giống nhau. File ở repo root dài hơn, kiểm tra table, foreign key, row count và default; file trong `backend/` chỉ in schema tóm tắt. Chúng sẽ được giữ với hai tên mô tả đúng phạm vi, không xóa hoặc ghi đè một bản.

### Kết quả RAG và utility tạo tài liệu

| Đường dẫn cũ | Đường dẫn dự kiến |
|---|---|
| `phase3_final_validation_results.json` | `rag-training/results/benchmarks/phase3_final_validation_results.json` |
| `phase4_intent_routing_results.json` | `rag-training/results/benchmarks/phase4_intent_routing_results.json` |
| `phase5_conversational_rewriting_results.json` | `rag-training/results/benchmarks/phase5_conversational_rewriting_results.json` |
| `phase6_hybrid_retrieval_results.json` | `rag-training/results/benchmarks/phase6_hybrid_retrieval_results.json` |
| `rag_baseline_results.json` | `rag-training/results/benchmarks/rag_baseline_results.json` |
| `rag_v2_course_benchmark_results.json` | `rag-training/results/benchmarks/rag_v2_course_benchmark_results.json` |
| `rag_v2_vector_store.json` | `rag-training/results/snapshots/rag_v2_vector_store.json` |
| `generate_rag_guide.py` | `rag-training/tools/generate-rag-guide.py` |
| `generate_report.py` | `docs/tools/generate-week5-progress-report.py` |
| `📝 TÀI LIỆU PHÂN CHIA NHIỆM VỤ VÀ HƯỚNG DẪN KỸ THUẬT - SPRINT 11.docx` | `docs/reports/sprint-11-task-allocation-and-technical-guide.docx` |

Các backend benchmark đang đọc hoặc ghi JSON bằng đường dẫn về repo root; chúng phải được sửa cùng commit di chuyển. `backend/package.json` chỉ có một script trỏ tới utility top-level: `db:export-prod` gọi `export_prod_data.js`.

### Scratch và media cần giữ lại để xem xét

Năm file trong `scratch/`, cùng `docx_text.txt`, `scratch_sprint10.txt` và `sprint10_content.txt`, không có consumer trong code, package scripts, Docker hoặc cấu hình deploy. Chúng sẽ chuyển sang `_archive/scratch/`, không xóa. Sau đó `.gitignore` sẽ chặn thư mục `scratch/` mới.

Hai video trong `videos/` không có tham chiếu theo tên trong code. Kế hoạch là chuyển nguyên file sang `_needs-review/media/legacy-root-videos/`; chưa xóa và chưa chuyển storage trong đợt này. Video dưới `backend/uploads/courses/videos/` vẫn được seed SQL và subtitle utility tham chiếu, nên giữ nguyên vị trí. Fixture audio/video của test và `frontend/public/videos/girl_typing.mp4` cũng giữ nguyên.

## 3. Bằng chứng trước khi di chuyển

- `git status --short`: không có thay đổi.
- Không có `.github/`; danh sách cấu hình build/deploy gồm `backend/Dockerfile`, `frontend/Dockerfile`, `docker-compose.yml`, ba `package.json` và các file Vercel.
- `backend/package.json:15` gọi `node export_prod_data.js`; chưa có script package nào gọi utility còn lại.
- Bảy backend script đọc hoặc ghi `rag_v2_vector_store.json`; sáu script ghi file benchmark về repo root. Mọi đường dẫn này nằm trong danh sách phải sửa.
- Hai video root có kích thước 22.60 MiB và 2.77 MiB, không có kết quả grep theo basename. Mười video bài học trong `backend/uploads/courses/videos/` có kích thước từ 56.38 đến 88.32 MiB và có tham chiếu trong `backend/seed_prod_data.sql` hoặc subtitle utility.

## 4. File có thể xóa nhưng chọn archive

Chưa xóa file nào. Danh sách và bằng chứng grep cuối cùng sẽ được điền sau khi hoàn tất move; tất cả file không xác định được giá trị sử dụng sẽ nằm ở `_archive/` hoặc `_needs-review/`.

## 5. Kiểm thử sau sắp xếp

Chưa chạy vì chưa áp dụng move. Mục này sẽ ghi đúng lệnh, số pass/fail/skip và kết quả production build sau commit di chuyển cuối cùng.

## 6. UNVERIFIED

- Chưa xác minh nội dung hai video root với dữ liệu trên Supabase; chỉ xác minh được repo không tham chiếu basename của chúng.
- Chưa xác minh các utility chạy thủ công với database thật. Sau move sẽ kiểm tra cú pháp và `--help` nếu script hỗ trợ; không chạy migration/seed có khả năng thay đổi dữ liệu production.
