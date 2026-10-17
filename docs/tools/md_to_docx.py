"""Convert a Markdown document to .docx using python-docx.

Supports: headings (#..####), paragraphs, bullet/numbered lists, pipe tables,
fenced code blocks, horizontal rules, **bold**, `code`, *italic*.
Usage: python md_to_docx.py input.md output.docx
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

from docx import Document
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_TAB_ALIGNMENT, WD_TAB_LEADER
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor

STYLES = {
    "default": {"base": 12, "justify": False, "line": None, "before": 0, "after": 6, "tables": (8.5, 9.5, 10), "caption": 11,
                "h": (16, 14, 13, 12), "bullet_after": None},
    "qldapm": {"base": 14, "justify": True, "line": 1.15, "before": 2, "after": 2, "tables": (9.5, 10.5, 11.5), "caption": 12,
               "h": (16, 14, 14, 14), "bullet_after": 2},
}
STYLE = dict(STYLES["default"])

INLINE_RE = re.compile(r"(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)")


def add_inline(paragraph, text: str, size: float | None = None) -> None:
    for part in INLINE_RE.split(text):
        if not part:
            continue
        if part.startswith("**") and part.endswith("**"):
            run = paragraph.add_run(part[2:-2])
            run.bold = True
        elif part.startswith("`") and part.endswith("`"):
            run = paragraph.add_run(part[1:-1])
            run.font.name = "Consolas"
        elif part.startswith("*") and part.endswith("*") and len(part) > 2:
            run = paragraph.add_run(part[1:-1])
            run.italic = True
        else:
            run = paragraph.add_run(part)
        if size:
            run.font.size = Pt(size)


def shade_cell(cell, hex_fill: str) -> None:
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), hex_fill)
    tc_pr.append(shd)


def split_row(line: str) -> list[str]:
    # an escaped pipe inside a cell is a literal pipe, not a column separator
    placeholder = chr(1)
    cells = line.strip().strip("|").replace(chr(92) + "|", placeholder).split("|")
    return [c.strip().replace(placeholder, "|") for c in cells]


def is_separator(line: str) -> bool:
    return bool(re.match(r"^\s*\|?\s*:?-{2,}", line)) and set(line.strip()) <= set("|:- ")


def add_table(doc: Document, rows: list[list[str]], font_override: float | None = None) -> None:
    if not rows:
        return
    ncols = max(len(r) for r in rows)
    small, mid, big = STYLE["tables"]
    font_size = font_override or (small if ncols >= 8 else (mid if ncols >= 5 else big))
    table = doc.add_table(rows=len(rows), cols=ncols)
    table.style = "Table Grid"
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    section = doc.sections[-1]
    usable = section.page_width - section.left_margin - section.right_margin
    weights = []
    for j in range(ncols):
        cells = [re.sub(r"[*`]", "", (r[j] if j < len(r) else "")) for r in rows]
        lengths = [len(c) for c in cells]
        # Trung bình cộng với giá trị lớn nhất: một ô dài bất thường không chiếm hết bề rộng của cột
        longest = (max(lengths) + sum(lengths) / len(lengths)) / 2
        header = len(re.sub(r"[*`]", "", rows[0][j] if j < len(rows[0]) else ""))
        # Từ dài nhất không được bị ngắt giữa chừng (tên bảng, tên mã lỗi, "Should", "Method")
        longest_word = max((len(w) for c in cells for w in c.split()), default=0)
        weights.append(min(max(longest * 0.95, header * 0.95, longest_word * 1.25, 10), 34))
    total = sum(weights)
    table.autofit = False
    for j in range(ncols):
        for i in range(len(rows)):
            table.cell(i, j).width = int(usable * weights[j] / total)
    for i, row in enumerate(rows):
        for j in range(ncols):
            text = row[j] if j < len(row) else ""
            cell = table.cell(i, j)
            cell.text = ""
            para = cell.paragraphs[0]
            para.paragraph_format.space_after = Pt(0)
            add_inline(para, text.replace("<br>", "\n"), size=10)
            if i == 0:
                for run in para.runs:
                    run.bold = True
                shade_cell(cell, "D9E2F3")
    spacer = doc.add_paragraph()
    spacer.paragraph_format.space_after = Pt(0)
    spacer.paragraph_format.space_before = Pt(0)
    spacer.paragraph_format.line_spacing = Pt(2)


def add_code(doc: Document, lines: list[str]) -> None:
    para = doc.add_paragraph()
    para.paragraph_format.left_indent = Cm(0.5)
    run = para.add_run("\n".join(lines))
    run.font.name = "Consolas"
    run.font.size = Pt(9)
    shade = OxmlElement("w:shd")
    shade.set(qn("w:val"), "clear")
    shade.set(qn("w:color"), "auto")
    shade.set(qn("w:fill"), "F2F2F2")
    para._p.get_or_add_pPr().append(shade)


def setup_styles(doc: Document) -> None:
    normal = doc.styles["Normal"]
    normal.font.name = "Times New Roman"
    normal.font.size = Pt(STYLE["base"])
    normal.element.rPr.rFonts.set(qn("w:eastAsia"), "Times New Roman")
    for level, size in zip((1, 2, 3, 4), STYLE["h"]):
        style = doc.styles[f"Heading {level}"]
        style.font.name = "Times New Roman"
        style.font.size = Pt(size)
        style.font.bold = True
        style.font.color.rgb = RGBColor(0x1F, 0x3A, 0x5F)
        style.font.italic = (level == 3 and STYLE["base"] == 14)
        style.element.rPr.rFonts.set(qn("w:eastAsia"), "Times New Roman")
    for section in doc.sections:
        section.left_margin = Cm(2.5)
        section.right_margin = Cm(2)
        section.top_margin = Cm(2)
        section.bottom_margin = Cm(2)


def convert(md_path: Path, out_path: Path, style: str = "default") -> None:
    STYLE.clear()
    STYLE.update(STYLES[style])
    doc = Document()
    setup_styles(doc)
    pf = doc.styles["Normal"].paragraph_format
    pf.space_before = Pt(STYLE["before"])
    pf.space_after = Pt(STYLE["after"])
    if STYLE["line"]:
        pf.line_spacing = STYLE["line"]
    lines = md_path.read_text(encoding="utf-8").splitlines()
    i = 0
    table_buf: list[list[str]] = []
    code_buf: list[str] | None = None

    next_font: float | None = None

    def flush_table() -> None:
        nonlocal table_buf, next_font
        if table_buf:
            add_table(doc, table_buf, next_font)
            table_buf = []
            next_font = None

    while i < len(lines):
        line = lines[i]
        i += 1

        if code_buf is not None:
            if line.strip().startswith("```"):
                add_code(doc, code_buf)
                code_buf = None
            else:
                code_buf.append(line)
            continue

        if line.strip().startswith("```"):
            flush_table()
            code_buf = []
            continue

        if line.strip().startswith("|"):
            if is_separator(line):
                continue
            table_buf.append(split_row(line))
            continue
        flush_table()

        stripped = line.strip()
        if not stripped:
            continue
        if stripped.startswith("@@LIST|"):
            _, text_part, page_part = stripped.split("|", 2)
            para = doc.add_paragraph()
            para.paragraph_format.space_after = Pt(1)
            para.paragraph_format.left_indent = Cm(0.8)
            para.paragraph_format.first_line_indent = Cm(-0.8)
            usable = doc.sections[-1].page_width - doc.sections[-1].left_margin - doc.sections[-1].right_margin
            para.paragraph_format.tab_stops.add_tab_stop(usable, WD_TAB_ALIGNMENT.RIGHT, WD_TAB_LEADER.DOTS)
            run = para.add_run(text_part + chr(9) + page_part)
            run.font.size = Pt(STYLE["base"] - 1)
            continue
        if stripped.startswith("@@C|") or stripped.startswith("@@CB|"):
            parts = stripped.split("|")
            para = doc.add_paragraph()
            para.alignment = WD_ALIGN_PARAGRAPH.CENTER
            if parts[0] == "@@CB":
                run = para.add_run(parts[2])
                run.bold = True
                run.font.size = Pt(float(parts[1]))
            else:
                run = para.add_run(parts[1])
            continue
        font_mark = re.match(r"^<!--font:([\d.]+)-->$", stripped)
        if font_mark:
            next_font = float(font_mark.group(1))
            continue
        if stripped in (chr(92) + "landscape", chr(92) + "portrait"):
            from docx.enum.section import WD_ORIENT, WD_SECTION
            sec = doc.add_section(WD_SECTION.NEW_PAGE)
            want_land = stripped.endswith("landscape")
            is_land = sec.page_width > sec.page_height
            if want_land != is_land:
                sec.page_width, sec.page_height = sec.page_height, sec.page_width
            sec.orientation = WD_ORIENT.LANDSCAPE if want_land else WD_ORIENT.PORTRAIT
            if want_land:
                sec.left_margin = sec.right_margin = Cm(1.6)
                sec.top_margin = sec.bottom_margin = Cm(1.5)
            else:
                sec.left_margin, sec.right_margin = Cm(2.5), Cm(2)
                sec.top_margin = sec.bottom_margin = Cm(2)
            continue
        if stripped == chr(92) + "pagebreak":
            doc.add_page_break()
            continue
        if stripped == "---":
            doc.add_paragraph().paragraph_format.space_after = Pt(0)
            continue

        image = re.match(r"^!\[(.*?)\]\((.*?)\)$", stripped)
        if image:
            img_path = (md_path.parent / image.group(2)).resolve()
            if img_path.exists():
                sec = doc.sections[-1]
                width = min(Cm(16) if sec.page_width < sec.page_height else Cm(24.5), sec.page_width - sec.left_margin - sec.right_margin)
                # Hình cao hơn một trang thì thu nhỏ theo chiều cao để không bị cắt
                from docx.image.image import Image as DocxImage

                info = DocxImage.from_file(str(img_path))
                max_height = sec.page_height - sec.top_margin - sec.bottom_margin - Cm(2.5)
                if width * info.px_height / info.px_width > max_height:
                    width = int(max_height * info.px_width / info.px_height)
                if doc.paragraphs:
                    doc.paragraphs[-1].paragraph_format.keep_with_next = True  # đoạn dẫn không bị tách khỏi hình
                doc.add_picture(str(img_path), width=width)
                doc.paragraphs[-1].alignment = WD_ALIGN_PARAGRAPH.CENTER
                doc.paragraphs[-1].paragraph_format.keep_with_next = True  # chú thích đi cùng hình
                cap = doc.add_paragraph()
                cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
                run = cap.add_run(image.group(1))
                run.italic = True
                run.font.size = Pt(STYLE["caption"])
            continue

        heading = re.match(r"^(#{1,4})\s+(.*)$", stripped)
        if heading:
            level = len(heading.group(1))
            text = heading.group(2).strip().replace("`", "")
            if level == 1 and text.startswith("TÀI LIỆU"):
                para = doc.add_paragraph()
                para.alignment = WD_ALIGN_PARAGRAPH.CENTER
                run = para.add_run(text)
                run.bold = True
                run.font.size = Pt(18)
            else:
                doc.add_heading(text, level=level)
            continue

        bullet = re.match(r"^[-*]\s+(.*)$", stripped)
        if bullet:
            para = doc.add_paragraph(style="List Bullet")
            if STYLE["justify"]:
                para.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
            add_inline(para, bullet.group(1))
            continue

        numbered = re.match(r"^(\d+)\.\s+(.*)$", stripped)
        if numbered:
            para = doc.add_paragraph()
            para.paragraph_format.left_indent = Cm(0.9)
            para.paragraph_format.first_line_indent = Cm(-0.6)
            para.paragraph_format.space_after = Pt(STYLE["bullet_after"] if STYLE["bullet_after"] is not None else 3)
            if STYLE["justify"]:
                para.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
            add_inline(para, f"{numbered.group(1)}. {numbered.group(2)}")
            continue

        para = doc.add_paragraph()
        para.paragraph_format.space_after = Pt(STYLE["after"])
        if STYLE["justify"] and not stripped.startswith("**Bảng") and not stripped.startswith("**Hình"):
            para.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
        add_inline(para, stripped)

    flush_table()
    doc.save(out_path)


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit("usage: md_to_docx.py input.md output.docx")
    convert(Path(sys.argv[1]), Path(sys.argv[2]))
    print(f"wrote {sys.argv[2]}")
