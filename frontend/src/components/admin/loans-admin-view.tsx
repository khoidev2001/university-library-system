"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { apiFetch, describeDueDate, formatCurrency, formatDate } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Fine, Loan, LoanStatus, Page } from "@/lib/types";
import { ExportButtons } from "../export-buttons";
import { EmptyState, PageHeading, RiskMeter } from "../ui";
import {
  BookThumb,
  FilterTabs,
  Pagination,
  RowButton,
  SearchInput,
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

type Filter = "ALL" | "ACTIVE" | "OVERDUE" | "RETURNED" | "LOST";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "ALL", label: "Tất cả" },
  { value: "ACTIVE", label: "Đang mượn" },
  { value: "OVERDUE", label: "Quá hạn" },
  { value: "RETURNED", label: "Đã trả" },
  { value: "LOST", label: "Mất sách" },
];

function initialFilter(status: string | null, overdue: string | null): Filter {
  if (overdue === "true") return "OVERDUE";
  if (status === "ACTIVE" || status === "RETURNED" || status === "LOST") return status;
  return "ALL";
}

function queryFor(filter: Filter): string {
  if (filter === "OVERDUE") return "&overdue=true";
  if (filter === "ALL") return "";
  return `&status=${filter satisfies LoanStatus}`;
}

export function LoansAdminView() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const params = useSearchParams();
  const { show, node } = useNotice();
  const { confirm, dialog: confirmDialog } = useConfirm();

  const [filter, setFilter] = useState<Filter>(() => initialFilter(params.get("status"), params.get("overdue")));
  const [page, setPage] = useState(1);
  const [reader, setReader] = useState("");

  const loans = useQuery({
    queryKey: ["admin-loans", filter, page],
    queryFn: () =>
      apiFetch<Page<Loan>>(`/loans?limit=${LIMIT}&page=${page}${queryFor(filter)}`, { token }),
    enabled: !!token,
    placeholderData: (previous) => previous,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-loans"] });
    queryClient.invalidateQueries({ queryKey: ["admin-total"] });
    queryClient.invalidateQueries({ queryKey: ["reports"] });
  };

  const giveBack = useMutation({
    mutationFn: (loan: Loan) =>
      apiFetch<{ fine: Fine | null }>(`/loans/${loan.id}/return`, { method: "POST", token }),
    onSuccess: (result, loan) => {
      show(
        "good",
        result.fine
          ? `Đã nhận trả "${loan.copy.book.title}", phát sinh phạt ${formatCurrency(result.fine.amount)}.`
          : `Đã nhận trả "${loan.copy.book.title}".`,
      );
      refresh();
    },
    onError: (error) => show("bad", errorText(error, "Không ghi nhận được việc trả sách.")),
  });

  const reportLost = useMutation({
    mutationFn: (loan: Loan) =>
      apiFetch<{ fine: Fine | null }>(`/loans/${loan.id}/report-lost`, { method: "POST", token }),
    onSuccess: (result, loan) => {
      show(
        "good",
        result.fine
          ? `Đã ghi nhận mất "${loan.copy.book.title}", phạt ${formatCurrency(result.fine.amount)}.`
          : `Đã ghi nhận mất "${loan.copy.book.title}".`,
      );
      refresh();
    },
    onError: (error) => show("bad", errorText(error, "Không ghi nhận được việc mất sách.")),
  });

  const busy = giveBack.isPending || reportLost.isPending;

  // Lọc theo tên, mã thẻ hoặc tên sách ngay trên trang đang xem
  const needle = reader.trim().toLowerCase();
  const rows = (loans.data?.items ?? []).filter(
    (loan) =>
      !needle ||
      loan.user.fullName.toLowerCase().includes(needle) ||
      (loan.user.memberCode ?? "").toLowerCase().includes(needle) ||
      loan.copy.book.title.toLowerCase().includes(needle) ||
      loan.copy.barcode.toLowerCase().includes(needle),
  );

  return (
    <div>
      <PageHeading
        title="Phiếu mượn"
        description="Theo dõi mọi phiếu mượn, nhận trả sách hoặc ghi nhận mất sách ngay trên danh sách."
      />
      {node}
      {confirmDialog}

      <Toolbar>
        <FilterTabs
          label="Lọc phiếu mượn"
          value={filter}
          items={FILTERS}
          onChange={(value) => {
            setFilter(value);
            setPage(1);
          }}
        />
        <form className="flex min-w-[220px] flex-1" onSubmit={(event) => event.preventDefault()}>
          <SearchInput
            id="admin-loans-q"
            label="Lọc trong trang"
            value={reader}
            onChange={setReader}
            placeholder="Lọc theo bạn đọc, sách hoặc mã vạch"
            className="max-w-md"
          />
        </form>
      </Toolbar>

      <ExportButtons
        className="mt-4"
        dataset="loans"
        subject="phiếu mượn"
        dateRange
        params={filter === "OVERDUE" ? { overdue: true } : filter === "ALL" ? {} : { status: filter }}
      />

      <div className="mt-5">
        {loans.isLoading ? (
          <TableSkeleton rows={8} cols={5} />
        ) : rows.length === 0 ? (
          <EmptyState
            title="Không có phiếu mượn nào khớp"
            hint={needle ? "Thử xoá từ khoá lọc hoặc chuyển sang trang khác." : "Chưa có phiếu nào ở mục này."}
          />
        ) : (
          <TableShell minWidth={900}>
            <caption className="sr-only">Danh sách phiếu mượn</caption>
            <thead>
              <tr>
                <Th>Bạn đọc</Th>
                <Th>Sách</Th>
                <Th>Mượn</Th>
                <Th>Hạn trả</Th>
                <Th>Tình trạng</Th>
                <Th align="right">
                  <span className="sr-only">Thao tác</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((loan, index) => (
                <Tr key={loan.id} index={index}>
                  <Td card="title" className="whitespace-nowrap">
                    <span className="font-semibold">{loan.user.fullName}</span>
                    <span className="block text-xs tabular-nums text-ink-faint">{loan.user.memberCode}</span>
                  </Td>
                  <Td card="full">
                    <div className="flex items-center gap-3">
                      <BookThumb coverUrl={loan.copy.book.coverUrl} title={loan.copy.book.title} />
                      <div className="min-w-0">
                        <span className="line-clamp-2">{loan.copy.book.title}</span>
                        <span className="block text-xs tabular-nums text-ink-faint">Mã vạch {loan.copy.barcode}</span>
                      </div>
                    </div>
                  </Td>
                  <Td className="whitespace-nowrap text-ink-soft">{formatDate(loan.borrowedAt)}</Td>
                  <Td className="whitespace-nowrap text-ink-soft">{formatDate(loan.dueAt)}</Td>
                  <Td>
                    <LoanStatusCell loan={loan} />
                  </Td>
                  <Td card="actions">
                    <div className="flex justify-end gap-2">
                      {loan.status === "ACTIVE" && (
                        <>
                          <RowButton
                            aria-label={`Nhận trả ${loan.copy.book.title}`}
                            disabled={busy}
                            onClick={() => giveBack.mutate(loan)}
                          >
                            Nhận trả
                          </RowButton>
                          <RowButton
                            danger
                            aria-label={`Báo mất ${loan.copy.book.title}`}
                            disabled={busy}
                            onClick={async () => {
                              const ok = await confirm({
                                title: "Ghi nhận mất sách",
                                message: `Ghi nhận mất "${loan.copy.book.title}"? Bạn đọc sẽ bị phạt theo giá bìa ${formatCurrency(loan.copy.book.price)}.`,
                                confirmLabel: "Ghi nhận mất",
                              });
                              if (ok) reportLost.mutate(loan);
                            }}
                          >
                            Báo mất
                          </RowButton>
                        </>
                      )}
                    </div>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </TableShell>
        )}
        {loans.data && <Pagination page={page} total={loans.data.total} limit={LIMIT} onPage={setPage} />}
      </div>
    </div>
  );
}

function LoanStatusCell({ loan }: { loan: Loan }) {
  if (loan.status === "RETURNED") {
    return (
      <span className="flex flex-col items-start gap-1">
        <StatusBadge tone="good">Đã trả</StatusBadge>
        {loan.returnedAt && <span className="text-xs text-ink-faint">{formatDate(loan.returnedAt)}</span>}
      </span>
    );
  }
  if (loan.status === "LOST") return <StatusBadge tone="bad">Mất sách</StatusBadge>;
  return (
    <span className="flex flex-col items-start gap-1 whitespace-nowrap">
      <StatusBadge tone={loan.isOverdue ? "bad" : "info"}>
        {describeDueDate(loan.dueAt, loan.isOverdue, loan.overdueDays)}
      </StatusBadge>
      {!loan.isOverdue && <RiskMeter risk={loan.predictedOverdueRisk} />}
    </span>
  );
}
