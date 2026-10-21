"""Dữ liệu và văn bản cho các chương của báo cáo QLDAPM gộp (tổng quan, phân tích, thiết kế, demo, kết luận).

Các chương LAB 1 đến 3 lấy từ docs/pm/QLDAPM_Report.md (qldapm_md.py). Ở đây là phần còn lại. Mọi số liệu kiểm thử,
API, trang giao diện đếm lại từ mã nguồn và lần chạy CI gần nhất (run 39247516989 trên main, 19/10/2026) hoặc từ hệ thống đang chạy.
Chuỗi có {T:khoá}, {F:khoá}, {S:khoá} là tham chiếu tới bảng, hình, mục và được thay khi dựng.
"""
from __future__ import annotations

PROJECT = "Phần mềm Quản lý Thư viện Trường Đại học Xây dựng Miền Trung"
URL_WEB = "https://muce-library.vercel.app"
URL_REPO = "https://github.com/khoidev2001/university-library-system"

# ------------------------------------------------------------------ lời nói đầu
PREFACE = [
    "Thư viện là nơi bạn đọc gặp tài liệu, nhưng với thủ thư, mỗi lượt mượn trả còn là một chuỗi việc có ràng buộc: kiểm tra hạn mức, nợ phạt, tình trạng bản sao, tính phạt khi trễ. Khi các việc này làm bằng sổ tay, sai sót và thời gian chờ là điều khó tránh. Hệ thống Quản lý Thư viện Trường Đại học Xây dựng Miền Trung do nhóm xây dựng nhằm số hoá toàn bộ quy trình đó và đã chạy trực tuyến tại https://muce-library.vercel.app.",
    "Báo cáo này trình bày ba bài thực hành Quản lý dự án phần mềm (LAB 1: khởi tạo dự án, phạm vi và WBS; LAB 2: ước lượng, tài chính và lập lịch; LAB 3: rủi ro, EVA, thay đổi và chất lượng) trên cùng một đề tài, kèm phần phân tích yêu cầu, thiết kế hệ thống, rủi ro bảo mật dữ liệu bạn đọc và sản phẩm chạy thật có ảnh minh hoạ. Mọi con số quản lý dự án (16 tuần, 566 giờ công, ngân sách cơ sở 28,30 triệu đồng) đều lấy từ một mô hình tính chung và đối chiếu được với tệp Excel kèm theo; các con số của phần mềm (API, kiểm thử, độ bao phủ, chỉ số mô hình) đếm từ mã nguồn và từ hệ thống đang chạy.",
    "Nhóm xin cảm ơn TS. Lê Tỷ Khánh đã hướng dẫn và góp ý trong suốt học phần. Do thời gian và kinh nghiệm còn hạn chế, báo cáo khó tránh thiếu sót; nhóm mong nhận được ý kiến đóng góp của thầy.",
]

ABBREV = [
    ("ULS", "University Library System, hệ thống quản lý thư viện trường đại học"),
    ("SPM", "Software Project Management, quản lý dự án phần mềm"),
    ("PMBOK", "Project Management Body of Knowledge, bộ tri thức quản lý dự án của PMI"),
    ("WBS", "Work Breakdown Structure, cấu trúc phân rã công việc"),
    ("RACI", "Responsible, Accountable, Consulted, Informed: ma trận phân chia trách nhiệm"),
    ("SOW", "Statement of Work, phát biểu bài toán"),
    ("SMART", "Specific, Measurable, Achievable, Relevant, Time-bound: mục tiêu cụ thể, đo được, khả thi, thực tế, có thời hạn"),
    ("PERT", "Program Evaluation and Review Technique, ước lượng ba điểm"),
    ("CPM", "Critical Path Method, phương pháp đường găng"),
    ("AON", "Activity on Node, sơ đồ mạng công việc đặt trên nút"),
    ("FS, SS, FF, SF", "Finish to Start, Start to Start, Finish to Finish, Start to Finish: bốn loại quan hệ phụ thuộc"),
    ("NPV, ROI", "Net Present Value (giá trị hiện tại ròng); Return on Investment (tỷ suất hoàn vốn đầu tư)"),
    ("EVA", "Earned Value Analysis, phân tích giá trị thu được"),
    ("BAC, PV, EV, AC", "Budget at Completion, Planned Value, Earned Value, Actual Cost"),
    ("SV, CV, SPI, CPI", "Schedule Variance, Cost Variance, Schedule Performance Index, Cost Performance Index"),
    ("EAC, ETC, VAC, TCPI", "Estimate at Completion, Estimate to Complete, Variance at Completion, To-Complete Performance Index"),
    ("EMV", "Expected Monetary Value, giá trị tiền kỳ vọng của rủi ro"),
    ("CR", "Change Request, phiếu yêu cầu thay đổi"),
    ("SRS", "Software Requirements Specification, đặc tả yêu cầu phần mềm"),
    ("SDD", "Software Design Document, tài liệu thiết kế hệ thống"),
    ("UC, US", "Use Case (ca sử dụng); User Story (câu chuyện người dùng)"),
    ("FR, NFR, BR", "Functional Requirement, Non-functional Requirement, Business Rule"),
    ("UML, ERD", "Unified Modeling Language; Entity Relationship Diagram"),
    ("API, REST", "Application Programming Interface; Representational State Transfer"),
    ("RBAC", "Role-Based Access Control, phân quyền theo vai trò"),
    ("JWT", "JSON Web Token, mã xác thực không trạng thái"),
    ("ORM", "Object-Relational Mapping, ánh xạ đối tượng quan hệ (Prisma)"),
    ("CI/CD", "Continuous Integration / Continuous Delivery, tích hợp và triển khai liên tục"),
    ("ISBN", "International Standard Book Number, mã số sách tiêu chuẩn quốc tế"),
    ("IPN", "Instant Payment Notification, thông báo thanh toán tức thời của VNPay"),
    ("HMAC", "Hash-based Message Authentication Code, mã xác thực thông điệp dựa trên băm"),
    ("PII", "Personally Identifiable Information, thông tin định danh cá nhân"),
    ("DPIA", "Data Protection Impact Assessment, đánh giá tác động xử lý dữ liệu cá nhân"),
    ("UAT", "User Acceptance Testing, kiểm thử chấp nhận của người dùng"),
    ("KPI", "Key Performance Indicator, chỉ số đánh giá hiệu quả"),
    ("AI, ML", "Artificial Intelligence, Machine Learning"),
    ("CSDL", "Cơ sở dữ liệu"),
]

# ------------------------------------------------------------------ chương 1
CH1_CONTEXT = [
    "Thư viện trường đại học đang chuyển từ nơi lưu giữ tài liệu sang một dịch vụ thông tin: bạn đọc muốn tra cứu trực tuyến, biết sách còn hay hết trên kệ, gia hạn và nộp phạt mà không phải đến quầy. Luật Thư viện 2019 (Luật số 46/2019/QH14, có hiệu lực từ 01/07/2020) là khung pháp lý của hoạt động thư viện, trong đó có nội dung về ứng dụng công nghệ thông tin. Đồng thời, Luật Bảo vệ dữ liệu cá nhân (Luật số 91/2025/QH15, có hiệu lực từ 01/01/2026) và Nghị định 356/2025/NĐ-CP hướng dẫn thi hành đặt ra nghĩa vụ khi xử lý dữ liệu của bạn đọc.",
    "Khác với một trang tra cứu đơn thuần, hệ thống quản lý thư viện gắn với các nghiệp vụ có ràng buộc và có tiền: hạn mức mượn, hạn trả, khoản phạt, hàng đợi đặt trước, thanh toán trực tuyến, cùng dữ liệu cá nhân của hàng nghìn bạn đọc. Thực trạng trong bài toán là thư viện ghi sổ tay: thủ thư mất khoảng 3 phút cho mỗi lượt mượn trả, tính phạt thủ công dễ sai, bạn đọc không biết sách còn hay hết, báo cáo làm tay mất nhiều giờ mỗi tháng (đây là các giả định của đề tài, chưa đo ở một thư viện thật). Vì vậy dự án cần phương pháp luận Quản lý dự án phần mềm chuẩn hoá, dựa trên PMBOK của PMI kết hợp Agile/Scrum.",
]
CH1_SCOPE_INTRO = "Hệ thống được thiết kế để bao phủ vòng đời của một cuốn sách trong thư viện và vòng đời trải nghiệm của bạn đọc, gồm 4 khối chức năng trung tâm:"
CH1_SCOPE = [
    "**Quản lý danh mục sách:** đầu sách, tác giả, thể loại, bản sao vật lý có mã vạch và vị trí kệ; nhập hàng loạt theo ISBN (Google Books) hoặc từ tệp CSV, xlsx có xem trước; in nhãn mã vạch.",
    "**Quản lý bạn đọc và tài khoản:** đăng ký, ba vai trò (Reader, Librarian, Admin), khoá và mở thẻ, hồ sơ cá nhân, quên và đặt lại mật khẩu qua email, thủ thư tạo bạn đọc tại quầy, in thẻ bạn đọc.",
    "**Mượn, trả, đặt trước và phạt:** cho mượn tại quầy bằng mã vạch, nhận trả, gia hạn, báo mất, tính phạt theo ngày lịch; đặt trước với hàng đợi và giữ bản sao 3 ngày; thông báo và email nhắc hạn; thu phạt bằng tiền mặt hoặc nộp trực tuyến qua VNPay.",
    "**Tra cứu, thống kê và trí tuệ nhân tạo:** tìm kiếm theo tiêu đề, tác giả, thể loại, ISBN; bốn báo cáo thống kê và xuất CSV, Excel; gợi ý sách cá nhân hoá và dự báo nguy cơ trả trễ hiển thị cho thủ thư khi cho mượn.",
]
CH1_METHOD = [
    "Dự án áp dụng mô hình lai. Phần lập kế hoạch và kiểm soát theo PMBOK: Project Charter, WBS, sơ đồ mạng và đường găng (CPM), sổ rủi ro, đường cơ sở, theo dõi bằng EVA và quy trình kiểm soát thay đổi (Chương 2 đến Chương 4). Phần phát triển theo Scrum: backlog 37 User Story (155 điểm), kế hoạch và đánh giá sprint 2 tuần một lần, mọi thay đổi vào nhánh main đi qua Pull Request có rà soát và CI.",
    "Với các khối đòi hỏi chính xác về tiền và dữ liệu cá nhân (quy tắc phạt, thanh toán VNPay, tài khoản và mật khẩu) nhóm đặc tả quy tắc nghiệp vụ trước (BR-01 đến BR-26), kiểm thử biên và chạy e2e trên cơ sở dữ liệu thật, gần với cách làm tuần tự. Với giao diện và mô hình AI nhóm làm lặp ngắn, demo cuối mỗi sprint để nhận phản hồi sớm.",
]
CH1_ARCH = "ULS gồm ba dịch vụ phía sau một cổng vào: Frontend Next.js 15 (giao diện, trang công khai dựng phía máy chủ), Backend NestJS 10 với Prisma 6 và PostgreSQL 16 (toàn bộ nghiệp vụ, xác thực JWT, phân quyền theo vai trò) và AI Service FastAPI với scikit-learn (gợi ý sách, dự báo trả trễ). Hệ thống tích hợp Google Books (dữ liệu sách), Resend (email) và VNPay (thanh toán, môi trường sandbox). Triển khai bằng Docker Compose ở máy cục bộ và trên Vercel, Render, Neon ở môi trường thật; CI/CD bằng GitHub Actions. Thiết kế chi tiết ở {S:ch6}."
CH1_REAL = [
    "Về thời gian thực tế: kho mã nguồn có 147 commit tính đến 19/10/2026, từ 21/09/2026, tức sản phẩm (gồm MVP và đợt mở rộng sau MVP) được xây dựng trong khoảng 4 tuần. Con số 16 tuần ở các chương sau là lịch của dự án mô phỏng, không phải thời gian làm thật; hai thứ được tách bạch xuyên suốt báo cáo.",
]

TEAM_ROWS = [
    ["Trần Đình Khôi (nhóm trưởng)", "Quản lý dự án, Backend và DevOps",
     "Charter, WBS và từ điển WBS; ước lượng, sơ đồ mạng, đường găng, nén tiến độ; EVA; kế hoạch kiểm thử; phần mềm ULS (Backend, hạ tầng)", "65%"],
    ["Nguyễn Như Quỳnh", "Frontend và AI/ML",
     "SOW, kế hoạch truyền thông, RACI; chọn sơ đồ tổ chức; phân tích tài chính; rủi ro; kiểm soát thay đổi; Test Script, vòng đời lỗi; phần mềm ULS (giao diện, mô hình)", "35%"],
]
TEAM_NOTE = "Tỉ lệ đóng góp tính trên toàn bộ công việc của nhóm, gồm cả sản phẩm phần mềm ULS dùng làm đề tài xuyên suốt và các phần của báo cáo này. Dự án mô phỏng có 4 vai trò (quản lý dự án, Frontend và AI, Backend và DevOps, BA và kiểm thử); hai vai trò sau do nhóm giả định, như nêu ở {S:md:1.4}."
LAB_TASKS = [
    ["LAB 1", "Tôn chỉ dự án (Project Charter)", "Khôi"],
    ["LAB 1", "Phát biểu bài toán (SOW), kế hoạch truyền thông", "Quỳnh"],
    ["LAB 1", "Chọn cơ cấu tổ chức, ma trận RACI", "Quỳnh"],
    ["LAB 1", "WBS 4 cấp và từ điển WBS", "Khôi"],
    ["LAB 2", "Phân tích tài chính (NPV, ROI, hoàn vốn)", "Quỳnh"],
    ["LAB 2", "Ước lượng, quan hệ phụ thuộc, sơ đồ mạng, đường găng, Gantt", "Khôi"],
    ["LAB 2", "Nén tiến độ 20%", "Khôi"],
    ["LAB 3", "Quản lý rủi ro", "Quỳnh"],
    ["LAB 3", "Phân tích giá trị thu được (EVA)", "Khôi"],
    ["LAB 3", "Quản lý thay đổi và cấu hình", "Quỳnh"],
    ["LAB 3", "Kế hoạch kiểm thử", "Khôi"],
    ["LAB 3", "Test Script mẫu, vòng đời lỗi", "Quỳnh"],
]
STRUCTURE_ROWS = [
    ["Chương 2", "LAB 1: Project Charter, SOW, kế hoạch truyền thông, cơ cấu tổ chức, RACI, WBS và từ điển WBS", "Khởi tạo dự án, phạm vi"],
    ["Chương 3", "LAB 2: phân tích tài chính, ước lượng, phụ thuộc, sơ đồ mạng, đường găng, Gantt, nén tiến độ", "Ước lượng, lập lịch"],
    ["Chương 4", "LAB 3: rủi ro, EVA, quản lý thay đổi và cấu hình, kế hoạch kiểm thử, Test Script, vòng đời lỗi", "Rủi ro, EVA, chất lượng"],
    ["Chương 5", "Yêu cầu chức năng và phi chức năng, quy tắc nghiệp vụ, tác nhân, use case, WBS theo chức năng", "Phân tích yêu cầu"],
    ["Chương 6", "Kiến trúc, cơ sở dữ liệu, UML, API, bảo mật, quyết định thiết kế, triển khai", "Thiết kế hệ thống"],
    ["Chương 7", "Rủi ro bảo mật dữ liệu bạn đọc, tuân thủ pháp lý, bảo mật trong WBS", "Rủi ro bảo mật"],
    ["Chương 8", "Địa chỉ truy cập, ảnh demo theo vai trò, kết quả kiểm thử, mô hình AI, hiệu năng", "Sản phẩm và demo"],
    ["Chương 9", "Lộ trình, chỉ số đánh giá, vận hành", "Triển khai và vận hành"],
    ["Kết luận, Phụ lục", "Tổng kết, bài học, tự đánh giá, hạn chế, kiến nghị; công thức, backlog, danh sách API, tệp kèm theo", "Tổng hợp"],
]

# ------------------------------------------------------------------ giới thiệu từng LAB
LAB1_GOALS = [
    ["Project Charter", "Tôn chỉ dự án, 7 mục tiêu SMART, các bên liên quan, phê duyệt", "{S:md:1.2}"],
    ["SOW và truyền thông", "Phát biểu bài toán, sản phẩm bàn giao, kế hoạch truyền thông, ma trận RACI", "{S:md:1.3}"],
    ["Cơ cấu tổ chức", "So sánh cấu trúc tổ chức, chọn ma trận cân bằng, phân tích bốn góc nhìn", "{S:md:1.4}"],
    ["WBS", "WBS 4 cấp, danh sách đến cấp 3, công việc cấp 4, từ điển WBS cho 3 gói găng", "{S:md:1.5}"],
]
LAB2_GOALS = [
    ["Phân tích tài chính", "Giả định, dòng tiền, NPV, ROI, hoàn vốn, độ nhạy", "{S:md:2.1}"],
    ["Ước lượng và phụ thuộc", "Thời gian, chi phí, bốn loại quan hệ phụ thuộc và độ trễ", "{S:md:2.2}"],
    ["Sơ đồ mạng và đường găng", "AON, truyền tiến và truyền lùi có thế số, đường găng, Gantt", "{S:md:2.3}"],
    ["Nén tiến độ 20%", "Crashing, fast-tracking, ba phương án, phương án khuyến nghị, rủi ro đi kèm", "{S:md:2.4}"],
]
LAB3_GOALS = [
    ["Quản lý rủi ro", "11 rủi ro, ma trận 5x5, kế hoạch giảm thiểu và dự phòng", "{S:md:3.1}"],
    ["EVA", "PV, EV, AC theo từng công việc và cả dự án tại mốc 50%, dự báo", "{S:md:3.2}"],
    ["Thay đổi và cấu hình", "Đường cơ sở, quy trình 5 bước, phiếu thay đổi, quản lý cấu hình", "{S:md:3.3}"],
    ["Chất lượng", "Test Plan, 3 Test Script, vòng đời lỗi, tiêu chí nghiệm thu", "{S:md:3.4}"],
]
LAB_GOAL_HEADER = ["Nhiệm vụ của LAB", "Nội dung đã làm", "Vị trí trong báo cáo"]

CHARTER_NOTE = "Ghi chú: danh sách ngoài phạm vi ở đường cơ sở 1.0 (đặt trước, email nhắc hạn, thanh toán trực tuyến, ứng dụng di động) được giữ đúng như ở thời điểm lập Charter. Sau khi hoàn thành MVP, nhóm đã làm thêm đặt trước, thông báo và email nhắc hạn, tài khoản và mật khẩu, thanh toán phạt qua VNPay (môi trường sandbox), xuất báo cáo, in thẻ và nhãn, nhập sách từ tệp (US21 đến US37, SRS phiên bản 2.0); riêng ứng dụng di động không làm mà thay bằng giao diện web responsive. Đợt mở rộng này ghi ở nhật ký thay đổi ({T:md:3.11}) và nằm ngoài mô hình EVA."

CR04_ROW = ["CR-04", "Đợt mở rộng sau MVP (Sprint 5): đặt trước, thông báo và email nhắc hạn, tài khoản và mật khẩu, thanh toán VNPay, xuất báo cáo và in thẻ, nhập sách từ tệp (US21 đến US37)",
            "Không ước lượng", "Ghi nhận ở SRS 2.0", "Ngoài mô hình EVA của báo cáo này"]

TEST_PLAN_RESULT = ("576 test tự động đạt 100% ở lần chạy CI gần nhất trên main (19/10/2026): 322 unit Backend (33 suite), 228 e2e Backend trên "
                    "PostgreSQL thật (20 suite, gồm ca đua song song) và 26 test AI; coverage unit Backend 92,34% dòng, 91,72% câu lệnh, 95,26% hàm, "
                    "76,13% nhánh (ngưỡng 80% dòng và 75% nhánh); AI 93,59%; CI xanh trên mọi Pull Request.")

# ------------------------------------------------------------------ chương 5
FR_NOTE = "Mỗi nhóm có các yêu cầu chi tiết mã FR-... trong SRS phiên bản 2.0 (docs/srs/SRS.md); tổng cộng 37 User Story, 155 điểm (Phụ lục B)."
NFR_ROWS = [
    ["Hiệu năng", "API nghiệp vụ p95 ≤ 2 giây (1.000 sách, 3.000 bản sao, 2.000 bạn đọc, 20 người dùng đồng thời); tìm kiếm p95 ≤ 1 giây; gợi ý AI ≤ 3 giây; trang đầu ≤ 3 giây trên 4G, Lighthouse Performance ≥ 80", "NFR-PERF-01 đến 08"],
    ["Bảo mật", "bcrypt; JWT 24 giờ và đọc lại tài khoản ở mọi yêu cầu; RBAC; kiểm tra đầu vào; giới hạn tần suất theo IP; chữ ký HMAC-SHA512 cho VNPay; chống formula injection; kiểm tra tệp tải lên; header bảo mật", "NFR-SEC-01 đến 14"],
    ["Độ tin cậy, khả dụng", "Khả dụng 99% trong giờ làm việc 7h đến 21h (hạ tầng miễn phí không cam kết 99,9%); giao dịch nguyên tử; AI lỗi không chặn mượn trả; sao lưu Neon hằng ngày; an toàn khi chạy đồng thời (12 ca đua trên PostgreSQL thật); việc định kỳ chạy lặp an toàn", "NFR-AVAIL-01 đến 06"],
    ["Khả năng sử dụng", "Responsive từ 360 px, không cuộn ngang; mượn tại quầy ≤ 3 lần nhấp và ≤ 30 giây; giao diện tiếng Việt; WCAG AA; một hệ thiết kế chung", "NFR-USE-01 đến 06"],
    ["Bảo trì, kiểm thử", "Controller, Service, Repository; coverage unit ≥ 80% dòng và 75% nhánh; Pull Request và CI xanh mới được gộp; e2e trên PostgreSQL thật cho mã chạm cơ sở dữ liệu, tiền, quyền; OpenAPI sinh tự động", "NFR-MAINT-01 đến 06"],
    ["Triển khai, chuyển đổi", "Một lệnh docker compose up dựng cả hệ thống; cấu hình qua biến môi trường; tự triển khai khi gộp vào main; Vercel, Render, Neon", "NFR-PORT-01 đến 05"],
]
POLICY_ROWS = [
    ["Sinh viên (STUDENT)", "3", "14 ngày", "1 lần, thêm 7 ngày", "5.000 đồng mỗi ngày"],
    ["Giảng viên (LECTURER)", "5", "30 ngày", "1 lần, thêm 14 ngày", "5.000 đồng mỗi ngày"],
]
POLICY_HEADER = ["Loại bạn đọc", "Số cuốn tối đa", "Hạn mượn", "Gia hạn", "Mức phạt trễ"]

ACTORS = [
    ["1", "Khách (chưa đăng nhập)", "External Actor", "Tra cứu và xem chi tiết sách công khai; đăng ký tài khoản; yêu cầu đặt lại mật khẩu qua email."],
    ["2", "Bạn đọc (Reader: sinh viên, giảng viên)", "External Actor", "Đăng nhập; xem sách đang mượn, lịch sử, tiền phạt; tự gia hạn; đặt trước sách hết bản; nhận thông báo; nộp phạt trực tuyến; đánh giá sách; nhận gợi ý; sửa hồ sơ, đổi mật khẩu. Chỉ truy cập dữ liệu của chính mình."],
    ["3", "Thủ thư (Librarian)", "Internal Actor", "Quản lý sách, bản sao, tác giả, thể loại; cho mượn, nhận trả, báo mất, thu phạt tiền mặt; quản lý hàng đợi đặt trước; tạo bạn đọc, khoá và mở thẻ, cấp lại mật khẩu tạm; xuất báo cáo, in thẻ và nhãn, nhập sách từ tệp; xem báo cáo thống kê và dự báo nguy cơ trả trễ."],
    ["4", "Quản trị viên (Admin)", "System Actor", "Toàn bộ quyền của thủ thư; tạo tài khoản Librarian và Admin; cấu hình chính sách mượn theo loại bạn đọc; nhập sách theo ISBN; huấn luyện lại mô hình AI."],
    ["5", "AI Service", "System Partner", "Nhận yêu cầu từ Backend, trả về danh sách gợi ý và xác suất trả trễ; lấy dữ liệu huấn luyện từ Backend qua khoá nội bộ."],
    ["6", "Google Books API", "External Partner", "Cung cấp thông tin sách (tiêu đề, tác giả, mô tả, ảnh bìa) theo ISBN khi nhập hàng loạt."],
    ["7", "Cổng thanh toán VNPay", "External Partner", "Nhận bạn đọc nộp phạt trực tuyến; gọi lại Backend bằng IPN và return URL kèm chữ ký HMAC-SHA512."],
    ["8", "Dịch vụ email Resend", "External Partner", "Nhận yêu cầu gửi email từ Backend: đặt lại mật khẩu, chào mừng, nhắc hạn."],
]
USECASES = [
    ["Tài khoản", "UC-ACC-01", "Đăng ký và đăng nhập", "Khách, Bạn đọc", "Đăng ký bằng email, mã SV/GV; đăng nhập nhận JWT hạn 24 giờ; sai thông tin hoặc thẻ bị khoá thì bị từ chối; giới hạn 10 lần đăng nhập mỗi phút."],
    ["Tài khoản", "UC-ACC-02", "Quên và đặt lại mật khẩu", "Khách, Bạn đọc", "Gửi liên kết đặt lại qua email (hạn 1 giờ, dùng một lần); đặt lại xong thì các phiên cũ bị thu hồi."],
    ["Tài khoản", "UC-ACC-03", "Quản lý bạn đọc", "Thủ thư, Admin", "Tạo bạn đọc tại quầy, khoá và mở thẻ, cấp lại mật khẩu tạm buộc đổi ở lần đăng nhập đầu."],
    ["Danh mục", "UC-CAT-01", "Tra cứu sách", "Khách, Bạn đọc", "Tìm theo tiêu đề, tác giả, thể loại, ISBN; lọc sách còn trên kệ; phân trang; không cần đăng nhập."],
    ["Danh mục", "UC-CAT-02", "Quản lý đầu sách và bản sao", "Thủ thư", "Thêm, sửa, xoá đầu sách, tác giả, thể loại; quản lý bản sao theo mã vạch, trạng thái và vị trí kệ."],
    ["Danh mục", "UC-CAT-03", "Nhập sách hàng loạt", "Admin, Thủ thư", "Nhập theo danh sách ISBN qua Google Books hoặc từ tệp CSV, xlsx có xem trước và báo lỗi từng dòng."],
    ["Mượn trả", "UC-LOAN-01", "Cho mượn tại quầy", "Thủ thư", "Quét mã vạch bản sao và mã bạn đọc, kiểm tra điều kiện mượn, tạo phiếu, hiển thị nguy cơ trả trễ do AI dự báo."],
    ["Mượn trả", "UC-LOAN-02", "Nhận trả và tính phạt", "Thủ thư", "Nhận trả theo mã vạch; trả trễ thì tự tạo khoản phạt theo số ngày lịch; chuyển bản sao cho người đặt trước nếu có."],
    ["Mượn trả", "UC-LOAN-03", "Gia hạn sách", "Bạn đọc", "Tự gia hạn trong giới hạn số lần; không gia hạn được khi đã quá hạn hoặc còn nợ phạt."],
    ["Mượn trả", "UC-LOAN-04", "Báo mất sách", "Thủ thư", "Phiếu và bản sao chuyển trạng thái LOST, tạo khoản phạt bằng giá bìa cộng phạt trễ đến ngày báo."],
    ["Đặt trước", "UC-RES-01", "Đặt trước sách hết bản", "Bạn đọc", "Xếp hàng chờ; khi có người trả, bản sao được giữ 3 ngày cho người đứng đầu hàng đợi; tối đa 3 đặt trước cùng lúc."],
    ["Đặt trước", "UC-RES-02", "Thông báo và nhắc hạn", "Hệ thống", "Chuông thông báo trong web; nhắc sắp đến hạn, quá hạn, đặt trước sẵn sàng; email nhắc hạn có thể tắt."],
    ["Phạt", "UC-FIN-01", "Thu phạt tiền mặt", "Thủ thư", "Xem khoản phạt, ghi nhận đã thu; không thu hai lần; chặn khi khoản phạt đang trong giao dịch VNPay."],
    ["Phạt", "UC-FIN-02", "Nộp phạt trực tuyến", "Bạn đọc, VNPay", "Chuyển sang trang VNPay, xác nhận bằng IPN và return, kiểm tra chữ ký và số tiền ở máy chủ."],
    ["Báo cáo, AI", "UC-REP-01", "Thống kê và xuất dữ liệu", "Thủ thư", "Bốn báo cáo (sách mượn nhiều, quá hạn, lượt mượn theo tháng, tồn kho); xuất CSV, Excel; in thẻ và nhãn."],
    ["Báo cáo, AI", "UC-AI-01", "Gợi ý sách cá nhân hoá", "Bạn đọc, AI Service", "10 sách gợi ý theo lịch sử mượn và đánh giá; chưa có lịch sử thì gợi ý theo sách mượn nhiều."],
    ["Báo cáo, AI", "UC-ADM-01", "Cấu hình chính sách mượn", "Admin", "Đặt số cuốn, số ngày mượn, số lần gia hạn, mức phạt theo loại bạn đọc mà không cần sửa mã."],
]
UC_TEXT = [
    "**Tác nhân bên ngoài:** Khách, Bạn đọc, Thủ thư, Admin ở phía người dùng (quyền lồng nhau: Admin gồm cả quyền Thủ thư, Thủ thư gồm cả quyền tra cứu của Bạn đọc; các chức năng cá nhân như mượn, gia hạn, đặt trước, thanh toán chỉ dành cho tài khoản Bạn đọc); AI Service, Google Books, VNPay, Resend ở phía hệ thống ngoài.",
    "**Biên giới hệ thống (System Boundary):** Hệ thống Quản lý Thư viện Trường Đại học Xây dựng Miền Trung.",
    "**Quan hệ <<include>>:** use case 'Cho mượn tại quầy' <<include>> 'Kiểm tra điều kiện mượn (BR-01 đến BR-05)' và <<include>> 'Dự báo nguy cơ trả trễ' (AI, hết thời hạn 2 giây thì bỏ qua). 'Nộp phạt trực tuyến' <<include>> 'Xác minh chữ ký HMAC-SHA512'. 'Nhập sách hàng loạt' <<include>> 'Tra cứu Google Books'.",
    "**Quan hệ <<extend>>:** 'Nhận trả sách' được <<extend>> bởi 'Tạo khoản phạt' khi trả trễ và bởi 'Giữ bản sao cho người đặt trước' khi có hàng đợi. 'Đặt trước sách' chỉ thực hiện được khi sách hết bản. 'Gia hạn' bị từ chối khi quá hạn hoặc còn nợ phạt.",
]
UC_SPEC_INTRO = [
    "Tên Use Case: Cho mượn sách tại quầy (kèm dự báo nguy cơ trả trễ).",
    "Mục tiêu: cho phép thủ thư lập phiếu mượn nhanh và đúng quy định bằng mã vạch bản sao và mã bạn đọc.",
    "Tác nhân chính: Thủ thư. Tác nhân phụ: AI Service, Bạn đọc (người nhận sách).",
    "Điều kiện tiên quyết: thủ thư đã đăng nhập; bản sao có mã vạch hợp lệ; bạn đọc có tài khoản đang hoạt động.",
]
UC_FLOW = [
    "**Bước 1:** Thủ thư mở màn hình Quầy mượn trả, quét hoặc nhập mã vạch bản sao và mã bạn đọc.",
    "**Bước 2:** Thủ thư bấm 'Tạo phiếu mượn'.",
    "**Bước 3:** Hệ thống khoá hàng bạn đọc và kiểm tra BR-01 đến BR-05: thẻ không bị khoá, chưa vượt hạn mức, không có sách quá hạn, không nợ phạt, bản sao đang sẵn sàng.",
    "**Bước 4:** Hệ thống gọi AI Service lấy xác suất trả trễ (chờ tối đa 2 giây).",
    "**Bước 5:** Trong một giao dịch cơ sở dữ liệu, hệ thống tạo phiếu ACTIVE với hạn trả = hôm nay + số ngày của chính sách, chuyển bản sao sang BORROWED; nếu bản sao đang giữ cho chính bạn đọc này thì đặt trước chuyển sang FULFILLED.",
    "**Bước 6:** Hệ thống hiển thị phiếu mượn, hạn trả và điểm nguy cơ trả trễ (màu theo mức).",
]
UC_EXC = [
    "**A1 (Vượt hạn mức):** bạn đọc đã mượn đủ số cuốn, hệ thống trả 409 với mã LOAN_LIMIT_REACHED, không tạo phiếu.",
    "**A2 (Còn sách quá hạn hoặc nợ phạt):** hệ thống trả 409 với mã HAS_OVERDUE_LOAN hoặc UNPAID_FINE; thủ thư hướng dẫn bạn đọc trả sách hoặc nộp phạt trước.",
    "**A3 (Bản sao không sẵn sàng):** bản sao đang được mượn hoặc đang giữ cho người khác, hệ thống trả 409 với mã COPY_NOT_AVAILABLE hoặc COPY_HELD.",
    "**A4 (Thẻ bị khoá):** hệ thống trả 409 với mã ACCOUNT_LOCKED khi cho mượn (đăng nhập bằng thẻ khoá trả 403).",
    "**A5 (AI không phản hồi):** sau 2 giây hệ thống vẫn tạo phiếu và để điểm nguy cơ trống (null); việc mượn không bị chặn bởi AI.",
    "**A6 (Hai quầy thao tác đồng thời):** chỉ một yêu cầu thành công, yêu cầu còn lại nhận mã lỗi nghiệp vụ tương ứng (khoá hàng và cập nhật có điều kiện).",
]

WBS_FUNC = [
    ["1.0", "HỆ THỐNG QUẢN LÝ THƯ VIỆN TRƯỜNG ĐẠI HỌC XÂY DỰNG MIỀN TRUNG", "L1", "Hệ thống web chạy thật gồm Frontend, Backend, AI Service và cơ sở dữ liệu."],
    ["1.1", "Phân hệ Tài khoản và Phân quyền", "L2", "Đăng ký, đăng nhập, ba vai trò, quản lý bạn đọc."],
    ["1.1.1", "Khối Xác thực và phân quyền", "L3", "JWT, RBAC, khoá thẻ có hiệu lực ngay."],
    ["1.1.1.1", "Xây dựng API đăng ký, đăng nhập, phân quyền", "L4", "bcrypt, JWT 24 giờ, đọc lại tài khoản mỗi yêu cầu, giới hạn tần suất."],
    ["1.1.1.2", "Xây dựng giao diện đăng nhập, đăng ký, hồ sơ", "L4", "Các trang Next.js có kiểm tra dữ liệu nhập."],
    ["1.1.2", "Khối Mật khẩu và email", "L3", "Quên, đặt lại, đổi mật khẩu; mật khẩu tạm."],
    ["1.1.2.1", "Xây dựng luồng quên, đặt lại, đổi mật khẩu", "L4", "Token 32 byte chỉ lưu SHA-256, hạn 1 giờ, dùng một lần; thu hồi phiên cũ."],
    ["1.1.2.2", "Tích hợp dịch vụ email Resend", "L4", "Gọi HTTP API, Idempotency-Key, giãn cách giữa các thư nhắc hạn."],
    ["1.2", "Phân hệ Danh mục Sách và Bản sao", "L2", "Kho sách đầy đủ và chính xác."],
    ["1.2.1", "Khối Quản lý đầu sách, tác giả, thể loại, bản sao", "L3", "CRUD với các ràng buộc xoá."],
    ["1.2.1.1", "Xây dựng API và giao diện CRUD đầu sách, tác giả, thể loại", "L4", "Mã lỗi nghiệp vụ rõ ràng (BOOK_HAS_ACTIVE_LOANS, CATEGORY_IN_USE)."],
    ["1.2.1.2", "Xây dựng quản lý bản sao, mã vạch, vị trí kệ, in nhãn", "L4", "Mã vạch duy nhất; nhãn Code 128 và QR."],
    ["1.2.2", "Khối Nhập dữ liệu sách", "L3", "Nạp nhanh kho sách."],
    ["1.2.2.1", "Nhập theo ISBN (Google Books) và dữ liệu mẫu goodbooks-10k", "L4", "Báo cáo ISBN không tìm thấy hoặc trùng, không dừng cả lô."],
    ["1.2.2.2", "Nhập hàng loạt từ CSV, xlsx có xem trước", "L4", "Kiểm tra loại tệp, kích thước, báo lỗi từng dòng."],
    ["1.3", "Phân hệ Mượn trả và Phạt", "L2", "Nghiệp vụ lõi của thư viện."],
    ["1.3.1", "Khối Mượn, trả, gia hạn, báo mất", "L3", "Quy tắc BR-01 đến BR-08."],
    ["1.3.1.1", "Xây dựng nghiệp vụ mượn trả theo quy tắc BR", "L4", "Giao dịch nguyên tử; khoá hàng chống đua; kiểm thử đua song song."],
    ["1.3.1.2", "Xây dựng màn hình Quầy mượn trả cho thủ thư", "L4", "Thao tác bằng mã vạch, hiển thị nguy cơ trả trễ."],
    ["1.3.2", "Khối Tính phạt và thu phạt", "L3", "Công nợ minh bạch."],
    ["1.3.2.1", "Xây dựng tính phạt theo ngày lịch và thu phạt tiền mặt", "L4", "Khoản phạt OVERDUE, LOST; không thu hai lần."],
    ["1.3.2.2", "Tích hợp nộp phạt trực tuyến qua VNPay", "L4", "HMAC-SHA512, IPN và return idempotent, đánh dấu cần hoàn tiền."],
    ["1.4", "Phân hệ Đặt trước và Thông báo", "L2", "Giữ sách cho bạn đọc và nhắc việc."],
    ["1.4.1", "Khối Đặt trước sách", "L3", "Hàng đợi công bằng."],
    ["1.4.1.1", "Xây dựng hàng đợi đặt trước và giữ bản sao 3 ngày", "L4", "Trạng thái HELD, SKIP LOCKED khi chọn người đứng đầu."],
    ["1.4.2", "Khối Thông báo và nhắc hạn", "L3", "Giảm trả trễ."],
    ["1.4.2.1", "Xây dựng chuông thông báo và email nhắc hạn", "L4", "Nhắc sắp đến hạn, quá hạn; bạn đọc tắt được email."],
    ["1.5", "Phân hệ Tra cứu, Báo cáo và Xuất dữ liệu", "L2", "Tìm nhanh và có số liệu quản lý."],
    ["1.5.1", "Khối Tra cứu", "L3", "Tìm kiếm dưới 1 giây."],
    ["1.5.1.1", "Xây dựng tìm kiếm pg_trgm, lọc, phân trang", "L4", "Chỉ mục GIN trên tiêu đề, ISBN, tác giả."],
    ["1.5.2", "Khối Báo cáo và xuất dữ liệu", "L3", "Số liệu cho quản lý thư viện."],
    ["1.5.2.1", "Xây dựng bốn báo cáo thống kê và bảng điều khiển", "L4", "Gộp bằng SQL, biểu đồ tải theo yêu cầu."],
    ["1.5.2.2", "Xây dựng xuất CSV, Excel, in thẻ bạn đọc và nhãn mã vạch", "L4", "Chống formula injection; trần 100.000 dòng mỗi lần xuất."],
    ["1.6", "Phân hệ Trí tuệ nhân tạo", "L2", "Hai mô hình học máy."],
    ["1.6.1", "Khối Gợi ý sách", "L3", "Cá nhân hoá danh sách sách."],
    ["1.6.1.1", "Xây dựng mô hình lai TF-IDF và item-based CF", "L4", "Precision@5 từ 0,15."],
    ["1.6.2", "Khối Dự báo trả trễ", "L3", "Hỗ trợ thủ thư khi cho mượn."],
    ["1.6.2.1", "Xây dựng mô hình hồi quy logistic, rừng ngẫu nhiên và cơ chế dự phòng", "L4", "ROC-AUC từ 0,70; AI lỗi thì vẫn cho mượn."],
    ["1.7", "Phân hệ Hạ tầng, Bảo mật và Chất lượng", "L2", "Chạy ổn định, an toàn và kiểm chứng được."],
    ["1.7.1", "Khối Đóng gói, triển khai và CI/CD", "L3", "Dựng được bằng một lệnh, lên môi trường thật."],
    ["1.7.1.1", "Xây dựng Docker Compose và GitHub Actions", "L4", "4 job kiểm tra rồi mới triển khai trên nhánh main."],
    ["1.7.1.2", "Triển khai Vercel, Render, Neon", "L4", "Địa chỉ trực tuyến truy cập được, có kiểm tra sức khoẻ."],
    ["1.7.2", "Khối Bảo mật và bảo vệ dữ liệu bạn đọc", "L3", "Chi tiết ở {S:ch7}."],
    ["1.7.3", "Khối Kiểm thử và chất lượng", "L3", "Kiểm chứng bằng ca kiểm thử tự động."],
    ["1.7.3.1", "Xây dựng kiểm thử đơn vị, e2e trên cơ sở dữ liệu thật, kiểm thử đua", "L4", "Ngưỡng coverage 80% dòng và 75% nhánh trong CI."],
]
WBS_MAP = [
    ["1.1 Tài khoản và Phân quyền", "4.1.1 Backend nền (H); 4.2.1 Frontend khung (J)"],
    ["1.2 Danh mục Sách và Bản sao", "4.1.1 Backend nền (H); 4.2.1 Frontend khung, kho (J)"],
    ["1.3 Mượn trả và Phạt (trừ 1.3.2.2)", "4.1.2 Backend mượn trả (I); 4.2.2 Frontend quầy (K)"],
    ["1.4 Đặt trước và Thông báo; 1.3.2.2 VNPay", "Bổ sung sau đường cơ sở 1.0, chưa nằm trong 20 gói"],
    ["1.5 Tra cứu, Báo cáo, Xuất dữ liệu", "4.1.2 (I); 4.2.1, 4.2.2 (J, K)"],
    ["1.6 Trí tuệ nhân tạo", "3.1.3 Thiết kế mô hình AI (G); 4.3.1 AI (L); 4.3.2 Tích hợp (M)"],
    ["1.7 Hạ tầng, Bảo mật, Chất lượng", "1.1.2 Dựng môi trường (B); 5.1.1, 5.1.2 Kiểm thử (N, O); 6.1.1, 6.1.2 Docker, cloud (Q, P)"],
]

# ------------------------------------------------------------------ chương 6
COMPONENTS = [
    ["API Gateway", "Một cổng vào duy nhất: '/' tới frontend, '/api/*' tới backend, '/ai/*' tới AI service", "Nginx (cục bộ, cổng 8080); trên cloud: Vercel chuyển tiếp /api và /ai"],
    ["Frontend", "Giao diện cho 3 vai trò; trang công khai dựng phía máy chủ", "Next.js 15 App Router, TypeScript, TailwindCSS 4, TanStack Query; Vercel"],
    ["Backend API", "Nguồn sự thật duy nhất: toàn bộ quy tắc nghiệp vụ, xác thực, phân quyền, Swagger, việc định kỳ 15 phút", "NestJS 10, Prisma 6, Passport-JWT, class-validator; Render"],
    ["AI Service", "Gợi ý sách, dự báo nguy cơ trả trễ; lấy dữ liệu huấn luyện từ Backend", "FastAPI, scikit-learn, pandas; Render"],
    ["Cơ sở dữ liệu", "Lưu trữ quan hệ, 16 bảng chuẩn 3NF, extension pg_trgm", "PostgreSQL 16; Neon"],
    ["Google Books API", "Thông tin sách theo ISBN khi nhập sách", "HTTPS, API key; không triển khai riêng"],
    ["Resend", "Gửi email: đặt lại mật khẩu, chào mừng, nhắc hạn", "HTTP API; không triển khai riêng"],
    ["VNPay", "Cổng thanh toán phạt trực tuyến (sandbox)", "URL ký HMAC-SHA512, IPN và return; không triển khai riêng"],
]
LAYERS = [
    ["Controller", "Nhận HTTP, kiểm tra DTO, kiểm tra JWT và vai trò (Guard), gọi Service, trả DTO", "Chứa logic nghiệp vụ, truy vấn cơ sở dữ liệu"],
    ["Service", "Toàn bộ quy tắc nghiệp vụ, giao dịch, gọi AI và Google Books qua client", "Biết về HTTP (request, response)"],
    ["Repository (Prisma)", "Truy vấn qua Prisma Client; mỗi Service dùng PrismaService", "Chứa quy tắc nghiệp vụ"],
]
CROSS_CUTTING = "Thành phần cắt ngang, theo thứ tự guard toàn cục: ThrottlerGuard (100 yêu cầu mỗi phút mỗi IP, siết riêng từng route), JwtAuthGuard, MustChangePasswordGuard (tài khoản dùng mật khẩu tạm chỉ được xem hồ sơ và đổi mật khẩu), RolesGuard (Admin bao hàm Librarian; route chỉ ghi Reader là dành riêng cho bạn đọc). Pipe toàn cục: ValidationPipe (whitelist, từ chối trường lạ, ép kiểu) và RejectNullBytePipe (từ chối ký tự NUL). HttpExceptionFilter thống nhất định dạng lỗi và đổi lỗi cơ sở dữ liệu đã biết sang 4xx. Ngoài ra có Swagger tại /api/docs, ConfigModule (biến môi trường) và CirculationScheduler (việc định kỳ)."
MODULES = [
    ["auth (kèm đặt lại mật khẩu)", "/api/auth", "F1, F13"],
    ["users", "/api/users", "F3, F13"],
    ["books (kèm nhập từ tệp), authors, categories, copies (kèm nhãn)", "/api/books, /api/authors, /api/categories, /api/copies", "F2, F5, F15, F16"],
    ["loans", "/api/loans", "F4"],
    ["fines", "/api/fines", "F4"],
    ["reservations", "/api/reservations", "F11"],
    ["notifications (kèm bộ lập lịch, email nhắc hạn)", "/api/notifications", "F12"],
    ["mail (Resend, mẫu thư)", "không có route, dùng nội bộ", "F12, F13"],
    ["payments", "/api/payments", "F14"],
    ["exports", "/api/exports", "F15"],
    ["policies", "/api/policies", "F8"],
    ["ratings", "/api/books/:id/ratings", "F7"],
    ["reports", "/api/reports", "F6"],
    ["recommendations, ai (AiClient)", "/api/recommendations", "F9, F10"],
    ["internal", "/api/internal", "Cấp dữ liệu huấn luyện cho AI"],
    ["health", "/api/health", "Giám sát"],
]
COMMS = [
    ["Frontend tới Backend", "REST/JSON, HTTPS; Bearer JWT, CORS theo danh sách trắng", "Không có"],
    ["Backend tới AI Service", "REST/JSON nội bộ", "predict-overdue chờ 2 giây, quá hạn thì risk = null; recommend chờ 3 giây, quá hạn thì danh sách rỗng"],
    ["AI Service tới Backend", "REST/JSON, header X-Internal-Key", "Không có dữ liệu thì giữ mô hình cũ"],
    ["Backend tới Google Books", "HTTPS, API key", "Không tìm thấy thì bỏ qua ISBN đó và báo lại"],
    ["Backend tới Resend", "HTTPS, Bearer API key, Idempotency-Key", "Thiếu khoá thì bỏ qua có ghi log; email nhắc hạn thử lại tối đa 5 lần"],
    ["Trình duyệt tới VNPay", "Chuyển hướng tới paymentUrl ký HMAC-SHA512", "Không đủ cấu hình: 503 PAYMENT_NOT_CONFIGURED, giao diện ẩn nút"],
    ["VNPay tới Backend", "GET /api/payments/vnpay/ipn và /return; xác thực bằng chữ ký và số tiền", "IPN lặp lại an toàn (idempotent)"],
    ["Backend tới PostgreSQL", "Prisma, chuỗi kết nối trong biến môi trường", "Giao dịch cho mượn, trả, phạt"],
]
DB_TABLES = [
    ["users", "Mọi tài khoản: bạn đọc, thủ thư, admin; cờ mật khẩu tạm, mốc thu hồi phiên", "email, member_code duy nhất; GIN pg_trgm trên tên, email, mã thẻ"],
    ["loan_policies", "Chính sách mượn theo loại bạn đọc", "member_type duy nhất"],
    ["authors, categories", "Tác giả; thể loại", "name, slug duy nhất; GIN pg_trgm trên tên tác giả"],
    ["books", "Đầu sách (ISBN, giá bìa dùng tính phạt mất)", "isbn duy nhất; GIN pg_trgm trên tiêu đề, ISBN"],
    ["book_authors", "Quan hệ n-n sách và tác giả", "Khoá phức (book_id, author_id)"],
    ["book_copies", "Bản sao vật lý có mã vạch; trạng thái AVAILABLE, BORROWED, LOST, MAINTENANCE, HELD", "barcode duy nhất; chỉ mục (book_id, status)"],
    ["loans", "Phiếu mượn: hạn trả, số lần gia hạn, nguy cơ trả trễ dự báo", "Chỉ mục (user_id, status), (status, due_at), (copy_id)"],
    ["fines", "Khoản phạt OVERDUE hoặc LOST", "paid_to rỗng khi thu qua VNPay"],
    ["ratings", "Đánh giá 1 đến 5 sao", "Duy nhất (user_id, book_id)"],
    ["reservations", "Đặt trước: WAITING, READY, FULFILLED, CANCELLED, EXPIRED", "Chỉ mục (book_id, status, created_at) cho hàng đợi"],
    ["notifications", "Thông báo trong web", "dedupe_key duy nhất chống gửi trùng"],
    ["password_reset_tokens", "Token đặt lại mật khẩu, chỉ lưu SHA-256", "token_hash duy nhất; hạn 1 giờ"],
    ["reminder_emails", "Trạng thái email nhắc hạn theo phiếu và loại", "Duy nhất (loan_id, kind)"],
    ["payments", "Giao dịch thanh toán VNPay; số tiền do máy chủ tính", "txn_ref duy nhất; CHECK amount > 0"],
    ["payment_fines", "Quan hệ n-n giao dịch và khoản phạt", "Chỉ mục duy nhất từng phần: một khoản phạt thuộc tối đa một giao dịch hoạt động"],
]
DB_NORMAL = [
    "**1NF:** mọi cột nguyên tử; danh sách tác giả không lưu chuỗi 'A, B' mà tách bảng book_authors.",
    "**2NF:** bảng có khoá phức book_authors không có cột phụ thuộc một phần khoá.",
    "**3NF:** không có phụ thuộc bắc cầu: thông tin thể loại tách categories; chính sách mượn tách loan_policies thay vì lặp trong users; tiền phạt tách fines thay vì cột trong loans (một phiếu có thể vừa phạt trễ vừa phạt mất).",
    "**Dẫn xuất không lưu:** trạng thái quá hạn tính từ due_at và returned_at (BR-09); số bản còn tính từ trạng thái bản sao; vị trí trong hàng đợi đặt trước tính từ thứ tự đặt trước.",
    "**Dư thừa có chủ đích:** reservations.copy_id và book_copies.status = HELD cùng mô tả một bản sao đang được giữ; hai giá trị luôn đổi trong cùng một giao dịch và cùng thứ tự khoá để không lệch và không bế tắc.",
]
CLASS_TEXT = "Sơ đồ lớp gồm hai gói: Domain (các entity ánh xạ một-một với Prisma schema, có phương thức dẫn xuất isOverdue, overdueDays) và Application (các Service của NestJS và hai client ra ngoài AiClient, GoogleBooksClient). LoansService là lớp trung tâm của nghiệp vụ, phụ thuộc PoliciesService (lấy chính sách), FinesService (tính và tạo phạt), CopiesService (đổi trạng thái bản sao), AiClient (dự báo) và ReservationsService (giữ bản sao cho người đặt trước). Các service thêm sau MVP (ReservationsService, NotificationsService, PaymentsService, ExportsService, BookImportService, MailService, PasswordResetService) cùng theo mẫu Controller, Service, Prisma và được mô tả bằng các sơ đồ tuần tự."
SEQUENCES = [
    ("sequence-borrow.png", "Sequence: cho mượn sách tại quầy kèm dự báo trả trễ (US07, US19)",
     "Luồng phức tạp nhất: 5 điều kiện chặn (BR-01 đến BR-05), gọi AI có thời hạn chờ và giao dịch gồm tạo phiếu và đổi trạng thái bản sao."),
    ("sequence-return-fine.png", "Sequence: nhận trả sách, tính phạt, thu tiền (US08, US12)",
     "Trả sách làm bản sao về AVAILABLE hoặc sang HELD nếu có người đặt trước; trả trễ thì tạo khoản phạt theo ngày lịch."),
    ("sequence-recommend.png", "Sequence: gợi ý sách cá nhân hoá (US18)",
     "Hai pha: huấn luyện (AI Service kéo dữ liệu từ Backend) và phục vụ gợi ý (Backend gọi AI, làm giàu kết quả bằng dữ liệu sách thật, dự phòng khi AI lỗi)."),
    ("sequence-reservation.png", "Sequence: đặt trước, giữ sách và nhận sách (US21, US22, US24)",
     "Bạn đọc đặt trước (khoá hàng bạn đọc để kiểm hạn mức), bản sao được trả về và giữ cho người đứng đầu hàng đợi (FOR UPDATE SKIP LOCKED), nhận sách tại quầy, hết hạn giữ do bộ lập lịch."),
    ("sequence-vnpay-payment.png", "Sequence: nộp phạt trực tuyến qua VNPay (US30, US31)",
     "Số tiền tính ở máy chủ trong giao dịch có khoá dòng; IPN và return cùng đi qua một hàm chốt giao dịch idempotent; tiền về muộn được gắn cờ hoàn tiền thay vì thu hai lần."),
]
API_CONVENTIONS = [
    "**Địa chỉ:** base URL /api (cục bộ http://localhost:8080/api); Swagger UI tại /api/docs, OpenAPI JSON tại /api/docs-json.",
    "**Định dạng:** JSON UTF-8; ngày giờ ISO 8601 (UTC); tiền là số nguyên đồng; tham số lọc theo ngày dạng YYYY-MM-DD hiểu theo giờ thư viện (UTC+7).",
    "**Xác thực:** Authorization: Bearer JWT, hạn 24 giờ; backend đọc lại tài khoản ở mọi yêu cầu nên khoá thẻ và đổi quyền có hiệu lực ngay.",
    "**Phân trang:** ?page=1&limit=20 (limit từ 1 đến 100) trả {items, total, page, limit}.",
    "**Giới hạn tần suất theo IP mỗi phút:** chung 100; đăng nhập 10; đổi mật khẩu 5; quên mật khẩu 5; đặt lại mật khẩu 10; tạo bạn đọc 30; cấp lại mật khẩu tạm 30; tạo giao dịch thanh toán 30. IPN và return của VNPay không giới hạn vì chỉ xác thực bằng chữ ký.",
]
API_CODES = [
    ["200, 201", "Thành công, tạo mới"],
    ["400", "Dữ liệu vào không hợp lệ (message là mảng lỗi từng trường)"],
    ["401", "Thiếu, sai, hết hạn hoặc bị thu hồi JWT; tài khoản đã khoá"],
    ["403", "Đúng JWT nhưng sai vai trò, hoặc truy cập dữ liệu người khác"],
    ["404", "Không tìm thấy tài nguyên"],
    ["409", "Vi phạm quy tắc nghiệp vụ hoặc trùng dữ liệu; error là mã nghiệp vụ"],
    ["413, 415, 422", "Tệp hoặc thân yêu cầu quá lớn; loại tệp không nhận; tệp nhập sai cấu trúc hoặc vượt trần"],
    ["429", "Vượt giới hạn tần suất (TOO_MANY_REQUESTS)"],
    ["500, 503", "Lỗi hệ thống; dịch vụ phụ thuộc không khả dụng (AI_UNAVAILABLE, PAYMENT_NOT_CONFIGURED)"],
]
ERROR_JSON = "\n".join([
    "{",
    '  "statusCode": 409,',
    '  "error": "UNPAID_FINE",',
    '  "message": "Bạn đọc còn 15.000đ phạt chưa thanh toán",',
    '  "path": "/api/loans",',
    '  "timestamp": "2026-10-01T08:30:00.000Z"',
    "}",
])
API_GROUPS = {  # tag OpenAPI: (tên nhóm, mô tả)
    "health": ("Giám sát", "Kiểm tra trạng thái backend và cơ sở dữ liệu"),
    "auth": ("Xác thực", "Đăng ký, đăng nhập, hồ sơ, đổi, quên và đặt lại mật khẩu"),
    "users": ("Bạn đọc, nhân sự", "Danh sách, hồ sơ, khoá thẻ, tạo bạn đọc tại quầy, cấp lại mật khẩu tạm"),
    "policies": ("Chính sách mượn", "Xem và sửa số cuốn, hạn mượn, gia hạn, mức phạt"),
    "books": ("Đầu sách", "Tra cứu, thêm, sửa, xoá, nhập theo ISBN và từ tệp, bản sao"),
    "authors": ("Tác giả", "Tra cứu và quản lý tác giả"),
    "categories": ("Thể loại", "Tra cứu và quản lý thể loại"),
    "copies": ("Bản sao", "Đổi trạng thái, vị trí kệ, dữ liệu in nhãn mã vạch"),
    "loans": ("Phiếu mượn", "Cho mượn, nhận trả, báo mất, gia hạn, tra cứu"),
    "fines": ("Khoản phạt", "Xem phạt của mình, danh sách phạt, thu tiền mặt"),
    "ratings": ("Đánh giá", "Chấm sao sách đã mượn, điểm trung bình"),
    "reports": ("Báo cáo", "Sách mượn nhiều, quá hạn, lượt mượn theo tháng, tồn kho"),
    "reservations": ("Đặt trước", "Đặt trước, xem hàng đợi, huỷ"),
    "notifications": ("Thông báo", "Danh sách, đánh dấu đã đọc"),
    "payments": ("Thanh toán VNPay", "Tạo giao dịch, lịch sử, huỷ, IPN và return của VNPay"),
    "recommendations": ("Gợi ý và dự báo", "Gợi ý sách, huấn luyện lại, số đo mô hình, độ chính xác dự báo"),
    "internal": ("Nội bộ", "Cấp dữ liệu huấn luyện cho AI Service"),
    "exports": ("Xuất dữ liệu", "Xuất 7 bộ dữ liệu ra CSV hoặc Excel"),
}
SECURITY_DESIGN = [
    ["Lộ mật khẩu", "bcrypt; không bao giờ trả passwordHash qua API (DTO phản hồi tách riêng)"],
    ["Giả mạo token, dùng lại token cũ", "JWT HS256 hạn 24 giờ, khoá bí mật trong biến môi trường; đọc lại tài khoản ở mọi yêu cầu (khoá, xoá, hạ quyền có hiệu lực ngay); đặt lại mật khẩu thu hồi mọi phiên cũ"],
    ["Leo thang quyền", "RolesGuard theo vai trò; bạn đọc chỉ truy cập dữ liệu của mình; thủ thư không sửa tài khoản nhân sự, không tự khoá mình"],
    ["Dữ liệu vào độc hại", "ValidationPipe (whitelist), Prisma tham số hoá, từ chối ký tự NUL và id ngoài miền, thoát ký tự đặc biệt khi tìm kiếm"],
    ["Brute-force, lạm dụng API", "Giới hạn tần suất theo IP, siết riêng đăng nhập, đổi, quên, đặt lại mật khẩu"],
    ["Dò email đã đăng ký", "Quên mật khẩu luôn trả cùng một phản hồi và san phẳng thời gian; đăng nhập chạy bcrypt cả khi email không tồn tại"],
    ["Lộ hoặc đoán token đặt lại mật khẩu", "Token 32 byte ngẫu nhiên, chỉ lưu SHA-256, dùng một lần, hạn 1 giờ; yêu cầu mới vô hiệu token cũ"],
    ["Chạy đua dữ liệu", "Khoá hàng bạn đọc FOR UPDATE, cập nhật có điều kiện, SKIP LOCKED chọn người đầu hàng đợi, khoá advisory khi nhập sách, chỉ mục duy nhất từng phần; thứ tự khoá thống nhất để không bế tắc; có 12 ca đua trên PostgreSQL thật"],
    ["Giả mạo thanh toán, thu hai lần", "Ký và kiểm tra HMAC-SHA512 ở IPN và return; số tiền tính lại ở máy chủ; một hàm chốt giao dịch idempotent; tiền về muộn gắn cờ hoàn tiền"],
    ["Formula injection, tệp độc hại", "Vô hiệu ô CSV bắt đầu bằng ký tự công thức; nhận diện tệp bằng magic bytes, giới hạn 5 MB và 5.000 dòng, từ chối macro, không thực thi công thức"],
    ["Mở chuyển hướng, nhúng khung, đoán nội dung", "Chặn open redirect; header X-Frame-Options, X-Content-Type-Options, Referrer-Policy"],
    ["Lộ bí mật", "Khoá JWT, Resend, VNPay, khoá nội bộ chỉ ở biến môi trường; log không chứa nội dung thư, token, khoá"],
]
ADR = [
    ["Modular monolith cộng AI tách riêng, không dùng 4 đến 5 microservice", "Nghiệp vụ cần giao dịch chung; nhóm nhỏ; hạ tầng miễn phí; AI khác ngôn ngữ và được phép lỗi"],
    ["'Quá hạn' là trạng thái dẫn xuất, đếm theo ngày lịch", "Tránh cron và trạng thái lệch; phạt theo ngày lịch đúng cách thư viện tính; một hàm chung cho API và báo cáo"],
    ["Chính sách mượn nằm trong bảng, chụp vào phiếu lúc tạo", "Admin đổi qua giao diện mà phiếu cũ không bị ảnh hưởng"],
    ["Gọi AI có thời hạn chờ và dự phòng", "Render miễn phí khởi động lạnh khoảng 50 giây, không được chặn quầy; overdueRisk có thể null"],
    ["Email qua Resend (HTTP API) thay vì SMTP", "Render gói miễn phí chặn cổng SMTP; có Idempotency-Key nên gửi lại không phát hai thư"],
    ["Return và IPN của VNPay cùng chốt giao dịch qua một hàm idempotent", "Sandbox thường không gọi được IPN và bạn đọc có thể đóng tab; hai đường phải cho cùng kết quả"],
    ["Chống đua bằng khoá hàng và cập nhật có điều kiện, không dùng khoá bộ nhớ hay SERIALIZABLE", "Backend có thể chạy nhiều instance; PostgreSQL là nơi duy nhất phân xử"],
    ["Tìm kiếm bằng GIN pg_trgm và truy vấn UNION ba chỉ mục", "Điều kiện OR do Prisma sinh ra buộc quét tuần tự; từ khoá hiếm trên 50.000 sách giảm từ 258 ms xuống 9,6 ms"],
]
DEPLOY_ROWS = [
    ["Cục bộ", "docker compose up --build", "5 container: postgres, backend, ai-service, frontend, gateway (Nginx, cổng 8080)"],
    ["CI", "GitHub Actions: .github/workflows/ci-cd.yml", "4 job song song (backend, ai-service, frontend, compose-smoke), sau đó job deploy chỉ chạy trên main"],
    ["Frontend", "Vercel: https://muce-library.vercel.app", "Dựng tự động khi gộp vào main; chuyển tiếp /api và /ai sang Render"],
    ["Backend, AI", "Render (Docker, vùng Singapore)", "Deploy Hook do job deploy gọi; gói miễn phí ngủ sau 15 phút không dùng"],
    ["Cơ sở dữ liệu", "Neon (PostgreSQL 16)", "Sao lưu hằng ngày; dữ liệu mẫu dựng lại bằng script seed"],
]

# ------------------------------------------------------------------ chương 7
SEC_CONTEXT = [
    "Hệ thống lưu dữ liệu cá nhân của bạn đọc: họ tên, email, mã sinh viên hoặc giảng viên, loại bạn đọc, mật khẩu (chỉ dạng băm bcrypt), lịch sử mượn trả (phản ánh sở thích đọc), khoản phạt và giao dịch thanh toán. Hệ thống không lưu số thẻ ngân hàng vì việc nhập thẻ diễn ra trên trang của VNPay. Dù không chứa dữ liệu nhạy cảm như bệnh án hay sinh trắc học, khối dữ liệu này đủ để bị lợi dụng cho lừa đảo hoặc chiếm tài khoản, và việc xử lý nó phải tuân thủ quy định về dữ liệu cá nhân.",
]
SEC_THREATS = [
    "**Rò rỉ dữ liệu (Data Breach):** kẻ tấn công khai thác lỗ hổng truy vấn hoặc cấu hình để đọc hồ sơ bạn đọc.",
    "**Chiếm tài khoản (Account Takeover):** đoán mật khẩu, tái sử dụng mật khẩu bị lộ, đánh cắp JWT; tài khoản thủ thư hoặc Admin bị chiếm gây hậu quả lớn hơn nhiều.",
    "**Rủi ro từ con người (Insider Threat):** nhân sự có quyền tra cứu hồ sơ bạn đọc không cần thiết cho công việc, hoặc dùng quyền thủ thư sai mục đích.",
    "**Giả mạo thanh toán và tấn công qua API bên thứ ba:** gọi giả IPN, sửa số tiền, phát lại giao dịch để gạch nợ phạt trái phép; khoá API Resend hoặc VNPay bị lộ.",
    "**Tệp nhập, xuất độc hại:** tệp CSV hoặc xlsx chứa công thức độc hại (formula injection), tệp nén bất thường khi nhập sách hàng loạt.",
]
SEC_LEGAL = [
    "**Luật Bảo vệ dữ liệu cá nhân (Luật số 91/2025/QH15, có hiệu lực từ 01/01/2026) và Nghị định 356/2025/NĐ-CP hướng dẫn thi hành (thay thế Nghị định 13/2023/NĐ-CP):** quy định quyền của chủ thể dữ liệu (được biết, đồng ý, truy cập, chỉnh sửa, xoá, rút lại sự đồng ý), nghĩa vụ thông báo mục đích xử lý, bảo vệ dữ liệu và lập hồ sơ đánh giá tác động xử lý dữ liệu cá nhân.",
    "**Luật Thư viện 2019 (Luật số 46/2019/QH14):** khung pháp lý của hoạt động thư viện, trong đó có quyền của người sử dụng thư viện và bảo vệ thông tin cá nhân của bạn đọc.",
    "**Luật An ninh mạng 2025 (Luật số 116/2025/QH15, có hiệu lực từ 01/7/2026, thay thế Luật An ninh mạng 2018 và hợp nhất quy định về an toàn thông tin mạng):** yêu cầu bảo đảm an toàn hệ thống thông tin; hệ thống thư viện của trường dự kiến thuộc mức bảo vệ thấp, cấp độ cụ thể cần được cơ quan chủ quản của trường xác nhận theo văn bản hướng dẫn hiện hành.",
]
SEC_LEGAL_NOTE = "Lưu ý: các văn bản pháp luật trên do nhóm tổng hợp phục vụ học phần (đã đối chiếu số hiệu và ngày hiệu lực với nguồn công khai), không phải tư vấn pháp lý; cần đối chiếu văn bản hiện hành và văn bản hướng dẫn trước khi áp dụng thực tế."
SEC_RISK_INTRO = "Bảng đánh giá theo phương pháp định lượng: mức rủi ro = xác suất (P, thang 1 đến 5) x ảnh hưởng (I, thang 1 đến 5). Thang bốn bậc: Rất cao từ 15, Cao từ 10 đến 14, Trung bình từ 5 đến 9, Thấp dưới 5 (chi tiết hơn thang ba bậc của sổ rủi ro dự án ở {T:md:3.1} vì cần phân biệt rủi ro bảo mật)."
SEC_RISKS = [
    ["R-SEC-01", "Rò rỉ dữ liệu do lỗi truy vấn hoặc cấu hình", "2", "5", "Cao (10)", "Prisma tham số hoá, kiểm tra đầu vào (từ chối trường lạ và ký tự NUL), CORS theo danh sách trắng, HTTPS, header bảo mật; kiểm thử tự động cho các lỗi đã biết."],
    ["R-SEC-02", "Chiếm tài khoản (đoán mật khẩu, lộ JWT)", "3", "4", "Cao (12)", "bcrypt, giới hạn 10 lần đăng nhập mỗi phút, JWT hạn 24 giờ và đọc lại tài khoản mỗi yêu cầu, thu hồi phiên khi đặt lại mật khẩu, token đặt lại chỉ lưu SHA-256 và dùng một lần, mật khẩu tạm buộc đổi."],
    ["R-SEC-03", "Lạm quyền của nhân sự (Insider Threat)", "3", "4", "Cao (12)", "RBAC trên mọi API ghi; thủ thư không sửa được tài khoản nhân sự; không tự khoá chính mình; bạn đọc chỉ thấy dữ liệu của mình. Còn thiếu nhật ký truy cập hồ sơ (audit log), đưa vào WBS 1.7.2.7."],
    ["R-SEC-04", "Giả mạo hoặc phát lại giao dịch VNPay", "2", "5", "Cao (10)", "Kiểm tra chữ ký HMAC-SHA512 ở IPN và return, tính lại số tiền ở máy chủ, xử lý idempotent, chặn thu trùng, gắn cờ cần hoàn tiền khi lệch."],
    ["R-LEG-01", "Vi phạm quy định bảo vệ dữ liệu cá nhân (không thông báo, không có sự đồng ý, giữ quá lâu)", "3", "4", "Cao (12)", "Bổ sung thông báo xử lý dữ liệu và đồng ý khi đăng ký, chính sách thời hạn lưu, quy trình xuất và xoá dữ liệu theo yêu cầu, hồ sơ đánh giá tác động (WBS 1.7.2.6 và 1.7.2.8). Hiện hồ sơ cá nhân cho phép bạn đọc xem và sửa dữ liệu của mình."],
    ["R-OPS-01", "Gián đoạn dịch vụ (hạ tầng miễn phí ngủ, quá tải)", "4", "3", "Cao (12)", "Giới hạn tần suất, kiểm tra sức khoẻ /health, AI có phương án dự phòng, sao lưu Neon và quy trình khôi phục, nêu rõ hạn chế với khách hàng."],
    ["R-SUP-01", "Lộ khoá hoặc gián đoạn dịch vụ bên thứ ba (Resend, VNPay, Google Books)", "2", "4", "Trung bình (8)", "Khoá chỉ nằm trong biến môi trường; thiếu khoá thì tính năng tắt chứ không lỗi; Idempotency-Key khi gọi Resend; endpoint nội bộ cần khoá X-Internal-Key."],
    ["R-DAT-01", "Tệp nhập, xuất độc hại", "3", "3", "Trung bình (9)", "Chống formula injection khi xuất CSV; nhận diện loại tệp bằng magic bytes, giới hạn kích thước và số dòng, từ chối macro và tệp nén bất thường."],
]
SEC_WBS_INTRO = "Bảo mật không phải việc làm sau mà được đưa vào WBS ngay từ khâu thiết kế (Security by Design, Compliance by Design). Các hạng mục chuyên biệt về an toàn thông tin và tuân thủ thuộc khối 1.7.2 của WBS ở {T:wbsfunc}, kèm hiện trạng thực hiện:"
SEC_WBS = [
    ["1.7.2.1", "Xác thực và quản lý phiên", "bcrypt, JWT hạn 24 giờ, đọc lại tài khoản mỗi yêu cầu, thu hồi phiên, giới hạn tần suất theo IP.", "Đã làm"],
    ["1.7.2.2", "Phân quyền RBAC và cách ly dữ liệu bạn đọc", "Kiểm tra vai trò trên mọi API ghi; bạn đọc chỉ truy cập dữ liệu của mình; bảo vệ tài khoản nhân sự.", "Đã làm"],
    ["1.7.2.3", "Kiểm tra đầu vào và chống tấn công phổ biến", "Tham số hoá truy vấn, từ chối trường lạ và ký tự NUL, chống XSS và formula injection, kiểm tra tệp tải lên.", "Đã làm"],
    ["1.7.2.4", "Bảo mật thanh toán", "Ký và kiểm tra HMAC-SHA512, tính lại số tiền ở máy chủ, IPN idempotent, chặn thu trùng.", "Đã làm"],
    ["1.7.2.5", "Quản lý bí mật và cấu hình", "Khoá chỉ trong biến môi trường, CORS danh sách trắng, header bảo mật, khoá nội bộ cho API huấn luyện.", "Đã làm"],
    ["1.7.2.6", "Thông báo xử lý dữ liệu, đồng ý và quyền của chủ thể dữ liệu", "Văn bản thông báo mục đích xử lý, đồng ý khi đăng ký, quy trình xuất và xoá dữ liệu theo yêu cầu, thời hạn lưu.", "Đề xuất"],
    ["1.7.2.7", "Nhật ký kiểm toán và giám sát", "Ghi lại ai truy cập hồ sơ bạn đọc và thao tác nhạy cảm; cảnh báo bất thường.", "Đề xuất"],
    ["1.7.2.8", "Kiểm thử an toàn thông tin và hồ sơ đánh giá tác động", "Quét mã nguồn tĩnh (SAST) trong CI, kiểm thử xâm nhập độc lập, hồ sơ đánh giá tác động xử lý dữ liệu cá nhân.", "Một phần (có e2e phân quyền)"],
]

# ------------------------------------------------------------------ chương 8
ACCOUNTS = [
    ["Bạn đọc (sinh viên)", "reader@uls.local", "Reader@123"],
    ["Bạn đọc (giảng viên)", "lecturer@uls.local", "Reader@123"],
    ["Thủ thư", "librarian1@uls.local", "Admin@123"],
    ["Quản trị", "admin@uls.local", "Admin@123"],
]
ENV_ROWS = [
    ["Ứng dụng web", "https://muce-library.vercel.app"],
    ["Tài liệu API (Swagger)", "https://muce-library.vercel.app/api/docs"],
    ["Kiểm tra sức khoẻ", "https://muce-library.vercel.app/api/health"],
    ["Mã nguồn", "https://github.com/khoidev2001/university-library-system"],
    ["Backend trên Render", "https://uls-backend-bo6w.onrender.com"],
    ["AI Service trên Render", "https://uls-ai.onrender.com"],
]
DEMO_NOTE = "Dữ liệu trên hệ thống là dữ liệu thử: 1.000 đầu sách lấy từ bộ goodbooks-10k, 2.000 bạn đọc và lịch sử mượn trả mô phỏng. Gói hạ tầng miễn phí tự ngủ khi không có truy cập nên lần mở đầu có thể mất khoảng một phút."
# (tên tệp ảnh, chú thích, mô tả ngắn); nhóm theo vai trò
SHOTS = [
    ("Khách (chưa đăng nhập)", [
        ("01-trang-chu.jpg", "Trang chủ: ô tìm kiếm, từ khoá gợi ý và sách còn trên kệ", "Trang công khai dựng phía máy chủ; ô tìm kiếm là đường vào chính của bạn đọc."),
        ("02-tra-cuu-sach.jpg", "Tra cứu sách với bộ lọc thể loại và tình trạng", "Tìm theo tiêu đề, tác giả, ISBN; lọc thể loại và 'còn trên kệ'; phân trang."),
        ("03-chi-tiet-sach.jpg", "Chi tiết sách kèm tình trạng bản sao và điểm đánh giá", "Hiển thị số bản còn trên kệ; hết bản thì bạn đọc đã đăng nhập có thể đặt trước."),
        ("22-quy-dinh.jpg", "Quy định mượn trả sách", "Hạn mức, hạn mượn, gia hạn, mức phạt lấy trực tiếp từ chính sách mượn trong cơ sở dữ liệu."),
        ("20-dang-nhap.jpg", "Đăng nhập", "Xác thực bằng email và mật khẩu; có liên kết quên mật khẩu."),
        ("21-dang-ky.jpg", "Đăng ký bạn đọc", "Chọn sinh viên hoặc giảng viên, nhập mã sinh viên hoặc giảng viên."),
    ]),
    ("Bạn đọc", [
        ("24-sach-dang-muon.jpg", "Sách tôi đang mượn: hạn trả, quá hạn và tiền phạt", "Số sách đang mượn, sắp đến hạn, quá hạn; sách quá hạn tô đỏ; nút gia hạn."),
        ("25-dat-truoc.jpg", "Đặt trước sách hết bản: vị trí trong hàng đợi", "Bạn đọc xếp hàng chờ sách hết bản; khi có người trả, sách được giữ 3 ngày."),
        ("12-thanh-toan-phat.jpg", "Trang tiền phạt và nút thanh toán trực tuyến qua VNPay", "Tổng nợ, các khoản phạt và nút thanh toán; số tiền cuối cùng do máy chủ tính lại."),
        ("40-vnpay-sandbox.jpg", "Trang thanh toán VNPay (môi trường sandbox)", "Bạn đọc được chuyển sang cổng VNPay để chọn phương thức thanh toán; giao dịch chưa hoàn tất đã được huỷ sau khi chụp."),
        ("28-lich-su-thanh-toan.jpg", "Lịch sử thanh toán trực tuyến đã hoàn tất", "Các giao dịch VNPay đã thanh toán, kèm mã giao dịch của VNPay."),
        ("27-chuong-thong-bao.jpg", "Chuông thông báo: nhắc sách sắp đến hạn và quá hạn", "Thông báo trong web, làm mới mỗi 60 giây."),
        ("05-goi-y.jpg", "Gợi ý sách cho bạn đọc", "Danh sách 10 sách do mô hình lai gợi ý theo lịch sử mượn và đánh giá."),
        ("26-tai-khoan.jpg", "Tài khoản: hồ sơ, bật tắt email nhắc hạn, đổi mật khẩu", "Bạn đọc tự sửa tên hiển thị, nhận hoặc tắt email nhắc hạn, đổi mật khẩu."),
        ("08-dien-thoai-trang-chu.jpg", "Giao diện trên điện thoại (bề rộng 390 px)", "Menu thu gọn, không cuộn ngang; bảng dữ liệu chuyển thành thẻ dọc."),
    ]),
    ("Thủ thư", [
        ("06-quay-muon-tra.jpg", "Quầy mượn trả: nhập mã vạch bản sao và mã bạn đọc", "Cho mượn và nhận trả bằng mã vạch; khi cho mượn hiển thị nguy cơ trả trễ do AI dự báo."),
        ("31-phieu-muon.jpg", "Danh sách phiếu mượn", "Lọc theo trạng thái, quá hạn; nhận trả và báo mất ngay trên dòng."),
        ("32-khoan-phat.jpg", "Danh sách khoản phạt và thu tiền", "Lọc đã thu hoặc chưa thu; xuất CSV, Excel; thu tiền mặt."),
        ("33-hang-doi-dat-truoc.jpg", "Hàng đợi đặt trước", "Thủ thư xem hàng đợi theo trạng thái và huỷ khi cần."),
        ("29-ban-doc.jpg", "Quản lý bạn đọc", "Tìm bạn đọc, khoá và mở thẻ, tạo bạn đọc tại quầy, in thẻ bạn đọc."),
        ("30-in-nhan.jpg", "In nhãn mã vạch bản sao", "Chọn khổ giấy và sách để in nhãn Code 128."),
        ("34-kho-sach.jpg", "Kho sách và bản sao", "Thêm, sửa, xoá đầu sách; quản lý bản sao; nhập từ tệp; xuất danh mục."),
    ]),
    ("Quản trị", [
        ("14-quan-tri.jpg", "Bảng điều khiển quản trị", "Số liệu tổng quan, biểu đồ lượt mượn 12 tháng, tồn kho, bạn đọc quá hạn, sách mượn nhiều."),
        ("07-thong-ke.jpg", "Thống kê chi tiết", "Lượt mượn theo tháng, tồn kho theo thể loại."),
        ("35-tai-khoan.jpg", "Tài khoản nhân viên", "Admin tạo tài khoản thủ thư và quản trị, cấp lại mật khẩu tạm."),
        ("36-chinh-sach-muon.jpg", "Chính sách mượn", "Đổi số cuốn, hạn mượn, gia hạn, mức phạt theo loại bạn đọc; phiếu cũ không bị ảnh hưởng."),
        ("37-mo-hinh-ai.jpg", "Mô hình gợi ý và dự báo", "Số đo Precision@5, ROC-AUC của hai mô hình; nút huấn luyện lại."),
        ("38-tac-gia-the-loai.jpg", "Tác giả và thể loại", "Quản lý danh mục tác giả và thể loại."),
    ]),
]
TEST_RESULT_ROWS = [
    ["Unit test Backend (Jest)", "322 test, 33 suite", "Đạt 100%"],
    ["e2e Backend trên PostgreSQL thật (supertest)", "228 test, 20 suite, gồm 12 ca đua song song", "Đạt 100%"],
    ["Test AI Service (pytest)", "26 test", "Đạt 100%"],
    ["Tổng", "576 test", "Đạt 100%"],
    ["Coverage unit Backend (lớp nghiệp vụ)", "Câu lệnh 91,72%; nhánh 76,13%; hàm 95,26%; dòng 92,34%", "Vượt ngưỡng 80% dòng, 75% nhánh"],
    ["Coverage AI Service", "93,59%", "Vượt ngưỡng 80%"],
]
TEST_NOTE = "Số liệu lấy từ lần chạy CI gần nhất trên nhánh main (19/10/2026, workflow ci-cd.yml, 4 job backend, ai-service, frontend, compose-smoke xanh; job deploy chỉ chạy khi gộp vào main). Năm service nặng SQL (thanh toán, xuất dữ liệu, nhập sách, email nhắc hạn, đặt lại mật khẩu) được loại khỏi thước đo coverage unit vì đã có e2e riêng trên PostgreSQL thật. Frontend chưa có test tự động, mới kiểm bằng lint, build và kiểm tay."
AI_ROWS = [
    ["Gợi ý sách (TF-IDF trộn Collaborative Filtering item-based)", "Precision@5 = 0,309; Recall@5 = 0,110 (1.000 sách, 2.000 bạn đọc, 122.354 tương tác, 300 bạn đọc được đánh giá)", "Ngưỡng nghiệm thu Precision@5 từ 0,15: đạt"],
    ["Dự báo trả trễ, Logistic Regression", "Accuracy 0,709; Precision 0,789; Recall 0,703; F1 0,743; ROC-AUC 0,788", "Được chọn (ROC-AUC cao hơn); đạt ngưỡng ROC-AUC từ 0,70"],
    ["Dự báo trả trễ, Random Forest", "Accuracy 0,719; Precision 0,786; Recall 0,730; F1 0,757; ROC-AUC 0,784", "Không được chọn vì ROC-AUC thấp hơn"],
]
AI_NOTE = "Số đo lấy từ GET /api/recommendations/metrics của hệ thống đang chạy sau khi huấn luyện lại ngày 21/10/2026 trên 10.859 phiếu đã trả (tỉ lệ trễ 60,1%), tách 20% làm tập kiểm tra. Lịch sử mượn trả dùng để huấn luyện là dữ liệu mô phỏng sinh từ goodbooks-10k, nên số đo phản ánh quy luật mô phỏng, chưa phải hành vi bạn đọc thật. Khi AI Service không phản hồi, việc cho mượn vẫn thành công với nguy cơ trả trễ rỗng, trang gợi ý chuyển sang danh sách sách mượn nhiều."
PERF_ROWS = [
    ["Tìm sách theo từ khoá hiếm", "258 ms", "9,6 ms"],
    ["Tìm sách theo tác giả", "254 ms", "11 ms"],
    ["Tìm sách kèm bộ lọc còn sách", "471 ms", "7 ms"],
    ["Điểm đánh giá trung bình ở chi tiết sách", "27 ms", "0,45 ms"],
    ["Tìm bạn đọc", "157 ms", "7 ms"],
    ["JavaScript trang /admin", "255 kB", "147 kB"],
    ["JavaScript trang /reports", "263 kB", "144 kB"],
]
PERF_NOTE = "Đo trên cơ sở dữ liệu tổng hợp 50.000 sách, 100.000 bản sao, 600.000 phiếu mượn, 1.000.000 đánh giá (EXPLAIN ANALYZE và HTTP thật, trước và sau khi thêm chỉ mục GIN pg_trgm và truy vấn UNION); kích thước JavaScript giảm nhờ nạp lười biểu đồ (SRS, NFR-PERF-05, NFR-PERF-08). Đây là số đo trên dữ liệu tổng hợp, chưa phải thử tải trên hạ tầng thật."

# ------------------------------------------------------------------ chương 9
ROADMAP_INTRO = "Dự án mô phỏng kéo dài 16 tuần (21/09/2026 đến 10/01/2027) với 5 giai đoạn trọng tâm, ngân sách cơ sở 28,30 triệu đồng (566 giờ công) và dự phòng quản lý 2,83 triệu đồng:"
ROADMAP = [
    "**Giai đoạn 1 (tuần 1 đến tuần 3): Khởi tạo và phân tích.** Lập Charter, SOW, kế hoạch truyền thông, dựng môi trường; khảo sát nghiệp vụ, hoàn thiện SRS và 20 User Story. Mốc M1 (tuần 2): duyệt SOW; M2 (tuần 3): duyệt SRS.",
    "**Giai đoạn 2 (tuần 3 đến tuần 5): Thiết kế.** Thiết kế kiến trúc, cơ sở dữ liệu 3NF, đặc tả API, giao diện và mô hình AI. Mốc M3 (tuần 5): duyệt thiết kế.",
    "**Giai đoạn 3 (tuần 5 đến tuần 12): Phát triển phân hệ lõi.** Backend nền, Backend mượn trả và phạt, Frontend, mô hình AI. Mốc M4 (tuần 9): lõi chạy đầu-cuối; M5 (tuần 12): AI đạt ngưỡng chỉ số.",
    "**Giai đoạn 4 (tuần 12 đến tuần 15): Tích hợp, kiểm thử và triển khai.** Tích hợp Backend, AI, Frontend; kiểm thử hệ thống và UAT với thủ thư đại diện; Docker, CI/CD, triển khai cloud, đào tạo. Mốc M6 (tuần 14): bản dựng ổn định; M7 (tuần 15): qua UAT và lên cloud.",
    "**Giai đoạn 5 (tuần 15 đến tuần 16): Nghiệm thu và bàn giao.** Biên bản nghiệm thu, báo cáo cuối, chuyển giao tài liệu và vận hành. Mốc M8 (tuần 16): nghiệm thu.",
]
ROADMAP_NOTE = "Các phân hệ mở rộng (đặt trước, thông báo, thanh toán VNPay, xuất báo cáo, nhập từ tệp) được làm sau mốc nghiệm thu đường cơ sở và đi qua quy trình kiểm soát thay đổi (CR-04)."
KPI_ROWS = [
    ["Thời gian xử lý một lượt mượn trả", "Giảm từ khoảng 3 phút xuống dưới 60 giây (mục tiêu G2)", "Chưa đo với thủ thư thật; thao tác bằng mã vạch đã có"],
    ["Hiệu năng tra cứu", "Tìm kiếm p95 dưới 1 giây; API nghiệp vụ p95 dưới 2 giây; trang đầu dưới 3 giây trên 4G", "Có chỉ mục pg_trgm; đo trên dữ liệu tổng hợp 50.000 sách cho 7 đến 11 ms; chưa thử tải trên hạ tầng thật"],
    ["Chất lượng mã nguồn", "Coverage từ 80% dòng, 75% nhánh; CI xanh trước khi gộp", "Đạt: 576 test tự động, coverage Backend 92,34% dòng, AI 93,59%"],
    ["Chất lượng mô hình AI", "Precision@5 từ 0,15; ROC-AUC từ 0,70", "Đạt: Precision@5 = 0,309; ROC-AUC = 0,788"],
    ["An toàn và tuân thủ", "Không có sự cố lộ dữ liệu; không còn lỗi mức Nghiêm trọng đang mở; hoàn tất đồng ý và đánh giá tác động trước khi vận hành với dữ liệu thật", "Chưa vận hành dữ liệu thật; WBS 1.7.2.6 đến 1.7.2.8 là việc cần làm"],
    ["Mức sử dụng", "Từ 60% phiếu mượn nhập qua hệ thống sau 2 tuần chạy thật", "Chưa vận hành thật nên chưa đo"],
    ["Giá trị tài chính (giả định)", "NPV 3 năm dương; hoàn vốn dưới 1 năm", "Theo mô hình: NPV 112,52 triệu đồng, ROI 464%, hoàn vốn khoảng 9 tháng"],
]
OPS = [
    "**Môi trường:** Vercel (Frontend và chuyển tiếp /api), Render (Backend và AI Service), Neon (PostgreSQL); môi trường cục bộ dựng bằng Docker Compose.",
    "**Quy trình phát hành:** nhánh riêng, Pull Request có rà soát, CI chạy 4 job (backend, ai-service, frontend, compose-smoke) rồi mới triển khai khi gộp vào main; muốn quay lại bản trước thì triển khai lại bản ổn định gần nhất.",
    "**Giám sát và sao lưu:** điểm kiểm tra /health kiểm cả cơ sở dữ liệu; Neon sao lưu hằng ngày; gói miễn phí ngủ sau 15 phút không dùng nên lần gọi đầu có thể chậm, backend tự giải phóng việc tồn đọng khi được gọi lại.",
    "**Vai trò vận hành:** thủ thư đại diện là đầu mối nghiệp vụ; nhóm phát triển xử lý lỗi theo mức độ (Nghiêm trọng trong ngày, Cao trong sprint); mọi thay đổi phạm vi qua phiếu Change Request.",
]

# ------------------------------------------------------------------ kết luận
CONCL_SUMMARY = [
    "**LAB 1:** Tôn chỉ dự án với 7 mục tiêu SMART, SOW và kế hoạch truyền thông, RACI 25 hạng mục; chọn cấu trúc ma trận cân bằng và góc nhìn Cấu trúc; WBS 4 cấp (7 pha, 20 gói công việc, 42 công việc chi tiết) và từ điển WBS cho 3 gói găng.",
    "**LAB 2:** phân tích tài chính (NPV 112,52 triệu đồng, ROI 464%, hoàn vốn khoảng 9 tháng); danh sách công việc với đủ bốn loại quan hệ phụ thuộc; sơ đồ mạng, tính xuôi ngược có thế số, 3 đường găng, thời gian 16 tuần; nén 20% bằng fast-tracking kết hợp crashing xuống 12,5 tuần với chi phí tăng 1,71 triệu đồng.",
    "**LAB 3:** 11 rủi ro thuộc 4 nhóm kèm Mitigation và Contingency; EVA tại mốc 50% (SPI 0,868, CPI 0,924, EAC 30,64 triệu đồng); đường cơ sở và quy trình 5 bước kiểm soát thay đổi; Test Plan, 3 Test Script, vòng đời lỗi và tiêu chí nghiệm thu.",
    "**Phân tích và thiết kế:** 16 nhóm chức năng, 37 User Story, 26 quy tắc nghiệp vụ; use case, WBS theo chức năng; kiến trúc ba dịch vụ, cơ sở dữ liệu 16 bảng chuẩn 3NF, bộ UML, 78 API, thiết kế bảo mật và chống đua dữ liệu.",
    "**Sản phẩm thật:** hệ thống chạy tại https://muce-library.vercel.app với 29 trang giao diện cho ba vai trò, 576 test tự động đạt 100% trên CI, hai mô hình AI đạt ngưỡng nghiệm thu.",
]
SELF_HEADER = ["Trụ cột", "Chỉ tiêu", "Kết quả", "Đánh giá"]
SELF_ROWS = [
    ["Phạm vi (Scope)", "100% User Story trong phạm vi; 0 lỗi Nghiêm trọng và Cao mở",
     "20 trên 20 User Story của đường cơ sở hoàn thành; sản phẩm hiện đáp ứng 37 User Story (SRS 2.0), 78 API, 29 trang; CI xanh. Một hạng mục chưa kiểm với dữ liệu thật: nhập sách theo ISBN từ Google Books (bị giới hạn tần suất)",
     "Đạt, kèm 1 hạn chế đã ghi nhận"],
    ["Tiến độ (Time)", "Hoàn thành trong 16 tuần",
     "Mô phỏng: hoàn thành đúng tuần 16 sau giai đoạn chậm ở tuần 8 (SPI 0,87), SPI cuối 1,00. Thật: sản phẩm được xây dựng trong khoảng 4 tuần (21/09 đến 19/10/2026)",
     "Đạt (nhờ làm thêm giờ và chạy song song)"],
    ["Chi phí (Cost)", "Không vượt BAC cộng dự phòng",
     "Chi phí thực tế mô phỏng 30.564.419 đồng, vượt BAC 2.262.752 đồng (8,0%), dùng 80% dự phòng; CPI cuối 0,926",
     "Đạt có điều kiện: vượt BAC nhưng trong ngân sách đề xuất"],
    ["Chất lượng", "Coverage từ 80%; CI xanh; chỉ số mô hình",
     "Coverage Backend 92,34% dòng, AI 93,59%; 576 test đạt 100%; CI xanh; Precision@5 = 0,309; ROC-AUC = 0,788",
     "Đạt"],
    ["Hài lòng của khách hàng", "UAT đạt 100% kịch bản; điểm từ 4 trên 5", "Chưa đo với thủ thư thật; mới có kịch bản UAT mẫu", "Chưa đánh giá được"],
    ["Lợi ích kinh doanh", "Từ 60% phiếu mượn qua hệ thống sau 2 tuần", "Chưa vận hành thật; NPV dương theo giả định", "Chưa đánh giá được"],
]
SELF_NOTE = "Kết luận tự đánh giá: dự án thành công về ba trụ cột chính với các điều kiện đã nêu (một hạn chế phạm vi, chi phí vượt BAC nhưng trong dự phòng). Hai tiêu chí về sự hài lòng của khách hàng và lợi ích kinh doanh chưa thể đánh giá vì hệ thống chưa vận hành với thủ thư thật; đây là việc cần làm trong 3 tháng đầu vận hành."
LIMITS = [
    "EV và AC là số mô phỏng có kiểm soát, không phải số đo thật; dự án sau nên ghi giờ theo mã WBS ngay từ ngày đầu (đã có khung docs/pm/timelog.csv).",
    "Các giả định tài chính chưa kiểm chứng ở một thư viện thật; cần chạy thử 3 tháng để thay bằng số đo. Hai trong bốn vai trò của dự án mô phỏng là nhân sự giả định.",
    "Gantt và sơ đồ mạng được vẽ bằng chương trình từ dữ liệu CPM, chưa phải ảnh chụp từ MS Project; Test Script chưa có cột kết quả thực tế, cần thực thi cùng thủ thư khi UAT.",
    "Lịch sử mượn trả dùng để huấn luyện AI là dữ liệu mô phỏng; nhập sách theo ISBN từ Google Books chưa thử với dữ liệu thật; Frontend chưa có test tự động.",
    "Thanh toán VNPay mới ở môi trường sandbox; email chỉ gửi tới được các địa chỉ đã xác minh trên Resend vì chưa có tên miền riêng; JWT hạn một ngày, chưa có refresh token; hạ tầng miễn phí không có SLA.",
    "Ba hạng mục bảo mật và tuân thủ (WBS 1.7.2.6 đến 1.7.2.8: đồng ý và quyền của chủ thể dữ liệu, nhật ký kiểm toán, SAST và kiểm thử xâm nhập) mới ở mức đề xuất.",
]
LESSONS = [
    "**Mạng chặt thì phải theo dõi sát.** Có 3 đường găng song song, xác suất xong đúng 16 tuần theo PERT chỉ khoảng 22%; nên theo dõi SPI hằng tuần thay vì mỗi 4 tuần và đặt sẵn danh sách cắt giảm phạm vi.",
    "**Phụ thuộc bên ngoài là điểm nghẽn.** Giới hạn tần suất của Google Books làm dự án chậm ở tuần 8; cần nguồn dữ liệu dự phòng ngay từ sprint đầu.",
    "**Chạy thật luồng liên quan tiền, không chỉ test có mock.** Lỗi tính phạt theo giờ chỉ lộ khi chạy thật luồng trả sách; từ đó mã chạm tiền, quyền và dữ liệu đều có e2e trên PostgreSQL thật.",
    "**Nhất quán dữ liệu giữa WBS, lịch và EVA** giúp mọi con số truy được về một gói công việc; một mô hình sinh cả Excel, hình và báo cáo để không lệch.",
    "**Nén tiến độ không miễn phí.** Fast-tracking rẻ nhưng chuyển chi phí sang rủi ro làm lại; crashing bị chặn bởi nhiều đường găng song song và giới hạn năng lực.",
    "**Ghi rõ giả định.** Các số liệu mô phỏng (EVA, tài chính) phải gắn với giả định và sự kiện thực tế để người đọc kiểm tra được.",
    "**Đối chiếu văn bản pháp luật với nguồn hiện hành.** Quy định về dữ liệu cá nhân và an ninh mạng thay đổi nhanh (năm 2025 đã có luật và nghị định mới thay thế văn bản cũ), nên số hiệu và ngày hiệu lực cần được kiểm tra lại ở mỗi lần cập nhật tài liệu.",
]
RECOMMEND = [
    "**Về phương pháp luận:** giữ mô hình lai: đặc tả và kiểm chứng chặt cho khối liên quan đến tiền và dữ liệu cá nhân, lặp ngắn cho giao diện và AI.",
    "**Về an toàn thông tin:** hoàn thành nhật ký kiểm toán, quét mã nguồn tĩnh trong CI và kiểm thử xâm nhập độc lập trước khi vận hành với dữ liệu thật.",
    "**Về tuân thủ pháp lý:** lập văn bản thông báo xử lý dữ liệu, cơ chế đồng ý, quy trình xuất và xoá dữ liệu theo yêu cầu và hồ sơ đánh giá tác động; xác nhận cấp độ an toàn hệ thống với cơ quan chủ quản của trường.",
    "**Về vận hành:** đào tạo thủ thư, chạy song song với sổ tay 2 tuần, đo lại thời gian mượn trả và mức sử dụng để thay các giả định bằng số đo thật.",
]
REFERENCES = [
    "1) TS. Lê Tỷ Khánh, Tài liệu bài giảng và bài tập thực hành Quản lý Dự án Phần mềm.",
    "2) Project Management Institute (PMI), A Guide to the Project Management Body of Knowledge (PMBOK Guide), 7th Edition.",
    "3) IEEE Std 830-1998, Recommended Practice for Software Requirements Specifications.",
    "4) Quốc hội, Luật Thư viện số 46/2019/QH14.",
    "5) Quốc hội, Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15; Chính phủ, Nghị định 356/2025/NĐ-CP quy định chi tiết một số điều và biện pháp thi hành Luật Bảo vệ dữ liệu cá nhân.",
    "6) Quốc hội, Luật An ninh mạng số 116/2025/QH15.",
    "7) Nhóm thực hiện, Tài liệu SRS 2.0, SDD 2.0, hướng dẫn API và hướng dẫn triển khai của hệ thống, https://github.com/khoidev2001/university-library-system.",
    "8) VNPay, Tài liệu tích hợp cổng thanh toán (môi trường sandbox).",
    "9) goodbooks-10k, bộ dữ liệu sách mẫu (CC BY-SA 4.0).",
]
FILES_APPENDIX = [
    "`docs/pm/ULS_PM_Plan.xlsx`: 17 sheet có công thức sống, trong đó dùng cho báo cáo này: WBS, CPM (FS, SS, FF, SF), PERT, Gantt, NenTienDo, EVA, EVA_CongViec, TaiChinh, TaiChinh5N, RuiRo, RACI, Baseline. Các ô vàng là dữ liệu nhập.",
    "Hình vẽ và mô hình số liệu: `docs/tools/build_pm_charts.py`, `build_qldapm_charts.py`, `pm_model.py`, `qldapm_model.py`, `qldapm_calc.py`. Mọi số trong các Chương 2 đến 4 được đối chiếu với tệp Excel bằng một bộ tính công thức độc lập (kết quả khớp tuyệt đối).",
    "Tài liệu kỹ thuật: `docs/srs/SRS.md` (đặc tả yêu cầu), `docs/design/SDD.md` (thiết kế), `docs/api/README.md` (hướng dẫn API), `docs/deploy/DEPLOY.md` (triển khai), `docs/erd/` và `docs/uml/` (sơ đồ).",
    "Dựng báo cáo này: `docs/tools/build_qldapm_final.py` (đọc `docs/pm/QLDAPM_Report.md`, SRS, SDD, mã nguồn và ảnh trong `docs/report/screenshots/`).",
    "Mã nguồn phần mềm và tài liệu kỹ thuật: https://github.com/khoidev2001/university-library-system.",
]
