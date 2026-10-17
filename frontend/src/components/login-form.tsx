"use client";

import { Mail } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useRef, useState } from "react";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useDesktopAutofocus } from "@/lib/use-desktop-autofocus";
import { FormError, InlineSpinner, PasswordField, TextField } from "./forms/controls";
import { Button } from "./ui";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function LoginFormInner() {
  const { login } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useDesktopAutofocus(emailRef);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    // Kiểm tra tại chỗ trước khi gọi máy chủ; lỗi đầu tiên được đưa con trỏ tới
    const next: typeof errors = {};
    if (!email.trim()) next.email = "Nhập email đăng nhập.";
    else if (!EMAIL_PATTERN.test(email.trim())) next.email = "Email chưa đúng dạng, ví dụ ten@student.muce.edu.vn.";
    if (!password) next.password = "Nhập mật khẩu.";
    setErrors(next);
    if (next.email) return emailRef.current?.focus();
    if (next.password) return passwordRef.current?.focus();

    setBusy(true);
    try {
      const user = await login(email.trim(), password);
      const target = params.get("next");
      // Chỉ nhận đường dẫn nội bộ, chặn open redirect kiểu //evil.com hoặc https://evil.com
      // Mật khẩu tạm: bắt đổi mật khẩu trước khi làm gì khác
      if (user.mustChangePassword) router.push("/account?forced=1");
      else if (target && /^\/(?![/\\])/.test(target)) router.push(target);
      else if (user.role === "READER") router.push("/my/loans");
      else if (user.role === "ADMIN") router.push("/admin");
      else router.push("/librarian/desk");
    } catch (err) {
      setError(err instanceof ApiError ? err.friendlyMessage : "Không đăng nhập được, vui lòng thử lại.");
      passwordRef.current?.select();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {error && <FormError>{error}</FormError>}
      <TextField
        id="o-email"
        ref={emailRef}
        label="Email"
        type="email"
        inputMode="email"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        required
        value={email}
        error={errors.email}
        onChange={(event) => {
          setEmail(event.target.value);
          if (errors.email) setErrors((e) => ({ ...e, email: undefined }));
        }}
        leading={<Mail size={18} />}
        placeholder="ten@student.muce.edu.vn"
      />
      <PasswordField
        id="o-mat-khau"
        ref={passwordRef}
        label="Mật khẩu"
        autoComplete="current-password"
        required
        value={password}
        error={errors.password}
        onChange={(event) => {
          setPassword(event.target.value);
          if (errors.password) setErrors((e) => ({ ...e, password: undefined }));
        }}
        placeholder="Nhập mật khẩu"
      />
      <div className="flex justify-end">
        <Link href="/forgot-password" className="-my-2 inline-flex min-h-10 items-center rounded-lg px-1 text-sm font-semibold text-primary hover:text-primary-hover hover:underline">
          Quên mật khẩu?
        </Link>
      </div>
      <Button type="submit" disabled={busy} aria-busy={busy} className="min-h-12 w-full text-[0.9375rem]">
        {busy && <InlineSpinner />}
        {busy ? "Đang kiểm tra..." : "Đăng nhập"}
      </Button>
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
