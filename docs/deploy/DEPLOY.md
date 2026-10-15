# Hướng dẫn triển khai lên cloud

Kiến trúc triển khai: **Vercel** (frontend) + **Render** (backend và AI service, Docker) + **Neon** (PostgreSQL). Cả ba có gói miễn phí và không cần thẻ thanh toán.

```
Trình duyệt ──▶ Vercel (Next.js)
                  │  rewrite /api/*  ──▶ Render: uls-backend ──▶ Neon (Postgres)
                  │  rewrite /ai/*   ──▶ Render: uls-ai ──(training-data)──▶ uls-backend
```

Trình duyệt chỉ nói chuyện với một origin (Vercel), nên không cần cấu hình CORS và không lộ địa chỉ dịch vụ phía sau.

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

### 2. Render (backend và AI)

1. Đăng ký tại render.com bằng tài khoản GitHub, cấp quyền cho repo.
2. **New, Blueprint**, chọn repo. Render đọc `render.yaml` và tạo hai dịch vụ `uls-backend`, `uls-ai`.
3. Điền các biến Render hỏi:

   | Dịch vụ | Biến | Giá trị |
   |---|---|---|
   | uls-backend | `DATABASE_URL` | chuỗi Neon ở bước 1 |
   | uls-backend | `AI_SERVICE_URL` | địa chỉ `uls-ai`, ví dụ `https://uls-ai.onrender.com` |
   | uls-backend | `CORS_ORIGINS` | địa chỉ Vercel (điền sau, xem bước 4) |
   | uls-backend | `RESEND_API_KEY`, `MAIL_FROM`, `APP_PUBLIC_URL` | tuỳ chọn, để gửi email: xem README mục "Tài khoản và email" |
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
   | `NEXT_PUBLIC_SITE_URL` | địa chỉ Vercel, ví dụ `https://uls-library.vercel.app` |

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

Từ lúc này, mỗi lần merge vào `main` với mọi kiểm thử xanh: CI gọi hook để Render dựng lại backend và AI, Vercel tự dựng frontend qua tích hợp GitHub, rồi CI gọi thử ba địa chỉ live để xác nhận.

## Kiểm tra sau khi triển khai

```bash
curl https://uls-backend.onrender.com/api/health        # database: ok
curl https://uls-ai.onrender.com/health                 # models: ready (sau khi huấn luyện xong)
curl https://uls-library.vercel.app/health              # frontend ok
curl https://uls-library.vercel.app/api/health          # đi qua rewrite sang Render
python backend/test/smoke-sprint1.py https://uls-library.vercel.app/api
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
