"""Vẽ các hình cho báo cáo quản lý dự án từ pm_model.

Usage: python build_pm_charts.py <thư-mục-ra>
"""
from __future__ import annotations

import sys
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyArrowPatch, FancyBboxPatch, Rectangle

import pm_model as m

plt.rcParams["font.family"] = ["Arial", "DejaVu Sans"]
plt.rcParams["axes.unicode_minus"] = False

INK = "#16243c"
BRAND = "#8c3b24"
LEAF = "#2f6b52"
AMBER = "#a9701a"
BLUE = "#4a7fa3"
GREY = "#76818f"
LIGHT = "#e8edf3"
RED = "#c0392b"

ROLE_COLOR = {"PM": "#1f3a5f", "FE": "#4a7fa3", "BE": "#2f6b52", "QA": "#a9701a"}
ROLE_LABEL = {
    "PM": "PM, Backend lead (Khôi)",
    "FE": "Frontend, AI (Quỳnh)",
    "BE": "Backend, DevOps (SV3, giả định)",
    "QA": "BA, QA (SV4, giả định)",
}

OUT = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("figures")
OUT.mkdir(parents=True, exist_ok=True)


def save(fig, name: str) -> None:
    fig.savefig(OUT / name, dpi=200, bbox_inches="tight", facecolor="white")
    plt.close(fig)
    print("wrote", OUT / name)


# ------------------------------------------------------------------ WBS
def fig_wbs() -> None:
    fig, ax = plt.subplots(figsize=(11, 7.2))
    ax.set_xlim(0, 11)
    ax.set_ylim(0, 7.2)
    ax.axis("off")
    ax.add_patch(FancyBboxPatch((0.1, 3.2), 1.5, 0.8, boxstyle="round,pad=0.03", fc=INK, ec=INK))
    ax.text(0.85, 3.6, "ULS\nQuản lý thư viện", ha="center", va="center", color="white", fontsize=9, fontweight="bold")
    phases = list(m.WBS_L1.items())
    hours = {}
    for w in m.WORK_PACKAGES:
        hours[w.wbs.split(".")[0]] = hours.get(w.wbs.split(".")[0], 0) + w.e
    ys = [6.7 - i * 0.98 for i in range(len(phases))]
    for (code, name), y in zip(phases, ys):
        ax.add_patch(FancyBboxPatch((2.2, y - 0.3), 2.3, 0.6, boxstyle="round,pad=0.02", fc=BLUE, ec=BLUE))
        ax.text(3.35, y, f"{code}. {name}\n{hours[code]:.0f} giờ", ha="center", va="center", color="white", fontsize=8.5, fontweight="bold")
        ax.plot([1.6, 1.9, 1.9, 2.2], [3.6, 3.6, y, y], color=GREY, lw=0.9)
        subs = [(k, v) for k, v in m.WBS_L2.items() if k.startswith(code + ".")]
        text = "   ".join(f"{k} {v}" for k, v in subs)
        # chia dòng gọn
        words, lines, cur = text.split("   "), [], ""
        for wd in words:
            if len(cur) + len(wd) > 62:
                lines.append(cur.strip())
                cur = wd + "   "
            else:
                cur += wd + "   "
        lines.append(cur.strip())
        ax.add_patch(FancyBboxPatch((4.9, y - 0.36), 6.0, 0.72, boxstyle="round,pad=0.02", fc=LIGHT, ec=GREY, lw=0.6))
        ax.text(5.0, y, "\n".join(lines), ha="left", va="center", fontsize=6.6, color=INK, linespacing=1.35)
        ax.plot([4.5, 4.9], [y, y], color=GREY, lw=0.9)
    ax.text(5.0, 0.1, "Cấp 2: nhóm gói công việc. Cấp 3 là các Work Package ở Bảng 2.2.", fontsize=7.5, color=GREY, va="bottom")
    save(fig, "wbs.png")


# ------------------------------------------------------------------ Mạng
POS = {
    "A": (0, 3.6), "C": (0, 2.2), "D": (1, 2.9), "B": (1, 5.0), "E": (2, 1.6), "F": (2, 3.2), "G": (2, 4.8),
    "H": (3, 1.4), "I": (4, 0.4), "J": (4, 2.4), "N": (4, 4.2), "Q": (4, 5.6), "K": (5, 2.4), "L": (5, 0.4),
    "M": (6, 1.4), "O": (7, 1.8), "R": (7, 3.6), "P": (8, 1.8), "S": (9, 2.6),
}


SHORT = {
    "A": "Khởi tạo, SOW", "B": "Dựng môi trường", "C": "Khảo sát", "D": "Phân tích SRS, US",
    "E": "Thiết kế KT, CSDL", "F": "Thiết kế API, UI", "G": "Thiết kế mô hình AI",
    "H": "Backend nền", "I": "Backend mượn trả", "J": "Frontend khung, kho", "K": "Frontend quầy, BC",
    "L": "AI gợi ý, dự báo", "M": "Tích hợp hệ thống", "N": "Test đơn vị, tích hợp",
    "O": "Test hệ thống, UAT", "Q": "Docker, CI/CD", "P": "Triển khai cloud", "R": "Tài liệu, đào tạo",
    "S": "Nghiệm thu",
}


def fig_network() -> None:
    bw, bh, sx, sy = 1.40, 1.02, 1.78, 1.12
    fig, ax = plt.subplots(figsize=(16.5, 8.8))
    ax.set_xlim(-0.2, 9 * sx + bw + 0.2)
    ax.set_ylim(-0.1, 7.5)
    ax.axis("off")
    ax.invert_yaxis()

    def center(code):
        cx, cy = POS[code]
        return cx * sx + bw / 2, cy * sy + bh / 2

    for a in m.ACTIVITIES:
        for pc, kind, lag in a.preds:
            (x1, y1), (x2, y2) = center(pc), center(a.code)
            crit = m.CPM[pc].critical and m.CPM[a.code].critical and abs(
                m.CPM[a.code].es - m.required_start(kind, m.CPM[pc].es, m.CPM[pc].ef, lag, a.dur)) < 1e-9
            color = RED if crit else "#9aa4b0"
            sx1 = x1 + bw / 2
            sx2 = x2 - bw / 2
            ax.add_patch(FancyArrowPatch((sx1, y1), (sx2, y2), arrowstyle="-|>", mutation_scale=10,
                                         color=color, lw=1.9 if crit else 0.9, shrinkA=0, shrinkB=0,
                                         connectionstyle="arc3,rad=0.0", zorder=1))
            if kind != "FS" or lag:
                ax.text(sx2 - 0.28, y2 + (y1 - y2) * 0.12 - 0.04, f"{kind}{'+' + str(lag) if lag > 0 else (str(lag) if lag < 0 else '')}", fontsize=6.4,
                        color=color, ha="center", va="bottom", zorder=3,
                        bbox=dict(boxstyle="round,pad=0.08", fc="white", ec="none", alpha=0.9))
    for a in m.ACTIVITIES:
        r = m.CPM[a.code]
        cx, cy = POS[a.code]
        x, y = cx * sx, cy * sy
        face = "#fbe3df" if r.critical else "#eaf1f8"
        edge = RED if r.critical else BLUE
        ax.add_patch(Rectangle((x, y), bw, bh, fc=face, ec=edge, lw=1.7 if r.critical else 0.9, zorder=4))
        for yy in (0.30, 0.58, 0.80):
            ax.plot([x, x + bw], [y + yy * bh * 1.0, y + yy * bh * 1.0], color=edge, lw=0.4, zorder=5)
        ax.text(x + 0.05, y + 0.15 * bh, f"{a.code}  {SHORT[a.code]}", fontsize=6.6, va="center", color=INK, fontweight="bold", zorder=6)
        ax.text(x + 0.05, y + 0.44 * bh, f"ES {r.es:.0f}    EF {r.ef:.0f}", fontsize=6.8, va="center", color=INK, zorder=6)
        ax.text(x + 0.05, y + 0.69 * bh, f"LS {r.ls:.0f}    LF {r.lf:.0f}", fontsize=6.8, va="center", color=INK, zorder=6)
        ax.text(x + 0.05, y + 0.90 * bh, f"d = {a.dur}", fontsize=6.4, va="center", color=GREY, zorder=6)
        ax.text(x + bw - 0.05, y + 0.90 * bh, f"Slack {r.slack:.0f}", fontsize=6.6, va="center", ha="right",
                color=RED if r.critical else LEAF, fontweight="bold", zorder=6)
    ax.text(0, -0.05, "Sơ đồ mạng hoạt động (AON). Đỏ: đường găng; xám: ràng buộc có dự trữ. FS là mặc định; SS+n: bắt đầu sau n tuần kể từ lúc tiền nhiệm bắt đầu; FF+n: kết thúc sau n tuần kể từ lúc tiền nhiệm kết thúc; SF: kết thúc sau khi tiền nhiệm bắt đầu.",
            fontsize=8, color=GREY, va="bottom")
    save(fig, "network.png")


# ------------------------------------------------------------------ Gantt
MILESTONES = [(2, "M1"), (3, "M2"), (5, "M3"), (9, "M4"), (12, "M5"), (14, "M6"), (15, "M7"), (16, "M8")]


def fig_gantt() -> None:
    acts = sorted(m.ACTIVITIES, key=lambda a: (m.CPM[a.code].es, m.CPM[a.code].ef, a.code))
    fig, ax = plt.subplots(figsize=(11.5, 6.4))
    n = len(acts)
    for i, a in enumerate(acts):
        r = m.CPM[a.code]
        y = n - i
        color = RED if r.critical else BLUE
        ax.barh(y, a.dur, left=r.es, height=0.56, color=color, edgecolor="white")
        if r.slack > 0:
            ax.barh(y, r.slack, left=r.ef, height=0.22, color="#c9d6e3", edgecolor="none")
        ax.text(-0.15, y, f"{a.code}  {a.name}", ha="right", va="center", fontsize=7.6, color=INK, clip_on=False)
    ax.set_yticks([])
    ax.set_xlim(0, m.WEEKS + 0.4)
    ax.set_ylim(0.2, n + 1.0)
    ax.set_xticks(range(0, m.WEEKS + 1))
    ax.set_xticklabels([f"{w}" for w in range(0, m.WEEKS + 1)], fontsize=7.5)
    ax.set_xlabel("Tuần (tuần 1 bắt đầu 21/09/2026)", fontsize=8.5)
    ax.grid(axis="x", color="#e5e5e5", lw=0.6)
    ax.set_axisbelow(True)
    for wk, lab in MILESTONES:
        ax.plot([wk, wk], [0.2, n + 0.7], color=AMBER, lw=0.8, ls="--")
        ax.scatter([wk], [n + 0.75], marker="D", color=AMBER, s=26, zorder=5)
        ax.text(wk, n + 0.95, lab, ha="center", va="bottom", fontsize=7, color=AMBER, fontweight="bold")
    for s in ("top", "right", "left"):
        ax.spines[s].set_visible(False)
    ax.set_title("Biểu đồ Gantt. Đỏ: hoạt động găng; xanh: có dự trữ (vạch xám nhạt là slack)", fontsize=9, loc="left", color=INK)
    save(fig, "gantt.png")


# ------------------------------------------------------------------ Tải nguồn lực
def fig_resource() -> None:
    total, by_role = m.weekly_plan()
    fig, ax = plt.subplots(figsize=(10.5, 4.6))
    weeks = list(range(1, m.WEEKS + 1))
    bottom = [0.0] * m.WEEKS
    for role in m.ROLES:
        vals = [by_role[role][w] for w in weeks]
        ax.bar(weeks, vals, bottom=bottom, color=ROLE_COLOR[role], label=ROLE_LABEL[role], width=0.72)
        bottom = [b + v for b, v in zip(bottom, vals)]
    cap = 4 * m.CAPACITY_PER_PERSON
    ax.axhline(cap, color=BRAND, ls="--", lw=1.2)
    ax.text(m.WEEKS + 0.45, cap, f"Năng lực nhóm {cap} giờ/tuần", color=BRAND, fontsize=7.8, va="bottom", ha="right")
    ax.set_xticks(weeks)
    ax.set_xlabel("Tuần", fontsize=8.5)
    ax.set_ylabel("Giờ kế hoạch", fontsize=8.5)
    ax.legend(fontsize=7.4, ncol=2, loc="upper right", frameon=False)
    ax.set_ylim(0, 78)
    for s in ("top", "right"):
        ax.spines[s].set_visible(False)
    ax.set_title("Giờ kế hoạch theo tuần và theo vai trò", fontsize=9, loc="left", color=INK)
    save(fig, "resource.png")


# ------------------------------------------------------------------ Heat map
def fig_heatmap() -> None:
    fig, ax = plt.subplots(figsize=(6.4, 5.2))
    cells = m.risk_matrix()
    for p in range(1, 6):
        for i in range(1, 6):
            score = p * i
            color = "#ea9999" if score >= 15 else ("#ffe599" if score >= 8 else "#b6d7a8")
            ax.add_patch(Rectangle((i - 0.5, p - 0.5), 1, 1, fc=color, ec="white", lw=2))
            ids = cells.get((p, i), [])
            if ids:
                ax.text(i, p, "\n".join(", ".join(ids[k:k + 2]) for k in range(0, len(ids), 2)), ha="center", va="center",
                        fontsize=8.5, fontweight="bold", color=INK)
    ax.set_xlim(0.5, 5.5)
    ax.set_ylim(0.5, 5.5)
    ax.set_xticks(range(1, 6))
    ax.set_yticks(range(1, 6))
    ax.set_xticklabels(["1\nRất thấp", "2\nThấp", "3\nVừa", "4\nCao", "5\nRất cao"], fontsize=7.5)
    ax.set_yticklabels(["1 (10%)", "2 (30%)", "3 (50%)", "4 (70%)", "5 (90%)"], fontsize=7.5)
    ax.set_xlabel("Tác động", fontsize=9)
    ax.set_ylabel("Xác suất", fontsize=9)
    for s in ax.spines.values():
        s.set_visible(False)
    ax.set_title("Ma trận rủi ro (xác suất x tác động)", fontsize=9.5, loc="left", color=INK)
    save(fig, "risk_matrix.png")


# ------------------------------------------------------------------ Tổ chức
def fig_org() -> None:
    fig, ax = plt.subplots(figsize=(10.5, 5.4))
    ax.set_xlim(0, 10.5)
    ax.set_ylim(0, 5.4)
    ax.axis("off")

    def box(x, y, w, h, text, fc, tc="white", fs=8.2):
        ax.add_patch(FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.03", fc=fc, ec=fc))
        ax.text(x + w / 2, y + h / 2, text, ha="center", va="center", color=tc, fontsize=fs, fontweight="bold", linespacing=1.3)

    box(3.7, 4.5, 3.1, 0.7, "Ban giám đốc thư viện\n(Khách hàng, Product Owner)", AMBER)
    box(7.5, 4.5, 2.7, 0.7, "Giảng viên hướng dẫn\n(TS. Lê Tỷ Khánh)", GREY)
    box(3.7, 3.1, 3.1, 0.8, "Quản lý dự án, Scrum Master\nBackend lead\nTrần Đình Khôi", ROLE_COLOR["PM"])
    ax.plot([5.25, 5.25], [4.5, 3.9], color=GREY, lw=1.2)
    ax.plot([6.8, 7.5], [4.85, 4.85], color=GREY, lw=1, ls="--")
    xs = [0.3, 2.9, 5.5, 8.1]
    items = [("FE", "Frontend và AI/ML\nNguyễn Như Quỳnh"), ("BE", "Backend và DevOps\nSV3 (nhân sự giả định)"), ("QA", "BA và Kiểm thử (QA)\nSV4 (nhân sự giả định)")]
    xs = [0.9, 4.0, 7.1]
    ax.plot([5.25, 5.25], [3.1, 2.55], color=GREY, lw=1.2)
    ax.plot([xs[0] + 1.25, xs[-1] + 1.25], [2.55, 2.55], color=GREY, lw=1.2)
    for x, (k, t) in zip(xs, items):
        ax.plot([x + 1.25, x + 1.25], [2.55, 2.2], color=GREY, lw=1.2)
        box(x, 1.4, 2.5, 0.8, t, ROLE_COLOR[k])
    notes = ["Giao diện, SEO,\nmô hình gợi ý,\ndự báo trả trễ", "API, CSDL, Docker,\nCI/CD, triển khai", "SRS, ca kiểm thử,\nUAT, tài liệu"]
    for x, t in zip(xs, notes):
        ax.text(x + 1.25, 1.2, t, ha="center", va="top", fontsize=7.4, color=INK)
    ax.text(0.2, 0.15, "Cấu trúc tổ chức nhóm dự án: 4 vai trò, 2 thành viên thật, 2 nhân sự giả định. Nét đứt: quan hệ tư vấn, đánh giá.", fontsize=8, color=GREY, va="bottom")
    save(fig, "org.png")


# ------------------------------------------------------------------ EVA
def fig_eva() -> None:
    pv, ev, ac = m.eva_series()
    bac = m.bac_money()
    weeks = list(range(1, m.WEEKS + 1))
    fig, ax = plt.subplots(figsize=(10.5, 5.2))
    ax.plot([0] + weeks, [0] + [v / 1e6 for v in pv], color=BLUE, lw=2.2, label="PV (kế hoạch)")
    ax.plot([0] + weeks, [0] + [v / 1e6 for v in ev], color=LEAF, lw=2.2, label="EV (giá trị thu được)")
    ax.plot([0] + weeks, [0] + [v / 1e6 for v in ac], color=BRAND, lw=2.2, label="AC (chi phí thực tế)")
    ax.axhline(bac / 1e6, color=GREY, ls=":", lw=1)
    ax.text(0.2, bac / 1e6 + 0.5, f"BAC = {bac / 1e6:.2f} triệu đ", fontsize=8, color=GREY, ha="left", va="bottom")
    for w in m.EVA_REPORT_WEEKS:
        ax.axvline(w, color="#d0d0d0", lw=0.8, ls="--")
        ax.scatter([w] * 3, [pv[w - 1] / 1e6, ev[w - 1] / 1e6, ac[w - 1] / 1e6], color=[BLUE, LEAF, BRAND], s=26, zorder=5)
        ax.text(w, 33.2, f"Báo cáo T{w}", ha="center", fontsize=7.4, color=GREY)
    ax.set_xlabel("Tuần", fontsize=8.5)
    ax.set_ylabel("Triệu đồng (tích luỹ)", fontsize=8.5)
    ax.set_xticks(range(0, m.WEEKS + 1))
    ax.set_xlim(0, m.WEEKS + 0.3)
    ax.set_ylim(0, 34)
    ax.legend(fontsize=8, frameon=False, loc="lower right", bbox_to_anchor=(1.0, 0.04))
    for s in ("top", "right"):
        ax.spines[s].set_visible(False)
    ax.set_title("Đường cong PV, EV, AC của dự án mô phỏng", fontsize=9.5, loc="left", color=INK)
    save(fig, "eva_curves.png")

    pts = m.eva_points()
    fig, ax = plt.subplots(figsize=(10.5, 4.2))
    ax.plot(weeks, [p.spi for p in pts], color=BLUE, lw=2, marker="o", ms=3.5, label="SPI")
    ax.plot(weeks, [p.cpi for p in pts], color=BRAND, lw=2, marker="o", ms=3.5, label="CPI")
    ax.axhline(1.0, color=GREY, lw=0.8)
    ax.axhspan(0.95, 1.15, color="#b6d7a8", alpha=0.25)
    ax.axhspan(0.85, 0.95, color="#ffe599", alpha=0.35)
    ax.axhspan(0.6, 0.85, color="#ea9999", alpha=0.3)
    ax.text(m.WEEKS + 0.2, 1.02, "xanh", fontsize=7, color=LEAF, va="center")
    ax.text(m.WEEKS + 0.2, 0.9, "vàng", fontsize=7, color=AMBER, va="center")
    ax.text(m.WEEKS + 0.2, 0.78, "đỏ", fontsize=7, color=RED, va="center")
    ax.set_ylim(0.75, 1.1)
    ax.set_xlim(1, m.WEEKS + 0.8)
    ax.set_xticks(weeks)
    ax.set_xlabel("Tuần", fontsize=8.5)
    ax.legend(fontsize=8, frameon=False, ncol=2, loc="upper left")
    for s in ("top", "right"):
        ax.spines[s].set_visible(False)
    ax.set_title("Chỉ số hiệu suất tiến độ (SPI) và chi phí (CPI) theo tuần", fontsize=9.5, loc="left", color=INK)
    save(fig, "eva_indices.png")


# ------------------------------------------------------------------ Tài chính
def fig_cash() -> None:
    f = m.finance()
    years = ["Năm 0", "Năm 1", "Năm 2", "Năm 3"]
    flows = [v / 1e6 for v in f["flows"]]
    cum, run = [], 0.0
    for v in flows:
        run += v
        cum.append(run)
    fig, ax = plt.subplots(figsize=(9.5, 4.4))
    colors = [BRAND if v < 0 else LEAF for v in flows]
    ax.bar(years, flows, color=colors, width=0.55, label="Dòng tiền ròng")
    ax.plot(years, cum, color=INK, marker="o", lw=2, label="Luỹ kế (không chiết khấu)")
    ax.axhline(0, color=GREY, lw=0.8)
    for x, v in zip(years, flows):
        ax.text(x, v + (2 if v >= 0 else -5.5), f"{v:,.1f}".replace(",", " "), ha="center", fontsize=8, color=INK)
    ax.set_ylabel("Triệu đồng", fontsize=8.5)
    ax.legend(fontsize=8, frameon=False)
    for s in ("top", "right"):
        ax.spines[s].set_visible(False)
    ax.set_title("Dòng tiền dự án trong 3 năm", fontsize=9.5, loc="left", color=INK)
    save(fig, "cashflow.png")


# ------------------------------------------------------------------ Bên liên quan
def fig_stakeholder() -> None:
    fig, ax = plt.subplots(figsize=(7.2, 5.2))
    ax.set_xlim(0, 10)
    ax.set_ylim(0, 10)
    ax.axhline(5, color=GREY, lw=0.8)
    ax.axvline(5, color=GREY, lw=0.8)
    ax.text(0.2, 9.7, "Thoả mãn (quyền lực cao, quan tâm thấp)", fontsize=7.2, color=GREY, va="top")
    ax.text(5.2, 9.7, "Quản lý chặt (quyền lực cao, quan tâm cao)", fontsize=7.2, color=GREY, va="top")
    ax.text(0.2, 4.8, "Theo dõi", fontsize=7.2, color=GREY, va="top")
    ax.text(5.2, 4.8, "Thông tin đầy đủ (quyền lực thấp, quan tâm cao)", fontsize=7.2, color=GREY, va="top")
    pts = [("Ban giám đốc\nthư viện", 7.4, 9.0), ("Giảng viên\nhướng dẫn", 8.2, 7.2), ("Thủ thư", 8.4, 4.0), ("Sinh viên", 7.6, 2.0),
           ("Giảng viên\n(bạn đọc)", 6.2, 2.9), ("Phòng CNTT\ncủa trường", 3.2, 6.2), ("Nhà cung cấp\nhạ tầng", 1.6, 2.2)]
    for name, x, y in pts:
        ax.scatter([x], [y], color=BLUE, s=60, zorder=4)
        ax.text(x, y + 0.35, name, ha="center", va="bottom", fontsize=7.6, color=INK)
    ax.set_xlabel("Mức quan tâm", fontsize=8.5)
    ax.set_ylabel("Quyền lực, ảnh hưởng", fontsize=8.5)
    ax.set_xticks([])
    ax.set_yticks([])
    for s in ax.spines.values():
        s.set_visible(False)
    ax.set_title("Ma trận quyền lực, quan tâm của các bên liên quan", fontsize=9.5, loc="left", color=INK)
    save(fig, "stakeholders.png")


if __name__ == "__main__":
    fig_wbs()
    fig_network()
    fig_gantt()
    fig_resource()
    fig_heatmap()
    fig_org()
    fig_eva()
    fig_cash()
    fig_stakeholder()
