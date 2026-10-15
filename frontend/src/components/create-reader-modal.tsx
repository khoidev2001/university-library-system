"use client";

import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { MemberType, TemporaryPasswordResult } from "@/lib/types";
import { Modal, errorText } from "./admin/admin-ui";
import { TempPasswordPanel } from "./temp-password-panel";
import { Button, Field, inputClass } from "./ui";

/** Thủ thư tạo bạn đọc tại quầy: nhập thông tin, nhận mật khẩu tạm hiện một lần để trao cho bạn đọc. */
export function CreateReaderModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { token } = useAuth();
  const [form, setForm] = useState({ fullName: "", email: "", memberType: "STUDENT" as MemberType, memberCode: "" });
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TemporaryPasswordResult | null>(null);

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
    onError: (err) => setError(errorText(err, "Không tạo được bạn đọc.")),
  });

  if (result) {
    return (
      <Modal title="Đã tạo bạn đọc" onClose={onClose}>
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
          <Button type="button" onClick={onClose} className="min-h-10 w-full sm:w-auto">
            Xong
          </Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Thêm bạn đọc" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          create.mutate();
        }}
      >
        <Field label="Họ và tên" htmlFor="new-reader-name">
          <input
            id="new-reader-name"
            required
            minLength={2}
            maxLength={100}
            autoComplete="off"
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            className={inputClass}
          />
        </Field>
        <Field label="Email" htmlFor="new-reader-email">
          <input
            id="new-reader-email"
            type="email"
            required
            autoComplete="off"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className={inputClass}
          />
        </Field>
        <Field label="Đối tượng" htmlFor="new-reader-type">
          <select
            id="new-reader-type"
            value={form.memberType}
            onChange={(e) => setForm({ ...form, memberType: e.target.value as MemberType })}
            className={inputClass}
          >
            <option value="STUDENT">Sinh viên</option>
            <option value="LECTURER">Giảng viên</option>
          </select>
        </Field>
        <Field
          label={form.memberType === "STUDENT" ? "Mã sinh viên (tuỳ chọn)" : "Mã giảng viên (tuỳ chọn)"}
          htmlFor="new-reader-code"
          hint="Để trống để hệ thống tự cấp mã thẻ. Chỉ gồm chữ, số và dấu gạch ngang."
        >
          <input
            id="new-reader-code"
            pattern="[A-Za-z0-9\-]{3,30}"
            title="3 đến 30 ký tự: chữ, số hoặc dấu gạch ngang"
            autoComplete="off"
            value={form.memberCode}
            onChange={(e) => setForm({ ...form, memberCode: e.target.value })}
            className={inputClass}
          />
        </Field>
        <p className="text-xs text-ink-faint">
          Hệ thống sinh mật khẩu tạm và hiện cho bạn một lần. Bạn đọc phải đổi mật khẩu ở lần đăng nhập đầu tiên.
        </p>
        {error && (
          <p role="alert" className="rounded-md bg-brand-soft px-3 py-2 text-sm text-brand">
            {error}
          </p>
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" onClick={onClose} className="min-h-10">
            Huỷ
          </Button>
          <Button type="submit" disabled={create.isPending} className="min-h-10">
            {create.isPending ? "Đang tạo..." : "Tạo bạn đọc"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
