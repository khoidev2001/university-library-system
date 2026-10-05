"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch, formatCurrency, formatDate } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Fine } from "@/lib/types";
import { Alert, Badge, EmptyState, PageHeading, Spinner } from "./ui";

export function MyFinesView() {
  const { token } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["my-fines"],
    queryFn: () => apiFetch<{ items: Fine[]; unpaidTotal: number }>("/fines/me", { token }),
    enabled: !!token,
  });

  if (isLoading) return <Spinner />;

  const items = data?.items ?? [];
  const unpaid = data?.unpaidTotal ?? 0;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <PageHeading
        eyebrow="Tài khoản của tôi"
        title="Tiền phạt"
        description="Phạt phát sinh khi trả sách trễ hoặc báo mất sách. Thanh toán tại quầy thủ thư."
      />

      <div className="mt-6">
        {unpaid > 0 ? (
          <Alert tone="bad">
            Tổng còn nợ: <strong>{formatCurrency(unpaid)}</strong>. Thư viện tạm dừng cho mượn và gia hạn
            cho tới khi bạn thanh toán.
          </Alert>
        ) : (
          <Alert tone="good">Bạn không còn khoản phạt nào chưa thanh toán.</Alert>
        )}
      </div>

      {items.length === 0 ? (
        <div className="mt-8">
          <EmptyState title="Chưa có khoản phạt nào" hint="Trả sách đúng hạn để giữ nguyên tình trạng này." />
        </div>
      ) : (
        <div className="mt-8 overflow-x-auto rounded-xl border border-line bg-white">
          <table className="w-full min-w-[640px] text-sm">
            <caption className="sr-only">Danh sách khoản phạt của tôi</caption>
            <thead className="border-b border-line bg-paper-2 text-left">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">Sách</th>
                <th scope="col" className="px-4 py-3 font-semibold">Lý do</th>
                <th scope="col" className="px-4 py-3 font-semibold">Số tiền</th>
                <th scope="col" className="px-4 py-3 font-semibold">Ngày lập</th>
                <th scope="col" className="px-4 py-3 font-semibold">Tình trạng</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {items.map((fine) => (
                <tr key={fine.id}>
                  <td className="px-4 py-3 font-medium">{fine.loan?.copy.book.title ?? `Phiếu #${fine.loanId}`}</td>
                  <td className="px-4 py-3 text-ink-soft">{fine.type === "LOST" ? "Báo mất sách" : "Trả trễ"}</td>
                  <td className="px-4 py-3 font-medium">{formatCurrency(fine.amount)}</td>
                  <td className="px-4 py-3 text-ink-soft">{formatDate(fine.createdAt)}</td>
                  <td className="px-4 py-3">
                    {fine.paidAt ? (
                      <Badge tone="good">Đã thanh toán {formatDate(fine.paidAt)}</Badge>
                    ) : (
                      <Badge tone="bad">Chưa thanh toán</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
