"use client";

import Link from "next/link";
import { useState } from "react";
import { ApiError, apiFetch } from "@/lib/api";
import { Alert, Button, Field, inputClass } from "./ui";

/** Quên mật khẩu: luôn hiện cùng một thông báo dù email có đăng ký hay không (backend cũng vậy). */
export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await apiFetch<{ message: string }>("/auth/forgot-password", {
        method: "POST",
        body: { email: email.trim() },
      });
      setMessage(result.message);
    } catch (err) {
      setError(err instanceof ApiError ? err.friendlyMessage : "Không gửi được yêu cầu, vui lòng thử lại.");
    } finally {
      setBusy(false);
    }
  }

  if (message) {
    return (
      <div className="space-y-4">
        <Alert tone="good">{message}</Alert>
        <p className="text-sm text-ink-soft">
          Liên kết có hiệu lực 1 giờ và chỉ dùng được một lần. Không thấy thư? Hãy đợi vài phút rồi xem mục thư rác, hoặc
          nhờ thủ thư tại quầy cấp mật khẩu tạm.
        </p>
        <Link
          href="/login"
          className="inline-flex min-h-10 w-full items-center justify-center rounded-md border border-line bg-white px-4 py-2.5 text-sm font-medium hover:bg-paper-2"
        >
          Về trang đăng nhập
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error && <Alert tone="bad">{error}</Alert>}
      <Field label="Email đã đăng ký" htmlFor="forgot-email">
        <input
          id="forgot-email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className={inputClass}
          placeholder="ten@student.muce.edu.vn"
        />
      </Field>
      <Button type="submit" disabled={busy} className="w-full">
        {busy ? "Đang gửi..." : "Gửi liên kết đặt lại mật khẩu"}
      </Button>
      <p className="text-center text-sm">
        <Link href="/login" className="inline-flex min-h-10 items-center font-medium text-brand hover:underline">
          Quay lại đăng nhập
        </Link>
      </p>
    </form>
  );
}
