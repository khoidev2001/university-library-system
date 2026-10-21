"""Liệt kê các API của backend từ mã nguồn (controller NestJS) kèm quyền truy cập.

Dùng cho phụ lục "Danh sách API" của báo cáo; số lượng đối chiếu được với OpenAPI của hệ thống đang chạy
(mô tả từng API lấy từ OpenAPI, quyền truy cập đọc từ decorator @Roles và @Public).
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CTRL_DIR = ROOT / "backend" / "src" / "modules"

ROLE_LABEL = {
    ("READER",): "Bạn đọc",
    ("LIBRARIAN",): "Thủ thư, quản trị",
    ("ADMIN",): "Quản trị",
    ("LIBRARIAN", "READER"): "Bạn đọc, thủ thư, quản trị",
}

_ROUTE = re.compile(r"@(Get|Post|Patch|Put|Delete)\(([^)]*)\)")
_SIG = re.compile(r"\n {2}(?:async\s+)?\w+\s*\(")
_BLANK = "\n\n"
_BODY_END ="\n  }\n"


@dataclass
class Endpoint:
    group: str
    method: str
    path: str
    access: str


def _first_string(args: str) -> str:
    m = re.search(r"'([^']*)'", args)
    return m.group(1) if m else ""


def collect() -> list[Endpoint]:
    """Mỗi route: gom các decorator nằm giữa thân phương thức trước và chữ ký của chính nó."""
    out: list[Endpoint] = []
    for f in sorted(CTRL_DIR.rglob("*.controller.ts")):
        src = f.read_text(encoding="utf-8")
        cm = re.search(r"@Controller\(([^)]*)\)", src)
        if not cm:
            continue
        prefix = _first_string(cm.group(1))
        class_start = src.index("export class")
        head = src[src.rfind(_BLANK, 0, class_start) : class_start]  # khối decorator ngay trước class
        class_public = "@Public()" in head
        class_roles = re.search(r"@Roles\(([^)]*)\)", head)
        cursor = class_start
        for m in _ROUTE.finditer(src, cursor):
            if m.start() < cursor:
                continue
            sig = _SIG.search(src, m.end())
            chunk_end = sig.end() if sig else len(src)
            chunk = src[cursor:chunk_end]
            last_close = chunk.rfind(_BODY_END)
            decor = chunk[last_close + 1 :] if last_close >= 0 else chunk
            cursor = chunk_end
            sub = _first_string(m.group(2))
            roles = re.search(r"@Roles\(([^)]*)\)", decor) or class_roles
            if "@Public()" in decor or class_public:
                access = "Công khai"
            elif roles:
                key = tuple(sorted(r.strip().split(".")[-1] for r in roles.group(1).split(",") if r.strip()))
                access = ROLE_LABEL.get(key, "/".join(key))
            else:
                access = "Đã đăng nhập"
            if prefix == "internal":
                access = "Khoá nội bộ (X-Internal-Key)"
            full = "/api/" + "/".join(p for p in (prefix, sub) if p)
            full = re.sub(r":(\w+)", lambda x: "{" + x.group(1) + "}", full)
            out.append(Endpoint(prefix.split("/")[0] or "root", m.group(1).upper(), full, access))
    return out


if __name__ == "__main__":
    eps = collect()
    print(len(eps))
    for e in eps:
        print(e.method, e.path, "|", e.access)
