"use client";

import { useMutation } from "@tanstack/react-query";
import { ShieldAlert } from "lucide-react";
import { useState } from "react";
import { ApiError, apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { TemporaryPasswordResult, User } from "@/lib/types";
import { Dialog } from "./dialog";
import { FormError, InlineSpinner } from "./forms/controls";
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
    onError: (err) => setError(err instanceof ApiError ? err.friendlyMessage : "Không cấp lại được mật khẩu."),
  });

  if (result) {
    return (
      <Dialog title="Mật khẩu tạm" onClose={onClose}>
        <TempPasswordPanel
          user={result.user}
          temporaryPassword={result.temporaryPassword}
          heading={`Đã cấp mật khẩu tạm cho ${result.user.fullName}.`}
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
    <Dialog title="Cấp lại mật khẩu" onClose={onClose}>
      <div className="flex items-start gap-4">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-amber-soft text-amber" aria-hidden="true">
          <ShieldAlert size={24} />
        </span>
        <p className="text-sm leading-relaxed text-ink-soft">
          Cấp mật khẩu tạm cho <strong className="text-ink">{target.fullName}</strong> ({target.email})? Mật khẩu cũ sẽ không
          dùng được nữa, mọi phiên đăng nhập hiện tại bị đăng xuất và người này phải đổi mật khẩu ở lần đăng nhập sau.
        </p>
      </div>
      {error && (
        <div className="mt-4">
          <FormError>{error}</FormError>
        </div>
      )}
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" onClick={onClose}>
          Huỷ
        </Button>
        <Button
          type="button"
          variant="danger"
          disabled={reset.isPending}
          aria-busy={reset.isPending}
          onClick={() => {
            setError(null);
            reset.mutate();
          }}
        >
          {reset.isPending && <InlineSpinner />}
          {reset.isPending ? "Đang cấp..." : "Cấp mật khẩu tạm"}
        </Button>
      </div>
    </Dialog>
  );
}
