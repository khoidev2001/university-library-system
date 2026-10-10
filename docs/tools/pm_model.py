"""Mô hình dự án mô phỏng (nguồn số liệu duy nhất cho Excel, biểu đồ và báo cáo Word).

Dự án mô phỏng: 16 tuần, 4 người, đơn giá 50.000 đ/giờ. Mọi con số trong báo cáo đều
được tính từ file này, nên Excel, hình và văn bản không bao giờ lệch nhau.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from datetime import date, timedelta

RATE = 50_000  # đ/giờ công
WEEKS = 16
START = date(2026, 9, 21)  # thứ Hai của tuần 1
CAPACITY_PER_PERSON = 16  # giờ/tuần/người (sinh viên bán thời gian, khoảng 2 ngày/tuần)
RESERVE_RATE = 0.10  # dự phòng quản lý 10% BAC

# --- Vai trò -------------------------------------------------------------
ROLES = {
    "PM": ("Quản lý dự án, Scrum Master, Backend lead", "Trần Đình Khôi"),
    "FE": ("Frontend và AI/ML", "Nguyễn Như Quỳnh"),
    "BE": ("Backend và DevOps", "Nhân sự giả định SV3"),
    "QA": ("Phân tích nghiệp vụ và Kiểm thử (QA)", "Nhân sự giả định SV4"),
}

# Ước lượng 3 điểm: hệ số (lạc quan, bi quan) theo mức bất định của gói công việc
UNCERTAINTY = {"L": (0.85, 1.25), "M": (0.80, 1.40), "H": (0.70, 1.80)}
UNCERTAINTY_NAME = {"L": "Thấp", "M": "Vừa", "H": "Cao"}


@dataclass
class WorkPackage:
    wbs: str
    name: str
    owner: str
    m: float  # giờ khả dĩ nhất
    cls: str  # L / M / H
    activity: str  # mã hoạt động trong mạng, "LOE" nếu là công việc duy trì
    deliverable: str = ""

    @property
    def o(self) -> float:
        return round(self.m * UNCERTAINTY[self.cls][0], 1)

    @property
    def p(self) -> float:
        return round(self.m * UNCERTAINTY[self.cls][1], 1)

    @property
    def e(self) -> float:
        return (self.o + 4 * self.m + self.p) / 6

    @property
    def sigma(self) -> float:
        return (self.p - self.o) / 6


WBS_L1 = {
    "1": "Khởi tạo",
    "2": "Phân tích",
    "3": "Thiết kế",
    "4": "Phát triển",
    "5": "Kiểm thử",
    "6": "Triển khai",
    "7": "Quản lý dự án",
}
WBS_L2 = {
    "1.1": "Hiến chương và SOW", "1.2": "Các bên liên quan", "1.3": "Môi trường",
    "2.1": "Khảo sát", "2.2": "Đặc tả yêu cầu", "2.3": "Mô hình nghiệp vụ",
    "3.1": "Kiến trúc", "3.2": "Cơ sở dữ liệu", "3.3": "API", "3.4": "Giao diện", "3.5": "Mô hình AI",
    "4.1": "Quản lý sách", "4.2": "Quản lý bạn đọc", "4.3": "Mượn trả", "4.4": "Tìm kiếm",
    "4.5": "Báo cáo", "4.6": "AI", "4.7": "Tích hợp",
    "5.1": "Kế hoạch kiểm thử", "5.2": "Kiểm thử đơn vị", "5.3": "Kiểm thử tích hợp",
    "5.4": "Kiểm thử hệ thống", "5.5": "Kiểm thử chấp nhận",
    "6.1": "Đóng gói", "6.2": "CI/CD", "6.3": "Triển khai cloud", "6.4": "Tài liệu và đào tạo", "6.5": "Chuyển đổi",
    "7.1": "Theo dõi", "7.2": "Rủi ro và thay đổi", "7.3": "Kiểm soát EVA", "7.4": "Bàn giao",
}

_WP = WorkPackage
WORK_PACKAGES: list[WorkPackage] = [
    _WP("1.1", "Lập hiến chương dự án và SOW", "PM", 8, "L", "A", "Project Charter, SOW"),
    _WP("1.2", "Phân tích bên liên quan, kế hoạch truyền thông", "PM", 6, "L", "A", "Sổ bên liên quan"),
    _WP("1.3", "Dựng môi trường: repo, nhánh bảo vệ, Neon, khung 3 dịch vụ", "BE", 14, "M", "B", "Repo, CI khung, /health"),
    _WP("2.1", "Khảo sát nghiệp vụ thư viện, phỏng vấn thủ thư (giả định)", "QA", 12, "M", "C", "Biên bản khảo sát"),
    _WP("2.2", "Đặc tả SRS IEEE 830 và 20 User Story", "QA", 26, "M", "D", "SRS, backlog"),
    _WP("2.3", "Mô hình use case, quy tắc nghiệp vụ BR", "QA", 8, "L", "D", "Use case, BR-01..BR-08"),
    _WP("3.1", "Thiết kế kiến trúc 3 dịch vụ và gateway", "PM", 10, "L", "E", "Sơ đồ kiến trúc"),
    _WP("3.2", "Thiết kế cơ sở dữ liệu: ERD 3NF, DDL", "BE", 12, "L", "E", "ERD, migration"),
    _WP("3.3", "Thiết kế API, đặc tả OpenAPI", "BE", 10, "L", "F", "Đặc tả API"),
    _WP("3.4", "Thiết kế giao diện, hệ thống thiết kế", "FE", 14, "M", "F", "Wireframe, design token"),
    _WP("3.5", "Thiết kế mô hình AI: đặc trưng, chỉ số", "FE", 8, "M", "G", "Tài liệu mô hình"),
    _WP("4.1.1", "Backend sách, tác giả, thể loại, bản sao", "BE", 18, "M", "H", "API quản lý kho"),
    _WP("4.1.3", "Nhập ISBN Google Books và seed dữ liệu", "BE", 12, "H", "H", "Script seed, import ISBN"),
    _WP("4.2.1", "Backend xác thực JWT, phân quyền, bạn đọc, chính sách", "BE", 18, "M", "H", "API auth, users, policies"),
    _WP("4.3.1", "Backend mượn, trả, gia hạn, báo mất theo BR", "PM", 28, "H", "I", "API loans"),
    _WP("4.3.2", "Backend tính phạt và thu phạt", "BE", 12, "M", "I", "API fines"),
    _WP("4.4.1", "Backend tìm kiếm, lọc, phân trang", "BE", 8, "L", "I", "API tìm kiếm"),
    _WP("4.5.1", "Backend bốn báo cáo thống kê", "PM", 8, "L", "I", "API reports"),
    _WP("4.1.2", "Frontend quản lý kho sách", "FE", 14, "M", "J", "Trang kho sách"),
    _WP("4.2.2", "Frontend đăng nhập, đăng ký, hồ sơ, khoá thẻ", "FE", 12, "L", "J", "Trang tài khoản"),
    _WP("4.4.2", "Frontend tra cứu sách, SEO", "FE", 14, "M", "J", "Trang tra cứu"),
    _WP("4.3.3", "Frontend quầy mượn trả, sách của tôi", "FE", 18, "M", "K", "Trang quầy, my loans"),
    _WP("4.5.2", "Frontend bảng điều khiển biểu đồ", "FE", 12, "M", "K", "Dashboard"),
    _WP("4.6.1", "AI gợi ý sách (TF-IDF, item-CF)", "FE", 18, "H", "L", "Mô hình gợi ý"),
    _WP("4.6.2", "AI dự báo nguy cơ trả trễ", "FE", 14, "H", "L", "Mô hình dự báo"),
    _WP("4.6.3", "Tích hợp Backend-AI, fallback, hiển thị", "PM", 12, "H", "M", "Client AI, fallback"),
    _WP("4.7.1", "Tích hợp Frontend-Backend-gateway, xử lý lỗi", "PM", 10, "M", "M", "Hệ thống chạy trọn"),
    _WP("4.7.2", "Hoàn thiện giao diện, responsive", "FE", 10, "L", "M", "UI hoàn chỉnh"),
    _WP("5.1", "Kế hoạch kiểm thử, thiết kế ca kiểm thử", "QA", 10, "L", "N", "Test plan"),
    _WP("5.2", "Kiểm thử đơn vị Backend và AI", "QA", 26, "M", "N", "Unit test, coverage"),
    _WP("5.3", "Kiểm thử tích hợp, e2e trên DB thật", "QA", 16, "M", "N", "e2e test"),
    _WP("5.4", "Kiểm thử hệ thống, smoke API, hiệu năng", "QA", 12, "M", "O", "Báo cáo kiểm thử"),
    _WP("5.5", "Kiểm thử chấp nhận (UAT)", "QA", 10, "M", "O", "Biên bản UAT"),
    _WP("6.1", "Đóng gói Docker, docker-compose", "BE", 10, "L", "Q", "Dockerfile, compose"),
    _WP("6.2", "CI/CD GitHub Actions", "BE", 12, "M", "Q", "Pipeline CI/CD"),
    _WP("6.3", "Triển khai cloud (Vercel, Render, Neon)", "BE", 12, "H", "P", "Bản chạy trực tuyến"),
    _WP("6.5", "Chuyển đổi dữ liệu, vận hành thử", "QA", 6, "M", "P", "Dữ liệu nạp, vận hành thử"),
    _WP("6.4", "Tài liệu hướng dẫn, đào tạo thủ thư", "QA", 10, "L", "R", "Hướng dẫn sử dụng"),
    _WP("7.4", "Nghiệm thu, báo cáo cuối, bàn giao", "PM", 10, "L", "S", "Biên bản nghiệm thu"),
    _WP("7.1", "Họp tuần, theo dõi tiến độ", "PM", 26, "L", "LOE", "Biên bản họp"),
    _WP("7.2", "Quản lý rủi ro và thay đổi", "PM", 10, "L", "LOE", "Sổ rủi ro, CR log"),
    _WP("7.3", "Báo cáo EVA và kiểm soát", "PM", 10, "L", "LOE", "Báo cáo EVA"),
]

WP_BY_ID = {w.wbs: w for w in WORK_PACKAGES}


def wbs_sort_key(wbs: str) -> tuple:
    return tuple(int(x) for x in wbs.split("."))


# --- Mạng hoạt động ------------------------------------------------------
ACT_UNCERTAINTY = {"L": (0.80, 1.30), "M": (0.75, 1.40), "H": (0.70, 1.60)}


@dataclass
class Activity:
    code: str
    name: str
    dur: int  # tuần
    preds: list[tuple[str, str, int]] = field(default_factory=list)  # (mã, FS|SS, lag)
    cls: str = "L"  # mức bất định của hoạt động (L, M, H)

    @property
    def a(self) -> float:  # PERT lạc quan (tuần)
        return round(self.dur * ACT_UNCERTAINTY[self.cls][0], 2)

    @property
    def b(self) -> float:  # PERT bi quan (tuần)
        return round(self.dur * ACT_UNCERTAINTY[self.cls][1], 2)


ACTIVITIES: list[Activity] = [
    Activity("A", "Khởi tạo, SOW", 1, []),
    Activity("C", "Khảo sát nghiệp vụ", 1, [("A", "SS", 0)]),
    Activity("B", "Dựng môi trường", 1, [("A", "FS", 0)]),
    Activity("D", "Phân tích: SRS, User Story", 2, [("C", "FS", 0)], "M"),
    Activity("E", "Thiết kế kiến trúc, CSDL", 2, [("D", "SS", 1)]),
    Activity("F", "Thiết kế API, giao diện", 2, [("D", "SS", 2)]),
    Activity("G", "Thiết kế mô hình AI", 1, [("D", "SS", 2)]),
    Activity("H", "Backend nền: auth, sách, seed", 4, [("E", "FS", 0), ("B", "FS", 0)], "H"),
    Activity("I", "Backend mượn trả, phạt, tìm kiếm", 4, [("H", "SS", 1)], "H"),
    Activity("J", "Frontend khung, tra cứu, kho", 4, [("F", "FS", 0), ("H", "SS", 1)], "M"),
    Activity("K", "Frontend quầy, báo cáo", 3, [("J", "FS", 0)], "M"),
    Activity("L", "AI gợi ý và dự báo", 5, [("G", "FS", 0), ("I", "SS", 2)], "H"),
    Activity("M", "Tích hợp Backend, AI, Frontend", 2, [("I", "FS", 0), ("K", "FS", 0), ("L", "FS", 0)], "H"),
    Activity("N", "Kiểm thử đơn vị, tích hợp", 5, [("H", "SS", 2)], "M"),
    Activity("O", "Kiểm thử hệ thống, UAT", 2, [("M", "SS", 1), ("N", "FS", 0)], "M"),
    Activity("Q", "Docker, CI/CD", 2, [("H", "FS", 0)]),
    Activity("P", "Triển khai cloud, vận hành thử", 1, [("O", "SS", 1), ("Q", "FS", 0)], "M"),
    Activity("R", "Tài liệu, đào tạo thủ thư", 2, [("M", "SS", 0)]),
    Activity("S", "Nghiệm thu, bàn giao", 1, [("P", "FS", 0), ("R", "FS", 0)]),
]
ACT = {a.code: a for a in ACTIVITIES}


@dataclass
class CpmRow:
    code: str
    es: float
    ef: float
    ls: float
    lf: float
    slack: float

    @property
    def critical(self) -> bool:
        return abs(self.slack) < 1e-9


def run_cpm(acts: list[Activity] | None = None) -> dict[str, CpmRow]:
    acts = acts or ACTIVITIES
    act_by = {a.code: a for a in acts}
    order = [a.code for a in acts]  # đã sắp theo thứ tự phụ thuộc
    es: dict[str, float] = {}
    ef: dict[str, float] = {}
    for code in order:
        act = act_by[code]
        start = 0.0
        for pc, kind, lag in act.preds:
            start = max(start, (ef[pc] if kind == "FS" else es[pc]) + lag)
        es[code] = start
        ef[code] = start + act.dur
    project_end = max(ef.values())
    succ: dict[str, list[tuple[str, str, int]]] = {c: [] for c in order}
    for act in acts:
        for pc, kind, lag in act.preds:
            succ[pc].append((act.code, kind, lag))
    lf: dict[str, float] = {}
    ls: dict[str, float] = {}
    for code in reversed(order):
        act = act_by[code]
        bound = project_end
        for sc, kind, lag in succ[code]:
            if kind == "FS":
                bound = min(bound, ls[sc] - lag)
            else:  # SS: LS(p) + lag <= LS(s)  =>  LF(p) <= LS(s) - lag + dur(p)
                bound = min(bound, ls[sc] - lag + act.dur)
        lf[code] = bound
        ls[code] = bound - act.dur
    return {c: CpmRow(c, es[c], ef[c], ls[c], lf[c], round(ls[c] - es[c], 6)) for c in order}


CPM = run_cpm()
PROJECT_WEEKS = max(r.ef for r in CPM.values())
CRITICAL_PATH = [c for c in ACT if CPM[c].critical]


def critical_paths() -> list[list[str]]:
    """Mọi đường găng: chuỗi hoạt động slack 0 nối nhau bằng quan hệ ràng buộc chặt."""
    crit = set(CRITICAL_PATH)
    succ: dict[str, list[str]] = {c: [] for c in crit}
    has_pred: set[str] = set()
    for act in ACTIVITIES:
        if act.code not in crit:
            continue
        for pc, kind, lag in act.preds:
            if pc not in crit:
                continue
            tight = (
                abs(CPM[act.code].es - (CPM[pc].ef if kind == "FS" else CPM[pc].es) - lag) < 1e-9
            )
            if tight:
                succ[pc].append(act.code)
                has_pred.add(act.code)
    starts = [c for c in ACT if c in crit and c not in has_pred]
    paths: list[list[str]] = []

    def walk(node: str, acc: list[str]) -> None:
        acc = acc + [node]
        if not succ[node]:
            paths.append(acc)
            return
        for nxt in succ[node]:
            walk(nxt, acc)

    for st in starts:
        walk(st, [])
    return paths


def critical_chain() -> list[str]:
    """Đường găng chính: đường có độ lệch chuẩn PERT lớn nhất (bất định cao nhất)."""
    paths = critical_paths()
    return max(paths, key=lambda p: path_stats(p)[1])


def path_stats(path: list[str]) -> tuple[float, float]:
    """Kỳ vọng và độ lệch chuẩn của một đường theo PERT 3 điểm.
    Với quan hệ SS, thời gian của đường tính theo độ dài thực trên lịch (ES cuối - ES đầu + dur cuối)."""
    exp, var = 0.0, 0.0
    for c in path:
        act = ACT[c]
        exp += (act.a + 4 * act.dur + act.b) / 6
        var += ((act.b - act.a) / 6) ** 2
    return exp, math.sqrt(var)


def path_calendar_expected(path: list[str]) -> float:
    """Thời gian lịch kỳ vọng của đường: lịch CPM cộng độ lệch (E - dur) của từng hoạt động trên đường."""
    delta = sum(((ACT[c].a + 4 * ACT[c].dur + ACT[c].b) / 6) - ACT[c].dur for c in path)
    return PROJECT_WEEKS + delta


def pert_project() -> tuple[float, float]:
    """Kỳ vọng và độ lệch chuẩn dự án theo đường găng chính (xấp xỉ chuẩn)."""
    main = critical_chain()
    return path_calendar_expected(main), path_stats(main)[1]


def normal_cdf(x: float) -> float:
    return 0.5 * (1 + math.erf(x / math.sqrt(2)))


# --- Phân bổ giờ theo tuần (PV) ------------------------------------------
def weekly_plan() -> tuple[dict[int, float], dict[str, dict[int, float]]]:
    """Giờ kế hoạch mỗi tuần: tổng và theo vai trò. Gói thuộc hoạt động trải đều
    trong [ES, EF] (lịch sớm); LOE trải đều 16 tuần, riêng 7.3 dồn vào tuần báo cáo."""
    total = {w: 0.0 for w in range(1, WEEKS + 1)}
    by_role = {r: {w: 0.0 for w in range(1, WEEKS + 1)} for r in ROLES}
    for wp in WORK_PACKAGES:
        e = wp.e
        if wp.activity == "LOE":
            if wp.wbs == "7.3":
                weeks = [4, 8, 12, 16]
            else:
                weeks = list(range(1, WEEKS + 1))
        else:
            row = CPM[wp.activity]
            weeks = list(range(int(row.es) + 1, int(row.ef) + 1))
        share = e / len(weeks)
        for w in weeks:
            total[w] += share
            by_role[wp.owner][w] += share
    return total, by_role


def bac_hours() -> float:
    return sum(w.e for w in WORK_PACKAGES)


def bac_money() -> float:
    return bac_hours() * RATE


def pv_series() -> list[float]:
    total, _ = weekly_plan()
    cum, out = 0.0, []
    for w in range(1, WEEKS + 1):
        cum += total[w] * RATE
        out.append(cum)
    return out


# --- EVA mô phỏng --------------------------------------------------------
# Giả định có kiểm soát (ghi rõ trong báo cáo): hiệu suất tiến độ và hệ số chi phí theo từng giai đoạn
EVA_PROGRESS = {  # giờ giá trị thu được trên giờ kế hoạch mỗi tuần
    **{w: 0.96 for w in range(1, 5)},
    **{w: 0.80 for w in range(5, 9)},
    **{w: 1.10 for w in range(9, 13)},
    **{w: 1.12 for w in range(13, 16)},
    16: 9.99,  # tuần cuối bù để hoàn thành 100%, bị chặn bởi BAC
}
EVA_COST_FACTOR = {  # giờ thực tế trên giờ giá trị thu được
    **{w: 1.04 for w in range(1, 5)},
    **{w: 1.12 for w in range(5, 9)},
    **{w: 1.10 for w in range(9, 13)},
    **{w: 1.05 for w in range(13, 17)},
}
EVA_NOTES = {
    "1-4": "Khảo sát và SRS cần làm rõ thêm nghiệp vụ gia hạn, phạt trả trễ, nên tiến độ chậm nhẹ.",
    "5-8": "Nhập dữ liệu Google Books bị giới hạn tần suất, phải chuyển sang bộ goodbooks-10k và dựng lại seed; chi phí sửa lỗi cao.",
    "9-12": "Làm thêm giờ và chạy song song Frontend với Backend để bù trễ; phát sinh sửa lỗi tính phạt theo ngày lịch.",
    "13-16": "Tích hợp, kiểm thử hệ thống và triển khai chạy nhanh nhờ khung CI/CD dựng sẵn; hoàn thành đúng hạn.",
}
EVA_REPORT_WEEKS = [4, 8, 12, 16]


def eva_series():
    total, _ = weekly_plan()
    bac = bac_money()
    pv = pv_series()
    ev, ac = [], []
    ev_c, ac_c = 0.0, 0.0
    for w in range(1, WEEKS + 1):
        planned = total[w] * RATE
        gain = min(planned * EVA_PROGRESS[w], bac - ev_c)
        ev_c += gain
        ac_c += gain * EVA_COST_FACTOR[w]
        ev.append(ev_c)
        ac.append(ac_c)
    return pv, ev, ac


@dataclass
class EvaPoint:
    week: int
    pv: float
    ev: float
    ac: float
    bac: float

    @property
    def sv(self) -> float: return self.ev - self.pv
    @property
    def cv(self) -> float: return self.ev - self.ac
    @property
    def spi(self) -> float: return self.ev / self.pv
    @property
    def cpi(self) -> float: return self.ev / self.ac
    @property
    def eac(self) -> float: return self.bac / self.cpi
    @property
    def eac2(self) -> float: return self.ac + (self.bac - self.ev) / (self.cpi * self.spi)
    @property
    def etc(self) -> float: return self.eac - self.ac
    @property
    def vac(self) -> float: return self.bac - self.eac
    @property
    def tcpi(self) -> float:
        rest = self.bac - self.ac
        return (self.bac - self.ev) / rest if abs(rest) > 1e-9 else float("nan")


def eva_points() -> list[EvaPoint]:
    pv, ev, ac = eva_series()
    bac = bac_money()
    return [EvaPoint(w, pv[w - 1], ev[w - 1], ac[w - 1], bac) for w in range(1, WEEKS + 1)]


def eva_status(spi: float, cpi: float) -> str:
    def band(x: float) -> str:
        return "xanh" if x >= 0.95 else ("vàng" if x >= 0.85 else "đỏ")
    return f"tiến độ {band(spi)}, chi phí {band(cpi)}"


# --- Rủi ro --------------------------------------------------------------
@dataclass
class Risk:
    rid: str
    name: str
    cause: str
    effect: str
    cat: str
    p: int  # 1..5
    i: int  # 1..5
    strategy: str
    response: str
    trigger: str
    owner: str
    status: str
    cost_if: float  # đ nếu xảy ra (tính EMV)

    @property
    def score(self) -> int:
        return self.p * self.i

    @property
    def level(self) -> str:
        return "Cao" if self.score >= 15 else ("Trung bình" if self.score >= 8 else "Thấp")


# Xác suất rời rạc: 1=10%, 2=30%, 3=50%, 4=70%, 5=90%
PROB = {1: 0.10, 2: 0.30, 3: 0.50, 4: 0.70, 5: 0.90}

RISKS: list[Risk] = [
    Risk("R1", "Hạ tầng miễn phí ngủ khi demo", "Render free ngủ sau 15 phút, Neon tạm dừng sau 5 phút",
         "Lần mở đầu chậm khoảng 1 phút, demo kém ấn tượng", "Kỹ thuật", 5, 3, "Giảm thiểu",
         "Đánh thức dịch vụ trước demo 5 phút; backend có fallback khi AI chưa nạp; nêu rõ hạn chế; sẵn phương án trả phí",
         "Phản hồi /health > 10 giây", "Quản lý dự án", "Đã xảy ra, đã kiểm soát", 300_000),
    Risk("R2", "Google Books giới hạn tần suất, thiếu mô tả", "Gọi API không khoá, giới hạn theo IP",
         "Không nhập được mô tả sách, tính năng nhập ISBN chưa kiểm thử với dữ liệu thật", "Kỹ thuật", 4, 3, "Né tránh",
         "Dùng goodbooks-10k làm nguồn chính; Google Books chỉ bổ sung khi có khoá; nhập ISBN có unit test dữ liệu giả",
         "Tỉ lệ 429 > 20%", "Backend lead", "Đã xảy ra", 500_000),
    Risk("R3", "Độ chính xác mô hình AI thấp", "Dữ liệu mượn trả mô phỏng, ít đặc trưng",
         "Gợi ý và dự báo trễ không đạt ngưỡng nghiệm thu", "Kỹ thuật", 3, 4, "Giảm thiểu",
         "Đặt ngưỡng từ đầu (Precision@5 ≥ 0,15; ROC-AUC ≥ 0,70); so hai mô hình; fallback sách mượn nhiều",
         "Chỉ số dưới ngưỡng sau lần huấn luyện đầu", "Frontend và AI", "Đã đạt (0,309 và 0,76)", 800_000),
    Risk("R4", "Độ bao phủ kiểm thử không đạt 80%", "Quy tắc nghiệp vụ phức tạp, mock khác thực tế",
         "Không qua cổng chất lượng, phải viết bù cuối dự án", "Chất lượng", 2, 4, "Giảm thiểu",
         "Ép ngưỡng 80% trong CI; viết test song song khi code; e2e trên PostgreSQL thật",
         "Coverage nhánh < 82% ở sprint giữa", "QA", "Đã đạt (98,75% dòng)", 500_000),
    Risk("R5", "Phình phạm vi (scope creep)", "Người dùng yêu cầu thêm tính năng ngoài MVP (đặt trước, email, thanh toán)",
         "Trễ tiến độ, vượt ngân sách", "Phạm vi", 4, 4, "Giảm thiểu",
         "Chốt danh sách ngoài MVP trong SOW; mọi thay đổi qua Change Request, Product Owner duyệt",
         "Số CR mở > 2 cùng lúc", "Quản lý dự án", "Đang theo dõi", 800_000),
    Risk("R6", "Ước lượng thấp hơn thực tế", "Năng suất giả định cao (2,1 giờ/FP), ít dữ liệu lịch sử",
         "Vượt giờ công, SPI/CPI dưới 0,9", "Lịch và chi phí", 3, 4, "Chấp nhận có dự phòng",
         "Ước lượng 3 điểm; dự phòng 10% BAC; theo dõi EVA mỗi 4 tuần; cắt phạm vi khi CPI < 0,85",
         "SPI hoặc CPI < 0,85", "Quản lý dự án", "Đã xảy ra, trong dự phòng", 800_000),
    Risk("R7", "Dữ liệu sách nhập sai hoặc thiếu ISBN", "Nguồn dữ liệu mở không đồng nhất",
         "Tra cứu sai, trùng đầu sách", "Nghiệp vụ", 3, 3, "Giảm thiểu",
         "ISBN duy nhất (409 nếu trùng); kiểm tra định dạng; báo cáo bản ghi bị bỏ qua; rà soát mẫu 50 cuốn",
         "Tỉ lệ bản ghi thiếu ISBN > 10%", "Backend", "Đang theo dõi", 300_000),
    Risk("R8", "Thủ thư không muốn chuyển sang hệ thống mới", "Quen sổ sách, ngại thay đổi quy trình",
         "Hệ thống không được dùng, mất lợi ích", "Nghiệp vụ", 3, 4, "Giảm thiểu",
         "Quầy mượn trả đơn giản (nhập mã vạch); đào tạo 2 buổi; chạy song song 2 tuần; thủ thư đại diện dự UAT",
         "Dưới 60% phiếu mượn nhập qua hệ thống sau 2 tuần", "QA", "Chưa xảy ra", 600_000),
    Risk("R9", "Mất dữ liệu seed hoặc lỗi migration", "Thao tác nhầm trên cơ sở dữ liệu dùng chung",
         "Phải dựng lại dữ liệu mẫu, mất vài giờ", "Kỹ thuật", 2, 3, "Chuyển giao",
         "Neon sao lưu hằng ngày; seed lặp lại được; migration có phiên bản",
         "Lỗi migration trên CI", "Backend", "Chưa xảy ra", 200_000),
    Risk("R10", "Lỗi quy tắc phạt (làm tròn theo giờ, không theo ngày lịch)", "Quy tắc nghiệp vụ hiểu chưa đủ chặt",
         "Tính sai tiền phạt, khiếu nại của bạn đọc", "Chất lượng", 3, 3, "Giảm thiểu",
         "Test biên (23:59 và 00:01); chạy thử luồng thật trên DB; đã sửa theo ngày lịch",
         "Ca test biên đỏ", "QA", "Đã xảy ra, đã sửa", 300_000),
]


def risk_matrix() -> dict[tuple[int, int], list[str]]:
    cells: dict[tuple[int, int], list[str]] = {}
    for r in RISKS:
        cells.setdefault((r.p, r.i), []).append(r.rid)
    return cells


def risk_emv_total() -> float:
    return sum(r.cost_if * PROB[r.p] for r in RISKS)


# --- RACI ----------------------------------------------------------------
# Cột: PM, FE(+AI), BE, QA, KH (Ban giám đốc thư viện), GV (giảng viên hướng dẫn)
RACI_COLS = ["PM", "FE", "BE", "QA", "KH", "GVHD"]
RACI_COL_NAMES = {
    "PM": "Quản lý dự án",
    "FE": "Frontend, AI",
    "BE": "Backend, DevOps",
    "QA": "BA, Kiểm thử",
    "KH": "Khách hàng (thư viện)",
    "GVHD": "Giảng viên hướng dẫn",
}
RACI: list[tuple[str, str, dict[str, str]]] = [
    ("1", "Khởi tạo, SOW, hiến chương", {"PM": "A/R", "FE": "C", "BE": "C", "QA": "C", "KH": "C", "GVHD": "I"}),
    ("2.1", "Khảo sát nghiệp vụ", {"PM": "A", "FE": "I", "BE": "I", "QA": "R", "KH": "C", "GVHD": "I"}),
    ("2.2", "Đặc tả SRS, User Story", {"PM": "A", "FE": "C", "BE": "C", "QA": "R", "KH": "C", "GVHD": "I"}),
    ("2.3", "Mô hình use case, quy tắc BR", {"PM": "A", "FE": "C", "BE": "C", "QA": "R", "KH": "C", "GVHD": "I"}),
    ("3.1", "Kiến trúc hệ thống", {"PM": "A/R", "FE": "C", "BE": "C", "QA": "I", "KH": "I", "GVHD": "C"}),
    ("3.2", "Cơ sở dữ liệu", {"PM": "A", "FE": "I", "BE": "R", "QA": "C", "KH": "I", "GVHD": "C"}),
    ("3.3", "Thiết kế API", {"PM": "A", "FE": "C", "BE": "R", "QA": "C", "KH": "I", "GVHD": "I"}),
    ("3.4", "Thiết kế giao diện", {"PM": "A", "FE": "R", "BE": "I", "QA": "C", "KH": "C", "GVHD": "I"}),
    ("3.5", "Thiết kế mô hình AI", {"PM": "A", "FE": "R", "BE": "C", "QA": "I", "KH": "I", "GVHD": "C"}),
    ("4.1", "Quản lý sách (BE và FE)", {"PM": "A", "FE": "R", "BE": "R", "QA": "C", "KH": "C", "GVHD": "I"}),
    ("4.2", "Quản lý bạn đọc, xác thực", {"PM": "A/R", "FE": "R", "BE": "C", "QA": "C", "KH": "C", "GVHD": "I"}),
    ("4.3", "Mượn, trả, phạt", {"PM": "A/R", "FE": "R", "BE": "R", "QA": "C", "KH": "C", "GVHD": "I"}),
    ("4.4", "Tìm kiếm", {"PM": "A", "FE": "R", "BE": "R", "QA": "C", "KH": "I", "GVHD": "I"}),
    ("4.5", "Báo cáo thống kê", {"PM": "A", "FE": "R", "BE": "R", "QA": "C", "KH": "C", "GVHD": "I"}),
    ("4.6", "AI gợi ý, dự báo trễ", {"PM": "A", "FE": "R", "BE": "C", "QA": "C", "KH": "I", "GVHD": "C"}),
    ("4.7", "Tích hợp hệ thống", {"PM": "A/R", "FE": "R", "BE": "R", "QA": "C", "KH": "I", "GVHD": "I"}),
    ("5.1-5.3", "Kiểm thử đơn vị, tích hợp", {"PM": "A", "FE": "C", "BE": "C", "QA": "R", "KH": "I", "GVHD": "I"}),
    ("5.4", "Kiểm thử hệ thống", {"PM": "A", "FE": "C", "BE": "C", "QA": "R", "KH": "I", "GVHD": "I"}),
    ("5.5", "Kiểm thử chấp nhận (UAT)", {"PM": "R", "FE": "I", "BE": "I", "QA": "R", "KH": "A", "GVHD": "C"}),
    ("6.1-6.2", "Docker, CI/CD", {"PM": "A", "FE": "C", "BE": "R", "QA": "C", "KH": "I", "GVHD": "I"}),
    ("6.3", "Triển khai cloud", {"PM": "A/R", "FE": "C", "BE": "R", "QA": "C", "KH": "I", "GVHD": "I"}),
    ("6.4", "Tài liệu, đào tạo thủ thư", {"PM": "A", "FE": "C", "BE": "C", "QA": "R", "KH": "C", "GVHD": "I"}),
    ("6.5", "Chuyển đổi dữ liệu, vận hành thử", {"PM": "A", "FE": "I", "BE": "R", "QA": "C", "KH": "C", "GVHD": "I"}),
    ("7.1-7.3", "Theo dõi, rủi ro, EVA", {"PM": "A/R", "FE": "C", "BE": "C", "QA": "C", "KH": "I", "GVHD": "I"}),
    ("7.4", "Nghiệm thu, bàn giao", {"PM": "R", "FE": "C", "BE": "C", "QA": "C", "KH": "A", "GVHD": "I"}),
]

# --- Tài chính -----------------------------------------------------------
FIN = {
    "discount": 0.10,
    "years": 3,
    "reader_count": 5000,  # sinh viên, giảng viên
    "loans_per_reader_year": 8,
    "minutes_saved_per_loan": 2.0,
    "lookups_per_year": 20_000,
    "minutes_saved_per_lookup": 2.0,
    "librarian_rate": 35_000,  # đ/giờ
    "report_hours_saved": 96,  # giờ/năm
    "lost_book_value_year": 20_000_000,
    "lost_reduction": 0.25,
    "adoption": [0.70, 1.00, 1.00],
    "ops_hosting": 6_000_000,  # gói trả phí tối thiểu, năm
    "ops_maintenance_hours": 60,
    "ops_training": 3_000_000,
}


def finance() -> dict:
    f = FIN
    loans = f["reader_count"] * f["loans_per_reader_year"]
    b_loan = loans * f["minutes_saved_per_loan"] / 60 * f["librarian_rate"]
    b_lookup = f["lookups_per_year"] * f["minutes_saved_per_lookup"] / 60 * f["librarian_rate"]
    b_report = f["report_hours_saved"] * f["librarian_rate"]
    b_lost = f["lost_book_value_year"] * f["lost_reduction"]
    benefit_full = b_loan + b_lookup + b_report + b_lost
    invest = bac_money() * (1 + RESERVE_RATE)
    ops = f["ops_hosting"] + f["ops_maintenance_hours"] * RATE + f["ops_training"]
    flows = [-invest]
    nets = []
    for y in range(f["years"]):
        net = benefit_full * f["adoption"][y] - ops
        nets.append(net)
        flows.append(net)
    r = f["discount"]
    pv_list = [flows[t] / (1 + r) ** t for t in range(len(flows))]
    npv = sum(pv_list)
    roi = (sum(nets) - invest) / invest
    # hoàn vốn (không chiết khấu), nội suy trong năm
    cum = -invest
    payback = None
    for y, n in enumerate(nets):
        if cum + n >= 0 and payback is None:
            payback = y + (-cum) / n
        cum += n
    return {
        "loans": loans, "b_loan": b_loan, "b_lookup": b_lookup, "b_report": b_report, "b_lost": b_lost,
        "benefit_full": benefit_full, "invest": invest, "ops": ops, "flows": flows, "nets": nets,
        "pv_list": pv_list, "npv": npv, "roi": roi, "payback": payback,
    }


def npv_with(discount: float, benefit_factor: float) -> float:
    f = finance()
    flows = [f["flows"][0]] + [
        FIN["adoption"][y] * f["benefit_full"] * benefit_factor - f["ops"] for y in range(FIN["years"])
    ]
    return sum(flows[t] / (1 + discount) ** t for t in range(len(flows)))


# --- Thông tin dùng chung ------------------------------------------------
def week_dates(w: int) -> tuple[date, date]:
    s = START + timedelta(days=7 * (w - 1))
    return s, s + timedelta(days=6)


def fmt_vnd(x: float) -> str:
    return f"{x:,.0f}".replace(",", ".")


def fmt_h(x: float) -> str:
    return f"{x:,.1f}".replace(",", "X").replace(".", ",").replace("X", ".")


if __name__ == "__main__":
    print("BAC giờ:", round(bac_hours(), 1), "BAC đ:", fmt_vnd(bac_money()))
    print("Tuần dự án:", PROJECT_WEEKS, "găng:", critical_chain())
    for c in ACT:
        r = CPM[c]
        print(c, ACT[c].name, ACT[c].dur, r.es, r.ef, r.ls, r.lf, r.slack, "*" if r.critical else "")
    exp, sd = pert_project()
    print("Đường găng:", critical_paths())
    print("PERT:", round(exp, 2), round(sd, 2), [round(normal_cdf((x - exp) / sd), 2) for x in (16, 17, 18)])
    tot, br = weekly_plan()
    print("Giờ/tuần:", [round(tot[w], 1) for w in range(1, 17)])
    for r_ in ROLES:
        print(r_, [round(br[r_][w], 1) for w in range(1, 17)], round(sum(br[r_].values()), 1))
    for p in eva_points():
        if p.week in EVA_REPORT_WEEKS:
            print(p.week, round(p.pv / 1e6, 2), round(p.ev / 1e6, 2), round(p.ac / 1e6, 2),
                  "SPI", round(p.spi, 3), "CPI", round(p.cpi, 3), "EAC", round(p.eac / 1e6, 2))
    f = finance()
    print("NPV", fmt_vnd(f["npv"]), "ROI", round(f["roi"], 3), "payback", f["payback"], "benefit", fmt_vnd(f["benefit_full"]))
    print("EMV rủi ro:", fmt_vnd(risk_emv_total()))
