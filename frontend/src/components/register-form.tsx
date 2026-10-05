"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApiError, apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { MemberType } from "@/lib/types";
import { Alert, Button, Field, inputClass } from "./ui";

export function RegisterForm() {
  const { login } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    memberCode: "",
    memberType: "STUDENT" as MemberType,
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((previous) => ({ ...previous, [key]: value }));
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/auth/register", { method: "POST", body: form });
      await login(form.email, form.password);
      router.push("/my/loans");
    } catch (err) {
      setError(err instanceof ApiError ? err.friendlyMessage : "Không đăng ký được, vui lòng thử lại.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error && <Alert tone="bad">{error}</Alert>}
      <Field label="Họ và tên" htmlFor="o-ho-ten">
        <input
          id="o-ho-ten"
          required
          minLength={2}
          autoComplete="name"
          value={form.fullName}
          onChange={(event) => update("fullName", event.target.value)}
          className={inputClass}
          placeholder="Nguyễn Văn A"
        />
      </Field>
      <Field label="Email" htmlFor="o-email-dk">
        <input
          id="o-email-dk"
          type="email"
          required
          autoComplete="email"
          value={form.email}
          onChange={(event) => update("email", event.target.value)}
          className={inputClass}
          placeholder="ten@student.muce.edu.vn"
        />
      </Field>
      <Field label="Đối tượng" htmlFor="o-doi-tuong">
        <select
          id="o-doi-tuong"
          value={form.memberType}
          onChange={(event) => update("memberType", event.target.value as MemberType)}
          className={inputClass}
        >
          <option value="STUDENT">Sinh viên</option>
          <option value="LECTURER">Giảng viên</option>
        </select>
      </Field>
      <Field
        label={form.memberType === "STUDENT" ? "Mã sinh viên" : "Mã giảng viên"}
        htmlFor="o-ma-the"
        hint="Chỉ gồm chữ, số và dấu gạch ngang"
      >
        <input
          id="o-ma-the"
          required
          pattern="[A-Za-z0-9\-]{3,30}"
          value={form.memberCode}
          onChange={(event) => update("memberCode", event.target.value)}
          className={inputClass}
          placeholder="23Q74802012006"
        />
      </Field>
      <Field label="Mật khẩu" htmlFor="o-mat-khau-dk" hint="Tối thiểu 8 ký tự">
        <input
          id="o-mat-khau-dk"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={form.password}
          onChange={(event) => update("password", event.target.value)}
          className={inputClass}
          placeholder="Ít nhất 8 ký tự"
        />
      </Field>
      <Button type="submit" disabled={busy} className="w-full">
        {busy ? "Đang tạo tài khoản..." : "Tạo tài khoản"}
      </Button>
    </form>
  );
}
