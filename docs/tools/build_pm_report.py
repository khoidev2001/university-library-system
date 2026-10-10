"""Sinh báo cáo Kế hoạch Quản lý Dự án (Markdown, rồi Word) từ pm_model.

Usage: python build_pm_report.py <thư-mục-docs/pm>
Số liệu lấy từ pm_model nên khớp với file Excel và các hình.
"""
from __future__ import annotations

import sys
from pathlib import Path

import md_to_docx
import pm_model as m
from pm_model import fmt_h, fmt_vnd

OUT = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("docs/pm")
FIG = "figures"
REPO = "https://github.com/khoidev2001/university-library-system"

pts = {p.week: p for p in m.eva_points()}
FIN = m.finance()
BAC_H = m.bac_hours()
BAC = m.bac_money()
RESERVE = BAC * m.RESERVE_RATE
EXP, SD = m.pert_project()
PATHS = m.critical_paths()
MAIN = m.critical_chain()
EMV = m.risk_emv_total()


def tbl(headers: list[str], rows: list[list], aligns: str = "") -> str:
    def esc(x) -> str:
        return str(x).replace("|", "\\|")
    out = ["| " + " | ".join(esc(h) for h in headers) + " |", "|" + "|".join("---" for _ in headers) + "|"]
    for r in rows:
        out.append("| " + " | ".join(esc(c) for c in r) + " |")
    return "\n".join(out) + "\n"


def fig(name: str, caption: str) -> str:
    return f"![{caption}]({FIG}/{name})\n"


def pct(x: float, d: int = 1) -> str:
    return f"{x * 100:.{d}f}".replace(".", ",") + "%"


def num(x: float, d: int = 2) -> str:
    return f"{x:.{d}f}".replace(".", ",")


def mil(x: float) -> str:
    return f"{x / 1e6:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".") + " triệu đồng"


def band(x: float) -> str:
    return "xanh" if x >= 0.95 else ("vàng" if x >= 0.85 else "đỏ")


# ----------------------------------------------------------------------------
def cover() -> str:
    return f"""# TÀI LIỆU KẾ HOẠCH QUẢN LÝ DỰ ÁN

**Đề tài 8: Phần mềm Quản lý Thư viện Trường Đại học (ULS)**

Môn: Công nghệ Phần mềm. Trường Đại học Xây dựng Miền Trung. Giảng viên hướng dẫn: TS. Lê Tỷ Khánh

Nhóm 3, lớp D23CTC2

| Thông tin | Nội dung |
|---|---|
| Thành viên | Trần Đình Khôi (23Q74802012006, nhóm trưởng); Nguyễn Như Quỳnh (21DQ4802011003) |
| Loại tài liệu | Project Management Plan (sản phẩm bàn giao của bài tập lớn) |
| Phiên bản | 1.0 |
| Mã nguồn | {REPO} |
| Tệp kèm theo | ULS_PM_Plan.xlsx (WBS, lịch, rủi ro, RACI, tài chính, EVA); hướng dẫn slide PM_slides_brief.md |

**Lưu ý đọc báo cáo.** Dự án được mô phỏng với 16 tuần, 4 vai trò và đơn giá 50.000 đồng/giờ để phục vụ các bài toán lập kế hoạch, đường găng, rủi ro, tài chính và EVA. Sản phẩm phần mềm đi kèm là có thật, đã chạy trên cloud, và được dùng để lấy số liệu kiểm thử, kiến trúc và quy mô thật. Mọi chỗ là số mô phỏng đều được ghi rõ là giả định.

\\pagebreak

**MỤC LỤC**

[[TOC]]

\\pagebreak
"""


def sec1() -> str:
    return f"""# 1. GIỚI THIỆU DỰ ÁN VÀ TUYÊN BỐ CÔNG VIỆC (SOW)

## 1.1. Bối cảnh và mô tả tổng quan

Thư viện của một trường đại học vẫn thường quản lý sách, bạn đọc và phiếu mượn bằng sổ tay hoặc bảng tính rời rạc. Thủ thư mất nhiều thời gian ghi chép, tra cứu hộ và lập báo cáo; bạn đọc không biết sách còn trên kệ hay không; tiền phạt trả trễ tính thủ công dễ sai. Dự án ULS xây dựng một hệ thống web quản lý sách, bạn đọc, mượn trả, tìm kiếm và thống kê cho thư viện, kèm hai tính năng thông minh là gợi ý sách theo hành vi mượn và dự báo nguy cơ trả trễ.

Hệ thống gồm ba dịch vụ độc lập: **Backend** NestJS (48 API REST, JWT, phân quyền theo vai trò, PostgreSQL qua Prisma), **Frontend** Next.js (12 trang, chuẩn SEO, thích ứng mọi màn hình) và **AI Service** FastAPI (hai mô hình học máy). Bản chạy thật nằm trên Vercel, Render và Neon (xem LAB 4 trong báo cáo thực hành).

## 1.2. Mục tiêu dự án (SMART)

{tbl(["Mã", "Mục tiêu", "Đo lường", "Thời hạn"], [
    ["G1", "Số hoá toàn bộ nghiệp vụ mượn, trả, gia hạn, báo mất và tính phạt", "100% luồng nghiệp vụ trong SRS chạy được; quy tắc BR-01 đến BR-08 có kiểm thử", "Tuần 14"],
    ["G2", "Giảm thời gian xử lý một lượt mượn trả của thủ thư từ 3 phút xuống 1 phút", "Đo trong UAT bằng kịch bản mượn trả bằng mã vạch; trung bình dưới 60 giây", "Tuần 15"],
    ["G3", "Cho bạn đọc tra cứu sách và xem còn trên kệ hay không", "Tìm kiếm p95 dưới 1 giây với 1.000 đầu sách; trang đầu dưới 3 giây trên 4G", "Tuần 12"],
    ["G4", "Gợi ý sách và dự báo trả trễ đạt ngưỡng nghiệm thu", "Precision@5 từ 0,15; ROC-AUC từ 0,70", "Tuần 12"],
    ["G5", "Bảo đảm chất lượng mã nguồn", "Coverage dòng từ 80% trên lớp nghiệp vụ; CI xanh trên mọi Pull Request", "Tuần 14"],
    ["G6", "Đưa hệ thống lên môi trường thật", "Địa chỉ trực tuyến truy cập được; docker compose up dựng đủ 5 dịch vụ", "Tuần 15"],
    ["G7", "Hoàn thành đúng hạn, trong ngân sách", f"Kết thúc tuần 16; chi phí không vượt BAC cộng dự phòng ({mil(BAC + RESERVE)})", "Tuần 16"],
])}
## 1.3. Phạm vi dự án

**Trong phạm vi (In scope):**

- Quản lý sách: đầu sách, tác giả, thể loại, bản sao (mã vạch, trạng thái, vị trí kệ), nhập sách theo ISBN.
- Quản lý bạn đọc: đăng ký, đăng nhập, hai nhóm bạn đọc (sinh viên, giảng viên) với chính sách mượn riêng, khoá và mở thẻ.
- Mượn, trả, gia hạn, báo mất sách; tính và thu phạt trả trễ, mất sách.
- Tìm kiếm theo tiêu đề, tác giả, ISBN, thể loại, tình trạng còn trên kệ.
- Báo cáo: sách mượn nhiều, bạn đọc quá hạn, lượt mượn theo tháng, tồn kho theo thể loại.
- Gợi ý sách cho bạn đọc và dự báo nguy cơ trả trễ (kèm cơ chế dự phòng khi dịch vụ AI không sẵn sàng).
- Quản trị: tài khoản nhân viên, chính sách mượn, kho sách, theo dõi mô hình.
- Đóng gói Docker, CI/CD, triển khai cloud, tài liệu và đào tạo thủ thư.

**Ngoài phạm vi (Out of scope):** đặt trước sách, gửi email nhắc hạn, thanh toán phạt trực tuyến, ứng dụng di động, tích hợp hệ thống quản lý sinh viên của trường, quản lý tài liệu số.

**Sản phẩm bàn giao:** mã nguồn và Docker; hệ thống chạy trực tuyến; SRS, SDD, đặc tả API; báo cáo kiểm thử; hướng dẫn sử dụng; kế hoạch quản lý dự án này.

## 1.4. Các bên liên quan (Stakeholders)

{tbl(["Bên liên quan", "Vai trò", "Mối quan tâm chính", "Quyền lực", "Quan tâm", "Cách làm việc"], [
    ["Ban giám đốc thư viện", "Khách hàng, Product Owner", "Nghiệp vụ đúng, tiết kiệm công sức, chi phí vận hành thấp", "Cao", "Cao", "Duyệt SOW, backlog, nghiệm thu; họp đầu ra mỗi sprint"],
    ["Thủ thư", "Người dùng chính", "Mượn trả nhanh, ít sai, báo cáo sẵn", "Trung bình", "Cao", "Phỏng vấn, UAT, đào tạo"],
    ["Sinh viên", "Bạn đọc", "Tra cứu nhanh, biết hạn trả, ít bị phạt", "Thấp", "Cao", "Khảo sát ngắn, thu phản hồi sau UAT"],
    ["Giảng viên (bạn đọc)", "Bạn đọc", "Mượn nhiều hơn, gia hạn dễ", "Thấp", "Trung bình", "Chính sách riêng cho giảng viên"],
    ["Giảng viên hướng dẫn", "Đánh giá, tư vấn", "Đủ nội dung, hợp lý, trình bày rõ", "Cao", "Cao", "Báo cáo tiến độ, bảo vệ cuối kỳ"],
    ["Phòng CNTT của trường", "Hỗ trợ hạ tầng, bảo mật", "Tuân thủ an toàn thông tin", "Trung bình", "Trung bình", "Tham vấn khi triển khai thật"],
    ["Nhà cung cấp hạ tầng", "Vercel, Render, Neon", "Gói miễn phí, giới hạn sử dụng", "Thấp", "Thấp", "Theo dõi điều khoản và giới hạn"],
])}
{fig("stakeholders.png", "Hình 1.1. Ma trận quyền lực và quan tâm của các bên liên quan")}
## 1.5. Giả định

1. Dự án kéo dài 16 tuần bắt đầu ngày 21/09/2026, gồm 4 vai trò, mỗi người làm bán thời gian khoảng {m.CAPACITY_PER_PERSON} giờ/tuần (năng lực nhóm {4 * m.CAPACITY_PER_PERSON} giờ/tuần).
2. Đơn giá giờ công 50.000 đồng/giờ (mức giả định cho sinh viên thực tập).
3. Dùng hạ tầng gói miễn phí (Vercel, Render, Neon) trong giai đoạn phát triển và demo; chi phí vận hành thật được tính ở mục 7.
4. Dữ liệu sách mẫu lấy từ bộ goodbooks-10k (có ISBN); thông tin bổ sung từ Google Books chỉ dùng khi có khoá API.
5. Lịch sử mượn trả để huấn luyện mô hình là dữ liệu mô phỏng (chưa có dữ liệu thật vì thư viện chưa dùng hệ thống).
6. Thủ thư đại diện của thư viện tham gia phỏng vấn và UAT đủ thời gian đã thoả thuận.
7. Năng suất giả định khoảng 2,1 giờ cho mỗi điểm chức năng nhờ dùng khung phát triển có sẵn (NestJS, Prisma, Next.js); đây là giả định rủi ro, xem R6 ở mục 4.

## 1.6. Ràng buộc

- **Thời gian:** hạn nộp cuối kỳ, không thể lùi (cứng).
- **Chi phí:** BAC {mil(BAC)}; dự phòng quản lý {mil(RESERVE)} ({pct(m.RESERVE_RATE, 0)} BAC). Không có thẻ thanh toán nên không dùng dịch vụ trả phí trong dự án.
- **Nhân lực:** 4 người bán thời gian, kỹ năng chưa đồng đều.
- **Kỹ thuật:** hạ tầng miễn phí tự ngủ khi không dùng (Render sau 15 phút, Neon sau 5 phút); Google Books API giới hạn tần suất nếu không có khoá.
- **Chất lượng:** coverage từ 80%, mọi API ghi dữ liệu phải có kiểm tra quyền và kiểm tra dữ liệu đầu vào.

## 1.7. Phương pháp và vòng đời

Dự án dùng mô hình **lai**: khung pha của WBS (Khởi tạo, Phân tích, Thiết kế, Phát triển, Kiểm thử, Triển khai) để lập kế hoạch và kiểm soát, còn bên trong pha Phát triển làm theo **Scrum** với sprint 2 tuần (8 sprint trong 16 tuần). Backlog gồm 20 User Story có điểm ước lượng và tiêu chí chấp nhận; mỗi User Story gắn với một mã WBS, nhờ vậy tiến độ kế hoạch (PV) và giá trị thu được (EV) quy chiếu được về cùng một cấu trúc công việc.

Các nghi thức: họp hằng ngày ngắn (15 phút, qua tin nhắn), lập kế hoạch sprint, rà soát và hồi cứu cuối sprint; theo dõi bằng bảng Kanban trên GitHub Projects. Mã nguồn quản lý bằng Git với nhánh `main` được bảo vệ, mọi thay đổi đi qua Pull Request có CI xanh (xem mục 6.6).

\\pagebreak
"""


def sec2() -> str:
    wps = sorted(m.WORK_PACKAGES, key=lambda w: m.wbs_sort_key(w.wbs))
    rows = []
    for w in wps:
        rows.append([w.wbs, w.name, w.owner, m.UNCERTAINTY_NAME[w.cls], fmt_h(w.o), fmt_h(w.m), fmt_h(w.p), fmt_h(w.e)])
    ph_rows = []
    hours = {}
    for w in m.WORK_PACKAGES:
        hours[w.wbs.split(".")[0]] = hours.get(w.wbs.split(".")[0], 0) + w.e
    for code, name in m.WBS_L1.items():
        n_wp = sum(1 for w in m.WORK_PACKAGES if w.wbs.startswith(code + "."))
        ph_rows.append([code, name, n_wp, fmt_h(hours[code]), pct(hours[code] / BAC_H), fmt_vnd(hours[code] * m.RATE)])
    ph_rows.append(["", "**Tổng (BAC)**", len(m.WORK_PACKAGES), f"**{fmt_h(BAC_H)}**", "100,0%", f"**{fmt_vnd(BAC)}**"])
    role_rows = []
    for k, (desc, who) in m.ROLES.items():
        h = sum(w.e for w in m.WORK_PACKAGES if w.owner == k)
        role_rows.append([k, desc, who, fmt_h(h), pct(h / (m.CAPACITY_PER_PERSON * m.WEEKS))])
    return f"""# 2. CẤU TRÚC PHÂN RÃ CÔNG VIỆC (WBS) VÀ ƯỚC LƯỢNG

## 2.1. Nguyên tắc xây dựng WBS

WBS được xây dựng theo **pha vòng đời** ở cấp 1 và **chức năng** ở cấp 2 của pha Phát triển, đúng với năm module mà đề bài nêu (Quản lý sách, Quản lý bạn đọc, Mượn/trả, Tìm kiếm, Báo cáo) cộng thêm AI và Tích hợp. Cấp 3 là **gói công việc (Work Package)**: đủ nhỏ để giao cho một người, ước lượng được trong vài chục giờ, có sản phẩm bàn giao kiểm tra được. WBS có {len(m.WORK_PACKAGES)} gói công việc, theo quy tắc 8/80 (mỗi gói khoảng 6 đến 34 giờ).

Công việc quản lý dự án (mục 7 của WBS: theo dõi, rủi ro, kiểm soát EVA) được coi là **công việc duy trì (Level of Effort)**: trải đều suốt dự án và không nằm trên đường găng.

{fig("wbs.png", "Hình 2.1. WBS cấp 1 và cấp 2 (kèm tổng giờ công kỳ vọng mỗi pha)")}
## 2.2. Phương pháp ước lượng

Mỗi gói công việc được ước lượng bằng **kỹ thuật 3 điểm (PERT)**: giờ lạc quan O, giờ khả dĩ nhất M, giờ bi quan P. Giờ kỳ vọng E = (O + 4M + P) / 6 và độ lệch chuẩn σ = (P − O) / 6. O và P suy ra từ M theo mức bất định của gói (Thấp: 0,85 và 1,25; Vừa: 0,80 và 1,40; Cao: 0,70 và 1,80), trong đó mức Cao dành cho các gói mới mẻ hoặc phụ thuộc bên ngoài (nhập ISBN từ Google Books, quy tắc mượn trả, hai mô hình AI, tích hợp AI, triển khai cloud).

**Kiểm tra chéo bằng điểm chức năng (Function Point).** Từ kết quả thiết kế thật: 10 bảng dữ liệu (ILF), 2 nguồn ngoài (EIF: goodbooks-10k, Google Books) và 48 API. Phân loại gần đúng: 24 API ghi dữ liệu (EI), 18 API truy vấn (EQ), 6 báo cáo và gợi ý (EO). Với trọng số trung bình, tổng điểm chưa hiệu chỉnh khoảng {10 * 8 + 2 * 5 + 24 * 4 + 18 * 4 + 6 * 5} FP. Với năng suất giả định 2,1 giờ/FP, công sức khoảng {round((10 * 8 + 2 * 5 + 24 * 4 + 18 * 4 + 6 * 5) * 2.1)} giờ, sai lệch dưới 10% so với {fmt_h(BAC_H)} giờ của WBS. Năng suất này thấp hơn nhiều so với mức tham khảo của ngành (6 đến 10 giờ/FP) vì dự án dùng khung có sẵn và sinh mã từ lược đồ; vì vậy nó được ghi thành rủi ro R6 và được bù bằng dự phòng quản lý {pct(m.RESERVE_RATE, 0)}.

## 2.3. Bảng WBS và ước lượng chi tiết

Cột Vai trò: PM (quản lý dự án, Backend lead), FE (Frontend và AI), BE (Backend và DevOps), QA (phân tích nghiệp vụ và kiểm thử). Đơn vị: giờ công.

{tbl(["Mã", "Gói công việc", "Vai trò", "Bất định", "O", "M", "P", "E"], rows)}
**Bảng 2.2.** Work Package, ước lượng 3 điểm và giờ kỳ vọng. Tổng giờ kỳ vọng: **{fmt_h(BAC_H)} giờ**.

## 2.4. Tổng hợp theo pha và vai trò

{tbl(["Pha", "Tên", "Số gói", "Giờ kỳ vọng", "Tỉ lệ", "Chi phí (đồng)"], ph_rows)}
**Bảng 2.3.** Tổng hợp theo pha WBS cấp 1.

Phát triển chiếm {pct(hours["4"] / BAC_H, 0)} công sức, kiểm thử {pct(hours["5"] / BAC_H, 0)}, phân tích và thiết kế {pct((hours["2"] + hours["3"]) / BAC_H, 0)}; tỉ lệ kiểm thử trên phát triển ({pct(hours["5"] / hours["4"], 0)}) hợp lý với yêu cầu coverage 80% và kiểm thử trên cơ sở dữ liệu thật.

{tbl(["Vai trò", "Mô tả", "Người", "Giờ kỳ vọng", "Mức sử dụng so với năng lực 16 tuần"], role_rows)}
**Bảng 2.4.** Phân bổ giờ công theo vai trò. Mức sử dụng khoảng 85% để chừa chỗ cho họp, sửa lỗi và dự phòng.

## 2.5. Ngân sách

- **BAC (ngân sách theo kế hoạch):** {fmt_h(BAC_H)} giờ x 50.000 đồng = **{fmt_vnd(BAC)} đồng**.
- **Dự phòng quản lý ({pct(m.RESERVE_RATE, 0)}):** {fmt_vnd(RESERVE)} đồng, chỉ dùng cho thay đổi đã được duyệt và rủi ro đã nhận diện (mục 4 và 9).
- **Ngân sách đề xuất:** {fmt_vnd(BAC + RESERVE)} đồng.
- **Hạ tầng:** 0 đồng trong dự án (gói miễn phí); phương án trả phí khi vận hành thật nằm ở mục 7.

\\pagebreak
"""


def sec3() -> str:
    act_rows = []
    for a in m.ACTIVITIES:
        wp_ids = ", ".join(w.wbs for w in sorted(m.WORK_PACKAGES, key=lambda w: m.wbs_sort_key(w.wbs)) if w.activity == a.code)
        pre = "-" if not a.preds else ", ".join(f"{pc} ({kind}{'+' + str(lag) if lag else ''})" for pc, kind, lag in a.preds)
        act_rows.append([a.code, a.name, wp_ids, a.dur, pre])
    cpm_rows = []
    for a in m.ACTIVITIES:
        r = m.CPM[a.code]
        cpm_rows.append([a.code, a.name, a.dur, int(r.es), int(r.ef), int(r.ls), int(r.lf), int(r.slack), "Găng" if r.critical else ""])
    n_crit = len(m.CRITICAL_PATH)
    path_text = chr(10).join("- Đường " + str(k) + ": " + " → ".join(p) for k, p in enumerate(PATHS, start=1))
    main_text = " → ".join(MAIN)
    pert_rows = []
    for a in m.ACTIVITIES:
        e = (a.a + 4 * a.dur + a.b) / 6
        pert_rows.append([a.code, a.name, m.UNCERTAINTY_NAME[a.cls], num(a.a), num(a.dur), num(a.b), num(e), num(((a.b - a.a) / 6) ** 2, 3), "x" if a.code in MAIN else ""])
    p16 = m.normal_cdf((16 - EXP) / SD)
    p17 = m.normal_cdf((17 - EXP) / SD)
    p18 = m.normal_cdf((18 - EXP) / SD)
    tot, by_role = m.weekly_plan()
    cap = 4 * m.CAPACITY_PER_PERSON
    peak = max(tot.values())
    peak_w = max(tot, key=tot.get)
    role_peak = {r: max(by_role[r].values()) for r in m.ROLES}
    wk_rows = [[w, f"{tot[w]:.1f}".replace(".", ","), pct(tot[w] / cap, 0)] + [f"{by_role[r][w]:.1f}".replace(".", ",") for r in m.ROLES] for w in range(1, m.WEEKS + 1)]
    ms = [("M1", 2, "Hiến chương, SOW được duyệt", "Biên bản duyệt của khách hàng"), ("M2", 3, "SRS và 20 User Story được duyệt", "SRS v1.0, backlog"),
          ("M3", 5, "Thiết kế được duyệt", "ERD, kiến trúc, API, giao diện"), ("M4", 9, "Backend và Frontend lõi chạy đầu-cuối", "Demo mượn trả"),
          ("M5", 12, "AI hoàn chỉnh, đạt ngưỡng chỉ số", "Báo cáo chỉ số mô hình"), ("M6", 14, "Tích hợp xong, vào kiểm thử hệ thống", "Bản dựng ổn định"),
          ("M7", 15, "Qua UAT, triển khai cloud", "Biên bản UAT, địa chỉ trực tuyến"), ("M8", 16, "Nghiệm thu, bàn giao", "Biên bản nghiệm thu")]
    return f"""# 3. LẬP LỊCH VÀ ĐƯỜNG GĂNG

## 3.1. Danh sách hoạt động và quan hệ phụ thuộc

Các gói công việc được gom thành **{len(m.ACTIVITIES)} hoạt động** để dựng mạng. Phụ thuộc gồm **FS** (kết thúc rồi mới bắt đầu) và **SS** (bắt đầu sau khi tiền nhiệm bắt đầu n tuần, ví dụ SS+1). Thời lượng tính bằng tuần theo năng lực của vai trò đảm nhiệm: số giờ của hoạt động chia cho {m.CAPACITY_PER_PERSON} giờ/tuần/người, làm tròn để mỗi vai trò không quá khoảng 110% năng lực.

{tbl(["Mã", "Hoạt động", "Gói công việc (WBS)", "Thời lượng (tuần)", "Phụ thuộc (tiền nhiệm)"], act_rows)}
**Bảng 3.1.** Hoạt động, thời lượng và phụ thuộc.

Một số quan hệ đáng chú ý: Thiết kế kiến trúc (E) và Thiết kế API, giao diện (F) bắt đầu sớm theo SS để chồng lấn với Phân tích (D); Backend mượn trả (I) và Frontend (J) bắt đầu khi Backend nền (H) đã chạy được một tuần (SS+1); AI (L) cần dữ liệu mượn trả nên bắt đầu sau Backend mượn trả hai tuần (SS+2); Triển khai cloud (P) bắt đầu khi UAT (O) đã chạy một tuần (SS+1) vì có thể dựng môi trường trong lúc kiểm thử.

## 3.2. Sơ đồ mạng PERT/CPM

Sơ đồ mạng nằm ở trang ngang kế tiếp để đọc rõ các thông số ES, EF, LS, LF, Slack.

\\landscape

{fig("network.png", "Hình 3.1. Sơ đồ mạng hoạt động với ES, EF, LS, LF, Slack (đỏ: đường găng)")}
\\portrait

## 3.3. Tính ES, EF, LS, LF và độ dự trữ

**Lượt tính xuôi:** ES(hoạt động) = lớn nhất của [EF(tiền nhiệm FS) + lag] và [ES(tiền nhiệm SS) + lag]; EF = ES + thời lượng. **Lượt tính ngược:** LF(hoạt động) = nhỏ nhất của [LS(hậu nhiệm FS) − lag] và [LS(hậu nhiệm SS) − lag + thời lượng], bị chặn bởi thời hạn dự án; LS = LF − thời lượng. **Slack = LS − ES.** Hoạt động có Slack bằng 0 là hoạt động găng. Các bảng tính đầy đủ nằm ở sheet CPM của file Excel, dùng công thức nên đổi thời lượng thì kết quả tự cập nhật.

{tbl(["Mã", "Hoạt động", "Thời lượng", "ES", "EF", "LS", "LF", "Slack", "Găng?"], cpm_rows)}
**Bảng 3.2.** Kết quả CPM (đơn vị: tuần, mốc đếm từ cuối tuần 0).

**Kết quả.** Thời gian hoàn thành dự án là **{int(m.PROJECT_WEEKS)} tuần**, bằng đúng hạn cứng. Có **{n_crit} trên {len(m.ACTIVITIES)} hoạt động** là găng và có **{len(PATHS)} đường găng song song**:

{path_text}

Các hoạt động có dự trữ: {", ".join(f"{a.code} (Slack {int(m.CPM[a.code].slack)})" for a in m.ACTIVITIES if not m.CPM[a.code].critical)}. Mạng "chặt" như vậy là hệ quả của việc nhóm nhỏ làm song song nhiều luồng; nó có nghĩa mọi trễ trên nhóm hoạt động găng đều đẩy ngày hoàn thành, nên phải theo dõi sát bằng EVA (mục 8).

## 3.4. Ước lượng thời gian bằng PERT và xác suất đúng hạn

Mỗi hoạt động có ba giá trị thời lượng (a lạc quan, m khả dĩ, b bi quan) suy ra từ thời lượng m theo mức bất định của hoạt động. Thời gian kỳ vọng E = (a + 4m + b) / 6 và phương sai ((b − a) / 6)².

{tbl(["Mã", "Hoạt động", "Bất định", "a", "m", "b", "E", "Phương sai", "Đường găng chính"], pert_rows)}
**Bảng 3.3.** Ước lượng 3 điểm cho hoạt động (tuần).

Đường găng chính được chọn là đường có phương sai lớn nhất (bất định cao nhất): **{main_text}**. Thời gian lịch kỳ vọng của dự án = thời gian CPM + tổng (E − m) trên đường này = **{num(EXP)} tuần**, độ lệch chuẩn **{num(SD)} tuần**. Theo xấp xỉ chuẩn:

{tbl(["Hoàn thành trong", "Xác suất"], [["16 tuần (kế hoạch)", pct(p16, 0)], ["17 tuần", pct(p17, 0)], ["18 tuần", pct(p18, 0)]])}
**Nhận xét quan trọng.** Xác suất hoàn thành đúng 16 tuần chỉ khoảng {pct(p16, 0)} nếu không có biện pháp bù. Vì hạn nộp là cứng nên kế hoạch dùng ba biện pháp: (1) làm thêm giờ có kiểm soát ở các tuần 9 đến 15 (mục 8), (2) chạy song song Frontend với Backend (đã nằm trong quan hệ SS), (3) giữ sẵn danh sách tính năng có thể cắt giảm nếu SPI dưới 0,85 (mục 4, R5 và R6). Đây là lý do dự phòng tiền và khả năng làm thêm giờ được đặt trước.

## 3.5. Biểu đồ Gantt và mốc quan trọng

\\landscape

{fig("gantt.png", "Hình 3.2. Biểu đồ Gantt (đỏ: hoạt động găng; xanh: có dự trữ)")}
\\portrait

{tbl(["Mốc", "Tuần", "Nội dung", "Sản phẩm kiểm tra"], [[a, b, c, d] for a, b, c, d in ms])}
**Bảng 3.4.** Các mốc quan trọng (milestone). Bản Gantt có công thức nằm ở sheet Gantt của file Excel.

## 3.6. Tải nguồn lực và cân bằng

Giờ kế hoạch mỗi tuần suy ra từ lịch sớm: gói công việc trải đều trong khoảng [ES, EF] của hoạt động. Tải đỉnh của nhóm là **{peak:.1f} giờ** ở tuần {peak_w}, bằng {pct(peak / cap, 0)} năng lực {cap} giờ/tuần. Tải đỉnh của từng vai trò: PM {role_peak["PM"]:.1f}, FE {role_peak["FE"]:.1f}, BE {role_peak["BE"]:.1f}, QA {role_peak["QA"]:.1f} giờ/tuần so với năng lực mỗi người {m.CAPACITY_PER_PERSON} giờ. Đỉnh vượt năng lực tối đa khoảng {pct(max(role_peak.values()) / m.CAPACITY_PER_PERSON - 1, 0)}; mức này chấp nhận được trong vài tuần bằng làm thêm giờ, nhưng là cơ sở để giả định "làm thêm giờ" trong EVA.

{fig("resource.png", "Hình 3.3. Giờ kế hoạch theo tuần và theo vai trò so với năng lực nhóm")}
{tbl(["Tuần", "Tổng giờ", "Mức dùng", "PM", "FE", "BE", "QA"], wk_rows)}
**Bảng 3.5.** Giờ kế hoạch theo tuần (nền tính PV).

\\pagebreak
"""


def sec4() -> str:
    rows = []
    for r in m.RISKS:
        rows.append([r.rid, r.name, r.cat, r.p, r.i, r.score, r.level, r.strategy])
    resp = []
    for r in m.RISKS:
        resp.append([r.rid, r.cause, r.effect, r.response, r.trigger, r.owner, r.status])
    emv_rows = [[r.rid, r.name, f"{int(m.PROB[r.p] * 100)}%", fmt_vnd(r.cost_if), fmt_vnd(r.cost_if * m.PROB[r.p])] for r in m.RISKS]
    emv_rows.append(["", "**Tổng EMV**", "", "", f"**{fmt_vnd(EMV)}**"])
    high = [r for r in m.RISKS if r.level == "Cao"]
    return f"""# 4. QUẢN LÝ RỦI RO

## 4.1. Quy trình

Quản lý rủi ro gồm 5 bước, lặp lại mỗi sprint và rà soát chính thức ở các mốc EVA (tuần 4, 8, 12, 16): (1) **nhận diện** bằng brainstorming và rà soát bài học từ dự án tương tự; (2) **phân tích định tính** bằng xác suất và tác động theo thang 1 đến 5; (3) **phân tích định lượng** bằng giá trị tiền tệ kỳ vọng EMV; (4) **lên kế hoạch ứng phó** theo bốn chiến lược (né tránh, giảm thiểu, chuyển giao, chấp nhận); (5) **theo dõi và kiểm soát** qua sổ rủi ro, dấu hiệu kích hoạt và dự phòng.

**Thang đánh giá.** Xác suất: 1 = 10%, 2 = 30%, 3 = 50%, 4 = 70%, 5 = 90%. Tác động: 1 (không đáng kể), 2 (nhỏ, dưới 5 giờ), 3 (vừa, 5 đến 15 giờ hoặc ảnh hưởng một tính năng), 4 (lớn, 15 đến 40 giờ hoặc ảnh hưởng mốc), 5 (rất lớn, ảnh hưởng hạn nộp). Điểm = xác suất x tác động; Cao từ 15, Trung bình từ 8 đến 14, Thấp dưới 8.

## 4.2. Sổ rủi ro

Dự án nhận diện **{len(m.RISKS)} rủi ro** (yêu cầu của đề là 5 đến 7), chia thành nhóm kỹ thuật, phạm vi, lịch và chi phí, chất lượng và nghiệp vụ.

{tbl(["Mã", "Rủi ro", "Nhóm", "P", "I", "Điểm", "Mức", "Chiến lược"], rows)}
**Bảng 4.1.** Đánh giá rủi ro.

{fig("risk_matrix.png", "Hình 4.1. Ma trận rủi ro 5x5")}
Có **{len(high)} rủi ro mức Cao** ({", ".join(r.rid for r in high)}): hạ tầng miễn phí ngủ khi demo và phình phạm vi. Các rủi ro kỹ thuật khác ở mức Trung bình do đã có biện pháp giảm thiểu từ đầu.

\\landscape

## 4.3. Kế hoạch ứng phó

**Bảng 4.2.** Kế hoạch ứng phó và theo dõi. "Đã xảy ra" nghĩa là rủi ro đã xuất hiện trong quá trình làm dự án thật.

<!--font:7.8-->
{tbl(["Mã", "Nguyên nhân", "Hậu quả", "Ứng phó", "Dấu hiệu kích hoạt", "Chủ sở hữu", "Trạng thái"], resp)}

\\portrait

## 4.4. Phân tích định lượng và dự phòng

Tổn thất nếu xảy ra tính bằng giờ công bổ sung x 50.000 đồng; EMV = xác suất x tổn thất.

{tbl(["Mã", "Rủi ro", "Xác suất", "Tổn thất nếu xảy ra (đồng)", "EMV (đồng)"], emv_rows)}
**Bảng 4.3.** Giá trị tiền tệ kỳ vọng.

Tổng EMV là **{fmt_vnd(EMV)} đồng**, bằng {pct(EMV / RESERVE, 0)} dự phòng quản lý {fmt_vnd(RESERVE)} đồng. Tức là dự phòng {pct(m.RESERVE_RATE, 0)} BAC vừa đủ che các rủi ro đã nhận diện; phần còn lại rất mỏng nên mọi thay đổi phạm vi phải đi qua kiểm soát thay đổi (mục 9).

## 4.5. Bài học từ các rủi ro đã xảy ra trong dự án thật

Dự án thật (phần mềm đã làm xong) cung cấp bằng chứng cho sổ rủi ro:

- **R1 (hạ tầng ngủ):** quan sát thật khi triển khai: sau thời gian không dùng, dịch vụ gợi ý trên Render khởi động lại và phải huấn luyện lại mô hình; trong lúc đó backend tự rơi về danh sách sách mượn nhiều và người dùng không thấy lỗi. Biện pháp "đánh thức trước demo" và "fallback" đã chứng tỏ hiệu quả.
- **R2 (Google Books):** nhập ISBN bị giới hạn tần suất nên bộ dữ liệu mẫu không có mô tả sách; chức năng nhập ISBN có mã nguồn và unit test nhưng chưa thử với dữ liệu thật. Đây là phần còn mở được ghi trung thực trong báo cáo LAB.
- **R10 (quy tắc phạt):** khi kiểm thử luồng thật phát hiện tính phạt theo giờ thay vì theo ngày lịch; đã sửa theo múi giờ thư viện và thêm test biên. Bài học: chạy thật luồng liên quan tiền, không chỉ test có mock.
- **R3 và R4:** chỉ số mô hình đạt ngưỡng (Precision@5 = 0,309; ROC-AUC = 0,76) và coverage đạt 98,75% dòng, nhờ đặt ngưỡng từ đầu trong CI.

\\pagebreak
"""


def sec5() -> str:
    raci_rows = []
    for code, name, cells in m.RACI:
        raci_rows.append([code, name] + [cells[c] for c in m.RACI_COLS])
    assign = [
        ["Trần Đình Khôi", "SOW, WBS và ước lượng; lập lịch và đường găng (CPM, PERT, Gantt); EVA và kiểm soát", "Mục 1, 2, 3, 8"],
        ["Nguyễn Như Quỳnh", "Quản lý rủi ro; nguồn lực và RACI; quản lý chất lượng, kiểm thử; phân tích tài chính", "Mục 4, 5, 6, 7"],
    ]
    return f"""# 5. QUẢN LÝ NGUỒN LỰC

## 5.1. Cơ cấu tổ chức nhóm dự án

{fig("org.png", "Hình 5.1. Cơ cấu tổ chức nhóm dự án")}
Nhóm có 4 vai trò, trong đó hai vai trò do hai thành viên thật đảm nhiệm và hai vai trò là nhân sự giả định của dự án mô phỏng (để đủ quy mô 4 người như đề bài). Ban giám đốc thư viện là khách hàng và Product Owner; giảng viên hướng dẫn tư vấn và đánh giá.

## 5.2. Vai trò và trách nhiệm

{tbl(["Vai trò", "Người", "Trách nhiệm chính", "Quyền ra quyết định"], [
    ["Quản lý dự án, Scrum Master, Backend lead", "Trần Đình Khôi", "Lập kế hoạch, theo dõi tiến độ, rủi ro, EVA; thiết kế kiến trúc; xây dựng xác thực, mượn trả, báo cáo; tích hợp, triển khai cloud", "Phạm vi trong dự phòng, thứ tự ưu tiên sprint, nhận bàn giao"],
    ["Frontend và AI/ML", "Nguyễn Như Quỳnh", "Thiết kế giao diện, toàn bộ trang web, SEO; hai mô hình gợi ý và dự báo trả trễ", "Chuẩn giao diện, lựa chọn mô hình theo chỉ số"],
    ["Backend và DevOps (giả định)", "SV3", "Cơ sở dữ liệu, API kho sách, phạt, tìm kiếm; Docker, CI/CD, môi trường cloud", "Cấu trúc dữ liệu, cấu hình pipeline"],
    ["BA và Kiểm thử (giả định)", "SV4", "Khảo sát, SRS, ca kiểm thử, kiểm thử tích hợp và hệ thống, UAT, tài liệu hướng dẫn", "Tiêu chí chấp nhận, kết luận đạt hoặc không đạt"],
    ["Khách hàng (thư viện)", "Ban giám đốc, thủ thư đại diện", "Cung cấp nghiệp vụ, duyệt SOW và backlog, tham gia UAT, nghiệm thu", "Duyệt thay đổi phạm vi, nghiệm thu"],
])}
## 5.3. Ma trận RACI

R: thực hiện, A: chịu trách nhiệm cuối (đúng một người cho mỗi hạng mục), C: được tham vấn, I: được thông báo, A/R: vừa chịu trách nhiệm vừa thực hiện. Sheet RACI của file Excel kiểm tra tự động mỗi hạng mục có đúng một A ({len(m.RACI)} trên {len(m.RACI)} hạng mục đạt).

{tbl(["Mã", "Hạng mục"] + [m.RACI_COL_NAMES[c] for c in m.RACI_COLS], raci_rows)}
**Bảng 5.1.** Ma trận trách nhiệm RACI.

## 5.4. Kế hoạch nhân sự và nâng cao năng lực

Nhân sự có mặt từ tuần 1 đến tuần 16 với cường độ khoảng {m.CAPACITY_PER_PERSON} giờ mỗi người mỗi tuần. Tải theo vai trò xem hình 3.3. Bảo đảm kiến thức dùng chung bằng hai biện pháp: mỗi Pull Request có ít nhất một người khác rà soát, và tài liệu thiết kế (SRS, SDD, đặc tả API) được sinh từ mã nguồn để không phụ thuộc vào trí nhớ của một người. Khi một vai trò quá tải ở tuần cao điểm (tuần 7 đến 10), Quản lý dự án nhận thêm việc rà soát và tích hợp vì tải của vai trò này thấp ở các tuần 2 đến 5.

## 5.5. Kế hoạch truyền thông

{tbl(["Thông tin", "Đối tượng", "Tần suất", "Hình thức", "Người phụ trách"], [
    ["Tiến độ ngắn", "Cả nhóm", "Hằng ngày", "Tin nhắn 15 phút", "Scrum Master"],
    ["Demo sprint, backlog", "Khách hàng, nhóm", "Mỗi 2 tuần", "Buổi demo 45 phút", "Quản lý dự án"],
    ["Báo cáo EVA, rủi ro", "Giảng viên hướng dẫn", "Tuần 4, 8, 12, 16", "Báo cáo ngắn, biểu đồ", "Quản lý dự án"],
    ["Thay đổi phạm vi", "Khách hàng", "Khi phát sinh", "Phiếu Change Request", "Quản lý dự án"],
    ["Lỗi nghiêm trọng", "Cả nhóm, khách hàng", "Ngay khi phát hiện", "Issue trên GitHub, tin nhắn", "QA"],
])}
## 5.6. Phân công thực hiện bài tập

Theo yêu cầu của đề, mỗi thành viên phụ trách ít nhất một phần của kế hoạch và được nêu rõ:

{tbl(["Thành viên", "Phần phụ trách", "Mục trong báo cáo"], assign)}
\\pagebreak
"""


def sec6() -> str:
    return f"""# 6. QUẢN LÝ CHẤT LƯỢNG VÀ KIỂM THỬ

## 6.1. Chiến lược chất lượng

Chất lượng được đảm bảo bằng **ngăn ngừa** (tiêu chí chấp nhận cho từng User Story, thiết kế quy tắc nghiệp vụ trước khi lập trình, kiểm tra dữ liệu đầu vào ở biên) và **phát hiện** (kiểm thử nhiều tầng chạy tự động trên CI). Nguyên tắc chính: mọi thay đổi chỉ được gộp vào nhánh `main` khi CI xanh; phần liên quan tiền phạt, quyền và cơ sở dữ liệu bắt buộc có bằng chứng chạy thật, không chỉ test có mock.

## 6.2. Các loại kiểm thử

{tbl(["Loại", "Mục đích", "Phạm vi", "Công cụ", "Khi nào chạy", "Phụ trách"], [
    ["Kiểm thử đơn vị", "Kiểm tra logic từng service, guard, client", "Backend (119 test), AI (26 test)", "Jest, pytest", "Mỗi lần push, trên CI", "Lập trình viên, QA"],
    ["Kiểm thử tích hợp (e2e)", "Kiểm tra API cùng cơ sở dữ liệu thật", "Luồng mượn, trả, phạt, xác thực (15 test, 3 suite)", "Jest, Supertest, PostgreSQL thật", "Mỗi Pull Request", "QA"],
    ["Kiểm thử hệ thống", "Kiểm tra toàn hệ thống qua gateway", "100 lượt gọi API trong 3 kịch bản smoke; docker compose up trên máy sạch", "Script Python, GitHub Actions", "Cuối sprint, trước phát hành", "QA"],
    ["Kiểm thử chấp nhận (UAT)", "Khách hàng xác nhận đáp ứng nghiệp vụ", "Kịch bản của thủ thư và bạn đọc trên bản chạy thật", "Kịch bản thủ công", "Tuần 13 đến 15", "Khách hàng, QA"],
    ["Kiểm thử phi chức năng", "Hiệu năng, bảo mật, khả năng truy cập", "NFR-PERF, NFR-SEC, NFR-USE trong SRS", "Lighthouse, kiểm tra thủ công", "Trước UAT", "QA, PM"],
])}
**Bảng 6.1.** Các loại kiểm thử.

## 6.3. Tiêu chí chất lượng và kết quả thật

Tiêu chí chấp nhận đo được lấy từ SRS và từ file hướng dẫn thực hành; kết quả dưới đây lấy từ pipeline CI thật của dự án.

{tbl(["Tiêu chí", "Ngưỡng", "Kết quả thật", "Đạt"], [
    ["Coverage dòng, câu lệnh, hàm (Backend, lớp nghiệp vụ)", "Từ 80%", "98,75%, 97,51%, 98,49%", "Đạt"],
    ["Coverage nhánh (Backend)", "Từ 80%", "81,9%", "Đạt"],
    ["Coverage AI Service", "Từ 80%", "93,6%", "Đạt"],
    ["Số test", "Tất cả đạt", "160 test (119 đơn vị, 15 e2e, 26 AI), đạt 100%", "Đạt"],
    ["CI trên mọi Pull Request", "Xanh", "4 job xanh (backend, ai-service, frontend, compose-smoke)", "Đạt"],
    ["Precision@5 (gợi ý)", "Từ 0,15", "0,309", "Đạt"],
    ["ROC-AUC (dự báo trả trễ)", "Từ 0,70", "0,76", "Đạt"],
    ["Mật khẩu băm, JWT, RBAC, giới hạn đăng nhập", "Theo NFR-SEC-01 đến 05", "Có kiểm thử cho phân quyền và đăng nhập", "Đạt"],
    ["Tìm kiếm p95", "Dưới 1 giây (1.000 đầu sách)", "Chưa đo bằng công cụ tải; truy vấn có chỉ mục", "Chưa kiểm"],
])}
**Bảng 6.2.** Tiêu chí chất lượng và kết quả. Hai chỉ tiêu hiệu năng p95 trong SRS chưa được đo bằng công cụ tải nên ghi là "chưa kiểm", không suy diễn.

## 6.4. Mốc chất lượng (quality gates)

Mỗi mốc ở bảng 3.4 có một cổng chất lượng: M3 (thiết kế) cần SRS và thiết kế được rà soát; M4 cần luồng mượn trả chạy đầu-cuối và test xanh; M5 cần chỉ số mô hình đạt ngưỡng; M6 cần coverage từ 80% và CI xanh; M7 cần UAT đạt 100% kịch bản, không còn lỗi nghiêm trọng; M8 cần bản chạy thật và tài liệu bàn giao. Không qua cổng thì không sang mốc kế tiếp, trừ khi Quản lý dự án và khách hàng chấp nhận bằng văn bản.

## 6.5. Quản lý lỗi

Lỗi được ghi trên GitHub Issues với mức độ: **Nghiêm trọng** (sai tiền phạt, lộ dữ liệu, mất dữ liệu, hệ thống không chạy), **Cao** (một luồng chính hỏng), **Trung bình** (sai giao diện, thông báo), **Thấp** (câu chữ). Quy tắc xử lý: lỗi Nghiêm trọng sửa trong ngày và thêm test chặn tái diễn; lỗi Cao sửa trong sprint; chỉ số theo dõi là số lỗi mở theo mức độ và thời gian sửa trung bình. Ví dụ thật: lỗi tính phạt theo giờ thay vì ngày lịch được xếp Nghiêm trọng, sửa cùng ngày và thêm bài test biên.

## 6.6. Quản lý cấu hình và quy trình phát hành

- **Kho mã:** monorepo trên GitHub gồm backend, frontend, ai-service, gateway; nhánh `main` được bảo vệ.
- **Nhánh:** mỗi công việc làm trên nhánh riêng (ví dụ `feat/...`, `docs/...`), gộp qua Pull Request, bắt buộc CI xanh.
- **Rà soát:** mỗi Pull Request được một người khác xem lại trước khi gộp.
- **Phát hành:** mỗi mốc từ M4 trở đi gắn một phiên bản (v0.x đến v1.0.0); bản trên `main` được triển khai lên cloud sau khi mọi job CI xanh; cấu hình bí mật (khoá, mật khẩu) chỉ nằm trong biến môi trường, không có trong mã nguồn.
- **Truy vết:** mỗi commit, Issue và User Story gắn với mã WBS, nhờ đó tính được giờ và tiến độ theo WBS.

## 6.7. Chi phí chất lượng

Giờ kiểm thử trong kế hoạch là {fmt_h(sum(w.e for w in m.WORK_PACKAGES if w.wbs.startswith("5.")))} giờ ({pct(sum(w.e for w in m.WORK_PACKAGES if w.wbs.startswith("5.")) / BAC_H, 0)} BAC), cộng thêm viết test song song với lập trình trong các gói Phát triển. Chi phí phòng ngừa (rà soát, tiêu chí chấp nhận, CI) được coi là rẻ hơn chi phí sửa lỗi ở giai đoạn muộn, đặc biệt với tiền phạt và dữ liệu bạn đọc.

\\pagebreak
"""


def sec7() -> str:
    f = FIN
    cash_rows = []
    labels = ["Năm 0", "Năm 1", "Năm 2", "Năm 3"]
    cum = 0.0
    benefits = [0] + [f["benefit_full"] * a for a in m.FIN["adoption"]]
    costs = [f["invest"]] + [f["ops"]] * 3
    for t in range(4):
        cum += f["flows"][t]
        cash_rows.append([labels[t], fmt_vnd(benefits[t]), fmt_vnd(costs[t]), fmt_vnd(f["flows"][t]), num(1 / (1 + m.FIN["discount"]) ** t, 4), fmt_vnd(f["pv_list"][t]), fmt_vnd(cum)])
    sens_rows = []
    for bf in (1.0, 0.7, 0.5, 0.3):
        sens_rows.append([pct(bf, 0)] + [fmt_vnd(m.npv_with(d, bf)) for d in (0.08, 0.10, 0.12, 0.15)])
    # điểm hoà vốn của lợi ích
    lo, hi = 0.0, 1.0
    for _ in range(60):
        mid = (lo + hi) / 2
        if m.npv_with(0.10, mid) > 0:
            hi = mid
        else:
            lo = mid
    return f"""# 7. PHÂN TÍCH TÀI CHÍNH

## 7.1. Phương pháp và giả định

Phân tích dùng NPV (giá trị hiện tại ròng), ROI và thời gian hoàn vốn trong 3 năm vận hành, tỉ lệ chiết khấu {pct(m.FIN["discount"], 0)}. Chi phí đầu tư là ngân sách đề xuất ở mục 2.5 ({fmt_vnd(f["invest"])} đồng, gồm BAC và dự phòng). Lợi ích đến từ tiết kiệm thời gian thủ thư và giảm thất thoát sách; **tiền phạt thu được không tính là lợi ích** vì mục đích của phạt là răn đe, không phải nguồn thu.

{tbl(["Giả định", "Giá trị", "Cơ sở"], [
    ["Số bạn đọc", fmt_vnd(m.FIN["reader_count"]), "Quy mô trường giả định khoảng 5.000 sinh viên và giảng viên"],
    ["Lượt mượn mỗi bạn đọc mỗi năm", m.FIN["loans_per_reader_year"], "Giả định"],
    ["Phút thủ thư tiết kiệm mỗi lượt", m.FIN["minutes_saved_per_loan"], "Ghi sổ tay khoảng 3 phút, quét mã vạch khoảng 1 phút"],
    ["Lượt tra cứu hộ mỗi năm, phút tiết kiệm", f"{fmt_vnd(m.FIN['lookups_per_year'])} lượt, {m.FIN['minutes_saved_per_lookup']} phút", "Bạn đọc tự tra cứu trực tuyến"],
    ["Đơn giá giờ thủ thư", f"{fmt_vnd(m.FIN['librarian_rate'])} đồng/giờ", "Giả định"],
    ["Giờ báo cáo tiết kiệm mỗi năm", m.FIN["report_hours_saved"], "12 báo cáo x 8 giờ, nay chạy tự động"],
    ["Thất thoát sách hiện nay, mức giảm", f"{fmt_vnd(m.FIN['lost_book_value_year'])} đồng/năm, giảm {pct(m.FIN['lost_reduction'], 0)}", "Nhờ theo dõi quá hạn và báo mất"],
    ["Mức áp dụng", "70%, 100%, 100%", "Năm 1 còn làm quen, chạy song song với sổ tay"],
    ["Chi phí vận hành mỗi năm", fmt_vnd(f["ops"]) + " đồng", "Hạ tầng trả phí tối thiểu 6.000.000, bảo trì 60 giờ x 50.000, đào tạo 3.000.000"],
])}
**Bảng 7.1.** Giả định tài chính (đều là giả định, ghi rõ để giảng viên kiểm tra và thay đổi ở sheet GiaDinh).

## 7.2. Chi phí

- **Chi phí phát triển (một lần):** {fmt_vnd(BAC)} đồng ({fmt_h(BAC_H)} giờ x 50.000).
- **Dự phòng quản lý:** {fmt_vnd(RESERVE)} đồng.
- **Hạ tầng trong dự án:** 0 đồng nhờ gói miễn phí. Khi vận hành thật nên dùng gói trả phí tối thiểu (giả định 6.000.000 đồng/năm) để tránh dịch vụ ngủ và có sao lưu; đây là phương án đã tính vào chi phí vận hành.
- **Chi phí vận hành mỗi năm:** {fmt_vnd(f["ops"])} đồng.

## 7.3. Lợi ích hằng năm (khi áp dụng đầy đủ)

{tbl(["Khoản lợi ích", "Cách tính", "Giá trị (đồng/năm)"], [
    ["Giờ thủ thư khi mượn trả", f"{fmt_vnd(f['loans'])} lượt x {m.FIN['minutes_saved_per_loan']} phút / 60 x {fmt_vnd(m.FIN['librarian_rate'])}", fmt_vnd(f["b_loan"])],
    ["Giờ tra cứu hộ", f"{fmt_vnd(m.FIN['lookups_per_year'])} lượt x {m.FIN['minutes_saved_per_lookup']} phút / 60 x {fmt_vnd(m.FIN['librarian_rate'])}", fmt_vnd(f["b_lookup"])],
    ["Giờ làm báo cáo", f"{m.FIN['report_hours_saved']} giờ x {fmt_vnd(m.FIN['librarian_rate'])}", fmt_vnd(f["b_report"])],
    ["Giảm thất thoát sách", f"{fmt_vnd(m.FIN['lost_book_value_year'])} x {pct(m.FIN['lost_reduction'], 0)}", fmt_vnd(f["b_lost"])],
    ["**Tổng**", "", f"**{fmt_vnd(f['benefit_full'])}**"],
])}
\\pagebreak

## 7.4. Dòng tiền, NPV, ROI và thời gian hoàn vốn

{tbl(["Năm", "Lợi ích", "Chi phí", "Dòng tiền ròng", "Hệ số chiết khấu", "Giá trị hiện tại", "Luỹ kế"], cash_rows)}
**Bảng 7.2.** Dòng tiền (đồng).

{fig("cashflow.png", "Hình 7.1. Dòng tiền ròng và luỹ kế trong 3 năm")}
- **NPV (3 năm, r = {pct(m.FIN["discount"], 0)}):** **{fmt_vnd(f["npv"])} đồng**, dương nên dự án đáng đầu tư.
- **ROI (3 năm):** (tổng dòng tiền ròng các năm 1 đến 3 − vốn) / vốn = **{pct(f["roi"], 0)}**.
- **Thời gian hoàn vốn (không chiết khấu):** khoảng **{num(f["payback"])} năm** (khoảng {round(f["payback"] * 12)} tháng).
- **Điểm hoà vốn của lợi ích:** NPV bằng 0 khi lợi ích chỉ đạt khoảng **{pct(hi, 0)}** so với kế hoạch.

## 7.5. Phân tích độ nhạy

{tbl(["Lợi ích so với kế hoạch", "r = 8%", "r = 10%", "r = 12%", "r = 15%"], sens_rows)}
**Bảng 7.3.** NPV (đồng) theo mức lợi ích và tỉ lệ chiết khấu.

Ngay cả khi lợi ích chỉ đạt 30% kế hoạch, NPV vẫn {"dương" if m.npv_with(0.15, 0.3) > 0 else "âm ở r = 15% nhưng " + ("dương ở r thấp" if m.npv_with(0.08, 0.3) > 0 else "âm")}; kết quả nhạy nhất với mức lợi ích và mức áp dụng chứ không nhạy với tỉ lệ chiết khấu. Rủi ro chính của bài toán tài chính là lợi ích không xảy ra do thủ thư không dùng hệ thống (R8), nên kế hoạch đào tạo và chạy song song là điều kiện để tạo ra giá trị. Cần nhắc rằng các số trên dựa vào giả định, không phải số đo thật vì thư viện chưa vận hành hệ thống; phần xác thực bằng số thật nên làm sau 3 tháng đầu vận hành.

\\pagebreak
"""


def sec8() -> str:
    pv, ev, ac = m.eva_series()
    rep = []
    for w in m.EVA_REPORT_WEEKS:
        p = pts[w]
        rep.append([f"Tuần {w}", fmt_vnd(p.pv), fmt_vnd(p.ev), fmt_vnd(p.ac), fmt_vnd(p.sv), fmt_vnd(p.cv), num(p.spi, 3), num(p.cpi, 3)])
    fc = []
    for w in m.EVA_REPORT_WEEKS:
        p = pts[w]
        fc.append([f"Tuần {w}", fmt_vnd(p.eac), fmt_vnd(p.eac2), fmt_vnd(p.etc), fmt_vnd(p.vac), num(p.tcpi, 3) if p.tcpi == p.tcpi else "-", f"{band(p.spi)} / {band(p.cpi)}"])
    wk = []
    for w in range(1, m.WEEKS + 1):
        p = pts[w]
        wk.append([w, fmt_vnd(p.pv), fmt_vnd(p.ev), fmt_vnd(p.ac), num(p.spi, 3), num(p.cpi, 3)])
    phase = [("Tuần 1 đến 4", m.EVA_PROGRESS[1], m.EVA_COST_FACTOR[1], m.EVA_NOTES["1-4"]),
             ("Tuần 5 đến 8", m.EVA_PROGRESS[5], m.EVA_COST_FACTOR[5], m.EVA_NOTES["5-8"]),
             ("Tuần 9 đến 12", m.EVA_PROGRESS[9], m.EVA_COST_FACTOR[9], m.EVA_NOTES["9-12"]),
             ("Tuần 13 đến 16", m.EVA_PROGRESS[13], m.EVA_COST_FACTOR[13], m.EVA_NOTES["13-16"])]
    p4, p8, p12, p16 = pts[4], pts[8], pts[12], pts[16]
    reserve_used = -p16.vac / RESERVE if p16.vac < 0 else 0
    return f"""# 8. PHÂN TÍCH GIÁ TRỊ THU ĐƯỢC (EVA)

## 8.1. Mục đích và phương pháp

Đề tài 8 yêu cầu mô phỏng quá trình thực hiện 3 đến 4 tháng bằng EVA. Dự án mô phỏng 16 tuần (khoảng 4 tháng) được báo cáo tại **4 mốc: tuần 4, 8, 12, 16**. Các đại lượng:

- **BAC** = {fmt_vnd(BAC)} đồng: ngân sách theo kế hoạch.
- **PV (Planned Value):** giá trị kế hoạch luỹ kế đến tuần báo cáo; lấy từ lịch ở mục 3 (giờ kế hoạch từng tuần x 50.000).
- **EV (Earned Value):** giá trị công việc thực tế hoàn thành luỹ kế = giờ kế hoạch của tuần x hiệu suất tiến độ của tuần; chặn ở BAC.
- **AC (Actual Cost):** chi phí thực tế luỹ kế = EV của tuần x hệ số chi phí (giờ thực tế trên giờ thu được).
- **SV = EV − PV; CV = EV − AC; SPI = EV / PV; CPI = EV / AC.**
- **Dự báo:** EAC = BAC / CPI (xu hướng chi phí giữ nguyên); EAC' = AC + (BAC − EV) / (CPI x SPI) (cả tiến độ và chi phí cùng ảnh hưởng); ETC = EAC − AC; VAC = BAC − EAC; TCPI = (BAC − EV) / (BAC − AC).
- **Ngưỡng:** SPI, CPI từ 0,95 là xanh; 0,85 đến dưới 0,95 là vàng; dưới 0,85 là đỏ.

## 8.2. Giả định mô phỏng

**EV và AC ở đây là số mô phỏng có kiểm soát, không phải số đo thật.** Lý do: file giờ công thật của nhóm (docs/pm/timelog.csv) ghi {sum(1 for _ in open(OUT / "timelog.csv", encoding="utf-8")) - 1} lượt việc với khoảng 63 giờ cho một dự án phần mềm hoàn chỉnh do 1 đến 2 người làm trong khoảng 8 tuần thật; con số đó không cùng quy mô với dự án mô phỏng {m.WEEKS} tuần x 4 người ({fmt_h(BAC_H)} giờ kế hoạch), nên nếu lấy làm AC thì CPI vô nghĩa (hàng chục lần). Vì vậy EVA dùng các giả định có kiểm soát dưới đây, **gắn với các sự kiện có thật** của dự án (giới hạn Google Books, sửa lỗi tính phạt, làm song song Frontend và Backend). File timelog thật vẫn được giữ trong Excel (sheet Timelog) để minh hoạ quy trình ghi giờ theo mã WBS.

{tbl(["Giai đoạn", "Hiệu suất tiến độ (EV/PV mỗi tuần)", "Hệ số chi phí (giờ thực/giờ thu được)", "Lý do"], [[a, num(b, 2), num(c, 2), d] for a, b, c, d in phase])}
**Bảng 8.1.** Giả định EVA. Riêng tuần 16 lấy phần còn lại để EV đạt 100% BAC (dự án hoàn thành đúng hạn). Công việc thay đổi đã duyệt (mục 9) tính vào dự phòng, không tính vào AC của EVA để EVA đo đúng theo phạm vi gốc.

## 8.3. Kết quả tại 4 mốc báo cáo

{tbl(["Mốc", "PV (đồng)", "EV (đồng)", "AC (đồng)", "SV (đồng)", "CV (đồng)", "SPI", "CPI"], rep)}
**Bảng 8.2.** PV, EV, AC và các chỉ số.

{tbl(["Mốc", "EAC = BAC/CPI", "EAC' (SPI x CPI)", "ETC", "VAC", "TCPI", "Trạng thái (tiến độ / chi phí)"], fc)}
**Bảng 8.3.** Dự báo khi hoàn thành (đồng).

{fig("eva_curves.png", "Hình 8.1. Đường cong PV, EV, AC tích luỹ")}
{fig("eva_indices.png", "Hình 8.2. SPI và CPI theo tuần")}
## 8.4. Giải thích tình trạng dự án

**Tuần 4 ({band(p4.spi)}, {band(p4.cpi)}).** SPI = {num(p4.spi, 3)}, CPI = {num(p4.cpi, 3)}: dự án chậm nhẹ ({fmt_vnd(-p4.sv)} đồng giá trị chưa thu được) và chi phí vượt khoảng {pct(1 / p4.cpi - 1, 1)}. Nguyên nhân là phải làm rõ thêm nghiệp vụ gia hạn và phạt trả trễ trong SRS. Chưa cần hành động, chỉ ghi nhận và theo dõi.

**Tuần 8 ({band(p8.spi)}, {band(p8.cpi)}).** SPI = {num(p8.spi, 3)}, CPI = {num(p8.cpi, 3)}: đây là điểm xấu nhất của dự án. Chậm {fmt_vnd(-p8.sv)} đồng giá trị và vượt chi phí {fmt_vnd(-p8.cv)} đồng. Nguyên nhân: nhập dữ liệu từ Google Books bị giới hạn tần suất nên phải chuyển sang bộ goodbooks-10k và dựng lại phần seed (R2), đồng thời Backend nền mất thêm giờ. Dự báo lúc này: EAC = {mil(p8.eac)}, vượt BAC khoảng {mil(-p8.vac)}, vẫn nằm trong dự phòng {mil(RESERVE)}. TCPI = {num(p8.tcpi, 3)}, nghĩa là từ đây phải làm hiệu quả hơn kế hoạch khoảng {pct(p8.tcpi - 1, 0)} mới giữ được BAC, điều khó đạt nên ta chấp nhận dùng dự phòng. **Hành động khắc phục đã quyết:** (1) chạy song song Frontend với Backend (đã nằm trong quan hệ SS); (2) làm thêm giờ có kiểm soát ở các tuần 9 đến 12; (3) hoãn phần "nhập ISBN từ Google Books" xuống ưu tiên thấp; (4) chốt không nhận thêm tính năng ngoài MVP.

**Tuần 12 ({band(p12.spi)}, {band(p12.cpi)}).** SPI = {num(p12.spi, 3)}, CPI = {num(p12.cpi, 3)}: tiến độ đã hồi phục về gần kế hoạch nhờ làm song song và làm thêm giờ, nhưng chi phí vẫn vượt vì tăng ca và sửa lỗi tính phạt theo ngày lịch (R10). EAC = {mil(p12.eac)}, vượt BAC {mil(-p12.vac)}.

**Tuần 16 ({band(p16.spi)}, {band(p16.cpi)}).** Dự án hoàn thành đúng hạn (EV = BAC, SPI = {num(p16.spi, 2)}), chi phí thực tế {mil(p16.ac)}, vượt BAC {mil(-p16.vac)} ({pct(-p16.vac / BAC, 1)}), **dùng {pct(reserve_used, 0)} dự phòng quản lý**. CPI cuối = {num(p16.cpi, 3)}.

## 8.5. Bài học và kiến nghị

1. Điểm nghẽn là phụ thuộc vào nguồn dữ liệu bên ngoài (Google Books); nên có nguồn dữ liệu dự phòng ngay từ sprint đầu.
2. Mạng dự án có nhiều đường găng song song nên mọi chậm trễ đều làm trễ ngày kết thúc; theo dõi SPI mỗi tuần thay vì mỗi 4 tuần sẽ phát hiện chậm ở tuần 6 thay vì tuần 8.
3. Ngưỡng hành động nên gắn với số: khi SPI hoặc CPI dưới 0,90 thì họp khẩn; dưới 0,85 thì cắt giảm phạm vi theo danh sách ưu tiên đã chốt.
4. Dự phòng 10% là vừa đủ; với dự án có rủi ro ước lượng cao hơn nên dùng 15%.

Bảng theo dõi theo tuần (cho đồ thị và để đối chiếu với file Excel):

{tbl(["Tuần", "PV", "EV", "AC", "SPI", "CPI"], wk)}
**Bảng 8.4.** PV, EV, AC luỹ kế theo tuần (đồng).

\\pagebreak
"""


def sec9() -> str:
    return f"""# 9. QUẢN LÝ THAY ĐỔI, TRUYỀN THÔNG VÀ KẾT LUẬN

## 9.1. Quy trình kiểm soát thay đổi (Change Control)

1. **Đề xuất:** bất kỳ ai cũng lập phiếu Change Request (CR) nêu lý do, tác động phạm vi, giờ, chi phí và rủi ro.
2. **Đánh giá:** Quản lý dự án ước lượng giờ và tác động lên đường găng trong vòng 1 ngày làm việc.
3. **Phê duyệt:** thay đổi dưới 8 giờ và không ảnh hưởng đường găng do Quản lý dự án duyệt; từ 8 giờ hoặc ảnh hưởng đường găng cần khách hàng (Product Owner) duyệt; vượt dự phòng cần giảng viên hướng dẫn thông báo.
4. **Thực hiện và cập nhật:** cập nhật WBS, lịch, sổ rủi ro; thông báo cả nhóm; ghi vào nhật ký CR.
5. **Đóng:** kiểm tra kết quả, ghi giờ thực tế để cập nhật dự phòng.

{tbl(["Mã", "Nội dung", "Lý do", "Tác động", "Quyết định", "Nguồn chi phí"], [
    ["CR-01", "Tính phạt trả trễ theo số ngày lịch theo múi giờ thư viện thay vì theo mỗi 24 giờ", "Phát hiện khi kiểm thử luồng thật: mượn lúc 23:59 và trả 00:01 bị tính sai", "Khoảng 6 giờ (sửa, thêm test biên); không ảnh hưởng đường găng", "Quản lý dự án duyệt, làm ngay", "Dự phòng"],
    ["CR-02", "Bổ sung trang quản trị đầy đủ (kho sách, tài khoản nhân viên, phiếu mượn, khoản phạt, theo dõi mô hình)", "Khách hàng cần một nơi quản trị tập trung", "Khoảng 30 giờ Frontend; chồng lấn thời gian nên không đẩy ngày kết thúc", "Khách hàng duyệt", "Dự phòng"],
    ["CR-03", "Chuyển nguồn dữ liệu chính sang goodbooks-10k, Google Books chỉ bổ sung có khoá", "Google Books giới hạn tần suất (R2)", "Khoảng 8 giờ dựng lại seed", "Quản lý dự án duyệt, thông báo khách hàng", "Dự phòng"],
])}
**Bảng 9.1.** Nhật ký thay đổi (ba CR tiêu biểu của dự án). Tổng khoảng 44 giờ, tương đương {fmt_vnd(44 * m.RATE)} đồng, bằng {pct(44 * m.RATE / RESERVE, 0)} dự phòng quản lý.

## 9.2. Quản lý bên liên quan và báo cáo

Khách hàng được tham gia ở các điểm quyết định (duyệt SOW, backlog, UAT, nghiệm thu), không phải mọi lúc, để không làm phình phạm vi. Giảng viên hướng dẫn nhận báo cáo ngắn tại 4 mốc EVA. Phản hồi của thủ thư sau UAT được ghi vào backlog cải tiến chứ không đưa thẳng vào sprint đang chạy.

## 9.3. Kết luận

Kế hoạch này mô tả một dự án 16 tuần, 4 người, ngân sách {mil(BAC)} cộng dự phòng {mil(RESERVE)}, với {len(m.WORK_PACKAGES)} gói công việc, {len(m.ACTIVITIES)} hoạt động, {len(PATHS)} đường găng song song và thời gian hoàn thành {int(m.PROJECT_WEEKS)} tuần. Phân tích PERT cho thấy xác suất đúng hạn thấp nếu không có biện pháp bù ({pct(m.normal_cdf((16 - EXP) / SD), 0)}), điều này giải thích vì sao kế hoạch giữ dự phòng tiền, cho phép làm thêm giờ có kiểm soát và giữ danh sách cắt giảm phạm vi. Về tài chính, NPV 3 năm {mil(FIN["npv"])}, ROI {pct(FIN["roi"], 0)} và hoàn vốn khoảng {round(FIN["payback"] * 12)} tháng cho thấy dự án đáng đầu tư, với điều kiện thủ thư thực sự dùng hệ thống. EVA mô phỏng cho thấy dự án đi qua một giai đoạn chậm ở tuần 8 (SPI {num(pts[8].spi, 2)}) rồi hồi phục, kết thúc đúng hạn và dùng {pct(-pts[16].vac / RESERVE, 0)} dự phòng.

**Hạn chế của báo cáo.** (1) EV và AC là số mô phỏng có kiểm soát, không phải số đo thật (giải thích ở mục 8.2). (2) Các giả định tài chính (quy mô trường, đơn giá, mức tiết kiệm thời gian) chưa được kiểm chứng ở một thư viện thật. (3) Hai nhân sự trong 4 vai trò là giả định. (4) Chỉ tiêu hiệu năng p95 chưa đo bằng công cụ tải.

**Hướng hoàn thiện.** Đo thật giờ công và hiệu suất ở dự án kế tiếp bằng cách ghi giờ theo mã WBS ngay từ ngày đầu (đã có khung `docs/pm/timelog.csv`); chạy thử với thư viện thật trong 3 tháng để thay giả định tài chính bằng số đo; thêm kiểm thử tải để đo p95.

## 9.4. Tài liệu tham khảo và công cụ

- PMI, *A Guide to the Project Management Body of Knowledge (PMBOK Guide)*, các chương về phạm vi, lịch, chi phí, rủi ro, nguồn lực.
- IEEE Std 830-1998, *Recommended Practice for Software Requirements Specifications*.
- Schwaber, K., Sutherland, J., *The Scrum Guide*.
- Tài liệu môn Công nghệ Phần mềm, các chương 6 đến 8 và 10 (quản lý rủi ro, thay đổi, EVA).
- Công cụ: Excel (WBS, CPM, EVA), GitHub (Issues, Projects, Actions), PlantUML, Python (openpyxl, matplotlib).
- Mã nguồn và tài liệu kỹ thuật: {REPO}.

## 9.5. Phụ lục: file Excel kèm theo

File `ULS_PM_Plan.xlsx` có 13 sheet và đều dùng công thức sống: README, GiaDinh (tham số, giả định), WBS (3 điểm, BAC), CPM (ES, EF, LS, LF, Slack), PERT (xác suất đúng hạn), Gantt, NguonLuc (giờ theo tuần và vai trò, PV), RuiRo (sổ rủi ro, EMV, ma trận), RACI (kiểm tra mỗi hạng mục có một A), TaiChinh (NPV, ROI, hoàn vốn, độ nhạy), EVA (PV, EV, AC, chỉ số, dự báo, đồ thị), Timelog (giờ thật), ChatLuong (tiêu chí và kết quả). Các ô vàng là dữ liệu nhập, đổi giá trị thì mọi kết quả tự cập nhật. Các con số trong báo cáo này được đối chiếu với file Excel bằng một bộ tính công thức độc lập (kết quả khớp tuyệt đối).
"""


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    md = cover() + sec1() + sec2() + sec3() + sec4() + sec5() + sec6() + sec7() + sec8() + sec9()
    md_path = OUT / "PM_Report.md"
    md_path.write_text(md, encoding="utf-8")
    print("wrote", md_path)
    md_to_docx.convert(md_path, OUT / "PM_Report.docx")
    print("wrote", OUT / "PM_Report.docx")


if __name__ == "__main__":
    main()
