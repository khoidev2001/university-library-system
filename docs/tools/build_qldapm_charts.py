"""Hình riêng cho báo cáo thực hành Quản lý dự án phần mềm.

Usage: python build_qldapm_charts.py <thư-mục-hình>
"""
from __future__ import annotations

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyArrowPatch, FancyBboxPatch, Rectangle

import build_pm_charts as bc
import pm_model as m
import qldapm_model as q

INK, BRAND, LEAF, AMBER, BLUE, GREY, RED = bc.INK, bc.BRAND, bc.LEAF, bc.AMBER, bc.BLUE, bc.GREY, bc.RED


# ------------------------------------------------------------------ Cây WBS cấp 3
def fig_wbs_tree() -> None:
    n_rows = sum(len(acts) for _, _, groups in q.LAB_WBS for _, _, acts in groups)
    row_h = 0.62
    height = n_rows * row_h + 1.2
    fig, ax = plt.subplots(figsize=(13.2, height * 0.62))
    ax.set_xlim(0, 13.2)
    ax.set_ylim(0, height)
    ax.axis("off")
    ax.invert_yaxis()
    x0, x1, x2, x3 = 0.15, 1.9, 4.5, 7.2
    w0, w1, w2, w3 = 1.35, 2.3, 2.4, 5.8
    y = 0.4
    ax.add_patch(FancyBboxPatch((x0, 0.2), w0, 0.5, boxstyle="round,pad=0.02", fc=INK, ec=INK))
    ax.text(x0 + w0 / 2, 0.45, "ULS", ha="center", va="center", color="white", fontsize=9, fontweight="bold")
    root_y = None
    phase_ys = []
    for pcode, pname, groups in q.LAB_WBS:
        phase_rows = sum(len(acts) for _, _, acts in groups)
        py = y + (phase_rows * row_h) / 2 - row_h / 2
        phase_ys.append(py)
        ax.add_patch(FancyBboxPatch((x1, py), w1, 0.5, boxstyle="round,pad=0.02", fc=BLUE, ec=BLUE))
        ax.text(x1 + w1 / 2, py + 0.25, f"{pcode}. {pname}", ha="center", va="center", color="white", fontsize=8.6, fontweight="bold")
        for gcode, gname, acts in groups:
            g_rows = len(acts)
            gy = y + (g_rows * row_h) / 2 - row_h / 2
            ax.add_patch(FancyBboxPatch((x2, gy), w2, 0.5, boxstyle="round,pad=0.02", fc="#dfe8f1", ec=BLUE, lw=0.8))
            ax.text(x2 + w2 / 2, gy + 0.25, f"{gcode} {gname}", ha="center", va="center", color=INK, fontsize=7.6, fontweight="bold")
            ax.plot([x1 + w1, x1 + w1 + 0.25, x1 + w1 + 0.25, x2], [py + 0.25, py + 0.25, gy + 0.25, gy + 0.25], color=GREY, lw=0.8)
            for i, a in enumerate(acts):
                wy = y + i * row_h
                crit = a != "LOE" and m.CPM[a].critical
                face = "#fbe3df" if crit else ("#eef2e8" if a == "LOE" else "#eaf1f8")
                edge = RED if crit else (LEAF if a == "LOE" else BLUE)
                ax.add_patch(Rectangle((x3, wy), w3, 0.5, fc=face, ec=edge, lw=1.2 if crit else 0.7))
                label = f"{q.WP_CODE[a]}  {q.wp_name(a)}" + (f"   [{a}]" if a != "LOE" else "")
                ax.text(x3 + 0.08, wy + 0.25, label, ha="left", va="center", fontsize=7.4, color=INK)
                ax.plot([x2 + w2, x2 + w2 + 0.25, x2 + w2 + 0.25, x3], [gy + 0.25, gy + 0.25, wy + 0.25, wy + 0.25], color=GREY, lw=0.7)
            y += g_rows * row_h
    for py in phase_ys:
        ax.plot([x0 + w0, x0 + w0 + 0.2, x0 + w0 + 0.2, x1], [0.45, 0.45, py + 0.25, py + 0.25], color=GREY, lw=0.8)
    ax.text(0.15, height - 0.1, "Cấp 1: pha. Cấp 2: nhóm công việc. Cấp 3: Work Package (đỏ: găng; chữ trong [ ] là mã trong sơ đồ mạng). Công việc chi tiết nằm ở bảng 2.3.",
            fontsize=7.4, color=GREY, va="bottom")
    bc.save(fig, "wbs_tree.png")


# ------------------------------------------------------------------ Gantt trước và sau nén
def fig_compress_gantt() -> None:
    plan = q.compress_plan()
    base = m.CPM
    comp = m.run_cpm(plan["C"]["acts"])
    acts = sorted(m.ACTIVITIES, key=lambda a: (base[a.code].es, base[a.code].ef, a.code))
    n = len(acts)
    fig, ax = plt.subplots(figsize=(11.5, 6.6))
    for i, a in enumerate(acts):
        y = n - i
        b, c = base[a.code], comp[a.code]
        ax.barh(y + 0.17, b.ef - b.es, left=b.es, height=0.3, color="#c9d6e3", edgecolor="white")
        crit = c.critical
        ax.barh(y - 0.17, c.ef - c.es, left=c.es, height=0.3, color=RED if crit else BLUE, edgecolor="white")
        ax.text(-0.15, y, f"{a.code}  {a.name}", ha="right", va="center", fontsize=7.4, color=INK, clip_on=False)
    ax.axvline(m.PROJECT_WEEKS, color="#c9d6e3", lw=1.5, ls="--")
    end_c = max(r.ef for r in comp.values())
    ax.axvline(end_c, color=RED, lw=1.5, ls="--")
    ax.text(m.PROJECT_WEEKS + 0.1, n + 0.7, f"Gốc {m.PROJECT_WEEKS:.0f} tuần", fontsize=8, color=GREY, va="bottom")
    ax.text(end_c - 0.1, n + 0.7, f"Sau nén {end_c:.1f} tuần", fontsize=8, color=RED, va="bottom", ha="right", fontweight="bold")
    ax.set_yticks([])
    ax.set_xlim(0, m.WEEKS + 0.4)
    ax.set_ylim(0.2, n + 1.3)
    ax.set_xticks(range(0, m.WEEKS + 1))
    ax.set_xlabel("Tuần", fontsize=8.5)
    ax.grid(axis="x", color="#e5e5e5", lw=0.6)
    ax.set_axisbelow(True)
    for s in ("top", "right", "left"):
        ax.spines[s].set_visible(False)
    ax.set_title("Gantt trước nén (xám nhạt) và sau nén (đỏ: găng, xanh: có dự trữ)", fontsize=9, loc="left", color=INK)
    bc.save(fig, "compress_gantt.png")


def fig_options() -> None:
    plan = q.compress_plan()
    labels = ["A. Chỉ crashing", "B. Chỉ fast-tracking", "C. Kết hợp"]
    ends = [plan["A"]["end"], plan["B"]["end"], plan["C"]["end"]]
    costs = [plan["A"]["cost"] / 1e6, plan["B"]["cost"] / 1e6, plan["C"]["cost"] / 1e6]
    fig, (a1, a2) = plt.subplots(1, 2, figsize=(10.5, 4.0))
    colors = [GREY, GREY, LEAF]
    a1.bar(labels, ends, color=colors, width=0.55)
    a1.axhline(plan["target"], color=RED, ls="--", lw=1.4)
    a1.text(2.45, plan["target"] + 0.1, f"Mục tiêu {plan['target']:.1f} tuần", color=RED, fontsize=8, ha="right")
    a1.axhline(m.PROJECT_WEEKS, color=GREY, ls=":", lw=1)
    a1.text(-0.4, m.PROJECT_WEEKS + 0.1, "Gốc 16 tuần", color=GREY, fontsize=8)
    for i, v in enumerate(ends):
        a1.text(i, v + 0.15, f"{v:.1f}", ha="center", fontsize=9, fontweight="bold")
    a1.set_ylim(0, 18)
    a1.set_ylabel("Thời gian dự án (tuần)", fontsize=8.5)
    a1.set_title("Thời gian sau nén", fontsize=9.5, loc="left", color=INK)
    a2.bar(labels, costs, color=colors, width=0.55)
    for i, v in enumerate(costs):
        a2.text(i, v + 0.03, f"{v:.2f}", ha="center", fontsize=9, fontweight="bold")
    a2.set_ylabel("Chi phí tăng thêm (triệu đồng)", fontsize=8.5)
    a2.set_ylim(0, max(costs) * 1.3)
    a2.set_title("Chi phí tăng thêm", fontsize=9.5, loc="left", color=INK)
    for a in (a1, a2):
        for s in ("top", "right"):
            a.spines[s].set_visible(False)
        a.tick_params(axis="x", labelsize=8)
    bc.save(fig, "compress_options.png")


# ------------------------------------------------------------------ Vòng đời lỗi
def fig_defect() -> None:
    fig, ax = plt.subplots(figsize=(12.6, 5.4))
    ax.set_xlim(0, 12.6)
    ax.set_ylim(0, 5.4)
    ax.axis("off")
    ax.invert_yaxis()
    bw, bh = 1.8, 0.95
    pos = {
        "dup": (0.2, 0.25, "Trùng\n(Duplicate)", GREY),
        "rejected": (2.3, 0.25, "Từ chối\n(Rejected)", GREY),
        "deferred": (4.4, 0.25, "Hoãn\n(Deferred)", GREY),
        "new": (0.2, 2.1, "Mới\n(New)", BLUE),
        "assigned": (2.3, 2.1, "Đã giao\n(Assigned)", BLUE),
        "progress": (4.4, 2.1, "Đang sửa\n(In Progress)", BLUE),
        "fixed": (6.5, 2.1, "Đã sửa\n(Fixed)", AMBER),
        "retest": (8.6, 2.1, "Kiểm thử lại\n(Retest)", AMBER),
        "closed": (10.7, 2.1, "Đóng\n(Closed)", LEAF),
        "reopen": (7.5, 4.0, "Mở lại\n(Reopened)", RED),
    }
    for key, (x, y, text, color) in pos.items():
        ax.add_patch(FancyBboxPatch((x, y), bw, bh, boxstyle="round,pad=0.03", fc=color, ec=color))
        ax.text(x + bw / 2, y + bh / 2, text, ha="center", va="center", color="white", fontsize=8.8, fontweight="bold", linespacing=1.25)

    def line(p0, p1, label="", lx=None, ly=None):
        ax.add_patch(FancyArrowPatch(p0, p1, arrowstyle="-|>", mutation_scale=11, color=INK, lw=1.2))
        if label:
            mx = lx if lx is not None else (p0[0] + p1[0]) / 2
            my = ly if ly is not None else (p0[1] + p1[1]) / 2
            ax.text(mx, my, label, fontsize=7.4, ha="center", va="center", color=INK,
                    bbox=dict(boxstyle="round,pad=0.12", fc="white", ec="none", alpha=0.95))

    mid = bh / 2
    line((2.0, 2.1 + mid), (2.3, 2.1 + mid))
    line((4.1, 2.1 + mid), (4.4, 2.1 + mid))
    line((6.2, 2.1 + mid), (6.5, 2.1 + mid))
    line((8.3, 2.1 + mid), (8.6, 2.1 + mid))
    line((10.4, 2.1 + mid), (10.7, 2.1 + mid))
    ax.text(1.1, 3.45, "QA hoặc PM phân loại,\nđặt mức độ", fontsize=7.2, ha="center", color=GREY)
    ax.text(3.2, 3.45, "Dev nhận việc", fontsize=7.2, ha="center", color=GREY)
    ax.text(4.0, 3.45, "Sửa xong, tạo Pull Request", fontsize=7.2, ha="center", color=GREY)
    ax.text(7.4, 3.45, "Gộp, CI xanh", fontsize=7.2, ha="center", color=GREY)
    ax.text(11.6, 3.3, "Đạt thì đóng lỗi", fontsize=7.6, ha="center", color=LEAF, fontweight="bold")
    line((1.1, 2.1), (1.1, 1.2), "Trùng")
    line((3.2, 2.1), (3.2, 1.2), "Không phải lỗi")
    line((5.3, 2.1), (5.3, 1.2), "Hoãn có lý do")
    line((9.5, 3.05), (9.3, 4.45), "Không đạt", lx=10.15, ly=3.75)
    ax.add_patch(FancyArrowPatch((7.5, 4.5), (5.3, 3.05), arrowstyle="-|>", mutation_scale=11, color=INK, lw=1.2, connectionstyle="arc3,rad=-0.25"))
    ax.text(6.1, 4.2, "Sửa lại", fontsize=7.4, ha="center", color=INK, bbox=dict(boxstyle="round,pad=0.12", fc="white", ec="none", alpha=0.95))
    ax.text(0.2, 5.3, "Vòng đời lỗi. Mọi chuyển trạng thái ghi trên GitHub Issues kèm người thực hiện và thời điểm.", fontsize=8, color=GREY, va="bottom")
    bc.save(fig, "defect_lifecycle.png")


# ------------------------------------------------------------------ EVA theo công việc
def fig_eva_wp() -> None:
    rows = [r for r in q.eva_by_wp(8) if r["pv"] > 0]
    rows = sorted(rows, key=lambda r: r["wbs"], reverse=False)
    fig, ax = plt.subplots(figsize=(10.5, 7.2))
    n = len(rows)
    h = 0.26
    for i, r in enumerate(rows):
        y = n - i
        ax.barh(y + h, r["pv"] / 1e6, height=h, color=BLUE, label="PV" if i == 0 else None)
        ax.barh(y, r["ev"] / 1e6, height=h, color=LEAF, label="EV" if i == 0 else None)
        ax.barh(y - h, r["ac"] / 1e6, height=h, color=BRAND, label="AC" if i == 0 else None)
        ax.text(-0.05, y, f"{r['wbs']} {r['name'][:34]}", ha="right", va="center", fontsize=7.2, color=INK, clip_on=False)
    ax.set_yticks([])
    ax.set_xlabel("Triệu đồng (luỹ kế đến hết tuần 8)", fontsize=8.5)
    ax.legend(fontsize=8, frameon=False, loc="lower right")
    for s in ("top", "right", "left"):
        ax.spines[s].set_visible(False)
    ax.set_title("PV, EV, AC của từng công việc tại mốc 50% tiến độ", fontsize=9.5, loc="left", color=INK)
    fig.subplots_adjust(left=0.36)
    bc.save(fig, "eva_wp.png")


if __name__ == "__main__":
    fig_wbs_tree()
    fig_compress_gantt()
    fig_options()
    fig_defect()
    fig_eva_wp()
