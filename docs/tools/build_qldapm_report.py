"""Sinh báo cáo thực hành Quản lý dự án phần mềm (LAB 1 - 3) từ pm_model, qldapm_model, qldapm_calc.

Usage: python build_qldapm_report.py <thư-mục-docs/pm>
Chạy hai lượt để điền số trang vào danh mục bảng và hình (cần Microsoft Word để cập nhật trường và xuất PDF).
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

import fitz  # PyMuPDF, đọc PDF để lấy số trang của bảng và hình

import finalize_pm_docx as fin
import md_to_docx
import pm_model as m
import qldapm_calc as qc
import qldapm_model as q
from pm_model import fmt_h, fmt_vnd

OUT = (Path(sys.argv[1]) if len(sys.argv) > 1 else Path("../pm")).resolve()
FIG = "figures"
BS = chr(92)
PB = BS + "pagebreak"
LAND = BS + "landscape"
PORT = BS + "portrait"
REPO = "https://github.com/khoidev2001/university-library-system"
LIVE = "https://uls-library.vercel.app"

pts = {p.week: p for p in m.eva_points()}
BAC_H = m.bac_hours()
BAC = m.bac_money()
RESERVE = BAC * m.RESERVE_RATE
F3 = m.finance(3)
F5 = m.finance(5)
PLAN = q.compress_plan()
ROWS8 = q.eva_by_wp(8)
P8 = pts[8]
LOAD = qc.compressed_load()
EXP, SD = m.pert_project()


def tbl(headers: list[str], rows: list[list], font: float | None = None) -> str:
    def esc(x) -> str:
        return str(x).replace("|", "\\|").replace("\n", " ")
    out = []
    if font:
        out.append(f"<!--font:{font}-->")
    out.append("| " + " | ".join(esc(h) for h in headers) + " |")
    out.append("|" + "|".join("---" for _ in headers) + "|")
    for r in rows:
        out.append("| " + " | ".join(esc(c) for c in r) + " |")
    return "\n".join(out) + "\n"


def kv(rows: list[tuple[str, str]], head: tuple[str, str] = ("Mục", "Nội dung")) -> str:
    return tbl(list(head), [[a, b] for a, b in rows])


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


def lag_txt(lag: int) -> str:
    return f"+{lag}" if lag > 0 else (str(lag) if lag < 0 else "")


def preds_txt(code: str) -> str:
    a = m.ACT[code]
    if not a.preds:
        return "Không"
    return ", ".join(f"{q.WP_CODE[pc]} ({kind}{lag_txt(lag)})" for pc, kind, lag in a.preds)


def task_code(wp: m.WorkPackage, idx: int) -> str:
    return f"{q.WP_CODE[wp.activity]}.{idx}"


# ----------------------------------------------------------------------------- Phần mở đầu
def front(pages: dict[str, int] | None, body: str) -> str:
    caps_t = re.findall(r"^\*\*(Bảng \d+\.\d+)\.\*\* (.*)$", body, flags=re.M)
    caps_f = re.findall(r"^!\[(Hình \d+\.\d+)\. (.*?)\]\(", body, flags=re.M)

    def line(label: str, text: str) -> str:
        pg = (pages or {}).get(label, 0)
        text = text.replace("**", "")
        cut = text.find(". ", 12)
        short = text[:cut] if 0 < cut < 110 else (text if len(text) < 105 else text[:102] + "...")
        return f"@@LIST|{label}. {short}|{pg if pg else ''}"

    lot = "\n".join(line(a, b) for a, b in caps_t)
    lof = "\n".join(line(a, b) for a, b in caps_f)
    return f"""@@CB|13|TRƯỜNG ĐẠI HỌC XÂY DỰNG MIỀN TRUNG
@@CB|13|KHOA CÔNG NGHỆ THÔNG TIN
@@C|-----------------------------
@@CB|16|BÁO CÁO THỰC HÀNH TỔNG HỢP
@@CB|16|MÔN QUẢN LÝ DỰ ÁN PHẦN MỀM (LAB 1, LAB 2, LAB 3)
@@C|
@@CB|15|ĐỀ TÀI: PHẦN MỀM QUẢN LÝ THƯ VIỆN TRƯỜNG ĐẠI HỌC (ULS)
@@C|
@@C|Giảng viên hướng dẫn: Ts. Lê Tỷ Khánh
@@C|Nhóm 3, lớp D23CTC2
@@C|

{tbl(["Họ và tên", "MSSV", "Vai trò", "Phần phụ trách chính trong báo cáo", "Đóng góp"], [
    ["Trần Đình Khôi (nhóm trưởng)", "23Q74802012006", "Quản lý dự án, Backend và DevOps", "Charter, WBS và từ điển WBS; ước lượng, sơ đồ mạng, đường găng, nén tiến độ; EVA; kế hoạch kiểm thử; phần mềm ULS (Backend, hạ tầng)", "65%"],
    ["Nguyễn Như Quỳnh", "21DQ4802011003", "Frontend và AI/ML", "SOW, kế hoạch truyền thông, RACI; chọn sơ đồ tổ chức; phân tích tài chính; rủi ro; kiểm soát thay đổi; Test Script, vòng đời lỗi; phần mềm ULS (giao diện, mô hình)", "35%"],
])}
**Bảng phân công và đánh giá đóng góp.** Tỉ lệ đóng góp tính trên toàn bộ công việc của nhóm, gồm cả sản phẩm phần mềm ULS dùng làm đề tài xuyên suốt và các phần của báo cáo này.

@@C|
@@C|Mã nguồn: {REPO}
@@C|Hệ thống chạy thật: {LIVE}
@@C|Năm 2026

{PB}

@@CB|14|MỤC LỤC

[[TOC]]

{PB}

@@CB|14|DANH MỤC BẢNG

{lot}

{PB}

@@CB|14|DANH MỤC HÌNH

{lof}

{PB}

"""


# ----------------------------------------------------------------------------- PHẦN I
def part1() -> str:
    smart = tbl(["Mã", "Mục tiêu", "Đo lường", "Thời hạn"], [
        ["G1", "Số hoá toàn bộ nghiệp vụ mượn, trả, gia hạn, báo mất và tính phạt", "100% luồng nghiệp vụ trong SRS chạy được; quy tắc BR-01 đến BR-08 có kiểm thử", "Tuần 14"],
        ["G2", "Giảm thời gian xử lý một lượt mượn trả của thủ thư từ 3 phút xuống 1 phút", "Đo trong UAT bằng kịch bản mượn trả bằng mã vạch, trung bình dưới 60 giây", "Tuần 15"],
        ["G3", "Cho bạn đọc tra cứu sách và biết còn trên kệ hay không", "Tìm kiếm p95 dưới 1 giây với 1.000 đầu sách; trang đầu dưới 3 giây trên 4G", "Tuần 12"],
        ["G4", "Gợi ý sách và dự báo trả trễ đạt ngưỡng nghiệm thu", "Precision@5 từ 0,15; ROC-AUC từ 0,70", "Tuần 12"],
        ["G5", "Bảo đảm chất lượng mã nguồn", "Coverage dòng từ 80% trên lớp nghiệp vụ; CI xanh trên mọi Pull Request", "Tuần 14"],
        ["G6", "Đưa hệ thống lên môi trường thật", "Có địa chỉ trực tuyến truy cập được; docker compose up dựng đủ 5 dịch vụ", "Tuần 15"],
        ["G7", "Hoàn thành đúng hạn, trong ngân sách", f"Kết thúc tuần 16; chi phí không vượt BAC cộng dự phòng ({mil(BAC + RESERVE)})", "Tuần 16"],
    ])
    charter = kv([
        ("Tên dự án", "Phần mềm Quản lý Thư viện Trường Đại học (ULS)"),
        ("Nhà tài trợ, khách hàng", "Ban giám đốc Thư viện Trường Đại học Xây dựng Miền Trung (giả định)"),
        ("Quản lý dự án", "Trần Đình Khôi; có quyền phân công, điều phối ngân sách dự phòng trong ngưỡng 8 giờ và quyết định thứ tự ưu tiên sprint"),
        ("Thời gian", "16 tuần, từ 21/09/2026 đến 10/01/2027"),
        ("Lý do đầu tư", "Thư viện đang ghi sổ tay: thủ thư mất khoảng 3 phút cho mỗi lượt mượn trả, tính phạt thủ công dễ sai, bạn đọc không biết sách còn trên kệ, báo cáo thống kê làm tay mất nhiều giờ mỗi tháng. Dự án tự động hoá các việc này; phân tích ở mục 2.1 cho NPV 3 năm dương và hoàn vốn dưới 1 năm."),
        ("Mục tiêu", "7 mục tiêu SMART ở bảng 1.2"),
        ("Phạm vi high-level", "Trong: quản lý sách, bạn đọc, mượn trả và phạt, tìm kiếm, báo cáo, gợi ý và dự báo trả trễ, quản trị, triển khai cloud, đào tạo thủ thư. Ngoài: đặt trước, email nhắc hạn, thanh toán trực tuyến, ứng dụng di động."),
        ("Sản phẩm bàn giao chính", "Hệ thống chạy trực tuyến; mã nguồn và Docker; SRS, SDD, đặc tả API; báo cáo kiểm thử; hướng dẫn sử dụng; kế hoạch quản lý dự án"),
        ("Ngân sách ước tính sơ bộ", f"Khoảng 30 triệu đồng (sai số cho phép từ −10% đến +25%); sau khi ước lượng chi tiết, đường cơ sở là {mil(BAC)} cộng dự phòng quản lý {mil(RESERVE)}"),
        ("Mốc chính", "M1 duyệt SOW (tuần 2); M2 duyệt SRS (tuần 3); M3 duyệt thiết kế (tuần 5); M4 lõi chạy đầu-cuối (tuần 9); M5 AI đạt ngưỡng (tuần 12); M6 tích hợp xong (tuần 14); M7 qua UAT và lên cloud (tuần 15); M8 nghiệm thu (tuần 16)"),
        ("Ràng buộc", "Hạn nộp cuối kỳ không dời được; 4 người bán thời gian, mỗi người khoảng 16 giờ mỗi tuần; chỉ dùng hạ tầng gói miễn phí (không có thẻ thanh toán); Google Books giới hạn tần suất"),
        ("Giả thiết", "Thủ thư đại diện tham gia khảo sát và kiểm thử chấp nhận; dữ liệu sách mẫu từ goodbooks-10k có ISBN; lịch sử mượn trả để huấn luyện mô hình là dữ liệu mô phỏng; đơn giá giờ công 50.000 đồng"),
        ("Rủi ro cấp cao", "Hạ tầng miễn phí tự ngủ khi demo (R1); phình phạm vi (R5); ước lượng thấp hơn thực tế (R6)"),
        ("Tiêu chí thành công", "Đúng phạm vi, đúng hạn 16 tuần, chi phí không vượt BAC cộng dự phòng; coverage từ 80%; khách hàng ký nghiệm thu (chi tiết ở mục 3.4.4)"),
    ], head=("Hạng mục", "Nội dung"))
    stake = tbl(["Bên liên quan", "Vai trò", "Mối quan tâm chính", "Quyền lực", "Quan tâm"], [
        ["Ban giám đốc thư viện", "Nhà tài trợ, Product Owner", "Nghiệp vụ đúng, tiết kiệm công sức, chi phí vận hành thấp", "Cao", "Cao"],
        ["Thủ thư", "Người dùng chính", "Mượn trả nhanh, ít sai, báo cáo sẵn", "Trung bình", "Cao"],
        ["Sinh viên", "Bạn đọc", "Tra cứu nhanh, biết hạn trả, ít bị phạt", "Thấp", "Cao"],
        ["Giảng viên (bạn đọc)", "Bạn đọc", "Mượn nhiều hơn, gia hạn dễ", "Thấp", "Trung bình"],
        ["Giảng viên hướng dẫn", "Xem xét, đánh giá", "Đủ nội dung, hợp lý, trình bày rõ", "Cao", "Cao"],
        ["Phòng CNTT của trường", "Hỗ trợ hạ tầng, bảo mật", "Tuân thủ an toàn thông tin", "Trung bình", "Trung bình"],
        ["Nhà cung cấp hạ tầng", "Vercel, Render, Neon", "Gói miễn phí, giới hạn sử dụng", "Thấp", "Thấp"],
    ])
    sign = tbl(["Vai trò", "Họ và tên", "Chữ ký (giả định)", "Ngày"], [
        ["Nhà tài trợ", "Đại diện Ban giám đốc Thư viện", "(đã ký, giả định)", "22/09/2026"],
        ["Quản lý dự án", "Trần Đình Khôi", "(đã ký)", "22/09/2026"],
        ["Thành viên nhóm", "Nguyễn Như Quỳnh", "(đã ký)", "22/09/2026"],
        ["Người xem xét", "Ts. Lê Tỷ Khánh", "(xem xét, giả định)", "22/09/2026"],
    ])
    sow = kv([
        ("Mục đích", "Xác định công việc nhóm dự án sẽ thực hiện, sản phẩm bàn giao, tiêu chí chấp nhận và các điều kiện để hai bên cùng hiểu một phạm vi."),
        ("Phạm vi công việc", "Khảo sát và đặc tả; thiết kế kiến trúc, cơ sở dữ liệu, API, giao diện, mô hình AI; xây dựng Backend, Frontend, dịch vụ AI; kiểm thử nhiều tầng; đóng gói, CI/CD, triển khai cloud; tài liệu và đào tạo thủ thư; quản lý dự án."),
        ("Ngoài phạm vi", "Đặt trước sách, email nhắc hạn, thanh toán phạt trực tuyến, ứng dụng di động, tích hợp hệ thống quản lý sinh viên, số hoá tài liệu."),
        ("Địa điểm, hình thức làm việc", "Làm việc từ xa; họp trực tiếp hoặc trực tuyến khi cần; mã nguồn và tài liệu trên GitHub."),
        ("Nhân sự", "4 vai trò: quản lý dự án và Backend lead; Frontend và AI; Backend và DevOps; BA và kiểm thử. Mỗi người khoảng 16 giờ mỗi tuần."),
        ("Chi phí", f"Đường cơ sở {mil(BAC)}, dự phòng {mil(RESERVE)}. Đơn giá 50.000 đồng mỗi giờ công; không phát sinh chi phí hạ tầng trong dự án."),
        ("Lịch", "16 tuần với 8 mốc quan trọng; lịch chi tiết ở mục 2.3."),
        ("Tiêu chí chấp nhận sản phẩm", "Mọi User Story trong phạm vi đạt tiêu chí chấp nhận; không còn lỗi mức Nghiêm trọng; coverage từ 80%; chỉ số mô hình đạt ngưỡng; bản chạy thật truy cập được; tài liệu bàn giao đầy đủ."),
        ("Quy trình chấp nhận", "Khách hàng chạy kiểm thử chấp nhận theo kịch bản, ghi biên bản; nhóm sửa lỗi trong 3 ngày làm việc; khách hàng ký nghiệm thu khi đạt."),
        ("Quản lý thay đổi", "Mọi thay đổi phạm vi đi qua phiếu Change Request, duyệt theo ngưỡng giờ công (mục 3.3.2)."),
        ("Giả định và ràng buộc", "Như Project Charter (bảng 1.1)."),
    ], head=("Hạng mục", "Nội dung"))
    deliv = tbl(["Sản phẩm", "Tiêu chí chấp nhận", "Tuần", "Người duyệt"], [
        ["SRS và 20 User Story", "Mỗi User Story có tiêu chí chấp nhận đo được; khách hàng ký", "3", "Khách hàng"],
        ["Thiết kế (kiến trúc, CSDL, API, giao diện)", "Rà soát chéo, không còn điểm mở nghiêm trọng", "5", "Quản lý dự án, khách hàng"],
        ["Backend, Frontend, dịch vụ AI", "Demo luồng mượn trả đầu-cuối; test xanh", "9 đến 12", "Khách hàng"],
        ["Hệ thống tích hợp, báo cáo kiểm thử", "Coverage từ 80%; 0 lỗi Nghiêm trọng", "14", "Quản lý dự án, QA"],
        ["Bản chạy trực tuyến, hướng dẫn sử dụng", "Địa chỉ truy cập được; thủ thư được đào tạo", "15", "Khách hàng"],
        ["Biên bản nghiệm thu, báo cáo cuối", "Khách hàng ký", "16", "Khách hàng"],
    ])
    comm = tbl(["Thông tin", "Đối tượng", "Kênh", "Tần suất", "Người gửi", "Hồ sơ lưu"], [
        ["Tiến độ ngắn trong ngày", "Cả nhóm", "Tin nhắn nhóm 15 phút", "Hằng ngày", "Scrum Master", "Ghi chú họp"],
        ["Kế hoạch và đánh giá sprint", "Cả nhóm, khách hàng", "Họp trực tuyến 45 phút", "2 tuần một lần", "Quản lý dự án", "Biên bản, backlog"],
        ["Báo cáo tình hình (tiến độ, chi phí, EVA)", "Giảng viên hướng dẫn, nhà tài trợ", "Báo cáo ngắn có biểu đồ", "Tuần 4, 8, 12, 16", "Quản lý dự án", "Báo cáo EVA"],
        ["Thay đổi phạm vi", "Khách hàng", "Phiếu Change Request", "Khi phát sinh", "Người đề xuất, Quản lý dự án", "Nhật ký thay đổi"],
        ["Lỗi nghiêm trọng", "Cả nhóm, khách hàng", "GitHub Issues, tin nhắn", "Ngay khi phát hiện", "QA", "Issue, báo cáo lỗi"],
        ["Rủi ro", "Cả nhóm, nhà tài trợ", "Sổ rủi ro", "Rà soát mỗi sprint", "Quản lý dự án", "Sổ rủi ro"],
        ["Kết quả kiểm thử, phát hành", "Cả nhóm, khách hàng", "Kết quả CI, ghi chú phát hành", "Mỗi lần gộp vào main", "QA, DevOps", "GitHub Actions"],
    ])
    raci_rows = [[code, name] + [cells[c] for c in m.RACI_COLS] for code, name, cells in m.RACI]
    raci = tbl(["Mã", "Hạng mục"] + [m.RACI_COL_NAMES[c] for c in m.RACI_COLS], raci_rows, font=9.5)
    types = tbl(["Tiêu chí", "Chức năng", "Ma trận", "Theo dự án (Projectized)"], [
        ["Quyền của quản lý dự án", "Thấp, trưởng bộ phận quyết định", "Vừa, chia sẻ với trưởng bộ phận", "Cao, toàn quyền"],
        ["Nguồn lực", "Thuộc bộ phận, dùng chung nhiều việc", "Thuộc bộ phận, mượn cho dự án", "Chuyên trách cho dự án"],
        ["Hiệu quả dùng nhân lực", "Cao nhưng dự án thường là ưu tiên thấp", "Khá cao", "Thấp nếu hết việc"],
        ["Phù hợp với ULS", "Không: không ai chịu trách nhiệm cuối", "Có: thành viên đến từ lớp và khoa, làm bán thời gian", "Không: không đủ người, không có chuyên trách"],
    ])
    frames = tbl(["Góc nhìn", "Câu hỏi trọng tâm", "Biểu hiện trong ULS", "Mức phù hợp"], [
        ["Cấu trúc (Structural)", "Ai làm gì, báo cáo cho ai, quy trình nào?", "Vai trò, RACI, quy trình Pull Request, cổng CI, mốc nghiệm thu", "Rất phù hợp (chọn)"],
        ["Nguồn nhân lực (Human resource)", "Nhu cầu, động lực, kỹ năng của con người?", "Rà soát chéo, chia sẻ kiến thức, cân bằng tải với lịch thi", "Phù hợp, bổ trợ"],
        ["Chính trị (Political)", "Ai có quyền lực, nguồn lực khan hiếm chia thế nào?", "Product Owner quyết định ưu tiên; dự phòng là nguồn lực chung", "Ít phù hợp (nhóm nhỏ)"],
        ["Biểu tượng (Symbolic)", "Ý nghĩa, văn hoá, nghi thức của nhóm?", "Nghi thức demo cuối sprint, quy ước đặt tên, bảng Kanban chung", "Ít phù hợp, bổ trợ nhẹ"],
    ])
    wbs_rows = []
    for pcode, pname, groups in q.LAB_WBS:
        wbs_rows.append([pcode, "1", pname, "", ""])
        for gcode, gname, acts in groups:
            wbs_rows.append([gcode, "2", gname, "", ""])
            for a in acts:
                h = q.act_hours(a)
                wbs_rows.append([q.WP_CODE[a], "3", q.wp_name(a), a if a != "LOE" else "duy trì", fmt_h(h)])
    wbs_list = tbl(["Mã WBS", "Cấp", "Tên (khớp với sơ đồ mạng, Gantt, EVA)", "Mã mạng", "Giờ kỳ vọng"], wbs_rows, font=10.5)
    task_rows = []
    for a in [x.code for x in m.ACTIVITIES] + ["LOE"]:
        for i, w in enumerate(q.act_tasks(a), start=1):
            task_rows.append([task_code(w, i), w.name, q.WP_CODE[a], w.owner, fmt_h(w.o), fmt_h(w.m), fmt_h(w.p), fmt_h(w.e)])
    tasks = tbl(["Mã công việc", "Công việc chi tiết (cấp 4)", "Thuộc WP", "Vai trò", "O", "M", "P", "E"], task_rows, font=9.5)
    dicts = ""
    for k, code in enumerate(["H", "I", "L"], start=1):
        dicts += f"### 1.5.{k + 2}. Từ điển WBS: {q.WP_CODE[code]} {m.ACT[code].name}\n\n"
        dicts += kv(q.dictionary_rows(code), head=("Thuộc tính", "Mô tả")) + f"**Bảng 1.{k + 8}.** Từ điển WBS cho gói công việc {q.WP_CODE[code]}.\n\n"
    return f"""# PHẦN I: KHỞI TẠO DỰ ÁN, PHẠM VI VÀ CẤU TRÚC PHÂN RÃ CÔNG VIỆC (LAB 1)

## 1.1. Giới thiệu đề tài

Đề tài xuyên suốt của nhóm là **Phần mềm Quản lý Thư viện Trường Đại học (ULS)**: một hệ thống web quản lý sách, bạn đọc, mượn trả, tìm kiếm và thống kê cho thư viện, kèm gợi ý sách và dự báo nguy cơ trả trễ. Phần mềm đã được xây dựng và chạy thật tại {LIVE} (Backend NestJS, Frontend Next.js, dịch vụ AI FastAPI; 48 API, 160 kiểm thử tự động đạt 100%). Trong báo cáo này, dự án được **mô phỏng dưới dạng một dự án 16 tuần, 4 vai trò, đơn giá 50.000 đồng/giờ** để thực hành lập kế hoạch, ước lượng, lập lịch, rủi ro, EVA và chất lượng. Số liệu phần mềm thật (kiểm thử, kiến trúc) được dùng khi có; số liệu chi phí, giờ công và EVA là mô phỏng và được ghi rõ.

**Nhất quán dữ liệu.** Tên các gói công việc ở mục 1.5 (WBS) được dùng nguyên văn ở sơ đồ mạng và Gantt (mục 2.3), ở EVA (mục 3.2) và ở đường cơ sở (mục 3.3). Mỗi gói công việc có một mã WBS và một mã mạng (chữ cái) để đối chiếu.

## 1.2. Nhiệm vụ 1: Tôn chỉ dự án (Project Charter)

{charter}**Bảng 1.1.** Tôn chỉ dự án (Project Charter).

{smart}**Bảng 1.2.** Mục tiêu SMART của dự án.

{stake}**Bảng 1.3.** Danh sách các bên liên quan.

{fig("stakeholders.png", "Hình 1.1. Ma trận quyền lực và quan tâm của các bên liên quan")}
{sign}**Bảng 1.4.** Phê duyệt Tôn chỉ dự án (chữ ký là giả định phục vụ bài thực hành).

## 1.3. Nhiệm vụ 2: Phát biểu bài toán (SOW) và Kế hoạch truyền thông

### 1.3.1. Phát biểu bài toán (SOW)

{sow}**Bảng 1.5.** Phát biểu bài toán (SOW).

{deliv}**Bảng 1.6.** Sản phẩm bàn giao và tiêu chí chấp nhận.

### 1.3.2. Kế hoạch quản lý truyền thông

Nguyên tắc: thông tin đúng người, đúng lúc, đúng kênh; mọi quyết định quan trọng phải có hồ sơ lưu. Vấn đề không giải quyết được ở cấp thành viên chuyển lên quản lý dự án trong 1 ngày làm việc, vượt quyền quản lý dự án chuyển cho khách hàng hoặc giảng viên hướng dẫn trong 2 ngày.

{comm}**Bảng 1.7.** Kế hoạch truyền thông.

### 1.3.3. Ma trận phân chia trách nhiệm (RACI)

R: thực hiện; A: chịu trách nhiệm cuối (đúng một người cho mỗi hạng mục); C: được tham vấn; I: được thông báo; A/R: vừa chịu trách nhiệm vừa thực hiện.

{raci}**Bảng 1.8.** Ma trận RACI (đã kiểm tra tự động trong Excel: mỗi hạng mục có đúng một A).

## 1.4. Nhiệm vụ 3: Cơ cấu tổ chức và góc nhìn tổ chức

### 1.4.1. Loại cấu trúc tổ chức dự án

{types}**Bảng 1.9.** So sánh các loại cấu trúc tổ chức dự án.

**Lựa chọn: ma trận cân bằng (balanced matrix).** Các thành viên cùng lớp, thuộc khoa Công nghệ Thông tin, làm bán thời gian cho dự án và vẫn có việc học ở bộ phận gốc. Quản lý dự án quyết định việc gì, ai làm, bao giờ xong; khoa và giảng viên hướng dẫn quyết định phân bổ thời gian chung. Cấu trúc theo chức năng khiến dự án không có người chịu trách nhiệm cuối, còn cấu trúc theo dự án đòi hỏi nhân sự chuyên trách mà nhóm không có.

### 1.4.2. Phân tích bốn góc nhìn tổ chức

Theo khung bốn góc nhìn (cấu trúc, nguồn nhân lực, chính trị, biểu tượng), mỗi góc nhìn giúp thấy một khía cạnh khác của tổ chức dự án.

{frames}**Bảng 1.10.** Phân tích bốn góc nhìn tổ chức và mức phù hợp với dự án ULS.

**Lựa chọn: góc nhìn Cấu trúc (Structural).** Lý do: (1) dự án phần mềm nhỏ, rủi ro lớn nhất là chồng chéo hoặc bỏ sót việc giữa 4 vai trò, nên cần vai trò, quy trình và quyền hạn rõ ràng; (2) hoạt động của nhóm vốn dựa trên quy trình đo được (Pull Request, cổng CI, mốc nghiệm thu) hợp với tư duy cấu trúc; (3) hai góc nhìn Chính trị và Biểu tượng ít tác động vì nhóm chỉ có hai thành viên thật, không có nhiều phe phái; (4) góc nhìn Nguồn nhân lực được dùng bổ trợ để cân tải theo lịch thi. Áp dụng cụ thể: sơ đồ tổ chức ở hình 1.2, RACI ở bảng 1.8, quy tắc báo cáo và truyền thông ở bảng 1.7.

{fig("org.png", "Hình 1.2. Sơ đồ tổ chức nhóm dự án theo góc nhìn cấu trúc")}
## 1.5. Nhiệm vụ 4: Cấu trúc phân rã công việc (WBS)

### 1.5.1. Sơ đồ WBS dạng cây

WBS có **4 cấp**: cấp 1 là pha vòng đời (7 pha), cấp 2 là nhóm công việc, cấp 3 là gói công việc (Work Package) và cấp 4 là công việc chi tiết (42 công việc). Gói công việc được dùng làm đơn vị lập lịch, ước lượng chi phí và đo EVA; mỗi gói có một người chịu trách nhiệm chính và sản phẩm kiểm tra được. Công việc duy trì (7.1.1) trải đều suốt dự án nên không nằm trong sơ đồ mạng.

{LAND}

{fig("wbs_tree.png", "Hình 1.3. WBS dạng cây đến cấp 3 (Work Package)")}
{PORT}

### 1.5.2. WBS dạng danh sách (Indent/List)

{wbs_list}**Bảng 1.11.** WBS dạng danh sách đến cấp 3 (20 gói công việc), tổng {fmt_h(BAC_H)} giờ, BAC {fmt_vnd(BAC)} đồng.

Công việc chi tiết (cấp 4) của từng gói, kèm ước lượng ba điểm (đơn vị: giờ; O lạc quan, M khả dĩ nhất, P bi quan, E = (O + 4M + P) / 6):

{tasks}**Bảng 1.12.** Công việc chi tiết cấp 4 và ước lượng giờ công.

### 1.5.3. Từ điển WBS (WBS Dictionary)

Từ điển mô tả ba gói công việc trọng yếu, đều nằm trên đường găng: Backend nền ({q.WP_CODE["H"]}), Backend mượn trả ({q.WP_CODE["I"]}) và AI gợi ý, dự báo ({q.WP_CODE["L"]}).

{dicts}"""


# ----------------------------------------------------------------------------- PHẦN II
def part2() -> str:
    f = F3
    labels = ["Năm 0", "Năm 1", "Năm 2", "Năm 3"]
    benefits = [0] + [f["benefit_full"] * a for a in m.FIN["adoption"]]
    costs = [f["invest"]] + [f["ops"]] * 3
    cum = 0.0
    cash = []
    for t in range(4):
        cum += f["flows"][t]
        cash.append([labels[t], fmt_vnd(benefits[t]), fmt_vnd(costs[t]), fmt_vnd(f["flows"][t]), num(1 / (1 + m.FIN["discount"]) ** t, 4), fmt_vnd(f["pv_list"][t]), fmt_vnd(cum)])
    cash5 = []
    cum5 = 0.0
    ad5 = list(m.FIN["adoption"]) + [1.0, 1.0]
    for t in range(6):
        b = 0 if t == 0 else f["benefit_full"] * ad5[t - 1]
        c = F5["invest"] if t == 0 else F5["ops"]
        cum5 += F5["flows"][t]
        cash5.append([f"Năm {t}", fmt_vnd(b), fmt_vnd(c), fmt_vnd(F5["flows"][t]), num(1 / (1 + m.FIN["discount"]) ** t, 4), fmt_vnd(F5["pv_list"][t]), fmt_vnd(cum5)])
    npv_terms = " + ".join(f"({fmt_vnd(f['flows'][t])} / {num((1 + m.FIN['discount']) ** t, 4)})" for t in range(4))
    pv_sum = " + ".join(fmt_vnd(v) for v in f["pv_list"])
    ass = tbl(["Giả định", "Giá trị", "Cơ sở"], [
        ["Vốn đầu tư ban đầu", f"{fmt_vnd(f['invest'])} đồng", "BAC cộng dự phòng quản lý 10%"],
        ["Số bạn đọc; lượt mượn mỗi người mỗi năm", f"{fmt_vnd(m.FIN['reader_count'])}; {m.FIN['loans_per_reader_year']}", "Giả định quy mô trường"],
        ["Thời gian thủ thư tiết kiệm mỗi lượt", f"{m.FIN['minutes_saved_per_loan']} phút", "Ghi sổ tay 3 phút, quét mã vạch 1 phút"],
        ["Lượt tra cứu hộ; phút tiết kiệm mỗi lượt", f"{fmt_vnd(m.FIN['lookups_per_year'])}; {m.FIN['minutes_saved_per_lookup']} phút", "Bạn đọc tự tra cứu trực tuyến"],
        ["Đơn giá giờ thủ thư", f"{fmt_vnd(m.FIN['librarian_rate'])} đồng", "Giả định"],
        ["Giờ làm báo cáo tiết kiệm", f"{m.FIN['report_hours_saved']} giờ mỗi năm", "12 báo cáo x 8 giờ, nay chạy tự động"],
        ["Thất thoát sách hiện nay; mức giảm", f"{fmt_vnd(m.FIN['lost_book_value_year'])} đồng mỗi năm; {pct(m.FIN['lost_reduction'], 0)}", "Nhờ theo dõi quá hạn, báo mất"],
        ["Mức áp dụng các năm 1, 2, 3", "70%, 100%, 100%", "Năm 1 còn làm quen, chạy song song với sổ tay"],
        ["Chi phí vận hành mỗi năm", f"{fmt_vnd(f['ops'])} đồng", "Hạ tầng trả phí tối thiểu 6.000.000; bảo trì 60 giờ x 50.000; đào tạo 3.000.000"],
        ["Tỉ lệ chiết khấu", "r = 10%", "Theo đề bài"],
    ])
    ben = tbl(["Khoản lợi ích", "Cách tính", "Giá trị (đồng/năm)"], [
        ["Giờ thủ thư khi mượn trả", f"{fmt_vnd(f['loans'])} lượt x {m.FIN['minutes_saved_per_loan']} phút / 60 x {fmt_vnd(m.FIN['librarian_rate'])}", fmt_vnd(f["b_loan"])],
        ["Giờ tra cứu hộ", f"{fmt_vnd(m.FIN['lookups_per_year'])} lượt x {m.FIN['minutes_saved_per_lookup']} phút / 60 x {fmt_vnd(m.FIN['librarian_rate'])}", fmt_vnd(f["b_lookup"])],
        ["Giờ làm báo cáo", f"{m.FIN['report_hours_saved']} giờ x {fmt_vnd(m.FIN['librarian_rate'])}", fmt_vnd(f["b_report"])],
        ["Giảm thất thoát sách", f"{fmt_vnd(m.FIN['lost_book_value_year'])} x {pct(m.FIN['lost_reduction'], 0)}", fmt_vnd(f["b_lost"])],
        ["**Tổng lợi ích đầy đủ**", "", f"**{fmt_vnd(f['benefit_full'])}**"],
    ])
    sens = []
    for bf in (1.0, 0.7, 0.5, 0.3):
        sens.append([pct(bf, 0)] + [fmt_vnd(m.npv_with(d, bf)) for d in (0.08, 0.10, 0.12, 0.15)])
    lo, hi = 0.0, 1.0
    for _ in range(60):
        mid = (lo + hi) / 2
        if m.npv_with(0.10, mid) > 0:
            hi = mid
        else:
            lo = mid
    # bảng công việc
    wp_rows = []
    for a in m.ACTIVITIES:
        h = q.act_hours(a.code)
        wp_rows.append([q.WP_CODE[a.code], a.code, a.name, a.dur, fmt_h(h), fmt_vnd(h * m.RATE), preds_txt(a.code)])
    h_loe = q.act_hours("LOE")
    wp_rows.append([q.WP_CODE["LOE"], "-", q.LOE_NAME, "16 (duy trì)", fmt_h(h_loe), fmt_vnd(h_loe * m.RATE), "Không (trải đều suốt dự án)"])
    rel = tbl(["Quan hệ", "Ý nghĩa", "Ví dụ trong dự án"], [
        ["FS (Finish to Start)", "Việc sau chỉ bắt đầu khi việc trước kết thúc", f"{q.WP_CODE['E']} Thiết kế kiến trúc, CSDL kết thúc rồi {q.WP_CODE['H']} Backend nền mới bắt đầu"],
        ["SS (Start to Start)", "Việc sau bắt đầu sau khi việc trước bắt đầu một thời gian (lag)", f"{q.WP_CODE['I']} Backend mượn trả bắt đầu sau {q.WP_CODE['H']} Backend nền bắt đầu 1 tuần (SS+1)"],
        ["FF (Finish to Finish)", "Việc sau chỉ được kết thúc sau khi việc trước kết thúc một thời gian", f"{q.WP_CODE['N']} Kiểm thử đơn vị, tích hợp kết thúc sau {q.WP_CODE['I']} Backend mượn trả kết thúc 2 tuần (FF+2): vẫn phải kiểm thử lại phần mã cuối"],
        ["SF (Start to Finish)", "Việc sau chỉ được kết thúc sau khi việc trước bắt đầu", f"{q.WP_CODE['R']} Tài liệu, đào tạo chỉ kết thúc khi {q.WP_CODE['P']} Triển khai cloud bắt đầu (SF): buổi đào tạo cuối chạy trên môi trường mới"],
        ["Lead (lag âm)", "Việc sau bắt đầu trước khi việc trước kết thúc xong", "Dùng ở phương án nén tiến độ (mục 2.4): FS−1"],
    ])
    fwd = []
    for a in m.ACTIVITIES:
        es_t, ef_t = qc.forward_text(a.code)
        lf_t, ls_t = qc.backward_text(a.code)
        fwd.append([f"{q.WP_CODE[a.code]} ({a.code})", es_t, ef_t, lf_t, ls_t, qc.slack_text(a.code)])
    cpm_tab = tbl(["Mã", "ES", "EF", "LF", "LS", "Slack"], fwd, font=8.5)
    cpm_rows = []
    for a in m.ACTIVITIES:
        r = m.CPM[a.code]
        cpm_rows.append([q.WP_CODE[a.code], a.name, a.dur, qc.n(r.es), qc.n(r.ef), qc.n(r.ls), qc.n(r.lf), qc.n(r.slack), "Găng" if r.critical else ""])
    paths = chr(10).join("- Đường " + str(k) + ": " + " → ".join(q.WP_CODE[x] for x in p) + " (" + " → ".join(p) + ")" for k, p in enumerate(m.critical_paths(), start=1))
    non_crit = ", ".join(f"{q.WP_CODE[a.code]} {a.name} (Slack {qc.n(m.CPM[a.code].slack)})" for a in m.ACTIVITIES if not m.CPM[a.code].critical)
    # nén
    A, B, C = PLAN["A"], PLAN["B"], PLAN["C"]
    ft_rows = [[fid, desc, hours, fmt_vnd(hours * m.RATE)] for fid, _, _, desc, hours in q.FAST_TRACK]
    ft_rows.append(["", "**Tổng làm lại dự phòng**", sum(h for *_, h in q.FAST_TRACK), f"**{fmt_vnd(sum(h for *_, h in q.FAST_TRACK) * m.RATE)}**"])
    slope_rows = []
    for a in m.ACTIVITIES:
        if not m.CPM[a.code].critical:
            continue
        wk = q.act_cost(a.code) / a.dur
        slope_rows.append([f"{q.WP_CODE[a.code]} {a.name}", fmt_vnd(wk), pct(q.PREMIUM[a.code], 0), fmt_vnd(wk * q.PREMIUM[a.code]), qc.n(q.crash_limit(a))])
    steps_rows = []
    for k, st in enumerate(C["steps"], start=1):
        steps_rows.append([k, f"{q.WP_CODE[st.code]} {m.ACT[st.code].name}", qc.n(st.weeks), fmt_vnd(st.cost), f"{qc.n(st.end_before)} xuống {qc.n(st.end_after)}"])
    comp_cpm = m.run_cpm(C["acts"])
    comp_rows = []
    for a in C["acts"]:
        r = comp_cpm[a.code]
        comp_rows.append([q.WP_CODE[a.code], a.name, qc.n(a.dur), preds_txt_from(a), qc.n(r.es), qc.n(r.ef), qc.n(r.ls), qc.n(r.lf), qc.n(r.slack), "Găng" if r.critical else ""])
    comp_end = max(r.ef for r in comp_cpm.values())
    opt_rows = [
        ["A. Chỉ crashing", qc.n(round(A["end"], 2)), pct(1 - A["end"] / m.PROJECT_WEEKS), fmt_vnd(A["cost"]), "Chưa đạt: mỗi hoạt động chỉ nén tối đa 30%"],
        ["B. Chỉ fast-tracking", qc.n(round(B["end"], 2)), pct(1 - B["end"] / m.PROJECT_WEEKS), fmt_vnd(B["cost"]), "Chưa đạt (gần mục tiêu)"],
        ["C. Kết hợp (khuyến nghị)", qc.n(round(C["end"], 2)), pct(1 - C["end"] / m.PROJECT_WEEKS), fmt_vnd(C["cost"]), "Đạt"],
    ]
    risk_comp = tbl(["Rủi ro khi nén", "Nguyên nhân", "Mức", "Biện pháp"], [
        ["Quá tải nhân lực", f"Tải đỉnh nhóm tăng từ {num(LOAD['base_peak'], 1)} lên {num(LOAD['peak'], 1)} giờ/tuần (tuần {LOAD['peak_week']}) so với năng lực {LOAD['cap']}; một vai trò lên {num(max(LOAD['role_peak'].values()), 1)} giờ/tuần", "Cao", "Cho phép làm thêm giờ ngắn hạn tối đa 25%, theo dõi mệt mỏi; không nén hoạt động của vai trò đã quá tải"],
        ["Làm lại do chồng lấn (fast-tracking)", "Bắt đầu tích hợp khi Frontend và AI chưa xong; thiết kế bắt đầu khi SRS chưa chốt", "Cao", "Hợp đồng API đóng băng sớm; mock dịch vụ AI; họp đồng bộ hằng ngày; dự phòng 30 giờ làm lại"],
        ["Chất lượng giảm", "Rút ngắn kiểm thử hệ thống và UAT", "Trung bình", "Không nén kiểm thử; giữ cổng CI và coverage 80%"],
        ["Chi phí tăng", f"Tăng {fmt_vnd(C['cost'])} đồng ({pct(C['cost'] / BAC)} BAC)", "Trung bình", f"Cần khách hàng duyệt; chiếm {pct(C['cost'] / RESERVE, 0)} dự phòng quản lý"],
        ["Mất dự trữ", "Số hoạt động găng tăng, độ dự trữ giảm", "Trung bình", "Theo dõi EVA hằng tuần thay vì mỗi 4 tuần"],
        ["Rủi ro nghiệp vụ", "Thủ thư tham gia UAT ít thời gian hơn", "Thấp", "Lên lịch UAT sớm, dùng kịch bản chuẩn"],
    ])
    return f"""# PHẦN II: ƯỚC LƯỢNG, PHÂN TÍCH TÀI CHÍNH VÀ LẬP LỊCH TIẾN ĐỘ (LAB 2)

## 2.1. Nhiệm vụ 1: Phân tích tài chính

### 2.1.1. Giả định và luồng tiền

{ass}**Bảng 2.1.** Giả định tài chính (đều là giả định, có thể thay ở sheet GiaDinh của Excel).

{ben}**Bảng 2.2.** Lợi ích hằng năm khi áp dụng đầy đủ.

Dòng tiền 3 năm (đơn vị: đồng). Lợi ích năm t = tổng lợi ích đầy đủ x mức áp dụng; chi phí các năm 1 đến 3 là chi phí vận hành; dòng tiền ròng = lợi ích − chi phí.

{tbl(["Năm", "Lợi ích", "Chi phí", "Dòng tiền ròng", "Hệ số chiết khấu 1/(1+r)^t", "Giá trị hiện tại", "Luỹ kế (không chiết khấu)"], cash, font=9.5)}**Bảng 2.3.** Dòng tiền dự án trong 3 năm.

### 2.1.2. Các chỉ số tài chính và công thức

**Giá trị hiện tại ròng (NPV).** NPV = Σ CF_t / (1 + r)^t, t = 0..3, r = 10%.

NPV = {npv_terms}

NPV = {pv_sum} = **{fmt_vnd(f['npv'])} đồng**.

**Tỷ suất hoàn vốn đầu tư (ROI).** ROI = (Σ dòng tiền ròng năm 1..3 − vốn đầu tư) / vốn đầu tư = ({fmt_vnd(sum(f['nets']))} − {fmt_vnd(f['invest'])}) / {fmt_vnd(f['invest'])} = **{pct(f['roi'], 1)}**.

**Thời gian hoàn vốn (Payback Period, không chiết khấu).** Luỹ kế cuối năm 0 là {fmt_vnd(-f['invest'])}, cuối năm 1 là {fmt_vnd(-f['invest'] + f['nets'][0])} (đã dương). Hoàn vốn xảy ra trong năm 1: Payback = 0 + {fmt_vnd(f['invest'])} / {fmt_vnd(f['nets'][0])} = **{num(f['payback'])} năm** (khoảng {round(f['payback'] * 12)} tháng).

{fig("cashflow.png", "Hình 2.1. Dòng tiền ròng và luỹ kế trong 3 năm")}
### 2.1.3. Phương án 5 năm và độ nhạy

Nếu kéo dài đến 5 năm (năm 4 và 5 áp dụng đầy đủ): NPV = **{fmt_vnd(F5['npv'])} đồng**, ROI = **{pct(F5['roi'], 0)}**, hoàn vốn vẫn khoảng {num(F5['payback'])} năm.

{tbl(["Năm", "Lợi ích", "Chi phí", "Dòng tiền ròng", "Hệ số chiết khấu", "Giá trị hiện tại", "Luỹ kế"], cash5, font=9.5)}**Bảng 2.4.** Dòng tiền phương án 5 năm.

{tbl(["Lợi ích so với kế hoạch", "r = 8%", "r = 10%", "r = 12%", "r = 15%"], sens)}**Bảng 2.5.** Độ nhạy: NPV 3 năm (đồng) theo mức lợi ích và tỉ lệ chiết khấu.

### 2.1.4. Kết luận về tính khả thi tài chính

Dự án **khả thi về tài chính**: NPV dương lớn ({mil(f['npv'])}), ROI {pct(f['roi'], 0)}, hoàn vốn khoảng {round(f['payback'] * 12)} tháng. NPV vẫn dương khi lợi ích chỉ đạt khoảng {pct(hi, 0)} so với kế hoạch (điểm hoà vốn), và chỉ âm khi lợi ích chỉ còn 30% và chiết khấu 12% trở lên. Rủi ro chính là lợi ích không xảy ra vì thủ thư không dùng hệ thống (R8), nên đào tạo và chạy song song với sổ tay là điều kiện để tạo giá trị. Các con số dựa vào giả định chưa kiểm chứng ở một thư viện thật.

## 2.2. Nhiệm vụ 2: Ước lượng và mối quan hệ phụ thuộc

### 2.2.1. Danh sách công việc, thời gian và chi phí

Danh sách lấy từ WBS ở mục 1.5 (20 gói công việc, trong đó 19 nằm trong sơ đồ mạng). Thời gian (tuần) ước lượng theo giờ công của vai trò đảm nhiệm chia cho năng lực {m.CAPACITY_PER_PERSON} giờ mỗi người mỗi tuần, làm tròn để mỗi vai trò không quá khoảng 110% năng lực; chi phí = giờ kỳ vọng PERT x 50.000 đồng.

{tbl(["Mã WBS", "Mã mạng", "Gói công việc", "Thời gian (tuần)", "Giờ", "Chi phí (đồng)", "Phụ thuộc (tiền nhiệm)"], wp_rows, font=9.5)}**Bảng 2.6.** Danh sách công việc, ước lượng thời gian, chi phí và phụ thuộc.

### 2.2.2. Bốn loại quan hệ phụ thuộc và độ trễ

{rel}**Bảng 2.7.** Các loại quan hệ phụ thuộc và ví dụ trong dự án.

Trong dự án có {sum(1 for a in m.ACTIVITIES for p in a.preds if p[1] == "FS")} quan hệ FS, {sum(1 for a in m.ACTIVITIES for p in a.preds if p[1] == "SS")} quan hệ SS có độ trễ, 1 quan hệ FF và 1 quan hệ SF; phương án nén ở mục 2.4 thêm các quan hệ có lead.

## 2.3. Nhiệm vụ 3: Sơ đồ mạng và đường găng

### 2.3.1. Sơ đồ mạng (AON)

{LAND}

{fig("network.png", "Hình 2.2. Sơ đồ mạng AON với ES, EF, LS, LF, Slack (đỏ: đường găng)")}
{PORT}

### 2.3.2. Tính truyền tiến và truyền lùi

**Công thức.** Truyền tiến: ES(việc sau) = max theo mọi tiền nhiệm của: FS: EF(trước) + lag; SS: ES(trước) + lag; FF: EF(trước) + lag − d; SF: ES(trước) + lag − d; EF = ES + d. Truyền lùi: LF(việc trước) = min theo mọi hậu nhiệm của: FS: LS(sau) − lag; SS: LS(sau) − lag + d; FF: LF(sau) − lag; SF: LF(sau) − lag + d; LS = LF − d; Slack = LS − ES. Việc cuối có LF bằng thời gian dự án (EF lớn nhất = {qc.n(m.PROJECT_WEEKS)}). Đơn vị: tuần, mốc đếm từ đầu tuần 1 (mốc 0).

{LAND}

{cpm_tab}**Bảng 2.8.** Các bước tính ES, EF, LF, LS, Slack cho từng gói công việc (có thế số).

{PORT}

{tbl(["Mã", "Gói công việc", "d", "ES", "EF", "LS", "LF", "Slack", "Găng?"], cpm_rows, font=9.5)}**Bảng 2.9.** Tổng hợp kết quả CPM.

### 2.3.3. Đường găng và độ dự trữ

Thời gian hoàn thành dự án là **{qc.n(m.PROJECT_WEEKS)} tuần**. Có {len(m.CRITICAL_PATH)} trên {len(m.ACTIVITIES)} gói là găng (Slack = 0) và {len(m.critical_paths())} đường găng song song:

{paths}

Các gói có độ dự trữ: {non_crit}. Dự trữ này cho phép dịch chuyển công việc khi một vai trò quá tải mà không làm trễ dự án. Do mạng "chặt" (nhiều đường găng), mọi trễ trên các gói găng đều đẩy ngày kết thúc, nên EVA ở mục 3.2 phải theo dõi sát.

### 2.3.4. Biểu đồ Gantt

{LAND}

{fig("gantt.png", "Hình 2.3. Biểu đồ Gantt của dự án (đỏ: găng; xanh: có dự trữ)")}
{PORT}

*Nguồn hình:* biểu đồ Gantt và sơ đồ mạng trong báo cáo được **vẽ bằng chương trình Python (matplotlib) trực tiếp từ dữ liệu CPM**, không phải ảnh chụp từ MS Project, để bảo đảm khớp tuyệt đối với bảng tính. Cùng dữ liệu đó có ở sheet CPM và Gantt của file Excel kèm theo (Gantt có công thức và tô màu có điều kiện) và có thể nhập vào MS Project hoặc GanttProject nếu giảng viên cần bản trên công cụ chuyên dụng.

## 2.4. Nhiệm vụ 4: Tối ưu và nén tiến độ

### 2.4.1. Yêu cầu và hướng tiếp cận

Khách hàng yêu cầu rút ngắn **20%** tổng thời gian: từ {qc.n(m.PROJECT_WEEKS)} tuần xuống không quá **{qc.n(PLAN['target'])} tuần**. Hai kỹ thuật: **Crashing** (rút ngắn thời gian bằng cách thêm nhân lực hoặc làm thêm giờ, tăng chi phí) và **Fast-tracking** (làm song song các việc tuần tự, tăng rủi ro làm lại). Chỉ nén được các hoạt động găng; khi có nhiều đường găng song song, phải nén đồng thời trên mọi đường.

### 2.4.2. Phân tích chi phí nén

Chi phí nén một tuần của hoạt động = chi phí trung bình mỗi tuần x phụ phí nén (làm thêm giờ, thêm người). Mỗi hoạt động nén tối đa 30% thời lượng, theo bước 0,5 tuần.

{tbl(["Gói công việc găng", "Chi phí mỗi tuần (đồng)", "Phụ phí nén", "Chi phí nén 1 tuần (đồng)", "Nén tối đa (tuần)"], slope_rows)}**Bảng 2.10.** Hệ số nén của các gói găng.

### 2.4.3. Ba phương án và kết quả

{tbl(["Phương án", "Thời gian (tuần)", "Rút ngắn", "Chi phí tăng thêm (đồng)", "Đạt mục tiêu 20%?"], opt_rows)}**Bảng 2.11.** So sánh ba phương án nén.

{fig("compress_options.png", "Hình 2.4. So sánh thời gian và chi phí của ba phương án nén")}
**Phương án A (chỉ crashing)** chỉ xuống được {qc.n(round(A['end'], 2))} tuần dù đã nén hết giới hạn, vì có {len(m.critical_paths())} đường găng song song và mỗi hoạt động chỉ nén được tối đa 30%. **Phương án B (chỉ fast-tracking)** xuống {qc.n(round(B['end'], 2))} tuần (giảm {pct(1 - B['end'] / m.PROJECT_WEEKS)}), gần nhưng chưa đủ. **Phương án C (kết hợp)** đạt {qc.n(round(C['end'], 2))} tuần (giảm {pct(1 - C['end'] / m.PROJECT_WEEKS)}) với chi phí tăng thêm thấp nhất trong các phương án đạt mục tiêu, nên được khuyến nghị.

### 2.4.4. Phương án khuyến nghị: Fast-tracking rồi Crashing

**Bước 1: Fast-tracking** (4 thay đổi quan hệ phụ thuộc, từ {qc.n(m.PROJECT_WEEKS)} xuống {qc.n(round(B['end'], 2))} tuần):

{tbl(["Mã", "Thay đổi", "Giờ làm lại dự phòng", "Chi phí (đồng)"], ft_rows)}**Bảng 2.12.** Các thay đổi fast-tracking và dự phòng làm lại.

**Bước 2: Crashing** (thuật toán chọn mỗi lần tổ hợp hoạt động găng làm giảm thời gian dự án với chi phí trên mỗi tuần thấp nhất):

{tbl(["Bước", "Hoạt động nén", "Nén (tuần)", "Chi phí (đồng)", "Thời gian dự án (tuần)"], steps_rows)}**Bảng 2.13.** Các bước crashing.

Tổng chi phí tăng thêm = {fmt_vnd(sum(h for *_, h in q.FAST_TRACK) * m.RATE)} (làm lại) + {fmt_vnd(sum(s.cost for s in C['steps']))} (crashing) = **{fmt_vnd(C['cost'])} đồng** ({pct(C['cost'] / BAC)} BAC, {pct(C['cost'] / RESERVE, 0)} dự phòng quản lý).

{LAND}

{tbl(["Mã", "Gói công việc", "d mới", "Phụ thuộc mới", "ES", "EF", "LS", "LF", "Slack", "Găng?"], comp_rows, font=9.5)}**Bảng 2.14.** CPM sau nén: dự án còn {qc.n(round(comp_end, 2))} tuần.

{fig("compress_gantt.png", "Hình 2.5. Gantt trước nén (xám) và sau nén (đỏ, xanh)")}
{PORT}

### 2.4.5. Đánh giá rủi ro đi kèm

{risk_comp}**Bảng 2.15.** Rủi ro của phương án nén tiến độ.

**Khuyến nghị.** Chỉ nên nén khi khách hàng chấp nhận chi phí tăng thêm {mil(C['cost'])} và rủi ro làm lại; nếu không, giữ lịch 16 tuần. Nếu nén, cần: đóng băng hợp đồng API từ tuần 3, dựng dịch vụ giả (mock) cho AI để tích hợp sớm, không nén kiểm thử và UAT, và chuyển sang theo dõi EVA hằng tuần.

"""


def preds_txt_from(a: m.Activity) -> str:
    if not a.preds:
        return "Không"
    return ", ".join(f"{q.WP_CODE[pc]} ({kind}{lag_txt(lag)})" for pc, kind, lag in a.preds)


# ----------------------------------------------------------------------------- PHẦN III
def part3() -> str:
    groups = ["Con người", "Tiến trình", "Sản phẩm", "Công nghệ"]
    reg = []
    for r in m.RISKS:
        reg.append([r.rid, r.name, r.group, r.p, r.i, r.score, r.level, f"{int(m.PROB[r.p] * 100)}%", fmt_vnd(r.cost_if * m.PROB[r.p])])
    plan_rows = []
    for r in m.RISKS:
        plan_rows.append([r.rid, r.response, qc.CONTINGENCY[r.rid], r.trigger, r.owner])
    grp_rows = []
    for g in groups:
        rs = [r for r in m.RISKS if r.group == g]
        grp_rows.append([g, len(rs), ", ".join(r.rid for r in rs), max(r.score for r in rs), fmt_vnd(sum(r.cost_if * m.PROB[r.p] for r in rs))])
    emv = m.risk_emv_total()
    # EVA
    eva_rows = []
    for r in ROWS8:
        cv = r["ev"] - r["ac"]
        sv = r["ev"] - r["pv"]
        spi = r["ev"] / r["pv"] if r["pv"] else None
        cpi = r["ev"] / r["ac"] if r["ac"] else None
        eva_rows.append([r["wbs"], r["name"], fmt_vnd(r["bac"]), fmt_vnd(r["pv"]), fmt_vnd(r["ev"]), fmt_vnd(r["ac"]), fmt_vnd(sv), fmt_vnd(cv),
                         num(spi, 3) if spi is not None else "-", num(cpi, 3) if cpi is not None else "-", pct(r["ev"] / r["bac"], 0)])
    tot_pv = sum(r["pv"] for r in ROWS8)
    tot_ev = sum(r["ev"] for r in ROWS8)
    tot_ac = sum(r["ac"] for r in ROWS8)
    eva_rows.append(["", "**TỔNG DỰ ÁN**", f"**{fmt_vnd(BAC)}**", f"**{fmt_vnd(tot_pv)}**", f"**{fmt_vnd(tot_ev)}**", f"**{fmt_vnd(tot_ac)}**",
                     f"**{fmt_vnd(tot_ev - tot_pv)}**", f"**{fmt_vnd(tot_ev - tot_ac)}**", f"**{num(tot_ev / tot_pv, 3)}**", f"**{num(tot_ev / tot_ac, 3)}**", f"**{pct(tot_ev / BAC, 0)}**"])
    idx = tbl(["Chỉ số", "Công thức", "Thế số", "Kết quả"], [
        ["PV", "Σ giờ kế hoạch từng tuần x 50.000", "Tuần 1 đến 8", fmt_vnd(P8.pv) + " đồng"],
        ["EV", "Σ giờ kế hoạch x hiệu suất tiến độ của tuần x 50.000", "Tuần 1 đến 8", fmt_vnd(P8.ev) + " đồng"],
        ["AC", "Σ EV tuần x hệ số chi phí của tuần", "Tuần 1 đến 8", fmt_vnd(P8.ac) + " đồng"],
        ["SV", "EV − PV", f"{fmt_vnd(P8.ev)} − {fmt_vnd(P8.pv)}", fmt_vnd(P8.sv) + " đồng"],
        ["CV", "EV − AC", f"{fmt_vnd(P8.ev)} − {fmt_vnd(P8.ac)}", fmt_vnd(P8.cv) + " đồng"],
        ["SPI", "EV / PV", f"{fmt_vnd(P8.ev)} / {fmt_vnd(P8.pv)}", num(P8.spi, 3)],
        ["CPI", "EV / AC", f"{fmt_vnd(P8.ev)} / {fmt_vnd(P8.ac)}", num(P8.cpi, 3)],
        ["EAC (xu hướng chi phí giữ nguyên)", "BAC / CPI", f"{fmt_vnd(BAC)} / {num(P8.cpi, 3)}", fmt_vnd(P8.eac) + " đồng"],
        ["EAC' (cả tiến độ và chi phí)", "AC + (BAC − EV) / (CPI x SPI)", f"{fmt_vnd(P8.ac)} + ({fmt_vnd(BAC)} − {fmt_vnd(P8.ev)}) / ({num(P8.cpi, 3)} x {num(P8.spi, 3)})", fmt_vnd(P8.eac2) + " đồng"],
        ["ETC", "EAC − AC", f"{fmt_vnd(P8.eac)} − {fmt_vnd(P8.ac)}", fmt_vnd(P8.etc) + " đồng"],
        ["VAC", "BAC − EAC", f"{fmt_vnd(BAC)} − {fmt_vnd(P8.eac)}", fmt_vnd(P8.vac) + " đồng"],
        ["TCPI", "(BAC − EV) / (BAC − AC)", f"({fmt_vnd(BAC)} − {fmt_vnd(P8.ev)}) / ({fmt_vnd(BAC)} − {fmt_vnd(P8.ac)})", num(P8.tcpi, 3)],
    ])
    bl_scope = tbl(["Mã WBS", "Gói công việc", "Mã mạng", "Vai trò chính"], [[q.WP_CODE[c], q.wp_name(c), c if c != "LOE" else "duy trì", q.act_owner_roles(c)] for c in [a.code for a in m.ACTIVITIES] + ["LOE"]], font=10.5)
    bl_sched = tbl(["Mốc", "Tuần", "Nội dung", "Sản phẩm kiểm tra"], [
        ["M1", 2, "Tôn chỉ, SOW được duyệt", "Biên bản duyệt"], ["M2", 3, "SRS và 20 User Story được duyệt", "SRS v1.0"],
        ["M3", 5, "Thiết kế được duyệt", "ERD, kiến trúc, API, giao diện"], ["M4", 9, "Backend và Frontend lõi chạy đầu-cuối", "Demo mượn trả"],
        ["M5", 12, "AI đạt ngưỡng chỉ số", "Báo cáo chỉ số mô hình"], ["M6", 14, "Tích hợp xong, vào kiểm thử hệ thống", "Bản dựng ổn định"],
        ["M7", 15, "Qua UAT, triển khai cloud", "Biên bản UAT, địa chỉ trực tuyến"], ["M8", 16, "Nghiệm thu, bàn giao", "Biên bản nghiệm thu"],
    ])
    hours_by_phase = {}
    for pcode, pname, groups_ in q.LAB_WBS:
        h = sum(q.act_hours(a) for _, _, acts in groups_ for a in acts)
        hours_by_phase[pcode] = (pname, h)
    bl_cost = tbl(["Pha", "Giờ", "Chi phí (đồng)", "Tỉ lệ BAC"], [[f"{k}. {v[0]}", fmt_h(v[1]), fmt_vnd(v[1] * m.RATE), pct(v[1] / BAC_H)] for k, v in hours_by_phase.items()] + [["**Tổng (BAC)**", f"**{fmt_h(BAC_H)}**", f"**{fmt_vnd(BAC)}**", "**100,0%**"], ["Dự phòng quản lý 10%", "", fmt_vnd(RESERVE), ""], ["**Ngân sách đề xuất**", "", f"**{fmt_vnd(BAC + RESERVE)}**", ""]])
    cr_proc = tbl(["Bước", "Nội dung", "Người thực hiện", "Thời hạn", "Đầu ra"], [
        ["1. Đề xuất", "Lập phiếu Change Request: mô tả, lý do, mức ưu tiên, người đề xuất", "Bất kỳ ai", "Khi phát sinh", "Phiếu CR có mã"],
        ["2. Đánh giá tác động", "Ước lượng giờ, chi phí, ảnh hưởng đường găng, rủi ro, chất lượng; phương án thay thế", "Quản lý dự án, vai trò liên quan", "1 ngày làm việc", "Bản đánh giá tác động"],
        ["3. Phê duyệt", "Dưới 8 giờ và không ảnh hưởng đường găng: Quản lý dự án duyệt; từ 8 giờ hoặc ảnh hưởng đường găng: khách hàng (Product Owner) duyệt; vượt dự phòng: báo giảng viên hướng dẫn", "Người có thẩm quyền", "2 ngày làm việc", "Quyết định duyệt, từ chối hoặc hoãn"],
        ["4. Thực hiện và cập nhật", "Cập nhật đường cơ sở (WBS, lịch, chi phí), sổ rủi ro; giao việc; thông báo cả nhóm", "Quản lý dự án", "Theo kế hoạch của CR", "Đường cơ sở phiên bản mới"],
        ["5. Xác minh và đóng", "Kiểm tra kết quả theo tiêu chí của CR; ghi giờ thực tế; cập nhật dự phòng; đóng phiếu", "QA, Quản lý dự án", "Khi hoàn tất", "Phiếu CR đã đóng, nhật ký thay đổi"],
    ])
    cr_form = kv([
        ("Mã, tên", "CR-01: Tính phạt trả trễ theo số ngày lịch theo múi giờ thư viện"),
        ("Người đề xuất, ngày", "QA, tuần 11"),
        ("Mô tả", "Quy tắc phạt hiện tính theo mỗi 24 giờ nên mượn lúc 23:59 và trả 00:01 hôm sau bị tính sai."),
        ("Lý do", "Phát hiện khi chạy thật luồng trả sách quá hạn; ảnh hưởng tiền phạt của bạn đọc (rủi ro R10)."),
        ("Tác động phạm vi, lịch, chi phí", "Sửa Backend tính phạt và thêm bài test biên; khoảng 6 giờ; không ảnh hưởng đường găng; chi phí khoảng 300.000 đồng."),
        ("Quyết định", "Quản lý dự án duyệt (dưới 8 giờ), làm ngay."),
        ("Nguồn kinh phí", "Nằm trong mức vượt chi phí của EVA (không lấy thêm từ ngoài)."),
        ("Kết quả xác minh", "Đã sửa; có test biên; luồng thật cho kết quả đúng."),
    ], head=("Trường", "Nội dung"))
    cr_log = tbl(["Mã", "Nội dung", "Giờ", "Quyết định", "Nguồn kinh phí"], [
        ["CR-01", "Tính phạt theo ngày lịch (R10)", 6, "Quản lý dự án duyệt", "Nằm trong mức vượt của EVA (đã tính vào AC)"],
        ["CR-02", "Trang quản trị đầy đủ (kho sách, tài khoản, phiếu mượn, khoản phạt, theo dõi mô hình)", 30, "Khách hàng duyệt", "Ngân sách thay đổi riêng, ghi vào đường cơ sở 1.1, không trừ dự phòng"],
        ["CR-03", "Đổi nguồn dữ liệu chính sang goodbooks-10k, Google Books chỉ bổ sung khi có khoá (R2)", 8, "Quản lý dự án duyệt, báo khách hàng", "Nằm trong mức vượt của EVA (đã tính vào AC)"],
    ])
    test_plan = kv([
        ("Mục tiêu", "Xác nhận ULS đáp ứng yêu cầu trong SRS, quy tắc BR-01 đến BR-08 và các yêu cầu phi chức năng đo được; tìm lỗi sớm và chặn lỗi tái diễn."),
        ("Phạm vi kiểm thử", "Trong: xác thực và phân quyền, quản lý sách, mượn trả và phạt, tìm kiếm, báo cáo, gợi ý và dự báo, giao diện, triển khai bằng docker compose. Ngoài: kiểm thử tải lớn, kiểm thử bảo mật xâm nhập chuyên sâu, thiết bị di động thật."),
        ("Chiến lược", "Tháp kiểm thử: nhiều test đơn vị, ít hơn test tích hợp trên cơ sở dữ liệu thật, ít nhất là test hệ thống và UAT; tự động hoá trên CI; chạy thật luồng liên quan tiền, quyền và dữ liệu."),
        ("Loại kiểm thử", "Đơn vị (Jest, pytest); tích hợp, e2e (Jest, Supertest, PostgreSQL thật); hệ thống (script smoke qua gateway, docker compose trên máy sạch); chấp nhận UAT theo kịch bản; phi chức năng (hiệu năng, bảo mật, khả năng truy cập)."),
        ("Môi trường", "Cục bộ bằng docker compose; CI trên GitHub Actions; môi trường thật trên Vercel, Render, Neon."),
        ("Tiêu chí vào", "Mã đã gộp vào nhánh làm việc, build thành công, môi trường kiểm thử sẵn sàng, dữ liệu mẫu đã nạp."),
        ("Tiêu chí ra", "Coverage dòng từ 80% trên lớp nghiệp vụ; mọi test tự động đạt; không còn lỗi Nghiêm trọng hoặc Cao đang mở; UAT đạt 100% kịch bản; chỉ số mô hình đạt ngưỡng."),
        ("Nguồn lực", "QA chịu trách nhiệm chính (kế hoạch, ca kiểm thử, UAT), lập trình viên viết test đơn vị cùng với mã; khách hàng tham gia UAT."),
        ("Lịch", "Kế hoạch kiểm thử (5.1) song song với phát triển từ tuần 6; kiểm thử đơn vị và tích hợp tuần 6 đến 10; kiểm thử hệ thống và UAT tuần 13 đến 14 (xem Gantt)."),
        ("Quản lý lỗi", "Ghi trên GitHub Issues theo vòng đời ở mục 3.4.3; báo cáo kiểm thử cuối mỗi sprint."),
        ("Kết quả đạt được", "160 test tự động đạt 100% (119 đơn vị Backend, 15 e2e, 26 AI); coverage Backend 98,75% dòng, 97,51% câu lệnh, 98,49% hàm, 81,9% nhánh; AI 93,6%; CI xanh trên mọi Pull Request."),
    ], head=("Hạng mục", "Nội dung"))
    scripts = ""
    for k, ts in enumerate(qc.TEST_SCRIPTS, start=1):
        scripts += f"### 3.4.2.{k}. {ts['id']}: {ts['name']}\n\n"
        scripts += kv([("Mục tiêu", ts["muc_tieu"]), ("Tiền điều kiện", ts["tien_dieu_kien"]), ("Dữ liệu kiểm thử", ts["du_lieu"])], head=("Thuộc tính", "Nội dung"))
        scripts += "\n" + tbl(["Bước", "Hành động", "Kết quả mong đợi", "Kết quả thực tế", "Đạt/Không"], [[b[0], b[1], b[2], "(điền khi thực thi)", ""] for b in ts["buoc"]], font=10)
        scripts += f"**Bảng 3.{12 + k}.** Kịch bản kiểm thử {ts['id']}. **Tiêu chí đạt:** {ts['tieu_chi']} **Liên hệ thực tế:** {ts['lien_he']}\n\n"
    sev = tbl(["Mức độ", "Định nghĩa", "Ví dụ", "Thời hạn xử lý"], [
        ["Nghiêm trọng", "Sai tiền, lộ hoặc mất dữ liệu, hệ thống không chạy", "Phạt tính sai; mật khẩu lộ trong phản hồi", "Trong ngày"],
        ["Cao", "Một luồng chính hỏng, không có cách đi vòng", "Không mượn được sách", "Trong sprint"],
        ["Trung bình", "Chức năng phụ sai hoặc có cách đi vòng", "Lọc thể loại sai", "Trong 2 sprint"],
        ["Thấp", "Giao diện, câu chữ", "Sai chính tả", "Khi tiện"],
    ])
    success = tbl(["Trụ cột, tiêu chí", "Chỉ tiêu nghiệm thu", "Cách đo"], [
        ["Phạm vi", "100% User Story trong phạm vi đạt tiêu chí chấp nhận; 0 lỗi Nghiêm trọng và Cao đang mở", "Danh sách kiểm tra User Story, báo cáo lỗi"],
        ["Tiến độ", "Hoàn thành trong 16 tuần; mỗi mốc M1 đến M8 trễ không quá 1 tuần", "Gantt, SPI từ 0,95 ở mốc cuối"],
        ["Chi phí", "Chi phí thực tế không vượt BAC cộng dự phòng; CPI từ 0,90 ở mốc cuối", "Báo cáo EVA"],
        ["Chất lượng", "Coverage từ 80%; CI xanh; chỉ số mô hình đạt ngưỡng; hiệu năng đạt NFR", "CI, báo cáo kiểm thử"],
        ["Sự hài lòng của khách hàng", "UAT đạt 100% kịch bản; điểm hài lòng từ 4 trên 5; khách hàng ký nghiệm thu", "Biên bản UAT, phiếu khảo sát"],
        ["Lợi ích kinh doanh", "Từ 60% phiếu mượn nhập qua hệ thống sau 2 tuần chạy thật", "Số liệu hệ thống sau vận hành"],
        ["Chuyển giao", "Thủ thư được đào tạo; có tài liệu hướng dẫn và kịch bản vận hành", "Biên bản đào tạo, tài liệu"],
    ])
    return f"""# PHẦN III: QUẢN LÝ RỦI RO, THEO DÕI BẰNG EVA VÀ ĐẢM BẢO CHẤT LƯỢNG (LAB 3)

## 3.1. Nhiệm vụ 1: Quản lý rủi ro

### 3.1.1. Danh mục rủi ro (Risk Register)

Dự án nhận diện **{len(m.RISKS)} rủi ro** thuộc 4 nhóm Con người, Tiến trình, Sản phẩm, Công nghệ (đề yêu cầu từ 6 rủi ro). Xác suất P và mức ảnh hưởng I theo thang 1 đến 5; **Điểm = P x I**; xác suất rời rạc 1 = 10%, 2 = 30%, 3 = 50%, 4 = 70%, 5 = 90%; mức Cao từ 15, Trung bình từ 8 đến 14, Thấp dưới 8. Tổn thất nếu xảy ra tính bằng giờ công bổ sung x 50.000 đồng; EMV = xác suất x tổn thất.

{tbl(["Mã", "Rủi ro", "Nhóm", "P", "I", "Điểm", "Mức", "Xác suất", "EMV (đồng)"], reg, font=10)}**Bảng 3.1.** Danh mục rủi ro.

{tbl(["Nhóm", "Số rủi ro", "Rủi ro", "Điểm cao nhất", "EMV nhóm (đồng)"], grp_rows)}**Bảng 3.2.** Tổng hợp theo nhóm. Tổng EMV là **{fmt_vnd(emv)} đồng**, bằng {pct(emv / RESERVE, 0)} dự phòng quản lý.

### 3.1.2. Ma trận rủi ro

{fig("risk_matrix.png", "Hình 3.1. Ma trận rủi ro 5x5 (P theo trục dọc, I theo trục ngang)")}
Có 2 rủi ro mức Cao: **R1** (điểm {m.RISKS[0].score}) và **R5** (điểm {m.RISKS[4].score}). Các rủi ro nhóm Công nghệ và Tiến trình chiếm phần lớn điểm cao vì dự án phụ thuộc hạ tầng miễn phí và nhóm nhỏ làm nhiều việc.

### 3.1.3. Kế hoạch ứng phó

**Mitigation** là hành động phòng ngừa làm giảm xác suất hoặc tác động; **Contingency** là hành động thực hiện khi rủi ro đã xảy ra.

{LAND}

{tbl(["Mã", "Mitigation (phòng ngừa)", "Contingency (khi xảy ra)", "Dấu hiệu kích hoạt", "Chủ sở hữu"], plan_rows, font=8.5)}**Bảng 3.3.** Kế hoạch ứng phó rủi ro.

{PORT}

**Rủi ro đã xảy ra trong dự án thật:** R1 (dịch vụ trên Render ngủ, backend tự rơi về danh sách sách mượn nhiều nên người dùng không thấy lỗi), R2 (Google Books giới hạn tần suất nên dùng goodbooks-10k làm nguồn chính), R10 (phát hiện phạt tính theo giờ khi chạy thật luồng trả sách, đã sửa).

## 3.2. Nhiệm vụ 2: Phân tích giá trị thu được (EVA)

### 3.2.1. Bài toán và giả định

Mốc báo cáo m = **50% tiến độ dự án**, tức hết tuần 8 trong 16 tuần. Tại mốc này giá trị kế hoạch đã là {pct(tot_pv / BAC, 1)} BAC. Số liệu EVA là **mô phỏng có kiểm soát**: giờ kế hoạch từng tuần lấy từ lịch ở mục 2.3; EV = giờ kế hoạch x hiệu suất tiến độ của tuần (tuần 1 đến 4: 0,96; tuần 5 đến 8: 0,80 vì nhập dữ liệu Google Books bị giới hạn tần suất và phải dựng lại phần seed); AC = EV x hệ số chi phí (tuần 1 đến 4: 1,04; tuần 5 đến 8: 1,12). Giờ công thật ghi nhận của nhóm (khoảng 63 giờ) không cùng quy mô với dự án mô phỏng nên không dùng làm AC. Tên công việc ở bảng dưới khớp với WBS (mục 1.5) và sơ đồ mạng (mục 2.3).

### 3.2.2. Bảng EVA theo từng công việc

{LAND}

{tbl(["Mã WBS", "Gói công việc", "BAC", "PV", "EV", "AC", "SV", "CV", "SPI", "CPI", "% xong"], eva_rows, font=8.5)}**Bảng 3.4.** PV, EV, AC, SV, CV, SPI, CPI của từng công việc tại mốc 50% tiến độ (đồng).

{PORT}

{fig("eva_wp.png", "Hình 3.2. PV, EV, AC của từng công việc tại mốc 50% tiến độ")}

Các gói đã kết thúc theo kế hoạch trước tuần 8 ({", ".join(q.WP_CODE[a.code] for a in m.ACTIVITIES if m.CPM[a.code].ef <= 8)}) có EV bằng khoảng 96% đến 99% PV do hiệu suất tuần đầu thấp hơn kế hoạch; các gói đang chạy ở tuần 5 đến 8 ({q.WP_CODE["H"]}, {q.WP_CODE["I"]}, {q.WP_CODE["J"]}, {q.WP_CODE["N"]}...) chậm rõ hơn vì hiệu suất tuần này chỉ 0,80.

### 3.2.3. Các chỉ số và dự báo (có công thức và thế số)

{idx}**Bảng 3.5.** Chỉ số EVA cấp dự án tại mốc 50% tiến độ. BAC = {fmt_vnd(BAC)} đồng.

### 3.2.4. Đánh giá trạng thái dự án

- **Tiến độ: chậm.** SV = {fmt_vnd(P8.sv)} đồng (âm) và SPI = {num(P8.spi, 3)} (< 1): sau 8 tuần mới làm được {pct(P8.ev / P8.pv, 1)} khối lượng kế hoạch, tức chậm khoảng {num((1 - P8.spi) * 8, 1)} tuần tương đương. Mức: {band(P8.spi)}.
- **Chi phí: vượt ngân sách.** CV = {fmt_vnd(P8.cv)} đồng (âm) và CPI = {num(P8.cpi, 3)} (< 1): mỗi đồng chi ra chỉ tạo {num(P8.cpi, 2)} đồng giá trị. Mức: {band(P8.cpi)}.
- **Dự báo.** Nếu xu hướng chi phí giữ nguyên, EAC = {fmt_vnd(P8.eac)} đồng, vượt BAC {fmt_vnd(-P8.vac)} đồng ({pct(-P8.vac / BAC, 1)}), vẫn nằm trong dự phòng quản lý {fmt_vnd(RESERVE)} đồng. Nếu cả chậm tiến độ cũng kéo dài, EAC' = {fmt_vnd(P8.eac2)} đồng, vượt dự phòng. TCPI = {num(P8.tcpi, 3)} nghĩa là phần còn lại phải làm hiệu quả hơn kế hoạch khoảng {pct(P8.tcpi - 1, 0)} mới giữ được BAC; điều khó đạt nên chấp nhận dùng dự phòng.
- **Hành động khắc phục:** chạy song song Frontend với Backend, làm thêm giờ có kiểm soát ở tuần 9 đến 12, hoãn nhập ISBN từ Google Books, không nhận thêm tính năng ngoài MVP. Kết quả mô phỏng: dự án hoàn thành đúng hạn ở tuần 16 với chi phí thực tế {mil(pts[16].ac)} (vượt BAC {pct(-pts[16].vac / BAC, 1)}, dùng {pct(-pts[16].vac / RESERVE, 0)} dự phòng).

{fig("eva_curves.png", "Hình 3.3. Đường cong PV, EV, AC của cả dự án (mốc 50% là tuần 8)")}
## 3.3. Nhiệm vụ 3: Quản lý thay đổi và cấu hình

### 3.3.1. Đường cơ sở (Baseline)

Đường cơ sở phiên bản 1.0 được chốt sau khi khách hàng duyệt SOW và lịch (mốc M1, tuần 2); mọi thay đổi sau đó qua Change Request. Gồm ba đường cơ sở:

**Đường cơ sở phạm vi** = WBS cấp 3 kèm từ điển WBS (bảng 1.9 đến 1.11) và tiêu chí chấp nhận ở bảng 1.6:

{bl_scope}**Bảng 3.6.** Đường cơ sở phạm vi (danh sách gói công việc).

**Đường cơ sở lịch** = lịch CPM ở bảng 2.9 và các mốc:

{bl_sched}**Bảng 3.7.** Đường cơ sở lịch: các mốc quan trọng.

**Đường cơ sở chi phí** = BAC theo pha, và PV tích luỹ theo tuần (bảng 8 trong Excel, sheet Baseline):

{bl_cost}**Bảng 3.8.** Đường cơ sở chi phí theo pha.

### 3.3.2. Quy trình 5 bước kiểm soát yêu cầu thay đổi

{cr_proc}**Bảng 3.9.** Quy trình 5 bước kiểm soát thay đổi (Change Request Process).

Ví dụ một phiếu thay đổi đã xử lý:

{cr_form}**Bảng 3.10.** Phiếu Change Request mẫu (CR-01).

{cr_log}**Bảng 3.11.** Nhật ký thay đổi. Ghi chú: CR-01 và CR-03 (14 giờ, khoảng 700.000 đồng) nằm trong mức vượt chi phí của EVA nên không cộng thêm vào dự phòng; CR-02 (30 giờ, khoảng 1.500.000 đồng) được khách hàng cấp ngân sách riêng và ghi vào đường cơ sở phiên bản 1.1, nên EVA ở mục 3.2 đo trên đường cơ sở 1.0 để so sánh được.

### 3.3.3. Quản lý cấu hình

Mã nguồn quản lý trên Git, nhánh `main` được bảo vệ; mỗi công việc làm trên nhánh riêng, gộp qua Pull Request có rà soát và CI xanh; cấu hình bí mật chỉ nằm trong biến môi trường; tài liệu thiết kế (ERD, đặc tả API) sinh từ mã nguồn để không lệch; mỗi mốc phát hành gắn phiên bản. Đường cơ sở tài liệu (SRS, SDD) chỉ đổi qua Change Request.

## 3.4. Nhiệm vụ 4: Đảm bảo chất lượng và kết thúc dự án

### 3.4.1. Kế hoạch kiểm thử (Test Plan)

{test_plan}**Bảng 3.12.** Kế hoạch kiểm thử (Test Plan).

### 3.4.2. Các Test Script mẫu

Ba kịch bản dưới đây dành cho ba chức năng trọng yếu: mượn sách (nghiệp vụ lõi), trả sách và tính phạt (liên quan tiền), đăng nhập và phân quyền (bảo mật). Cột "Kết quả thực tế" để trống vì là mẫu dùng khi thực thi; các luồng tương đương đã có kiểm thử tự động đạt trên CI.

{scripts}### 3.4.3. Quy trình theo dõi sửa lỗi (Defect Life Cycle)

{fig("defect_lifecycle.png", "Hình 3.4. Vòng đời lỗi (Defect Life Cycle)")}
Mỗi lỗi là một Issue trên GitHub, đi qua các trạng thái: **Mới** (QA ghi lỗi kèm bước tái hiện, mức độ) → **Đã giao** (QA hoặc Quản lý dự án phân loại và giao) → **Đang sửa** (lập trình viên nhận) → **Đã sửa** (tạo Pull Request, gộp khi CI xanh) → **Kiểm thử lại** (QA chạy lại ca lỗi) → **Đóng** nếu đạt, hoặc **Mở lại** nếu không đạt rồi quay về Đang sửa. Các nhánh phụ: **Trùng**, **Từ chối** (không phải lỗi), **Hoãn** (có lý do và người duyệt). Nguyên tắc: lỗi Nghiêm trọng phải thêm bài test chặn tái diễn trước khi đóng.

{sev}**Bảng 3.16.** Mức độ lỗi và thời hạn xử lý.

### 3.4.4. Tiêu chí đánh giá mức độ thành công khi nghiệm thu

{success}**Bảng 3.17.** Tiêu chí đánh giá thành công của dự án khi nghiệm thu.

"""


# ----------------------------------------------------------------------------- PHẦN IV
def part4() -> str:
    p16 = pts[16]
    sa = tbl(["Trụ cột", "Chỉ tiêu", "Kết quả", "Đánh giá"], [
        ["Phạm vi (Scope)", "100% User Story trong phạm vi; 0 lỗi Nghiêm trọng và Cao mở", "20 trên 20 User Story hoàn thành; 160 test tự động đạt 100%; 48 API; 12 trang; bản chạy thật. Một hạng mục chưa kiểm với dữ liệu thật: nhập sách theo ISBN từ Google Books (bị giới hạn tần suất)", "Đạt, kèm 1 hạn chế đã ghi nhận"],
        ["Tiến độ (Time)", "Hoàn thành trong 16 tuần", f"Mô phỏng: hoàn thành đúng tuần 16 sau giai đoạn chậm ở tuần 8 (SPI {num(P8.spi, 2)}), SPI cuối {num(p16.spi, 2)}. Thật: phần mềm hoàn thành trong 8 tuần làm việc", "Đạt (nhờ làm thêm giờ và chạy song song)"],
        ["Chi phí (Cost)", "Không vượt BAC cộng dự phòng", f"Chi phí thực tế mô phỏng {fmt_vnd(p16.ac)} đồng, vượt BAC {fmt_vnd(-p16.vac)} đồng ({pct(-p16.vac / BAC, 1)}), dùng {pct(-p16.vac / RESERVE, 0)} dự phòng; CPI cuối {num(p16.cpi, 3)}", "Đạt có điều kiện: vượt BAC nhưng trong ngân sách đề xuất"],
        ["Chất lượng", "Coverage từ 80%; CI xanh; chỉ số mô hình", "Coverage Backend 98,75% dòng, AI 93,6%; CI xanh; Precision@5 = 0,309; ROC-AUC = 0,76", "Đạt"],
        ["Hài lòng của khách hàng", "UAT đạt 100% kịch bản; điểm từ 4 trên 5", "Chưa đo với thủ thư thật; mới có kịch bản UAT mẫu", "Chưa đánh giá được"],
        ["Lợi ích kinh doanh", "Từ 60% phiếu mượn qua hệ thống sau 2 tuần", "Chưa vận hành thật; NPV dương theo giả định", "Chưa đánh giá được"],
    ])
    return f"""# PHẦN IV: KẾT LUẬN VÀ TỰ ĐÁNH GIÁ

## 4.1. Tổng kết kết quả đạt được

Nhóm đã hoàn thành ba bài thực hành trên cùng một dự án xuyên suốt:

- **LAB 1:** Tôn chỉ dự án với 7 mục tiêu SMART, SOW và kế hoạch truyền thông, RACI 25 hạng mục; phân tích cấu trúc ma trận cân bằng và chọn góc nhìn Cấu trúc; WBS 4 cấp ({len(m.WORK_PACKAGES)} công việc chi tiết, 20 gói công việc) và từ điển WBS cho 3 gói găng.
- **LAB 2:** phân tích tài chính (NPV {mil(F3['npv'])}, ROI {pct(F3['roi'], 0)}, hoàn vốn khoảng {round(F3['payback'] * 12)} tháng); danh sách công việc với đủ bốn loại quan hệ phụ thuộc; sơ đồ mạng, tính xuôi ngược có thế số, {len(m.critical_paths())} đường găng, thời gian {qc.n(m.PROJECT_WEEKS)} tuần; phương án nén 20% bằng fast-tracking kết hợp crashing xuống {qc.n(round(PLAN['C']['end'], 2))} tuần với chi phí tăng {mil(PLAN['C']['cost'])}.
- **LAB 3:** {len(m.RISKS)} rủi ro thuộc 4 nhóm kèm Mitigation và Contingency; EVA tại mốc 50% theo từng công việc (SPI {num(P8.spi, 3)}, CPI {num(P8.cpi, 3)}, EAC {mil(P8.eac)}); đường cơ sở và quy trình 5 bước kiểm soát thay đổi; Test Plan, 3 Test Script, vòng đời lỗi và tiêu chí nghiệm thu.

## 4.2. Bài học kinh nghiệm về quản lý dự án

1. **Mạng chặt thì phải theo dõi sát.** Có {len(m.critical_paths())} đường găng song song, xác suất xong đúng 16 tuần theo PERT chỉ khoảng {pct(m.normal_cdf((16 - EXP) / SD), 0)}; nên theo dõi SPI hằng tuần thay vì mỗi 4 tuần, và đặt sẵn danh sách cắt giảm phạm vi.
2. **Phụ thuộc bên ngoài là điểm nghẽn.** Giới hạn tần suất của Google Books làm dự án chậm ở tuần 8; cần nguồn dữ liệu dự phòng ngay từ sprint đầu.
3. **Chạy thật luồng liên quan tiền, không chỉ test có mock.** Lỗi tính phạt theo giờ chỉ lộ khi chạy thật.
4. **Nhất quán dữ liệu giữa WBS, lịch và EVA** giúp mọi con số truy được về một gói công việc; dùng một mô hình sinh cả Excel, hình và báo cáo để không lệch.
5. **Nén tiến độ không miễn phí.** Fast-tracking rẻ nhưng chuyển chi phí sang rủi ro làm lại; crashing bị chặn bởi nhiều đường găng song song và giới hạn năng lực.
6. **Ghi rõ giả định.** Các số liệu mô phỏng (EVA, tài chính) phải gắn với giả định và sự kiện thực tế để giảng viên kiểm tra được.

## 4.3. Tự đánh giá mức độ thành công theo tiêu chí Chương 10

{sa}**Bảng 4.1.** Tự đánh giá theo ba trụ cột (Phạm vi, Tiến độ, Ngân sách) và các tiêu chí bổ sung.

**Kết luận tự đánh giá:** dự án **thành công về ba trụ cột chính** với các điều kiện đã nêu (một hạn chế phạm vi, chi phí vượt BAC nhưng trong dự phòng). Hai tiêu chí về sự hài lòng của khách hàng và lợi ích kinh doanh chưa thể đánh giá vì hệ thống chưa vận hành với thủ thư thật; đây là việc cần làm trong 3 tháng đầu vận hành.

## 4.4. Hạn chế và hướng hoàn thiện

- EV và AC là số mô phỏng có kiểm soát, không phải số đo thật; dự án sau nên ghi giờ theo mã WBS ngay từ ngày đầu (đã có khung `docs/pm/timelog.csv`).
- Các giả định tài chính chưa kiểm chứng ở một thư viện thật; cần chạy thử 3 tháng để thay bằng số đo.
- Hai trong bốn vai trò là nhân sự giả định; Gantt và sơ đồ mạng được vẽ bằng chương trình, chưa là ảnh chụp MS Project.
- Test Script chưa có cột kết quả thực tế; cần thực thi cùng thủ thư khi UAT.

# PHỤ LỤC

## Phụ lục A. Tổng hợp công thức

{tbl(["Nội dung", "Công thức"], [
    ["Ước lượng PERT", "E = (O + 4M + P) / 6; σ = (P − O) / 6"],
    ["Truyền tiến", "EF = ES + d; ES = max theo tiền nhiệm (FS: EF + lag; SS: ES + lag; FF: EF + lag − d; SF: ES + lag − d)"],
    ["Truyền lùi", "LS = LF − d; LF = min theo hậu nhiệm (FS: LS − lag; SS: LS − lag + d; FF: LF − lag; SF: LF − lag + d)"],
    ["Độ dự trữ", "Slack = LS − ES = LF − EF; găng khi Slack = 0"],
    ["NPV", "Σ CF_t / (1 + r)^t"],
    ["ROI", "(Σ dòng tiền ròng − vốn) / vốn"],
    ["Payback", "Năm trước khi luỹ kế dương + (phần vốn còn lại / dòng tiền ròng năm đó)"],
    ["Điểm rủi ro, EMV", "P x I; EMV = xác suất x tổn thất"],
    ["EVA", "SV = EV − PV; CV = EV − AC; SPI = EV / PV; CPI = EV / AC"],
    ["Dự báo", "EAC = BAC / CPI; EAC' = AC + (BAC − EV) / (CPI x SPI); ETC = EAC − AC; VAC = BAC − EAC; TCPI = (BAC − EV) / (BAC − AC)"],
    ["Crashing", "Chi phí nén 1 tuần = chi phí mỗi tuần x phụ phí; chọn hoạt động găng có chi phí trên mỗi tuần rút ngắn thấp nhất"],
])}**Bảng A.1.** Tổng hợp công thức.

## Phụ lục B. Tệp kèm theo và cách tái tạo

- `ULS_PM_Plan.xlsx`: 17 sheet có công thức sống, trong đó dùng cho báo cáo này: WBS, CPM (FS, SS, FF, SF), PERT, Gantt, NenTienDo, EVA, EVA_CongViec, TaiChinh, TaiChinh5N, RuiRo, RACI, Baseline. Các ô vàng là dữ liệu nhập.
- Hình vẽ: `docs/tools/build_pm_charts.py`, `build_qldapm_charts.py`; mô hình số liệu: `pm_model.py`, `qldapm_model.py`, `qldapm_calc.py`. Mọi số trong báo cáo được đối chiếu với file Excel bằng một bộ tính công thức độc lập (kết quả khớp tuyệt đối).
- Mã nguồn phần mềm và tài liệu kỹ thuật: {REPO}.
"""


# ----------------------------------------------------------------------------- Lắp ráp
def assemble(pages: dict[str, int] | None) -> str:
    body = part1() + part2() + part3() + part4()
    return front(pages, body) + body


def page_map(pdf: Path) -> dict[str, int]:
    """Số trang (trong thân bài) của từng bảng và hình, bỏ qua các trang mục lục, danh mục (có dòng chấm dẫn)."""
    doc = fitz.open(pdf)
    texts = [pg.get_text() for pg in doc]
    body_pages = [i for i, t in enumerate(texts) if "........" not in t and "......" not in t]
    out: dict[str, int] = {}
    labels = set(re.findall(r"(Bảng \d+\.\d+|Hình \d+\.\d+)\.", Path(OUT / "QLDAPM_Report.md").read_text(encoding="utf-8")))
    for lab in labels:
        for i in body_pages:
            if re.search(re.escape(lab) + r"\.(\s|\*)", texts[i]):
                out[lab] = i + 1
                break
    return out


def build_once(pages: dict[str, int] | None) -> Path:
    OUT.mkdir(parents=True, exist_ok=True)
    md_path = OUT / "QLDAPM_Report.md"
    md_path.write_text(assemble(pages), encoding="utf-8")
    docx = OUT / "QLDAPM_Report.docx"
    md_to_docx.convert(md_path, docx, style="qldapm")
    pdf = OUT / "QLDAPM_Report.pdf"
    fin.prepare(docx, footer="xy")
    pages_n = fin.word_update(docx, pdf)
    print("trang:", pages_n)
    return pdf


def main() -> None:
    pdf = build_once(None)
    pages = page_map(pdf)
    for attempt in range(3):
        pdf = build_once(pages)
        new_pages = page_map(pdf)
        if new_pages == pages:
            break
        pages = new_pages
    print("pages mapped:", len(pages))


if __name__ == "__main__":
    main()
