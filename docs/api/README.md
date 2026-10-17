# Hướng dẫn sử dụng API

Tài liệu này dành cho người viết client hoặc kiểm thử tích hợp. Đặc tả từng trường nằm ở Swagger (sinh tự động từ mã nguồn, luôn khớp code); mô tả thiết kế, bảng mã lỗi đầy đủ và quy tắc nghiệp vụ nằm ở [SDD mục 5](../design/SDD.md).

## Địa chỉ

| Môi trường | Base URL | Swagger UI | OpenAPI JSON |
|---|---|---|---|
| Triển khai (Vercel chuyển tiếp sang Render) | `https://muce-library.vercel.app/api` | `https://muce-library.vercel.app/api/docs` | `/api/docs-json` |
| Cục bộ (`docker compose up`) | `http://localhost:8080/api` | `http://localhost:8080/api/docs` | `/api/docs-json` |

Backend Render gói miễn phí ngủ sau 15 phút không có truy cập, lần gọi đầu có thể mất 50 đến 60 giây.

Kiểm tra nhanh:

```bash
curl https://muce-library.vercel.app/api/health
# {"status":"ok","service":"backend","database":"ok","timestamp":"..."}
```

## Xác thực

1. Đăng nhập lấy JWT:

   ```bash
   curl -X POST https://muce-library.vercel.app/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"reader@uls.local","password":"Reader@123"}'
   # {"accessToken":"eyJ...","user":{...}}
   ```

2. Gửi kèm mọi yêu cầu cần đăng nhập: `Authorization: Bearer <accessToken>`.

Token hết hạn sau 24 giờ. Ở mỗi yêu cầu, backend đọc lại tài khoản từ cơ sở dữ liệu: tài khoản bị khoá hoặc đã xoá, hoặc token cấp trước thời điểm thu hồi phiên (đặt khi đặt lại mật khẩu hoặc được cấp lại mật khẩu tạm), đều nhận `401`. Vai trò lấy từ cơ sở dữ liệu chứ không từ token.

Tài khoản đang dùng mật khẩu tạm (`mustChangePassword = true`) chỉ gọi được `GET /auth/me` và `POST /auth/change-password`; mọi API khác trả `403 PASSWORD_CHANGE_REQUIRED` cho tới khi đổi mật khẩu.

### Vai trò

Có ba vai trò: `READER`, `LIBRARIAN`, `ADMIN`. Quy tắc kiểm tra quyền:

- **ADMIN bao hàm LIBRARIAN**: route yêu cầu LIBRARIAN thì ADMIN cũng gọi được.
- **Route chỉ ghi READER là dành riêng cho bạn đọc** (mượn của tôi, gia hạn, đặt trước, thanh toán, đánh giá, gợi ý). LIBRARIAN và ADMIN không gọi được các route này (trả `403`).
- Route không ghi vai trò thì mọi người dùng đã đăng nhập gọi được (hồ sơ, thông báo, huỷ đặt trước).
- Route công khai (`Pub`) không cần JWT.

Quy ước cột "Vai trò" trong các bảng dưới: **Pub** công khai; **Any** mọi người dùng đã đăng nhập; **R** chỉ Reader; **L** Librarian và Admin; **A** chỉ Admin.

## Định dạng lỗi

Mọi lỗi có cùng một dạng:

```json
{
  "statusCode": 409,
  "error": "UNPAID_FINE",
  "message": "Bạn đọc còn 15.000đ phạt chưa thanh toán",
  "path": "/api/loans",
  "timestamp": "2026-10-01T08:30:00.000Z"
}
```

- `error` là **mã nghiệp vụ** viết hoa (ví dụ `LOAN_LIMIT_REACHED`) để client đối chiếu; `message` là tiếng Việt cho người đọc.
- Lỗi kiểm tra đầu vào (`400`) có `error: "Bad Request"` và `message` là **mảng** lỗi từng trường.
- Bảng đầy đủ các mã nghiệp vụ: [SDD mục 5.10](../design/SDD.md).

| HTTP | Ý nghĩa thường gặp |
|---|---|
| 400 | Dữ liệu vào sai (trường lạ cũng bị từ chối), sai mật khẩu hiện tại, token đặt lại không hợp lệ |
| 401 | Thiếu, sai, hết hạn hoặc bị thu hồi JWT; sai email hoặc mật khẩu (`INVALID_CREDENTIALS`) |
| 403 | Sai vai trò; `ACCOUNT_LOCKED` khi đăng nhập; `PASSWORD_CHANGE_REQUIRED`; `STAFF_ACCOUNT_PROTECTED`; `NOT_BORROWED` |
| 404 | Không có tài nguyên, hoặc tài nguyên của người khác (không lộ sự tồn tại) |
| 409 | Vi phạm quy tắc nghiệp vụ hoặc trùng dữ liệu: `LOAN_LIMIT_REACHED`, `HAS_OVERDUE_LOAN`, `UNPAID_FINE`, `COPY_NOT_AVAILABLE`, `COPY_HELD`, `RENEW_LIMIT_REACHED`, `LOAN_NOT_ACTIVE`, `FINE_ALREADY_PAID`, `FINE_PAYMENT_PENDING`, `EMAIL_EXISTS`, `ISBN_EXISTS`, `BARCODE_EXISTS`, mã đặt trước (`NO_COPIES`, `BOOK_AVAILABLE`, `ALREADY_RESERVED`, `RESERVATION_LIMIT`...) |
| 413, 415, 422 | Tệp nhập sách quá lớn, sai loại, sai cấu trúc (`IMPORT_*`); quá 2.000 nhãn (`TOO_MANY_LABELS`) |
| 429 | Vượt giới hạn tần suất (`TOO_MANY_REQUESTS`) |
| 503 | `AI_UNAVAILABLE`, `PAYMENT_NOT_CONFIGURED` |

## Phân trang

Các danh sách có phân trang nhận `?page=1&limit=20` (`limit` từ 1 đến 100, mặc định 20) và trả:

```json
{ "items": [ ... ], "total": 137, "page": 1, "limit": 20 }
```

Ngoại lệ: báo cáo quá hạn trả mảng kèm header `X-Total-Count` (tối đa 5.000 dòng, tham số `limit`); danh sách thông báo của tôi trả 30 thông báo mới nhất.

## Giới hạn tần suất

Tính theo IP, mỗi phút. Vượt giới hạn trả `429` với `error: TOO_MANY_REQUESTS`.

| Phạm vi | Giới hạn |
|---|---|
| Mọi route (mặc định) | 100 |
| `POST /auth/login` | 10 |
| `POST /auth/change-password` | 5 |
| `POST /auth/forgot-password` | 5 |
| `POST /auth/reset-password` | 10 |
| `POST /users/readers`, `POST /users/:id/reset-password` | 30 |
| `POST /payments` | 30 |
| `GET /payments/vnpay/ipn`, `GET /payments/vnpay/return` | không giới hạn (xác thực bằng chữ ký) |

## Header đặc biệt

| Header | Ở đâu | Ý nghĩa |
|---|---|---|
| `X-Total-Count` | `GET /reports/overdue`, `GET /exports/*` | Tổng số dòng khớp (không bị cắt bởi `limit` hoặc trần xuất) |
| `X-Export-Truncated` | `GET /exports/*` | `true` nếu số dòng vượt trần xuất (mặc định 100.000, biến `EXPORT_MAX_ROWS`) và tệp bị cắt |
| `Content-Disposition` | Tệp xuất, tệp mẫu nhập sách | Có `filename` ASCII và `filename*=UTF-8''...` (tên tiếng Việt) |
| `Cache-Control` | Danh mục công khai (`/books`, `/books/:id`, `/authors`, đánh giá) | `public, max-age=0, s-maxage=30, stale-while-revalidate=60`; thể loại và chính sách mượn cache lâu hơn |
| `Cache-Control: no-store` | Các API mật khẩu, tệp xuất | Không lưu đệm |

CORS cho phép trình duyệt đọc `X-Total-Count`, `X-Export-Truncated`, `Content-Disposition`.

## Danh sách endpoint

Tiền tố chung: `/api`. Bảng sinh từ các controller trong `backend/src/modules`.

### auth

| Method | Đường dẫn | Vai trò | Mục đích |
|---|---|---|---|
| POST | `/auth/register` | Pub | Đăng ký bạn đọc (luôn là READER) |
| POST | `/auth/login` | Pub | Đăng nhập, nhận JWT |
| GET | `/auth/me` | Any | Hồ sơ hiện tại (kèm `mustChangePassword`, `emailReminders`, lần đăng nhập) |
| PATCH | `/auth/me` | Any | Sửa `fullName`, `emailReminders` |
| POST | `/auth/change-password` | Any | Đổi mật khẩu |
| POST | `/auth/forgot-password` | Pub | Gửi liên kết đặt lại qua email (luôn trả 200) |
| POST | `/auth/reset-password` | Pub | Đặt lại mật khẩu bằng token |

### users

| Method | Đường dẫn | Vai trò | Mục đích |
|---|---|---|---|
| GET | `/users` | L | Danh sách người dùng, lọc `q`, `role`, `isActive` |
| GET | `/users/:id` | L | Hồ sơ: sách đang mượn, quá hạn, phạt chưa trả |
| PATCH | `/users/:id` | L | Khoá hoặc mở thẻ, đổi loại bạn đọc, sửa tên |
| POST | `/users` | A | Tạo tài khoản LIBRARIAN hoặc ADMIN |
| POST | `/users/readers` | L | Tạo bạn đọc tại quầy, trả mật khẩu tạm một lần |
| POST | `/users/:id/reset-password` | L | Cấp lại mật khẩu tạm (thủ thư cho bạn đọc; Admin cho mọi tài khoản) |

### books, authors, categories, copies

| Method | Đường dẫn | Vai trò | Mục đích |
|---|---|---|---|
| GET | `/books` | Pub | Tìm sách: `q`, `categoryId`, `authorId`, `available`, phân trang |
| GET | `/books/:id` | Pub | Chi tiết sách, số bản còn, điểm đánh giá |
| POST | `/books` | L | Thêm đầu sách |
| PATCH | `/books/:id` | L | Sửa đầu sách |
| DELETE | `/books/:id` | L | Xoá đầu sách (không còn bản đang mượn, chưa có lịch sử mượn) |
| POST | `/books/import` | A | Nhập hàng loạt theo danh sách ISBN qua Google Books |
| GET | `/books/import-template` | L | Tải tệp mẫu nhập sách (`format=csv\|xlsx`) |
| POST | `/books/import-file` | L | Nhập từ tệp CSV hoặc xlsx (multipart, trường `file`); `dryRun=true` chỉ xem trước; `onDuplicate=skip\|update` |
| GET | `/books/:id/copies` | L | Bản sao của một đầu sách |
| POST | `/books/:id/copies` | L | Thêm bản sao |
| GET | `/copies/labels` | L | Bản sao kèm tên sách để in nhãn (`bookIds`, `copyIds`, tối đa 2.000) |
| PATCH | `/copies/:id` | L | Đổi trạng thái hoặc vị trí kệ bản sao |
| GET | `/authors` | Pub | Danh sách tác giả |
| POST, PATCH, DELETE | `/authors`, `/authors/:id` | L | Quản lý tác giả |
| GET | `/categories` | Pub | Danh sách thể loại kèm số sách |
| POST, PATCH, DELETE | `/categories`, `/categories/:id` | L | Quản lý thể loại |
| POST | `/books/:id/ratings` | R | Chấm 1 đến 5 sao sách đã mượn và trả |
| GET | `/books/:id/ratings/summary` | Pub | Điểm trung bình và số lượt |

### loans, fines

| Method | Đường dẫn | Vai trò | Mục đích |
|---|---|---|---|
| POST | `/loans` | L | Cho mượn bằng `barcode` và `memberCode`, kèm dự báo trả trễ |
| GET | `/loans` | L | Tra cứu phiếu: `status`, `overdue`, `userId` |
| GET | `/loans/:id` | L | Chi tiết phiếu |
| POST | `/loans/:id/return` | L | Nhận trả, tự tạo phạt nếu trễ |
| POST | `/loans/:id/report-lost` | L | Báo mất, phạt giá bìa cộng phạt trễ |
| GET | `/loans/me` | R | Sách tôi đang mượn và lịch sử |
| POST | `/loans/:id/renew` | R | Tự gia hạn phiếu của mình |
| GET | `/fines/me` | R | Khoản phạt của tôi và tổng chưa thanh toán |
| GET | `/fines` | L | Danh sách khoản phạt: `paid`, `userId` |
| POST | `/fines/:id/pay` | L | Ghi nhận đã thu tiền mặt |

### reservations, notifications

| Method | Đường dẫn | Vai trò | Mục đích |
|---|---|---|---|
| POST | `/reservations` | R | Đặt trước sách hết bản (`{bookId}`) |
| GET | `/reservations/me` | R | Đặt trước của tôi kèm vị trí hàng đợi |
| GET | `/reservations` | L | Hàng đợi đặt trước: `status`, `bookId` |
| DELETE | `/reservations/:id` | Any | Huỷ (bạn đọc huỷ của mình; thủ thư huỷ bất kỳ) |
| GET | `/notifications/me` | Any | 30 thông báo mới nhất và số chưa đọc |
| POST | `/notifications/read-all` | Any | Đánh dấu đã đọc tất cả |
| POST | `/notifications/:id/read` | Any | Đánh dấu đã đọc một thông báo |

### payments (VNPay)

| Method | Đường dẫn | Vai trò | Mục đích |
|---|---|---|---|
| POST | `/payments` | R | Tạo giao dịch phạt, trả `paymentUrl` để chuyển hướng trình duyệt |
| GET | `/payments/config` | Any | Cổng đã bật chưa, hạn mức, thời hạn giữ chỗ |
| GET | `/payments/me` | R | Lịch sử thanh toán của tôi |
| GET | `/payments/:id` | R, L | Chi tiết giao dịch (chủ giao dịch hoặc thủ thư) |
| POST | `/payments/:id/cancel` | R, L | Huỷ giao dịch đang chờ |
| GET | `/payments/vnpay/ipn` | Pub | IPN: VNPay gọi máy chủ, trả `{RspCode, Message}` |
| GET | `/payments/vnpay/return` | Pub | Trình duyệt quay về từ VNPay, chuyển hướng 302 tới trang kết quả |

Hai endpoint VNPay không dùng JWT: mọi tham số `vnp_*` được xác thực bằng chữ ký HMAC-SHA512 (`vnp_SecureHash`) và số tiền được so với giao dịch đã lưu. IPN nên khai báo trực tiếp địa chỉ backend (`https://<render>/api/payments/vnpay/ipn`); return mặc định là `${APP_PUBLIC_URL}/api/payments/vnpay/return`. Mã `RspCode` của IPN: `00` xác nhận, `01` không thấy đơn, `02` đã xác nhận trước đó, `04` sai số tiền, `97` sai chữ ký, `99` lỗi khác. Chi tiết luồng: [README mục "Thanh toán phạt trực tuyến"](../../README.md) và [SDD hình 3.7](../design/SDD.md).

### exports

Tất cả là `GET`, vai trò **L**, tham số `format=csv|xlsx` (mặc định csv). Tệp phát trực tiếp theo lô 1.000 dòng, tối đa 100.000 dòng mỗi lần.

| Đường dẫn | Bộ lọc | Nội dung |
|---|---|---|
| `/exports/overdue-loans` | không có | Phiếu quá hạn kèm phạt ước tính |
| `/exports/loans` | `from`, `to`, `status`, `overdue`, `userId` | Phiếu mượn |
| `/exports/top-books` | `from`, `to`, `limit` | Sách mượn nhiều nhất |
| `/exports/inventory` | không có | Tồn kho theo thể loại |
| `/exports/fines` | `from`, `to`, `paid`, `userId` | Khoản phạt |
| `/exports/readers` | `q`, `isActive`, `memberType` | Bạn đọc |
| `/exports/books` | `q`, `categoryId`, `authorId`, `available` | Danh mục sách |

Ngày lọc dạng `YYYY-MM-DD` theo giờ thư viện (UTC+7), bao trọn ngày cuối. CSV có BOM UTF-8 và chống formula injection; Excel dùng kiểu số và ngày thật.

### policies, reports, recommendations

| Method | Đường dẫn | Vai trò | Mục đích |
|---|---|---|---|
| GET | `/policies` | Pub | Chính sách mượn theo loại bạn đọc |
| PATCH | `/policies/:memberType` | A | Sửa chính sách (áp dụng cho phiếu tạo sau) |
| GET | `/reports/top-books` | L | Sách mượn nhiều nhất (`from`, `to`, `limit` 1 đến 50) |
| GET | `/reports/overdue` | L | Bạn đọc quá hạn (`limit` tối đa 5.000; `X-Total-Count`) |
| GET | `/reports/loans-by-month` | L | Lượt mượn theo tháng (`months` 1 đến 36, giờ UTC+7) |
| GET | `/reports/inventory` | L | Tồn kho theo thể loại (có cột `held`) |
| GET | `/recommendations/me` | R | Sách gợi ý (AI lỗi thì trả sách mượn nhiều, `source: POPULAR`) |
| POST | `/recommendations/train` | A | Yêu cầu AI huấn luyện lại |
| GET | `/recommendations/metrics` | L | Số đo mô hình |
| GET | `/recommendations/overdue-accuracy` | L | Đối chiếu dự báo trả trễ với thực tế |

### hệ thống và nội bộ

| Method | Đường dẫn | Vai trò | Mục đích |
|---|---|---|---|
| GET | `/health` | Pub | Trạng thái backend và cơ sở dữ liệu |
| GET | `/internal/training-data` | Header `X-Internal-Key` | Dữ liệu huấn luyện cho AI Service (không dùng JWT) |

AI Service (cổng 8000, qua gateway `/ai`): `GET /ai/health`, `GET /ai/recommend`, `POST /ai/predict-overdue`, `POST /ai/train`, `GET /ai/metrics`. Đặc tả ở [SDD mục 5.9](../design/SDD.md).

## Ví dụ thường dùng

Cho mượn tại quầy (cần JWT thủ thư):

```bash
curl -X POST https://muce-library.vercel.app/api/loans \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"barcode":"LIB-1-1","memberCode":"SV001"}'
# 201 {"loan":{...},"overdueRisk":0.18}   hoặc   409 {"error":"UNPAID_FINE",...}
```

Xuất phiếu quá hạn ra Excel:

```bash
curl -L -o qua-han.xlsx -H "Authorization: Bearer $TOKEN" \
  "https://muce-library.vercel.app/api/exports/overdue-loans?format=xlsx"
```

Xem trước nhập sách từ tệp, chưa ghi gì:

```bash
curl -X POST "https://muce-library.vercel.app/api/books/import-file?dryRun=true" \
  -H "Authorization: Bearer $TOKEN" -F "file=@sach.csv"
```
