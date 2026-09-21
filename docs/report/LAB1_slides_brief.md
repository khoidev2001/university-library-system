# Brief làm slide thuyết trình LAB 1 — Hệ thống Quản lý Thư viện Trường Đại học

> Dán toàn bộ file này cho AI làm slide (Gamma, Canva AI, ChatGPT + pptx, …). Mọi nội dung bên dưới lấy từ `docs/srs/SRS.md` — nếu AI cần chi tiết hơn, dán thêm SRS.md.

## 1. Bối cảnh trình bày

| | |
|---|---|
| Buổi | Thuyết trình LAB 1 — Phân tích yêu cầu & Đặc tả phần mềm (SRS), môn Công nghệ Phần mềm |
| Người nghe | Cả lớp + giảng viên (TS. Lê Tỷ Khánh) |
| Thời lượng | 15–20 phút trình bày + hỏi đáp |
| Số slide | 15 slide (≈1 phút/slide) |
| Ngôn ngữ | Tiếng Việt; thuật ngữ kỹ thuật giữ tiếng Anh (User Story, Acceptance Criteria, JWT…) |
| Tỉ lệ | 16:9 |
| Người trình bày | Nhóm [Số nhóm]: [Họ tên SV 1], [Họ tên SV 2], [Họ tên SV 3], [Họ tên SV 4] |

**Giảng viên chấm LAB 1 theo 4 tiêu chí** — slide phải cho thấy rõ từng tiêu chí đã đạt:

1. Danh sách Actor đầy đủ (chính + phụ)
2. Product Backlog tối thiểu 15–20 User Story có Acceptance Criteria rõ ràng
3. SRS đủ 3 phần chính theo IEEE 830
4. Yêu cầu phi chức năng có chỉ số đo được (response time < 2s, uptime, bảo mật)

## 2. Yêu cầu thiết kế

- Phong cách: học thuật, sạch, ít chữ trên mỗi slide; ưu tiên bảng, thẻ (card), con số lớn thay vì bullet dài.
- Bảng màu gợi ý: nền sáng `#F7F5F0`, nền phụ `#ECE8DF`, chữ đậm `#1B2A41` (navy), nhấn 1 `#C8553D` (đất nung), nhấn 2 `#2E7D6B` (xanh lục), vàng nhạt cho tiêu đề trên nền tối `#E8B86D`.
- Font: tiêu đề serif (Libre Baskerville / Georgia), nội dung sans (Public Sans / Arial). Chữ nhỏ nhất 24px (≈18pt).
- Mỗi slide có footer: `LAB 1 · SRS — Quản lý Thư viện ĐH · n/15`.
- Slide 1 và slide 15 nền tối (`#1B2A41`), còn lại nền sáng.
- Không dùng ảnh stock; nếu cần hình thì dùng icon đơn giản (sách, người dùng, bánh răng).
- **Biểu đồ có sẵn** (chèn nguyên ảnh, không vẽ lại): `docs/uml/actor-hierarchy.png` (slide 4), `docs/uml/use-case-overview.png` (slide 5 — ảnh cao, đặt bên trái, bảng bên phải hoặc tách thành slide riêng), `docs/uml/system-context.png` (slide 13).

## 3. Nội dung từng slide

### Slide 1 — Bìa (nền tối)

- Eyebrow: `LAB 01 · Phân tích yêu cầu & Đặc tả phần mềm (SRS)`
- Tiêu đề: **Hệ thống Quản lý Thư viện Trường Đại học**
- Phụ đề: `Đề tài 8 — Actor · Product Backlog · SRS chuẩn IEEE 830`
- Dòng dưới: Nhóm [Số nhóm] — 4 họ tên · Môn Công nghệ Phần mềm · GVHD: TS. Lê Tỷ Khánh · Khoa CNTT, ĐH Xây dựng Miền Trung · 22/09/2026
- *Ghi chú nói:* Chào thầy và các bạn. Nhóm trình bày kết quả LAB 1: xác định actor, lập product backlog và viết SRS cho đề tài 8. Khoảng 15 phút, sau đó nhận câu hỏi.

### Slide 2 — Bài toán & mục tiêu

Tiêu đề: **Thư viện đang chạy bằng sổ tay và bảng tính**

Hai cột:

| Hiện trạng | Mục tiêu hệ thống ULS |
|---|---|
| Tra cứu sách chậm, không biết cuốn nào còn trên kệ | Cho mượn tại quầy bằng mã vạch trong ≤ 30 giây |
| Tính phạt quá hạn bằng tay — dễ sai, dễ bỏ sót | Tự tính phạt, tự chặn mượn khi vi phạm quy định |
| Không có số liệu: sách nào mượn nhiều, ai đang quá hạn | Bạn đọc tự tra cứu, gia hạn, xem công nợ trực tuyến |
| Bạn đọc phải đến quầy cho mọi việc, kể cả gia hạn | Dashboard thống kê + AI gợi ý sách, dự báo trả trễ |

- *Ghi chú nói:* Mỗi mục tiêu đều có kết quả đo được — đây là cơ sở cho yêu cầu phi chức năng ở phần sau.

### Slide 3 — Phạm vi

Tiêu đề: **Làm gì, và cố ý không làm gì**

Bảng trong phạm vi (10 nhóm chức năng):

| Mã | Nhóm chức năng | Nội dung chính |
|---|---|---|
| F1 | Xác thực & phân quyền | Đăng ký, đăng nhập JWT, 3 vai trò |
| F2 | Quản lý sách | Đầu sách, tác giả, thể loại, bản sao có mã vạch |
| F3 | Quản lý bạn đọc | Hồ sơ, lịch sử, khoá/mở thẻ |
| F4 | Mượn – trả | Mượn, trả, gia hạn, báo mất, phạt, thu tiền |
| F5 | Tìm kiếm | Tiêu đề / tác giả / thể loại / ISBN, phân trang |
| F6 | Thống kê | Top sách, quá hạn, lượt mượn/tháng, tồn kho |
| F7–F8 | Đánh giá, cấu hình | Chấm sao; Admin sửa chính sách mượn |
| F9–F10 | AI | Gợi ý sách cá nhân hoá; dự báo trả trễ |

Cột phải "Ngoài phạm vi": Đặt trước sách · Thanh toán online · Email/SMS nhắc hạn · App mobile · In thẻ/mã vạch · Tích hợp cổng sinh viên.

- *Ghi chú nói:* Đề bài yêu cầu 5 module (sách, bạn đọc, mượn trả, tìm kiếm, thống kê) = F2–F6. Nhóm thêm F1, F7, F8 và hai chức năng AI theo yêu cầu LAB 3. Ngoài phạm vi ghi ở SRS mục 2.6 để tránh scope creep.

### Slide 4 — Actor (tiêu chí chấm số 1)

Tiêu đề: **Ba vai trò chính, quyền tăng dần**

Ba thẻ ngang:

**Reader — Bạn đọc** (STUDENT · LECTURER): Đăng ký, đăng nhập · Tìm và xem sách · Xem sách đang mượn, phạt · Tự gia hạn · Chấm sao, nhận gợi ý AI.

**Librarian — Thủ thư** (quyền Reader + nghiệp vụ quầy): CRUD sách, bản sao, danh mục · Cho mượn, nhận trả, báo mất · Ghi nhận thu phạt · Quản lý bạn đọc, khoá thẻ · Xem báo cáo, thấy dự báo AI.

**Admin — Quản trị** (quyền Librarian + cấu hình): Tạo tài khoản thủ thư · Sửa chính sách mượn · Huấn luyện lại mô hình AI.

Dòng dưới: **Actor phụ (hệ thống ngoài):** AI Service (gợi ý, dự báo) · Google Books API (mô tả sách theo ISBN khi nạp dữ liệu).

- Hình: `docs/uml/actor-hierarchy.png` đặt bên phải ba thẻ (hoặc thay ba thẻ nếu chật).
- *Ghi chú nói:* Quyền lồng nhau: Admin ⊃ Librarian ⊃ Reader (xem). Bạn đọc chia 2 loại vì chính sách mượn khác nhau. Hai actor phụ sẽ xuất hiện trong sơ đồ kiến trúc LAB 2.

### Slide 5 — Ma trận actor × chức năng

Tiêu đề: **Ai làm được gì**

| Chức năng | Reader | Librarian | Admin |
|---|---|---|---|
| Tìm kiếm, xem sách | ✓ | ✓ | ✓ |
| Xem sách đang mượn / phạt của mình, tự gia hạn, chấm sao, nhận gợi ý | ✓ | – | – |
| CRUD sách, bản sao, tác giả, thể loại | – | ✓ | ✓ |
| Cho mượn, nhận trả, báo mất, thu phạt | – | ✓ | ✓ |
| Quản lý bạn đọc, khoá/mở thẻ | – | ✓ | ✓ |
| Xem báo cáo thống kê | – | ✓ | ✓ |
| Tạo tài khoản thủ thư | – | – | ✓ |
| Sửa chính sách mượn, train lại AI | – | – | ✓ |

- Hình: `docs/uml/use-case-overview.png` — nếu ảnh quá cao thì tách thành slide 5b "Use Case tổng quan" chỉ chứa ảnh.
- *Ghi chú nói:* Bảng này là nguồn để vẽ Use Case Diagram ở LAB 2 và để viết RBAC guard ở LAB 3.

### Slide 6 — Quy tắc nghiệp vụ

Tiêu đề: **Chính sách mượn — cấu hình được, không hard-code**

Bảng chính sách mặc định:

| Loại bạn đọc | Số cuốn tối đa | Hạn mượn | Gia hạn | Phạt trễ |
|---|---|---|---|---|
| STUDENT | 3 | 14 ngày | 1 lần, +7 ngày | 5.000 đ/ngày |
| LECTURER | 5 | 30 ngày | 1 lần, +14 ngày | 5.000 đ/ngày |

Bên phải, 6 quy tắc chặn mượn/gia hạn (BR-02…BR-08):

- Đủ số cuốn → không cho mượn
- Đang có sách quá hạn → không cho mượn
- Còn phạt chưa trả → không cho mượn, không gia hạn
- Thẻ khoá hoặc bản sao không AVAILABLE → không cho mượn
- Gia hạn chỉ khi chưa quá hạn và chưa hết lượt
- Mất sách: phạt = giá bìa + phạt trễ

- *Ghi chú nói:* Số liệu là giả định, Admin đổi qua UI. "Quá hạn" là trạng thái suy ra từ ngày hạn, không lưu cứng. Mỗi quy tắc này là một test case unit test ở LAB 4 — đây là cách nhóm đạt coverage 80% ở tầng nghiệp vụ.

### Slide 7 — Product Backlog tổng quan (tiêu chí chấm số 2)

Tiêu đề: **20 User Story · 77 Story Point · 3 Sprint**

Ba con số lớn: **20** User Story · **77** điểm (Fibonacci) · **100%** có Acceptance Criteria.

Bảng phân bổ:

| Sprint | Nội dung | Story | Điểm |
|---|---|---|---|
| Sprint 1 | Auth, sách, bản sao, tìm kiếm, bạn đọc, danh mục | US01–06, 13, 14, 20 | 29 |
| Sprint 2 | Mượn/trả/gia hạn/phạt, thống kê, đánh giá, chính sách | US07–12, 15–17 | 35 |
| Sprint 3 | AI gợi ý, AI dự báo trả trễ | US18, 19 | 13 |

Dòng dưới: Backlog quản lý trên GitHub Projects — `https://github.com/khoidev2001/university-library-system` (tab Projects).

- *Ghi chú nói:* Backlog được đặt trên GitHub Projects, mỗi issue là một US kèm AC; điểm ước lượng theo Planning Poker đơn giản. Sprint 1 nặng phần nền tảng, Sprint 2 là nghiệp vụ lõi, Sprint 3 là AI.

### Slide 8 — Backlog chi tiết (1/2)

Tiêu đề: **User Story US01–US10**

| ID | User Story (rút gọn) | Điểm |
|---|---|---|
| US01 | Reader đăng ký tài khoản (email, mật khẩu, mã SV/GV, loại bạn đọc) | 3 |
| US02 | Đăng nhập, nhận JWT theo vai trò | 2 |
| US03 | Librarian thêm/sửa/xoá đầu sách với tác giả, thể loại | 5 |
| US04 | Librarian quản lý bản sao (mã vạch, trạng thái, kệ) | 3 |
| US05 | Reader tìm sách theo tiêu đề/tác giả/thể loại/ISBN, lọc còn sách | 5 |
| US06 | Reader xem chi tiết sách và số bản còn | 2 |
| US07 | Librarian tạo phiếu mượn bằng mã vạch + mã bạn đọc | 8 |
| US08 | Librarian nhận trả, hệ thống tự tính phạt | 5 |
| US09 | Reader tự gia hạn sách đang mượn | 3 |
| US10 | Reader xem sách đang mượn, hạn trả, lịch sử | 3 |

### Slide 9 — Backlog chi tiết (2/2)

Tiêu đề: **User Story US11–US20**

| ID | User Story (rút gọn) | Điểm |
|---|---|---|
| US11 | Librarian ghi nhận sách mất | 3 |
| US12 | Reader xem phạt; Librarian ghi nhận đã thu | 3 |
| US13 | Librarian tra cứu bạn đọc, xem hồ sơ, khoá/mở thẻ | 5 |
| US14 | Admin tạo tài khoản thủ thư | 2 |
| US15 | Admin cấu hình chính sách mượn theo loại bạn đọc | 3 |
| US16 | Librarian xem dashboard thống kê (4 báo cáo) | 5 |
| US17 | Reader chấm 1–5 sao sách đã mượn | 2 |
| US18 | Reader nhận gợi ý sách cá nhân hoá (AI) | 8 |
| US19 | Librarian thấy nguy cơ trả trễ khi tạo phiếu mượn (AI) | 5 |
| US20 | Librarian quản lý tác giả, thể loại | 2 |

- *Ghi chú nói (slide 8–9):* Lướt nhanh, không đọc từng dòng. Nhấn US07 và US18–19 là ba story nặng nhất và sẽ minh hoạ ở slide sau.

### Slide 10 — Một User Story đầy đủ

Tiêu đề: **Ví dụ: US07 — Cho mượn sách tại quầy (8 điểm)**

Khung trích dẫn: *"As a Librarian, I want to tạo phiếu mượn bằng mã vạch bản sao và mã bạn đọc, so that cho mượn tại quầy nhanh và đúng quy định."*

Acceptance Criteria (checklist):

1. Đủ điều kiện → phiếu ACTIVE, `due_at` = hôm nay + `loan_days` theo loại bạn đọc, bản sao → BORROWED
2. Đã đủ số cuốn → 409 `LOAN_LIMIT_REACHED`
3. Đang có sách quá hạn → 409 `HAS_OVERDUE_LOAN`
4. Còn phạt chưa trả → 409 `UNPAID_FINE`
5. Bản sao không AVAILABLE → 409 `COPY_NOT_AVAILABLE`
6. Thẻ khoá → 409 `ACCOUNT_LOCKED`
7. Toàn bộ thao tác trong một transaction
8. Hoàn tất ≤ 3 click

- *Ghi chú nói:* AC viết theo dạng đầu vào → kết quả, kèm mã lỗi cụ thể — người test và người code đọc cùng hiểu một nghĩa. Mỗi AC sẽ thành một unit test.

### Slide 11 — Yêu cầu phi chức năng (tiêu chí chấm số 4)

Tiêu đề: **Phi chức năng — mỗi yêu cầu một con số**

| Nhóm | Yêu cầu | Chỉ số |
|---|---|---|
| Hiệu năng | API nghiệp vụ (mượn, trả, tra cứu) | ≤ 2 s tại p95, 20 người dùng đồng thời |
| Hiệu năng | Tìm kiếm sách | ≤ 1 s tại p95 |
| Hiệu năng | Gợi ý AI | ≤ 3 s, không chặn chức năng khác |
| Bảo mật | Mật khẩu | bcrypt cost ≥ 10, không bao giờ trả về |
| Bảo mật | Xác thực / phân quyền | JWT HS256 hạn 24h; RBAC mọi endpoint ghi |
| Bảo mật | Đầu vào | Validate toàn bộ DTO; rate limit đăng nhập 10 lần/phút |
| Khả dụng | Uptime | 99% giờ làm việc (ghi thật: hạ tầng free-tier không cam kết 99,9%) |
| Khả dụng | Mượn/trả/phạt | Atomic transaction; AI lỗi không chặn mượn/trả |
| Sử dụng | Giao diện | Responsive từ 360 px; cho mượn ≤ 3 click, ≤ 30 s |
| Bảo trì | Kiểm thử | Unit test ≥ 80% tầng Service; CI xanh mới merge |

- *Ghi chú nói:* Nhóm ghi thật về uptime: dùng Render/Vercel miễn phí nên chỉ cam kết 99% và nêu rõ điều kiện đạt 99,9%. Con số đo được ở LAB 4 bằng script tải giả lập.

### Slide 12 — Cấu trúc SRS (tiêu chí chấm số 3)

Tiêu đề: **SRS theo IEEE 830 — 3 phần + 2 phụ lục**

Ba cột:

**1. Giới thiệu** — 1.1 Mục đích · 1.2 Phạm vi · 1.3 Định nghĩa, viết tắt · 1.4 Tài liệu tham khảo · 1.5 Tổng quan

**2. Mô tả tổng quan** — 2.1 Bối cảnh (sơ đồ 3 dịch vụ) · 2.2 Chức năng F1–F10 · 2.3 Actor · 2.4 Ràng buộc · 2.5 Giả định · 2.6 Ngoài phạm vi

**3. Yêu cầu cụ thể** — 3.1 Giao diện ngoài (UI, HW, SW, truyền thông) · 3.2 System Features: 48 FR có mã và ưu tiên · 3.3 NFR: 6 nhóm, 25 yêu cầu · 3.4 Business Rules: 12 BR

Dòng dưới: **Phụ lục A** Product Backlog 20 US · **Phụ lục B** Ma trận truy vết US ↔ FR ↔ BR. File: `docs/srs/SRS.docx` (≈25 trang).

- *Ghi chú nói:* Điểm nhóm muốn nhấn: ma trận truy vết — mỗi US chỉ ra FR và BR nào, để LAB 2–4 kiểm tra được không sót yêu cầu.

### Slide 13 — Kiến trúc & công nghệ đề xuất

Tiêu đề: **Ba dịch vụ, một cơ sở dữ liệu**

Hình: chèn `docs/uml/system-context.png` (đã vẽ sẵn: Trình duyệt → Frontend → Backend → PostgreSQL; Backend ↔ AI Service; Google Books API nối Backend "chỉ khi nạp dữ liệu").

Bảng công nghệ:

| Tầng | Công nghệ | Lý do |
|---|---|---|
| Frontend | Next.js 15, TypeScript, TailwindCSS, TanStack Query | Đúng gợi ý LAB 3, responsive |
| Backend | NestJS 10, Prisma, PostgreSQL 16, Passport-JWT, Swagger | Controller–Service–Repository, sinh API spec |
| AI | FastAPI, scikit-learn, pandas | Service riêng theo yêu cầu LAB 3 |
| DevOps | Docker Compose, GitHub Actions, Vercel + Render + Neon | `docker compose up` chạy hết; deploy miễn phí |

- *Ghi chú nói:* Đây là định hướng để LAB 2 thiết kế chi tiết; kiến trúc modular monolith cho backend + AI tách riêng, đáp ứng checklist "API Gateway, Services, Database, tích hợp ngoài".

### Slide 14 — Lộ trình 4 LAB

Tiêu đề: **8 tuần, 4 LAB, 5 bản phát hành**

Timeline ngang:

| Sprint | Tuần | Sản phẩm | Tag |
|---|---|---|---|
| 0 | Tuần này | Scaffold repo, Docker Compose, CI skeleton, backlog | v0.1.0 |
| 1 | 1–2 | **LAB 1** SRS ✓ · **LAB 2** Use Case, ERD, kiến trúc, API spec · Auth + CRUD sách | v0.2.0 |
| 2 | 3–4 | **LAB 2** Class, Sequence, Activity · Mượn/trả/phạt + test ≥ 80% | v0.3.0 |
| 3 | 5–6 | **LAB 3** AI gợi ý + dự báo, tích hợp FE–BE–AI | v0.4.0 |
| 4 | 7–8 | **LAB 4** Deploy cloud, CI/CD, coverage, báo cáo | v1.0.0 |

- *Ghi chú nói:* LAB 1 đã xong hôm nay. Tuần này nhóm dựng khung mã nguồn để từ LAB 2 tài liệu sinh từ code (ERD từ Prisma, API spec từ Swagger).

### Slide 15 — Kết thúc (nền tối)

Tiêu đề: **Tài liệu nộp & hỏi đáp**

- SRS chuẩn IEEE 830: `docs/srs/SRS.docx`
- Báo cáo thuyết minh (mẫu của thầy, đã điền LAB 1): `docs/report/LAB_Report.docx`
- Product Backlog: GitHub Projects — `https://github.com/khoidev2001/university-library-system`
- Câu hỏi?

- *Ghi chú nói:* Cảm ơn thầy và các bạn. Nhóm sẵn sàng trả lời về cách chọn actor, cách viết AC, hay lý do chọn công nghệ.

## 4. Câu hỏi giảng viên có thể hỏi — chuẩn bị trả lời

| Câu hỏi | Ý trả lời |
|---|---|
| Sao không cho sinh viên tự mượn online? | Sách vật lý phải qua quầy; tự mượn online = đặt trước, đã đưa ra ngoài phạm vi để giữ MVP gọn. |
| Story point ước lượng thế nào? | Fibonacci, so tương đối với US02 (đăng nhập = 2). US07 là 8 vì có 6 điều kiện chặn + transaction + gọi AI. |
| Uptime 99,9% có đạt không? | Không, với free-tier. Nhóm ghi thật 99% và nêu điều kiện đạt 99,9%. |
| Dữ liệu AI lấy đâu? | goodbooks-10k (CC BY-SA) + Google Books cho mô tả; lịch sử mượn/trả là mô phỏng, ghi rõ trong SRS 2.5. |
| Sao có 2 loại bạn đọc? | Thư viện ĐH thực tế giảng viên mượn nhiều hơn, lâu hơn; cũng làm quy tắc nghiệp vụ phong phú hơn để test. |
| "Quá hạn" lưu ở đâu? | Không lưu, suy ra từ `due_at` — tránh cron và trạng thái lệch. |
