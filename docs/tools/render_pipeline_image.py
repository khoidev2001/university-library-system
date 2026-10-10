"""Dựng ảnh kết quả pipeline GitHub Actions từ dữ liệu thật của `gh run view --json`.

Không phải ảnh chụp màn hình: repo ở chế độ riêng tư nên trình duyệt không đăng nhập
không xem được trang Actions. Ảnh này vẽ lại ĐÚNG dữ liệu (tên job, kết quả, thời gian,
các bước) và ghi nguồn trên ảnh, để báo cáo không giả làm ảnh chụp.

Usage:
  gh run view <id> --json jobs,displayTitle,headBranch,event,number,conclusion,createdAt \\
     -q '{t:.displayTitle,b:.headBranch,e:.event,n:.number,c:.conclusion,at:.createdAt,jobs:[.jobs[]|{name,conclusion,s:.startedAt,e:.completedAt,steps:[.steps[]|{name,conclusion}]}]}' > run.json
  python render_pipeline_image.py run.json out.png
"""
from __future__ import annotations

import json
import sys
from datetime import datetime
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

INK, SOFT, FAINT, LINE = "#16243c", "#4a5568", "#76818f", "#e2dcd0"
GOOD, GOOD_BG = "#2f6b52", "#e6f0ea"
SKIP, SKIP_BG = "#76818f", "#f1ece1"
BAD, BAD_BG = "#8c3b24", "#f6e9e4"
PAPER = "#faf8f3"

FONT_DIRS = [Path("C:/Windows/Fonts"), Path("/usr/share/fonts/truetype/dejavu")]


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    names = ["segoeuib.ttf", "arialbd.ttf", "DejaVuSans-Bold.ttf"] if bold else ["segoeui.ttf", "arial.ttf", "DejaVuSans.ttf"]
    for directory in FONT_DIRS:
        for name in names:
            if (directory / name).exists():
                return ImageFont.truetype(str(directory / name), size)
    return ImageFont.load_default()


def seconds(job: dict) -> int:
    if not job.get("s") or not job.get("e"):
        return 0
    start = datetime.fromisoformat(job["s"].replace("Z", "+00:00"))
    end = datetime.fromisoformat(job["e"].replace("Z", "+00:00"))
    return max(0, int((end - start).total_seconds()))


def status_style(conclusion: str) -> tuple[str, str, str, str]:
    if conclusion == "success":
        return "Thành công", GOOD, GOOD_BG, "✓"
    if conclusion == "skipped":
        return "Bỏ qua", SKIP, SKIP_BG, "-"
    return "Thất bại", BAD, BAD_BG, "x"


def render(run: dict, out: Path) -> None:
    jobs = run["jobs"]
    width, row_h = 1100, 74
    height = 190 + row_h * len(jobs) + 90
    image = Image.new("RGB", (width, height), PAPER)
    draw = ImageDraw.Draw(image)

    draw.text((40, 28), "GitHub Actions  ·  CI/CD", font=font(26, True), fill=INK)
    title = run["t"] if len(run["t"]) <= 78 else run["t"][:75] + "..."
    draw.text((40, 70), title, font=font(19), fill=INK)
    meta = f"Run #{run['n']}   ·   nhánh {run['b']}   ·   sự kiện {run['e']}   ·   {run['at'][:10]}"
    draw.text((40, 100), meta, font=font(15), fill=FAINT)

    label, color, bg, _ = status_style(run["c"])
    badge_w = 150
    draw.rounded_rectangle((width - 40 - badge_w, 34, width - 40, 74), radius=20, fill=bg)
    draw.text((width - 40 - badge_w + 28, 42), label, font=font(18, True), fill=color)

    y = 150
    draw.line((40, y - 12, width - 40, y - 12), fill=LINE, width=1)
    for job in jobs:
        label, color, bg, mark = status_style(job["conclusion"])
        draw.ellipse((46, y + 16, 80, y + 50), fill=bg)
        if mark == "✓":  # tự vẽ dấu tích vì nhiều font không có glyph này
            draw.line([(55, y + 33), (61, y + 40), (73, y + 26)], fill=color, width=4, joint="curve")
        else:
            draw.text((57, y + 20), mark, font=font(20, True), fill=color)
        draw.text((100, y + 12), job["name"], font=font(21, True), fill=INK)
        steps = job["steps"]
        failed = sum(1 for st in steps if st["conclusion"] not in ("success", "skipped"))
        skipped = sum(1 for st in steps if st["conclusion"] == "skipped")
        if not steps:
            detail = "không chạy (chỉ chạy khi merge vào main)"
        else:
            detail = f"{len(steps)} bước, {failed} bước lỗi"
            if skipped:
                detail += f", {skipped} bước điều kiện không cần chạy"
        draw.text((100, y + 42), detail, font=font(14), fill=FAINT)
        draw.text((width - 300, y + 22), f"{seconds(job)} giây", font=font(18), fill=SOFT)
        draw.rounded_rectangle((width - 170, y + 16, width - 40, y + 52), radius=18, fill=bg)
        draw.text((width - 150, y + 21), label, font=font(16, True), fill=color)
        y += row_h
        draw.line((40, y - 8, width - 40, y - 8), fill=LINE, width=1)

    note = "Nguồn: dữ liệu `gh run view` của GitHub Actions, vẽ lại bằng docs/tools/render_pipeline_image.py (không phải ảnh chụp trang web)."
    draw.text((40, height - 52), note, font=font(13), fill=FAINT)
    out.parent.mkdir(parents=True, exist_ok=True)
    image.save(out)


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit("usage: render_pipeline_image.py run.json out.png")
    render(json.loads(Path(sys.argv[1]).read_text(encoding="utf-8")), Path(sys.argv[2]))
    print(f"wrote {sys.argv[2]}")
