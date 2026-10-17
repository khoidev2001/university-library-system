"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { apiFetch, formatDate } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Page, Reservation, ReservationStatus } from "@/lib/types";
import { EmptyState, PageHeading } from "../ui";
import {
  BookThumb,
  FilterTabs,
  Pagination,
  RowButton,
  StatusBadge,
  TableShell,
  TableSkeleton,
  Td,
  Th,
  Toolbar,
  Tr,
  errorText,
  useConfirm,
  useNotice,
} from "./admin-ui";

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
  const { confirm, dialog: confirmDialog } = useConfirm();
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
        title="Đặt trước"
        description="Hàng đợi bạn đọc chờ sách. Khi có người trả, sách chuyển sang trạng thái giữ và được cho đúng người xếp đầu mượn."
      />
      {node}
      {confirmDialog}
      <Toolbar>
        <FilterTabs
          label="Lọc đặt trước"
          value={filter}
          items={FILTERS}
          onChange={(value) => {
            setFilter(value);
            setPage(1);
          }}
        />
      </Toolbar>

      <div className="mt-5">
        {list.isLoading ? (
          <TableSkeleton rows={6} cols={4} />
        ) : items.length === 0 ? (
          <EmptyState
            title="Không có đặt trước nào"
            hint="Khi bạn đọc đặt trước một cuốn đang được mượn hết, yêu cầu sẽ xuất hiện ở đây."
          />
        ) : (
          <TableShell minWidth={780}>
            <caption className="sr-only">Danh sách đặt trước</caption>
            <thead>
              <tr>
                <Th>Bạn đọc</Th>
                <Th>Sách</Th>
                <Th>Đặt lúc</Th>
                <Th>Trạng thái</Th>
                <Th align="right">
                  <span className="sr-only">Thao tác</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <Tr key={item.id} index={index}>
                  <Td className="whitespace-nowrap">
                    <span className="font-semibold">{item.user.fullName}</span>
                    <span className="block text-xs tabular-nums text-ink-faint">{item.user.memberCode}</span>
                  </Td>
                  <Td>
                    <div className="flex items-center gap-3">
                      <BookThumb coverUrl={item.book.coverUrl ?? null} title={item.book.title} />
                      <div className="min-w-0">
                        <span className="line-clamp-2">{item.book.title}</span>
                        {item.copy && <span className="block text-xs tabular-nums text-ink-faint">Mã vạch {item.copy.barcode}</span>}
                      </div>
                    </div>
                  </Td>
                  <Td className="whitespace-nowrap text-ink-soft">{formatDate(item.createdAt)}</Td>
                  <Td>
                    <span className="flex flex-col items-start gap-1">
                      <StatusBadge tone={LABEL[item.status].tone}>{LABEL[item.status].text}</StatusBadge>
                      {item.status === "READY" && item.expiresAt && (
                        <span className="text-xs text-ink-faint">Giữ tới {formatDate(item.expiresAt)}</span>
                      )}
                    </span>
                  </Td>
                  <Td>
                    <div className="flex justify-end">
                      {(item.status === "WAITING" || item.status === "READY") && (
                        <RowButton
                          danger
                          aria-label={`Huỷ đặt trước của ${item.user.fullName}`}
                          disabled={cancel.isPending}
                          onClick={async () => {
                            const ok = await confirm({
                              title: "Huỷ đặt trước",
                              message: `Huỷ đặt trước "${item.book.title}" của ${item.user.fullName}?`,
                              confirmLabel: "Huỷ đặt trước",
                            });
                            if (ok) cancel.mutate(item.id);
                          }}
                        >
                          Huỷ
                        </RowButton>
                      )}
                    </div>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </TableShell>
        )}
        {list.data && <Pagination page={page} total={list.data.total} limit={LIMIT} onPage={setPage} />}
      </div>
    </div>
  );
}
