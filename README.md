# University Library System (ULS)

Hệ thống Quản lý Thư viện Trường Đại học — Đề tài 8, môn Công nghệ Phần mềm, Khoa CNTT, Trường ĐH Xây dựng Miền Trung. GVHD: TS. Lê Tỷ Khánh.

Ứng dụng web quản lý sách, bạn đọc, mượn/trả, tìm kiếm, thống kê; tích hợp AI gợi ý sách và dự báo nguy cơ trả trễ.

## Tài liệu

| Tài liệu | Đường dẫn |
|---|---|
| Kế hoạch tổng thể | [docs/PLAN.md](docs/PLAN.md) |
| SRS (IEEE 830) — LAB 1 | [docs/srs/SRS.md](docs/srs/SRS.md) · [SRS.docx](docs/srs/SRS.docx) |
| Biểu đồ UML (PlantUML) | [docs/uml/](docs/uml/) |
| Báo cáo 4 LAB (mẫu của GV) | [docs/report/LAB_Report.docx](docs/report/LAB_Report.docx) |
| Kế hoạch quản lý dự án, EVA | [docs/pm/](docs/pm/) |
| Product Backlog | GitHub Issues (label `user-story`) + Milestones theo sprint |

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
# http://localhost        → frontend
# http://localhost/api    → backend (Swagger: /api/docs)
# http://localhost/ai     → AI service
```

## Công cụ tài liệu

```bash
# Render UML
docker run --rm -v "$PWD/docs/uml:/data" plantuml/plantuml -tpng -charset UTF-8 "/data/*.puml"
# SRS.md → SRS.docx
python docs/tools/md_to_docx.py docs/srs/SRS.md docs/srs/SRS.docx
# Điền báo cáo mẫu
python docs/tools/fill_lab_report.py docs/report/LAB_report_template.docx docs/report/LAB_Report.docx
# Tạo backlog trên GitHub từ SRS
python docs/tools/create_backlog.py --repo <owner>/<repo>
```

## Quy ước

- Nhánh `main` bảo vệ; làm việc trên `feat/*`, merge qua PR khi CI xanh.
- Conventional Commits. Tên file/hàm/biến tiếng Anh; tài liệu và giao diện tiếng Việt.
- Log giờ làm việc vào `docs/pm/timelog.csv` (phục vụ EVA).

## Dữ liệu

Dữ liệu sách mẫu từ [goodbooks-10k](https://github.com/zygmuntz/goodbooks-10k) (CC BY-SA 4.0), bổ sung mô tả từ Google Books API. Lịch sử mượn/trả dùng để huấn luyện AI là dữ liệu mô phỏng.
