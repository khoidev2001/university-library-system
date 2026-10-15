"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { apiFetch, formatDate } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Page, Reservation, ReservationStatus } from "@/lib/types";
import { Badge, EmptyState, PageHeading, Spinner } from "../ui";
import { Pagination, TableShell, Th, Toolbar, errorText, useNotice } from "./admin-ui";

const LIMIT = 15;

type Filter = "ACTIVE" | ReservationStatus;

const FILTERS: { value: Filter; label: string }[] = [
  { value: "ACTIVE", label: "Đang hiệu lực" },
  { value: "FULFILLED", label: "Đã mượn" },
  { value: "EXPIRED", label: "Hết hạn" },
  { value: "CANCELLED", label: "Đã huỷ" },
];

const LABEL: Record<ReservationStatus, { text: string; tone: "good" | "warn" | "bad" | "neutral" }> = {
  WAITING: { text: "Đang xếp hàng", tone: "warn" },
  READY: { text: "Đã giữ sách", tone: "good" },
  FULFILLED: { text: "Đã mượn", tone: "neutral" },
  CANCELLED: { text: "Đã huỷ", tone: "neutral" },
  EXPIRED: { text: "Hết hạn", tone: "bad" },
};

export function ReservationsAdminView() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const { show, node } = useNotice();
  const [filter, setFilter] = useState<Filter>("ACTIVE");
  const [page, setPage] = useState(1);

  const list = useQuery({
    queryKey: ["admin-reservations", filter, page],
    queryFn: () =>
      apiFetch<Page<Reservation>>(
        `/reservations?limit=${LIMIT}&page=${page}${filter === "ACTIVE" ? "" : `&status=${filter}`}`,
        { token },
      ),
    enabled: !!token,
    placeholderData: (previous) => previous,
  });

  const cancel = useMutation({
    mutationFn: (id: number) => apiFetch(`/reservations/${id}`, { method: "DELETE", token }),
    onSuccess: () => {
      show("good", "Đã huỷ đặt trước.");
      queryClient.invalidateQueries({ queryKey: ["admin-reservations"] });
    },
    onError: (error) => show("bad", errorText(error, "Không huỷ được đặt trước.")),
  });

  const items = list.data?.items ?? [];

  return (
    <div>
      <PageHeading
        eyebrow="Nghiệp vụ"
        title="Đặt trước"
        description="Hàng đợi bạn đọc chờ sách. Khi có người trả, sách chuyển sang trạng thái giữ và được cho đúng người xếp đầu mượn."
      />
      {node}
      <Toolbar>
        <div role="tablist" aria-label="Lọc đặt trước" className="flex gap-1 rounded-lg border border-line bg-white p-1">
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
      </Toolbar>

      <div className="mt-5">
        {list.isLoading ? (
          <Spinner />
        ) : items.length === 0 ? (
          <EmptyState title="Không có đặt trước nào" />
        ) : (
          <TableShell minWidth={760}>
            <caption className="sr-only">Danh sách đặt trước</caption>
            <thead className="border-b border-line bg-paper-2">
              <tr>
                <Th>Bạn đọc</Th>
                <Th>Sách</Th>
                <Th>Đặt lúc</Th>
                <Th>Trạng thái</Th>
                <Th align="right"><span className="sr-only">Thao tác</span></Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3">
                    <span className="font-medium">{item.user.fullName}</span>
                    <span className="block text-xs text-ink-faint">{item.user.memberCode}</span>
                  </td>
                  <td className="px-4 py-3">
                    {item.book.title}
                    {item.copy && <span className="block text-xs text-ink-faint">Mã vạch {item.copy.barcode}</span>}
                  </td>
                  <td className="px-4 py-3">{formatDate(item.createdAt)}</td>
                  <td className="px-4 py-3">
                    <Badge tone={LABEL[item.status].tone}>{LABEL[item.status].text}</Badge>
                    {item.status === "READY" && item.expiresAt && (
                      <span className="block text-xs text-ink-faint">Giữ tới {formatDate(item.expiresAt)}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end">
                      {(item.status === "WAITING" || item.status === "READY") && (
                        <button
                          type="button"
                          disabled={cancel.isPending}
                          onClick={() => {
                            if (window.confirm(`Huỷ đặt trước của ${item.user.fullName}?`)) cancel.mutate(item.id);
                          }}
                          className="rounded-md px-2.5 py-1.5 text-sm text-brand hover:bg-brand-soft disabled:opacity-50"
                        >
                          Huỷ
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        )}
        {list.data && <Pagination page={page} total={list.data.total} limit={LIMIT} onPage={setPage} />}
      </div>
    </div>
  );
}
