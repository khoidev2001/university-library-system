"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Alert, Button, Field, inputClass } from "./ui";

function LoginFormInner() {
  const { login } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const user = await login(email, password);
      const next = params.get("next");
      // Chỉ nhận đường dẫn nội bộ, chặn open redirect kiểu //evil.com hoặc https://evil.com
      // Mật khẩu tạm: bắt đổi mật khẩu trước khi làm gì khác
      if (user.mustChangePassword) router.push("/account?forced=1");
      else if (next && /^\/(?![/\\])/.test(next)) router.push(next);
      else if (user.role === "READER") router.push("/my/loans");
      else if (user.role === "ADMIN") router.push("/admin");
      else router.push("/librarian/desk");
    } catch (err) {
      setError(err instanceof ApiError ? err.friendlyMessage : "Không đăng nhập được, vui lòng thử lại.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error && <Alert tone="bad">{error}</Alert>}
      <Field label="Email" htmlFor="o-email">
        <input
          id="o-email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className={inputClass}
          placeholder="ten@student.muce.edu.vn"
        />
      </Field>
      <Field label="Mật khẩu" htmlFor="o-mat-khau">
        <input
          id="o-mat-khau"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className={inputClass}
          placeholder="Nhập mật khẩu"
        />
      </Field>
      <Button type="submit" disabled={busy} className="w-full">
        {busy ? "Đang kiểm tra..." : "Đăng nhập"}
      </Button>
      <p className="text-center text-sm">
        <Link href="/forgot-password" className="inline-flex min-h-10 items-center font-medium text-brand hover:underline">
          Quên mật khẩu?
        </Link>
      </p>
    </form>
  );
}

export function LoginForm() {
  return (
    <Suspense fallback={<p className="text-sm text-ink-faint">Đang tải biểu mẫu...</p>}>
      <LoginFormInner />
    </Suspense>
  );
}
