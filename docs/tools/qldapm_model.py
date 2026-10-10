"""Phần bổ sung cho báo cáo thực hành Quản lý dự án phần mềm (LAB 1 đến 3), dựng trên pm_model.

Gồm: cấu trúc WBS khớp tên với sơ đồ mạng, từ điển WBS, nén tiến độ 20%, EVA theo từng công việc.
"""
from __future__ import annotations

import math
from dataclasses import dataclass

import pm_model as m
from pm_model import ACT, ACTIVITIES, RATE, Activity

# --------------------------------------------------------------------------- WBS khớp tên
# (mã pha, tên pha, [(mã nhóm, tên nhóm, [mã hoạt động])]). "LOE" là công việc duy trì, không nằm trong mạng.
LAB_WBS = [
    ("1", "Khởi tạo", [("1.1", "Khởi động dự án và môi trường", ["A", "B"])]),
    ("2", "Phân tích", [("2.1", "Khảo sát và đặc tả yêu cầu", ["C", "D"])]),
    ("3", "Thiết kế", [("3.1", "Thiết kế hệ thống", ["E", "F", "G"])]),
    ("4", "Phát triển", [("4.1", "Backend", ["H", "I"]), ("4.2", "Frontend", ["J", "K"]), ("4.3", "AI và tích hợp", ["L", "M"])]),
    ("5", "Kiểm thử", [("5.1", "Kiểm thử phần mềm", ["N", "O"])]),
    ("6", "Triển khai", [("6.1", "Đóng gói và triển khai", ["Q", "P"]), ("6.2", "Tài liệu và đào tạo", ["R"])]),
    ("7", "Quản lý dự án", [("7.1", "Điều hành và kiểm soát", ["LOE"]), ("7.2", "Nghiệm thu và bàn giao", ["S"])]),
]
LOE_NAME = "Điều hành, theo dõi, rủi ro, EVA (duy trì)"


def wp_name(code: str) -> str:
    return LOE_NAME if code == "LOE" else ACT[code].name


def wp_code_map() -> dict[str, str]:
    """Mã hoạt động trong mạng -> mã WBS cấp 3 (ví dụ H -> 4.1.1)."""
    out: dict[str, str] = {}
    for _, _, groups in LAB_WBS:
        for gcode, _, acts in groups:
            for i, a in enumerate(acts, start=1):
                out[a] = f"{gcode}.{i}"
    return out


WP_CODE = wp_code_map()


def act_tasks(code: str) -> list[m.WorkPackage]:
    return sorted([w for w in m.WORK_PACKAGES if w.activity == code], key=lambda w: m.wbs_sort_key(w.wbs))


def act_hours(code: str) -> float:
    return sum(w.e for w in act_tasks(code))


def act_cost(code: str) -> float:
    return act_hours(code) * RATE


def act_owner_roles(code: str) -> str:
    roles: dict[str, float] = {}
    for w in act_tasks(code):
        roles[w.owner] = roles.get(w.owner, 0) + w.e
    return ", ".join(r for r, _ in sorted(roles.items(), key=lambda kv: -kv[1]))


# --------------------------------------------------------------------------- Từ điển WBS
DICTIONARY = {
    "H": {
        "mo_ta": "Xây dựng nền tảng Backend: xác thực JWT, phân quyền theo vai trò, quản lý bạn đọc và chính sách mượn, quản lý sách, tác giả, thể loại, bản sao, nhập sách theo ISBN và nạp dữ liệu mẫu.",
        "san_pham": "API auth, users, policies; API books, authors, categories, copies; script seed và nhập ISBN; tài liệu Swagger cho các API này.",
        "tieu_chi": "Mọi API trả đúng mã trạng thái và mã lỗi nghiệp vụ; Reader gọi API ghi bị 403; mật khẩu băm bcrypt; unit test coverage từ 80%; migration chạy được trên PostgreSQL thật.",
        "gia_dinh": "Dữ liệu sách mẫu goodbooks-10k có ISBN; thiết kế CSDL (3.1.1) và thiết kế API (3.1.2) đã được duyệt.",
        "rui_ro": "R2 (Google Books giới hạn tần suất), R7 (dữ liệu thiếu ISBN).",
        "moc": "M4: Backend và Frontend lõi chạy đầu-cuối (tuần 9).",
    },
    "I": {
        "mo_ta": "Xây dựng nghiệp vụ lõi của thư viện: mượn, trả, gia hạn, báo mất sách theo quy tắc BR-01 đến BR-08; tính và thu phạt trả trễ, mất sách; tìm kiếm, lọc, phân trang; bốn báo cáo thống kê.",
        "san_pham": "API loans, fines, search, reports; bộ quy tắc phạt theo ngày lịch; ghi nhận khoản phạt và thu tiền.",
        "tieu_chi": "Giao dịch mượn trả atomic (lỗi giữa chừng thì rollback); phạt = số ngày trễ theo ngày lịch x mức phạt chính sách; ca biên 23:59 và 00:01 đúng; e2e chạy trên DB thật, không chỉ mock.",
        "gia_dinh": "Backend nền (4.1.1) đã chạy được ít nhất 1 tuần (quan hệ SS+1); chính sách mượn đã được khách hàng chốt.",
        "rui_ro": "R10 (sai quy tắc phạt), R6 (ước lượng thấp), R11 (thành viên vắng).",
        "moc": "M4: mượn trả đầu-cuối (tuần 9).",
    },
    "L": {
        "mo_ta": "Xây dựng hai mô hình học máy: gợi ý sách theo nội dung và theo hành vi mượn; dự báo nguy cơ trả trễ bằng hồi quy logistic và rừng ngẫu nhiên. Có huấn luyện lại và số đo chất lượng.",
        "san_pham": "Dịch vụ AI (FastAPI) với các điểm cuối recommend, predict-overdue, train, metrics; báo cáo chỉ số mô hình.",
        "tieu_chi": "Precision@5 từ 0,15 và ROC-AUC từ 0,70 trên dữ liệu kiểm tra; coverage từ 80%; dịch vụ không sẵn sàng thì backend vẫn mượn trả được (fallback).",
        "gia_dinh": "Dữ liệu mượn trả mô phỏng đủ lớn (hơn 10.000 phiếu); Backend mượn trả đã cung cấp dữ liệu huấn luyện (quan hệ SS+2).",
        "rui_ro": "R3 (độ chính xác thấp), R1 (hạ tầng ngủ làm mất mô hình khi khởi động lại).",
        "moc": "M5: AI đạt ngưỡng chỉ số (tuần 12).",
    },
}


def dictionary_rows(code: str) -> list[tuple[str, str]]:
    d = DICTIONARY[code]
    a = ACT[code]
    r = m.CPM[code]
    tasks = act_tasks(code)
    o = sum(w.o for w in tasks)
    mm = sum(w.m for w in tasks)
    p = sum(w.p for w in tasks)
    e = sum(w.e for w in tasks)
    preds = ", ".join(f"{ACT_NAME_SHORT(pc)} ({kind}{'+' + str(lag) if lag else ''})" for pc, kind, lag in a.preds) or "Không"
    succs = ", ".join(f"{ACT_NAME_SHORT(s.code)}" for s in ACTIVITIES if any(pc == code for pc, _, _ in s.preds)) or "Không"
    return [
        ("Mã WBS (mã mạng)", f"{WP_CODE[code]} ({code})"),
        ("Tên gói công việc", a.name),
        ("Mô tả công việc", d["mo_ta"]),
        ("Sản phẩm bàn giao", d["san_pham"]),
        ("Tiêu chí chấp nhận", d["tieu_chi"]),
        ("Công việc chi tiết", "; ".join(f"{w.wbs} {w.name}" for w in tasks)),
        ("Vai trò thực hiện", act_owner_roles(code)),
        ("Công sức (giờ): O, M, P, E", f"{m.fmt_h(o)}; {m.fmt_h(mm)}; {m.fmt_h(p)}; {m.fmt_h(e)}"),
        ("Chi phí ước tính", f"{m.fmt_vnd(e * RATE)} đồng"),
        ("Thời lượng, lịch", f"{a.dur} tuần; ES = {int(r.es)}, EF = {int(r.ef)}, Slack = {int(r.slack)}"),
        ("Phụ thuộc (tiền nhiệm)", preds),
        ("Hậu nhiệm", succs),
        ("Giả định", d["gia_dinh"]),
        ("Rủi ro liên quan", d["rui_ro"]),
        ("Mốc liên quan", d["moc"]),
    ]


def ACT_NAME_SHORT(code: str) -> str:
    return f"{WP_CODE[code]} {ACT[code].name}"


# --------------------------------------------------------------------------- Nén tiến độ
TARGET_REDUCTION = 0.20
PREMIUM = {  # phụ phí crashing mỗi tuần nén, tính trên chi phí trung bình mỗi tuần của hoạt động
    "A": 0.5, "C": 0.5, "B": 0.6, "D": 0.5, "E": 0.6, "F": 0.6, "G": 0.7, "H": 0.8, "I": 0.8, "J": 0.7, "K": 0.7,
    "L": 0.9, "M": 0.8, "N": 0.5, "O": 0.5, "Q": 0.6, "P": 0.6, "R": 0.5, "S": 0.5,
}
STEP = 0.5

# Phương án fast-tracking: (mã, hoạt động sau, hoạt động trước, loại, lag, mô tả, giờ làm lại dự phòng)
FAST_TRACK = [
    ("FT1", "M", [("K", "FS", -1), ("L", "FS", -1)], "Bắt đầu tích hợp 1 tuần trước khi Frontend và AI xong hẳn (FS với lead 1 tuần)", 12),
    ("FT2", "P", [("O", "SS", 0)], "Dựng môi trường cloud ngay khi bắt đầu kiểm thử hệ thống thay vì sau 1 tuần (SS+1 thành SS+0)", 6),
    ("FT3", "S", [("P", "SS", 0)], "Soạn hồ sơ nghiệm thu song song với triển khai (FS thành SS+0 với triển khai)", 4),
    ("FT4", "E", [("D", "SS", 0)], "Bắt đầu thiết kế kiến trúc và CSDL ngay khi bắt đầu phân tích (SS+1 thành SS+0); API và giao diện SS+2 thành SS+1", 8),
]
FT4_EXTRA = ("F", [("D", "SS", 1)])


def clone(acts: list[Activity]) -> list[Activity]:
    return [Activity(a.code, a.name, a.dur, list(a.preds), a.cls) for a in acts]


def apply_fast_track(acts: list[Activity], ids: list[str] | None = None) -> list[Activity]:
    out = clone(acts)
    for fid, code, rels, _, _ in FAST_TRACK:
        if ids is not None and fid not in ids:
            continue
        for a in out:
            if a.code == code:
                newp = []
                for p, k, l in a.preds:
                    repl = next(((rp, rk, rl) for rp, rk, rl in rels if rp == p), None)
                    newp.append(repl if repl else (p, k, l))
                a.preds = newp
        if fid == "FT4":
            for a in out:
                if a.code == FT4_EXTRA[0]:
                    a.preds = [FT4_EXTRA[1][0] if p == "D" else (p, k, l) for p, k, l in a.preds]
    return out


def project_end(acts: list[Activity]) -> float:
    return max(r.ef for r in m.run_cpm(acts).values())


def crash_limit(a: Activity) -> float:
    return math.floor(0.3 * a.dur / STEP) * STEP


def crash_cost_step(a: Activity) -> float:
    weekly = act_cost(a.code) / a.dur
    return weekly * PREMIUM[a.code] * STEP


@dataclass
class CrashStep:
    code: str
    weeks: float
    cost: float
    end_before: float
    end_after: float


def greedy_crash(acts: list[Activity], target: float, allow: list[str] | None = None) -> tuple[list[Activity], list[CrashStep]]:
    """Crashing tham lam: mỗi bước chọn tổ hợp (1 hoặc 2 hoạt động) giảm được thời gian dự án với chi phí trên mỗi tuần thấp nhất."""
    cur = clone(acts)
    taken: dict[str, float] = {}
    steps: list[CrashStep] = []
    while project_end(cur) > target + 1e-9:
        end0 = project_end(cur)
        cpm = m.run_cpm(cur)
        crit = [a.code for a in cur if cpm[a.code].critical and (allow is None or a.code in allow)]
        cands = [a for a in cur if a.code in crit and taken.get(a.code, 0) + STEP <= crash_limit(ACT[a.code]) + 1e-9 and a.dur - STEP > 0]
        best = None
        import itertools
        for r in (1, 2, 3):
            for combo in itertools.combinations(cands, r):
                trial = clone(cur)
                cost = 0.0
                for c in combo:
                    for t in trial:
                        if t.code == c.code:
                            t.dur = t.dur - STEP
                    cost += crash_cost_step(ACT[c.code])
                red = end0 - project_end(trial)
                if red > 1e-9:
                    slope = cost / red
                    if best is None or slope < best[0] - 1e-9:
                        best = (slope, combo, cost, red, trial)
            if best:
                break
        if not best:
            break
        _, combo, cost, red, trial = best
        for c in combo:
            taken[c.code] = taken.get(c.code, 0) + STEP
            steps.append(CrashStep(c.code, STEP, crash_cost_step(ACT[c.code]), end0, end0 - red))
        cur = trial
    return cur, steps


def compress_plan() -> dict:
    """Ba phương án nén 20%: chỉ crashing, chỉ fast-tracking, và kết hợp."""
    base_end = m.PROJECT_WEEKS
    target = base_end * (1 - TARGET_REDUCTION)
    # A: chỉ crashing
    a_acts, a_steps = greedy_crash(ACTIVITIES, target)
    # B: chỉ fast-tracking
    b_acts = apply_fast_track(ACTIVITIES)
    b_end = project_end(b_acts)
    ft_rework = sum(h for *_, h in FAST_TRACK) * RATE
    # C: kết hợp
    c_acts, c_steps = greedy_crash(b_acts, target)
    c_end = project_end(c_acts)
    return {
        "target": target,
        "A": {"acts": a_acts, "steps": a_steps, "end": project_end(a_acts), "cost": sum(s.cost for s in a_steps)},
        "B": {"acts": b_acts, "end": b_end, "cost": ft_rework},
        "C": {"acts": c_acts, "steps": c_steps, "end": c_end, "cost": ft_rework + sum(s.cost for s in c_steps)},
    }


# --------------------------------------------------------------------------- EVA theo công việc
def eva_by_wp(week: int = 8) -> list[dict]:
    """PV, EV, AC của từng gói công việc (hoạt động trong mạng, cộng công việc duy trì) tại tuần báo cáo.
    Cùng giả định hiệu suất tiến độ và hệ số chi phí với EVA cấp dự án nên tổng khớp tuyệt đối."""
    rows = []
    codes = [a.code for a in ACTIVITIES] + ["LOE"]
    for code in codes:
        planned = {w: 0.0 for w in range(1, m.WEEKS + 1)}
        for wp in act_tasks(code):
            if code == "LOE":
                share = {w: (wp.e / 4 if wp.wbs == "7.3" and w in (4, 8, 12, 16) else (0.0 if wp.wbs == "7.3" else wp.e / m.WEEKS)) for w in planned}
            else:
                r = m.CPM[code]
                span = r.ef - r.es
                share = {w: wp.e * max(0.0, min(w, r.ef) - max(w - 1, r.es)) / span for w in planned}
            for w, h in share.items():
                planned[w] += h
        bac = act_cost(code)
        pv = sum(planned[w] for w in range(1, week + 1)) * RATE
        ev = sum(planned[w] * RATE * m.EVA_PROGRESS[w] for w in range(1, week + 1))
        ac = sum(planned[w] * RATE * m.EVA_PROGRESS[w] * m.EVA_COST_FACTOR[w] for w in range(1, week + 1))
        rows.append({"code": code, "name": wp_name(code), "wbs": WP_CODE[code], "bac": bac, "pv": pv, "ev": ev, "ac": ac})
    return rows


if __name__ == "__main__":
    plan = compress_plan()
    print("mục tiêu", plan["target"])
    for k in "ABC":
        print(k, round(plan[k]["end"], 2), round(plan[k]["cost"]))
    print([ (s.code, s.cost) for s in plan["A"]["steps"]])
    print([ (s.code, round(s.cost)) for s in plan["C"]["steps"]])
    rows = eva_by_wp(8)
    print(round(sum(r["pv"] for r in rows)), round(sum(r["ev"] for r in rows)), round(sum(r["ac"] for r in rows)))
    p = m.eva_points()[7]
    print(round(p.pv), round(p.ev), round(p.ac))
