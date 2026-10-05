"""Thay gạch ngang dài bằng dấu câu tiếng Việt thông thường.

Gạch ngang dài (em dash) không có trên bàn phím tiếng Việt và hiếm khi xuất hiện trong
văn bản hành chính của trường, nên tài liệu nộp dùng dấu hai chấm, dấu phẩy hoặc dấu
ngoặc cho tự nhiên hơn.

Quy tắc, xét theo ngữ cảnh quanh dấu:
  "A — B"   -> "A: B"   khi A là nhan đề ngắn (đầu dòng, đầu ô bảng, trước dấu hai chấm xa)
  "A — B"   -> "A, B"   trong câu dài
  "(X — Y)" -> "(X, Y)"
Người dùng tự rà lại các câu được sửa; script chỉ làm phần máy móc.

Usage: python normalize_dashes.py <file...>   (không tham số: quét docs/ và README.md)
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1].parent
EM_DASH = "—"

DEFAULT_TARGETS = [
    "docs/srs/SRS.md",
    "docs/design/SDD.md",
    "docs/report/LAB1_slides_brief.md",
    "docs/PLAN.md",
    "README.md",
]

# Những cụm cần thay bằng từ nối cụ thể thay vì dấu câu chung
PHRASES: list[tuple[str, str]] = [
    (f"Đề tài 8 {EM_DASH} ", "Đề tài 8: "),
    (f" {EM_DASH} xem ", ", xem "),
    (f" {EM_DASH} và ", " và "),
    (f" {EM_DASH} nhưng ", " nhưng "),
    (f" {EM_DASH} nên ", " nên "),
    (f" {EM_DASH} đó ", ", đó "),
    (f" {EM_DASH} không phải ", ", không phải "),
    (f" {EM_DASH} đúng ", ", đúng "),
]


def convert_line(line: str) -> str:
    for old, new in PHRASES:
        line = line.replace(old, new)
    if EM_DASH not in line:
        return line

    # Trong ô bảng Markdown: dùng dấu phẩy để không phá cấu trúc cột
    if line.lstrip().startswith("|"):
        return line.replace(f" {EM_DASH} ", ", ").replace(EM_DASH, ",")

    # Nhan đề: "## Tiêu đề — mô tả" hoặc "**Nhãn** — nội dung" -> dấu hai chấm
    heading = re.match(rf"^(\s*(?:#{{1,6}}|[-*]|\d+\.)?\s*\**[^{EM_DASH}]{{0,60}}?)\s{EM_DASH}\s(.+)$", line)
    if heading and len(heading.group(1).strip()) <= 60:
        return f"{heading.group(1).rstrip()}: {heading.group(2)}"

    # Còn lại trong câu: dấu phẩy
    return line.replace(f" {EM_DASH} ", ", ").replace(EM_DASH, ",")


def convert(path: Path) -> int:
    text = path.read_text(encoding="utf-8")
    if EM_DASH not in text:
        return 0
    before = text.count(EM_DASH)
    converted = "\n".join(convert_line(line) for line in text.split("\n"))
    path.write_text(converted, encoding="utf-8")
    return before - converted.count(EM_DASH)


if __name__ == "__main__":
    targets = [Path(arg) for arg in sys.argv[1:]] or [ROOT / name for name in DEFAULT_TARGETS]
    total = 0
    for target in targets:
        changed = convert(target)
        total += changed
        print(f"{changed:3d}  {target}")
    print(f"Đã thay {total} dấu.")
