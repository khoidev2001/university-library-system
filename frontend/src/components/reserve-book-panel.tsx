"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { ApiError, apiFetch, formatDate } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Reservation } from "@/lib/types";
import { Alert, Button } from "./ui";

/** Nút đặt trước ở trang chi tiết sách: chỉ hiện với bạn đọc khi cuốn sách đã hết bản trên kệ. */
export function ReserveBookPanel({ bookId, available }: { bookId: number; available: number }) {
  const { token, can } = useAuth();
  const queryClient = useQueryClient();
  const isReader = !!token && can("READER");

  const mine = useQuery({
    queryKey: ["my-reservations"],
    queryFn: () => apiFetch<Reservation[]>("/reservations/me", { token }),
    enabled: isReader,
  });

  const reserve = useMutation({
    mutationFn: () => apiFetch<Reservation>("/reservations", { method: "POST", token, body: { bookId } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["my-reservations"] }),
  });

  if (!isReader || available > 0) return null;

  const existing = mine.data?.find((r) => r.bookId === bookId);
  const error = reserve.error instanceof ApiError ? reserve.error.friendlyMessage : reserve.error ? "Không đặt được." : null;

  return (
    <div className="mt-4 space-y-3 rounded-2xl bg-white p-4 shadow-[var(--shadow-card)]">
      {existing ? (
        <>
          <p className="text-sm font-medium">
            {existing.status === "READY"
              ? `Sách đang giữ cho bạn tới ${existing.expiresAt ? formatDate(existing.expiresAt) : "..."}.`
              : `Bạn đang xếp hàng thứ ${existing.queuePosition} cho cuốn này.`}
          </p>
          <Link href="/my/reservations" className="link-underline inline-flex min-h-10 items-center text-sm font-semibold text-primary">
            Xem đặt trước của tôi
          </Link>
        </>
      ) : (
        <>
          <p className="text-sm text-ink-soft">Đặt trước để được giữ sách ngay khi có người trả.</p>
          <Button className="w-full" disabled={reserve.isPending || mine.isLoading} onClick={() => reserve.mutate()}>
            {reserve.isPending ? "Đang đặt..." : "Đặt trước cuốn này"}
          </Button>
        </>
      )}
      {error && <Alert tone="bad">{error}</Alert>}
    </div>
  );
}
