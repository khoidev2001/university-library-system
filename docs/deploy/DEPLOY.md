# Hướng dẫn triển khai lên cloud

Kiến trúc triển khai: **Vercel** (frontend) + **Render** (backend và AI service, Docker) + **Neon** (PostgreSQL). Cả ba có gói miễn phí và không cần thẻ thanh toán.

```
Trình duyệt ──▶ Vercel (Next.js)
                  │  rewrite /api/*  ──▶ Render: uls-backend ──▶ Neon (Postgres)
                  │  rewrite /ai/*   ──▶ Render: uls-ai ──(training-data)──▶ uls-backend
```

Trình duyệt chỉ nói chuyện với một origin (Vercel), nên không cần cấu hình CORS và không lộ địa chỉ dịch vụ phía sau.

Địa chỉ web hiện tại: **https://muce-library.vercel.app**. Địa chỉ cũ `uls-library.vercel.app` chuyển hướng sang địa chỉ này. Ngoài ba dịch vụ trên, hệ thống dùng hai dịch vụ ngoài tuỳ chọn: **Resend** (gửi email, mục 7) và **VNPay** (thanh toán phạt trực tuyến, mục 6).

## Thứ tự làm

Làm đúng thứ tự vì dịch vụ sau cần địa chỉ của dịch vụ trước.

### 1. Neon (cơ sở dữ liệu)

1. Đăng ký tại neon.tech, tạo project `uls`, chọn vùng gần nhất (Singapore).
2. Vào **Connection Details**, tắt **Pooled connection**, chọn **Direct connection**, sao chép chuỗi kết nối.
   Lý do: `prisma migrate deploy` không chạy được qua bộ gộp kết nối (pgbouncer).
3. Thêm hậu tố, giữ nguyên phần còn lại:

   ```
   postgresql://USER:PASS@ep-xxxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&connect_timeout=15
   ```

   `connect_timeout` cần vì Neon tự tạm dừng sau 5 phút nhàn rỗi, kết nối đầu tiên sau đó mất khoảng 1 đến 2 giây.

   Backend tự chạy `prisma migrate deploy` mỗi lần khởi động. Một migration tạo extension `pg_trgm` (dùng cho tìm kiếm); Neon cho phép chủ cơ sở dữ liệu tạo extension này, không cần quyền superuser.

### 2. Render (backend và AI)

1. Đăng ký tại render.com bằng tài khoản GitHub, cấp quyền cho repo.
2. **New, Blueprint**, chọn repo. Render đọc `render.yaml` và tạo hai dịch vụ `uls-backend`, `uls-ai`.
3. Điền các biến Render hỏi:

   | Dịch vụ | Biến | Giá trị |
   |---|---|---|
   | uls-backend | `DATABASE_URL` | chuỗi Neon ở bước 1 |
   | uls-backend | `AI_SERVICE_URL` | địa chỉ `uls-ai`, ví dụ `https://uls-ai.onrender.com` |
   | uls-backend | `CORS_ORIGINS` | địa chỉ Vercel (điền sau, xem bước 4) |
   | uls-backend | `APP_PUBLIC_URL` | địa chỉ Vercel, không có `/` cuối (dùng dựng liên kết trong email và địa chỉ chuyển hướng sau thanh toán) |
   | uls-backend | `RESEND_API_KEY`, `MAIL_FROM` | tuỳ chọn, để gửi email: xem mục 7 |
   | uls-backend | `VNPAY_TMN_CODE`, `VNPAY_HASH_SECRET` | tuỳ chọn, để bật thanh toán phạt: xem mục 6 |
   | uls-ai | `BACKEND_URL` | `https://uls-backend.onrender.com/api` |
   | uls-ai | `INTERNAL_API_KEY` | **cùng giá trị** Render đã tự sinh cho `uls-backend` (xem ở tab Environment của backend) |

4. Chờ build xong (lần đầu 5 đến 10 phút). Kiểm tra: mở `https://uls-backend.onrender.com/api/health`, phải thấy `"database":"ok"`.
5. Lấy **Deploy Hook** của từng dịch vụ: Settings, Deploy Hook, sao chép URL. Dùng ở bước 5.

### 3. Nạp dữ liệu mẫu vào Neon (làm một lần)

Máy cần Docker. Chạy từ thư mục gốc repo, thay `DATABASE_URL` bằng chuỗi Neon:

```bash
docker compose build backend
docker run --rm -e DATABASE_URL="postgresql://...neon.tech/neondb?sslmode=require&connect_timeout=15" \
  uls-backend pnpm seed:prod
docker run --rm -e DATABASE_URL="postgresql://...neon.tech/neondb?sslmode=require&connect_timeout=15" \
  uls-backend pnpm seed:loans:prod
```

Hai lệnh nạp 1.000 sách, 2.000 bạn đọc, hơn 11 nghìn phiếu mượn mô phỏng. Mất khoảng 1 phút.
Sau đó AI Service tự huấn luyện khi khởi động; nếu muốn ép ngay, gọi `POST https://uls-ai.onrender.com/train`.

### 4. Vercel (frontend)

1. Đăng ký tại vercel.com bằng tài khoản GitHub, **Add New, Project**, chọn repo.
2. **Root Directory**: `frontend`. Framework tự nhận Next.js.
3. Thêm **Environment Variables** (áp dụng cho Production):

   | Biến | Giá trị |
   |---|---|
   | `BACKEND_PUBLIC_URL` | `https://uls-backend.onrender.com` (không có `/api`, không có dấu `/` cuối) |
   | `AI_PUBLIC_URL` | `https://uls-ai.onrender.com` |
   | `API_URL` | `https://uls-backend.onrender.com/api` |
   | `NEXT_PUBLIC_SITE_URL` | địa chỉ Vercel, ví dụ `https://muce-library.vercel.app` |

4. Deploy. Sau đó quay lại Render, điền `CORS_ORIGINS` của `uls-backend` bằng địa chỉ Vercel.

### 5. Nối CI/CD

Trên GitHub: **Settings, Secrets and variables, Actions**.

| Loại | Tên | Giá trị |
|---|---|---|
| Secret | `RENDER_DEPLOY_HOOK_BACKEND` | Deploy Hook của `uls-backend` |
| Secret | `RENDER_DEPLOY_HOOK_AI` | Deploy Hook của `uls-ai` |
| Variable | `LIVE_BACKEND_URL` | `https://uls-backend.onrender.com` |
| Variable | `LIVE_AI_URL` | `https://uls-ai.onrender.com` |
| Variable | `LIVE_WEB_URL` | địa chỉ Vercel |

Workflow `.github/workflows/ci-cd.yml` có năm job:

| Job | Chạy khi | Việc |
|---|---|---|
| `backend` | mọi push và PR | Postgres 16 dịch vụ, `pnpm lint`, `pnpm build`, `prisma db push`, `pnpm test:cov` (ngưỡng coverage), `pnpm test:e2e` (supertest trên Postgres thật) |
| `ai-service` | mọi push và PR | Python 3.12, `pytest` |
| `frontend` | mọi push và PR | `pnpm lint`, `pnpm build` |
| `compose-smoke` | mọi push và PR | `docker compose up --build` cả năm container trên runner sạch, chờ ba dịch vụ khoẻ rồi gọi thử qua gateway |
| `deploy` | chỉ push vào `main`, sau khi bốn job trên xanh | Gọi hai Deploy Hook của Render, rồi gọi thử `/api/health`, `/health` (AI) và `/health` (web) trên địa chỉ live, chờ tối đa 5 phút mỗi nơi |

Từ lúc này, mỗi lần merge vào `main` với mọi kiểm thử xanh: CI gọi hook để Render dựng lại backend và AI, Vercel tự dựng frontend qua tích hợp GitHub, rồi CI gọi thử ba địa chỉ live để xác nhận. Thiếu hook hoặc biến nào thì bỏ qua đúng dịch vụ đó, không làm hỏng pipeline.

### 6. Thanh toán phạt trực tuyến VNPay (tuỳ chọn)

Không bắt buộc: thiếu cấu hình thì nút thanh toán online tự ẩn và thu tiền mặt tại quầy vẫn dùng như cũ.

1. Đăng ký sandbox tại <http://sandbox.vnpayment.vn/devreg/>. VNPay gửi email gồm `TmnCode`, `HashSecret` và thông tin đăng nhập trang quản trị.
2. Trên Render (`uls-backend`) điền `VNPAY_TMN_CODE`, `VNPAY_HASH_SECRET` (secret) và `APP_PUBLIC_URL` (địa chỉ Vercel, không có `/` cuối), rồi **Deploy latest commit**. Vercel không cần biến mới: `/api/*` đã được rewrite sang Render nên return URL mặc định `https://<vercel>/api/payments/vnpay/return` đi qua Vercel tới backend.
3. **Cấu hình IPN URL trên cổng VNPay**: đăng nhập trang quản trị của VNPay (cùng tài khoản trong email đăng ký), vào website kiểm thử **SIT Testing**, mục **Cấu hình IPN URL**, nhập địa chỉ backend công khai:

   ```
   https://<render>/api/payments/vnpay/ipn
   ```

   Nên trỏ thẳng Render, không qua Vercel (IPN là máy chủ gọi máy chủ, tránh thêm một chặng và giới hạn của proxy). Ví dụ `https://uls-backend.onrender.com/api/payments/vnpay/ipn`. Sau khi lưu, VNPay gọi địa chỉ này mỗi khi có kết quả giao dịch; backend trả `{"RspCode":"00","Message":"Confirm Success"}` khi xác nhận (các mã khác: 01 không thấy đơn, 02 đã xác nhận, 04 sai số tiền, 97 sai chữ ký).
4. Nếu bỏ qua bước 3, thanh toán vẫn hoàn tất khi bạn đọc quay về trang kết quả (return URL cũng chốt giao dịch khi chữ ký và số tiền đúng). Chỉ khi bạn đọc đóng tab trước khi quay về thì giao dịch mới phải chờ IPN.
5. Chạy thử bằng thẻ test của VNPay (ngân hàng NCB): xem bảng thẻ ở README, mục "Thanh toán phạt trực tuyến (VNPay)". Sau một giao dịch thử, kiểm tra ở `/my/payments/result` và trong `GET /api/payments/me`.
6. Khi đổi sang môi trường thật của VNPay: đặt `VNPAY_URL` theo địa chỉ VNPay cấp và dùng `TmnCode`, `HashSecret` thật; nhớ khai báo lại IPN URL ở cổng đó.

Tiền về muộn cho khoản phạt đã được thu cách khác không bị thu hai lần: giao dịch gắn cờ cần hoàn tiền, thủ thư hoàn tiền thủ công trên cổng VNPay.

### 7. Email qua Resend (tuỳ chọn)

Dùng cho quên mật khẩu, thư chào mừng bạn đọc mới và email nhắc hạn. Render gói miễn phí chặn SMTP nên backend gọi HTTP API của Resend. **Không có `RESEND_API_KEY` thì mọi việc gửi thư bị bỏ qua có ghi log**, ứng dụng vẫn chạy; khi đó thủ thư dùng chức năng cấp mật khẩu tạm.

1. Tạo tài khoản ở resend.com, tạo API key quyền "Sending access".
2. Thử nhanh: để `MAIL_FROM` trống (mặc định `Thư viện MUCE <onboarding@resend.dev>`, chỉ gửi được tới email chủ tài khoản Resend). Chạy thật: thêm và xác minh tên miền ở Resend (bản ghi SPF, DKIM) rồi đặt `MAIL_FROM`, ví dụ `Thư viện MUCE <no-reply@ten-mien.vn>`.
3. Trên Render (`uls-backend`) điền `RESEND_API_KEY`, `MAIL_FROM`, `APP_PUBLIC_URL`, rồi **Deploy latest commit**.
4. **Tắt theo dõi bấm liên kết (click tracking)** trong phần cấu hình tên miền gửi ở bảng điều khiển Resend (tuỳ chọn Click Tracking). Nếu bật, Resend viết lại mọi liên kết trong thư thành địa chỉ chuyển hướng của họ, nên liên kết đặt lại mật khẩu (chứa token) đi qua một máy chủ bên thứ ba và có thể bị lưu lại. Tắt theo dõi mở thư (open tracking) cũng nên làm nếu không cần số liệu.
5. Resend giới hạn 2 yêu cầu mỗi giây: email nhắc hạn nghỉ 600 ms giữa hai thư (`MAIL_SEND_INTERVAL_MS`).

## Bảng biến môi trường

Cột "Khai báo" cho biết biến đã có sẵn trong `render.yaml` (R), `docker-compose.yml` (C), `.env.example` (E). Biến không có ở đó vẫn đặt được, mặc định như cột "Mặc định".

### Backend (`uls-backend`)

| Biến | Bắt buộc | Mặc định | Khai báo | Ý nghĩa |
|---|---|---|---|---|
| `DATABASE_URL` | có | không có | R, C | Chuỗi kết nối PostgreSQL (Neon: direct, có `?sslmode=require&connect_timeout=15`) |
| `JWT_SECRET` | có (thiếu thì backend không khởi động) | không có | R (tự sinh), C, E | Khoá ký JWT |
| `JWT_EXPIRES_IN` | không | `1d` | R | Hạn JWT |
| `INTERNAL_API_KEY` | có nếu dùng AI | không có | R (tự sinh), C, E | Khoá `X-Internal-Key` cho `/api/internal/*`; AI Service phải dùng cùng giá trị |
| `AI_SERVICE_URL` | không | `http://localhost:8000` | R, C | Địa chỉ AI Service |
| `AI_TIMEOUT_MS`, `AI_RECOMMEND_TIMEOUT_MS` | không | `2000`, `3000` | | Hạn gọi AI cho dự báo trả trễ và gợi ý |
| `CORS_ORIGINS` | không | `http://localhost` | R, C | Các origin được phép, cách nhau bằng dấu phẩy |
| `PORT` | không | `3000` | C | Cổng lắng nghe |
| `GOOGLE_BOOKS_API_KEY` | không | rỗng | R, C, E | Nhập sách theo ISBN và seed; không có key dễ bị 429 |
| `LIBRARY_UTC_OFFSET_MINUTES` | không | `420` | R | Múi giờ thư viện (UTC+7), quyết định ranh giới ngày tính phạt và báo cáo |
| `APP_PUBLIC_URL` | cần cho liên kết trong email và thanh toán | mục đầu của `CORS_ORIGINS` | R, C, E | Địa chỉ web công khai, không có `/` cuối |
| `RESEND_API_KEY` | không | rỗng (tắt gửi thư) | R, C, E | API key Resend |
| `MAIL_FROM` | không | `Thư viện MUCE <onboarding@resend.dev>` | R, C, E | Người gửi |
| `RESEND_API_URL` | không | `https://api.resend.com/emails` | | Chỉ để thử với máy chủ Resend giả |
| `MAIL_SEND_INTERVAL_MS` | không | `600` | | Nghỉ giữa hai thư nhắc hạn |
| `FORGOT_PASSWORD_MIN_MS` | không | `400` | | Thời gian phản hồi tối thiểu của `POST /auth/forgot-password` (san phẳng thời gian) |
| `VNPAY_TMN_CODE` | không | rỗng (tắt thanh toán) | R, C, E | Mã website VNPay |
| `VNPAY_HASH_SECRET` | không | rỗng (tắt thanh toán) | R, C, E | Khoá ký HMAC-SHA512, không ghi vào log hay commit |
| `VNPAY_URL` | không | `https://sandbox.vnpayment.vn/paymentv2/vpcpay.html` | C | Địa chỉ cổng VNPay |
| `VNPAY_RETURN_URL` | không | `${APP_PUBLIC_URL}/api/payments/vnpay/return` | | Địa chỉ VNPay đưa trình duyệt về |
| `EXPORT_MAX_ROWS` | không | `100000` | | Trần số dòng mỗi lần xuất CSV, Excel |
| `SEED_RESET`, `SEED_LOANS_RESET`, `SEED_LOANS_MAX` | không | không có, không có, `12000` | | Chỉ cho script seed |

### AI Service (`uls-ai`)

| Biến | Bắt buộc | Mặc định | Khai báo | Ý nghĩa |
|---|---|---|---|---|
| `BACKEND_URL` | có | `http://localhost:3000/api` | R, C | Địa chỉ backend gồm `/api` |
| `INTERNAL_API_KEY` | có | `dev-internal` | R, C, E | Cùng giá trị với backend |
| `TRAIN_ON_STARTUP` | không | `1` | C | Huấn luyện khi khởi động |
| `INITIAL_TRAINING_ATTEMPTS`, `INITIAL_TRAINING_RETRY_SECONDS` | không | `20`, `10` | R (30, 10) | Số lần và khoảng cách thử huấn luyện lúc khởi động |
| `MODEL_DIR`, `CONTENT_WEIGHT`, `HOLDOUT_RATIO`, `RANDOM_SEED` | không | `/tmp/uls-models`, `0.5`, `0.2`, `42` | | Tham số mô hình |

### Frontend (Vercel hoặc compose)

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `BACKEND_PUBLIC_URL` | không có | Địa chỉ backend (không có `/api`, không có `/` cuối); đặt thì Next.js rewrite `/api/*` sang đó |
| `AI_PUBLIC_URL` | không có | Địa chỉ AI Service; đặt thì rewrite `/ai/*` |
| `API_URL` | `http://localhost:3000/api` | Địa chỉ backend (có `/api`) cho các trang dựng phía máy chủ |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:8080` | Địa chỉ web, dùng cho canonical và sitemap |
| `NEXT_PUBLIC_API_URL` | `/api` | Gốc API trình duyệt gọi; để mặc định để chạy được ở mọi tên miền |

### Biến của docker compose

`.env.example` dùng các tên: `GATEWAY_PORT`, `POSTGRES_PORT`, `JWT_SECRET`, `INTERNAL_API_KEY`, `GOOGLE_BOOKS_API_KEY`, `RESEND_API_KEY`, `MAIL_FROM`, `APP_PUBLIC_URL`, `VNPAY_TMN_CODE`, `VNPAY_HASH_SECRET`. Compose còn nhận `VNPAY_URL`, `PUBLIC_SITE_URL` (thành `NEXT_PUBLIC_SITE_URL`), `TRAIN_ON_STARTUP`. Các biến tuỳ chọn khác (`EXPORT_MAX_ROWS`, `MAIL_SEND_INTERVAL_MS`, `FORGOT_PASSWORD_MIN_MS`, `RESEND_API_URL`, `VNPAY_RETURN_URL`) chưa được compose chuyển vào container; muốn dùng thì thêm vào mục `environment` của `backend` trong `docker-compose.yml`.

## Đổi tên miền

Khi đổi địa chỉ web (ví dụ từ `uls-library.vercel.app` sang `muce-library.vercel.app`):

1. Vercel: thêm tên miền mới ở Settings, Domains; giữ tên miền cũ và đặt chuyển hướng sang tên miền mới để liên kết cũ không chết.
2. Vercel: cập nhật `NEXT_PUBLIC_SITE_URL`.
3. Render (`uls-backend`): cập nhật `CORS_ORIGINS` và `APP_PUBLIC_URL`; nếu có `VNPAY_RETURN_URL` thì sửa theo; rồi **Deploy latest commit**. Liên kết trong email mới dựng từ `APP_PUBLIC_URL`; email đã gửi trước đó vẫn chứa địa chỉ cũ nên cần giữ chuyển hướng.
4. GitHub: cập nhật biến Actions `LIVE_WEB_URL`.
5. VNPay: IPN URL trỏ vào địa chỉ Render nên không đổi; nếu đã đặt `VNPAY_RETURN_URL` cố định thì kiểm tra lại, và nếu cổng VNPay có khai báo địa chỉ return thì sửa theo.
6. Resend: không phải đổi gì nếu tên miền gửi email (`MAIL_FROM`) không đổi.
7. Chạy lại phần "Kiểm tra sau khi triển khai" với địa chỉ mới.

## Kiểm tra sau khi triển khai

```bash
curl https://uls-backend.onrender.com/api/health        # database: ok
curl https://uls-ai.onrender.com/health                 # models: ready (sau khi huấn luyện xong)
curl https://muce-library.vercel.app/health              # frontend ok
curl https://muce-library.vercel.app/api/health          # đi qua rewrite sang Render
python backend/test/smoke-sprint1.py https://muce-library.vercel.app/api
curl -H "Authorization: Bearer $TOKEN" https://muce-library.vercel.app/api/payments/config   # online:true khi VNPay đã cấu hình
```

## Hạn chế của gói miễn phí (ghi vào báo cáo)

- **Render free ngủ sau 15 phút không có truy cập.** Lần gọi đầu sau đó mất khoảng 50 đến 60 giây. Trước buổi demo hãy mở trang chủ và `/ai/health` trước vài phút để đánh thức.
- **AI Service huấn luyện lại mỗi lần thức dậy** (không lưu mô hình ra đĩa), mất vài giây và lúc đó `/ai/health` báo `not_loaded`. Backend tự rơi về danh sách sách mượn nhiều nên người dùng không thấy lỗi.
- **Neon tạm dừng sau 5 phút nhàn rỗi**, kết nối đầu tiên chậm khoảng 1 đến 2 giây.
- Không có SLA nên mục tiêu khả dụng 99,9% trong SRS chỉ đạt khi chuyển sang gói trả phí.

## Đã kiểm chứng và các bẫy đã gặp

Đã triển khai và chạy thật cả ba dịch vụ. Qua địa chỉ Vercel: đăng nhập, tra cứu sách, gợi ý sách (nguồn `MODEL`) và `/api/health` (`database: ok`) đều thành công.

- **Địa chỉ Render có hậu tố ngẫu nhiên** (ví dụ `uls-backend-bo6w.onrender.com`) nếu tên đã bị chiếm. Điền biến sau khi tạo xong dịch vụ, đừng đoán địa chỉ trước.
- **`INTERNAL_API_KEY` của `uls-ai` phải đúng bằng của `uls-backend`.** Khi sửa biến trên Render, ô giá trị đã có sẵn nội dung: chọn hết rồi gõ đè và kiểm tra độ dài, kẻo gõ nối thành khoá sai (lỗi 401 khi huấn luyện).
- **Sửa biến môi trường xong phải "Deploy latest commit"**, "Restart service" không nạp biến mới.
- **Dịch vụ gợi ý chỉ thử huấn luyện 30 lần lúc khởi động.** Nếu hết lần mà backend chưa sẵn sàng, gọi `POST https://<uls-ai>/train` để huấn luyện lại.
- **Vercel chỉ liệt kê repo thuộc tài khoản GitHub đã kết nối.** Đăng nhập Vercel đúng tài khoản chủ repo, nếu không sẽ không thấy repo.
- Vercel mặc định deploy nhánh `main`. Nếu `render.yaml` hoặc `next.config.ts` mới chỉ có ở nhánh khác, đổi nhánh production ở Settings, Environments, Production, Branch Tracking, rồi dùng Deploy Hook cho nhánh đó.
