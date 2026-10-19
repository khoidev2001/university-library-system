"""Điền mẫu "Báo cáo thực hành tổng hợp QLDAPM (LAB 1 - 2 - 3)" của giảng viên bằng dữ liệu dự án ULS.

Số liệu lấy từ báo cáo QLDAPM đã có (docs/pm/QLDAPM_Report.md, sinh từ pm_model) nên khớp với Excel và hình vẽ.
Usage: python fill_lab_combined.py <mẫu.docx> <đầu ra.docx>
"""
from __future__ import annotations

import sys
from pathlib import Path

from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Pt

from docx_kit import MdSource, Template, force_font, rebuild_label_line
import qldapm_calc as calc

ROOT = Path(__file__).resolve().parents[2]
FIG = ROOT / "docs" / "pm" / "figures"
MD = MdSource(ROOT / "docs" / "pm" / "QLDAPM_Report.md")
GRID = "Table Grid"
TEXT_W = 16.0
LAND_W = 24.7


class Counter:
    def __init__(self):
        self.t = 0
        self.f = 0


def build(template: Path, output: Path, labels: dict[str, int] | None = None) -> dict[str, int]:
    """Dựng báo cáo; trả về số thứ tự các bảng để lần dựng thứ hai ghi đúng số tham chiếu."""
    labels = labels or {}
    registry: dict[str, int] = {}

    def ref(key: str) -> str:
        return f"Bảng {labels.get(key, '?')}"

    tpl = Template(template)
    tpl.default_half_pt = 26   # mọi chữ cỡ 13
    tpl.force_font_pt = 13     # cả chữ trong bảng
    dash_list = tpl.make_dash_list()
    doc = tpl.doc
    P = doc.paragraphs
    n = Counter()

    # ------------------------------------------------------------------ bìa
    cover_title = P[12]
    cover = dict(tab_twips=3400, base_indent=700, size_half_pt=26)
    rebuild_label_line(P[15], "Sinh viên thực hiện:", "Trần Đình Khôi - 23Q74802012006", **cover)
    rebuild_label_line(P[16], "Lớp:", "D23CTC2 (Nhóm 3)", **cover)
    rebuild_label_line(P[17], "Giảng viên hướng dẫn:", "TS. Lê Tỷ Khánh", **cover)
    # dòng sinh viên thứ hai: nhân bản dòng thứ nhất, bỏ nhãn
    import copy

    second = copy.deepcopy(P[15]._p)
    P[15]._p.addnext(second)
    from docx.text.paragraph import Paragraph

    second_p = Paragraph(second, P[15]._parent)
    rebuild_label_line(second_p, "", "Nguyễn Như Quỳnh - 21DQ4802011003", **cover)
    # đề tài: dùng đoạn trống P13 ngay dưới tiêu đề báo cáo
    topic = P[13]
    rebuild_label_line(topic, "Đề tài:", "Phần mềm Quản lý Thư viện Trường Đại học (ULS)", tab_twips=1500, base_indent=700, size_half_pt=26)
    P[21].runs[0].text = "Tháng 10-2026"

    # ------------------------------------------------------------------ chụp đoạn mẫu rồi xoá thân mẫu
    tpl.capture("h1", P[34])
    tpl.capture("h2", P[35])
    tpl.capture("h3", P[36])
    tpl.capture("body", P[45])
    tpl.capture("bullet", P[37])
    tpl.capture("caption", P[51])
    toc_heading = P[25]
    toc_heading.alignment = WD_ALIGN_PARAGRAPH.CENTER
    for run in toc_heading.runs:
        run.font.size = Pt(14)
    for idx in range(26, 32):  # mục lục gõ tay của mẫu
        P[idx]._p.getparent().remove(P[idx]._p)
    toc_heading._p.addnext(tpl.toc_paragraph("1-2"))
    tpl.clear_after(P[33])  # đoạn ngắt phần sau mục lục
    # P[33] là đoạn có sectPr: sau khi xoá, thân bài mới nối vào phần cuối

    # ------------------------------------------------------------------ tiện ích riêng của mẫu này
    def h1(text, new_page=False):
        tpl.add("h1", text, outline=0, page_break_before=new_page, size_half_pt=28, align="center")

    def h2(text):
        tpl.add("h2", text, outline=1)

    def h3(text):
        tpl.add("h3", text)

    def body(text, **kw):
        tpl.add("body", text, **kw)

    def bullet(text):
        tpl.add("bullet", text, list_num=dash_list, list_level=0)

    def bullet_lvl(text, level):
        tpl.add("bullet", text, list_num=dash_list, list_level=level)

    pending: list[str] = []
    cap_kw = dict(bold=True, italic=False, size_half_pt=24, align="center")

    def table_caption(title, key=None):
        n.t += 1
        if key:
            registry[key] = n.t
        pending.append(f"Bảng {n.t}. {title}")

    plain_table = tpl.table
    land = {"on": False}
    begin_land, end_land = tpl.begin_landscape, tpl.end_landscape

    def begin_landscape():
        land["on"] = True
        begin_land()

    def end_landscape():
        land["on"] = False
        end_land()

    tpl.begin_landscape, tpl.end_landscape = begin_landscape, end_landscape

    def table_then_caption(*args, **kw):
        args = list(args)
        if land["on"] and sum(args[2]) <= TEXT_W + 0.5:
            factor = LAND_W / sum(args[2])
            args[2] = [w * factor for w in args[2]]
        kw.setdefault("gap", False)
        kw.setdefault("keep_last", True)
        result = plain_table(*args, **kw)
        if pending:
            tpl.add("caption", pending.pop(), **cap_kw)
        return result

    tpl.table = table_then_caption

    def fig(path, title, w=TEXT_W, h=16.0):
        n.f += 1
        tpl.picture(path, w, f"Hình {n.f}. {title}", max_h_cm=h, caption_kw=cap_kw)

    def md_table(prefix, title, widths, key=None, **kw):
        header, rows = MD.table(prefix)
        assert len(header) == len(widths), (prefix, len(header), len(widths))
        table_caption(title, key)
        tpl.table(header, rows, widths, style=GRID, **kw)

    # =================================================================== PHẦN I
    h1("PHẦN I: KHỞI TẠO & PHẠM VI DỰ ÁN (LAB 1)")
    h2("1. Tôn chỉ dự án (Project Charter) & phát biểu bài toán (SOW)")
    h3("1.1. Tôn chỉ dự án")
    bullet("**Tên dự án:** Phần mềm Quản lý Thư viện Trường Đại học (University Library System, ULS). Hệ thống chạy thật tại https://muce-library.vercel.app, mã nguồn tại https://github.com/khoidev2001/university-library-system.")
    bullet("**Mục tiêu SMART:** 7 mục tiêu G1 đến G7 ở " + ref("smart") + " (số hoá nghiệp vụ mượn trả, giảm thời gian xử lý từ 3 phút xuống 1 phút, tra cứu dưới 1 giây, gợi ý và dự báo đạt ngưỡng, coverage từ 80%, lên môi trường thật, đúng hạn trong ngân sách).")
    bullet("**Lý do đầu tư và giá trị mang lại:** thư viện đang ghi sổ tay, thủ thư mất khoảng 3 phút cho mỗi lượt mượn trả, tính phạt thủ công dễ sai, bạn đọc không biết sách còn trên kệ, báo cáo làm tay mất nhiều giờ mỗi tháng. Phân tích ở Phần II cho NPV 3 năm dương và hoàn vốn dưới 1 năm.")
    bullet("**Phạm vi high-level:** trong phạm vi: quản lý sách, bạn đọc, mượn trả và phạt, tìm kiếm, báo cáo, gợi ý sách và dự báo trả trễ, quản trị, triển khai cloud, đào tạo thủ thư. Ngoài đường cơ sở 1.0: đặt trước, email nhắc hạn, thanh toán trực tuyến, ứng dụng di động (xem mục 1 Phần IV về phần đã mở rộng sau đó).")
    bullet("**Ngân sách ước tính sơ bộ:** khoảng 30 triệu đồng (sai số từ -10% đến +25%); sau ước lượng chi tiết, đường cơ sở (BAC) là 28,30 triệu đồng cộng dự phòng quản lý 2,83 triệu đồng, tổng 31,13 triệu đồng.")
    bullet("**Giả thiết và ràng buộc:** thời gian 16 tuần (21/09/2026 đến 10/01/2027); nhóm 2 sinh viên đảm nhận 4 vai trò mô phỏng, mỗi vai trò khoảng 16 giờ mỗi tuần; đơn giá 50.000 đồng mỗi giờ công; chỉ dùng hạ tầng gói miễn phí; thủ thư đại diện tham gia khảo sát và UAT; dữ liệu mượn trả để huấn luyện mô hình là dữ liệu mô phỏng.")
    bullet("**Danh sách Stakeholders:** Ban giám đốc thư viện (nhà tài trợ), thủ thư, sinh viên, giảng viên (bạn đọc), giảng viên hướng dẫn, phòng CNTT của trường, nhà cung cấp hạ tầng (" + ref("stake") + "). Quản lý dự án: Trần Đình Khôi.")
    md_table("**Bảng 1.2.**", "Mục tiêu SMART của dự án", [1.2, 5.4, 7.4, 2.0], key="smart", font_pt=10, center_cols={0, 3})
    md_table("**Bảng 1.3.**", "Các bên liên quan", [3.4, 2.9, 5.7, 2.0, 2.0], key="stake", font_pt=10, center_cols={3, 4})

    h3("1.2. Phát biểu bài toán (Statement of Work - SOW)")
    body("Thư viện trường đại học hiện quản lý sách, bạn đọc và việc mượn trả bằng sổ sách hoặc bảng tính. Hậu quả là tra cứu chậm, tính phạt sai, bạn đọc không biết sách còn hay hết và ban lãnh đạo không có số liệu thống kê. Dự án xây dựng hệ thống web ULS số hoá toàn bộ quy trình: quản lý đầu sách, tác giả, thể loại và bản sao vật lý có mã vạch; quản lý bạn đọc (sinh viên, giảng viên); cho mượn tại quầy, trả, gia hạn, báo mất và tự động tính phạt theo chính sách cấu hình được; tìm kiếm; thống kê; kèm hai mô hình học máy (gợi ý sách và dự báo nguy cơ trả trễ). Sản phẩm bàn giao bắt buộc gồm hệ thống chạy trực tuyến, mã nguồn và Docker, SRS, SDD, đặc tả API, báo cáo kiểm thử, hướng dẫn sử dụng và kế hoạch quản lý dự án (" + ref("sow") + " và " + ref("deliv") + ").")
    md_table("**Bảng 1.5.**", "Phát biểu bài toán (SOW)", [3.6, 12.4], key="sow", font_pt=10, bold_first_col=True)
    md_table("**Bảng 1.6.**", "Sản phẩm bàn giao và tiêu chí chấp nhận", [4.4, 6.6, 1.4, 3.6], key="deliv", font_pt=10, center_cols={2})

    h2("2. Cơ cấu tổ chức & kế hoạch truyền thông")
    h3("2.1. Lựa chọn sơ đồ tổ chức dự án")
    body("Nhóm chọn **ma trận cân bằng (balanced matrix)**. Các thành viên cùng lớp, làm bán thời gian cho dự án và vẫn có việc học ở bộ phận gốc. Quản lý dự án quyết định việc gì, ai làm, bao giờ xong; khoa và giảng viên hướng dẫn quyết định phân bổ thời gian chung. Cấu trúc theo chức năng khiến dự án không có người chịu trách nhiệm cuối, còn cấu trúc theo dự án đòi hỏi nhân sự chuyên trách mà nhóm không có (" + ref("orgcmp") + "). Về góc nhìn tổ chức, nhóm chọn góc nhìn Cấu trúc (Structural): dự án nhỏ, rủi ro lớn nhất là chồng chéo hoặc bỏ sót việc giữa các vai trò, nên cần vai trò, quy trình và quyền hạn rõ ràng; góc nhìn Nguồn nhân lực dùng bổ trợ để cân tải theo lịch thi.")
    md_table("**Bảng 1.9.** So sánh", "So sánh các loại cấu trúc tổ chức dự án", [3.6, 4.2, 4.2, 4.0], key="orgcmp", font_pt=10, bold_first_col=True)
    fig(FIG / "org.png", "Sơ đồ tổ chức nhóm dự án theo góc nhìn cấu trúc", w=14.5, h=8.5)

    tpl.begin_landscape()
    h3("2.2. Kế hoạch quản lý truyền thông & ma trận RACI")
    body("Nguyên tắc: thông tin đúng người, đúng lúc, đúng kênh; mọi quyết định quan trọng có hồ sơ lưu. Vấn đề không giải quyết được ở cấp thành viên chuyển lên quản lý dự án trong 1 ngày làm việc, vượt quyền quản lý dự án chuyển cho khách hàng hoặc giảng viên hướng dẫn trong 2 ngày.")
    md_table("**Bảng 1.7.**", "Kế hoạch quản lý truyền thông", [3.0, 2.4, 2.8, 2.2, 2.2, 3.4], key="comm", font_pt=9.5)
    body("Bảng ma trận phân chia trách nhiệm RACI cho các hạng mục công việc của dự án:")
    md_table("**Bảng 1.8.**", "Ma trận RACI (mỗi hạng mục có đúng một A)", [1.3, 3.9, 1.7, 1.9, 1.7, 1.7, 2.0, 1.8], key="raci", font_pt=9, center_cols={0, 2, 3, 4, 5, 6, 7})
    body("(Ghi chú: R = Responsible, A = Accountable, C = Consulted, I = Informed; A/R = vừa chịu trách nhiệm cuối vừa thực hiện)", italic=True)

    h2("3. Cấu trúc Phân rã Công việc (WBS) & Từ điển WBS")
    h3("3.1. Cấu trúc phân rã công việc (WBS)")
    body("WBS có 4 cấp: cấp 1 là pha vòng đời (7 pha), cấp 2 là nhóm công việc, cấp 3 là gói công việc (Work Package, 20 gói) và cấp 4 là công việc chi tiết (42 công việc, xem báo cáo QLDAPM đầy đủ). Gói công việc là đơn vị lập lịch, ước lượng chi phí và đo EVA. Tên gói được dùng nguyên văn ở sơ đồ mạng, Gantt và EVA.")
    fig(FIG / "wbs_tree.png", "Sơ đồ WBS dạng hình cây đến cấp 3 (vẽ bằng chương trình từ dữ liệu của mô hình)", w=LAND_W, h=10.5)
    tpl.end_landscape()
    body("WBS dạng danh sách phân cấp (Indent List), đến cấp 3; số đứng sau là mã mạng và giờ công kỳ vọng:")
    header, rows = MD.table("**Bảng 1.11.**")
    for code, level, name, net, hours in rows:
        extra = f" ({net}, {hours} giờ)" if net else ""
        if net == "duy trì":
            extra = f" (duy trì, {hours} giờ)"
        bullet_lvl(f"{code} {name}{extra}", int(level) - 1)
    body("Tổng 566,0 giờ công, BAC 28.301.667 đồng (đơn giá 50.000 đồng mỗi giờ).")

    h3("3.2. Từ điển WBS (WBS Dictionary)")
    body("Mô tả chi tiết cho ba gói công việc trọng yếu, đều nằm trên đường găng: Backend nền (4.1.1), Backend mượn trả (4.1.2) và AI gợi ý, dự báo (4.3.1).")
    for prefix, title in (
        ("**Bảng 1.9.** Từ điển WBS cho gói công việc 4.1.1", "Từ điển WBS cho gói 4.1.1 Backend nền: auth, sách, seed"),
        ("**Bảng 1.10.** Từ điển WBS cho gói công việc 4.1.2", "Từ điển WBS cho gói 4.1.2 Backend mượn trả, phạt, tìm kiếm"),
        ("**Bảng 1.11.** Từ điển WBS cho gói công việc 4.3.1", "Từ điển WBS cho gói 4.3.1 AI gợi ý và dự báo"),
    ):
        header, rows = MD.table(prefix)
        table_caption(title)
        tpl.table(["Trường thông tin", "Nội dung chi tiết"], rows, [4.0, 12.0], style=GRID, font_pt=10, bold_first_col=True)

    # =================================================================== PHẦN II
    tpl.begin_landscape()
    h1("PHẦN II: LẬP LỊCH, TÀI CHÍNH VÀ TIẾN ĐỘ DỰ ÁN (LAB 2)")
    h2("1. Phân tích khả thi tài chính dự án")
    body("Các giả định tài chính (đều là giả định, thay được ở sheet GiaDinh của file Excel kèm theo) và lợi ích hằng năm khi áp dụng đầy đủ:")
    md_table("**Bảng 2.1.**", "Giả định tài chính", [5.8, 4.4, 5.8], key="assume", font_pt=10)
    md_table("**Bảng 2.2.**", "Lợi ích hằng năm khi áp dụng đầy đủ", [4.6, 7.4, 4.0], key="benefit", font_pt=10, total_row=True, center_cols={2})
    body("Bảng luồng tiền ròng 3 năm với lãi suất chiết khấu r = 10% (đơn vị: đồng). Lợi ích năm t = tổng lợi ích đầy đủ x mức áp dụng (70%, 100%, 100%); chi phí các năm 1 đến 3 là chi phí vận hành 12.000.000 đồng; năm 0 là vốn đầu tư ban đầu:")
    md_table("**Bảng 2.3.**", "Dòng tiền dự án trong 3 năm", [1.6, 2.5, 2.4, 2.5, 1.9, 2.7, 2.4], key="cash", font_pt=9, center_cols={4})
    fig(FIG / "cashflow.png", "Dòng tiền ròng và luỹ kế trong 3 năm", w=12.5, h=7.5)
    bullet("**Tính toán NPV:** NPV = ∑ CF_t / (1 + r)^t, t = 0 đến 3, r = 10%. NPV = -31.131.833 + 38.956.364 + 54.842.975 + 49.857.250 = **112.524.756 đồng**.")
    bullet("**Tính toán ROI:** ROI = (Σ dòng tiền ròng năm 1 đến 3 - vốn đầu tư) / vốn đầu tư = (175.572.000 - 31.131.833) / 31.131.833 = **464,0%**.")
    bullet("**Thời gian hoàn vốn:** luỹ kế cuối năm 0 là -31.131.833, cuối năm 1 là 11.720.167 (đã dương), nên hoàn vốn trong năm 1: 31.131.833 / 42.852.000 = **0,73 năm** (khoảng 9 tháng).")
    bullet("**Kết luận tài chính:** dự án khả thi về tài chính. NPV vẫn dương khi lợi ích chỉ đạt khoảng 35% kế hoạch và chỉ âm khi lợi ích còn 30% và chiết khấu từ 12% (" + ref("sens") + "). Rủi ro chính là lợi ích không xảy ra vì thủ thư không dùng hệ thống (R8), nên đào tạo và chạy song song với sổ tay là điều kiện để tạo giá trị. Các con số dựa vào giả định chưa kiểm chứng ở một thư viện thật.")
    md_table("**Bảng 2.5.**", "Độ nhạy: NPV 3 năm (đồng) theo mức lợi ích và tỉ lệ chiết khấu", [3.6, 3.1, 3.1, 3.1, 3.1], key="sens", font_pt=10, center_cols={1, 2, 3, 4})

    h2("2. Ước lượng chi tiết & mối quan hệ phụ thuộc")
    body("Bảng tổng hợp công việc từ WBS kèm ước lượng thời gian, chi phí và mối quan hệ phụ thuộc. Đơn vị thời gian là **tuần** (khác ví dụ theo ngày trong mẫu vì dự án dài 16 tuần); thời gian ước lượng theo giờ công của vai trò đảm nhận chia cho năng lực 16 giờ mỗi người mỗi tuần; chi phí = giờ kỳ vọng PERT x 50.000 đồng. Lag dương là độ trễ, lag âm là dẫn trước (lead).")
    md_table("**Bảng 2.6.**", "Danh sách công việc, ước lượng thời gian, chi phí và phụ thuộc", [1.3, 1.0, 4.2, 1.5, 1.0, 2.2, 4.8], key="est", font_pt=9, center_cols={1, 3, 4})
    md_table("**Bảng 2.7.**", "Bốn loại quan hệ phụ thuộc và ví dụ trong dự án", [3.0, 5.4, 7.6], font_pt=10, bold_first_col=True)

    h2("3. Sơ đồ mạng, thuật toán Forward/Backward Pass & đường găng")
    h3("3.1. Sơ đồ mạng công việc (AON Diagram)")
    fig(FIG / "network.png", "Sơ đồ mạng AON với ES, EF, LS, LF, Slack (đỏ: đường găng)", w=LAND_W, h=14.5)
    h3("3.2. Thuật toán truyền tiến / truyền lùi & bảng tham số")
    body("Truyền tiến: ES(việc sau) = max theo mọi tiền nhiệm của (FS: EF + lag; SS: ES + lag; FF: EF + lag - d; SF: ES + lag - d), EF = ES + d. Truyền lùi: LF(việc trước) = min theo mọi hậu nhiệm của (FS: LS - lag; SS: LS - lag + d; FF: LF - lag; SF: LF - lag + d), LS = LF - d, Slack = LS - ES. Việc cuối có LF bằng EF lớn nhất của dự án. Đơn vị: tuần, mốc đếm từ đầu tuần 1 (mốc 0). Bảng tính từng bước có thế số nằm ở mục 2.3.2 của báo cáo QLDAPM đầy đủ.")
    md_table("**Bảng 2.9.**", "Tổng hợp kết quả CPM (ES, EF, LS, LF, Slack)", [1.5, 5.9, 0.9, 1.0, 1.0, 1.1, 1.1, 1.3, 1.2], key="cpm", font_pt=9.5, center_cols={0, 2, 3, 4, 5, 6, 7, 8})
    body("**Tổng thời gian hoàn thành dự án: 16 tuần.** Có 14 trên 19 gói găng (Slack = 0) và 3 đường găng song song:")
    bullet("Đường 1: A → C → D → E → H → I → L → M → O → P → S (1.1.1, 2.1.1, 2.1.2, 3.1.1, 4.1.1, 4.1.2, 4.3.1, 4.3.2, 5.1.2, 6.1.2, 7.2.1).")
    bullet("Đường 2: A → C → D → E → H → J → K → M → O → P → S.")
    bullet("Đường 3: A → C → D → F → J → K → M → O → P → S.")
    body("Các gói có độ dự trữ: 1.1.2 Dựng môi trường (Slack 2), 3.1.3 Thiết kế mô hình AI (3), 5.1.1 Kiểm thử đơn vị, tích hợp (2), 6.1.1 Docker, CI/CD (4), 6.2.1 Tài liệu, đào tạo thủ thư (1). Vì mạng chặt (nhiều đường găng), mọi trễ trên gói găng đều đẩy ngày kết thúc, nên EVA phải theo dõi sát.")

    h2("4. Sơ đồ Gantt chart & kế hoạch nén tiến độ")
    fig(FIG / "gantt.png", "Biểu đồ Gantt của dự án (đỏ: găng; xanh: có dự trữ)", w=LAND_W, h=10.0)
    body("Nguồn hình: Gantt và sơ đồ mạng được vẽ bằng chương trình (Python, matplotlib) trực tiếp từ dữ liệu CPM để khớp tuyệt đối với bảng tính; cùng dữ liệu có ở sheet CPM và Gantt của file Excel kèm theo (docs/pm/ULS_PM_Plan.xlsx) và nhập được vào MS Project hoặc GanttProject.", italic=True)
    body("**Phương án nén tiến độ (giảm 20%, từ 16 xuống không quá 12,8 tuần).** Hai kỹ thuật: Crashing (thêm nhân lực hoặc làm thêm giờ, tăng chi phí) và Fast-tracking (làm song song các việc tuần tự, tăng rủi ro làm lại). Vì có 3 đường găng song song, phải nén đồng thời trên mọi đường. Ba phương án được so sánh ở " + ref("compress") + ":")
    md_table("**Bảng 2.11.**", "So sánh ba phương án nén", [3.4, 2.3, 1.8, 3.3, 5.2], key="compress", font_pt=10, center_cols={1, 2})
    bullet("**Kỹ thuật Fast-tracking:** bốn thay đổi quan hệ phụ thuộc (FT1 đến FT4) đưa dự án từ 16 xuống 13 tuần với dự phòng làm lại 30 giờ (1.500.000 đồng), ví dụ bắt đầu tích hợp 1 tuần trước khi Frontend và AI xong hẳn (FS với lead 1 tuần).")
    md_table("**Bảng 2.12.**", "Các thay đổi fast-tracking và dự phòng làm lại", [1.2, 8.6, 2.2, 4.0], font_pt=9.5, center_cols={0, 2})
    bullet("**Kỹ thuật Crashing:** thuật toán chọn mỗi lần tổ hợp hoạt động găng giảm được thời gian dự án với chi phí trên mỗi tuần thấp nhất; chỉ cần nén thêm 0,5 tuần ở 5.1.2 và 6.2.1 để xuống 12,5 tuần.")
    md_table("**Bảng 2.13.**", "Các bước crashing", [1.4, 5.8, 2.2, 3.0, 3.6], font_pt=10, center_cols={0, 2})
    body("Phương án khuyến nghị là **kết hợp (Fast-tracking rồi Crashing): 12,5 tuần (giảm 21,9%), chi phí tăng thêm 1.705.625 đồng** (6,0% BAC, 60% dự phòng quản lý).")
    fig(FIG / "compress_gantt.png", "Gantt trước nén (xám) và sau nén (đỏ, xanh)", w=LAND_W, h=13.5)
    bullet("**Đánh giá rủi ro nén tiến độ:** nguy cơ quá tải nhân lực (tải đỉnh nhóm tăng lên 64,4 giờ mỗi tuần so với năng lực 64), phát sinh lỗi do chồng lấn, mất độ dự trữ và tăng chi phí (" + ref("crisk") + ").")
    md_table("**Bảng 2.15.**", "Rủi ro của phương án nén tiến độ", [3.2, 5.2, 1.6, 6.0], key="crisk", font_pt=9.5, center_cols={2})
    body("Chỉ nên nén khi khách hàng chấp nhận chi phí tăng thêm 1,71 triệu đồng và rủi ro làm lại; nếu không, giữ lịch 16 tuần. Nếu nén: đóng băng hợp đồng API từ tuần 3, dựng dịch vụ giả (mock) cho AI để tích hợp sớm, không nén kiểm thử và UAT, theo dõi EVA hằng tuần.")

    # =================================================================== PHẦN III
    h1("PHẦN III: QUẢN LÝ RỦI RO, GIÁ TRỊ THU ĐƯỢC (EVA) VÀ QUẢN LÝ CHẤT LƯỢNG (LAB 3)", new_page=True)
    h2("1. Quản lý rủi ro dự án (Risk Management)")
    body("Danh mục rủi ro gồm 11 rủi ro thuộc 4 nhóm Con người, Tiến trình, Sản phẩm, Công nghệ (đề yêu cầu từ 6 rủi ro). P là xác suất và I là mức ảnh hưởng, thang 1 đến 5; Score = P x I; mức Cao từ 15, Trung bình từ 8 đến 14, Thấp dưới 8. Tổng giá trị tiền kỳ vọng (EMV) của các rủi ro là 2.820.000 đồng, bằng đúng dự phòng quản lý.")
    reg_h, reg = MD.table("**Bảng 3.1.**")
    plan_h, plan = MD.table("**Bảng 3.3.**")
    plan_by = {r[0]: r for r in plan}
    rows = []
    for r in reg:
        code, name, group, p, i, score, level = r[:7]
        mit = plan_by[code][1]
        cont = plan_by[code][2]
        rows.append([code, group, name, p, i, f"{score}\n({level})", mit, cont])
    table_caption("Danh mục quản lý rủi ro (Risk Register)")
    tpl.table(["Mã", "Nhóm", "Mô tả rủi ro", "P", "I", "Score", "Kế hoạch giảm thiểu (Mitigation)", "Kế hoạch dự phòng (Contingency)"],
              rows, [1.4, 2.0, 3.6, 0.8, 0.8, 1.9, 7.1, 7.1], style=GRID, font_pt=8.5, center_cols={0, 3, 4, 5})
    tpl.end_landscape()
    fig(FIG / "risk_matrix.png", "Ma trận rủi ro 5x5 (P theo trục dọc, I theo trục ngang)", w=11.5, h=9.5)
    body("Có 2 rủi ro mức Cao: R1 (điểm 15) và R5 (điểm 16). Ba rủi ro đã xảy ra trong dự án thật: R1 (dịch vụ trên Render ngủ, backend tự rơi về danh sách sách mượn nhiều nên người dùng không thấy lỗi), R2 (Google Books giới hạn tần suất nên dùng goodbooks-10k làm nguồn chính) và R10 (phát hiện phạt tính theo giờ khi chạy thật luồng trả sách, đã sửa).")

    h2("2. Phân tích Giá trị Thu được (Earned Value Analysis - EVA)")
    body("Phân tích tại mốc m = 50% thời gian thực hiện dự án, tức hết tuần 8 trong 16 tuần. Số liệu EVA là **mô phỏng có kiểm soát**: giờ kế hoạch từng tuần lấy từ lịch CPM; EV = giờ kế hoạch x hiệu suất tiến độ của tuần (tuần 1 đến 4: 0,96; tuần 5 đến 8: 0,80 vì nhập dữ liệu Google Books bị giới hạn tần suất); AC = EV x hệ số chi phí (1,04 rồi 1,12).")
    bullet("**BAC (Budget at Completion):** 28.301.667 đồng")
    bullet("**PV (Planned Value):** 15.420.500 đồng")
    bullet("**EV (Earned Value):** 13.382.333 đồng")
    bullet("**AC (Actual Cost):** 14.486.165 đồng")
    body("Các chỉ số tính toán sức khỏe dự án:")
    bullet("CV = EV - AC = 13.382.333 - 14.486.165 = -1.103.832 đồng (vượt ngân sách)")
    bullet("SV = EV - PV = 13.382.333 - 15.420.500 = -2.038.167 đồng (chậm tiến độ)")
    bullet("CPI = EV / AC = 13.382.333 / 14.486.165 = 0,924 (< 1: chi phí kém hiệu quả)")
    bullet("SPI = EV / PV = 13.382.333 / 15.420.500 = 0,868 (< 1: tiến độ chậm hơn kế hoạch, tương đương chậm khoảng 1,1 tuần)")
    bullet("EAC = BAC / CPI = 28.301.667 / 0,924 = 30.636.109 đồng (dự báo vượt BAC 2.334.442 đồng, 8,2%, vẫn trong dự phòng 2.830.167 đồng). Nếu cả chậm tiến độ kéo dài, EAC' = AC + (BAC - EV) / (CPI x SPI) = 33.095.790 đồng, vượt dự phòng.")
    md_table("**Bảng 3.5.**", "Chỉ số EVA cấp dự án tại mốc 50% tiến độ", [2.8, 4.6, 5.4, 3.2], key="evaidx", font_pt=9.5, center_cols={3})
    fig(FIG / "eva_curves.png", "Đường cong PV, EV, AC của cả dự án (mốc 50% là tuần 8)", w=14.0, h=8.0)
    body("Hành động khắc phục: chạy song song Frontend với Backend, làm thêm giờ có kiểm soát ở tuần 9 đến 12, hoãn nhập ISBN từ Google Books, không nhận thêm tính năng ngoài MVP. Kết quả mô phỏng: hoàn thành đúng hạn ở tuần 16 với chi phí thực tế 30,56 triệu đồng (vượt BAC 8,0%, dùng 80% dự phòng). Bảng EVA theo từng gói công việc nằm ở mục 3.2.2 của báo cáo QLDAPM đầy đủ.")

    h2("3. Quản lý thay đổi & cấu hình (Change Management)")
    bullet("**Thiết lập đường cơ sở (Baseline):** phiên bản 1.0 chốt sau khi khách hàng duyệt SOW và lịch (mốc M1, tuần 2). **Baseline Scope** là WBS cấp 3 kèm từ điển WBS và tiêu chí chấp nhận (mục 3.1 và 3.2 Phần I); **Baseline Schedule** là lịch CPM ở " + ref("cpm") + " cùng 8 mốc ở " + ref("sched") + "; **Baseline Cost** là BAC theo pha ở " + ref("costph") + ".")
    md_table("**Bảng 3.7.**", "Đường cơ sở lịch: các mốc quan trọng", [1.6, 1.6, 6.1, 6.7], key="sched", font_pt=10, center_cols={0, 1})
    md_table("**Bảng 3.8.**", "Đường cơ sở chi phí theo pha", [4.8, 2.4, 4.8, 4.0], key="costph", font_pt=10, center_cols={1, 3}, total_row=False)
    bullet("**Quy trình 5 bước kiểm soát yêu cầu thay đổi:** Tiếp nhận (Đề xuất) → Phân tích ảnh hưởng → Phê duyệt (dưới 8 giờ và không ảnh hưởng đường găng: Quản lý dự án; từ 8 giờ hoặc ảnh hưởng đường găng: khách hàng; vượt dự phòng: báo giảng viên) → Thực thi và cập nhật Baseline → Xác minh và truyền thông.")
    md_table("**Bảng 3.9.**", "Quy trình 5 bước kiểm soát thay đổi (Change Request Process)", [2.4, 5.6, 2.6, 2.0, 3.4], font_pt=9.5, bold_first_col=True)
    md_table("**Bảng 3.10.**", "Phiếu Change Request mẫu (CR-01)", [4.0, 12.0], font_pt=10, bold_first_col=True)
    md_table("**Bảng 3.11.**", "Nhật ký thay đổi", [1.5, 5.0, 1.2, 3.3, 5.0], font_pt=9.5, center_cols={0, 2})
    body("Quản lý cấu hình: mã nguồn trên Git, nhánh main được bảo vệ; mỗi công việc làm trên nhánh riêng, gộp qua Pull Request có rà soát và CI xanh; cấu hình bí mật chỉ nằm trong biến môi trường; tài liệu thiết kế (ERD, đặc tả API) sinh từ mã nguồn để không lệch.")

    h2("4. Đảm bảo chất lượng & kết thúc dự án (QA/QC)")
    h3("4.1. Kế hoạch Kiểm thử (Test Plan)")
    header, rows = MD.table("**Bảng 3.12.**")
    fixed = []
    for k, v in rows:
        if k == "Kết quả đạt được":
            v = ("Theo mã nguồn hiện tại: khoảng 285 ca unit và khoảng 200 ca e2e trên PostgreSQL thật (gồm 12 ca đua song song) cho Backend, "
                 "26 ca pytest cho dịch vụ AI; ngưỡng coverage 80% dòng và 75% nhánh được ép trong CI; CI chạy 4 job rồi mới triển khai. "
                 "Số ca và kết quả từng lần chạy xem ở GitHub Actions.")
        fixed.append([k, v])
    table_caption("Kế hoạch kiểm thử (Test Plan)")
    tpl.table(["Hạng mục", "Nội dung"], fixed, [3.4, 12.6], style=GRID, font_pt=10, bold_first_col=True)

    h3("4.2. Kịch bản Kiểm thử mẫu (Test Scripts)")
    body("Ba kịch bản cho ba chức năng trọng yếu: mượn sách (nghiệp vụ lõi), trả sách và tính phạt (liên quan tiền), đăng nhập và phân quyền (bảo mật). Mỗi kịch bản có luồng tương đương đã chạy tự động trên CI.")
    for ts in calc.TEST_SCRIPTS:
        steps = "\n".join(f"{b[0]}. {b[1]}" for b in ts["buoc"])
        expected = "\n".join(f"{b[0]}. {b[2]}" for b in ts["buoc"]) + f"\nTiêu chí đạt: {ts['tieu_chi']}"
        table_caption(f"Kịch bản kiểm thử {ts['id']}")
        tpl.table(["Trường thông tin", f"Nội dung kịch bản kiểm thử ({ts['id'].replace('-', '_')})"], [
            ["Mã Test Script / Tên", f"{ts['id'].replace('-', '_')} - {ts['name']}"],
            ["Điều kiện tiên quyết", ts["tien_dieu_kien"]],
            ["Các bước thực hiện", steps],
            ["Dữ liệu test (Test Data)", ts["du_lieu"]],
            ["Kết quả mong đợi", expected],
        ], [3.6, 12.4], style=GRID, font_pt=9.5, bold_first_col=True)

    h3("4.3. Quy trình Theo dõi Sửa lỗi")
    body("Vòng đời khuyết tật: Mới (New) → Đã giao (Assigned) → Đang sửa (Open) → Đã sửa (Fixed) → Kiểm thử lại (Pending Retest) → Đóng (Closed); nếu không đạt thì Mở lại (Reopened) và quay về Đang sửa. Các nhánh phụ: Trùng, Từ chối, Hoãn. Mỗi lỗi là một Issue trên GitHub; lỗi Nghiêm trọng phải có bài test chặn tái diễn trước khi đóng.")
    fig(FIG / "defect_lifecycle.png", "Vòng đời lỗi (Defect Life Cycle)", w=15.0, h=7.0)
    md_table("**Bảng 3.16.**", "Mức độ lỗi và thời hạn xử lý", [2.3, 5.4, 4.5, 3.8], font_pt=10, center_cols={0})

    # =================================================================== PHẦN IV
    h1("PHẦN IV: KẾT LUẬN VÀ TỰ ĐÁNH GIÁ", new_page=True)
    h2("1. Tổng kết kết quả đạt được")
    body("Nhóm hoàn thành ba bài thực hành trên cùng một dự án xuyên suốt, phần mềm ULS:")
    bullet("**LAB 1:** Tôn chỉ dự án với 7 mục tiêu SMART, SOW và kế hoạch truyền thông, RACI 25 hạng mục; chọn cấu trúc ma trận cân bằng và góc nhìn Cấu trúc; WBS 4 cấp (42 công việc chi tiết, 20 gói công việc) và từ điển WBS cho 3 gói găng.")
    bullet("**LAB 2:** phân tích tài chính (NPV 112,52 triệu đồng, ROI 464%, hoàn vốn khoảng 9 tháng); danh sách công việc với đủ bốn loại quan hệ phụ thuộc; sơ đồ mạng, tính xuôi ngược, 3 đường găng, 16 tuần; nén 20% bằng fast-tracking kết hợp crashing xuống 12,5 tuần, chi phí tăng 1,71 triệu đồng.")
    bullet("**LAB 3:** 11 rủi ro thuộc 4 nhóm kèm Mitigation và Contingency; EVA tại mốc 50% (SPI 0,868, CPI 0,924, EAC 30,64 triệu đồng); đường cơ sở và quy trình 5 bước kiểm soát thay đổi; Test Plan, 3 Test Script, vòng đời lỗi.")
    bullet("**Sản phẩm thật:** hệ thống ULS chạy tại https://muce-library.vercel.app. Sau đường cơ sở 1.0, sản phẩm được mở rộng thêm đặt trước sách, thông báo và email nhắc hạn, tài khoản và mật khẩu, thanh toán phạt trực tuyến qua VNPay (sandbox), xuất báo cáo, in thẻ và nhãn, nhập sách từ file (SRS 2.0, US21 đến US37). Các hạng mục này nằm ngoài mô phỏng EVA ở Phần III.")
    h2("2. Bài học kinh nghiệm")
    bullet("**Mạng chặt thì phải theo dõi sát.** Có 3 đường găng song song, xác suất xong đúng 16 tuần theo PERT chỉ khoảng 22%; nên theo dõi SPI hằng tuần và đặt sẵn danh sách cắt giảm phạm vi.")
    bullet("**Phụ thuộc bên ngoài là điểm nghẽn.** Giới hạn tần suất của Google Books làm dự án chậm ở tuần 8; cần nguồn dữ liệu dự phòng ngay từ sprint đầu.")
    bullet("**Chạy thật luồng liên quan tiền, không chỉ test có mock.** Lỗi tính phạt theo giờ chỉ lộ khi chạy thật luồng trả sách.")
    bullet("**Nhất quán dữ liệu giữa WBS, lịch và EVA** giúp mọi con số truy được về một gói công việc; một mô hình sinh cả Excel, hình và báo cáo để không lệch.")
    bullet("**Nén tiến độ không miễn phí.** Fast-tracking rẻ nhưng chuyển chi phí sang rủi ro làm lại; crashing bị chặn bởi nhiều đường găng song song và giới hạn năng lực.")
    bullet("**Ghi rõ giả định.** Số liệu mô phỏng (EVA, tài chính) phải gắn với giả định và sự kiện thực tế để người chấm kiểm tra được.")
    h2("3. Tự đánh giá theo 3 trụ cột")
    bullet("**Phạm vi (Scope):** đạt. 20 trên 20 User Story của đường cơ sở hoàn thành; sản phẩm hiện đáp ứng 37 User Story (SRS 2.0). Hạn chế còn lại: nhập sách theo ISBN từ Google Books chưa kiểm với dữ liệu thật do giới hạn tần suất.")
    bullet("**Tiến độ (Time):** đạt có điều kiện. Mô phỏng hoàn thành đúng tuần 16 sau giai đoạn chậm ở tuần 8 (SPI 0,87) nhờ làm thêm giờ và chạy song song; phần mềm thật hoàn thành trong 8 tuần làm việc theo 4 LAB.")
    bullet("**Chi phí (Cost):** đạt có điều kiện. Chi phí thực tế mô phỏng 30.564.419 đồng, vượt BAC 8,0% nhưng trong ngân sách đề xuất (dùng 80% dự phòng); CPI cuối 0,926.")
    header, rows = MD.table("**Bảng 4.1.**")
    fresh = {
        "Phạm vi (Scope)": ["Phạm vi (Scope)", "100% User Story trong phạm vi; 0 lỗi Nghiêm trọng và Cao mở",
                            "20 trên 20 User Story của đường cơ sở hoàn thành; sản phẩm hiện đáp ứng 37 User Story (SRS 2.0); CI xanh trên nhánh main. Hạn chế: nhập sách theo ISBN từ Google Books chưa kiểm với dữ liệu thật (giới hạn tần suất)",
                            "Đạt, kèm 1 hạn chế đã ghi nhận"],
        "Chất lượng": ["Chất lượng", "Coverage từ 80%; CI xanh; chỉ số mô hình",
                       "Ngưỡng coverage 80% dòng và 75% nhánh được ép trong CI; khoảng 285 ca unit và 200 ca e2e trên PostgreSQL thật cho Backend, 26 ca cho AI; Precision@5 = 0,309 và ROC-AUC = 0,788 ở lần huấn luyện gần nhất",
                       "Đạt"],
    }
    rows = [fresh.get(r[0], r) for r in rows]
    table_caption("Tự đánh giá theo ba trụ cột và các tiêu chí bổ sung", "selfeval")
    tpl.table(header, rows, [2.9, 3.6, 6.9, 2.6], style=GRID, font_pt=9.5)
    body("Hạn chế: EV và AC là số mô phỏng, không phải số đo thật; các giả định tài chính chưa kiểm chứng ở một thư viện thật; hai trong bốn vai trò là nhân sự giả định; Gantt và sơ đồ mạng vẽ bằng chương trình, chưa phải ảnh chụp từ MS Project; các Test Script chưa có cột kết quả thực tế vì chưa thực thi cùng thủ thư.")

    h1("TÀI LIỆU THAM KHẢO", new_page=True)
    refs = [
        "1. Ts. Lê Tỷ Khánh, Tài liệu bài giảng và bài tập thực hành Quản lý Dự án Phần mềm.",
        "2. Project Management Institute (PMI), A Guide to the Project Management Body of Knowledge (PMBOK Guide).",
        "3. IEEE Std 830-1998, Recommended Practice for Software Requirements Specifications.",
        "4. Nhóm thực hiện, Báo cáo thực hành QLDAPM đầy đủ (docs/pm/QLDAPM_Report.docx) và bảng tính ULS_PM_Plan.xlsx, https://github.com/khoidev2001/university-library-system.",
        "5. Nhóm thực hiện, Tài liệu đặc tả yêu cầu (SRS 2.0) và thiết kế hệ thống (SDD 2.0) của ULS, cùng kho mã nguồn.",
    ]
    for r in refs:
        bullet(r)

    doc = tpl.doc
    doc.core_properties.title = "Báo cáo thực hành tổng hợp Quản lý dự án phần mềm (LAB 1 - 2 - 3): ULS"
    doc.core_properties.author = "Trần Đình Khôi, Nguyễn Như Quỳnh"
    force_font(doc)  # toàn bộ chữ là Times New Roman
    doc.save(output)
    return registry


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit("usage: fill_lab_combined.py template.docx output.docx")
    first = build(Path(sys.argv[1]), Path(sys.argv[2]))
    build(Path(sys.argv[1]), Path(sys.argv[2]), labels=first)  # lần hai: đã biết số tham chiếu
    print("wrote", sys.argv[2])
