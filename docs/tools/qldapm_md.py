"""Đọc docs/pm/QLDAPM_Report.md thành các khối (đề mục, đoạn, gạch đầu dòng, bảng, hình) để dựng lại báo cáo Word gộp.

Nguồn Markdown giữ nguyên số liệu đã đối chiếu với bảng tính; script dựng chỉ đổi cách trình bày và vài chỗ số liệu cũ.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class Block:
    kind: str                      # h1 h2 h3 p li oli table img marker
    text: str = ""                 # nội dung (đề mục, đoạn, chú thích hình)
    num: str = ""                  # số đề mục của Markdown, ví dụ "1.5.3"
    header: list[str] = field(default_factory=list)
    rows: list[list[str]] = field(default_factory=list)
    label: str = ""                # nhãn bảng hoặc hình của Markdown, ví dụ "1.2"
    caption: str = ""              # tên bảng hoặc hình, không có tiền tố
    extra: list[str] = field(default_factory=list)  # câu đi kèm sau tên bảng
    path: str = ""                 # đường dẫn hình
    font: float | None = None      # cỡ chữ gợi ý của Markdown (bỏ qua khi dựng)
    line: int = 0


def _cells(line: str) -> list[str]:
    return [c.strip() for c in line.strip().strip("|").split("|")]


def _plain(text: str) -> str:
    """Bỏ dấu in nghiêng đơn (*chữ*); giữ **đậm** và `mã` để bộ dựng xử lý."""
    return re.sub(r"(?<!\*)\*(?!\*)([^*\n]+?)\*(?!\*)", r"\1", text)


_CAP = re.compile(r"^\*\*(Bảng|Hình)\s+([\w.]+?)\.?\*\*\s*(.*)$")
_IMG = re.compile(r"^!\[(.*?)\]\((.*?)\)\s*$")
_HEAD = re.compile(r"^(#{1,4})\s+(.*)$")
_NUM = re.compile(r"^((?:\d+\.)+\d*)\.?\s+(.*)$")


def parse(path: Path) -> list[Block]:
    lines = path.read_text(encoding="utf-8").splitlines()
    blocks: list[Block] = []
    i = 0
    font: float | None = None
    while i < len(lines):
        raw = lines[i]
        s = raw.strip()
        if not s or s.startswith("@@") or s.startswith("[[TOC]]"):
            i += 1
            continue
        m = re.match(r"<!--font:([\d.]+)-->", s)
        if m:
            font = float(m.group(1))
            i += 1
            continue
        if s in ("\\pagebreak", "\\landscape", "\\portrait"):
            blocks.append(Block("marker", text=s[1:], line=i))
            i += 1
            continue
        h = _HEAD.match(s)
        if h:
            level = len(h.group(1))
            title = h.group(2).strip()
            nm = _NUM.match(title)
            num, name = (nm.group(1).rstrip("."), nm.group(2)) if nm else ("", title)
            blocks.append(Block(f"h{level}", text=name, num=num, line=i))
            i += 1
            continue
        img = _IMG.match(s)
        if img:
            alt = img.group(1)
            cm = re.match(r"^Hình\s+([\w.]+?)\.?\s+(.*)$", alt)
            blocks.append(Block("img", label=cm.group(1) if cm else "", caption=(cm.group(2) if cm else alt).strip().rstrip("."),
                                path=img.group(2), line=i))
            i += 1
            continue
        if s.startswith("|"):
            j = i
            while j < len(lines) and lines[j].strip().startswith("|"):
                j += 1
            tbl = [ln for ln in lines[i:j]]
            header = [c for c in _cells(tbl[0])]
            rows = [_cells(r) for r in tbl[2:]]
            blk = Block("table", header=header, rows=rows, font=font, line=i)
            font = None
            # tên bảng nằm ở dòng ngay sau bảng
            k = j
            while k < len(lines) and not lines[k].strip():
                k += 1
            if k < len(lines):
                cm = _CAP.match(lines[k].strip())
                if cm and cm.group(1) == "Bảng":
                    blk.label = cm.group(2)
                    rest = cm.group(3).strip()
                    first, _, tail = rest.partition(". ")
                    if tail and (len(rest) > 90 or tail.startswith("**") or "BAC" in rest[:60]):
                        blk.caption = first.strip()
                        blk.extra = [t.strip() for t in re.split(r"(?<=\.)\s+(?=\*\*)", tail) if t.strip()]
                        if not blk.extra:
                            blk.extra = [tail.strip()]
                    else:
                        blk.caption = rest.rstrip(".")
                    j = k + 1
            blocks.append(blk)
            i = j
            continue
        if re.match(r"^- ", s):
            blocks.append(Block("li", text=_plain(s[2:].strip()), line=i))
            i += 1
            continue
        om = re.match(r"^(\d+)\.\s+(.*)$", s)
        if om:
            blocks.append(Block("oli", text=_plain(om.group(2)), num=om.group(1), line=i))
            i += 1
            continue
        blocks.append(Block("p", text=_plain(s), line=i))
        i += 1
    return blocks


def section(blocks: list[Block], start: str, level: int | None = None) -> list[Block]:
    """Các khối từ đề mục có nội dung bắt đầu bằng `start` tới đề mục cùng cấp hoặc cao hơn kế tiếp (không gồm đề mục đầu)."""
    idx = next(i for i, b in enumerate(blocks) if b.kind.startswith("h") and (f"{b.num} {b.text}".strip().startswith(start) or b.text.startswith(start)))
    lvl = int(blocks[idx].kind[1:])
    out = []
    for b in blocks[idx + 1 :]:
        if b.kind.startswith("h") and int(b.kind[1:]) <= lvl:
            break
        out.append(b)
    return out


if __name__ == "__main__":
    import sys

    bl = parse(Path(sys.argv[1]))
    from collections import Counter

    print(Counter(b.kind for b in bl))
    for b in bl:
        if b.kind.startswith("h") or b.kind in ("table", "img", "marker"):
            print(b.line + 1, b.kind, b.num, b.label, (b.text or b.caption)[:60], [e[:30] for e in b.extra])
