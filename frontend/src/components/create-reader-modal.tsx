"use client";

import { useMutation } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { ApiError, apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { MemberType, TemporaryPasswordResult } from "@/lib/types";
import { Dialog } from "./dialog";
import { FormError, InlineSpinner, Segmented, TextField } from "./forms/controls";
import { TempPasswordPanel } from "./temp-password-panel";
import { Button } from "./ui";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_PATTERN = /^[A-Za-z0-9-]{3,30}$/;

type FieldKey = "fullName" | "email" | "memberCode";

/** Thủ thư tạo bạn đọc tại quầy: nhập thông tin, nhận mật khẩu tạm hiện một lần để trao cho bạn đọc. */
export function CreateReaderModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { token } = useAuth();
  const [form, setForm] = useState({ fullName: "", email: "", memberType: "STUDENT" as MemberType, memberCode: "" });
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TemporaryPasswordResult | null>(null);
  const refs = {
    fullName: useRef<HTMLInputElement>(null),
    email: useRef<HTMLInputElement>(null),
    memberCode: useRef<HTMLInputElement>(null),
  };

  const create = useMutation({
    mutationFn: () =>
      apiFetch<TemporaryPasswordResult>("/users/readers", {
        method: "POST",
        body: {
          fullName: form.fullName.trim(),
          email: form.email.trim(),
          memberType: form.memberType,
          ...(form.memberCode.trim() && { memberCode: form.memberCode.trim() }),
        },
        token,
      }),
    onSuccess: (data) => {
      setResult(data);
      onCreated();
    },
    onError: (err) => {
      if (err instanceof ApiError && err.code === "EMAIL_EXISTS") {
        setErrors({ email: err.friendlyMessage });
        refs.email.current?.focus();
      } else if (err instanceof ApiError && err.code === "MEMBER_CODE_EXISTS") {
        setErrors({ memberCode: err.friendlyMessage });
        refs.memberCode.current?.focus();
      } else {
        setError(err instanceof ApiError ? err.friendlyMessage : "Không tạo được bạn đọc.");
      }
    },
  });

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((previous) => ({ ...previous, [key]: value }));
    if (key in errors) setErrors((previous) => ({ ...previous, [key]: undefined }));
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const found: typeof errors = {};
    if (form.fullName.trim().length < 2) found.fullName = "Nhập họ và tên (ít nhất 2 ký tự).";
    if (!form.email.trim()) found.email = "Nhập email của bạn đọc.";
    else if (!EMAIL_PATTERN.test(form.email.trim())) found.email = "Email chưa đúng dạng, ví dụ ten@student.muce.edu.vn.";
    if (form.memberCode.trim() && !CODE_PATTERN.test(form.memberCode.trim())) {
      found.memberCode = "Mã gồm 3 đến 30 ký tự: chữ, số hoặc dấu gạch ngang.";
    }
    setErrors(found);
    const first = (["fullName", "email", "memberCode"] as FieldKey[]).find((key) => found[key]);
    if (first) return refs[first].current?.focus();
    create.mutate();
  }

  if (result) {
    return (
      <Dialog title="Đã tạo bạn đọc" onClose={onClose}>
        <TempPasswordPanel
          user={result.user}
          temporaryPassword={result.temporaryPassword}
          heading={
            result.welcomeEmailQueued
              ? `Đã tạo tài khoản cho ${result.user.fullName} và gửi email chào mừng (không kèm mật khẩu).`
              : `Đã tạo tài khoản cho ${result.user.fullName}.`
          }
        />
        <div className="mt-5 flex justify-end">
          <Button type="button" onClick={onClose} className="w-full sm:w-auto">
            Xong
          </Button>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog
      title="Thêm bạn đọc"
      description="Hệ thống sinh mật khẩu tạm và hiện cho bạn một lần. Bạn đọc phải đổi mật khẩu ở lần đăng nhập đầu tiên."
      onClose={onClose}
    >
      <form className="space-y-5" noValidate onSubmit={onSubmit}>
        {error && <FormError>{error}</FormError>}
        <TextField
          id="new-reader-name"
          ref={refs.fullName}
          label="Họ và tên"
          required
          minLength={2}
          maxLength={100}
          autoComplete="off"
          value={form.fullName}
          error={errors.fullName}
          onChange={(e) => set("fullName", e.target.value)}
        />
        <TextField
          id="new-reader-email"
          ref={refs.email}
          label="Email"
          type="email"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          required
          autoComplete="off"
          value={form.email}
          error={errors.email}
          onChange={(e) => set("email", e.target.value)}
        />
        <Segmented
          legend="Đối tượng"
          name="new-reader-type"
          value={form.memberType}
          onChange={(value) => set("memberType", value)}
          options={[
            { value: "STUDENT", label: "Sinh viên" },
            { value: "LECTURER", label: "Giảng viên" },
          ]}
        />
        <TextField
          id="new-reader-code"
          ref={refs.memberCode}
          label={form.memberType === "STUDENT" ? "Mã sinh viên (tuỳ chọn)" : "Mã giảng viên (tuỳ chọn)"}
          hint="Để trống để hệ thống tự cấp mã thẻ. Chỉ gồm chữ, số và dấu gạch ngang."
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          value={form.memberCode}
          error={errors.memberCode}
          onChange={(e) => set("memberCode", e.target.value)}
        />
        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" onClick={onClose}>
            Huỷ
          </Button>
          <Button type="submit" disabled={create.isPending} aria-busy={create.isPending}>
            {create.isPending && <InlineSpinner />}
            {create.isPending ? "Đang tạo..." : "Tạo bạn đọc"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
