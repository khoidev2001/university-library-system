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
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor

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


def add_table(doc: Document, rows: list[list[str]]) -> None:
    if not rows:
        return
    ncols = max(len(r) for r in rows)
    table = doc.add_table(rows=len(rows), cols=ncols)
    table.style = "Table Grid"
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
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
    doc.add_paragraph()


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
    normal.font.size = Pt(12)
    normal.element.rPr.rFonts.set(qn("w:eastAsia"), "Times New Roman")
    for level, size in ((1, 16), (2, 14), (3, 13), (4, 12)):
        style = doc.styles[f"Heading {level}"]
        style.font.name = "Times New Roman"
        style.font.size = Pt(size)
        style.font.bold = True
        style.font.color.rgb = RGBColor(0x1F, 0x3A, 0x5F)
        style.element.rPr.rFonts.set(qn("w:eastAsia"), "Times New Roman")
    for section in doc.sections:
        section.left_margin = Cm(2.5)
        section.right_margin = Cm(2)
        section.top_margin = Cm(2)
        section.bottom_margin = Cm(2)


def convert(md_path: Path, out_path: Path) -> None:
    doc = Document()
    setup_styles(doc)
    lines = md_path.read_text(encoding="utf-8").splitlines()
    i = 0
    table_buf: list[list[str]] = []
    code_buf: list[str] | None = None

    def flush_table() -> None:
        nonlocal table_buf
        if table_buf:
            add_table(doc, table_buf)
            table_buf = []

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
        if stripped == "---":
            doc.add_paragraph().paragraph_format.space_after = Pt(0)
            continue

        image = re.match(r"^!\[(.*?)\]\((.*?)\)$", stripped)
        if image:
            img_path = (md_path.parent / image.group(2)).resolve()
            if img_path.exists():
                doc.add_picture(str(img_path), width=Cm(16))
                doc.paragraphs[-1].alignment = WD_ALIGN_PARAGRAPH.CENTER
                cap = doc.add_paragraph()
                cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
                run = cap.add_run(image.group(1))
                run.italic = True
                run.font.size = Pt(11)
            continue

        heading = re.match(r"^(#{1,4})\s+(.*)$", stripped)
        if heading:
            level = len(heading.group(1))
            text = heading.group(2).strip()
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
            add_inline(para, bullet.group(1))
            continue

        numbered = re.match(r"^\d+\.\s+(.*)$", stripped)
        if numbered:
            para = doc.add_paragraph(style="List Number")
            add_inline(para, numbered.group(1))
            continue

        para = doc.add_paragraph()
        para.paragraph_format.space_after = Pt(6)
        add_inline(para, stripped)

    flush_table()
    doc.save(out_path)


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit("usage: md_to_docx.py input.md output.docx")
    convert(Path(sys.argv[1]), Path(sys.argv[2]))
    print(f"wrote {sys.argv[2]}")
