# PLAN: Hệ thống Quản lý Thư viện Trường Đại học (Đề tài 8)

> Môn Công nghệ Phần mềm — ĐH Xây dựng Miền Trung — GVHD: TS. Lê Tỷ Khánh
> Ngày lập: 2026-09-21 · Bản 2 (sau review đối chiếu 3 file đề bài, cùng ngày)

## 0. Hai sản phẩm phải nộp, một mã nguồn, một hạn nộp

| Sản phẩm | Theo file | Gồm |
|---|---|---|
| **A. Báo cáo 4 LAB** + mã nguồn | `4_LAB_va_HD.SV.pdf`, `Mau_BC_Thuc_Hanh_LAB.docx` | SRS, UML/ERD/API, code BE+FE+AI, Docker/CI/deploy — **điền thẳng vào file mẫu .docx** |
| **B. Kế hoạch Quản lý Dự án** | `10 BT Nhom.SV.pdf` | Word 30-40 trang: SOW, WBS, CPM + Gantt, rủi ro, org chart + RACI, kiểm thử, NPV/ROI, **EVA** + Excel + slide 15' |

Cả hai nộp **cuối kỳ (~8 tuần)**, cùng một môn. Nhóm thật 1-2 người; báo cáo ghi 4 tên theo mẫu.

**Hai dòng thời gian, đừng lẫn:**

- **Lịch thật** (mục 9): 8 tuần, 1-2 người làm.
- **Dự án mô phỏng** trong báo cáo PM (mục 10): 16 tuần, 4 người, dùng cho SOW/WBS/CPM/EVA. Quy ước **1 tuần thật = 2 tuần mô phỏng**; EV lấy từ issue đóng thật, AC lấy từ `docs/pm/timelog.csv` thật. Đề bài cho phép giả định độ trễ nếu số thật không đẹp — nhưng phải ghi rõ giả định.

**Nguyên tắc: code trước, tài liệu sinh từ code.** ERD từ Prisma schema, DDL từ `prisma/migrations/*.sql`, API spec export từ Swagger, Class Diagram vẽ từ entity thật, backlog = GitHub Issues thật. Không viết tài liệu hai lần.

## 1. Phạm vi nghiệp vụ

**Actor:** `Reader` (bạn đọc — gồm `STUDENT` và `LECTURER`), `Librarian` (thủ thư), `Admin` (quản trị).

**Chức năng bắt buộc (MVP)** — bám đúng 5 module đề 8 nêu + AI:

| # | Module (theo đề) | Chức năng |
|---|---|---|
| 1 | Nền tảng | Đăng ký (→ Reader, tự chọn member_type + mã SV/GV), đăng nhập JWT, RBAC 3 role |
| 2 | **Quản lý sách** | CRUD sách, tác giả (n-n), thể loại, **bản sao vật lý** (barcode, trạng thái, vị trí kệ), giá sách |
| 3 | **Quản lý bạn đọc** | Librarian: danh sách bạn đọc, xem hồ sơ + lịch sử mượn, khoá/mở thẻ, sửa member_type. Admin: tạo tài khoản Librarian |
| 4 | **Mượn / trả** | Librarian tạo phiếu mượn tại quầy (barcode + mã bạn đọc), trả, gia hạn (Reader tự làm), báo mất, phạt, ghi nhận thanh toán |
| 5 | **Tìm kiếm** | Theo tiêu đề / tác giả / thể loại / ISBN, lọc còn sách, phân trang |
| 6 | **Báo cáo / thống kê** | Sách mượn nhiều, bạn đọc quá hạn, lượt mượn theo tháng, tồn kho theo thể loại |
| 7 | Đánh giá | Reader chấm 1-5 sao sách đã từng mượn (nuôi AI) |
| 8 | Cấu hình | Admin sửa **chính sách mượn** theo member_type qua UI |
| 9 | **AI** | Gợi ý sách cho từng bạn đọc + dự báo nguy cơ trả trễ khi cho mượn |

**Chính sách mượn** (bảng `loan_policies`, Admin sửa được; số dưới là mặc định giả định):

| member_type | Tối đa | Hạn | Gia hạn | Phạt trễ |
|---|---|---|---|---|
| STUDENT | 3 cuốn | 14 ngày | 1 lần, +7 ngày | 5.000đ/ngày |
| LECTURER | 5 cuốn | 30 ngày | 1 lần, +14 ngày | 5.000đ/ngày |

**Quy tắc nghiệp vụ** (đây là thứ để unit test đạt 80%):

- Chỉ Reader mượn. **Librarian tạo loan** tại quầy; Reader không tự tạo.
- Không được mượn nếu: đã đủ số cuốn theo policy, đang có sách quá hạn, còn phạt chưa trả, thẻ bị khoá, copy không `AVAILABLE`.
- Gia hạn: tối đa `renew_limit` lần, chỉ khi chưa quá hạn, không có phạt chưa trả.
- Quá hạn là **trạng thái suy ra**: `returned_at IS NULL AND due_at < now()`. Không lưu `OVERDUE`, không cần cron.
- Trả: phạt = số ngày trễ × `fine_per_day` (tạo bản ghi `fines` loại `OVERDUE` nếu > 0). Copy → `AVAILABLE`.
- Báo mất: loan → `LOST`, copy → `LOST`, phạt loại `LOST` = `books.price` + phạt trễ tính đến ngày báo.
- Đánh giá: chỉ khi đã có loan `RETURNED` với sách đó; 1 rating/user/sách (upsert).
- Copy: `AVAILABLE | BORROWED | LOST | MAINTENANCE`. Loan: `ACTIVE | RETURNED | LOST`.

**Yêu cầu phi chức năng** (LAB 1 chấm cái này, phải có số):

- Hiệu năng: API < 2s p95 với 1.000 sách / 2.000 người dùng; tìm kiếm < 1s.
- Bảo mật: bcrypt (cost 10), JWT HS256 hết hạn 1 ngày, RBAC guard trên mọi route ghi, class-validator trên mọi DTO, rate limit đăng nhập 10 req/phút, CORS whitelist.
- Khả dụng: mục tiêu 99% (ghi thật: Render free ngủ sau 15' nên không đảm bảo 99.9%).
- Khả dụng sử dụng: responsive ≥ 360px, thao tác mượn/trả ≤ 3 click.
- Bảo trì: coverage ≥ 80% lớp nghiệp vụ, CI xanh mới merge.

**Không làm** (SRS mục "Out of scope"): đặt trước sách, thanh toán online, email/SMS, app mobile, refresh token, in thẻ/mã vạch.

## 2. Kiến trúc & stack

```
[Browser] → Next.js 15 (Vercel)
                │ REST/JSON
                ▼
         NestJS API  ← API Gateway vai trò, JWT, Swagger        (Render)
           │  ├──REST──▶ AI Service: FastAPI + sklearn          (Render)
           │  │            └──GET /internal/training-data──┐
           │  └──HTTPS──▶ Google Books API (lúc seed)      │  ← tích hợp bên ngoài
           ▼                                               │
        PostgreSQL 16 (Neon)  ◀────────────────────────────┘ (qua BE, AI không chạm DB)
```

| Thành phần | Công nghệ | Lý do |
|---|---|---|
| Frontend | Next.js 15 (App Router), TypeScript, TailwindCSS, shadcn/ui, TanStack Query + Axios, Recharts | đúng gợi ý LAB 3, biểu đồ cho thống kê |
| Backend | NestJS 10, Prisma ORM, PostgreSQL 16, Passport-JWT, class-validator, @nestjs/swagger, Jest | Controller-Service-Repository; global exception filter + format lỗi thống nhất `{statusCode, message, error, path, timestamp}` |
| AI service | FastAPI, scikit-learn, pandas, pytest-cov | tách service riêng đúng LAB 3; lấy dữ liệu train qua BE, **không kết nối DB** |
| Database | **Neon** free (Postgres serverless) | không hết hạn 30 ngày như Render Postgres, không cần thẻ |
| Dữ liệu ngoài | **Google Books API** lúc seed | goodbooks-10k không có description/publisher/category → lấy theo ISBN; là hộp "tích hợp bên ngoài" trong sơ đồ LAB 2 |
| Local | docker-compose: postgres + backend + ai + frontend + **nginx** (gateway port 80) | `docker compose up` là chạy hết |
| CI/CD | GitHub Actions `.github/workflows/ci-cd.yml` | test + coverage mỗi push/PR; merge main → deploy |
| Deploy | Vercel (FE) + Render free (BE, AI) + Neon (DB) | không cần thẻ |
| Tài liệu | PlantUML (`.puml` → PNG bằng Docker); báo cáo LAB điền vào `.docx` mẫu bằng python-docx; báo cáo PM viết Markdown → pandoc → Word | UML là text, diff được |

**Lưu ý vận hành:**

- Render free ngủ sau 15', lần đầu gọi ~50s. Trước demo phải đánh thức. Ghi vào hạn chế.
- Gọi AI `/predict-overdue` khi tạo loan phải có **timeout 2s + fallback** (`risk: null`) — không được để cold start chặn thao tác cho mượn.
- Model AI **train lại lúc khởi động** (vài giây với 1k sách × 2k user), cache `.joblib` trong `/tmp`; không commit binary. `POST /train` để train lại thủ công.
- Nginx gateway chỉ có ở local; production FE gọi thẳng Render. Sơ đồ kiến trúc vẽ bản local (có gateway) và ghi chú bản cloud.
- goodbooks-10k là CC BY-SA → ghi attribution trong README và SRS.

## 3. Cấu trúc repo (monorepo)

```
university-library-system/
├── backend/                 NestJS
│   ├── prisma/schema.prisma, migrations/, seed/{index.ts, goodbooks.ts, google-books.ts, simulate-loans.ts}
│   └── src/
│       ├── common/          exception filter, guards, decorators
│       └── modules/{auth,users,books,authors,categories,copies,loans,fines,ratings,policies,reports,recommendations,internal}
├── frontend/                Next.js
│   └── src/app/{(auth),books,my-loans,my-fines,recommendations,librarian/{loans,readers,copies},reports,admin/{users,policies}}
├── ai-service/              FastAPI
│   ├── app/{main.py, data_client.py, recommender.py, overdue_model.py, train.py}
│   └── tests/
├── gateway/nginx.conf
├── docs/
│   ├── srs/SRS.md            → xuất .docx
│   ├── uml/*.puml + *.png    use-case, class, sequence×3, activity, architecture
│   ├── erd/                  sinh từ prisma + DDL từ migrations
│   ├── api/openapi.json      export từ Swagger
│   ├── pm/                   PM plan (Word) + WBS_Schedule_EVA.xlsx + slides + timelog.csv
│   └── report/               Báo cáo 4 LAB (điền vào mẫu .docx)
├── .github/workflows/ci-cd.yml
├── docker-compose.yml
└── README.md
```

Tên repo, thư mục, file, hàm, biến: **tiếng Anh**. Nội dung tài liệu: tiếng Việt.

## 4. Mô hình dữ liệu (ERD 3NF)

```
users(id, email, password_hash, full_name, role[READER|LIBRARIAN|ADMIN],
      member_type[STUDENT|LECTURER]?, member_code?, is_active, created_at)
loan_policies(id, member_type UNIQUE, max_books, loan_days, renew_limit, renew_extra_days, fine_per_day)
authors(id, name)
categories(id, name, slug)
books(id, isbn, title, description, publisher, published_year, price, cover_url,
      category_id→categories, goodbooks_id?, created_at)
book_authors(book_id→books, author_id→authors)                       ← n-n
book_copies(id, book_id→books, barcode UNIQUE, status, shelf_location)
loans(id, copy_id→book_copies, user_id→users, created_by→users(librarian),
      borrowed_at, due_at, returned_at?, renewed_count, status[ACTIVE|RETURNED|LOST],
      predicted_overdue_risk?)                                        ← lưu để thống kê độ đúng của AI
fines(id, loan_id→loans, type[OVERDUE|LOST], amount, paid_at?, paid_to→users?, created_at)
ratings(id, user_id→users, book_id→books, score 1-5, created_at, UNIQUE(user_id, book_id))
```

Đủ 1-n, n-n, khóa chính/ngoại, 3NF. DDL minh hoạ lấy từ `prisma/migrations`.

## 5. API chính (đặc tả đầy đủ sinh từ Swagger)

| Module | Endpoint | Role |
|---|---|---|
| auth | `POST /auth/register`, `POST /auth/login`, `GET /auth/me` | public / all |
| users | `GET /users?q=&role=`, `GET /users/:id`, `GET /users/:id/loans`, `PATCH /users/:id` (lock, member_type) | Librarian/Admin |
| users | `POST /users` (tạo Librarian/Admin) | Admin |
| books | `GET /books?q=&category=&author=&available=&page=`, `GET /books/:id`, `POST/PATCH/DELETE /books/:id` | all / Librarian |
| authors, categories | `GET`, `POST`, `PATCH`, `DELETE` | all / Librarian |
| copies | `GET /books/:id/copies`, `POST /books/:id/copies`, `PATCH /copies/:id` (status, shelf) | Librarian |
| loans | `POST /loans` {barcode, memberCode} → kèm `overdueRisk`, `POST /loans/:id/return`, `POST /loans/:id/report-lost`, `GET /loans?status=&overdue=true&page=` | Librarian |
| loans | `GET /loans/me`, `POST /loans/:id/renew` | Reader |
| fines | `GET /fines/me` | Reader |
| fines | `GET /fines?paid=false`, `POST /fines/:id/pay` | Librarian |
| ratings | `POST /books/:id/ratings` {score}, `GET /books/:id/ratings/summary` | Reader / all |
| policies | `GET /policies`, `PATCH /policies/:memberType` | all / Admin |
| reports | `GET /reports/top-books`, `/reports/overdue`, `/reports/loans-by-month`, `/reports/inventory` | Librarian/Admin |
| recommendations | `GET /recommendations/me` → AI `/recommend` | Reader |
| internal | `GET /internal/training-data` (header `X-Internal-Key`) | AI service |
| AI service | `GET /recommend?user_id=&k=10`, `POST /predict-overdue`, `POST /train`, `GET /health`, `GET /metrics` | internal |

Mọi lỗi trả format thống nhất qua global exception filter; lỗi nghiệp vụ dùng mã rõ ràng (`LOAN_LIMIT_REACHED`, `HAS_OVERDUE_LOAN`, `UNPAID_FINE`, `COPY_NOT_AVAILABLE`, `ACCOUNT_LOCKED`, `RENEW_LIMIT_REACHED`…) — vừa là checklist "Exception Handling tốt" của LAB 3, vừa là tên test case.

## 6. Dữ liệu seed & Module AI/ML (LAB 3)

**Seed (`backend/prisma/seed/`):**

1. goodbooks-10k → chọn 1.000 sách phổ biến nhất có ISBN, ~2.000 user, ratings của họ.
2. Gọi **Google Books API** theo ISBN → `description`, `publisher`, `categories` (map về ~15 thể loại), `price` giả định theo số trang. Cache JSON vào `seed/cache/` để không gọi lại (giới hạn 1.000 req/ngày).
3. Mỗi sách 1-3 copy, barcode `LIB-000001…`.
4. `simulate-loans.ts`: rating ≥ 4 ⇒ đã mượn. **Sinh nhãn trả trễ bằng xác suất, không bằng rule cứng**: base 15%, +8% mỗi cuốn đang mượn cùng lúc, +15% nếu tháng thi (1, 6), +10% nếu đã từng trễ, ±nhiễu; ngày trả trễ ~ 1-20 ngày. Ghi rõ trong báo cáo: **dữ liệu mượn/trả là mô phỏng**, nên metric mô hình 2 phản ánh quy luật mô phỏng.
5. Tài khoản demo: 1 admin, 2 librarian, vài reader STUDENT/LECTURER với mật khẩu cố định ghi trong README.

**Mô hình 1 — Gợi ý sách (hybrid):**

- Content-based: TF-IDF trên `title + authors + category + description` → cosine similarity
- Item-based collaborative filtering trên ma trận user×book (ratings + loans)
- Trộn 0.5/0.5, cold-start (user chưa có lịch sử) → sách mượn nhiều nhất trong thể loại người đó đã xem, hoặc toàn hệ thống
- **Đo:** Precision@5 / Recall@5 trên hold-out (giấu 20% loans mỗi user) — con số ghi vào báo cáo

**Mô hình 2 — Dự báo trả trễ:**

- Feature: số lần quá hạn trước đó, tỉ lệ quá hạn, số sách đang mượn, member_type, thể loại, số ngày hạn, tháng mượn
- Logistic Regression vs Random Forest, chọn cái tốt hơn
- **Đo:** Accuracy, Precision, Recall, F1, ROC-AUC trên 20% test — bảng so sánh 2 mô hình trong báo cáo
- Dùng: khi thủ thư cho mượn, UI hiện badge "Nguy cơ trả trễ: 72%"; lưu vào `loans.predicted_overdue_risk` để sau đối chiếu

**Luồng dữ liệu:** AI gọi `GET /internal/training-data` của BE (loans, ratings, books, users.member_type) khi khởi động và khi `POST /train`. Model train xong giữ trong bộ nhớ + `.joblib` ở `/tmp`.

## 7. Kiểm thử & coverage ≥ 80%

| Tầng | Công cụ | Nội dung |
|---|---|---|
| Backend unit | Jest, mock Prisma | `LoansService` (mọi quy tắc mục 1 — mỗi mã lỗi một test), `FinesService`, `RatingsService`, `PoliciesService`, `AuthService`, `ReportsService` — threshold 80% trong `jest.config` cho `**/*.service.ts` |
| Backend e2e | Jest + supertest + **Postgres thật** (service container trong CI) | mượn → gia hạn → trả trễ → phạt → thanh toán; báo mất; chứng minh SQL/Prisma chạy thật |
| AI | pytest-cov, threshold 80% | recommender, feature engineering, endpoint, fallback khi BE không trả dữ liệu |
| Frontend | ESLint + `next build` trong CI; vài test Vitest cho util | không tính coverage (yêu cầu chỉ tính lớp nghiệp vụ) |

Ảnh coverage (Jest HTML + pytest-cov) chụp vào báo cáo LAB 4. Mỗi test phải được thấy **đỏ trước khi xanh** (gỡ rule → test fail đúng lý do).

## 8. CI/CD

`ci-cd.yml` — 3 job song song khi push/PR: `backend` (lint, unit, e2e với postgres service, coverage artifact), `ai-service` (pytest-cov), `frontend` (lint, build).
Job `deploy` chỉ chạy khi merge `main`: gọi Render Deploy Hook cho BE + AI (Render build từ Dockerfile trong repo); Vercel tự deploy qua GitHub integration. Không cần đẩy image lên GHCR.

**Git flow (cũng là "quản lý cấu hình" cho báo cáo PM):** `main` bảo vệ, nhánh `feat/*`, PR bắt buộc CI xanh, Conventional Commits, tag `v0.1.0 … v1.0.0` cuối mỗi sprint. Làm việc trong worktree riêng, chỉ push khi được bảo.

## 9. Lịch thật theo sprint (8 tuần, bám LAB)

| Sprint | Tuần | Code | Tài liệu | Tag |
|---|---|---|---|---|
| **0** | tuần này | Scaffold monorepo, Prisma schema, Neon, docker-compose lên với `/health` 3 service, CI skeleton xanh, exception filter, **timelog.csv bắt đầu ghi** | README, 18-20 US lên GitHub Projects (gắn mã WBS) | `v0.1.0` |
| **1** | 1-2 | Auth + roles, Books/Authors/Categories/Copies CRUD, Users (quản lý bạn đọc), Policies, seed goodbooks + Google Books | **LAB 1:** SRS IEEE 830 (có NFR số cụ thể). **LAB 2:** Use Case, ERD + DDL, kiến trúc, API spec v1 | `v0.2.0` |
| **2** | 3-4 | Loans/Fines/Ratings/Reports + unit + e2e ≥80%; FE: login, danh sách sách, chi tiết, trang mượn của tôi, trang thủ thư (cho mượn, trả, bạn đọc), admin policies | **LAB 2:** Class + 3 Sequence (Mượn kèm AI, Trả + phạt, Gợi ý) + Activity (Mượn sách). **PM:** SOW, WBS, ước lượng, CPM, Gantt — dựng sớm để có PV cho EVA | `v0.3.0` |
| **3** | 5-6 | AI service: data client, 2 mô hình, metrics; BE gọi AI (timeout/fallback); FE: trang gợi ý, badge nguy cơ trễ, dashboard biểu đồ | **LAB 3:** kết quả, accuracy, snippet, ảnh UI. **PM:** rủi ro, RACI, chất lượng, tài chính | `v0.4.0` |
| **4** | 7-8 | Deploy Render + Vercel + Neon, CI/CD deploy job, chỉnh coverage, fix bug | **LAB 4** + điền mẫu .docx. **PM:** EVA từ timelog + issues, Excel, slide, hoàn thiện Word | `v1.0.0` |

Với 1-2 người: sprint 1-2 nặng nhất; khung + test dựng trước, người còn lại điền tài liệu và làm UI. Phần PM được rải từ sprint 2 (không dồn hết vào sprint 4 như bản 1) vì WBS/PV phải có trước thì EVA mới đo được.

## 10. Báo cáo Quản lý Dự án (sản phẩm B) — dự án mô phỏng 16 tuần, 4 người

1. **SOW:** mục tiêu SMART, stakeholder (Ban GĐ thư viện, thủ thư, sinh viên, giảng viên, phòng CNTT, GVHD), giả định (16 tuần, 4 người bán thời gian ~10h/tuần/người, hạ tầng free-tier, dữ liệu sách có sẵn ISBN) / ràng buộc (ngân sách, hạn cuối kỳ, không có thẻ thanh toán)
2. **WBS 3 cấp** — cấp 1 theo pha: 1 Khởi tạo → 2 Phân tích → 3 Thiết kế → 4 Phát triển → 5 Kiểm thử → 6 Triển khai → 7 Quản lý dự án. **Cấp 2 của pha Phát triển theo đúng 5 module đề 8 + AI**: 4.1 Quản lý sách, 4.2 Quản lý bạn đọc, 4.3 Mượn/trả, 4.4 Tìm kiếm, 4.5 Báo cáo, 4.6 AI, 4.7 Tích hợp. Cấp 3 = BE/FE của từng module. Ước lượng giờ công từng work package (3-point PERT), tổng ~600-700 giờ. Mỗi GitHub Issue gắn mã WBS.
3. **CPM:** ~18-20 hoạt động, phụ thuộc FS/SS, bảng ES/EF/LS/LF/Slack, đường găng dự kiến: Phân tích → Schema → Mượn/trả BE → Tích hợp AI → Test → Deploy. Sơ đồ mạng (PlantUML/draw.io) + **Gantt** (sheet Excel).
4. **8 rủi ro** — kỹ thuật: Render free ngủ khi demo, Google Books thiếu dữ liệu/rate limit, model accuracy thấp, coverage không đạt, scope creep; nghiệp vụ thư viện: dữ liệu sách nhập sai/thiếu ISBN, thủ thư không chịu chuyển sang hệ thống mới, mất dữ liệu seed. Ma trận xác suất×tác động + ứng phó từng rủi ro.
5. **Nguồn lực:** **org chart** nhóm 4 vai trò (PM/Scrum Master-Fullstack, Backend, Frontend, AI) + **RACI** vai trò × work package.
6. **Chất lượng:** Unit/Integration/System/UAT, milestone = 5 tag release, tiêu chí = checklist trong file LAB + coverage 80%.
7. **Tài chính:** chi phí = giờ công × 50.000đ + hạ tầng (0đ free-tier, ghi phương án trả phí); lợi ích = giờ thủ thư tiết kiệm/năm × đơn giá + giảm thất thoát sách; NPV 3 năm r=10%, ROI, Payback.
8. **EVA (đặc thù đề 8):** 16 tuần mô phỏng = 8 tuần thật (1:2). PV theo WBS + lịch. Tại 4 mốc báo cáo (tuần 4/8/12/16 mô phỏng = tuần 2/4/6/8 thật): EV = % hoàn thành WP theo issue đóng × PV của WP; AC = giờ trong `timelog.csv` × 50.000đ. Tính SV/CV/SPI/CPI/EAC/ETC/VAC, biểu đồ đường PV-EV-AC, giải thích tình trạng. Nếu số thật lệch xấu thì giữ nguyên và giải thích — đó chính là nội dung đề yêu cầu. Excel công thức dựng sẵn, chỉ điền AC/EV.
9. **Phân công:** mỗi thành viên (4 tên) phụ trách ít nhất 1 phần (Ước lượng & Lịch / Rủi ro / EVA / Kiểm thử) — ghi rõ theo yêu cầu đề.

## 11. Quyết định đã chốt (2026-09-21)

| Hạng mục | Quyết định |
|---|---|
| Đề tài | Đề 8 — Quản lý Thư viện Trường Đại học |
| Hạn nộp | Cả 2 sản phẩm cuối kỳ (~8 tuần), cùng môn |
| Nhóm | 1-2 người làm chính, 4 tên trong báo cáo |
| Backend | NestJS (Node/TypeScript) + Prisma |
| Database | **Neon** free (thay Render Postgres vì hết hạn sau 30 ngày) |
| Deploy | Vercel (FE) + Render free (BE, AI) |
| Package manager / runtime | pnpm, Node 20, Postgres 16, Python 3.12 |
| Auth | JWT access-token 1 ngày, không refresh token (ghi hạn chế) |
| Dataset | goodbooks-10k subset + **Google Books API** lúc seed (description/publisher/category) |
| Bạn đọc | **STUDENT + LECTURER**, policy riêng theo member_type |
| Tạo loan | **Librarian tại quầy**; Reader chỉ xem và gia hạn |
| Rating | Có, chỉ sách đã từng mượn |
| Sách mất | Có rule: phạt = giá sách + phạt trễ |
| Chính sách mượn | **Admin sửa qua UI** (`loan_policies`) |
| Quá hạn | Suy ra từ `due_at`, không lưu trạng thái, không cron |
| AI ↔ dữ liệu | AI lấy qua `GET /internal/training-data`, không chạm DB |
| Model | Train lại lúc khởi động, không commit `.joblib` |
| Gọi AI khi cho mượn | timeout 2s, fallback `risk: null` |
| Log giờ | `docs/pm/timelog.csv` (date, person, wbs_id, hours, note) từ Sprint 0 |
| EVA | 16 tuần mô phỏng = 8 tuần thật (1:2), EV/AC số thật |
| Ngoài MVP | Không reservation / email / thanh toán online / mobile |

## 12. Việc tiếp theo — Sprint 0

1. `git init` + repo GitHub `university-library-system`, bảo vệ `main`
2. Tạo `docs/pm/timelog.csv` — ghi giờ ngay từ việc này
3. Tạo project Neon, lấy `DATABASE_URL`; lấy Google Books API key; `.env.example` cho 3 service
4. Scaffold `backend/` (NestJS + Prisma schema mục 4 + exception filter), `frontend/` (Next.js), `ai-service/` (FastAPI)
5. `docker-compose.yml` + `gateway/nginx.conf`
6. `.github/workflows/ci-cd.yml` skeleton
7. Kiểm chứng thật: `docker compose up` → 3 endpoint `/health` trả 200 qua gateway; `prisma migrate` chạy được trên Neon
8. Tải goodbooks-10k, kiểm tra tỉ lệ sách có ISBN và tỉ lệ Google Books trả description (thử 50 cuốn) — nếu < 70% thì đổi sang Open Library bổ sung
9. Tạo 18-20 User Story trên GitHub Issues/Projects, gắn mã WBS
