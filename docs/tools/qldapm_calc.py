"""Sinh lời giải từng bước (tính xuôi, tính ngược, EVA, tài chính) và dữ liệu phụ cho báo cáo QLDAPM.

Mọi con số lấy từ pm_model nên khớp với Excel. Hàm trả về chuỗi tiếng Việt đã định dạng sẵn.
"""
from __future__ import annotations

import pm_model as m
import qldapm_model as q
from pm_model import ACT, ACTIVITIES, CPM


def n(x: float) -> str:
    return f"{x:g}".replace(".", ",")


def code_label(code: str) -> str:
    return q.WP_CODE[code] if code in q.WP_CODE else code


def forward_text(code: str) -> tuple[str, str]:
    """(phép tính ES, phép tính EF) có thế số."""
    a = ACT[code]
    if not a.preds:
        return "ES = 0 (hoạt động đầu tiên)", f"EF = ES + d = 0 + {a.dur} = {n(CPM[code].ef)}"
    terms, vals = [], []
    for pc, kind, lag in a.preds:
        pr = CPM[pc]
        lag_s = f"{lag:+d}".replace("+0", "+0")
        if kind == "FS":
            terms.append(f"EF({pc}){lag_s}")
            vals.append(pr.ef + lag)
        elif kind == "SS":
            terms.append(f"ES({pc}){lag_s}")
            vals.append(pr.es + lag)
        elif kind == "FF":
            terms.append(f"EF({pc}){lag_s} − d")
            vals.append(pr.ef + lag - a.dur)
        else:
            terms.append(f"ES({pc}){lag_s} − d")
            vals.append(pr.es + lag - a.dur)
    nums = ", ".join(n(v) for v in vals)
    expr = f"ES = max({', '.join(terms)}, 0) = max({nums}) = {n(CPM[code].es)}"
    return expr, f"EF = ES + d = {n(CPM[code].es)} + {a.dur} = {n(CPM[code].ef)}"


def backward_text(code: str) -> tuple[str, str]:
    """(phép tính LF, phép tính LS) có thế số."""
    a = ACT[code]
    end = m.PROJECT_WEEKS
    succs = [(s.code, kind, lag) for s in ACTIVITIES for pc, kind, lag in s.preds if pc == code]
    if not succs:
        return f"LF = EF dự án = {n(end)}", f"LS = LF − d = {n(end)} − {a.dur} = {n(CPM[code].ls)}"
    terms, vals = [], []
    for sc, kind, lag in succs:
        sr = CPM[sc]
        lag_s = f"{lag:+d}"
        if kind == "FS":
            terms.append(f"LS({sc}) − ({lag})")
            vals.append(sr.ls - lag)
        elif kind == "SS":
            terms.append(f"LS({sc}) − ({lag}) + d")
            vals.append(sr.ls - lag + a.dur)
        elif kind == "FF":
            terms.append(f"LF({sc}) − ({lag})")
            vals.append(sr.lf - lag)
        else:
            terms.append(f"LF({sc}) − ({lag}) + d")
            vals.append(sr.lf - lag + a.dur)
    nums = ", ".join(n(v) for v in vals)
    return (f"LF = min({', '.join(terms)}) = min({nums}) = {n(CPM[code].lf)}",
            f"LS = LF − d = {n(CPM[code].lf)} − {a.dur} = {n(CPM[code].ls)}")


def slack_text(code: str) -> str:
    r = CPM[code]
    return f"Slack = LS − ES = {n(r.ls)} − {n(r.es)} = {n(r.slack)}"


def relation_text(kind: str, lag: int) -> str:
    base = {"FS": "FS", "SS": "SS", "FF": "FF", "SF": "SF"}[kind]
    if lag > 0:
        return f"{base}+{lag} (trễ {lag} tuần)"
    if lag < 0:
        return f"{base}{lag} (dẫn trước {-lag} tuần)"
    return base


# --------------------------------------------------------------------------- Kế hoạch ứng phó khi rủi ro xảy ra
CONTINGENCY = {
    "R1": "Mở sẵn bản ghi hình và ảnh chụp màn hình; chạy docker compose cục bộ để demo; nếu lâu hơn 10 phút thì chuyển sang gói trả phí tối thiểu trong ngày.",
    "R2": "Chuyển hẳn sang nguồn goodbooks-10k; nhập mô tả thủ công cho 50 đầu sách phổ biến; xin khoá API riêng và đặt lại lịch nhập theo lô nhỏ.",
    "R3": "Giữ gợi ý theo sách mượn nhiều (fallback) và ẩn điểm nguy cơ trễ; dành thêm 8 giờ chọn lại đặc trưng; ghi rõ hạn chế với khách hàng.",
    "R4": "Dành 1 tuần ưu tiên viết bổ sung test cho các lớp nghiệp vụ còn thiếu; tạm hạ ngưỡng nhánh xuống 75% có văn bản của PM, khôi phục 80% trước nghiệm thu.",
    "R5": "Dùng dự phòng cho thay đổi đã duyệt; nếu vượt thì cắt các hạng mục ưu tiên thấp theo danh sách đã chốt (báo cáo biểu đồ, huấn luyện lại mô hình).",
    "R6": "Kích hoạt dự phòng quản lý 10%; làm thêm giờ có kiểm soát (tối đa 25% năng lực); nếu CPI dưới 0,85 thì họp khẩn cắt phạm vi.",
    "R7": "Đóng băng nhập sách; rà soát toàn bộ bản ghi thiếu ISBN bằng script; quay về bản sao lưu dữ liệu gần nhất của Neon.",
    "R8": "Kéo dài giai đoạn chạy song song với sổ tay thêm 2 tuần; thủ thư đại diện kèm 1 kèm 1; điều chỉnh giao diện quầy theo phản hồi trong 3 ngày.",
    "R9": "Khôi phục từ bản sao lưu Neon (point-in-time); chạy lại seed; kiểm tra bằng bộ smoke test trước khi mở lại cho người dùng.",
    "R10": "Tạm khoá thu phạt tự động, cho thủ thư nhập tay; sửa lỗi trong ngày, tính lại các khoản phạt bị ảnh hưởng và thông báo bạn đọc.",
    "R11": "Người thay thế đã chọn tiếp nhận việc trong 2 ngày nhờ tài liệu sinh từ mã; dời việc không găng; nếu vắng trên 2 tuần thì dùng dự phòng thuê hỗ trợ.",
}


def risk_rows() -> list[list]:
    rows = []
    for r in m.RISKS:
        rows.append([r.rid, r.name, r.group, r.p, r.i, r.score, r.level])
    return rows


# --------------------------------------------------------------------------- Tải sau nén
def compressed_load() -> dict:
    plan = q.compress_plan()
    tot, by_role = m.weekly_plan(plan["C"]["acts"])
    cap = 4 * m.CAPACITY_PER_PERSON
    peak_w = max(tot, key=tot.get)
    role_peak = {r: max(by_role[r].values()) for r in m.ROLES}
    base_tot, base_roles = m.weekly_plan()
    return {
        "peak": tot[peak_w], "peak_week": peak_w, "cap": cap, "role_peak": role_peak,
        "base_peak": max(base_tot.values()), "base_role_peak": {r: max(base_roles[r].values()) for r in m.ROLES},
        "weeks": tot,
    }


# --------------------------------------------------------------------------- Test script mẫu
TEST_SCRIPTS = [
    {
        "id": "TS-01",
        "name": "Mượn sách tại quầy (US thủ thư: tạo phiếu mượn)",
        "muc_tieu": "Kiểm tra thủ thư tạo được phiếu mượn đúng quy tắc BR về hạn mức, tình trạng bản sao, nợ phạt và quá hạn.",
        "tien_dieu_kien": "Đăng nhập tài khoản thủ thư; có một bạn đọc sinh viên đang hoạt động, không quá hạn, không nợ phạt; có bản sao ở trạng thái AVAILABLE với mã vạch hợp lệ.",
        "du_lieu": "Mã vạch bản sao AVAILABLE, mã vạch bản sao BORROWED, mã bạn đọc hợp lệ, bạn đọc đã mượn đủ hạn mức, bạn đọc còn nợ phạt, bạn đọc có sách quá hạn.",
        "buoc": [
            ["1", "POST /api/loans với mã vạch AVAILABLE và mã bạn đọc hợp lệ", "201; phiếu có trạng thái ACTIVE; hạn trả = ngày mượn + số ngày theo chính sách của nhóm bạn đọc; bản sao chuyển BORROWED; có điểm nguy cơ trễ hoặc null khi dịch vụ gợi ý chưa sẵn sàng"],
            ["2", "POST /api/loans với mã vạch bản sao đang BORROWED", "409, mã lỗi COPY_NOT_AVAILABLE; không tạo phiếu"],
            ["3", "POST /api/loans cho bạn đọc đã mượn đủ hạn mức", "409, mã lỗi LOAN_LIMIT_REACHED"],
            ["4", "POST /api/loans cho bạn đọc còn khoản phạt chưa thu", "409, mã lỗi UNPAID_FINE"],
            ["5", "POST /api/loans cho bạn đọc đang giữ sách quá hạn", "409, mã lỗi HAS_OVERDUE_LOAN"],
            ["6", "Gọi POST /api/loans bằng tài khoản bạn đọc (không phải thủ thư)", "403; không tạo phiếu"],
        ],
        "tieu_chi": "Cả 6 bước cho đúng mã trạng thái và mã lỗi; sau bước 1 số bản sao còn trên kệ của đầu sách giảm đúng 1; không có thay đổi dữ liệu ở bước 2 đến 6.",
        "lien_he": "Luồng tương đương đã có kiểm thử tự động (e2e trên PostgreSQL thật) và kịch bản smoke trong kho mã.",
    },
    {
        "id": "TS-02",
        "name": "Trả sách quá hạn, tính phạt và thu phạt",
        "muc_tieu": "Kiểm tra quy tắc phạt theo số ngày lịch (BR-07), ca biên quanh ngày hạn và việc chặn mượn khi còn nợ phạt.",
        "tien_dieu_kien": "Có phiếu ACTIVE quá hạn 5 ngày của sinh viên; chính sách phạt 5.000 đồng mỗi ngày; thủ thư đã đăng nhập.",
        "du_lieu": "Phiếu quá hạn 5 ngày; phiếu còn hạn; phiếu trả đúng cuối ngày hạn; phiếu trả sang ngày kế tiếp.",
        "buoc": [
            ["1", "POST /api/loans/{id}/return cho phiếu quá hạn 5 ngày", "200; phiếu RETURNED; có khoản phạt loại OVERDUE = 5 x 5.000 = 25.000 đồng; bản sao về AVAILABLE"],
            ["2", "POST /api/loans/{id}/return cho phiếu trả đúng vào ngày hạn (cuối ngày)", "200; không có khoản phạt"],
            ["3", "POST /api/loans/{id}/return cho phiếu trả sau ngày hạn 1 ngày lịch (ví dụ hạn 23:59, trả 00:01 hôm sau)", "200; phạt 1 ngày = 5.000 đồng (tính theo ngày lịch, không theo mỗi 24 giờ)"],
            ["4", "Thử mượn thêm cho bạn đọc vừa bị phạt ở bước 1", "409, mã lỗi UNPAID_FINE"],
            ["5", "POST /api/fines/{id}/pay cho khoản phạt bước 1", "200; khoản phạt có thời điểm thu; bạn đọc mượn lại được"],
            ["6", "POST /api/fines/{id}/pay lần thứ hai", "409, mã lỗi FINE_ALREADY_PAID"],
        ],
        "tieu_chi": "Số tiền phạt đúng ở cả 3 ca (quá hạn, đúng hạn, trễ 1 ngày lịch); trạng thái bản sao và phiếu nhất quán; không thu phạt hai lần.",
        "lien_he": "Đây là luồng đã từng phát hiện lỗi thật (tính theo giờ thay vì ngày lịch), đã sửa và có bài test biên chặn tái diễn.",
    },
    {
        "id": "TS-03",
        "name": "Đăng nhập, khoá thẻ và phân quyền",
        "muc_tieu": "Kiểm tra xác thực, khoá tài khoản, giới hạn tần suất và phân quyền theo vai trò (NFR-SEC-01 đến 05).",
        "tien_dieu_kien": "Có tài khoản bạn đọc, thủ thư, quản trị viên; một tài khoản đã bị khoá; hệ thống đang chạy.",
        "du_lieu": "Email và mật khẩu đúng, mật khẩu sai, tài khoản bị khoá, mã JWT hợp lệ của bạn đọc, yêu cầu không có mã.",
        "buoc": [
            ["1", "POST /api/auth/login với email và mật khẩu đúng", "200; trả mã truy cập JWT hạn 24 giờ và thông tin người dùng, không có mật khẩu hay mã băm"],
            ["2", "POST /api/auth/login với mật khẩu sai", "401, mã lỗi INVALID_CREDENTIALS"],
            ["3", "POST /api/auth/login với tài khoản đã bị khoá", "403, mã lỗi ACCOUNT_LOCKED"],
            ["4", "Gọi POST /api/books bằng mã JWT của bạn đọc", "403"],
            ["5", "Gọi GET /api/loans không kèm mã truy cập", "401"],
            ["6", "Gửi 11 yêu cầu đăng nhập trong 1 phút từ cùng một địa chỉ", "Yêu cầu thứ 11 bị từ chối 429 (giới hạn 10 lần mỗi phút)"],
        ],
        "tieu_chi": "Cả 6 bước đúng mã trạng thái; phản hồi không lộ thông tin nhạy cảm; thông báo lỗi dùng đúng định dạng thống nhất (statusCode, error, message).",
        "lien_he": "Đã có kiểm thử tự động cho phân quyền và đăng nhập; riêng giới hạn tần suất kiểm bằng kịch bản thủ công.",
    },
]
