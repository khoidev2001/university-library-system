"""Smoke test Sprint 2 (mượn/trả/phạt/đánh giá/báo cáo) trên backend ĐANG CHẠY + DB thật.

Không phải unit test: đây là bằng chứng mức ba cho phần đụng DB và tiền.
Để kiểm luồng trả trễ, script lùi ngày hết hạn của phiếu bằng SQL (giả lập thời gian trôi),
rồi gọi đúng endpoint production để hệ thống tự tính phạt.

Usage: python test/smoke-sprint2.py [base_url] [psql_container]
       (mặc định http://localhost:3011/api, uls-s2-postgres-1)
"""
from __future__ import annotations

import json
import subprocess
import sys
import urllib.error
import urllib.request

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3011/api"
PG_CONTAINER = sys.argv[2] if len(sys.argv) > 2 else "uls-s2-postgres-1"
checks = 0


def call(method: str, path: str, body: dict | None = None, token: str | None = None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            raw = res.read()
            return res.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as e:
        raw = e.read()
        return e.code, (json.loads(raw) if raw else None)


def expect(label: str, status: int, want: int, body=None, want_error: str | None = None) -> None:
    global checks
    checks += 1
    ok = status == want and (want_error is None or (isinstance(body, dict) and body.get("error") == want_error))
    extra = f" {body.get('error')}" if isinstance(body, dict) and "error" in body else ""
    print(f"{'OK ' if ok else 'FAIL'} {label}: {status}{extra}")
    if not ok:
        print("   body:", json.dumps(body, ensure_ascii=False, default=str)[:400])
        sys.exit(1)


def sql(statement: str) -> str:
    """Chạy SQL trực tiếp để giả lập thời gian trôi và để kiểm chứng trạng thái trong DB."""
    out = subprocess.run(
        ["docker", "exec", "-i", PG_CONTAINER, "psql", "-U", "uls", "-d", "uls", "-tA", "-c", statement],
        capture_output=True, text=True, timeout=60,
    )
    if out.returncode != 0:
        print("psql lỗi:", out.stderr[:300])
        sys.exit(1)
    return out.stdout.strip()


def login(email: str, password: str) -> str:
    status, body = call("POST", "/auth/login", {"email": email, "password": password})
    expect(f"login {email}", status, 200)
    return body["accessToken"]


librarian = login("librarian1@uls.local", "Admin@123")
reader = login("reader@uls.local", "Reader@123")
admin = login("admin@uls.local", "Admin@123")

MEMBER_CODE = "23Q74802012006"
reader_id = int(sql(f"SELECT id FROM users WHERE member_code = '{MEMBER_CODE}'"))

# Dọn trạng thái của riêng bạn đọc demo để chạy lại được nhiều lần
sql(f"DELETE FROM fines WHERE loan_id IN (SELECT id FROM loans WHERE user_id = {reader_id})")
sql(f"UPDATE book_copies SET status='AVAILABLE' WHERE id IN (SELECT copy_id FROM loans WHERE user_id={reader_id} AND status='ACTIVE')")
sql(f"DELETE FROM loans WHERE user_id = {reader_id}")
sql(f"DELETE FROM ratings WHERE user_id = {reader_id}")

barcodes = sql(
    "SELECT barcode FROM book_copies WHERE status='AVAILABLE' ORDER BY id LIMIT 5"
).splitlines()
assert len(barcodes) >= 5, barcodes
book_id = int(sql(f"SELECT book_id FROM book_copies WHERE barcode='{barcodes[0]}'"))
book_price = int(sql(f"SELECT price FROM books WHERE id={book_id}"))

print("\n--- Cho mượn (US07, BR-01…BR-05)")
s, b = call("POST", "/loans", {"barcode": barcodes[0], "memberCode": MEMBER_CODE}, token=reader)
expect("reader tự tạo phiếu → 403", s, 403)
s, b = call("POST", "/loans", {"barcode": barcodes[0], "memberCode": "KHONG-CO"}, token=librarian)
expect("mã bạn đọc lạ → 404", s, 404)
s, b = call("POST", "/loans", {"barcode": "KHONG-CO", "memberCode": MEMBER_CODE}, token=librarian)
expect("mã vạch lạ → 404", s, 404)

s, b = call("POST", "/loans", {"barcode": barcodes[0], "memberCode": MEMBER_CODE}, token=librarian)
expect("cho mượn", s, 201)
loan_id = b["loan"]["id"]
assert b["loan"]["status"] == "ACTIVE" and b["loan"]["renewedCount"] == 0, b["loan"]
risk = b["overdueRisk"]
assert risk is None or (isinstance(risk, float) and 0.0 <= risk <= 1.0), (
    f"AI chạy thì phải là xác suất 0..1, AI tắt thì phải là null (fallback), nhận {risk!r}"
)
due_days = int(sql(f"SELECT DATE_PART('day', due_at - borrowed_at) FROM loans WHERE id={loan_id}"))
assert due_days == 14, f"hạn phải là 14 ngày theo chính sách STUDENT, nhận {due_days}"
assert sql(f"SELECT status FROM book_copies WHERE barcode='{barcodes[0]}'") == "BORROWED"
print(f"     phiếu #{loan_id}, hạn +{due_days} ngày, bản sao → BORROWED")

s, b = call("POST", "/loans", {"barcode": barcodes[0], "memberCode": MEMBER_CODE}, token=librarian)
expect("mượn lại chính bản sao đó → 409", s, 409, b, "COPY_NOT_AVAILABLE")

print("\n--- Gia hạn (US09, BR-06)")
s, b = call("POST", f"/loans/{loan_id}/renew", token=librarian)
expect("thủ thư gia hạn hộ → 403", s, 403)
s, b = call("POST", f"/loans/{loan_id}/renew", token=reader)
expect("bạn đọc gia hạn", s, 200)
assert b["renewedCount"] == 1, b
renewed_days = int(sql(f"SELECT DATE_PART('day', due_at - borrowed_at) FROM loans WHERE id={loan_id}"))
assert renewed_days == 21, f"gia hạn +7 ngày → 21, nhận {renewed_days}"
s, b = call("POST", f"/loans/{loan_id}/renew", token=reader)
expect("gia hạn lần 2 → 409", s, 409, b, "RENEW_LIMIT_REACHED")

print("\n--- Giới hạn số cuốn (BR-02)")
for i in (1, 2):
    s, b = call("POST", "/loans", {"barcode": barcodes[i], "memberCode": MEMBER_CODE}, token=librarian)
    expect(f"mượn cuốn thứ {i + 1}", s, 201)
s, b = call("POST", "/loans", {"barcode": barcodes[3], "memberCode": MEMBER_CODE}, token=librarian)
expect("cuốn thứ 4 → 409", s, 409, b, "LOAN_LIMIT_REACHED")

print("\n--- Quá hạn (BR-03, BR-09), lùi hạn phiếu 3 ngày bằng SQL")
sql(f"UPDATE loans SET due_at = NOW() - INTERVAL '3 days' WHERE id = {loan_id}")
s, b = call("GET", "/loans/me?status=ACTIVE", token=reader)
expect("bạn đọc thấy phiếu quá hạn", s, 200)
mine = next(x for x in b["items"] if x["id"] == loan_id)
assert mine["isOverdue"] is True and mine["overdueDays"] == 3, mine
s, b = call("POST", f"/loans/{loan_id}/renew", token=reader)
expect("gia hạn khi đã quá hạn → 409", s, 409, b, "LOAN_OVERDUE_CANNOT_RENEW")
s, b = call("GET", "/loans?overdue=true", token=librarian)
expect("thủ thư lọc phiếu quá hạn", s, 200)
assert any(x["id"] == loan_id for x in b["items"]), "phiếu vừa lùi hạn phải nằm trong danh sách quá hạn"

print("\n--- Trả trễ và phạt (US08, BR-07)")
s, b = call("POST", f"/loans/{loan_id}/return", token=librarian)
expect("nhận trả", s, 200)
assert b["overdueDays"] == 3, b
assert b["fine"]["amount"] == 15000 and b["fine"]["type"] == "OVERDUE", b["fine"]
fine_id = b["fine"]["id"]
assert sql(f"SELECT status FROM book_copies WHERE barcode='{barcodes[0]}'") == "AVAILABLE"
assert sql(f"SELECT status FROM loans WHERE id={loan_id}") == "RETURNED"
print(f"     trễ 3 ngày → phạt 15.000đ (#{fine_id}), bản sao → AVAILABLE")

s, b = call("POST", f"/loans/{loan_id}/return", token=librarian)
expect("trả lại phiếu đã đóng → 409", s, 409, b, "LOAN_NOT_ACTIVE")

print("\n--- Nợ phạt chặn mượn và gia hạn (BR-04)")
s, b = call("POST", "/loans", {"barcode": barcodes[3], "memberCode": MEMBER_CODE}, token=librarian)
expect("còn nợ phạt → không cho mượn", s, 409, b, "UNPAID_FINE")
s, b = call("GET", "/fines/me", token=reader)
expect("bạn đọc xem phạt", s, 200)
assert b["unpaidTotal"] == 15000, b

print("\n--- Thu tiền phạt (US12)")
s, b = call("POST", f"/fines/{fine_id}/pay", token=reader)
expect("bạn đọc tự xác nhận đã trả → 403", s, 403)
s, b = call("POST", f"/fines/{fine_id}/pay", token=librarian)
expect("thủ thư thu tiền", s, 200)
assert b["paidAt"] is not None and b["paidToId"] is not None, b
s, b = call("POST", f"/fines/{fine_id}/pay", token=librarian)
expect("thu lần hai → 409", s, 409, b, "FINE_ALREADY_PAID")
s, b = call("POST", "/loans", {"barcode": barcodes[3], "memberCode": MEMBER_CODE}, token=librarian)
expect("trả phạt xong thì mượn lại được", s, 201)
lost_loan_id = b["loan"]["id"]

print("\n--- Đánh giá sách (US17, BR-11)")
s, b = call("POST", f"/books/{book_id}/ratings", {"score": 5}, token=reader)
expect("chấm điểm sách đã trả", s, 200)
s, b = call("POST", f"/books/{book_id}/ratings", {"score": 3}, token=reader)
expect("chấm lại ghi đè", s, 200)
assert int(sql(f"SELECT COUNT(*) FROM ratings WHERE user_id={reader_id} AND book_id={book_id}")) == 1
never_borrowed = int(sql(f"SELECT id FROM books WHERE id <> {book_id} ORDER BY id DESC LIMIT 1"))
s, b = call("POST", f"/books/{never_borrowed}/ratings", {"score": 5}, token=reader)
expect("chấm sách chưa mượn → 403", s, 403, b, "NOT_BORROWED")
s, b = call("POST", f"/books/{book_id}/ratings", {"score": 9}, token=reader)
expect("điểm ngoài 1-5 → 400", s, 400)
s, b = call("GET", f"/books/{book_id}/ratings/summary")
expect("tóm tắt đánh giá (công khai)", s, 200)

print("\n--- Báo mất (US11, BR-08)")
lost_barcode = sql(f"SELECT barcode FROM book_copies WHERE id = (SELECT copy_id FROM loans WHERE id={lost_loan_id})")
lost_price = int(sql(f"SELECT b.price FROM books b JOIN book_copies c ON c.book_id=b.id WHERE c.barcode='{lost_barcode}'"))
sql(f"UPDATE loans SET due_at = NOW() - INTERVAL '2 days' WHERE id = {lost_loan_id}")
s, b = call("POST", f"/loans/{lost_loan_id}/report-lost", token=librarian)
expect("ghi nhận mất sách", s, 200)
assert b["fine"]["type"] == "LOST", b["fine"]
assert b["fine"]["amount"] == lost_price + 2 * 5000, (b["fine"]["amount"], lost_price)
assert sql(f"SELECT status FROM book_copies WHERE barcode='{lost_barcode}'") == "LOST"
print(f"     phạt mất = giá bìa {lost_price:,}đ + 2 ngày trễ = {b['fine']['amount']:,}đ")

print("\n--- Báo cáo (US16)")
s, b = call("GET", "/reports/top-books?limit=5", token=librarian)
expect("top sách mượn nhiều", s, 200)
assert len(b) == 5 and b[0]["loanCount"] >= b[-1]["loanCount"], b[:2]
s, b = call("GET", "/reports/overdue", token=librarian)
expect("bạn đọc quá hạn", s, 200)
assert len(b) > 0 and b[0]["estimatedFine"] == b[0]["overdueDays"] * 5000, b[:1]
s, b = call("GET", "/reports/loans-by-month?months=12", token=librarian)
expect("lượt mượn 12 tháng", s, 200)
assert len(b) == 12 and sum(x["count"] for x in b) > 0, b
s, b = call("GET", "/reports/inventory", token=librarian)
expect("tồn kho theo thể loại", s, 200)
assert sum(x["total"] for x in b) > 1000 and any(x["lost"] > 0 for x in b), b[:2]
s, b = call("GET", "/reports/overdue", token=reader)
expect("bạn đọc xem báo cáo → 403", s, 403)

print(f"\n{checks} checks passed")
