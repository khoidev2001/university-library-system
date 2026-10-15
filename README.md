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
| Đăng nhập, đăng ký, quên mật khẩu | `/login`, `/register`, `/forgot-password`, `/reset-password` | Công khai |
| Tài khoản của tôi (hồ sơ, đổi mật khẩu, nhắc hạn qua email) | `/account` | Mọi vai trò |
| Sách của tôi, tiền phạt, gợi ý | `/my/loans`, `/my/fines`, `/recommendations` | Bạn đọc |
| Quầy mượn trả, quản lý bạn đọc (thêm bạn đọc, cấp mật khẩu tạm), thống kê | `/librarian/desk`, `/librarian/readers`, `/reports` | Thủ thư |
| Chính sách mượn | `/admin/policies` | Quản trị |

SEO: tiêu đề và mô tả riêng từng trang, canonical, Open Graph, dữ liệu có cấu trúc schema.org (`Library` kèm `SearchAction`, `Book` kèm `aggregateRating` và tình trạng còn sách, `FAQPage` cho trang quy định), `sitemap.xml` và `robots.txt` sinh tự động, khu vực tài khoản bị chặn khỏi chỉ mục.

Trình duyệt luôn gọi `/api` cùng origin qua gateway, không nhúng tên miền lúc build, nên một image chạy được ở mọi tên miền và cổng. Ảnh chụp màn hình trong `docs/report/screenshots/`.

## Tài khoản và email

| Chức năng | API | Giao diện |
|---|---|---|
| Hồ sơ, đổi tên, bật/tắt nhắc hạn qua email | `GET/PATCH /api/auth/me` (chỉ `fullName`, `emailReminders`) | `/account` (mọi vai trò; tên người dùng ở thanh đầu trang dẫn tới đây) |
| Đổi mật khẩu | `POST /api/auth/change-password` (5 lần/phút) | `/account` |
| Quên mật khẩu | `POST /api/auth/forgot-password` (5 lần/phút), `POST /api/auth/reset-password` (10 lần/phút) | `/forgot-password`, `/reset-password` |
| Thủ thư thêm bạn đọc tại quầy | `POST /api/users/readers` | `/librarian/readers`, nút "Thêm bạn đọc" |
| Cấp lại mật khẩu tạm (khi email không dùng được) | `POST /api/users/:id/reset-password` (thủ thư: bạn đọc; quản trị viên: mọi tài khoản) | `/librarian/readers`, `/admin/users` |

- **Chính sách mật khẩu** dùng chung cho đăng ký, đổi và đặt lại: 8 đến 72 byte, mật khẩu mới phải khác mật khẩu hiện tại.
- **Quên mật khẩu**: luôn trả 200 cùng một nội dung dù email có tồn tại hay không (và san phẳng thời gian phản hồi), tài khoản bị khoá không nhận thư, cách nhau tối thiểu 60 giây mỗi tài khoản. Token là 32 byte ngẫu nhiên, **chỉ lưu SHA-256**, hạn 1 giờ, dùng một lần; xin token mới hoặc dùng xong thì token cũ hết hiệu lực. Đặt lại thành công thì mọi phiên đăng nhập cũ bị thu hồi.
- **Mật khẩu tạm** (thủ thư tạo bạn đọc / cấp lại): sinh ngẫu nhiên 12 ký tự, trả đúng **một lần** (có nút sao chép và in phiếu), tài khoản mang cờ `mustChangePassword`. Cờ này hiện ở `GET /api/auth/me` và backend trả `403 PASSWORD_CHANGE_REQUIRED` cho mọi API khác (trừ `/auth/me`, `/auth/change-password`) cho tới khi đổi mật khẩu; giao diện tự chuyển tới `/account`.
- **Nhắc hạn qua email**: cùng lịch với thông báo trong web (mỗi 15 phút), gộp các phiếu cùng loại của một bạn đọc thành một thư. Mỗi phiếu và loại (sắp hạn / quá hạn) chỉ gửi **một lần thành công** (bảng `reminder_emails`, duy nhất theo phiếu + loại); gửi lỗi thì thử lại ở lượt sau, tối đa 5 lần. Bạn đọc tắt được tại `/account`.

### Cấu hình gửi email (Resend)

Backend gửi thư bằng HTTP tới Resend (Render gói miễn phí chặn SMTP). **Không có `RESEND_API_KEY` thì mọi việc gửi thư bị bỏ qua có ghi log, ứng dụng vẫn chạy bình thường**; khi đó dùng chức năng cấp mật khẩu tạm của thủ thư.

1. Tạo tài khoản ở resend.com, tạo API key (quyền "Sending access").
2. Thử nhanh: để `MAIL_FROM` trống (mặc định `onboarding@resend.dev`, chỉ gửi được tới email chủ tài khoản Resend). Chạy thật: thêm và xác minh tên miền ở Resend (bản ghi SPF/DKIM) rồi đặt `MAIL_FROM`, ví dụ `Thư viện MUCE <no-reply@ten-mien.vn>`.
3. Đặt biến môi trường cho backend:

| Biến | Ý nghĩa |
|---|---|
| `RESEND_API_KEY` | API key Resend; bỏ trống = tắt gửi thư |
| `MAIL_FROM` | Người gửi (tên miền đã xác minh) |
| `APP_PUBLIC_URL` | Địa chỉ công khai của web, dùng dựng `${APP_PUBLIC_URL}/reset-password?token=...` (mặc định: mục đầu của `CORS_ORIGINS`) |
| `RESEND_API_URL` | Chỉ để thử: trỏ tới máy chủ Resend giả (mặc định `https://api.resend.com/emails`) |
| `MAIL_SEND_INTERVAL_MS` | Nghỉ giữa hai thư nhắc hạn, mặc định 600 ms (Resend giới hạn 2 yêu cầu/giây) |

Khi test, e2e luôn thay cổng gửi thư bằng hộp thư trong bộ nhớ (`InMemoryMailSender`), không bao giờ gọi Resend.

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

## Thanh toán phạt trực tuyến (VNPay)

Bạn đọc trả tiền phạt tại `/my/fines` qua cổng VNPay (v2.1.0, ký HMAC-SHA512), kết quả hiện ở `/my/payments/result`. Số tiền luôn do backend tính lại từ các khoản phạt trong DB; client chỉ gửi danh sách `fineIds` (bỏ trống = tất cả khoản chưa trả). Nộp tiền mặt tại quầy vẫn dùng như cũ.

| Endpoint | Việc |
|---|---|
| `GET /api/payments/config` | Cổng đã bật chưa (`online`), hạn mức, thời hạn giữ chỗ |
| `POST /api/payments` (READER) | Tạo giao dịch PENDING, trả `{paymentUrl, paymentId, txnRef, amount}`; 503 `PAYMENT_NOT_CONFIGURED` nếu thiếu cấu hình |
| `GET /api/payments/me`, `GET /api/payments/:id` | Lịch sử của tôi; chi tiết (chủ giao dịch hoặc thủ thư) |
| `POST /api/payments/:id/cancel` | Huỷ giao dịch đang chờ (chủ giao dịch hoặc thủ thư) |
| `GET /api/payments/vnpay/ipn` | IPN, VNPay gọi máy chủ: nguồn xác nhận chính thức, trả `{RspCode, Message}` (00, 01, 02, 04, 97, 99) |
| `GET /api/payments/vnpay/return` | Trình duyệt quay về; xác minh chữ ký rồi chuyển hướng tới `${APP_PUBLIC_URL}/my/payments/result` |

Quy tắc nghiệp vụ:

- **Một khoản phạt chỉ thuộc tối đa một giao dịch đang chờ hoặc đã trả**: chỉ mục duy nhất từng phần `payment_fines_active_fine_key`, cộng khoá dòng `FOR UPDATE` khi tạo giao dịch, thu tiền mặt và xử lý IPN.
- Giao dịch hết hạn sau **15 phút** (cũng là `vnp_ExpireDate`); khoản phạt được nhả khi có ai đụng tới, và bộ lập lịch quét mỗi 15 phút.
- **Thu tiền mặt bị chặn** (`409 FINE_PAYMENT_PENDING`) khi khoản phạt đang nằm trong giao dịch chờ còn hạn, vì bạn đọc có thể đang nhập OTP. Thủ thư bấm "Huỷ giao dịch chờ" (hoặc đợi hết hạn) rồi mới thu tiền mặt.
- IPN thành công đặt `fines.paid_at` (với `paid_to = NULL`, phân biệt với thu tiền mặt có `paid_to` = thủ thư) và giao dịch `PAID` trong **một** transaction. IPN lặp trả `02`. Số tiền (`vnp_Amount / 100`) phải khớp số đã lưu, sai trả `04`.
- Tiền về muộn (giao dịch đã hết hạn, bị huỷ hoặc ghi hỏng): nếu khoản phạt còn trống thì nhận tiền; nếu khoản phạt đã được thu cách khác thì **không** thu hai lần, giao dịch giữ nguyên trạng thái và gắn `needsRefund = true` (thủ thư hoàn tiền thủ công trên cổng VNPay), IPN vẫn trả `00` để VNPay ngừng gọi lại.
- `vnp_ReturnUrl` cũng chốt giao dịch (qua cùng hàm idempotent với IPN, chỉ khi chữ ký đúng và số tiền khớp) vì sandbox thường không gọi được IPN. Chuyển hướng chỉ tới `APP_PUBLIC_URL`, không bao giờ theo tham số do người dùng gửi.
- Mỗi giao dịch tối thiểu 5.000đ (yêu cầu của VNPay), tối đa 999.999.999đ.

### Cấu hình

| Biến | Bắt buộc | Ý nghĩa |
|---|---|---|
| `VNPAY_TMN_CODE` | có | Mã website (Terminal ID) VNPay gửi qua email |
| `VNPAY_HASH_SECRET` | có | Khoá bí mật ký HMAC. Không ghi vào log hay commit |
| `VNPAY_URL` | không | Mặc định `https://sandbox.vnpayment.vn/paymentv2/vpcpay.html`; môi trường thật dùng địa chỉ VNPay cấp |
| `APP_PUBLIC_URL` | có | Địa chỉ web công khai (Vercel), không có `/` cuối |
| `VNPAY_RETURN_URL` | không | Mặc định `${APP_PUBLIC_URL}/api/payments/vnpay/return` |

Thiếu `VNPAY_TMN_CODE` hoặc `VNPAY_HASH_SECRET` thì tính năng tắt: giao diện ẩn nút và báo "chưa được bật", thu tiền mặt không bị ảnh hưởng.

### Đăng ký sandbox và triển khai

1. Đăng ký tại <http://sandbox.vnpayment.vn/devreg/>. VNPay gửi email gồm `TmnCode`, `HashSecret` và địa chỉ trang quản trị merchant sandbox.
2. **Render** (`uls-backend`): thêm `VNPAY_TMN_CODE`, `VNPAY_HASH_SECRET` (secret), `APP_PUBLIC_URL` = địa chỉ Vercel. Sửa biến xong phải "Deploy latest commit". **Vercel** không cần biến mới: `/api/*` đã được rewrite sang Render nên return URL mặc định là `https://<vercel>/api/payments/vnpay/return`.
3. Trong trang quản trị merchant sandbox, khai báo **IPN URL** là địa chỉ backend công khai `https://<render>/api/payments/vnpay/ipn` (nên trỏ thẳng Render, không qua Vercel). Không có IPN thì return URL vẫn chốt giao dịch khi bạn đọc quay về; nếu họ đóng tab trước khi quay về, giao dịch chỉ được chốt khi IPN tới.
4. Chạy thử bằng thẻ test của VNPay (ngân hàng **NCB**, theo tài liệu sandbox; môi trường test chỉ nhận các thẻ trong danh sách):

| Tình huống | Số thẻ | Tên chủ thẻ | Ngày phát hành | OTP |
|---|---|---|---|---|
| Thành công | `9704198526191432198` | NGUYEN VAN A | 07/15 | `123456` |
| Không đủ số dư | `9704195798459170488` | | | |
| Thẻ chưa kích hoạt | `9704192181368742` | | | |
| Thẻ bị khoá | `9704193370791314` | | | |
| Thẻ hết hạn | `9704194841945513` | | | |

### Thử cục bộ không cần VNPay

Chạy backend với `VNPAY_TMN_CODE=DEMO`, `VNPAY_HASH_SECRET=bi-mat-cuc-bo`, `APP_PUBLIC_URL=http://localhost:8080`. Bấm thanh toán sẽ chuyển sang VNPay sandbox và báo lỗi mã website (đúng như mong đợi vì `DEMO` không tồn tại). Để mô phỏng việc VNPay gọi về, dùng script tự ký:

```bash
VNPAY_HASH_SECRET=bi-mat-cuc-bo pnpm --dir backend vnpay:callback <txnRef> <số-tiền-VND> 00 return http://localhost:8080
# 00 = thành công, 24 = bạn đọc huỷ, 51 = không đủ số dư; đổi `return` thành `ipn` để gọi IPN bằng curl
```

**Chưa kiểm chứng với VNPay thật:** chữ ký tạo URL đã được đối chiếu với HMAC-SHA512 tính độc lập bằng Python (`vnpay.util.spec.ts`), nhưng tài liệu VNPay không công bố bộ vector kiểm thử, nên cần một lần chạy thật trên sandbox bằng `TmnCode` thật trước khi dùng.

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
