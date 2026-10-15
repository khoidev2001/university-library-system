"use client";

import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { TemporaryPasswordResult, User } from "@/lib/types";
import { Modal, errorText } from "./admin/admin-ui";
import { TempPasswordPanel } from "./temp-password-panel";
import { Button } from "./ui";

/**
 * Cấp lại mật khẩu tạm cho một tài khoản (khi email chưa cấu hình hoặc người dùng không nhận được thư).
 * Hai bước: xác nhận, rồi hiện mật khẩu tạm đúng một lần.
 */
export function ResetPasswordModal({
  target,
  onClose,
  onDone,
}: {
  target: Pick<User, "id" | "fullName" | "email" | "memberCode">;
  onClose: () => void;
  onDone?: () => void;
}) {
  const { token } = useAuth();
  const [result, setResult] = useState<TemporaryPasswordResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = useMutation({
    mutationFn: () =>
      apiFetch<TemporaryPasswordResult>(`/users/${target.id}/reset-password`, { method: "POST", token }),
    onSuccess: (data) => {
      setResult(data);
      onDone?.();
    },
    onError: (err) => setError(errorText(err, "Không cấp lại được mật khẩu.")),
  });

  if (result) {
    return (
      <Modal title="Mật khẩu tạm" onClose={onClose}>
        <TempPasswordPanel
          user={result.user}
          temporaryPassword={result.temporaryPassword}
          heading={`Đã cấp mật khẩu tạm cho ${result.user.fullName}.`}
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
    <Modal title="Cấp lại mật khẩu" onClose={onClose}>
      <p className="text-sm text-ink-soft">
        Cấp mật khẩu tạm cho <strong className="text-ink">{target.fullName}</strong> ({target.email})? Mật khẩu cũ sẽ không
        dùng được nữa, mọi phiên đăng nhập hiện tại bị đăng xuất và người này phải đổi mật khẩu ở lần đăng nhập sau.
      </p>
      {error && (
        <p role="alert" className="mt-4 rounded-md bg-brand-soft px-3 py-2 text-sm text-brand">
          {error}
        </p>
      )}
      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" onClick={onClose} className="min-h-10">
          Huỷ
        </Button>
        <Button
          type="button"
          variant="danger"
          disabled={reset.isPending}
          onClick={() => {
            setError(null);
            reset.mutate();
          }}
          className="min-h-10"
        >
          {reset.isPending ? "Đang cấp..." : "Cấp mật khẩu tạm"}
        </Button>
      </div>
    </Modal>
  );
}
