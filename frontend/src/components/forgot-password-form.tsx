"use client";

import { Mail } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { ApiError, apiFetch } from "@/lib/api";
import { useDesktopAutofocus } from "@/lib/use-desktop-autofocus";
import { FormError, InlineSpinner, TextField } from "./forms/controls";
import { SuccessMark } from "./forms/success-mark";
import { Button, ButtonLink } from "./ui";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Quên mật khẩu: luôn hiện cùng một thông báo dù email có đăng ký hay không (backend cũng vậy). */
export function ForgotPasswordForm() {
  const emailRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useDesktopAutofocus(emailRef);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!EMAIL_PATTERN.test(email.trim())) {
      setFieldError(email.trim() ? "Email chưa đúng dạng, ví dụ ten@student.muce.edu.vn." : "Nhập email đã đăng ký.");
      emailRef.current?.focus();
      return;
    }
    setFieldError(null);
    setBusy(true);
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
      <div className="space-y-5 text-center">
        <div className="flex justify-center">
          <SuccessMark size={64} />
        </div>
        <p role="status" className="text-base font-semibold leading-relaxed">
          {message}
        </p>
        <p className="text-sm leading-relaxed text-ink-soft">
          Liên kết có hiệu lực 1 giờ và chỉ dùng được một lần. Không thấy thư? Hãy đợi vài phút rồi xem mục thư rác, hoặc
          nhờ thủ thư tại quầy cấp mật khẩu tạm.
        </p>
        <div className="flex [&>a]:w-full">
          <ButtonLink href="/login" variant="soft">
            Về trang đăng nhập
          </ButtonLink>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {error && <FormError>{error}</FormError>}
      <TextField
        id="forgot-email"
        ref={emailRef}
        label="Email đã đăng ký"
        type="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        required
        value={email}
        error={fieldError}
        onChange={(event) => {
          setEmail(event.target.value);
          if (fieldError) setFieldError(null);
        }}
        leading={<Mail size={18} />}
        placeholder="ten@student.muce.edu.vn"
      />
      <Button type="submit" disabled={busy} aria-busy={busy} className="min-h-12 w-full text-[0.9375rem]">
        {busy && <InlineSpinner />}
        {busy ? "Đang gửi..." : "Gửi liên kết đặt lại mật khẩu"}
      </Button>
      <p className="text-center text-sm">
        <Link
          href="/login"
          className="inline-flex min-h-10 items-center rounded-lg px-1 font-semibold text-primary hover:text-primary-hover hover:underline"
        >
          Quay lại đăng nhập
        </Link>
      </p>
    </form>
  );
}
