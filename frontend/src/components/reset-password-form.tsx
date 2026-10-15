"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ApiError, apiFetch } from "@/lib/api";
import { Alert, Button, Field, inputClass } from "./ui";

/**
 * Đặt lại mật khẩu bằng token trong liên kết email. Token được đọc một lần rồi xoá khỏi thanh địa chỉ
 * (không nằm lại trong lịch sử trình duyệt hay gửi đi qua Referer).
 */
export function ResetPasswordForm() {
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  // Chế độ Strict của React chạy hiệu ứng hai lần: lần hai không còn token trên thanh địa chỉ
  const read = useRef(false);
  useEffect(() => {
    if (read.current) return;
    read.current = true;
    const url = new URL(window.location.href);
    const found = url.searchParams.get("token");
    setToken(found);
    if (found) window.history.replaceState(null, "", url.pathname);
  }, []);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Hai mật khẩu nhập vào không giống nhau.");
      return;
    }
    setBusy(true);
    try {
      await apiFetch("/auth/reset-password", { method: "POST", body: { token, newPassword: password } });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.friendlyMessage : "Không đặt lại được mật khẩu, vui lòng thử lại.");
    } finally {
      setBusy(false);
    }
  }

  if (token === undefined) return <p className="text-sm text-ink-faint">Đang tải...</p>;

  if (done) {
    return (
      <div className="space-y-4">
        <Alert tone="good">Đã đặt lại mật khẩu. Các phiên đăng nhập cũ đã bị đăng xuất.</Alert>
        <Link
          href="/login"
          className="inline-flex min-h-10 w-full items-center justify-center rounded-md bg-ink px-4 py-2.5 text-sm font-medium text-paper hover:bg-ink/90"
        >
          Đăng nhập
        </Link>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="space-y-4">
        <Alert tone="bad">Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn. Hãy xin liên kết mới.</Alert>
        <Link
          href="/forgot-password"
          className="inline-flex min-h-10 w-full items-center justify-center rounded-md bg-ink px-4 py-2.5 text-sm font-medium text-paper hover:bg-ink/90"
        >
          Xin liên kết mới
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error && (
        <Alert tone="bad">
          {error}{" "}
          {error.includes("hết hạn") && (
            <Link href="/forgot-password" className="font-medium underline">
              Xin liên kết mới
            </Link>
          )}
        </Alert>
      )}
      <Field label="Mật khẩu mới" htmlFor="reset-password" hint="Từ 8 ký tự trở lên">
        <input
          id="reset-password"
          type="password"
          required
          minLength={8}
          maxLength={72}
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className={inputClass}
        />
      </Field>
      <Field label="Nhập lại mật khẩu mới" htmlFor="reset-password-confirm">
        <input
          id="reset-password-confirm"
          type="password"
          required
          minLength={8}
          maxLength={72}
          autoComplete="new-password"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          className={inputClass}
        />
      </Field>
      <Button type="submit" disabled={busy} className="w-full">
        {busy ? "Đang lưu..." : "Đặt lại mật khẩu"}
      </Button>
    </form>
  );
}
