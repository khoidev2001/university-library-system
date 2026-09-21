"""Smoke test Sprint 1 against a RUNNING backend + seeded DB (not a unit test).

Usage: python test/smoke-sprint1.py [base_url]   (default http://localhost:3010/api)
Exits non-zero on the first mismatch. Prints one line per check.
"""
from __future__ import annotations

import json
import sys
import urllib.error
import urllib.request

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3010/api"
checks = 0
RUN = str(int(__import__("time").time()))[-6:]  # hậu tố duy nhất mỗi lần chạy


def call(method: str, path: str, body: dict | None = None, token: str | None = None) -> tuple[int, dict | list | None]:
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=15) as res:
            raw = res.read()
            return res.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as e:
        raw = e.read()
        return e.code, (json.loads(raw) if raw else None)


def expect(label: str, status: int, want_status: int, body=None, want_error: str | None = None) -> None:
    global checks
    checks += 1
    ok = status == want_status and (want_error is None or (isinstance(body, dict) and body.get("error") == want_error))
    print(f"{'OK ' if ok else 'FAIL'} {label}: {status}" + (f" {body.get('error')}" if isinstance(body, dict) and 'error' in body else ""))
    if not ok:
        print("   body:", json.dumps(body, ensure_ascii=False)[:400])
        sys.exit(1)


def login(email: str, password: str) -> str:
    status, body = call("POST", "/auth/login", {"email": email, "password": password})
    expect(f"login {email}", status, 200)
    assert "passwordHash" not in json.dumps(body)
    return body["accessToken"]


# --- auth
s, b = call("POST", "/auth/login", {"email": "admin@uls.local", "password": "wrong"})
expect("login sai mật khẩu", s, 401, b, "INVALID_CREDENTIALS")
s, b = call("POST", "/auth/login", {"email": "nobody@x.vn", "password": "wrong"})
expect("login email lạ → cùng 401", s, 401, b, "INVALID_CREDENTIALS")
admin = login("admin@uls.local", "Admin@123")
librarian = login("librarian1@uls.local", "Admin@123")
reader = login("reader@uls.local", "Reader@123")

s, b = call("POST", "/auth/register", {"email": f"new{RUN}@student.uls.local", "password": "Secret123", "fullName": "Tân SV", "memberType": "STUDENT", "memberCode": f"SV{RUN}"})
expect("register mới", s, 201)
new_id = b["id"]
s, b = call("POST", "/auth/register", {"email": f"new{RUN}@student.uls.local", "password": "Secret123", "fullName": "Tân SV", "memberType": "STUDENT", "memberCode": f"SV{RUN}b"})
expect("register trùng email", s, 409, b, "EMAIL_EXISTS")
s, b = call("POST", "/auth/register", {"email": "x@y.vn", "password": "short", "fullName": "A", "memberType": "STUDENT", "memberCode": "SV1"})
expect("register mật khẩu ngắn → 400", s, 400)
s, b = call("POST", "/auth/register", {"email": "x@y.vn", "password": "Secret123", "fullName": "A", "memberType": "STUDENT", "memberCode": "SV2", "role": "ADMIN"})
expect("register trường lạ (role) bị từ chối", s, 400)
s, b = call("GET", "/auth/me", token=reader)
expect("me", s, 200)
assert b["role"] == "READER" and "passwordHash" not in b
s, b = call("GET", "/auth/me")
expect("me không token → 401", s, 401)

# --- catalog public
s, b = call("GET", "/books?q=harry%20potter&limit=3")
expect("search public", s, 200)
assert b["total"] >= 3 and b["items"][0]["copiesTotal"] >= 1, b["items"][0]
book_id = b["items"][0]["id"]
s, b = call("GET", "/books?q=rowling&available=true&limit=1")
expect("search theo tác giả + còn sách", s, 200)
assert b["total"] > 0
s, b = call("GET", f"/books/{book_id}")
expect("chi tiết sách", s, 200)
assert b["ratingCount"] > 0 and b["authors"], b
s, b = call("GET", "/books/999999")
expect("sách không tồn tại → 404", s, 404)
s, b = call("GET", "/categories")
expect("categories", s, 200)
category_id = b[0]["id"]
s, b = call("GET", "/authors?q=king&limit=2")
expect("authors search", s, 200)
s, b = call("GET", "/policies")
expect("policies public", s, 200)
assert {p["memberType"]: p["maxBooks"] for p in b} == {"STUDENT": 3, "LECTURER": 5}

# --- RBAC
s, b = call("POST", "/books", {"title": "X", "price": 1, "categoryId": category_id, "authorIds": [1]}, token=reader)
expect("reader tạo sách → 403", s, 403)
s, b = call("GET", "/users", token=reader)
expect("reader xem users → 403", s, 403)
s, b = call("POST", "/users", {"email": f"l{RUN}@uls.local", "password": "Secret123", "fullName": "L3", "role": "LIBRARIAN"}, token=librarian)
expect("librarian tạo staff → 403", s, 403)
s, b = call("PATCH", "/policies/STUDENT", {"maxBooks": 4}, token=librarian)
expect("librarian sửa policy → 403", s, 403)

# --- librarian CRUD
s, b = call("POST", "/authors", {"name": "Tác giả Test"}, token=librarian)
expect("tạo tác giả", s, 201)
author_id = b["id"]
s, b = call("POST", "/categories", {"name": f"Thể loại {RUN}"}, token=librarian)
expect("tạo thể loại (slug tự sinh)", s, 201)
assert b["slug"] == f"the-loai-{RUN}"
cat_id = b["id"]
s, b = call("POST", "/books", {"title": "Sách Test", "isbn": f"978-{RUN}-1", "price": 90000, "categoryId": cat_id, "authorIds": [author_id]}, token=librarian)
expect("tạo sách", s, 201)
assert b["isbn"] == f"978{RUN}1"
new_book = b["id"]
s, b = call("POST", "/books", {"title": "Sách Test 2", "isbn": f"978{RUN}1", "price": 1, "categoryId": cat_id, "authorIds": [author_id]}, token=librarian)
expect("ISBN trùng → 409", s, 409, b, "ISBN_EXISTS")
s, b = call("POST", f"/books/{new_book}/copies", {"barcode": f"TEST-{RUN}", "shelfLocation": "Z9"}, token=librarian)
expect("tạo bản sao", s, 201)
copy_id = b["id"]
assert b["status"] == "AVAILABLE"
s, b = call("POST", f"/books/{new_book}/copies", {"barcode": f"TEST-{RUN}"}, token=librarian)
expect("barcode trùng → 409", s, 409, b, "BARCODE_EXISTS")
s, b = call("PATCH", f"/copies/{copy_id}", {"status": "BORROWED"}, token=librarian)
expect("đặt BORROWED tay → 409", s, 409, b, "COPY_HAS_ACTIVE_LOAN")
s, b = call("PATCH", f"/copies/{copy_id}", {"status": "MAINTENANCE"}, token=librarian)
expect("đặt MAINTENANCE", s, 200)
s, b = call("GET", f"/books/{new_book}")
expect("chi tiết: 0/1 còn mượn được", s, 200)
assert (b["copiesAvailable"], b["copiesTotal"]) == (0, 1), b
s, b = call("GET", f"/books/{new_book}/copies", token=librarian)
expect("liệt kê bản sao", s, 200)
s, b = call("PATCH", f"/books/{new_book}", {"title": "Sách Test (sửa)"}, token=librarian)
expect("sửa sách", s, 200)
s, b = call("DELETE", f"/categories/{cat_id}", token=librarian)
expect("xoá thể loại còn sách → 409", s, 409, b, "CATEGORY_IN_USE")
s, b = call("DELETE", f"/books/{new_book}", token=librarian)
expect("xoá sách", s, 204)
s, b = call("DELETE", f"/categories/{cat_id}", token=librarian)
expect("xoá thể loại", s, 204)
s, b = call("DELETE", f"/authors/{author_id}", token=librarian)
expect("xoá tác giả", s, 204)

# --- users (quản lý bạn đọc)
s, b = call("GET", f"/users?q=SV{RUN}", token=librarian)
expect("tìm bạn đọc theo mã", s, 200)
assert b["total"] == 1
s, b = call("GET", f"/users/{new_id}", token=librarian)
expect("hồ sơ bạn đọc", s, 200)
assert b["activeLoans"] == 0 and b["unpaidFines"] == 0
s, b = call("PATCH", f"/users/{new_id}", {"isActive": False}, token=librarian)
expect("khoá thẻ", s, 200)
s, b = call("POST", "/auth/login", {"email": f"new{RUN}@student.uls.local", "password": "Secret123"})
expect("thẻ khoá không đăng nhập được", s, 403, b, "ACCOUNT_LOCKED")
s, b = call("PATCH", f"/users/{new_id}", {"isActive": True}, token=librarian)
expect("mở thẻ", s, 200)

# --- admin
s, b = call("POST", "/users", {"email": f"l{RUN}@uls.local", "password": "Secret123", "fullName": "L3", "role": "LIBRARIAN"}, token=admin)
expect("admin tạo thủ thư", s, 201)
s, b = call("PATCH", "/policies/STUDENT", {"maxBooks": 4}, token=admin)
expect("admin sửa policy", s, 200)
assert b["maxBooks"] == 4
s, b = call("PATCH", "/policies/STUDENT", {"maxBooks": 3}, token=admin)
expect("trả policy về mặc định", s, 200)
s, b = call("PATCH", "/policies/STUDENT", {"maxBooks": 0}, token=admin)
expect("policy giá trị 0 → 400", s, 400)
s, b = call("GET", "/books?q=hunger%20games&limit=1")
seeded_isbn = b["items"][0]["isbn"]
s, b = call("POST", "/books/import", {"isbns": [seeded_isbn]}, token=admin)
expect("import ISBN đã có → skipped EXISTS", s, 200)
assert b["skipped"] and b["skipped"][0]["reason"] == "EXISTS", b

# --- error format
s, b = call("GET", "/books/abc")
expect("ParseIntPipe → 400 format thống nhất", s, 400)
assert set(b) >= {"statusCode", "error", "message", "path", "timestamp"}, b

print(f"\n{checks} checks passed")
