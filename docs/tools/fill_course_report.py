"""Điền mẫu "Báo cáo quản lý dự án phần mềm" (5 chương) của giảng viên bằng đề tài ULS.

Mẫu gốc viết cho đề tài bảo hiểm (InsurTech); báo cáo này giữ nguyên khung 5 chương và các mục của mẫu nhưng nội dung
là hệ thống thư viện ULS. Số liệu quản lý dự án (16 tuần, 566 giờ, BAC, mốc M1 đến M8, NPV) lấy từ báo cáo LAB.
Usage: python fill_course_report.py <mẫu.docx> <đầu ra.docx>
"""
from __future__ import annotations

import copy
import sys
from pathlib import Path

from docx.oxml.ns import qn
from docx.text.paragraph import Paragraph

from docx_kit import Template, rebuild_label_line

ROOT = Path(__file__).resolve().parents[2]
FIG = ROOT / "docs" / "pm" / "figures"
UML = ROOT / "docs" / "uml"
TEXT_W = 16.0


def set_text(paragraph: Paragraph, text: str) -> None:
    runs = paragraph.runs
    runs[0].text = text
    for run in runs[1:]:
        run.text = ""


def build(template: Path, output: Path) -> None:
    tpl = Template(template)
    doc = tpl.doc
    P = doc.paragraphs
    style_name = "Plain Table 1" if "Plain Table 1" in [s.name for s in doc.styles] else "Table Grid"
    n = {"t": 0, "f": 0}

    # ------------------------------------------------------------------ bìa
    # Mẫu có hai bản bìa chồng nhau: khung viền là hộp văn bản (Choice và Fallback), bản thứ hai là các đoạn thân bài.
    # Điền hộp văn bản, rồi bỏ bản thân bài (trùng) và chuyển dấu ngắt phần lên đoạn mang hộp.
    cover = dict(tab_twips=3400, base_indent=700, size_half_pt=26)
    for box in list(doc.element.body.iter(qn("w:txbxContent"))):
        for p_el in box.findall(qn("w:p")):
            para = Paragraph(p_el, P[0]._parent)
            text = para.text
            if text.startswith("QUẢN LÝ DỰ ÁN PHẦN MỀM BẢO HIỂM"):
                set_text(para, "QUẢN LÝ DỰ ÁN PHẦN MỀM THƯ VIỆN")
            elif text.startswith("CÔNG TY CỔ PHẦN"):
                set_text(para, "TRƯỜNG ĐẠI HỌC (ULS)")
            elif text.startswith("Sinh viên thực hiện"):
                second = copy.deepcopy(p_el)
                rebuild_label_line(para, "Sinh viên thực hiện:", "Trần Đình Khôi - 23Q74802012006", **cover)
                p_el.addnext(second)
                rebuild_label_line(Paragraph(second, P[0]._parent), "", "Nguyễn Như Quỳnh - 21DQ4802011003", **cover)
            elif text.startswith("Lớp"):
                rebuild_label_line(para, "Lớp:", "D23CTC2 (Nhóm 3)", **cover)
            elif text.startswith("Giảng viên hướng dẫn"):
                rebuild_label_line(para, "Giảng viên hướng dẫn:", "TS. Lê Tỷ Khánh", **cover)
    sect_pr = P[25]._p.find(qn("w:pPr")).find(qn("w:sectPr"))
    P[0]._p.find(qn("w:pPr")).append(sect_pr)
    for idx in range(1, 26):
        P[idx]._p.getparent().remove(P[idx]._p)

    # ------------------------------------------------------------------ đoạn mẫu
    tpl.capture("h1", P[33])
    tpl.capture("h2", P[35])
    tpl.capture("body", P[36])
    tpl.capture("bullet", P[40], strip_bold=True)
    tpl.capture("step", P[68], strip_bold=True)
    tpl.capture("plain", P[130])  # dòng tài liệu tham khảo: không ký hiệu đầu dòng
    toc_heading, preface_heading, abbrev_heading = P[26], P[28], P[30]
    tpl.clear_after(P[32])

    def insert_after(anchor, el):
        anchor.addnext(el)
        return el

    # ------------------------------------------------------------------ mục lục
    insert_after(toc_heading._p, tpl.toc_paragraph("1-2"))

    # ------------------------------------------------------------------ lời nói đầu
    preface = [
        "Thư viện là nơi bạn đọc gặp tài liệu, nhưng với thủ thư, mỗi lượt mượn trả còn là một chuỗi việc có ràng buộc: kiểm tra hạn mức, nợ phạt, tình trạng bản sao, tính phạt khi trễ. Khi các việc này làm bằng sổ tay, sai sót và thời gian chờ là điều khó tránh. Hệ thống Quản lý Thư viện Trường Đại học (University Library System, ULS) do nhóm xây dựng nhằm số hoá toàn bộ quy trình đó và đã chạy trực tuyến tại https://muce-library.vercel.app.",
        "Báo cáo này dùng ULS làm đề tài để vận dụng kiến thức Quản lý Dự án Phần mềm: xác định bối cảnh và phương pháp luận (Chương 1), phân tích tác nhân và use case (Chương 2), cấu trúc phân chia công việc theo chức năng (Chương 3), rủi ro bảo mật dữ liệu bạn đọc và cách đưa biện pháp bảo vệ vào WBS (Chương 4), lộ trình triển khai và bộ chỉ số đánh giá (Chương 5). Số liệu kế hoạch (16 tuần, 566 giờ công, ngân sách cơ sở 28,30 triệu đồng) thống nhất với báo cáo thực hành LAB 1 đến 3 của nhóm.",
        "Nhóm xin cảm ơn TS. Lê Tỷ Khánh đã hướng dẫn và góp ý trong suốt học phần. Do thời gian và kinh nghiệm còn hạn chế, báo cáo khó tránh thiếu sót; nhóm mong nhận được ý kiến đóng góp của thầy.",
    ]
    anchor = preface_heading._p
    for text in preface:
        anchor = insert_after(anchor, tpl.make_para("body", text))

    # ------------------------------------------------------------------ tiện ích dựng thân bài
    state = {"last": None, "num": None}

    def mark(kind):
        state["last"] = kind

    def h1(text, new_page=True):
        mark("h1")
        tpl.add("h1", text, outline=0, page_break_before=new_page)

    def h2(text):
        mark("h2")
        tpl.add("h2", text, outline=1)

    def body(text, **kw):
        mark("body")
        tpl.add("body", text, **kw)

    def bullet(text):
        if state["last"] != "bullet":  # mỗi nhóm gạch đầu dòng đánh lại a), b), c)...
            state["num"] = tpl.new_list_num(10)
        mark("bullet")
        tpl.add("bullet", text, num_id=state["num"])

    def step(text):
        mark("step")
        tpl.add("step", text)

    def caption(text):
        mark("caption")
        tpl.add("body", text, italic=True, align="center", size_half_pt=24, keep_next=True)

    def table(title, header, rows, widths, **kw):
        n["t"] += 1
        caption(f"Bảng {n['t']}. {title}")
        tpl.table(header, rows, widths, style=style_name, header_fill=None, **kw)

    def fig(path, title, w=TEXT_W, h=16.0):
        mark("fig")
        n["f"] += 1
        tpl.picture(path, w, f"Hình {n['f']}. {title}", caption_kind="body", max_h_cm=h)
        # đoạn chú thích hình dùng kiểu thân bài: chỉnh lại thành chữ nghiêng căn giữa
        last = tpl.body.find("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}sectPr").getprevious()
        _style_caption(last)

    def _style_caption(el):
        from docx.oxml import OxmlElement
        from docx.oxml.ns import qn
        from docx_kit import _insert_ppr_child, _set_flag, _set_val

        ppr = el.find(qn("w:pPr"))
        for old in ppr.findall(qn("w:ind")):
            ppr.remove(old)
        for old in ppr.findall(qn("w:jc")):
            ppr.remove(old)
        jc = OxmlElement("w:jc")
        jc.set(qn("w:val"), "center")
        _insert_ppr_child(ppr, jc)
        for r in el.findall(qn("w:r")):
            rpr = r.find(qn("w:rPr"))
            _set_flag(rpr, "w:i", True)
            _set_val(rpr, "w:sz", 24)

    # =================================================================== CHƯƠNG 1
    h1("CHƯƠNG 1: TỔNG QUAN QUẢN LÝ DỰ ÁN PHẦN MỀM VÀ BỐI CẢNH THƯ VIỆN TRƯỜNG ĐẠI HỌC", new_page=False)
    h2("1.1 Bối cảnh chuyển đổi số trong thư viện trường đại học")
    body("Thư viện trường đại học đang chuyển từ nơi lưu giữ tài liệu sang một dịch vụ thông tin: bạn đọc muốn tra cứu trực tuyến, biết sách còn hay hết trên kệ, gia hạn và nộp phạt mà không phải đến quầy. Luật Thư viện 2019 (Luật số 46/2019/QH14, có hiệu lực từ 01/07/2020) ghi nhận việc ứng dụng công nghệ thông tin trong hoạt động thư viện; đồng thời Nghị định 13/2023/NĐ-CP và Luật Bảo vệ dữ liệu cá nhân (Luật số 91/2025/QH15, có hiệu lực từ 01/01/2026) đặt ra nghĩa vụ khi xử lý dữ liệu của bạn đọc.")
    body("Khác với một trang tra cứu đơn thuần, hệ thống quản lý thư viện gắn với các nghiệp vụ có ràng buộc và có tiền: hạn mức mượn, hạn trả, khoản phạt, hàng đợi đặt trước, thanh toán trực tuyến, cùng dữ liệu cá nhân của hàng nghìn bạn đọc. Thực trạng trong bài toán đặt ra là thư viện ghi sổ tay: thủ thư mất khoảng 3 phút cho mỗi lượt mượn trả, tính phạt thủ công dễ sai, bạn đọc không biết sách còn hay hết, báo cáo làm tay mất nhiều giờ mỗi tháng (đây là các giả định của đề tài, chưa đo ở một thư viện thật). Vì vậy dự án cần phương pháp luận Quản lý Dự án Phần mềm (Software Project Management, SPM) chuẩn hoá, dựa trên PMBOK của PMI kết hợp Agile/Scrum.")
    h2("1.2 Phạm vi nghiệp vụ core của hệ thống Quản lý Thư viện")
    body("ULS được thiết kế để bao phủ vòng đời của một cuốn sách trong thư viện và vòng đời trải nghiệm của bạn đọc, gồm 4 khối chức năng trung tâm:")
    bullet("**Quản lý danh mục sách:** đầu sách, tác giả, thể loại, bản sao vật lý có mã vạch và vị trí kệ; nhập hàng loạt theo ISBN (Google Books) hoặc từ tệp CSV, xlsx có xem trước; in nhãn mã vạch.")
    bullet("**Quản lý bạn đọc và tài khoản:** đăng ký, ba vai trò (Reader, Librarian, Admin), khoá và mở thẻ, hồ sơ cá nhân, quên và đặt lại mật khẩu qua email, thủ thư tạo bạn đọc tại quầy, in thẻ bạn đọc.")
    bullet("**Mượn, trả, đặt trước và phạt:** cho mượn tại quầy bằng mã vạch, nhận trả, gia hạn, báo mất, tính phạt theo ngày lịch; đặt trước với hàng đợi và giữ bản sao 3 ngày; thông báo và email nhắc hạn; thu phạt bằng tiền mặt hoặc nộp trực tuyến qua VNPay.")
    bullet("**Tra cứu, thống kê và trí tuệ nhân tạo:** tìm kiếm theo tiêu đề, tác giả, thể loại, ISBN; bốn báo cáo thống kê và xuất CSV, Excel; gợi ý sách cá nhân hoá và dự báo nguy cơ trả trễ hiển thị cho thủ thư khi cho mượn.")
    h2("1.3 Phương pháp luận Quản lý Dự án ứng dụng (PMBOK và mô hình lai Agile/Waterfall)")
    body("Dự án áp dụng mô hình lai. Phần lập kế hoạch và kiểm soát theo PMBOK: Project Charter, WBS, sơ đồ mạng và đường găng (CPM), sổ rủi ro, đường cơ sở, theo dõi bằng EVA và quy trình kiểm soát thay đổi (báo cáo LAB 1 đến 3). Phần phát triển theo Scrum: backlog 37 User Story, kế hoạch và đánh giá sprint 2 tuần một lần, mọi thay đổi vào nhánh main đi qua Pull Request có rà soát và CI.")
    body("Với các khối đòi hỏi chính xác về tiền và dữ liệu cá nhân (quy tắc phạt, thanh toán VNPay, tài khoản và mật khẩu) nhóm đặc tả quy tắc nghiệp vụ trước (BR-01 đến BR-26), kiểm thử biên và chạy e2e trên cơ sở dữ liệu thật, gần với cách làm tuần tự. Với giao diện và mô hình AI nhóm làm lặp ngắn, demo cuối mỗi sprint để nhận phản hồi sớm.")
    h2("1.4 Kiến trúc tổng thể của hệ thống")
    body("ULS gồm ba dịch vụ phía sau một cổng vào: Frontend Next.js 15 (giao diện, tra cứu tối ưu cho công cụ tìm kiếm), Backend NestJS với Prisma và PostgreSQL (toàn bộ nghiệp vụ, xác thực JWT, phân quyền theo vai trò), và AI Service FastAPI với scikit-learn (gợi ý sách, dự báo trả trễ). Hệ thống tích hợp Google Books (dữ liệu sách), Resend (email) và VNPay (thanh toán, môi trường sandbox). Triển khai bằng Docker Compose ở máy cục bộ và trên Vercel, Render, Neon ở môi trường thật; CI/CD bằng GitHub Actions.")
    fig(UML / "architecture.png", "Kiến trúc tổng thể của hệ thống ULS", w=TEXT_W, h=9.0)

    # =================================================================== CHƯƠNG 2
    h1("CHƯƠNG 2: PHÂN TÍCH YÊU CẦU & THIẾT KẾ BIỂU ĐỒ USE CASE HỆ THỐNG THƯ VIỆN")
    h2("2.1 Phân tích các Tác nhân (Actors) trong Hệ thống")
    body("Để xây dựng biểu đồ use case hoàn chỉnh, việc đầu tiên là xác định và phân loại chính xác các tác nhân tương tác với hệ thống. Bảng dưới đây mô tả vai trò và quyền hạn của từng tác nhân (theo SRS 2.0, mục 2.3):")
    actors = [
        ["1", "Khách (chưa đăng nhập)", "External Actor", "Tra cứu và xem chi tiết sách công khai; đăng ký tài khoản; yêu cầu đặt lại mật khẩu qua email."],
        ["2", "Bạn đọc (Reader: sinh viên, giảng viên)", "External Actor", "Đăng nhập; xem sách đang mượn, lịch sử, tiền phạt; tự gia hạn; đặt trước sách hết bản; nhận thông báo; nộp phạt trực tuyến; đánh giá sách; nhận gợi ý; sửa hồ sơ, đổi mật khẩu. Chỉ truy cập dữ liệu của chính mình."],
        ["3", "Thủ thư (Librarian)", "Internal Actor", "Quản lý sách, bản sao, tác giả, thể loại; cho mượn, nhận trả, báo mất, thu phạt tiền mặt; quản lý hàng đợi đặt trước; tạo bạn đọc, khoá và mở thẻ, cấp lại mật khẩu tạm; xuất báo cáo, in thẻ và nhãn, nhập sách từ tệp; xem báo cáo thống kê và dự báo nguy cơ trả trễ."],
        ["4", "Quản trị viên (Admin)", "System Actor", "Toàn bộ quyền của thủ thư; tạo tài khoản Librarian và Admin; cấu hình chính sách mượn theo loại bạn đọc; nhập sách theo ISBN; huấn luyện lại mô hình AI."],
        ["5", "AI Service", "System Partner", "Nhận yêu cầu từ Backend, trả về danh sách gợi ý và xác suất trả trễ; lấy dữ liệu huấn luyện từ Backend qua khoá nội bộ."],
        ["6", "Google Books API", "External Partner", "Cung cấp thông tin sách (tiêu đề, tác giả, mô tả, ảnh bìa) theo ISBN khi nhập hàng loạt."],
        ["7", "Cổng thanh toán VNPay", "External Partner", "Nhận bạn đọc nộp phạt trực tuyến; gọi lại Backend bằng IPN và return URL kèm chữ ký HMAC-SHA512."],
        ["8", "Dịch vụ email Resend", "External Partner", "Nhận yêu cầu gửi email từ Backend: đặt lại mật khẩu, chào mừng, nhắc hạn."],
    ]
    table("Các tác nhân của hệ thống ULS", ["STT", "Tác nhân (Actor)", "Phân loại", "Mô tả vai trò & Quyền hạn"], actors, [1.0, 3.5, 2.5, 9.0], font_pt=11, center_cols={0})

    h2("2.2 Phân tích các Use Case Trung tâm theo Phân hệ")
    body("Hệ thống có nhiều use case tương tác với nhau. Bảng dưới đây tổng hợp các use case trọng tâm, phân theo 6 phân hệ chức năng:")
    ucs = [
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
    table("Các use case trọng tâm theo phân hệ", ["Phân hệ", "Mã UC", "Tên Use Case", "Tác nhân chính", "Mô tả ngắn gọn"], ucs, [1.9, 2.1, 3.1, 2.6, 6.3], font_pt=10)

    h2("2.3 Sơ đồ Use Case Tổng thể (Textual Representation of Use Case Diagram)")
    body("Cấu trúc biểu đồ use case tổng thể của ULS gồm biên giới hệ thống, các tác nhân và các quan hệ <<include>> (bắt buộc), <<extend>> (mở rộng):")
    bullet("**Tác nhân bên ngoài:** Khách, Bạn đọc, Thủ thư, Admin ở phía người dùng (quyền lồng nhau Admin ⊃ Thủ thư ⊃ Bạn đọc); AI Service, Google Books, VNPay, Resend ở phía hệ thống ngoài.")
    bullet("**Biên giới hệ thống (System Boundary):** Hệ thống Quản lý Thư viện Trường Đại học ULS.")
    bullet("**Quan hệ <<include>>:** use case 'Cho mượn tại quầy' <<include>> 'Kiểm tra điều kiện mượn (BR-01 đến BR-05)' và <<include>> 'Dự báo nguy cơ trả trễ' (AI, hết thời hạn 2 giây thì bỏ qua). 'Nộp phạt trực tuyến' <<include>> 'Xác minh chữ ký HMAC-SHA512'. 'Nhập sách hàng loạt' <<include>> 'Tra cứu Google Books'.")
    bullet("**Quan hệ <<extend>>:** 'Nhận trả sách' được <<extend>> bởi 'Tạo khoản phạt' khi trả trễ và bởi 'Giữ bản sao cho người đặt trước' khi có hàng đợi. 'Đặt trước sách' được <<extend>> khi sách hết bản. 'Gia hạn' bị từ chối khi quá hạn hoặc còn nợ phạt.")
    body("Các biểu đồ use case của hệ thống (tổng quan, bạn đọc, thủ thư và quản trị):")
    fig(UML / "use-case-overview.png", "Use case tổng quan của hệ thống ULS", w=10.0, h=21.0)
    fig(UML / "use-case-reader.png", "Use case của bạn đọc", w=8.5, h=13.0)
    fig(UML / "use-case-staff.png", "Use case của thủ thư và quản trị viên", w=11.5, h=15.0)

    h2("2.4 Đặc tả chi tiết use case trọng tâm: UC-LOAN-01 (Cho mượn tại quầy)")
    body("Tên Use Case: Cho mượn sách tại quầy (kèm dự báo nguy cơ trả trễ).")
    body("Mục tiêu: cho phép thủ thư lập phiếu mượn nhanh và đúng quy định bằng mã vạch bản sao và mã bạn đọc.")
    body("Tác nhân chính: Thủ thư. Tác nhân phụ: AI Service, Bạn đọc (người nhận sách).")
    body("Điều kiện tiên quyết (Pre-conditions): thủ thư đã đăng nhập; bản sao có mã vạch hợp lệ; bạn đọc có tài khoản đang hoạt động.")
    body("Luồng sự kiện chính (Basic Flow):")
    for t in [
        "**Bước 1:** Thủ thư mở màn hình Quầy mượn trả, quét hoặc nhập mã vạch bản sao và mã bạn đọc.",
        "**Bước 2:** Hệ thống tra cứu bản sao và bạn đọc, hiển thị tên sách, tình trạng bản sao, hạn mức còn lại của bạn đọc.",
        "**Bước 3:** Thủ thư bấm 'Cho mượn'.",
        "**Bước 4:** Hệ thống khoá hàng bạn đọc và kiểm tra BR-01 đến BR-05: thẻ không bị khoá, chưa vượt hạn mức, không có sách quá hạn, không nợ phạt, bản sao đang sẵn sàng.",
        "**Bước 5:** Hệ thống gọi AI Service lấy xác suất trả trễ (chờ tối đa 2 giây).",
        "**Bước 6:** Trong một giao dịch cơ sở dữ liệu, hệ thống tạo phiếu ACTIVE với hạn trả = hôm nay + số ngày của chính sách, chuyển bản sao sang BORROWED; nếu bản sao đang giữ cho chính bạn đọc này thì đặt trước chuyển sang FULFILLED.",
        "**Bước 7:** Hệ thống hiển thị phiếu mượn, hạn trả và điểm nguy cơ trả trễ (màu theo mức).",
    ]:
        step(t)
    body("Luồng ngoại lệ (Exception Flows):")
    for t in [
        "**A1 (Vượt hạn mức):** bạn đọc đã mượn đủ số cuốn, hệ thống trả 409 với mã LOAN_LIMIT_REACHED, không tạo phiếu.",
        "**A2 (Còn sách quá hạn hoặc nợ phạt):** hệ thống trả 409 với mã HAS_OVERDUE_LOAN hoặc UNPAID_FINE; thủ thư hướng dẫn bạn đọc trả sách hoặc nộp phạt trước.",
        "**A3 (Bản sao không sẵn sàng):** bản sao đang được mượn hoặc đang giữ cho người khác, hệ thống trả 409 với mã COPY_NOT_AVAILABLE hoặc COPY_HELD.",
        "**A4 (Thẻ bị khoá):** hệ thống trả 403 với mã ACCOUNT_LOCKED.",
        "**A5 (AI không phản hồi):** sau 2 giây hệ thống vẫn tạo phiếu và để điểm nguy cơ trống (null); việc mượn không bị chặn bởi AI.",
        "**A6 (Hai thủ thư thao tác đồng thời):** chỉ một yêu cầu thành công, yêu cầu còn lại nhận mã lỗi nghiệp vụ tương ứng (khoá hàng và cập nhật có điều kiện).",
    ]:
        step(t)

    # =================================================================== CHƯƠNG 3
    h1("CHƯƠNG 3: CẤU TRÚC PHÂN CHIA CÔNG VIỆC (WBS THEO CHỨC NĂNG) HỆ THỐNG THƯ VIỆN")
    h2("3.1 Nguyên tắc xây dựng WBS chức năng cho dự án phần mềm thư viện")
    body("WBS được xây dựng theo hướng tiếp cận chức năng (Functional-based WBS), phân rã 4 cấp: Level 1 (hệ thống) → Level 2 (phân hệ chức năng) → Level 3 (khối chức năng nghiệp vụ) → Level 4 (gói công việc chi tiết). Bảng dưới đây là WBS chi tiết của hệ thống ULS. Các hạng mục 1.3.2.2 và toàn bộ phân hệ 1.4 được bổ sung sau đường cơ sở 1.0 của báo cáo LAB (qua quy trình thay đổi) và hiện đã chạy thật.")
    w = [
        ["1.0", "HỆ THỐNG QUẢN LÝ THƯ VIỆN TRƯỜNG ĐẠI HỌC (ULS)", "L1", "Hệ thống web chạy thật gồm Frontend, Backend, AI Service và cơ sở dữ liệu."],
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
        ["1.7.2", "Khối Bảo mật và bảo vệ dữ liệu bạn đọc", "L3", "Chi tiết ở Chương 4."],
        ["1.7.3", "Khối Kiểm thử và chất lượng", "L3", "Kiểm chứng bằng ca kiểm thử tự động."],
        ["1.7.3.1", "Xây dựng kiểm thử đơn vị, e2e trên cơ sở dữ liệu thật, kiểm thử đua", "L4", "Ngưỡng coverage 80% dòng và 75% nhánh trong CI."],
    ]
    table("WBS theo chức năng của hệ thống ULS", ["Mã WBS", "Tên hạng mục / gói công việc (WBS Element)", "Cấp", "Mô tả nội dung đầu ra (Deliverables)"], w, [1.9, 6.1, 1.3, 6.7], font_pt=10, center_cols={2})
    h2("3.2 Đối chiếu với WBS theo vòng đời trong báo cáo thực hành")
    body("Báo cáo thực hành LAB dùng WBS theo vòng đời (7 pha, 20 gói công việc mã A đến S) để lập lịch và đo EVA. Hai cách phân rã mô tả cùng một sản phẩm nhưng theo hai trục khác nhau: WBS chức năng trả lời 'xây cái gì', WBS vòng đời trả lời 'làm khi nào và ai làm'. Bảng đối chiếu:")
    mapping = [
        ["1.1 Tài khoản và Phân quyền", "4.1.1 Backend nền (H); 4.2.1 Frontend khung (J)"],
        ["1.2 Danh mục Sách và Bản sao", "4.1.1 Backend nền (H); 4.2.1 Frontend khung, kho (J)"],
        ["1.3 Mượn trả và Phạt (trừ 1.3.2.2)", "4.1.2 Backend mượn trả (I); 4.2.2 Frontend quầy (K)"],
        ["1.4 Đặt trước và Thông báo; 1.3.2.2 VNPay", "Bổ sung sau đường cơ sở 1.0, chưa nằm trong 20 gói"],
        ["1.5 Tra cứu, Báo cáo, Xuất dữ liệu", "4.1.2 (I); 4.2.1, 4.2.2 (J, K)"],
        ["1.6 Trí tuệ nhân tạo", "3.1.3 Thiết kế mô hình AI (G); 4.3.1 AI (L); 4.3.2 Tích hợp (M)"],
        ["1.7 Hạ tầng, Bảo mật, Chất lượng", "1.1.2 Dựng môi trường (B); 5.1.1, 5.1.2 Kiểm thử (N, O); 6.1.1, 6.1.2 Docker, cloud (Q, P)"],
    ]
    table("Đối chiếu WBS chức năng với WBS theo vòng đời", ["Phân hệ chức năng (Chương 3)", "Gói công việc theo vòng đời (báo cáo LAB)"], mapping, [6.2, 9.8], font_pt=10)

    # =================================================================== CHƯƠNG 4
    h1("CHƯƠNG 4: PHÂN TÍCH CHUYÊN SÂU RỦI RO BẢO MẬT DỮ LIỆU BẠN ĐỌC VÀ CHUYỂN HOÁ BẢO MẬT VÀO WBS")
    h2("4.1 Bối cảnh rủi ro bảo mật dữ liệu bạn đọc")
    body("ULS lưu dữ liệu cá nhân của bạn đọc: họ tên, email, mã sinh viên hoặc giảng viên, loại bạn đọc, mật khẩu (chỉ dạng băm bcrypt), lịch sử mượn trả (phản ánh sở thích đọc), khoản phạt và giao dịch thanh toán. Hệ thống không lưu số thẻ ngân hàng vì việc nhập thẻ diễn ra trên trang của VNPay. Dù không chứa dữ liệu nhạy cảm như bệnh án hay sinh trắc học, khối dữ liệu này đủ để bị lợi dụng cho lừa đảo hoặc chiếm tài khoản, và việc xử lý nó phải tuân thủ quy định về dữ liệu cá nhân.")
    body("Các mối đe doạ đáng chú ý nhất đối với hệ thống gồm:")
    bullet("**Rò rỉ dữ liệu (Data Breach):** kẻ tấn công khai thác lỗ hổng truy vấn hoặc cấu hình để đọc hồ sơ bạn đọc.")
    bullet("**Chiếm tài khoản (Account Takeover):** đoán mật khẩu, tái sử dụng mật khẩu bị lộ, đánh cắp JWT; tài khoản thủ thư hoặc Admin bị chiếm sẽ gây hậu quả lớn hơn nhiều.")
    bullet("**Rủi ro từ con người (Insider Threat):** nhân sự có quyền tra cứu hồ sơ bạn đọc không cần thiết cho công việc, hoặc dùng quyền thủ thư sai mục đích.")
    bullet("**Giả mạo thanh toán và tấn công qua API bên thứ ba:** gọi giả IPN, sửa số tiền, phát lại giao dịch để gạch nợ phạt trái phép; khoá API Resend hoặc VNPay bị lộ.")
    bullet("**Tệp nhập, xuất độc hại:** tệp CSV hoặc xlsx chứa công thức độc hại (formula injection), tệp nén bất thường khi nhập sách hàng loạt.")
    h2("4.2 Phân tích rủi ro tuân thủ pháp lý")
    body("Khung pháp lý liên quan đến một hệ thống thư viện trường đại học gồm:")
    bullet("**Nghị định 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân và Luật Bảo vệ dữ liệu cá nhân (Luật số 91/2025/QH15, hiệu lực 01/01/2026):** quy định quyền của chủ thể dữ liệu (được biết, đồng ý, truy cập, chỉnh sửa, xoá, rút lại sự đồng ý), nghĩa vụ thông báo mục đích xử lý, bảo vệ dữ liệu và lập hồ sơ đánh giá tác động xử lý dữ liệu cá nhân (DPIA).")
    bullet("**Luật Thư viện 2019:** quy định về bảo đảm quyền của người sử dụng thư viện trong đó có bảo mật thông tin cá nhân của bạn đọc.")
    bullet("**Luật An ninh mạng 2018 và Nghị định 85/2016/NĐ-CP:** yêu cầu xác định cấp độ an toàn hệ thống thông tin và áp dụng biện pháp bảo vệ tương ứng (theo TCVN 11930:2017); với hệ thống thư viện của trường, dự kiến cấp độ thấp (cấp độ 2), cần được cơ quan chủ quản của trường xác nhận.")
    body("Lưu ý: các trích dẫn pháp luật ở trên do nhóm tổng hợp phục vụ học phần, cần đối chiếu văn bản hiện hành trước khi áp dụng thực tế.")
    h2("4.3 Bảng ma trận phân tích rủi ro bảo mật và pháp lý (Risk Matrix)")
    body("Bảng đánh giá theo phương pháp định lượng: Mức rủi ro = Xác suất (P, thang 1 đến 5) x Ảnh hưởng (I, thang 1 đến 5). Thang bốn bậc: Rất cao từ 15, Cao từ 10 đến 14, Trung bình từ 5 đến 9, Thấp dưới 5 (chi tiết hơn thang ba bậc của báo cáo LAB vì cần phân biệt rủi ro bảo mật).")
    risks = [
        ["R-SEC-01", "Rò rỉ dữ liệu do lỗi truy vấn hoặc cấu hình", "2", "5", "Cao (10)", "Prisma tham số hoá, kiểm tra đầu vào (class-validator, từ chối trường lạ và ký tự NUL), CORS theo danh sách trắng, HTTPS, header bảo mật; kiểm thử tự động cho các lỗi đã biết."],
        ["R-SEC-02", "Chiếm tài khoản (đoán mật khẩu, lộ JWT)", "3", "4", "Cao (12)", "bcrypt, giới hạn 10 lần đăng nhập mỗi phút, JWT hạn 24 giờ và đọc lại tài khoản mỗi yêu cầu, thu hồi phiên khi đặt lại mật khẩu, token đặt lại chỉ lưu SHA-256 và dùng một lần, mật khẩu tạm buộc đổi."],
        ["R-SEC-03", "Lạm quyền của nhân sự (Insider Threat)", "3", "4", "Cao (12)", "RBAC trên mọi API ghi; thủ thư không sửa được tài khoản nhân sự; không tự khoá chính mình; bạn đọc chỉ thấy dữ liệu của mình. Còn thiếu nhật ký truy cập hồ sơ (audit log), đưa vào WBS 1.7.2.7."],
        ["R-SEC-04", "Giả mạo hoặc phát lại giao dịch VNPay", "2", "5", "Cao (10)", "Kiểm tra chữ ký HMAC-SHA512 ở IPN và return, tính lại số tiền ở máy chủ, xử lý idempotent, chặn thu trùng, gắn cờ cần hoàn tiền khi lệch."],
        ["R-LEG-01", "Vi phạm quy định bảo vệ dữ liệu cá nhân (không thông báo, không có sự đồng ý, giữ quá lâu)", "3", "4", "Cao (12)", "Bổ sung thông báo xử lý dữ liệu và đồng ý khi đăng ký, chính sách thời hạn lưu, quy trình xuất và xoá dữ liệu theo yêu cầu, hồ sơ DPIA (WBS 1.7.2.6 và 1.7.2.8). Hiện hồ sơ cá nhân cho phép bạn đọc xem và sửa dữ liệu của mình."],
        ["R-OPS-01", "Gián đoạn dịch vụ (hạ tầng miễn phí ngủ, quá tải)", "4", "3", "Cao (12)", "Giới hạn tần suất, kiểm tra sức khoẻ /health, AI có phương án dự phòng, sao lưu Neon và quy trình khôi phục, thông báo hạn chế với khách hàng."],
        ["R-SUP-01", "Lộ khoá hoặc gián đoạn dịch vụ bên thứ ba (Resend, VNPay, Google Books)", "2", "4", "Trung bình (8)", "Khoá chỉ nằm trong biến môi trường; thiếu khoá thì tính năng tắt chứ không lỗi; Idempotency-Key khi gọi Resend; endpoint nội bộ cần khoá X-Internal-Key."],
        ["R-DAT-01", "Tệp nhập, xuất độc hại", "3", "3", "Trung bình (9)", "Chống formula injection khi xuất CSV; nhận diện loại tệp bằng magic bytes, giới hạn kích thước và số dòng, từ chối macro và tệp nén bất thường."],
    ]
    table("Ma trận rủi ro bảo mật và pháp lý của ULS", ["Mã", "Tên rủi ro", "P", "I", "Mức", "Biện pháp giảm thiểu và kiểm soát"], risks, [1.7, 3.5, 0.7, 0.7, 1.8, 7.6], font_pt=9.5, center_cols={2, 3})
    h2("4.4 Chuyển hoá bảo mật và pháp lý vào cấu trúc WBS bổ sung (Security-Embedded WBS)")
    body("Bảo mật không phải việc 'làm sau' mà được đưa vào WBS ngay từ khâu thiết kế (Security by Design, Compliance by Design). Các hạng mục chuyên biệt về an toàn thông tin và tuân thủ thuộc khối 1.7.2 của WBS Chương 3, kèm hiện trạng thực hiện:")
    secwbs = [
        ["1.7.2.1", "Xác thực và quản lý phiên", "bcrypt, JWT hạn 24 giờ, đọc lại tài khoản mỗi yêu cầu, thu hồi phiên, giới hạn tần suất theo IP.", "Đã làm"],
        ["1.7.2.2", "Phân quyền RBAC và cách ly dữ liệu bạn đọc", "Kiểm tra vai trò trên mọi API ghi; bạn đọc chỉ truy cập dữ liệu của mình; bảo vệ tài khoản nhân sự.", "Đã làm"],
        ["1.7.2.3", "Kiểm tra đầu vào và chống tấn công phổ biến", "Tham số hoá truy vấn, từ chối trường lạ và ký tự NUL, chống XSS và formula injection, kiểm tra tệp tải lên.", "Đã làm"],
        ["1.7.2.4", "Bảo mật thanh toán", "Ký và kiểm tra HMAC-SHA512, tính lại số tiền ở máy chủ, IPN idempotent, chặn thu trùng.", "Đã làm"],
        ["1.7.2.5", "Quản lý bí mật và cấu hình", "Khoá chỉ trong biến môi trường, CORS danh sách trắng, header bảo mật, khoá nội bộ cho API huấn luyện.", "Đã làm"],
        ["1.7.2.6", "Thông báo xử lý dữ liệu, đồng ý và quyền của chủ thể dữ liệu", "Văn bản thông báo mục đích xử lý, đồng ý khi đăng ký, quy trình xuất và xoá dữ liệu theo yêu cầu, thời hạn lưu.", "Đề xuất"],
        ["1.7.2.7", "Nhật ký kiểm toán và giám sát", "Ghi lại ai truy cập hồ sơ bạn đọc và thao tác nhạy cảm; cảnh báo bất thường.", "Đề xuất"],
        ["1.7.2.8", "Kiểm thử an toàn thông tin và hồ sơ DPIA", "Quét mã nguồn tĩnh (SAST) trong CI, kiểm thử xâm nhập độc lập, hồ sơ đánh giá tác động.", "Một phần (có e2e phân quyền)"],
    ]
    table("Các hạng mục WBS về bảo mật và tuân thủ", ["Mã WBS", "Hạng mục bảo mật và tuân thủ", "Mô tả nội dung chi tiết", "Hiện trạng"], secwbs, [1.7, 4.0, 7.6, 2.7], font_pt=10)

    # =================================================================== CHƯƠNG 5
    h1("CHƯƠNG 5: MÔ HÌNH QUẢN TRỊ VẬN HÀNH VÀ KẾ HOẠCH TRIỂN KHAI THỰC THI DỰ ÁN")
    h2("5.1 Lộ trình triển khai dự án")
    body("Dự án được lên kế hoạch trong 16 tuần (21/09/2026 đến 10/01/2027) với 5 giai đoạn trọng tâm, ngân sách cơ sở 28,30 triệu đồng (566 giờ công) và dự phòng quản lý 2,83 triệu đồng:")
    bullet("**Giai đoạn 1 (Tuần 1 đến tuần 3): Khởi tạo và phân tích.** Lập Charter, SOW, kế hoạch truyền thông, dựng môi trường; khảo sát nghiệp vụ, hoàn thiện SRS và 20 User Story. Mốc M1 (tuần 2): duyệt SOW; M2 (tuần 3): duyệt SRS.")
    bullet("**Giai đoạn 2 (Tuần 3 đến tuần 5): Thiết kế.** Thiết kế kiến trúc, cơ sở dữ liệu 3NF, đặc tả API, giao diện và mô hình AI. Mốc M3 (tuần 5): duyệt thiết kế.")
    bullet("**Giai đoạn 3 (Tuần 5 đến tuần 12): Phát triển phân hệ lõi.** Backend nền, Backend mượn trả và phạt, Frontend, mô hình AI. Mốc M4 (tuần 9): lõi chạy đầu-cuối; M5 (tuần 12): AI đạt ngưỡng chỉ số.")
    bullet("**Giai đoạn 4 (Tuần 12 đến tuần 15): Tích hợp, kiểm thử và triển khai.** Tích hợp Backend, AI, Frontend; kiểm thử hệ thống và UAT với thủ thư đại diện; Docker, CI/CD, triển khai cloud, đào tạo. Mốc M6 (tuần 14): bản dựng ổn định; M7 (tuần 15): qua UAT và lên cloud.")
    bullet("**Giai đoạn 5 (Tuần 15 đến tuần 16): Nghiệm thu và bàn giao.** Biên bản nghiệm thu, báo cáo cuối, chuyển giao tài liệu và vận hành. Mốc M8 (tuần 16): nghiệm thu.")
    body("Các phân hệ mở rộng (đặt trước, thông báo, thanh toán VNPay) được làm sau mốc nghiệm thu đường cơ sở và đi qua quy trình kiểm soát thay đổi.")
    h2("5.2 Bộ chỉ số Đánh giá Hiệu quả Dự án (KPIs & Metrics)")
    body("Hiệu quả của dự án được đo bằng các chỉ số định lượng sau; cột Hiện trạng ghi đúng cái đã đo hoặc kiểm tra được và cái chưa đo:")
    kpis = [
        ["Thời gian xử lý một lượt mượn trả", "Giảm từ khoảng 3 phút xuống dưới 60 giây (mục tiêu G2)", "Chưa đo với thủ thư thật; thao tác bằng mã vạch đã có"],
        ["Hiệu năng tra cứu", "Tìm kiếm p95 dưới 1 giây; API nghiệp vụ p95 dưới 2 giây; trang đầu dưới 3 giây trên 4G", "Có chỉ mục pg_trgm, báo cáo gộp bằng SQL; đo trên bộ dữ liệu 1.000 đầu sách là chỉ tiêu"],
        ["Chất lượng mã nguồn", "Coverage từ 80% dòng, 75% nhánh; CI xanh trước khi gộp", "Ngưỡng được ép trong CI; khoảng 285 ca unit và 200 ca e2e, 26 ca AI"],
        ["Chất lượng mô hình AI", "Precision@5 từ 0,15; ROC-AUC từ 0,70", "Đạt: Precision@5 = 0,309; ROC-AUC = 0,788 (lần huấn luyện gần nhất)"],
        ["An toàn và tuân thủ", "Không có sự cố lộ dữ liệu; không còn lỗi mức Nghiêm trọng đang mở; hoàn tất đồng ý và DPIA trước khi vận hành với dữ liệu thật", "Chưa vận hành dữ liệu thật; WBS 1.7.2.6 đến 1.7.2.8 còn lại là việc cần làm"],
        ["Mức sử dụng", "Từ 60% phiếu mượn nhập qua hệ thống sau 2 tuần chạy thật", "Chưa vận hành thật nên chưa đo"],
        ["Giá trị tài chính (giả định)", "NPV 3 năm dương; hoàn vốn dưới 1 năm", "Theo mô hình: NPV 112,52 triệu đồng, ROI 464%, hoàn vốn khoảng 9 tháng"],
    ]
    table("Bộ chỉ số đánh giá hiệu quả dự án", ["Chỉ số", "Chỉ tiêu", "Hiện trạng"], kpis, [4.0, 6.3, 5.7], font_pt=10)
    h2("5.3 Mô hình vận hành và hỗ trợ")
    bullet("**Môi trường:** Vercel (Frontend và chuyển tiếp /api), Render (Backend và AI Service), Neon (PostgreSQL); môi trường cục bộ dựng bằng Docker Compose.")
    bullet("**Quy trình phát hành:** nhánh riêng, Pull Request có rà soát, CI chạy 4 job (backend, ai-service, frontend, compose-smoke) rồi mới triển khai khi gộp vào main; muốn quay lại bản trước thì triển khai lại bản ổn định gần nhất.")
    bullet("**Giám sát và sao lưu:** điểm kiểm tra /health kiểm cả cơ sở dữ liệu; Neon sao lưu hằng ngày; gói miễn phí ngủ sau 15 phút không dùng nên lần gọi đầu có thể chậm, backend tự giải phóng việc tồn đọng khi được gọi lại.")
    bullet("**Vai trò vận hành:** thủ thư đại diện là đầu mối nghiệp vụ; nhóm phát triển xử lý lỗi theo mức độ (Nghiêm trọng trong ngày, Cao trong sprint); mọi thay đổi phạm vi qua phiếu Change Request.")

    # =================================================================== KẾT LUẬN
    h1("KẾT LUẬN VÀ KIẾN NGHỊ")
    body("Báo cáo nghiên cứu đề tài 'Quản lý dự án phần mềm Quản lý Thư viện Trường Đại học (ULS)' đã vận dụng các kiến thức quản lý dự án phần mềm vào một sản phẩm có thật: từ bối cảnh và phương pháp luận, phân tích tác nhân và use case, WBS theo chức năng, đến phân tích rủi ro bảo mật dữ liệu bạn đọc và lộ trình triển khai. Việc gắn chặt use case, WBS chức năng và ma trận rủi ro với hiện trạng mã nguồn giúp mọi con số và hạng mục truy được về một phần việc cụ thể.")
    body("Hạn chế cần nói rõ: số liệu chi phí, giờ công và EVA là mô phỏng; chưa vận hành với thủ thư và bạn đọc thật nên các chỉ số về mức sử dụng và hài lòng chưa đo được; ba hạng mục bảo mật và tuân thủ (1.7.2.6 đến 1.7.2.8) mới ở mức đề xuất; thanh toán VNPay mới chạy ở môi trường sandbox.")
    body("Khuyến nghị đối với Ban Quản lý Dự án:")
    bullet("**Về phương pháp luận:** giữ mô hình lai: đặc tả và kiểm chứng chặt cho khối liên quan đến tiền và dữ liệu cá nhân, lặp ngắn cho giao diện và AI.")
    bullet("**Về an toàn thông tin:** hoàn thành nhật ký kiểm toán, quét mã nguồn tĩnh trong CI và kiểm thử xâm nhập độc lập trước khi vận hành với dữ liệu thật.")
    bullet("**Về tuân thủ pháp lý:** lập văn bản thông báo xử lý dữ liệu, cơ chế đồng ý, quy trình xuất và xoá dữ liệu theo yêu cầu và hồ sơ đánh giá tác động; xác nhận cấp độ an toàn hệ thống với cơ quan chủ quản của trường.")

    # =================================================================== TÀI LIỆU THAM KHẢO
    h1("TÀI LIỆU THAM KHẢO")
    refs = [
        "1) TS. Lê Tỷ Khánh, Tài liệu bài giảng và bài tập thực hành Quản lý Dự án Phần mềm.",
        "2) Project Management Institute (PMI), A Guide to the Project Management Body of Knowledge (PMBOK Guide), 7th Edition.",
        "3) IEEE Std 830-1998, Recommended Practice for Software Requirements Specifications.",
        "4) Quốc hội, Luật Thư viện số 46/2019/QH14.",
        "5) Chính phủ, Nghị định 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân; Quốc hội, Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15.",
        "6) Quốc hội, Luật An ninh mạng số 24/2018/QH14; Chính phủ, Nghị định 85/2016/NĐ-CP về bảo đảm an toàn hệ thống thông tin theo cấp độ.",
        "7) Nhóm thực hiện, Tài liệu SRS 2.0, SDD 2.0 và báo cáo thực hành QLDAPM của ULS, https://github.com/khoidev2001/university-library-system.",
        "8) VNPay, Tài liệu tích hợp cổng thanh toán (môi trường sandbox).",
    ]
    for r in refs:
        tpl.add("plain", r)

    # ------------------------------------------------------------------ bảng từ viết tắt (đặt sau tiêu đề của mục)
    abbr = [
        ["ULS", "University Library System, hệ thống quản lý thư viện trường đại học"],
        ["SPM", "Software Project Management, quản lý dự án phần mềm"],
        ["PMBOK", "Project Management Body of Knowledge, bộ tri thức quản lý dự án của PMI"],
        ["WBS", "Work Breakdown Structure, cấu trúc phân chia công việc"],
        ["CPM", "Critical Path Method, phương pháp đường găng"],
        ["EVA", "Earned Value Analysis, phân tích giá trị thu được"],
        ["SRS", "Software Requirements Specification, đặc tả yêu cầu phần mềm"],
        ["SDD", "Software Design Document, tài liệu thiết kế hệ thống"],
        ["UC", "Use Case, ca sử dụng"],
        ["US", "User Story, câu chuyện người dùng"],
        ["BR", "Business Rule, quy tắc nghiệp vụ"],
        ["RBAC", "Role-Based Access Control, phân quyền theo vai trò"],
        ["JWT", "JSON Web Token, mã xác thực không trạng thái"],
        ["API", "Application Programming Interface, giao diện lập trình ứng dụng"],
        ["CI/CD", "Continuous Integration / Continuous Delivery, tích hợp và triển khai liên tục"],
        ["ISBN", "International Standard Book Number, mã số sách tiêu chuẩn quốc tế"],
        ["IPN", "Instant Payment Notification, thông báo thanh toán tức thời của VNPay"],
        ["HMAC", "Hash-based Message Authentication Code, mã xác thực thông điệp dựa trên băm"],
        ["PII", "Personally Identifiable Information, thông tin định danh cá nhân"],
        ["DPIA", "Data Protection Impact Assessment, đánh giá tác động xử lý dữ liệu cá nhân"],
        ["UAT", "User Acceptance Testing, kiểm thử chấp nhận của người dùng"],
        ["KPI", "Key Performance Indicator, chỉ số đánh giá hiệu quả"],
        ["CSDL", "Cơ sở dữ liệu"],
    ]
    rows = [[str(i), a, b] for i, (a, b) in enumerate(abbr, start=1)]
    from docx.shared import Pt  # noqa: F401  (giữ cho nhất quán import của kit)

    before = len(tpl.body)
    tpl.table(["STT", "Từ viết tắt", "Ý nghĩa"], rows, [1.2, 2.8, 12.0], style=style_name, header_fill=None, font_pt=11, center_cols={0})
    # chuyển bảng vừa dựng (và đoạn đệm sau nó) lên ngay sau tiêu đề mục viết tắt
    children = list(tpl.body)
    new_nodes = children[before - 1 : len(children) - 1]  # trừ sectPr cuối
    anchor = abbrev_heading._p
    for node in new_nodes:
        tpl.body.remove(node)
        anchor.addnext(node)
        anchor = node

    doc.core_properties.title = "Báo cáo quản lý dự án phần mềm: Hệ thống Quản lý Thư viện Trường Đại học (ULS)"
    doc.core_properties.author = "Trần Đình Khôi, Nguyễn Như Quỳnh"
    doc.save(output)


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit("usage: fill_course_report.py template.docx output.docx")
    build(Path(sys.argv[1]), Path(sys.argv[2]))
    print("wrote", sys.argv[2])
