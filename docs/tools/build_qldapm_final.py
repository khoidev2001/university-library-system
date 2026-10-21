"""Dựng báo cáo Quản lý dự án phần mềm gộp (LAB 1 đến 3, phân tích, thiết kế hệ thống, demo) từ mẫu của giảng viên.

Nguồn: docs/pm/QLDAPM_Report.md (LAB 1 đến 3, đã đối chiếu với Excel), docs/srs/SRS.md, docs/design/SDD.md, mã nguồn backend,
ảnh trong docs/pm/figures, docs/uml, docs/erd, docs/report/screenshots, cùng văn bản ở qldapm_final_data.py.
Định dạng theo quy tắc của nhóm: Times New Roman 13 (đề mục lớn 14 căn giữa), tiêu đề bảng và hình cỡ 12 in đậm căn giữa nằm
dưới, danh sách dùng dấu -, chữ thể hiện mã dùng Consolas.

Usage: python build_qldapm_final.py <mẫu z0.docx> <đầu ra.docx>
"""
from __future__ import annotations

import copy
import json
import re
import sys
from pathlib import Path

from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Pt
from docx.text.paragraph import Paragraph

import api_catalog
import qldapm_final_data as D
import qldapm_md
from docx_kit import Template, _insert_ppr_child, _set_flag, _set_val, force_font, rebuild_label_line

ROOT = Path(__file__).resolve().parents[2]
PM_FIG = ROOT / "docs" / "pm" / "figures"
UML = ROOT / "docs" / "uml"
ERD = ROOT / "docs" / "erd" / "erd.png"
SHOT = ROOT / "docs" / "report" / "screenshots"
SRS = ROOT / "docs" / "srs" / "SRS.md"
MD_PATH = ROOT / "docs" / "pm" / "QLDAPM_Report.md"
API_SNAPSHOT = ROOT / "docs" / "tools" / "data" / "api_snapshot.json"

TEXT_W = 16.0
LAND_W = 24.6
TABLE_STYLE = "Table Grid"
BOLD_FIRST_HEADERS = {"Hạng mục", "Thuộc tính", "Trường", "Tiêu chí", "Trường thông tin"}

# Thay chữ trong văn bản lấy từ Markdown (số liệu cũ, tham chiếu mơ hồ)
REPL = [
    ("48 API, 160 kiểm thử tự động đạt 100%", "78 API, 576 kiểm thử tự động đạt 100% ở lần chạy CI gần nhất"),
    ("bảng 1.9 đến 1.11", "{t:md:1.9#2} đến {t:md:1.11#2}"),
]

FIG_SIZES = {  # tên tệp: (rộng tối đa cm, cao tối đa cm)
    "stakeholders.png": (11.5, 9.0), "org.png": (14.5, 8.5), "wbs_tree.png": (24.0, 11.5), "cashflow.png": (12.5, 7.5),
    "network.png": (24.0, 14.0), "gantt.png": (24.0, 11.5), "compress_options.png": (13.0, 8.0),
    "compress_gantt.png": (24.0, 12.5), "risk_matrix.png": (11.0, 9.0), "eva_wp.png": (15.0, 9.0),
    "eva_curves.png": (14.0, 8.0), "defect_lifecycle.png": (15.0, 7.0),
}


class Report:
    def __init__(self, template: Path, labels: dict[str, str] | None):
        self.tpl = Template(template)
        self.tpl.default_half_pt = 26
        self.tpl.force_font_pt = 13
        self.tpl.center_all_cells = True
        self.dash = self.tpl.make_dash_list()
        self.L = labels or {}
        self.reg: dict[str, str] = {}
        self.chap = ""          # nhãn chương hiện tại: "2" hoặc "A"
        self.chap_n = 0
        self.c2 = self.c3 = self.c4 = 0
        self.tn = self.fn = 0
        self.mode = "P"
        self.forced = False
        self.buf: list = []     # đề mục chờ: để đề mục đi cùng nội dung ở cùng kiểu trang
        self.last_head = ""
        self.warn: list[str] = []
        self.api_snapshot = json.loads(API_SNAPSHOT.read_text(encoding="utf-8"))["endpoints"]

    # ------------------------------------------------------------------ tham chiếu
    def resolve(self, text: str) -> str:
        def sub(m):
            kind, key = m.group(1), m.group(2)
            val = self.L.get(f"{kind.upper()}:{key}")
            if val is None:
                self.warn.append(f"{{{kind}:{key}}}")
                val = "?"
            if kind.upper() == "T":
                return ("Bảng " if kind == "T" else "bảng ") + val
            if kind.upper() == "F":
                return ("Hình " if kind == "F" else "hình ") + val
            return val if val.startswith("Chương") else "mục " + val

        return re.sub(r"\{([TtFfSs]):([^}]+)\}", sub, text)

    def mdfix(self, text: str) -> str:
        for a, b in REPL:
            text = text.replace(a, b)
        text = re.sub(r"\b(bảng|Bảng) (\d+\.\d+)", lambda m: "{" + ("T" if m.group(1) == "Bảng" else "t") + ":md:" + m.group(2) + "}", text)
        text = re.sub(r"\b(hình|Hình) (\d+\.\d+)", lambda m: "{" + ("F" if m.group(1) == "Hình" else "f") + ":md:" + m.group(2) + "}", text)
        text = re.sub(r"\b(mục) (\d+(?:\.\d+)+)", lambda m: "{s:md:" + m.group(2) + "}", text)
        return text

    def txt(self, text: str, md: bool = False) -> str:
        return self.resolve(self.mdfix(text) if md else text)

    def register(self, kind: str, key: str | None, value: str) -> None:
        if not key:
            return
        full = f"{kind}:{key}"
        if full in self.reg:
            full = f"{full}#2"
        self.reg[full] = value

    # ------------------------------------------------------------------ chế độ trang
    def go_land(self, forced: bool = False) -> None:
        if self.mode == "P":
            self.tpl.begin_landscape()
            self.mode = "L"
        self.forced = self.forced or forced

    def go_port(self, force: bool = False) -> None:
        if self.mode == "L" and (force or not self.forced):
            self.tpl.end_landscape()
            self.mode = "P"
            self.forced = False

    def flush(self) -> None:
        for fn in self.buf:
            fn()
        self.buf = []

    def avail(self) -> float:
        return LAND_W if self.mode == "L" else TEXT_W

    # ------------------------------------------------------------------ đề mục
    def chapter(self, title: str, key: str | None = None, new_page: bool = True, numbered: bool = True) -> None:
        self.go_port(force=True)
        self.flush()
        self.chap_n += 1
        self.chap = str(self.chap_n)
        self.register("S", key or f"ch{self.chap_n}", f"Chương {self.chap_n}")
        text = f"CHƯƠNG {self.chap_n}: {title}" if numbered else title
        self.c2 = self.c3 = self.c4 = self.tn = self.fn = 0
        self.tpl.add("h1", text, outline=0, page_break_before=new_page, size_half_pt=28, align="center")

    def appendix(self, letter: str, title: str) -> None:
        self.go_port(force=True)
        self.flush()
        self.chap = letter
        self.c2 = self.c3 = self.c4 = self.tn = self.fn = 0
        self.tpl.add("h1", f"PHỤ LỤC {letter}: {title}", outline=0, page_break_before=True, size_half_pt=28, align="center")

    def sec(self, depth: int, title: str, md: str | None = None, key: str | None = None) -> str:
        if depth == 2:
            self.c2 += 1
            self.c3 = self.c4 = 0
            num = f"{self.chap}.{self.c2}"
        elif depth == 3:
            self.c3 += 1
            self.c4 = 0
            num = f"{self.chap}.{self.c2}.{self.c3}"
        else:
            self.c4 += 1
            num = f"{self.chap}.{self.c2}.{self.c3}.{self.c4}"
        if md:
            self.register("S", f"md:{md}", num)
        self.register("S", key, num)
        title = self.txt(title)
        self.last_head = title
        style = {2: dict(bold=True, italic=True), 3: dict(bold=False, italic=True), 4: dict(bold=False, italic=False)}[depth]
        text = f"{num}. {title}"
        self.buf.append(lambda t=text, d=depth, st=style: self.tpl.add("h2", t, outline=d - 1, **st))
        return num

    # ------------------------------------------------------------------ đoạn văn
    def _prep(self) -> None:
        self.go_port()
        self.flush()

    def para(self, text: str, md: bool = False, **kw) -> None:
        self._prep()
        self.tpl.add("body", self.txt(text, md), **kw)

    def bullet(self, text: str, md: bool = False, level: int = 0) -> None:
        self._prep()
        self.tpl.add("body", self.txt(text, md), list_num=self.dash, list_level=level)

    def bullets(self, items, md: bool = False) -> None:
        for it in items:
            self.bullet(it, md)

    def code(self, text: str, title: str) -> None:
        self.table(["Mã"], [[text]], widths=[TEXT_W], caption=title, code=True)

    # ------------------------------------------------------------------ chú thích
    def _style_caption(self, el) -> None:
        ppr = el.find(qn("w:pPr"))
        for tag in ("w:ind", "w:jc", "w:spacing"):
            for old in ppr.findall(qn(tag)):
                ppr.remove(old)
        spacing = OxmlElement("w:spacing")
        spacing.set(qn("w:before"), "60")
        spacing.set(qn("w:after"), "200")
        spacing.set(qn("w:line"), "240")
        spacing.set(qn("w:lineRule"), "auto")
        _insert_ppr_child(ppr, spacing)
        jc = OxmlElement("w:jc")
        jc.set(qn("w:val"), "center")
        _insert_ppr_child(ppr, jc)
        for r in el.findall(qn("w:r")):
            rpr = r.find(qn("w:rPr"))
            for tag in ("w:b", "w:bCs"):
                _set_flag(rpr, tag, True)
            for tag in ("w:i", "w:iCs"):
                _set_flag(rpr, tag, False)
            _set_val(rpr, "w:sz", 24)
            _set_val(rpr, "w:szCs", 24)

    def _last(self):
        return self.tpl.body.find(qn("w:sectPr")).getprevious()

    # ------------------------------------------------------------------ bảng
    @staticmethod
    def plan_widths(header, rows, avail):
        n = len(header)
        mins, avgs = [], []
        for j in range(n):
            col = [header[j]] + [r[j] for r in rows]
            col = [re.sub(r"\*\*|`", "", c) for c in col]
            longest = max((len(w) for c in col for w in c.split()), default=1)
            mins.append(max(1.3, longest * 0.235 + 0.5))
            avgs.append(sum(len(c) for c in col) / len(col))
        if sum(mins) > avail + 0.01:
            return None
        extra = avail - sum(mins)
        weights = [min(a, 90) + 3 for a in avgs]
        tot = sum(weights)
        return [m + extra * w / tot for m, w in zip(mins, weights)]

    def table(self, header, rows, *, caption: str, md: str | None = None, key: str | None = None,
              widths=None, land: bool | None = None, bold_first: bool | None = None, total: bool = False,
              center=None, from_md: bool = False, code: bool = False, groups=None) -> None:
        header = [self.txt(h, from_md) for h in header]
        rows = [[self.txt(c, from_md) for c in r] for r in rows]
        if groups:  # tách bảng quá rộng thành nhiều bảng cùng danh sách hàng
            for gi, cols in enumerate(groups, start=1):
                self.table([header[i] for i in cols], [[r[i] for i in cols] for r in rows],
                           caption=f"{caption} ({gi}/{len(groups)})", md=md if gi == 1 else None, key=key if gi == 1 else None,
                           land=land, bold_first=False, total=total, center=center)
            return
        if bold_first is None:
            bold_first = header[0] in BOLD_FIRST_HEADERS
        need_land = land
        plan = None
        if widths is None:
            plan = self.plan_widths(header, rows, TEXT_W) if not code else [TEXT_W]
            if need_land is None:
                need_land = plan is None
        if need_land is None:
            need_land = sum(widths) > TEXT_W + 0.6
        if self.forced:
            need_land = True
        if need_land:
            self.go_land()
        else:
            self.go_port()
        self.flush()
        avail = self.avail()
        if widths is None:
            plan = self.plan_widths(header, rows, avail) if not code else [avail]
            if plan is None:  # vẫn chật: chia theo độ dài chữ, chấp nhận ngắt từ
                lens = [max(len(re.sub(r"\*\*|`", "", c)) for c in [header[j]] + [r[j] for r in rows]) for j in range(len(header))]
                plan = [avail * (min(x, 60) + 4) / sum(min(y, 60) + 4 for y in lens) for x in lens]
            widths = plan
        elif abs(sum(widths) - avail) > 0.3:
            widths = [w * avail / sum(widths) for w in widths]
        self.tn += 1
        label = f"{self.chap}.{self.tn}"
        if md:
            self.register("T", f"md:{md}", label)
        self.register("T", key, label)
        self.tpl.table(header, rows, widths, style=TABLE_STYLE, header_fill="E7E9F0", gap=False, keep_last=True,
                       bold_first_col=bold_first, total_row=total, center_cols=center or set(), code=code,
                       caption=f"Bảng {label}. {self.txt(caption)}")
        self.tpl.add("body", "", size_half_pt=4)  # đoạn đệm nhỏ để bảng không dính khối kế tiếp
        if need_land and not self.forced:
            pass  # chuyển về dọc khi gặp khối không phải bảng kế tiếp

    # ------------------------------------------------------------------ hình
    def fig(self, path: Path, caption: str, md: str | None = None, key: str | None = None, w: float | None = None,
            h: float | None = None) -> None:
        self._prep()
        dw, dh = FIG_SIZES.get(path.name, (15.0, 12.0))
        if self.mode == "L":
            dw, dh = min(dw if w is None else w, LAND_W - 0.3), min(dh if h is None else h, 14.5)
        else:
            dw, dh = (w if w is not None else min(dw, TEXT_W)), (h if h is not None else min(dh, 19.0))
        self.fn += 1
        label = f"{self.chap}.{self.fn}"
        if md:
            self.register("F", f"md:{md}", label)
        self.register("F", key, label)
        self.tpl.picture(path, dw, f"Hình {label}. {self.txt(caption)}", caption_kind="body", max_h_cm=dh)
        self._style_caption(self._last())

    # ------------------------------------------------------------------ khối Markdown
    def emit_md(self, blocks) -> None:
        for b in blocks:
            if b.kind == "marker":
                if b.text == "landscape":
                    self.go_land(forced=True)
                    self.flush()
                elif b.text == "portrait":
                    self.forced = False
                    self.go_port()
                continue
            if b.kind in ("h2", "h3"):
                parts = len(b.num.split(".")) if b.num else 3
                depth = 2 if b.kind == "h2" else (4 if parts >= 4 else 3)
                self.sec(depth, b.text, md=b.num or None)
            elif b.kind == "p":
                self.para(b.text, md=True)
            elif b.kind in ("li", "oli"):
                self.bullet(b.text, md=True)
            elif b.kind == "img":
                self.fig(PM_FIG / Path(b.path).name, b.caption, md=b.label)
            elif b.kind == "table":
                self.md_table(b)
            else:
                self.warn.append(f"khối không xử lý: {b.kind} {b.text[:30]}")

    def md_table(self, b) -> None:
        caption = b.caption or f"{self.last_head}: thông tin chung"
        extra = list(b.extra)
        if ". " in caption and ("**" in caption or len(caption) > 70):
            caption, _, tail = caption.partition(". ")
            extra.insert(0, tail)
        rows = b.rows
        if b.label == "3.12":  # Test Plan: cập nhật số liệu kiểm thử theo lần chạy CI gần nhất
            rows = [[r[0], D.TEST_PLAN_RESULT] if r[0] == "Kết quả đạt được" else r for r in rows]
        if b.label == "3.11":  # nhật ký thay đổi: thêm đợt mở rộng sau MVP
            rows = rows + [D.CR04_ROW]
        cfg = TCFG.get(b.label, {})
        self.table(b.header, rows, caption=caption, md=b.label or None, from_md=True, **cfg)
        for e in extra:
            self.para(e, md=True)
        if b.label == "1.1":
            self.para(D.CHARTER_NOTE)

    # ------------------------------------------------------------------ danh sách từ SRS
    @staticmethod
    def srs_rows(prefix: str) -> list[list[str]]:
        out = []
        for ln in SRS.read_text(encoding="utf-8").splitlines():
            if ln.startswith(prefix):
                out.append([re.sub(r"\*\*", "", c.strip()) for c in ln.strip().strip("|").split("|")])
        return out


# cấu hình riêng cho một số bảng lấy từ Markdown (nhãn Markdown -> tuỳ chọn); còn lại tự chia độ rộng
TCFG: dict[str, dict] = {
    "1.1": dict(bold_first=True),
    "1.8": dict(land=True, center={0, 2, 3, 4, 5, 6, 7}),
    "1.12": dict(land=True, center={0, 2, 3, 4, 5, 6, 7}),
    "2.2": dict(total=True),
    "2.3": dict(land=True),
    "2.4": dict(land=True),
    "2.6": dict(land=True),
    "2.8": dict(land=True),
    "2.9": dict(land=True),
    "2.14": dict(land=True),
    "3.1": dict(land=True),
    "3.3": dict(land=True),
    "3.4": dict(land=True, groups=[[0, 1, 2, 3, 4, 5], [0, 1, 6, 7, 8, 9, 10]]),
    "3.8": dict(total=False),
    "3.13": dict(land=True),
    "3.14": dict(land=True),
    "3.15": dict(land=True),
}


# ====================================================================== dựng
def build(template: Path, output: Path, labels: dict[str, str] | None = None) -> Report:
    R = Report(template, labels)
    tpl = R.tpl
    doc = tpl.doc
    P = doc.paragraphs

    # ---- bìa (mẫu có hai bản bìa chồng nhau; điền hộp văn bản, bỏ bản thân bài trùng)
    cover = dict(tab_twips=3400, base_indent=700, size_half_pt=26)
    for box in list(doc.element.body.iter(qn("w:txbxContent"))):
        for p_el in box.findall(qn("w:p")):
            para = Paragraph(p_el, P[0]._parent)
            text = para.text
            runs = para.runs
            if text.startswith("QUẢN LÝ DỰ ÁN PHẦN MỀM BẢO HIỂM"):
                runs[0].text = "QUẢN LÝ DỰ ÁN PHẦN MỀM THƯ VIỆN"
                for r in runs[1:]:
                    r.text = ""
            elif text.startswith("CÔNG TY CỔ PHẦN"):
                runs[0].text = "TRƯỜNG ĐẠI HỌC XÂY DỰNG MIỀN TRUNG"
                for r in runs[1:]:
                    r.text = ""
            elif text.startswith("Sinh viên thực hiện"):
                rebuild_label_line(para, "Sinh viên thực hiện:", "Trần Đình Khôi - 23Q74802012006", **cover)
            elif text.startswith("Lớp"):
                rebuild_label_line(para, "Lớp:", "D23CTC2", **cover)
            elif text.startswith("Giảng viên hướng dẫn"):
                rebuild_label_line(para, "Giảng viên hướng dẫn:", "TS. Lê Tỷ Khánh", **cover)
            elif "Tuy Hòa" in text:
                for r in runs:
                    r.text = r.text.replace("Tuy Hòa, Tháng 10-2026", "Đắk Lắk, Tháng 10 năm 2026")
    sect_pr = P[25]._p.find(qn("w:pPr")).find(qn("w:sectPr"))
    P[0]._p.find(qn("w:pPr")).append(sect_pr)
    for idx in range(1, 26):
        P[idx]._p.getparent().remove(P[idx]._p)

    # ---- đoạn mẫu
    tpl.capture("h1", P[33])
    tpl.capture("h2", P[35])
    tpl.capture("body", P[36])
    tpl.capture("bullet", P[40], strip_bold=True)
    tpl.capture("plain", P[130])
    toc_heading, preface_heading, abbrev_heading = P[26], P[28], P[30]
    for heading in (toc_heading, preface_heading, abbrev_heading):
        heading.alignment = WD_ALIGN_PARAGRAPH.CENTER
        for run in heading.runs:
            run.font.size = Pt(14)
    tpl.clear_after(P[32])

    toc_heading._p.addnext(tpl.toc_paragraph("1-2"))
    anchor = preface_heading._p
    for text in D.PREFACE:
        el = tpl.make_para("body", text)
        anchor.addnext(el)
        anchor = el

    md = qldapm_md.parse(MD_PATH)

    def md_range(start_kind, start_num, end_kind="h1"):
        i0 = next(i for i, b in enumerate(md) if b.kind == start_kind and b.num == start_num)
        i1 = next((i for i in range(i0 + 1, len(md)) if md[i].kind == end_kind), len(md))
        return md[i0:i1]

    def md_text(line_prefix_find):
        return next(b.text for b in md if b.kind == "p" and b.text.startswith(line_prefix_find))

    # =================================================================== CHƯƠNG 1
    R.chapter("TỔNG QUAN ĐỀ TÀI VÀ PHÂN CÔNG NHIỆM VỤ", new_page=False)
    R.sec(2, "Bối cảnh chuyển đổi số trong thư viện trường đại học")
    for t in D.CH1_CONTEXT:
        R.para(t)
    R.sec(2, "Phạm vi nghiệp vụ core của hệ thống")
    R.para(D.CH1_SCOPE_INTRO)
    R.bullets(D.CH1_SCOPE)
    R.sec(2, "Phương pháp luận quản lý dự án ứng dụng (PMBOK và mô hình lai Agile - Waterfall)")
    for t in D.CH1_METHOD:
        R.para(t)
    R.sec(2, "Kiến trúc tổng thể của hệ thống")
    R.para(D.CH1_ARCH)
    R.sec(2, "Dự án mô phỏng và sản phẩm thật")
    R.para(md_text("Đề tài xuyên suốt của nhóm"), md=True)
    for t in D.CH1_REAL:
        R.para(t)
    R.sec(2, "Phân công nhiệm vụ và đóng góp")
    R.table(["Thành viên", "Vai trò", "Phần phụ trách chính", "Đóng góp"], D.TEAM_ROWS, caption="Thành viên và phần phụ trách",
            widths=[3.4, 3.4, 7.6, 1.6], center={3})
    R.para(D.TEAM_NOTE)
    R.table(["LAB", "Công việc", "Người làm chính"], D.LAB_TASKS, caption="Phân công chi tiết theo từng LAB", widths=[2.2, 10.6, 3.2],
            center={0, 2})
    R.sec(2, "Cấu trúc báo cáo")
    R.table(["Chương", "Nội dung", "Nhóm việc"], D.STRUCTURE_ROWS, caption="Cấu trúc báo cáo", widths=[3.0, 9.6, 3.4], center={0})

    # =================================================================== CHƯƠNG 2 (LAB 1)
    R.chapter("LAB 1: KHỞI TẠO DỰ ÁN, PHẠM VI VÀ CẤU TRÚC PHÂN RÃ CÔNG VIỆC")
    R.sec(2, "Mục tiêu và nhiệm vụ của LAB 1")
    R.para("LAB 1 yêu cầu khởi tạo dự án và xác định phạm vi: lập Tôn chỉ dự án, phát biểu bài toán và kế hoạch truyền thông, chọn cơ cấu tổ chức, "
           "và phân rã công việc thành WBS kèm từ điển WBS. Các nhiệm vụ và vị trí trình bày:")
    R.table(D.LAB_GOAL_HEADER, D.LAB1_GOALS, caption="Nhiệm vụ của LAB 1 và vị trí trong báo cáo", widths=[3.6, 9.2, 3.2])
    R.para(md_text("**Nhất quán dữ liệu.**"), md=True)
    R.emit_md(md_range("h2", "1.2", "h1"))

    # =================================================================== CHƯƠNG 3 (LAB 2)
    R.chapter("LAB 2: ƯỚC LƯỢNG, PHÂN TÍCH TÀI CHÍNH VÀ LẬP LỊCH TIẾN ĐỘ")
    R.sec(2, "Mục tiêu và nhiệm vụ của LAB 2")
    R.para("LAB 2 yêu cầu lập kế hoạch tài chính và tiến độ: phân tích khả thi tài chính, ước lượng thời gian và chi phí kèm quan hệ phụ thuộc, "
           "vẽ sơ đồ mạng, xác định đường găng và Gantt, rồi nén tiến độ. Các nhiệm vụ và vị trí trình bày:")
    R.table(D.LAB_GOAL_HEADER, D.LAB2_GOALS, caption="Nhiệm vụ của LAB 2 và vị trí trong báo cáo", widths=[3.6, 9.2, 3.2])
    R.emit_md(md_range("h2", "2.1", "h1"))

    # =================================================================== CHƯƠNG 4 (LAB 3)
    R.chapter("LAB 3: QUẢN LÝ RỦI RO, THEO DÕI BẰNG EVA VÀ ĐẢM BẢO CHẤT LƯỢNG")
    R.sec(2, "Mục tiêu và nhiệm vụ của LAB 3")
    R.para("LAB 3 yêu cầu quản lý rủi ro, theo dõi tiến độ và chi phí bằng giá trị thu được (EVA), kiểm soát thay đổi và cấu hình, "
           "và đảm bảo chất lượng. Các nhiệm vụ và vị trí trình bày:")
    R.table(D.LAB_GOAL_HEADER, D.LAB3_GOALS, caption="Nhiệm vụ của LAB 3 và vị trí trong báo cáo", widths=[3.6, 9.2, 3.2])
    lab3 = md_range("h2", "3.1", "h1")
    R.emit_md(lab3)

    # =================================================================== CHƯƠNG 5
    R.chapter("PHÂN TÍCH YÊU CẦU, USE CASE VÀ WBS THEO CHỨC NĂNG")
    R.sec(2, "Yêu cầu chức năng")
    R.para("Hệ thống có 16 nhóm chức năng (F1 đến F16). Phần F1 đến F10 thuộc MVP; F11 đến F16 được làm thêm sau MVP.")
    fr = [r for r in R.srs_rows("| F") if re.match(r"^F\d+$", r[0])]
    R.table(["Mã", "Nhóm chức năng", "Mô tả ngắn"], fr, caption="Các nhóm chức năng của hệ thống", widths=[1.6, 4.6, 9.8], center={0})
    R.para(D.FR_NOTE)
    R.sec(2, "Yêu cầu phi chức năng")
    R.para("Yêu cầu phi chức năng được đặt ra thành chỉ tiêu đo được (SRS mục 3.3); mã chi tiết ở cột cuối:")
    R.table(["Nhóm", "Chỉ tiêu chính", "Mã yêu cầu"], D.NFR_ROWS, caption="Yêu cầu phi chức năng", widths=[3.0, 10.0, 3.0])
    R.sec(2, "Quy tắc nghiệp vụ")
    R.para("Chính sách mượn mặc định (Admin thay đổi được qua giao diện) và 26 quy tắc nghiệp vụ BR-01 đến BR-26 là nền của toàn bộ phần xử lý ở Backend:")
    R.table(D.POLICY_HEADER, D.POLICY_ROWS, caption="Chính sách mượn mặc định", widths=[3.8, 2.6, 2.6, 3.8, 3.2], center={1, 2, 3, 4})
    br = [r for r in R.srs_rows("| BR-")]
    R.table(["Mã", "Quy tắc"], br, caption="Quy tắc nghiệp vụ", widths=[1.9, 14.1], center={0})
    R.sec(2, "Phân tích các tác nhân (Actors)")
    R.para("Để xây dựng biểu đồ use case hoàn chỉnh, việc đầu tiên là xác định và phân loại chính xác các tác nhân tương tác với hệ thống. "
           "Bảng sau mô tả vai trò và quyền hạn của từng tác nhân (theo SRS 2.0):")
    R.table(["STT", "Tác nhân (Actor)", "Phân loại", "Mô tả vai trò và quyền hạn"], D.ACTORS, caption="Các tác nhân của hệ thống",
            widths=[1.7, 3.3, 2.5, 8.5], center={0})
    R.sec(2, "Phân tích các use case trung tâm theo phân hệ")
    R.para("Hệ thống có nhiều use case tương tác với nhau. Bảng sau tổng hợp các use case trọng tâm, phân theo 6 phân hệ chức năng:")
    R.table(["Phân hệ", "Mã UC", "Tên Use Case", "Tác nhân chính", "Mô tả ngắn gọn"], D.USECASES, caption="Các use case trọng tâm theo phân hệ",
            land=True, widths=[2.6, 2.6, 4.2, 3.4, 11.8], center={0, 1})
    R.sec(2, "Sơ đồ use case tổng thể")
    R.para("Cấu trúc biểu đồ use case tổng thể gồm biên giới hệ thống, các tác nhân và các quan hệ <<include>> (bắt buộc), <<extend>> (mở rộng):")
    R.bullets(D.UC_TEXT)
    R.fig(UML / "use-case-overview.png", "Use case tổng quan của hệ thống", w=10.0, h=20.0)
    R.fig(UML / "use-case-reader.png", "Use case nhóm chức năng của bạn đọc", w=8.5, h=13.0)
    R.fig(UML / "use-case-staff.png", "Use case nhóm chức năng của thủ thư và quản trị", w=11.5, h=15.0)
    R.sec(2, "Đặc tả chi tiết use case trọng tâm: UC-LOAN-01 (Cho mượn tại quầy)")
    for t in D.UC_SPEC_INTRO:
        R.para(t)
    R.para("Luồng sự kiện chính (Basic Flow):")
    R.bullets(D.UC_FLOW)
    R.para("Luồng ngoại lệ (Exception Flows):")
    R.bullets(D.UC_EXC)
    R.sec(2, "WBS theo chức năng")
    R.para("Bên cạnh WBS theo vòng đời ở {S:md:1.5} (dùng để lập lịch và đo EVA), nhóm xây dựng WBS theo hướng tiếp cận chức năng (Functional-based WBS), "
           "phân rã 4 cấp: Level 1 (hệ thống), Level 2 (phân hệ chức năng), Level 3 (khối chức năng nghiệp vụ), Level 4 (gói công việc chi tiết). "
           "Các hạng mục 1.3.2.2 và toàn bộ phân hệ 1.4 được bổ sung sau đường cơ sở 1.0 (qua quy trình thay đổi) và hiện đã chạy thật.")
    R.table(["Mã WBS", "Tên hạng mục, gói công việc (WBS Element)", "Cấp", "Mô tả nội dung đầu ra (Deliverables)"], D.WBS_FUNC,
            caption="WBS theo chức năng của hệ thống", key="wbsfunc", widths=[2.2, 6.0, 1.2, 6.6], center={0, 2})
    R.sec(2, "Đối chiếu WBS chức năng với WBS theo vòng đời")
    R.para("Hai cách phân rã mô tả cùng một sản phẩm theo hai trục khác nhau: WBS chức năng trả lời 'xây cái gì', WBS vòng đời trả lời 'làm khi nào và ai làm'.")
    R.table(["Phân hệ chức năng", "Gói công việc theo vòng đời (Chương 2 đến 4)"], D.WBS_MAP, caption="Đối chiếu WBS chức năng với WBS theo vòng đời",
            widths=[6.2, 9.8])

    # =================================================================== CHƯƠNG 6
    R.chapter("THIẾT KẾ HỆ THỐNG")
    R.sec(2, "Kiến trúc tổng thể")
    R.para("ULS dùng kiến trúc Modular Monolith cho Backend và AI Service tách riêng, giao tiếp REST/JSON. Lựa chọn này thay vì microservice đầy đủ vì nghiệp vụ "
           "thư viện gắn kết chặt (mượn, bản sao, phạt cần giao dịch chung), nhóm nhỏ và hạ tầng miễn phí. Phần AI tách riêng vì khác ngôn ngữ (Python, "
           "scikit-learn), có chu kỳ huấn luyện riêng và được phép lỗi mà không ảnh hưởng nghiệp vụ.")
    R.fig(UML / "architecture.png", "Sơ đồ kiến trúc: gateway, các dịch vụ, cơ sở dữ liệu, tích hợp ngoài", w=16.0, h=9.0)
    R.fig(UML / "system-context.png", "Sơ đồ bối cảnh hệ thống", w=12.0, h=9.0)
    R.table(["Thành phần", "Vai trò", "Công nghệ, nơi triển khai"], D.COMPONENTS, caption="Các thành phần của hệ thống", widths=[3.0, 7.0, 6.0])
    R.sec(2, "Kiến trúc phân tầng Backend")
    R.para("Mỗi module NestJS tuân theo mô hình Controller, Service, Repository (Prisma):")
    R.table(["Tầng", "Trách nhiệm", "Không được làm"], D.LAYERS, caption="Các tầng của Backend", widths=[3.2, 7.4, 5.4])
    R.para(D.CROSS_CUTTING)
    R.table(["Module", "Đường dẫn", "Nhóm chức năng"], D.MODULES, caption="Các module của Backend", widths=[6.6, 6.0, 3.4])
    R.sec(2, "Giao tiếp giữa các dịch vụ")
    R.table(["Từ tới", "Giao thức và bảo vệ", "Thời hạn chờ, dự phòng"], D.COMMS, caption="Giao tiếp giữa các dịch vụ", land=True,
            widths=[5.0, 9.0, 10.6])
    R.sec(2, "Thiết kế cơ sở dữ liệu")
    R.para("Cơ sở dữ liệu gồm 16 bảng chuẩn 3NF; sơ đồ ERD được sinh tự động từ Prisma schema (docs/tools/prisma_to_erd.py) nên luôn khớp mã nguồn, "
           "DDL là tệp migration thật (docs/erd/ddl.sql).")
    R.fig(ERD, "ERD của cơ sở dữ liệu (16 bảng)", w=15.5, h=19.0)
    R.table(["Bảng", "Mục đích", "Khoá và ràng buộc chính"], D.DB_TABLES, caption="Mô tả các bảng", land=True, widths=[4.2, 10.4, 10.0])
    R.para("**Chuẩn hoá và các lựa chọn thiết kế:**")
    R.bullets(D.DB_NORMAL)
    R.sec(2, "Thiết kế lớp (Class Diagram)")
    R.para(D.CLASS_TEXT)
    R.fig(UML / "class-diagram.png", "Biểu đồ lớp của hệ thống", w=16.0, h=19.0)
    R.sec(2, "Thiết kế tuần tự (Sequence Diagram) và hoạt động (Activity Diagram)")
    for fn, cap, desc in D.SEQUENCES:
        R.para(desc, keep_next=True)
        R.fig(UML / fn, cap, w=16.0, h=19.0)
    R.para("Quy trình cho mượn sách tại quầy dưới dạng biểu đồ hoạt động:")
    R.fig(UML / "activity-borrow.png", "Activity Diagram: quy trình cho mượn sách tại quầy", w=12.0, h=19.0)
    R.sec(2, "Thiết kế API")
    R.para("Backend cung cấp 78 API REST thuộc 18 nhóm; đặc tả sinh tự động (Swagger/OpenAPI) nên luôn khớp mã nguồn. Danh sách đầy đủ kèm quyền truy cập ở Phụ lục C.")
    R.bullets(D.API_CONVENTIONS)
    tag_counts: dict[str, int] = {}
    for e in R.api_snapshot:
        tag_counts[e["tag"]] = tag_counts.get(e["tag"], 0) + 1
    grp_rows = [[name, str(tag_counts.get(tag, 0)), desc] for tag, (name, desc) in D.API_GROUPS.items()]
    grp_rows.append(["**Tổng**", f"**{sum(tag_counts.values())}**", ""])
    R.table(["Nhóm API", "Số API", "Chức năng"], grp_rows, caption="Các nhóm API", widths=[4.2, 2.0, 9.8], center={1})
    R.table(["Mã HTTP", "Ý nghĩa"], D.API_CODES, caption="Mã phản hồi chung", widths=[3.0, 13.0], center={0})
    R.para("Mọi lỗi nghiệp vụ trả về một định dạng thống nhất kèm mã nghiệp vụ trong trường error (ví dụ UNPAID_FINE, LOAN_LIMIT_REACHED, COPY_HELD); đầy đủ hơn 50 mã nghiệp vụ nằm trong SDD mục 5.10:")
    R.code(D.ERROR_JSON, "Định dạng lỗi thống nhất")
    R.sec(2, "Thiết kế bảo mật và xử lý lỗi")
    R.table(["Mối đe doạ", "Biện pháp"], D.SECURITY_DESIGN, caption="Mối đe doạ và biện pháp bảo mật", widths=[4.4, 11.6])
    R.sec(2, "Quyết định thiết kế chính")
    R.table(["Quyết định", "Lý do và hệ quả"], D.ADR, caption="Các quyết định thiết kế chính", widths=[6.4, 9.6])
    R.sec(2, "Triển khai và vận hành")
    R.table(["Môi trường", "Cách chạy", "Ghi chú"], D.DEPLOY_ROWS, caption="Môi trường triển khai", widths=[2.8, 5.8, 7.4])

    # =================================================================== CHƯƠNG 7
    R.chapter("RỦI RO BẢO MẬT DỮ LIỆU BẠN ĐỌC VÀ TUÂN THỦ PHÁP LÝ")
    R.sec(2, "Bối cảnh rủi ro bảo mật dữ liệu bạn đọc")
    for t in D.SEC_CONTEXT:
        R.para(t)
    R.para("Các mối đe doạ đáng chú ý nhất đối với hệ thống gồm:")
    R.bullets(D.SEC_THREATS)
    R.sec(2, "Phân tích rủi ro tuân thủ pháp lý")
    R.para("Khung pháp lý liên quan đến một hệ thống thư viện trường đại học gồm:")
    R.bullets(D.SEC_LEGAL)
    R.para(D.SEC_LEGAL_NOTE)
    R.sec(2, "Ma trận phân tích rủi ro bảo mật và pháp lý")
    R.para(D.SEC_RISK_INTRO)
    R.table(["Mã", "Tên rủi ro", "P", "I", "Mức", "Biện pháp giảm thiểu và kiểm soát"], D.SEC_RISKS, caption="Ma trận rủi ro bảo mật và pháp lý",
            land=True, widths=[2.6, 5.6, 0.9, 0.9, 2.6, 12.0], center={0, 2, 3, 4})
    R.sec(2, "Chuyển hoá bảo mật và pháp lý vào cấu trúc WBS")
    R.para(D.SEC_WBS_INTRO)
    R.table(["Mã WBS", "Hạng mục bảo mật và tuân thủ", "Mô tả nội dung chi tiết", "Hiện trạng"], D.SEC_WBS,
            caption="Các hạng mục WBS về bảo mật và tuân thủ", land=True, widths=[2.4, 6.4, 11.0, 4.8], center={0})

    # =================================================================== CHƯƠNG 8
    R.chapter("SẢN PHẨM THỰC TẾ VÀ DEMO")
    R.sec(2, "Địa chỉ truy cập và tài khoản dùng thử")
    R.table(["Thành phần", "Địa chỉ"], D.ENV_ROWS, caption="Địa chỉ của hệ thống", widths=[4.6, 11.4])
    R.table(["Vai trò", "Email", "Mật khẩu"], D.ACCOUNTS, caption="Tài khoản dùng thử", widths=[5.0, 6.0, 5.0])
    R.para(D.DEMO_NOTE)
    R.sec(2, "Demo theo vai trò")
    R.para("Các ảnh dưới đây được chụp từ hệ thống đang chạy trên cloud (độ rộng trình duyệt 1440 px, riêng ảnh điện thoại 390 px), "
           "không phải ảnh dựng thử. Ảnh trang thanh toán VNPay chụp ở môi trường sandbox, giao dịch được huỷ ngay sau khi chụp.")
    for group, items in D.SHOTS:
        R.sec(3, group)
        for fname, cap, desc in items:
            R.para(desc, keep_next=True)
            w = 6.0 if "dien-thoai" in fname else (11.0 if "vnpay" in fname else TEXT_W)
            R.fig(SHOT / fname, cap, w=w, h=11.0 if w == TEXT_W else 14.0)
    R.sec(3, "Tài liệu API và kiểm thử")
    R.para("Tài liệu API (Swagger) sinh tự động từ mã nguồn, dùng chung cho thủ thư, giảng viên chấm bài và người viết client:")
    R.fig(SHOT / "11-swagger.jpg", "Swagger UI của hệ thống đang chạy trên cloud", w=TEXT_W, h=11.0)
    R.sec(2, "Kết quả kiểm thử và chất lượng")
    R.table(["Hạng mục", "Kết quả", "Đánh giá"], D.TEST_RESULT_ROWS, caption="Kết quả kiểm thử tự động và độ bao phủ", widths=[5.6, 6.4, 4.0])
    R.para(D.TEST_NOTE)
    R.fig(SHOT / "09-coverage-backend.jpg", "Báo cáo coverage của Backend trích từ log job backend trên GitHub Actions", w=13.0, h=19.0)
    R.fig(SHOT / "10-ci-pipeline.jpg", "Pipeline GitHub Actions: 4 job kiểm tra rồi mới triển khai", w=TEXT_W, h=11.0)
    R.sec(2, "Kết quả mô hình AI")
    R.table(["Mô hình", "Chỉ số đo", "Đánh giá"], D.AI_ROWS, caption="Số đo hai mô hình AI", land=True, widths=[6.4, 12.2, 6.0])
    R.para(D.AI_NOTE)
    R.sec(2, "Hiệu năng")
    R.table(["Phép đo", "Trước tối ưu", "Sau tối ưu"], D.PERF_ROWS, caption="Kết quả tối ưu hiệu năng", widths=[8.0, 4.0, 4.0], center={1, 2})
    R.para(D.PERF_NOTE)

    # =================================================================== CHƯƠNG 9
    R.chapter("LỘ TRÌNH TRIỂN KHAI, CHỈ SỐ ĐÁNH GIÁ VÀ VẬN HÀNH")
    R.sec(2, "Lộ trình triển khai dự án")
    R.para(D.ROADMAP_INTRO)
    R.bullets(D.ROADMAP)
    R.para(D.ROADMAP_NOTE)
    R.sec(2, "Bộ chỉ số đánh giá hiệu quả dự án (KPIs)")
    R.para("Hiệu quả của dự án được đo bằng các chỉ số định lượng sau; cột Hiện trạng ghi đúng cái đã đo hoặc kiểm tra được và cái chưa đo:")
    R.table(["Chỉ số", "Chỉ tiêu", "Hiện trạng"], D.KPI_ROWS, caption="Bộ chỉ số đánh giá hiệu quả dự án", widths=[3.8, 6.2, 6.0])
    R.sec(2, "Mô hình vận hành và hỗ trợ")
    R.bullets(D.OPS)

    # =================================================================== KẾT LUẬN
    R.chapter("KẾT LUẬN VÀ KIẾN NGHỊ", numbered=False)
    R.para("Báo cáo đã vận dụng kiến thức quản lý dự án phần mềm vào một sản phẩm có thật: từ khởi tạo và phạm vi (LAB 1), ước lượng và lập lịch (LAB 2), "
           "rủi ro, EVA và chất lượng (LAB 3), đến phân tích yêu cầu, thiết kế hệ thống, rủi ro bảo mật và sản phẩm chạy thật. Việc gắn chặt use case, WBS, "
           "ma trận rủi ro và kết quả kiểm thử với hiện trạng mã nguồn giúp mọi con số và hạng mục truy được về một phần việc cụ thể.")
    R.sec(2, "Tổng kết kết quả đạt được")
    R.bullets(D.CONCL_SUMMARY)
    R.sec(2, "Bài học kinh nghiệm")
    R.bullets(D.LESSONS)
    R.sec(2, "Tự đánh giá mức độ thành công theo ba trụ cột")
    R.table(D.SELF_HEADER, D.SELF_ROWS, caption="Tự đánh giá theo ba trụ cột và các tiêu chí bổ sung", land=True, widths=[3.6, 5.0, 11.4, 4.6])
    R.para(D.SELF_NOTE)
    R.sec(2, "Hạn chế và hướng hoàn thiện")
    R.bullets(D.LIMITS)
    R.sec(2, "Khuyến nghị đối với Ban quản lý dự án")
    R.bullets(D.RECOMMEND)

    # =================================================================== TÀI LIỆU THAM KHẢO
    R.go_port(force=True)
    R.flush()
    R.chap = "TLTK"
    tpl.add("h1", "TÀI LIỆU THAM KHẢO", outline=0, page_break_before=True, size_half_pt=28, align="center")
    for t in D.REFERENCES:
        tpl.add("plain", t)

    # =================================================================== PHỤ LỤC
    R.appendix("A", "TỔNG HỢP CÔNG THỨC")
    appx = next(b for b in md if b.kind == "table" and b.label == "A.1")
    R.table(appx.header, appx.rows, caption=appx.caption, from_md=True, widths=[3.6, 12.4], bold_first=True)

    R.appendix("B", "PRODUCT BACKLOG (37 USER STORY)")
    R.para("Điểm theo thang Fibonacci; ưu tiên Must, Should, Could; US01 đến US20 là MVP (77 điểm), US21 đến US37 là các đợt mở rộng sau MVP (78 điểm, Sprint 5). "
           "Tiêu chí chấp nhận chi tiết của từng User Story nằm trong SRS phiên bản 2.0.")
    backlog = []
    for ln in SRS.read_text(encoding="utf-8").splitlines():
        if re.match(r"^\| US\d+ ", ln):
            c = [x.strip() for x in ln.strip().strip("|").split("|")]
            if len(c) >= 6:  # bảng backlog; bảng truy vết phía sau chỉ có 3 cột
                backlog.append([c[0], re.sub(r"\*\*", "", c[1]), c[3], c[4], c[5]])
    R.table(["ID", "User Story", "Điểm", "Ưu tiên", "Sprint"], backlog, caption="Product Backlog", land=True, widths=[1.8, 16.4, 1.8, 2.4, 2.2],
            center={0, 2, 3, 4})

    R.appendix("C", "DANH SÁCH API (78 API)")
    cat = {(e.method, e.path): e.access for e in api_catalog.collect()}
    api_rows = []
    for e in R.api_snapshot:
        access = cat.get((e["method"], e["path"]), "")
        api_rows.append([e["method"], e["path"], access, e["summary"].replace("–", "-")])
    R.para("Danh sách lấy từ OpenAPI của hệ thống đang chạy (mô tả) và từ các controller của Backend (quyền truy cập). 'Đã đăng nhập' là mọi vai trò có JWT hợp lệ; "
           "'Thủ thư, quản trị' gồm cả Admin; 'Bạn đọc' là các route dành riêng cho tài khoản Reader.")
    R.table(["Method", "URL", "Quyền", "Mô tả"], api_rows, caption="Danh sách API", land=True, widths=[2.2, 8.0, 4.4, 10.0], center={0})

    R.appendix("D", "TỆP KÈM THEO VÀ CÁCH TÁI TẠO")
    R.bullets(D.FILES_APPENDIX)

    R.go_port(force=True)
    R.flush()

    # ---- bảng từ viết tắt (đặt ngay sau tiêu đề mục, trước phần thân)
    before = len(tpl.body)
    abbr_rows = [[str(i), a, b] for i, (a, b) in enumerate(D.ABBREV, start=1)]
    tpl.table(["STT", "Từ viết tắt", "Ý nghĩa"], abbr_rows, [1.7, 3.8, 10.5], style=TABLE_STYLE, header_fill="E7E9F0", gap=False, center_cols={0, 1})
    children = list(tpl.body)
    new_nodes = children[before - 1 : len(children) - 1]
    anchor = abbrev_heading._p
    for node in new_nodes:
        tpl.body.remove(node)
        anchor.addnext(node)
        anchor = node

    force_font(doc)
    doc.core_properties.title = "Báo cáo Quản lý dự án phần mềm: Phần mềm Quản lý Thư viện Trường Đại học Xây dựng Miền Trung"
    doc.core_properties.author = "Trần Đình Khôi"
    doc.save(output)
    R.final_reg = R.reg
    return R


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit("usage: build_qldapm_final.py template.docx output.docx")
    first = build(Path(sys.argv[1]), Path(sys.argv[2]))
    second = build(Path(sys.argv[1]), Path(sys.argv[2]), labels=first.reg)
    unresolved = sorted(set(second.warn))
    print("wrote", sys.argv[2])
    if unresolved:
        print("THAM CHIẾU CHƯA GIẢI QUYẾT:", unresolved)
