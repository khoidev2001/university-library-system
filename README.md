# University Library System (ULS)

Hệ thống Quản lý Thư viện Trường Đại học: Đề tài 8, môn Công nghệ Phần mềm, Khoa CNTT, Trường ĐH Xây dựng Miền Trung. GVHD: TS. Lê Tỷ Khánh.

Ứng dụng web quản lý sách, bạn đọc, mượn/trả, tìm kiếm, thống kê; tích hợp AI gợi ý sách và dự báo nguy cơ trả trễ.

## Tài liệu

| Tài liệu | Đường dẫn |
|---|---|
| Kế hoạch tổng thể | [docs/PLAN.md](docs/PLAN.md) |
| SRS (IEEE 830), LAB 1 | [docs/srs/SRS.md](docs/srs/SRS.md) · [SRS.docx](docs/srs/SRS.docx) |
| Tài liệu thiết kế (SDD), LAB 2 | [docs/design/SDD.md](docs/design/SDD.md) · [SDD.docx](docs/design/SDD.docx), kiến trúc, UML, ERD, đặc tả API |
| Biểu đồ UML (PlantUML + PNG) | [docs/uml/](docs/uml/), use case, class, 3 sequence, activity, architecture |
| ERD + DDL (sinh từ Prisma) | [docs/erd/](docs/erd/) |
| Brief slide thuyết trình | [LAB 1](docs/report/LAB1_slides_brief.md) · [LAB 2](docs/report/LAB2_slides_brief.md) |
| Báo cáo 4 LAB (mẫu của GV) | [docs/report/LAB_Report.docx](docs/report/LAB_Report.docx) |
| Kế hoạch quản lý dự án, EVA | [docs/pm/](docs/pm/) |
| Product Backlog | [Issues](https://github.com/khoidev2001/university-library-system/issues?q=label%3Auser-story) (label `user-story`, milestone theo sprint) · [Projects](https://github.com/khoidev2001/university-library-system/projects) |

## Kiến trúc

```
Browser → Frontend (Next.js 15) → Backend API (NestJS + Prisma + PostgreSQL)
                                       ├→ AI Service (FastAPI + scikit-learn)
                                       └→ Google Books API (chỉ khi nạp dữ liệu)
```

| Thành phần | Thư mục | Công nghệ |
|---|---|---|
| Backend | `backend/` | NestJS 10, Prisma, PostgreSQL 16, JWT, Swagger, Jest |
| Frontend | `frontend/` | Next.js 15, TypeScript, TailwindCSS, TanStack Query |
| AI Service | `ai-service/` | FastAPI, scikit-learn, pandas, pytest |
| Gateway (local) | `gateway/` | Nginx |

## Chạy cục bộ

```bash
cp .env.example .env
docker compose up --build
# http://localhost:8080          → frontend
# http://localhost:8080/api/docs → Swagger backend
# http://localhost:8080/api/health, /ai/health, /health
```

## Dữ liệu mẫu & tài khoản demo

```bash
# Lần đầu (hoặc SEED_RESET=1 để làm lại): 1.000 sách, 2.000 bạn đọc, 229k rating, 2 chính sách mượn
docker compose exec backend pnpm seed:prod
# hoặc chạy ngoài Docker: DATABASE_URL=postgresql://uls:uls@localhost:5434/uls pnpm --dir backend prisma db seed

# Lịch sử mượn/trả MÔ PHỎNG (cần cho báo cáo thống kê và cho AI ở Sprint 3)
docker compose exec backend pnpm seed:loans:prod   # SEED_LOANS_RESET=1 để sinh lại
# Ngoài Docker dùng ts-node: pnpm --dir backend prisma db seed và pnpm --dir backend seed:loans
```

| Tài khoản | Mật khẩu | Vai trò |
|---|---|---|
| `admin@uls.local` | `Admin@123` | ADMIN |
| `librarian1@uls.local`, `librarian2@uls.local` | `Admin@123` | LIBRARIAN |
| `reader@uls.local` (SV), `lecturer@uls.local` (GV) | `Reader@123` | READER |
| `sv<id>@student.uls.local`, `gv<id>@uls.local` (2.000 bạn đọc goodbooks) | `Reader@123` | READER |

Subset goodbooks-10k nằm sẵn trong `backend/prisma/seed/data/`. Để tạo lại hoặc bổ sung mô tả sách từ Google Books (cần `GOOGLE_BOOKS_API_KEY`, không có key sẽ bị 429):

```bash
GOOGLE_BOOKS_API_KEY=... python backend/prisma/seed/prepare_goodbooks.py --google 1000
```

## Kiểm thử

```bash
pnpm --dir backend test:cov                       # unit, mock Prisma, ngưỡng 80%
DATABASE_URL=... pnpm --dir backend test:e2e      # supertest trên Postgres thật
python backend/test/smoke-sprint1.py http://localhost:8080/api   # 48 lời gọi API: auth, catalog, users, policies
python backend/test/smoke-sprint2.py http://localhost:8080/api uls-postgres-1   # 36 lời gọi: mượn/trả/phạt/đánh giá/báo cáo
python backend/test/smoke-sprint3.py http://localhost:8080/api http://localhost:8080/ai uls-postgres-1   # 16 lời gọi: AI gợi ý + dự báo
pytest --rootdir ai-service ai-service                            # 23 test AI, ngưỡng coverage 80%
```

Hai script smoke chạy trên hệ thống **đang chạy** với dữ liệu seed, đây là bằng chứng mức "chạy thật" cho phần đụng cơ sở dữ liệu và tiền.

## Giao diện

| Trang | Đường dẫn | Dành cho |
|---|---|---|
| Trang chủ, tra cứu, chi tiết sách, quy định | `/`, `/books`, `/books/[id]`, `/quy-dinh` | Công khai, dựng phía máy chủ cho SEO |
| Đăng nhập, đăng ký | `/login`, `/register` | Công khai |
| Sách của tôi, tiền phạt, gợi ý | `/my/loans`, `/my/fines`, `/recommendations` | Bạn đọc |
| Quầy mượn trả, quản lý bạn đọc, thống kê | `/librarian/desk`, `/librarian/readers`, `/reports` | Thủ thư |
| Chính sách mượn | `/admin/policies` | Quản trị |

SEO: tiêu đề và mô tả riêng từng trang, canonical, Open Graph, dữ liệu có cấu trúc schema.org (`Library` kèm `SearchAction`, `Book` kèm `aggregateRating` và tình trạng còn sách, `FAQPage` cho trang quy định), `sitemap.xml` và `robots.txt` sinh tự động, khu vực tài khoản bị chặn khỏi chỉ mục.

Trình duyệt luôn gọi `/api` cùng origin qua gateway, không nhúng tên miền lúc build, nên một image chạy được ở mọi tên miền và cổng. Ảnh chụp màn hình trong `docs/report/screenshots/`.

## Xuất dữ liệu, in thẻ / nhãn, nhập sách từ file

Dành cho thủ thư (Admin kế thừa). Tài liệu API đầy đủ ở Swagger (`/api/docs`, nhóm `exports` và `books`).

### Xuất CSV / Excel

`GET /api/exports/{overdue-loans|loans|top-books|inventory|fines|readers|books}?format=csv|xlsx` kèm bộ lọc của từng bộ dữ liệu
(`from`, `to` dạng `YYYY-MM-DD` theo giờ thư viện UTC+7 và bao trọn ngày cuối; `status`, `overdue`, `paid`, `q`, `categoryId`, `isActive`...).

- Phát trực tiếp theo lô 1.000 dòng bằng con trỏ trên `id` (không OFFSET, không dựng mảng lớn trong bộ nhớ). Trần 100.000 dòng mỗi lần (đổi bằng `EXPORT_MAX_ROWS`); vượt trần thì file bị cắt và có header `X-Export-Truncated: true`. `X-Total-Count` là số dòng khớp.
- CSV: UTF-8 có BOM (Excel hiển thị đúng tiếng Việt), RFC 4180, chống formula injection: ô văn bản bắt đầu bằng `=` `+` `-` `@` tab CR được thêm dấu `'` phía trước. Số tiền, số lượng ghi chữ số trần.
- Excel (`exceljs`, chế độ streaming): ô số và ô ngày là kiểu thật (cộng, lọc, sắp xếp được), tiền định dạng VND, ngày ghi theo giờ treo tường UTC+7, hàng tiêu đề cố định kèm bộ lọc.
- `Content-Disposition` có cả `filename` (ASCII, bỏ dấu) lẫn `filename*=UTF-8''...` (tên tiếng Việt đầy đủ).

### In thẻ bạn đọc và nhãn bản sao

- `/librarian/readers/[id]/card` (một thẻ) và `/librarian/readers/cards?ids=1,2,3` hoặc `?q=...` (hàng loạt, tối đa 300 thẻ). Thẻ 85,6 × 54 mm, 10 thẻ trên một tờ A4 hoặc 1 thẻ/trang cho máy in thẻ. Mã vạch Code 128 và mã QR đều chứa mã thẻ.
- `/librarian/labels?bookIds=1,2` hoặc `?copyIds=...`: nhãn mã vạch bản sao `LIB-<id>-<n>` kèm tên sách và vị trí kệ. Bố cục: 3×8 (63,5×33,9), 2×7 (99,1×38,1), 4×10 (52,5×29,7) trên A4, hoặc cuộn nhãn 50×25 mm; có ô "bỏ trống N ô đầu" để dùng tiếp tờ đã in dở. Dữ liệu lấy từ `GET /api/copies/labels`.
- Mã vạch và QR vẽ bằng SVG ngay trên trình duyệt (bộ mã hoá Code 128 tự viết, ~2 KB; QR dùng `uqr` ~8 KB gzip), chỉ nạp ở trang in. Menu, header, footer ẩn khi in (`print:hidden`); khi in chọn tỉ lệ 100%, lề "Không có".
- Kiểm tra giải mã ngược (chỉ dev): `pnpm --dir frontend verify:barcodes` sinh mã vạch / QR, dựng ảnh nhỏ như khi in và đọc lại bằng `zxing-wasm`.

### Nhập sách hàng loạt từ file

- `GET /api/books/import-template?format=csv|xlsx`: file mẫu có dòng ví dụ. Cột: `title, authors (cách nhau bằng ;), category, isbn, publisher, publishedYear, price, description, coverUrl, copies, shelfLocation`; tiêu đề cột tiếng Việt cũng được nhận.
- `POST /api/books/import-file?dryRun=true|false&onDuplicate=skip|update` (multipart, trường `file`, CSV hoặc xlsx, tối đa 5 MB và 5.000 dòng).
  - `dryRun=true`: chỉ kiểm tra, trả bản xem trước từng dòng (lỗi, cảnh báo, hành động tạo / cập nhật / bỏ qua, thể loại sẽ tạo). Không ghi gì.
  - Ghi thật: lô 100 dòng trong giao dịch, kiểm tra lại dưới khoá advisory nên hai lần nhập song song không sinh sách / tác giả trùng và mã vạch không đụng nhau. Trả `{ created, updated, skipped, failed[{row, reason, raw}], createdCopies, newCategories }`; giao diện cho tải các dòng lỗi thành CSV.
  - Idempotent theo ISBN (ISBN-10 và ISBN-13 của cùng sách được nhận là một). `copies` là số bản sao tối thiểu cần có (chỉ bổ sung, không bao giờ xoá). Dòng không có ISBN chỉ so trùng theo tiêu đề.
  - Loại file kiểm bằng nội dung (magic bytes), không tin đuôi hay Content-Type; từ chối macro (`.xlsm`, `vbaProject.bin`), zip bomb (đếm byte giải nén thật, trần 25 MB mỗi phần), CSV hỏng, không phải UTF-8. Công thức trong xlsx không bao giờ được thực thi, chỉ lấy giá trị đã tính. URL ảnh bìa chỉ nhận `http` / `https`.
  - Mã lỗi: `IMPORT_NO_FILE` 400, `IMPORT_FILE_TYPE_INVALID` / `IMPORT_MACRO_NOT_ALLOWED` 415, `IMPORT_FILE_TOO_LARGE` 413, `IMPORT_TOO_MANY_ROWS` / `IMPORT_MALFORMED` / `IMPORT_MISSING_COLUMN` / `IMPORT_EMPTY` / `IMPORT_ENCODING` 422.
- Gateway nginx đã nâng `client_max_body_size` lên 6 MB cho `/api/`. Khi chạy sau proxy khác (Vercel rewrite, Render...), kiểm tra giới hạn kích thước thân yêu cầu của proxy đó.

## AI Service

Khởi động xong, AI Service tự kéo dữ liệu qua `GET /api/internal/training-data` (header `X-Internal-Key`) rồi huấn luyện; `GET /ai/health` báo `recommender`/`overdue` đã `ready` chưa.

| Endpoint | Việc |
|---|---|
| `GET /ai/recommend?user_id=&k=` | Gợi ý sách (TF-IDF + item-based CF, trộn 50/50) |
| `POST /ai/predict-overdue` | Xác suất trả trễ (Logistic Regression / Random Forest, chọn ROC-AUC cao hơn) |
| `POST /ai/train` · `GET /ai/metrics` | Huấn luyện lại · số đo mô hình |

Qua Backend: `GET /api/recommendations/me` (bạn đọc), `GET /api/recommendations/metrics` và `/overdue-accuracy` (thủ thư), `POST /api/recommendations/train` (admin).

**AI chết không làm sập nghiệp vụ:** cho mượn vẫn thành công với `overdueRisk = null`, trang gợi ý rơi về sách mượn nhiều (`source: POPULAR`), endpoint quản trị AI trả `503 AI_UNAVAILABLE`.

Số đo gần nhất trên dữ liệu seed (05/10/2026): Precision@5 = 0,309 · Recall@5 = 0,110; dự báo trả trễ ROC-AUC 0,762 (Logistic Regression) so với 0,756 (Random Forest). Lịch sử mượn/trả là **dữ liệu mô phỏng**, nên các số này phản ánh quy luật mô phỏng.

## Công cụ tài liệu

```bash
# Render UML
docker run --rm -v "$PWD/docs/uml:/data" plantuml/plantuml -tpng -charset UTF-8 "/data/*.puml"
# ERD từ Prisma schema (chạy lại sau mỗi lần đổi schema)
python docs/tools/prisma_to_erd.py && cp backend/prisma/migrations/*/migration.sql docs/erd/ddl.sql
# SRS.md / SDD.md → .docx
python docs/tools/md_to_docx.py docs/design/SDD.md docs/design/SDD.docx
python docs/tools/md_to_docx.py docs/srs/SRS.md docs/srs/SRS.docx
# Điền báo cáo mẫu
python docs/tools/fill_lab_report.py docs/report/LAB_report_template.docx docs/report/LAB_Report.docx
# Tạo backlog trên GitHub từ SRS
python docs/tools/create_backlog.py --repo <owner>/<repo>
```

## Tạo bảng Kanban (GitHub Projects): làm một lần trên web

1. Repo → tab **Projects** → **New project** → chọn **Board** → đặt tên `ULS Product Backlog`.
2. Trong board: **+ Add item** → **Add from repository** → chọn tất cả issue có label `user-story`.
3. **⋯ → Workflows** → bật *Auto-add to project* (lọc `label:user-story`) và *Item closed → Done*.
4. Thêm field **Sprint** (single select: Sprint 1/2/3) hoặc dùng **Group by: Milestone** để xem theo sprint.

## Quy ước

- Nhánh `main` bảo vệ; làm việc trên `feat/*`, merge qua PR khi CI xanh.
- Conventional Commits. Tên file/hàm/biến tiếng Anh; tài liệu và giao diện tiếng Việt.
- Log giờ làm việc vào `docs/pm/timelog.csv` (phục vụ EVA).

## Dữ liệu

Dữ liệu sách mẫu từ [goodbooks-10k](https://github.com/zygmuntz/goodbooks-10k) (CC BY-SA 4.0), bổ sung mô tả từ Google Books API. Lịch sử mượn/trả dùng để huấn luyện AI là dữ liệu mô phỏng.
