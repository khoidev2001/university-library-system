"""Fill LAB 1 sections of the lecturer's report template (Mau_BC_Thuc_Hanh_LAB.docx).

Later LABs append to the same output file. Keeps template formatting: text is
written into the first run of each paragraph/cell, other runs are cleared.
Usage: python fill_lab_report.py <template.docx> <output.docx>
"""
from __future__ import annotations

import copy
import sys
from pathlib import Path

from docx import Document
from docx.shared import Cm

UML_DIR = Path(__file__).resolve().parents[1] / "uml"

REPO_URL = "https://github.com/khoidev2001/university-library-system"
SRS_URL = f"{REPO_URL}/blob/main/docs/srs/SRS.docx"

PROJECT_SUMMARY = (
    "Thư viện trường đại học hiện quản lý sách, bạn đọc và mượn/trả chủ yếu bằng sổ sách "
    "hoặc bảng tính, dẫn đến tra cứu chậm, tính phạt sai và không có số liệu thống kê. "
    "Đề tài xây dựng Hệ thống Quản lý Thư viện Trường Đại học (ULS) dạng ứng dụng web nhằm "
    "số hoá toàn bộ quy trình: quản lý đầu sách, tác giả, thể loại và bản sao vật lý có mã vạch; "
    "quản lý bạn đọc (sinh viên, giảng viên); cho mượn tại quầy, trả, gia hạn, báo mất và tự "
    "động tính phạt theo chính sách cấu hình được; tìm kiếm, phân trang; thống kê sách mượn "
    "nhiều, bạn đọc quá hạn, lượt mượn theo tháng, tồn kho theo thể loại. Hệ thống tích hợp hai "
    "mô hình AI: gợi ý sách cá nhân hoá (content-based + collaborative filtering) và dự báo nguy "
    "cơ trả trễ khi cho mượn (Logistic Regression / Random Forest). Công nghệ: Next.js 15 + "
    "TailwindCSS (frontend), NestJS + Prisma + PostgreSQL (backend, JWT, Swagger), FastAPI + "
    "scikit-learn (AI service), Docker Compose, GitHub Actions CI/CD, triển khai Vercel/Render/Neon."
)

ACTORS = [
    "Reader (Bạn đọc — Sinh viên/Giảng viên): đăng ký, đăng nhập; tìm kiếm và xem chi tiết sách; "
    "xem sách đang mượn, lịch sử, tiền phạt; tự gia hạn; đánh giá sách đã mượn; nhận gợi ý AI. "
    "Chỉ truy cập dữ liệu của chính mình.",
    "Librarian (Thủ thư): toàn bộ quyền xem của Reader; CRUD đầu sách, tác giả, thể loại, bản sao; "
    "cho mượn tại quầy bằng mã vạch + mã bạn đọc, nhận trả, báo mất, ghi nhận thu phạt; quản lý "
    "bạn đọc (hồ sơ, khoá/mở thẻ); xem báo cáo thống kê; thấy dự báo nguy cơ trả trễ khi cho mượn.",
    "Admin (Quản trị): toàn bộ quyền Librarian; tạo tài khoản Librarian/Admin; cấu hình chính sách "
    "mượn (số cuốn, hạn, gia hạn, mức phạt) theo loại bạn đọc; nhập sách hàng loạt theo ISBN (Google Books); kích hoạt huấn luyện lại mô hình AI. "
    "Actor phụ (hệ thống ngoài): AI Service, Google Books API.",
]

TEAM = [
    ("Trần Đình Khôi", "Scrum Master / Backend & DevOps", "SRS & Backlog (LAB1), ERD & API (LAB2), NestJS + Prisma (LAB3), Docker & CI/CD (LAB4)", "100%"),
    ("[Họ tên SV 2]", "Frontend & AI/ML", "Actor & NFR (LAB1), UML (LAB2), Next.js UI + AI Service (LAB3), Kiểm thử (LAB4)", "100%"),
]

BACKLOG = [
    ("US01", "As a Reader, I want to đăng ký tài khoản bằng email, mật khẩu, mã SV/GV và loại bạn đọc, so that tôi dùng được thư viện trực tuyến.", "Email/mã duy nhất → 201; trùng → 409; mật khẩu < 8 ký tự → 400; mật khẩu băm bcrypt", "3 pt"),
    ("US02", "As a user, I want to đăng nhập bằng email và mật khẩu, so that hệ thống nhận diện vai trò của tôi.", "Đúng → JWT hạn 24h; sai → 401; tài khoản khoá → 403 ACCOUNT_LOCKED", "2 pt"),
    ("US03", "As a Librarian, I want to thêm/sửa/xoá đầu sách với tác giả và thể loại, so that kho sách luôn đúng thực tế.", "Thiếu tiêu đề → 400; ISBN trùng → 409; xoá sách còn bản đang mượn → 409; Reader → 403", "5 pt"),
    ("US04", "As a Librarian, I want to quản lý bản sao vật lý (mã vạch, trạng thái, kệ), so that biết cuốn nào đang ở đâu.", "Mã vạch duy nhất; bản sao mới AVAILABLE; không đặt AVAILABLE khi đang có phiếu ACTIVE", "3 pt"),
    ("US05", "As a Reader, I want to tìm sách theo tiêu đề/tác giả/thể loại/ISBN và lọc sách còn mượn được, so that tìm nhanh cuốn cần.", "Khớp một phần, không phân biệt hoa thường; lọc thể loại/tác giả/còn sách; phân trang 20; ≤ 1s; không cần đăng nhập", "5 pt"),
    ("US06", "As a Reader, I want to xem chi tiết đầu sách và số bản còn, so that biết có mượn ngay được không.", "Hiển thị 'Còn X/Y bản', tác giả, thể loại, điểm đánh giá TB; không tồn tại → 404", "2 pt"),
    ("US07", "As a Librarian, I want to tạo phiếu mượn bằng mã vạch bản sao + mã bạn đọc, so that cho mượn tại quầy nhanh và đúng quy định.", "Đủ điều kiện → ACTIVE, due_at = hôm nay + loan_days, bản sao BORROWED; vi phạm → 409 với mã LOAN_LIMIT_REACHED / HAS_OVERDUE_LOAN / UNPAID_FINE / COPY_NOT_AVAILABLE / ACCOUNT_LOCKED; 1 transaction; ≤ 3 click", "8 pt"),
    ("US08", "As a Librarian, I want to nhận trả sách theo mã vạch và hệ thống tự tính phạt, so that không tính tay, không bỏ sót.", "Phiếu RETURNED, bản sao AVAILABLE; trễ N ngày → phạt N × fine_per_day hiển thị ngay; không có phiếu ACTIVE → 409", "5 pt"),
    ("US09", "As a Reader, I want to tự gia hạn sách đang mượn, so that không phải đến quầy.", "due_at += renew_extra_days; quá số lần → 409; đã quá hạn → 409; còn phạt → 409; phiếu người khác → 403", "3 pt"),
    ("US10", "As a Reader, I want to xem sách đang mượn, ngày hạn và lịch sử, so that trả đúng hạn.", "Số ngày còn lại; quá hạn tô đỏ; lịch sử phân trang; chỉ thấy phiếu của mình", "3 pt"),
    ("US11", "As a Librarian, I want to ghi nhận sách bị mất, so that kho và công nợ được cập nhật đúng.", "Phiếu & bản sao LOST; phạt = giá bìa + phạt trễ đến ngày báo; không tính vào 'còn mượn được'", "3 pt"),
    ("US12", "As a Reader I want to xem tiền phạt; as a Librarian I want to ghi nhận đã thu, so that công nợ minh bạch.", "Reader thấy từng khoản + tổng; Librarian bấm 'Đã thu' → paid_at; thu lại → 409; trả hết thì mượn lại được", "3 pt"),
    ("US13", "As a Librarian, I want to tra cứu bạn đọc, xem hồ sơ và khoá/mở thẻ, so that xử lý vi phạm.", "Tìm theo tên/email/mã; hồ sơ gồm sách đang mượn, lịch sử, phạt; khoá → không mượn, không đăng nhập", "5 pt"),
    ("US14", "As an Admin, I want to tạo tài khoản thủ thư, so that nhân viên mới làm việc được.", "Tạo user LIBRARIAN/ADMIN; Librarian gọi → 403; email trùng → 409", "2 pt"),
    ("US15", "As an Admin, I want to cấu hình số cuốn, hạn mượn, gia hạn, mức phạt theo loại bạn đọc, so that đổi quy định không cần sửa code.", "Giá trị nguyên dương, ≤ 0 → 400; phiếu mới dùng chính sách mới, phiếu cũ giữ hạn; Librarian → 403", "3 pt"),
    ("US16", "As a Librarian, I want to xem dashboard thống kê, so that đề xuất mua sách và nhắc bạn đọc.", "Top 10 sách; danh sách quá hạn kèm phạt ước tính; biểu đồ lượt mượn 12 tháng; tồn kho theo thể loại; ≤ 2s; Reader → 403", "5 pt"),
    ("US17", "As a Reader, I want to chấm 1–5 sao sách đã mượn, so that gợi ý chính xác hơn.", "Chỉ sách có phiếu RETURNED; ngoài 1–5 → 400; chấm lại → ghi đè; điểm TB cập nhật", "2 pt"),
    ("US18", "As a Reader, I want to nhận danh sách sách gợi ý theo sở thích, so that khám phá sách phù hợp.", "10 sách, loại trừ đã mượn; có lịch sử → mô hình lai, không → sách mượn nhiều; Precision@5 ≥ 0,15; AI lỗi → 'chưa có gợi ý'; ≤ 3s", "8 pt"),
    ("US19", "As a Librarian, I want to thấy nguy cơ trả trễ khi tạo phiếu mượn, so that nhắc người có nguy cơ cao.", "overdueRisk 0–1 + màu; AI > 2s → phiếu vẫn tạo, risk = null; ROC-AUC ≥ 0,70; lưu vào phiếu", "5 pt"),
    ("US20", "As a Librarian, I want to quản lý danh mục tác giả và thể loại, so that nhập sách nhất quán.", "CRUD; xoá thể loại còn sách → 409 CATEGORY_IN_USE; tên thể loại duy nhất", "2 pt"),
]


def set_text(paragraph, text: str) -> None:
    runs = paragraph.runs
    if not runs:
        paragraph.add_run(text)
        return
    runs[0].text = text
    for run in runs[1:]:
        run.text = ""


def set_cell(cell, text: str) -> None:
    lines = text.split("\n")
    set_text(cell.paragraphs[0], lines[0])
    for extra in cell.paragraphs[1:]:
        set_text(extra, "")
    for line in lines[1:]:
        cell.add_paragraph(line)


def set_picture(paragraph, image: Path, width_cm: float = 16) -> None:
    set_text(paragraph, "")
    paragraph.runs[0].add_picture(str(image), width=Cm(width_cm))


def clone_row(table, template_row):
    new_tr = copy.deepcopy(template_row._tr)
    table._tbl.append(new_tr)
    return table.rows[-1]


def fill(template: Path, output: Path) -> None:
    doc = Document(template)
    paragraphs = doc.paragraphs

    # Cover
    set_text(paragraphs[3], "Đề tài : Đề tài 8 — Phần mềm Quản lý Thư viện Trường Đại học")
    cover = doc.tables[0]
    set_cell(cover.cell(0, 1), "Nhóm [Số nhóm] - Lớp [Tên Lớp/Khóa]")
    set_cell(
        cover.cell(2, 1),
        "1. Trần Đình Khôi - MSSV: 23Q74802012006 (Nhóm trưởng)\n2. [Họ và tên SV 2] - MSSV: [MSSV 2]",
    )
    set_cell(cover.cell(3, 1), f"GitHub: {REPO_URL}")
    set_cell(cover.cell(4, 1), "Demo Web: (cập nhật ở LAB 4)")

    # Part I
    set_text(paragraphs[7], PROJECT_SUMMARY)
    team = doc.tables[1]
    while len(team.rows) > len(TEAM) + 1:
        team._tbl.remove(team.rows[-1]._tr)
    for row, values in zip(team.rows[1:], TEAM):
        for cell, value in zip(row.cells, values):
            set_cell(cell, value)

    # LAB 1 actors
    for para, text in zip(paragraphs[14:17], ACTORS):
        set_text(para, text)

    # LAB 1 backlog table: keep header, rewrite rows
    backlog = doc.tables[2]
    template_row = backlog.rows[1]
    while len(backlog.rows) > 2:
        backlog._tbl.remove(backlog.rows[-1]._tr)
    for i, values in enumerate(BACKLOG):
        row = backlog.rows[1] if i == 0 else clone_row(backlog, template_row)
        for cell, value in zip(row.cells, values):
            set_cell(cell, value)

    set_text(
        paragraphs[19],
        "c) Tài liệu SRS: Link đường dẫn tới file tài liệu đặc tả SRS đầy đủ chuẩn IEEE 830: " + SRS_URL,
    )

    # LAB 2 a) Use Case overview — already drawn in LAB 1
    set_text(
        paragraphs[21],
        "a) Biểu đồ Use Case Tổng Quan: Ba actor chính (Reader, Librarian, Admin) với quyền lồng nhau "
        "Admin ⊃ Librarian ⊃ Reader; hai actor phụ là AI Service và Google Books API. Luồng chính: "
        "thủ thư quét mã vạch + mã bạn đọc → hệ thống kiểm tra chính sách mượn (BR-01…BR-05) → gọi AI "
        "dự báo trả trễ (include) → tạo phiếu; khi nhận trả trễ, hệ thống tự tạo khoản phạt (extend).",
    )
    set_picture(paragraphs[22], UML_DIR / "use-case-overview.png", width_cm=15)

    doc.save(output)


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit("usage: fill_lab_report.py template.docx output.docx")
    fill(Path(sys.argv[1]), Path(sys.argv[2]))
    print(f"wrote {sys.argv[2]}")
