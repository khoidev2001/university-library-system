# Brief làm slide thuyết trình LAB 2: Thiết kế kiến trúc và mô hình hóa UML

> Dán toàn bộ file này cho AI làm slide. Nội dung lấy từ `docs/design/SDD.md`. Hình vẽ đã có sẵn, chèn nguyên ảnh, không vẽ lại.

## 1. Bối cảnh trình bày

| | |
|---|---|
| Buổi | Thuyết trình LAB 2, môn Công nghệ Phần mềm |
| Người nghe | Cả lớp và giảng viên (TS. Lê Tỷ Khánh) |
| Thời lượng | 15 đến 20 phút, sau đó hỏi đáp |
| Số slide | 14 slide |
| Ngôn ngữ | Tiếng Việt, thuật ngữ kỹ thuật giữ tiếng Anh (Use Case, Sequence, ERD, API Gateway) |
| Tỉ lệ | 16:9 |
| Người trình bày | Nhóm 3: Trần Đình Khôi (23Q74802012006), Nguyễn Như Quỳnh (21DQ4802011003) |

**Giảng viên chấm LAB 2 theo 4 tiêu chí**, slide phải cho thấy rõ từng tiêu chí:

1. Bộ sơ đồ UML: đủ Use Case, Class, Sequence (ít nhất 3 luồng chính), Activity
2. Sơ đồ kiến trúc: thể hiện rõ API Gateway, các Services, Database và tích hợp bên ngoài
3. Database ERD: thực thể, quan hệ 1-n và n-n, khóa chính và khóa ngoại đầy đủ, chuẩn hóa 3NF
4. Đặc tả API: đầy đủ Endpoint (Method, URL, Request Body, Response Code)

## 2. Yêu cầu thiết kế

Dùng chung bộ nhận diện với slide LAB 1 để hai buổi liền mạch:

- Nền sáng `#F7F5F0`, nền phụ `#ECE8DF`, chữ `#1B2A41`, nhấn `#C8553D` và `#2E7D6B`
- Tiêu đề serif (Libre Baskerville), nội dung sans (Public Sans), chữ nhỏ nhất 24px
- Footer mỗi slide: `LAB 2 · Thiết kế hệ thống · n/14`
- Slide 1 và 14 nền tối `#1B2A41`
- Không dùng gạch ngang dài trong mọi câu chữ
- Sơ đồ nhiều chi tiết thì cho chiếm trọn slide, phần giải thích đẩy sang slide kế

**Ảnh có sẵn trong repo:**

| Ảnh | Dùng ở slide |
|---|---|
| `docs/uml/architecture.png` | 3 |
| `docs/uml/use-case-overview.png` | 4 |
| `docs/uml/class-diagram.png` | 5 |
| `docs/uml/sequence-borrow.png` | 7 |
| `docs/uml/sequence-return-fine.png` | 8 |
| `docs/uml/sequence-recommend.png` | 9 |
| `docs/uml/activity-borrow.png` | 10 |
| `docs/erd/erd.png` | 11 |

## 3. Nội dung từng slide

### Slide 1: Bìa (nền tối)

- Eyebrow: `LAB 02 · Thiết kế kiến trúc hệ thống và mô hình hóa UML`
- Tiêu đề: **Từ đặc tả yêu cầu sang bản thiết kế thi công**
- Phụ đề: `Đề tài 8 · Kiến trúc · UML · ERD 3NF · Đặc tả 48 API`
- Dòng dưới: Nhóm 3, Trần Đình Khôi và Nguyễn Như Quỳnh · GVHD: TS. Lê Tỷ Khánh · Khoa CNTT, ĐH Xây dựng Miền Trung
- *Ghi chú nói:* LAB 1 trả lời hệ thống phải làm gì. LAB 2 trả lời hệ thống được dựng ra sao, đủ chi tiết để lập trình.

### Slide 2: Từ yêu cầu tới thiết kế

Tiêu đề: **Mỗi yêu cầu đều có chỗ đứng trong thiết kế**

| Thành phần thiết kế | Đáp ứng yêu cầu |
|---|---|
| Kiến trúc ba dịch vụ và gateway | NFR-PORT-01, NFR-AVAIL-03, NFR-MAINT-01 |
| Module Loans, Fines, Policies | FR-LOAN-01 đến 08, BR-01 đến BR-10 |
| Module Books, Copies, Authors, Categories | FR-BOOK-01 đến 05, FR-SEARCH-01 đến 04 |
| Module Users, Auth | FR-AUTH-01 đến 05, NFR-SEC-01 đến 08 |
| Module Reports, Ratings | FR-REPORT-01 đến 05, FR-RATE-01, 02 |
| AI Service và Recommendations | FR-AI-01 đến 07 |

- *Ghi chú nói:* Bảng truy vết này nằm trong SDD mục 1.3. Nhờ nó, khi kiểm thử ở LAB 4 nhóm biết yêu cầu nào đã có mã nguồn tương ứng.

### Slide 3: Kiến trúc hệ thống (tiêu chí chấm số 2)

Tiêu đề: **Ba dịch vụ, một cổng vào, một cơ sở dữ liệu**

Chèn trọn `docs/uml/architecture.png`.

Chú thích ngắn bên dưới: API Gateway (Nginx) định tuyến `/` cho Frontend, `/api` cho Backend, `/ai` cho AI Service. Google Books API là tích hợp bên ngoài, chỉ gọi khi nạp dữ liệu sách.

- *Ghi chú nói:* Bốn thứ giảng viên yêu cầu đều có trên hình: gateway, các service, database, tích hợp ngoài.

### Slide 4: Use Case tổng quan (tiêu chí 1)

Tiêu đề: **Ai làm được gì trong hệ thống**

Chèn `docs/uml/use-case-overview.png`.

Nhấn hai quan hệ: `Cho mượn sách` include `Dự báo nguy cơ trả trễ`; `Nhận trả sách` extend `Ghi nhận thu phạt` khi trả trễ.

- *Ghi chú nói:* Quyền lồng nhau Admin bao Librarian, Librarian bao phần xem của Reader. Hai actor phụ là AI Service và Google Books API.

### Slide 5: Class Diagram (tiêu chí 1)

Tiêu đề: **Lớp thực thể và lớp nghiệp vụ**

Chèn `docs/uml/class-diagram.png`.

- *Ghi chú nói:* Gói Domain gồm 10 entity ánh xạ một một với Prisma schema. Gói Application gồm 10 service và hai client ra ngoài. LoansService là trung tâm, phụ thuộc PoliciesService, FinesService, CopiesService và AiClient.

### Slide 6: Kiến trúc phân tầng

Tiêu đề: **Controller, Service, Repository: mỗi tầng một việc**

| Tầng | Được làm | Không được làm |
|---|---|---|
| Controller | Nhận HTTP, kiểm tra dữ liệu vào, kiểm JWT và vai trò | Chứa quy tắc nghiệp vụ, truy vấn cơ sở dữ liệu |
| Service | Toàn bộ quy tắc BR-01 đến BR-12, giao dịch, gọi dịch vụ ngoài | Biết về HTTP |
| Repository (Prisma) | Truy vấn dữ liệu | Chứa quy tắc nghiệp vụ |

Thành phần cắt ngang: ValidationPipe, JwtAuthGuard, RolesGuard, bộ lọc lỗi dùng chung, Swagger.

- *Ghi chú nói:* Nhờ tách tầng, toàn bộ quy tắc nghiệp vụ nằm một chỗ nên viết unit test đạt ngưỡng 80 phần trăm ở LAB 4 dễ hơn nhiều.

### Slide 7: Sequence 1, cho mượn sách (tiêu chí 1)

Tiêu đề: **Luồng phức tạp nhất: cho mượn tại quầy**

Chèn `docs/uml/sequence-borrow.png`.

Năm điều kiện chặn theo thứ tự: thẻ hợp lệ, bản sao sẵn sàng, chưa đủ số cuốn, không có sách quá hạn, không nợ phạt.

- *Ghi chú nói:* Điểm đáng chú ý là lời gọi AI có hạn chờ hai giây. AI chậm hoặc chết thì phiếu mượn vẫn được tạo, chỉ thiếu con số dự báo. Quầy không bao giờ bị treo vì AI.

### Slide 8: Sequence 2, nhận trả và tính phạt

Tiêu đề: **Trả sách: hệ thống tự tính phạt**

Chèn `docs/uml/sequence-return-fine.png`.

Công thức: số ngày lịch trễ nhân mức phạt mỗi ngày. Trả trong chính ngày hết hạn không bị phạt.

- *Ghi chú nói:* Toàn bộ cập nhật phiếu, bản sao và phiếu phạt nằm trong một giao dịch, nên không có chuyện trừ sách mà quên ghi phạt.

### Slide 9: Sequence 3, gợi ý sách

Tiêu đề: **Gợi ý sách: huấn luyện và phục vụ**

Chèn `docs/uml/sequence-recommend.png`.

Hai pha: AI Service kéo dữ liệu huấn luyện từ Backend; khi bạn đọc mở trang, Backend hỏi AI rồi làm giàu kết quả bằng dữ liệu sách thật.

- *Ghi chú nói:* AI không kết nối trực tiếp cơ sở dữ liệu. Chỉ Backend sở hữu schema, nên sau này thay mô hình không ảnh hưởng dữ liệu.

### Slide 10: Activity Diagram (tiêu chí 1)

Tiêu đề: **Quy trình cho mượn nhìn từ phía thủ thư**

Chèn `docs/uml/activity-borrow.png`.

- *Ghi chú nói:* Sơ đồ này là bản dịch trực tiếp của các quy tắc BR-01 đến BR-05 trong SRS, và cũng là danh sách ca kiểm thử cho LAB 4.

### Slide 11: ERD (tiêu chí chấm số 3)

Tiêu đề: **Cơ sở dữ liệu: 10 bảng, chuẩn 3NF**

Chèn `docs/erd/erd.png`.

Dòng nhấn: ERD được sinh tự động từ `schema.prisma`, nên sơ đồ không bao giờ lệch với mã nguồn.

- *Ghi chú nói:* Quan hệ 1-n có categories với books, books với book_copies, book_copies với loans. Quan hệ n-n là books với authors qua bảng trung gian book_authors. Mọi bảng đều có khóa chính, mọi liên kết đều có khóa ngoại.

### Slide 12: Vì sao đạt 3NF

Tiêu đề: **Chuẩn hóa và những thứ cố ý không lưu**

| Mức | Cách đạt |
|---|---|
| 1NF | Mọi cột nguyên tử, danh sách tác giả tách thành bảng riêng thay vì một chuỗi |
| 2NF | Bảng khóa phức `book_authors` không có cột phụ thuộc một phần khóa |
| 3NF | Thể loại tách bảng, chính sách mượn tách bảng, tiền phạt tách bảng |

Dữ liệu dẫn xuất cố ý không lưu: trạng thái quá hạn tính từ hạn trả; số bản còn tính từ trạng thái bản sao.

- *Ghi chú nói:* Không lưu trạng thái quá hạn nghĩa là không cần tác vụ chạy nền hằng ngày, và không bao giờ có chuyện cờ quá hạn lệch với ngày thật.

### Slide 13: Đặc tả API (tiêu chí chấm số 4)

Tiêu đề: **48 endpoint, mỗi lỗi một mã rõ nghĩa**

Trích bảng mẫu (giữ nguyên bốn cột như yêu cầu):

| Method | URL | Request Body | Response Code |
|---|---|---|---|
| POST | `/api/loans` | `{barcode, memberCode}` | 201, 400, 404, 409 `LOAN_LIMIT_REACHED` hoặc `HAS_OVERDUE_LOAN` hoặc `UNPAID_FINE` |
| POST | `/api/loans/:id/return` | không có | 200, 404, 409 `LOAN_NOT_ACTIVE` |
| POST | `/api/loans/:id/renew` | không có | 200, 403, 409 `RENEW_LIMIT_REACHED` |
| POST | `/api/fines/:id/pay` | không có | 200, 404, 409 `FINE_ALREADY_PAID` |
| GET | `/api/books` | query `q`, `categoryId`, `available`, `page` | 200 danh sách có phân trang |

Dòng dưới: Mọi lỗi trả về cùng một khuôn dạng `{ statusCode, error, message, path, timestamp }`. Bảng đầy đủ 48 endpoint và 20 mã lỗi nghiệp vụ nằm trong SDD mục 5.

- *Ghi chú nói:* Đặc tả này sinh ra từ Swagger của mã nguồn thật, nên tài liệu và hệ thống luôn khớp nhau.

### Slide 14: Kết thúc (nền tối)

Tiêu đề: **Tài liệu nộp và hỏi đáp**

- Tài liệu thiết kế: `docs/design/SDD.docx`
- Sơ đồ nguồn PlantUML: `docs/uml/`, ERD và DDL: `docs/erd/`
- Báo cáo thuyết minh: `docs/report/LAB_Report.docx`
- Mã nguồn: `https://github.com/khoidev2001/university-library-system`
- Câu hỏi?

## 4. Câu hỏi giảng viên có thể hỏi

| Câu hỏi | Ý trả lời |
|---|---|
| Vì sao chọn modular monolith mà không phải microservices? | Nghiệp vụ mượn trả cần giao dịch chung giữa phiếu, bản sao và phạt. Tách nhỏ sẽ phải xử lý giao dịch phân tán trong khi nhóm chỉ có hai người. AI tách riêng vì khác ngôn ngữ và được phép lỗi. |
| ERD vẽ bằng tay hay sinh ra? | Sinh tự động từ `schema.prisma` bằng `docs/tools/prisma_to_erd.py`, nên không lệch mã nguồn. DDL là file migration thật của Prisma. |
| Vì sao không lưu cột trạng thái quá hạn? | Tránh phải chạy tác vụ nền cập nhật hằng ngày và tránh cờ lệch. Truy vấn dùng mốc nửa đêm đầu ngày theo giờ thư viện, có đánh chỉ mục trên cột hạn trả. |
| Nếu AI Service chết thì sao? | Cho mượn vẫn thành công, chỉ thiếu con số dự báo. Trang gợi ý chuyển sang danh sách sách mượn nhiều. Nhóm đã kiểm bằng cách tắt hẳn AI Service. |
| Chính sách mượn đổi thì phiếu cũ có đổi theo không? | Không. Hạn trả được chốt tại thời điểm tạo phiếu, nên đổi chính sách chỉ áp dụng cho phiếu mới. |
| Có bao nhiêu Sequence Diagram và vì sao chọn ba luồng đó? | Ba luồng: cho mượn, trả và tính phạt, gợi ý sách. Đó là ba luồng nhiều bước nhất và chạm nhiều thành phần nhất, gồm cả giao dịch cơ sở dữ liệu và lời gọi dịch vụ ngoài. |
