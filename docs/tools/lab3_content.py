"""Nội dung mục 2.3 (LAB 03) của báo cáo: số liệu đo trên hệ thống chạy thật 05/10/2026.

Nguồn số: GET /metrics của AI Service sau khi huấn luyện trên dữ liệu seed thật
(1.000 sách, 1.999 bạn đọc, 11.546 phiếu mượn mô phỏng), và GET /api/docs-json của Backend.
Chạy lại `pnpm seed:loans` + `POST /recommendations/train` rồi cập nhật lại các số này nếu dữ liệu đổi.
"""

BACKEND_SUMMARY = "\n".join(
    [
        "• Công nghệ: NodeJS NestJS 10 + Prisma 6 + PostgreSQL 16; xác thực JWT (Passport), phân quyền RBAC 3 vai "
        "trò; Swagger tự sinh tại /api/docs.",
        "• Đã hoàn thiện 48 RESTful API trên 14 nhóm: auth, users, books, authors, categories, copies, loans, "
        "fines, policies, ratings, reports, recommendations, internal, health.",
        "• Kiến trúc Controller – Service – Repository; toàn bộ quy tắc nghiệp vụ (BR-01…BR-12) nằm ở tầng Service. "
        "Mọi lỗi trả về một định dạng thống nhất { statusCode, error, message, path, timestamp } kèm mã nghiệp vụ "
        "rõ ràng: LOAN_LIMIT_REACHED, HAS_OVERDUE_LOAN, UNPAID_FINE, FINE_ALREADY_PAID, NOT_BORROWED, "
        "COPY_NOT_AVAILABLE, AI_UNAVAILABLE…",
    ]
)

AI_SUMMARY = "\n".join(
    [
        "• Thuật toán/Mô hình 1, gợi ý sách (lai): TF-IDF trên tiêu đề + tác giả + thể loại + mô tả (cosine "
        "similarity) trộn 50/50 với Collaborative Filtering item-based trên ma trận bạn đọc × sách. Đo trên tập "
        "hold-out 20%: Precision@5 = 0,309 và Recall@5 = 0,110 (1.000 sách, 1.999 bạn đọc, 122.353 tương tác, "
        "300 bạn đọc được đánh giá), vượt ngưỡng nghiệm thu 0,15 của US18.",
        "• Thuật toán/Mô hình 2, dự báo nguy cơ trả trễ: so sánh Logistic Regression với Random Forest trên "
        "10.895 phiếu đã trả (tỉ lệ trễ 60,4%), tách 20% làm tập kiểm tra.",
        "    – Logistic Regression: Accuracy 0,695 · Precision 0,788 · Recall 0,677 · F1 0,728 · ROC-AUC 0,762",
        "    – Random Forest:       Accuracy 0,694 · Precision 0,766 · Recall 0,710 · F1 0,737 · ROC-AUC 0,756",
        "    Hệ thống tự chọn Logistic Regression vì ROC-AUC cao hơn, đạt ngưỡng 0,70 của US19.",
        "• Đặc trưng: số lần mượn trước đó, số lần và tỉ lệ trả trễ trước đó, số sách đang giữ, loại bạn đọc, "
        "thể loại sách, số ngày mượn, tháng mượn và cờ mùa thi. Đặc trưng dựng theo trình tự thời gian: mỗi phiếu "
        "chỉ dùng thông tin có trước ngày mượn.",
        "• Lưu ý trung thực: lịch sử mượn/trả dùng để huấn luyện là dữ liệu MÔ PHỎNG sinh từ bộ goodbooks-10k "
        "(backend/prisma/seed/simulate-loans.ts), nên các số đo trên phản ánh quy luật mô phỏng, chưa phải hành vi "
        "bạn đọc thật.",
        "• Khả năng chịu lỗi (đã kiểm chứng bằng cách tắt hẳn AI Service): thao tác cho mượn vẫn thành công với "
        "nguy cơ trả trễ = null, trang gợi ý chuyển sang danh sách sách mượn nhiều, các endpoint quản trị AI trả "
        "503 AI_UNAVAILABLE thay vì lỗi 500.",
    ]
)

AI_SNIPPET = "\n".join(
    [
        "Snippet 1. ai-service/app/overdue_model.py: chọn mô hình tốt hơn theo ROC-AUC",
        'logistic = Pipeline([("scaler", StandardScaler()),',
        '                     ("clf", LogisticRegression(max_iter=1000, class_weight="balanced"))',
        "                    ]).fit(x_train, y_train)",
        "forest = RandomForestClassifier(n_estimators=200, max_depth=12, min_samples_leaf=5,",
        '                                class_weight="balanced", random_state=42).fit(x_train, y_train)',
        "logistic_scores = score_model(logistic, x_test, y_test)",
        "forest_scores   = score_model(forest,   x_test, y_test)",
        "self.model = forest if forest_scores.roc_auc >= logistic_scores.roc_auc else logistic",
        "",
        "Snippet 2. backend/src/modules/ai/ai.client.ts: AI chậm không được chặn quầy mượn (FR-LOAN-02)",
        "const res = await fetch(`${this.baseUrl}/predict-overdue`, {",
        "  method: 'POST',",
        "  body: JSON.stringify(features),",
        "  signal: AbortSignal.timeout(this.predictTimeoutMs),   // 2 giây",
        "});",
        "// lỗi hoặc quá hạn chờ -> trả null, phiếu mượn vẫn được tạo bình thường",
    ]
)

FRONTEND_SUMMARY = "\n".join(
    [
        "• Công nghệ: Next.js 15 App Router + TypeScript + TailwindCSS 4, TanStack Query cho trạng thái máy chủ, "
        "Recharts cho biểu đồ, Lucide cho biểu tượng.",
        "• Các trang công khai (trang chủ, tra cứu, chi tiết sách, quy định) dựng phía máy chủ nên xem được nội "
        "dung ngay cả khi tắt JavaScript và máy tìm kiếm đọc được. Tình trạng còn mấy bản trên kệ dựng theo từng "
        "yêu cầu để không hiển thị số liệu cũ.",
        "• Chuẩn SEO: tiêu đề và mô tả riêng cho từng trang, thẻ canonical, Open Graph, dữ liệu có cấu trúc "
        "schema.org (Library kèm SearchAction, Book kèm aggregateRating và tình trạng còn sách, FAQPage cho trang "
        "quy định), sitemap.xml và robots.txt sinh tự động; khu vực tài khoản và nghiệp vụ bị chặn khỏi chỉ mục.",
        "• Khả năng tiếp cận: ngôn ngữ trang là tiếng Việt, mỗi trang một thẻ h1, liên kết bỏ qua phần đầu trang, "
        "nhãn cho mọi ô nhập, bảng có caption và tiêu đề cột, viền focus rõ ràng, tôn trọng thiết lập giảm chuyển động.",
        "• Giao diện thích ứng: đã kiểm ở bề rộng 390 px, không có cuộn ngang, thanh điều hướng thu gọn thành nút menu.",
        "• Phân quyền trên giao diện: thanh điều hướng và các trang đổi theo vai trò; quyền thật vẫn do backend "
        "quyết định nên sửa giao diện không vượt được kiểm soát.",
        "• Thông báo lỗi dịch sang tiếng Việt theo từng mã nghiệp vụ, ví dụ khi bạn đọc còn nợ phạt hoặc đã mượn "
        "đủ số cuốn thì thủ thư thấy đúng lý do bị chặn.",
    ]
)
