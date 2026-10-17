"use client";

import { IdCard, Mail, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ApiError, apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useDesktopAutofocus } from "@/lib/use-desktop-autofocus";
import type { MemberType } from "@/lib/types";
import { FormError, InlineSpinner, PasswordField, Segmented, TextField } from "./forms/controls";
import { Button } from "./ui";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_PATTERN = /^[A-Za-z0-9-]{3,30}$/;

type FieldKey = "fullName" | "email" | "memberCode" | "password";
type Errors = Partial<Record<FieldKey, string>>;

/** Thanh đo độ dài mật khẩu: chỉ co giãn bằng transform, chữ báo còn thiếu bao nhiêu ký tự. */
function LengthMeter({ length }: { length: number }) {
  const ratio = Math.min(1, length / 8);
  const ok = length >= 8;
  return (
    <div className="mt-2.5">
      <div className="h-1.5 overflow-hidden rounded-full bg-paper-2" aria-hidden="true">
        <div
          className={`h-full origin-left rounded-full transition-[transform,background-color] duration-300 ${ok ? "bg-leaf" : "bg-primary"}`}
          style={{ transform: `scaleX(${ratio})` }}
        />
      </div>
      <p aria-live="polite" className={`mt-1.5 text-xs ${ok ? "font-semibold text-leaf" : "text-ink-faint"}`}>
        {ok ? "Đủ độ dài tối thiểu" : length === 0 ? "Tối thiểu 8 ký tự" : `Cần thêm ${8 - length} ký tự`}
      </p>
    </div>
  );
}

export function RegisterForm() {
  const { login } = useAuth();
  const router = useRouter();
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    memberCode: "",
    memberType: "STUDENT" as MemberType,
  });
  const [errors, setErrors] = useState<Errors>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useDesktopAutofocus(nameRef);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((previous) => ({ ...previous, [key]: value }));
    if (key in errors) setErrors((previous) => ({ ...previous, [key]: undefined }));
  }

  function focusFirst(found: Errors) {
    const order: [FieldKey, React.RefObject<HTMLInputElement | null>][] = [
      ["fullName", nameRef],
      ["email", emailRef],
      ["memberCode", codeRef],
      ["password", passwordRef],
    ];
    order.find(([key]) => found[key])?.[1].current?.focus();
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const found: Errors = {};
    if (form.fullName.trim().length < 2) found.fullName = "Nhập họ và tên (ít nhất 2 ký tự).";
    if (!form.email.trim()) found.email = "Nhập email của bạn.";
    else if (!EMAIL_PATTERN.test(form.email.trim())) found.email = "Email chưa đúng dạng, ví dụ ten@student.muce.edu.vn.";
    if (!CODE_PATTERN.test(form.memberCode.trim())) found.memberCode = "Mã gồm 3 đến 30 ký tự: chữ, số hoặc dấu gạch ngang.";
    if (form.password.length < 8) found.password = "Mật khẩu cần tối thiểu 8 ký tự.";
    setErrors(found);
    if (Object.keys(found).length > 0) return focusFirst(found);

    setBusy(true);
    try {
      await apiFetch("/auth/register", {
        method: "POST",
        body: { ...form, fullName: form.fullName.trim(), email: form.email.trim(), memberCode: form.memberCode.trim() },
      });
      await login(form.email.trim(), form.password);
      router.push("/my/loans");
    } catch (err) {
      if (err instanceof ApiError && err.code === "EMAIL_EXISTS") {
        setErrors({ email: err.friendlyMessage });
        emailRef.current?.focus();
      } else if (err instanceof ApiError && err.code === "MEMBER_CODE_EXISTS") {
        setErrors({ memberCode: err.friendlyMessage });
        codeRef.current?.focus();
      } else {
        setError(err instanceof ApiError ? err.friendlyMessage : "Không đăng ký được, vui lòng thử lại.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {error && <FormError>{error}</FormError>}
      <TextField
        id="o-ho-ten"
        ref={nameRef}
        label="Họ và tên"
        required
        minLength={2}
        autoComplete="name"
        value={form.fullName}
        error={errors.fullName}
        onChange={(event) => update("fullName", event.target.value)}
        leading={<UserRound size={18} />}
        placeholder="Nguyễn Văn A"
      />
      <TextField
        id="o-email-dk"
        ref={emailRef}
        label="Email"
        type="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        required
        value={form.email}
        error={errors.email}
        onChange={(event) => update("email", event.target.value)}
        leading={<Mail size={18} />}
        placeholder="ten@student.muce.edu.vn"
      />
      <Segmented
        legend="Đối tượng"
        name="memberType"
        value={form.memberType}
        onChange={(value) => update("memberType", value)}
        options={[
          { value: "STUDENT", label: "Sinh viên" },
          { value: "LECTURER", label: "Giảng viên" },
        ]}
      />
      <TextField
        id="o-ma-the"
        ref={codeRef}
        label={form.memberType === "STUDENT" ? "Mã sinh viên" : "Mã giảng viên"}
        hint="Chỉ gồm chữ, số và dấu gạch ngang"
        required
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        value={form.memberCode}
        error={errors.memberCode}
        onChange={(event) => update("memberCode", event.target.value)}
        leading={<IdCard size={18} />}
        placeholder="23Q74802012006"
      />
      <div>
        <PasswordField
          id="o-mat-khau-dk"
          ref={passwordRef}
          label="Mật khẩu"
          required
          minLength={8}
          autoComplete="new-password"
          value={form.password}
          error={errors.password}
          onChange={(event) => update("password", event.target.value)}
          placeholder="Ít nhất 8 ký tự"
        />
        <LengthMeter length={form.password.length} />
      </div>
      <Button type="submit" disabled={busy} aria-busy={busy} className="min-h-12 w-full text-[0.9375rem]">
        {busy && <InlineSpinner />}
        {busy ? "Đang tạo tài khoản..." : "Tạo tài khoản"}
      </Button>
    </form>
  );
}
