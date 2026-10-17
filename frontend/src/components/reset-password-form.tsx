"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ApiError, apiFetch } from "@/lib/api";
import { useDesktopAutofocus } from "@/lib/use-desktop-autofocus";
import { FormError, InlineSpinner, PasswordField } from "./forms/controls";
import { SuccessMark } from "./forms/success-mark";
import { Button, ButtonLink, Skeleton } from "./ui";

/**
 * Đặt lại mật khẩu bằng token trong liên kết email. Token được đọc một lần rồi xoá khỏi thanh địa chỉ
 * (không nằm lại trong lịch sử trình duyệt hay gửi đi qua Referer).
 */
export function ResetPasswordForm() {
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  useDesktopAutofocus(passwordRef, !!token);

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
    const found: typeof errors = {};
    if (password.length < 8) found.password = "Mật khẩu mới cần tối thiểu 8 ký tự.";
    if (!confirm) found.confirm = "Nhập lại mật khẩu mới để xác nhận.";
    else if (password !== confirm) found.confirm = "Hai mật khẩu nhập vào không giống nhau.";
    setErrors(found);
    if (found.password) return passwordRef.current?.focus();
    if (found.confirm) return confirmRef.current?.focus();
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

  if (token === undefined) {
    return (
      <div className="space-y-4" role="status" aria-label="Đang tải">
        <Skeleton className="h-12" />
        <Skeleton className="h-12" />
        <Skeleton className="h-12" />
      </div>
    );
  }

  if (done) {
    return (
      <div className="space-y-5 text-center">
        <div className="flex justify-center">
          <SuccessMark size={64} />
        </div>
        <p role="status" className="text-base font-semibold leading-relaxed">
          Đã đặt lại mật khẩu. Các phiên đăng nhập cũ đã bị đăng xuất.
        </p>
        <div className="flex [&>a]:w-full">
          <ButtonLink href="/login">Đăng nhập</ButtonLink>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="space-y-5 text-center">
        <div className="flex justify-center">
          <SuccessMark tone="warn" size={64} />
        </div>
        <p role="alert" className="text-base font-semibold leading-relaxed">
          Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn. Hãy xin liên kết mới.
        </p>
        <div className="flex [&>a]:w-full">
          <ButtonLink href="/forgot-password">Xin liên kết mới</ButtonLink>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {error && (
        <FormError>
          {error}{" "}
          {error.includes("hết hạn") && (
            <Link href="/forgot-password" className="font-semibold underline">
              Xin liên kết mới
            </Link>
          )}
        </FormError>
      )}
      <PasswordField
        id="reset-password"
        ref={passwordRef}
        label="Mật khẩu mới"
        hint="Từ 8 ký tự trở lên"
        required
        minLength={8}
        maxLength={72}
        autoComplete="new-password"
        value={password}
        error={errors.password}
        onChange={(event) => {
          setPassword(event.target.value);
          if (errors.password) setErrors((e) => ({ ...e, password: undefined }));
        }}
      />
      <PasswordField
        id="reset-password-confirm"
        ref={confirmRef}
        label="Nhập lại mật khẩu mới"
        required
        minLength={8}
        maxLength={72}
        autoComplete="new-password"
        value={confirm}
        error={errors.confirm}
        onChange={(event) => {
          setConfirm(event.target.value);
          if (errors.confirm) setErrors((e) => ({ ...e, confirm: undefined }));
        }}
      />
      <Button type="submit" disabled={busy} aria-busy={busy} className="min-h-12 w-full text-[0.9375rem]">
        {busy && <InlineSpinner />}
        {busy ? "Đang lưu..." : "Đặt lại mật khẩu"}
      </Button>
    </form>
  );
}
