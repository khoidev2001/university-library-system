"""Smoke test Sprint 3 (AI) trên backend + AI service ĐANG CHẠY với dữ liệu thật.

Kiểm cả hai hướng: AI sống thì dự báo/gợi ý có thật; AI chết thì hệ thống vẫn cho mượn
và vẫn trả được danh sách gợi ý thay thế (FR-LOAN-02, FR-AI-02, NFR-AVAIL-03).

Usage: python test/smoke-sprint3.py [base_url] [ai_url] [pg_container]
"""
from __future__ import annotations

import json
import subprocess
import sys
import urllib.error
import urllib.request

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3012/api"
AI = sys.argv[2] if len(sys.argv) > 2 else "http://localhost:8002"
PG_CONTAINER = sys.argv[3] if len(sys.argv) > 3 else "uls-s3-postgres-1"
checks = 0


def call(method: str, path: str, body=None, token=None, base=BASE, timeout=30):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(base + path, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as res:
            raw = res.read()
            return res.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as e:
        raw = e.read()
        return e.code, (json.loads(raw) if raw else None)
    except urllib.error.URLError as e:
        return 0, {"error": str(e.reason)}


def expect(label: str, status: int, want: int, body=None, want_error=None) -> None:
    global checks
    checks += 1
    ok = status == want and (want_error is None or (isinstance(body, dict) and body.get("error") == want_error))
    print(f"{'OK ' if ok else 'FAIL'} {label}: {status}")
    if not ok:
        print("   body:", json.dumps(body, ensure_ascii=False, default=str)[:400])
        sys.exit(1)


def sql(statement: str) -> str:
    out = subprocess.run(
        ["docker", "exec", "-i", PG_CONTAINER, "psql", "-U", "uls", "-d", "uls", "-tA", "-c", statement],
        capture_output=True, text=True, timeout=60,
    )
    if out.returncode != 0:
        print("psql loi:", out.stderr[:300])
        sys.exit(1)
    return out.stdout.strip()


def login(email, password):
    s, b = call("POST", "/auth/login", {"email": email, "password": password})
    expect(f"login {email}", s, 200)
    return b["accessToken"]


librarian = login("librarian1@uls.local", "Admin@123")
reader = login("reader@uls.local", "Reader@123")
admin = login("admin@uls.local", "Admin@123")
MEMBER_CODE = "23Q74802012006"
reader_id = int(sql(f"SELECT id FROM users WHERE member_code='{MEMBER_CODE}'"))

print("\n--- AI service tu huan luyen tu backend")
s, b = call("GET", "/health", base=AI)
expect("ai /health", s, 200)
assert b["models"] == {"recommender": "ready", "overdue": "ready"}, b["models"]
assert b["lastTraining"]["status"] == "ok", b["lastTraining"]

s, b = call("GET", "/metrics", base=AI)
expect("ai /metrics", s, 200)
rec, ovd = b["recommender"], b["overdue"]
assert rec["books"] > 900 and rec["users"] > 1000, rec
assert rec["precision_at_5"] >= 0.15, f"US18 doi Precision@5 >= 0.15, nhan {rec['precision_at_5']}"
best_auc = max(ovd["logistic_regression"]["roc_auc"], ovd["random_forest"]["roc_auc"])
assert best_auc >= 0.70, f"US19 doi ROC-AUC >= 0.70, nhan {best_auc}"
print(f"     P@5={rec['precision_at_5']} R@5={rec['recall_at_5']} | ROC-AUC tot nhat={best_auc} ({ovd['chosen']})")

print("\n--- Endpoint noi bo chi danh cho AI")
s, b = call("GET", "/internal/training-data")
expect("khong co X-Internal-Key -> 401", s, 401)

print("\n--- Goi y sach (US18)")
s, b = call("GET", "/recommendations/me?k=10", token=reader)
expect("ban doc nhan goi y", s, 200)
assert b["source"] in ("MODEL", "POPULAR") and len(b["items"]) == 10, b["source"]
assert all(item["title"] and item["category"]["name"] for item in b["items"]), b["items"][:1]
borrowed_books = set(sql(f"SELECT DISTINCT c.book_id FROM loans l JOIN book_copies c ON c.id=l.copy_id WHERE l.user_id={reader_id}").split())
assert not {str(i["id"]) for i in b["items"]} & borrowed_books, "khong duoc goi y sach da muon"
print(f"     source={b['source']}, vi du: {b['items'][0]['title'][:45]}")

s, b = call("GET", "/recommendations/me", token=librarian)
expect("thu thu goi /recommendations/me -> 403", s, 403)
s, b = call("GET", "/recommendations/metrics", token=reader)
expect("ban doc xem metrics -> 403", s, 403)
s, b = call("GET", "/recommendations/metrics", token=librarian)
expect("thu thu xem metrics", s, 200)
assert b["overdue"]["chosen"] in ("logistic_regression", "random_forest"), b

print("\n--- Du bao tra tre khi cho muon (US19)")
sql(f"DELETE FROM fines WHERE loan_id IN (SELECT id FROM loans WHERE user_id={reader_id})")
sql(f"UPDATE book_copies SET status='AVAILABLE' WHERE id IN (SELECT copy_id FROM loans WHERE user_id={reader_id} AND status='ACTIVE')")
sql(f"DELETE FROM loans WHERE user_id={reader_id}")
barcode = sql("SELECT barcode FROM book_copies WHERE status='AVAILABLE' ORDER BY id LIMIT 1")

s, b = call("POST", "/loans", {"barcode": barcode, "memberCode": MEMBER_CODE}, token=librarian)
expect("cho muon kem du bao", s, 201)
risk = b["overdueRisk"]
assert isinstance(risk, float) and 0.0 <= risk <= 1.0, f"phai co du bao that, nhan {risk}"
stored = sql(f"SELECT predicted_overdue_risk FROM loans WHERE id={b['loan']['id']}")
assert abs(float(stored) - risk) < 1e-6, (stored, risk)
print(f"     nguy co tra tre = {risk:.0%}, da luu vao phieu")
loan_id = b["loan"]["id"]

s, b = call("GET", "/recommendations/overdue-accuracy", token=librarian)
expect("doi chieu khi chua co phieu nao da tra kem du bao", s, 200)
assert b == {"sampled": 0, "predictedHigh": 0, "actuallyLate": 0, "hitRate": None}, b

# Tra phieu vua muon -> gio moi co mot mau de doi chieu du bao voi ket qua that
s, b = call("POST", f"/loans/{loan_id}/return", token=librarian)
expect("tra phieu da co du bao", s, 200)
s, b = call("GET", "/recommendations/overdue-accuracy", token=librarian)
expect("doi chieu du bao voi thuc te", s, 200)
assert b["sampled"] == 1, b
print(f"     mau doi chieu: {b['sampled']} phieu, du bao cao: {b['predictedHigh']}")

print("\n--- Admin yeu cau huan luyen lai")
s, b = call("POST", "/recommendations/train", token=librarian)
expect("thu thu goi train -> 403", s, 403)
s, b = call("POST", "/recommendations/train", token=admin)
expect("admin goi train", s, 202)

print(f"\n{checks} checks passed")
print("(phan fallback khi AI chet duoc kiem rieng: xem muc 'AI down' trong lenh chay)")
