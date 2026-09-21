# University Library System (ULS)

Hệ thống Quản lý Thư viện Trường Đại học — Đề tài 8, môn Công nghệ Phần mềm, Khoa CNTT, Trường ĐH Xây dựng Miền Trung. GVHD: TS. Lê Tỷ Khánh.

Ứng dụng web quản lý sách, bạn đọc, mượn/trả, tìm kiếm, thống kê; tích hợp AI gợi ý sách và dự báo nguy cơ trả trễ.

## Tài liệu

| Tài liệu | Đường dẫn |
|---|---|
| Kế hoạch tổng thể | [docs/PLAN.md](docs/PLAN.md) |
| SRS (IEEE 830) — LAB 1 | [docs/srs/SRS.md](docs/srs/SRS.md) · [SRS.docx](docs/srs/SRS.docx) |
| Tài liệu thiết kế (SDD) — LAB 2 | [docs/design/SDD.md](docs/design/SDD.md) · [SDD.docx](docs/design/SDD.docx) — kiến trúc, UML, ERD, đặc tả API |
| Biểu đồ UML (PlantUML + PNG) | [docs/uml/](docs/uml/) — use case, class, 3 sequence, activity, architecture |
| ERD + DDL (sinh từ Prisma) | [docs/erd/](docs/erd/) |
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
docker compose exec backend pnpm prisma db seed
# hoặc chạy ngoài Docker: DATABASE_URL=postgresql://uls:uls@localhost:5434/uls pnpm --dir backend prisma db seed
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
python backend/test/smoke-sprint1.py http://localhost:8080/api   # 48 lời gọi API trên hệ thống đang chạy + seed
```

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

## Tạo bảng Kanban (GitHub Projects) — làm một lần trên web

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
