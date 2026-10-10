"""Nội dung mục 2.4 (LAB 04) và phần III (kết luận) của báo cáo.

Số liệu lấy từ lần chạy CI thành công gần nhất trên main (run #23) và từ pipeline của PR LAB 4
(run #25), cập nhật lại khi bộ kiểm thử đổi. Riêng cấu hình docker-compose đọc thẳng từ file
thật để không bao giờ lệch.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

COMPOSE_INTRO = (
    "Toàn bộ hệ thống khởi chạy bằng một lệnh `docker compose up --build`, gồm 5 container: "
    "postgres (cơ sở dữ liệu), backend (NestJS), ai-service (FastAPI), frontend (Next.js) và gateway (Nginx, "
    "cổng 8080). Backend tự áp migration khi khởi động; frontend, backend và AI Service đều có Dockerfile riêng. "
    "Job compose-smoke trong CI chạy đúng lệnh này trên máy ảo sạch rồi gọi thử ba địa chỉ /health qua gateway."
)


def compose_snippet() -> str:
    """Nội dung docker-compose.yml thật, bỏ dòng chú thích dài cho gọn trong bảng."""
    lines = (ROOT / "docker-compose.yml").read_text(encoding="utf-8").splitlines()
    kept = [line for line in lines if not line.lstrip().startswith("#")]
    return "Cấu hình docker-compose.yml\n" + "\n".join(kept).strip()


UNIT_TEST_BULLETS = [
    "Tổng số Test Cases: 160, tất cả đều đạt (100%), chạy tự động trên GitHub Actions. Gồm 119 unit test backend "
    "(Jest, 17 suite), 15 e2e test backend chạy trên PostgreSQL thật (3 suite) và 26 test AI Service (pytest). "
    "Ngoài ra 100 lượt gọi API thật qua gateway (smoke test sprint 1, 2, 3) đã chạy xanh trên hệ thống đang chạy.",
    "Độ bao phủ mã nguồn (Code Coverage) của backend, đo trên lớp nghiệp vụ (service, guard, client): "
    "98,75% dòng, 97,51% câu lệnh, 98,49% hàm, 81,9% nhánh, vượt ngưỡng 80% theo yêu cầu. "
    "AI Service đạt 93,6% (ngưỡng 80% cấu hình trong pyproject.toml). Ngưỡng được ép ngay trong cấu hình: "
    "coverage dưới ngưỡng thì pipeline thất bại. Ảnh báo cáo Istanbul bên dưới lấy từ artifact của CI.",
]

CI_DESCRIPTION = (
    "c) Cấu hình CI/CD Pipeline: workflow .github/workflows/ci-cd.yml tự chạy mỗi khi push hoặc mở Pull Request, "
    "gồm 4 job song song và 1 job triển khai. backend: lint, build, unit test kèm ngưỡng coverage, e2e test trên "
    "PostgreSQL thật (service container). ai-service: pytest kèm ngưỡng coverage. frontend: lint và build. "
    "compose-smoke: dựng cả 5 container trên máy ảo sạch và gọi thử qua gateway. deploy: chỉ chạy khi merge vào "
    "main và mọi job trước đó xanh, gọi Deploy Hook của Render rồi kiểm tra các địa chỉ trực tuyến."
)

PIPELINE_CAPTION = "Kết quả pipeline GitHub Actions (run #25, 4 job đạt, job deploy chỉ chạy khi merge vào main):"

DEPLOY_INTRO = (
    "d) Triển khai Cloud: kiến trúc triển khai gồm Vercel (frontend), Render (backend và AI Service, Docker) và "
    "Neon (PostgreSQL), đều dùng gói miễn phí. Cấu hình có sẵn trong repo: render.yaml, frontend/next.config.ts "
    "(rewrite /api và /ai sang Render để trình duyệt chỉ nói chuyện với một địa chỉ) và hướng dẫn từng bước "
    "docs/deploy/DEPLOY.md. Hệ thống đã chạy thật trên cloud: đăng nhập, tra cứu sách và gợi ý sách đều gọi thành công qua địa chỉ Vercel. Gói miễn phí tự ngủ khi không có truy cập nên lần mở đầu có thể mất khoảng một phút. Địa chỉ truy cập ứng dụng trực tuyến:"
)

DEPLOY_URL_PLACEHOLDERS = [
    "URL Web Application: https://uls-library.vercel.app",
    "URL API Swagger Docs: https://uls-backend-bo6w.onrender.com/api/docs",
]

RESULTS = [
    "Hoàn thiện cả 04 bài thực hành LAB theo tiến trình Scrum: 4 sprint, 20 User Story trong Product Backlog, "
    "toàn bộ đều có chức năng chạy được và được kiểm bằng smoke test trên hệ thống thật.",
    "Hệ thống gồm 48 RESTful API, giao diện 12 trang chuẩn SEO và responsive, hai mô hình AI đạt ngưỡng nghiệm thu "
    "(Precision@5 = 0,309 so với ngưỡng 0,15; ROC-AUC = 0,76 so với ngưỡng 0,70), 160 test tự động, coverage 98,75%.",
    "Áp dụng quy trình DevOps tự động hóa: một lệnh docker compose up dựng toàn bộ hệ thống, CI chạy đủ kiểm thử "
    "trên mỗi Pull Request, tài liệu thiết kế (ERD, đặc tả API) sinh tự động từ mã nguồn nên luôn khớp với hệ thống.",
]

LIMITATIONS = (
    "Hạn chế: (1) Lịch sử mượn trả dùng để huấn luyện AI là dữ liệu mô phỏng, nên độ chính xác của dự báo trả trễ "
    "phản ánh quy luật mô phỏng chứ chưa phải hành vi bạn đọc thật. (2) Sách mẫu lấy từ bộ goodbooks-10k nên tên sách "
    "tiếng Anh và chưa có mô tả (chưa có khoá Google Books API); chức năng nhập sách theo ISBN đã có mã nguồn và "
    "unit test nhưng chưa thử với dữ liệu thật vì bị giới hạn tần suất. (3) Frontend chưa có test tự động, mới chỉ "
    "kiểm bằng lint, build và kiểm tay trên trình duyệt. (4) Xác thực dùng JWT một ngày, chưa có refresh token. "
    "(5) Hạ tầng miễn phí không có SLA: Render ngủ sau 15 phút không dùng nên lần gọi đầu mất khoảng 1 phút, "
    "mục tiêu khả dụng 99,9% chỉ đạt khi chuyển sang gói trả phí."
)

FUTURE = (
    "Hướng phát triển: thay dữ liệu mô phỏng bằng dữ liệu mượn trả thật của thư viện rồi huấn luyện lại, so sánh "
    "thêm mô hình gradient boosting; thêm đặt trước sách, thông báo nhắc hạn qua email, thanh toán phạt trực tuyến; "
    "bổ sung test giao diện bằng Playwright và kiểm thử tải để đo thực tế chỉ tiêu 2 giây ở p95; lưu mô hình ra bộ "
    "nhớ ngoài để AI Service khởi động nhanh sau khi thức dậy."
)
