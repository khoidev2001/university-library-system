"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { apiFetch, formatCurrency, formatDate, formatDateTime } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Fine, Page } from "@/lib/types";
import { ExportButtons } from "../export-buttons";
import { EmptyState, PageHeading } from "../ui";
import {
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
  const { confirm, dialog: confirmDialog } = useConfirm();

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

  const cancelOnline = useMutation({
    mutationFn: (paymentId: number) => apiFetch(`/payments/${paymentId}/cancel`, { method: "POST", token }),
    onSuccess: () => {
      show("good", "Đã huỷ giao dịch VNPay đang chờ. Giờ có thể thu tiền mặt khoản phạt này.");
      queryClient.invalidateQueries({ queryKey: ["admin-fines"] });
    },
    onError: (error) => {
      show("bad", errorText(error, "Không huỷ được giao dịch."));
      queryClient.invalidateQueries({ queryKey: ["admin-fines"] });
    },
  });

  const items = fines.data?.items ?? [];
  const pageTotal = items.reduce((sum, fine) => sum + fine.amount, 0);

  return (
    <div>
      <PageHeading
        title="Khoản phạt"
        description="Ghi nhận thu tiền mặt tại quầy; khoản bạn đọc trả qua VNPay tự được ghi nhận. Bạn đọc còn nợ phạt sẽ chưa mượn thêm được sách."
      />
      {node}
      {confirmDialog}

      <Toolbar>
        <FilterTabs
          label="Lọc khoản phạt"
          value={filter}
          items={FILTERS}
          onChange={(value) => {
            setFilter(value);
            setPage(1);
          }}
        />
        {fines.data && (
          <p className="rounded-full bg-white px-4 py-2 text-sm text-ink-soft ring-1 ring-line">
            Tổng trang này: <strong className="font-bold tabular-nums text-ink">{formatCurrency(pageTotal)}</strong>
          </p>
        )}
      </Toolbar>

      <ExportButtons
        className="mt-4"
        dataset="fines"
        subject="khoản phạt"
        dateRange
        params={filter === "PAID" ? { paid: true } : filter === "UNPAID" ? { paid: false } : {}}
      />

      <div className="mt-5">
        {fines.isLoading ? (
          <TableSkeleton rows={8} cols={5} />
        ) : items.length === 0 ? (
          <EmptyState
            title={filter === "UNPAID" ? "Không còn khoản phạt nào chưa thu" : "Không có khoản phạt nào ở mục này"}
            hint={filter === "UNPAID" ? "Mọi khoản phạt đã được thu. Khoản mới sẽ hiện ở đây khi phát sinh." : undefined}
          />
        ) : (
          <TableShell minWidth={780}>
            <caption className="sr-only">Danh sách khoản phạt</caption>
            <thead>
              <tr>
                <Th>Bạn đọc</Th>
                <Th>Sách</Th>
                <Th>Loại</Th>
                <Th>Số tiền</Th>
                <Th>Trạng thái</Th>
                <Th align="right">
                  <span className="sr-only">Thao tác</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {items.map((fine, index) => (
                <Tr key={fine.id} index={index}>
                  <Td card="title" className="whitespace-nowrap">
                    <span className="font-semibold">{fine.loan?.user.fullName}</span>
                    <span className="block text-xs tabular-nums text-ink-faint">{fine.loan?.user.memberCode}</span>
                  </Td>
                  <Td className="max-w-[16rem]">
                    <span className="line-clamp-2">{fine.loan?.copy.book.title}</span>
                  </Td>
                  <Td>
                    <StatusBadge tone={fine.type === "LOST" ? "bad" : "warn"}>
                      {fine.type === "LOST" ? "Mất sách" : "Trả trễ"}
                    </StatusBadge>
                  </Td>
                  <Td className="whitespace-nowrap font-bold tabular-nums">{formatCurrency(fine.amount)}</Td>
                  <Td>
                    {fine.paidAt ? (
                      <span className="flex flex-col items-start gap-1">
                        {fine.onlinePayment?.status === "PAID" ? (
                          <StatusBadge tone="info">Đã thanh toán qua VNPay</StatusBadge>
                        ) : (
                          <StatusBadge tone="good">Đã thu</StatusBadge>
                        )}
                        <span className="text-xs text-ink-faint">{formatDate(fine.paidAt)}</span>
                        {fine.onlinePayment?.status === "PAID" && (
                          <span className="text-xs tabular-nums text-ink-faint">
                            GD {fine.onlinePayment.vnpTransactionNo ?? fine.onlinePayment.txnRef}
                            {fine.onlinePayment.bankCode ? ` · ${fine.onlinePayment.bankCode}` : ""}
                          </span>
                        )}
                      </span>
                    ) : fine.onlinePayment?.status === "PENDING" ? (
                      <span className="flex flex-col items-start gap-1">
                        <StatusBadge tone="warn">Đang chờ thanh toán VNPay</StatusBadge>
                        <span className="text-xs text-ink-faint">
                          Hết hạn {formatDateTime(fine.onlinePayment.expiresAt)}
                        </span>
                      </span>
                    ) : (
                      <StatusBadge tone="warn">Chưa thu</StatusBadge>
                    )}
                  </Td>
                  <Td card="actions">
                    <div className="flex justify-end">
                      {!fine.paidAt && fine.onlinePayment?.status === "PENDING" && (
                        <RowButton
                          aria-label={`Huỷ giao dịch VNPay đang chờ của ${fine.loan?.user.fullName ?? "bạn đọc"}`}
                          disabled={cancelOnline.isPending}
                          onClick={async () => {
                            const ok = await confirm({
                              title: "Huỷ giao dịch đang chờ",
                              message: `Huỷ giao dịch VNPay đang chờ của ${fine.loan?.user.fullName}? Nếu bạn đọc vẫn trả bên VNPay, khoản tiền đó sẽ cần hoàn lại.`,
                              confirmLabel: "Huỷ giao dịch",
                            });
                            if (ok) cancelOnline.mutate(fine.onlinePayment!.id);
                          }}
                        >
                          Huỷ giao dịch chờ
                        </RowButton>
                      )}
                      {!fine.paidAt && fine.onlinePayment?.status !== "PENDING" && (
                        <RowButton
                          aria-label={`Thu tiền phạt của ${fine.loan?.user.fullName ?? "bạn đọc"}`}
                          disabled={pay.isPending}
                          onClick={async () => {
                            const ok = await confirm({
                              title: "Xác nhận thu tiền",
                              message: `Xác nhận đã thu ${formatCurrency(fine.amount)} của ${fine.loan?.user.fullName}?`,
                              confirmLabel: "Đã thu tiền",
                              tone: "primary",
                            });
                            if (ok) pay.mutate(fine);
                          }}
                        >
                          Thu tiền
                        </RowButton>
                      )}
                    </div>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </TableShell>
        )}
        {fines.data && <Pagination page={page} total={fines.data.total} limit={LIMIT} onPage={setPage} />}
      </div>
    </div>
  );
}
