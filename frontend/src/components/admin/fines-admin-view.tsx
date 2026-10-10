"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { apiFetch, formatCurrency, formatDate } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Fine, Page } from "@/lib/types";
import { Badge, PageHeading, Spinner } from "../ui";
import { Pagination, TableShell, Th, Toolbar, errorText, useNotice } from "./admin-ui";

const LIMIT = 15;

type Filter = "UNPAID" | "PAID" | "ALL";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "UNPAID", label: "Chưa thu" },
  { value: "PAID", label: "Đã thu" },
  { value: "ALL", label: "Tất cả" },
];

const QUERY: Record<Filter, string> = { UNPAID: "&paid=false", PAID: "&paid=true", ALL: "" };

export function FinesAdminView() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const params = useSearchParams();
  const { show, node } = useNotice();

  const [filter, setFilter] = useState<Filter>(() => {
    const paid = params.get("paid");
    return paid === "true" ? "PAID" : paid === "false" ? "UNPAID" : params.has("all") ? "ALL" : "UNPAID";
  });
  const [page, setPage] = useState(1);

  const fines = useQuery({
    queryKey: ["admin-fines", filter, page],
    queryFn: () => apiFetch<Page<Fine>>(`/fines?limit=${LIMIT}&page=${page}${QUERY[filter]}`, { token }),
    enabled: !!token,
    placeholderData: (previous) => previous,
  });

  const pay = useMutation({
    mutationFn: (fine: Fine) => apiFetch<Fine>(`/fines/${fine.id}/pay`, { method: "POST", token }),
    onSuccess: (fine) => {
      show("good", `Đã ghi nhận thu ${formatCurrency(fine.amount)}.`);
      queryClient.invalidateQueries({ queryKey: ["admin-fines"] });
      queryClient.invalidateQueries({ queryKey: ["admin-total"] });
    },
    onError: (error) => show("bad", errorText(error, "Không ghi nhận được khoản thu.")),
  });

  const pageTotal = (fines.data?.items ?? []).reduce((sum, fine) => sum + fine.amount, 0);

  return (
    <div>
      <PageHeading
        eyebrow="Nghiệp vụ"
        title="Khoản phạt"
        description="Ghi nhận thu tiền mặt tại quầy. Bạn đọc còn nợ phạt sẽ chưa mượn thêm được sách."
      />
      {node}

      <Toolbar>
        <div role="tablist" aria-label="Lọc khoản phạt" className="flex gap-1 rounded-lg border border-line bg-white p-1">
          {FILTERS.map((item) => (
            <button
              key={item.value}
              type="button"
              role="tab"
              aria-selected={filter === item.value}
              onClick={() => {
                setFilter(item.value);
                setPage(1);
              }}
              className={`rounded-md px-3.5 py-1.5 text-sm ${
                filter === item.value ? "bg-ink font-medium text-paper" : "text-ink-soft hover:bg-paper-2"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        {fines.data && (
          <p className="text-sm text-ink-soft">
            Tổng trang này: <strong className="text-ink">{formatCurrency(pageTotal)}</strong>
          </p>
        )}
      </Toolbar>

      <div className="mt-5">
        {fines.isLoading ? (
          <Spinner />
        ) : (
          <TableShell minWidth={720}>
            <caption className="sr-only">Danh sách khoản phạt</caption>
            <thead className="border-b border-line bg-paper-2">
              <tr>
                <Th>Bạn đọc</Th>
                <Th>Sách</Th>
                <Th>Loại</Th>
                <Th>Số tiền</Th>
                <Th>Trạng thái</Th>
                <Th align="right"><span className="sr-only">Thao tác</span></Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {(fines.data?.items ?? []).map((fine) => (
                <tr key={fine.id}>
                  <td className="px-4 py-3">
                    <span className="font-medium">{fine.loan?.user.fullName}</span>
                    <span className="block text-xs text-ink-faint">{fine.loan?.user.memberCode}</span>
                  </td>
                  <td className="px-4 py-3">{fine.loan?.copy.book.title}</td>
                  <td className="px-4 py-3">
                    <Badge tone={fine.type === "LOST" ? "bad" : "warn"}>
                      {fine.type === "LOST" ? "Mất sách" : "Trả trễ"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 font-medium">{formatCurrency(fine.amount)}</td>
                  <td className="px-4 py-3">
                    {fine.paidAt ? (
                      <span className="space-y-1">
                        <Badge tone="good">Đã thu</Badge>
                        <span className="block text-xs text-ink-faint">{formatDate(fine.paidAt)}</span>
                      </span>
                    ) : (
                      <Badge tone="warn">Chưa thu</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end">
                      {!fine.paidAt && (
                        <button
                          type="button"
                          disabled={pay.isPending}
                          onClick={() => {
                            if (
                              window.confirm(
                                `Xác nhận đã thu ${formatCurrency(fine.amount)} của ${fine.loan?.user.fullName}?`,
                              )
                            ) {
                              pay.mutate(fine);
                            }
                          }}
                          className="rounded-md border border-line px-3 py-1.5 text-xs font-medium hover:bg-paper-2 disabled:opacity-50"
                        >
                          Thu tiền
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        )}
        {fines.data?.items.length === 0 && (
          <p className="py-10 text-center text-sm text-ink-soft">Không có khoản phạt nào ở mục này.</p>
        )}
        {fines.data && <Pagination page={page} total={fines.data.total} limit={LIMIT} onPage={setPage} />}
      </div>
    </div>
  );
}
