"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { apiFetch, describeDueDate, formatCurrency, formatDate } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Fine, Loan, LoanStatus, Page } from "@/lib/types";
import { ExportButtons } from "../export-buttons";
import { Badge, PageHeading, RiskMeter, Spinner, inputClass } from "../ui";
import { Pagination, TableShell, Th, Toolbar, errorText, useNotice } from "./admin-ui";

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

  const [filter, setFilter] = useState<Filter>(() => initialFilter(params.get("status"), params.get("overdue")));
  const [page, setPage] = useState(1);
  const [reader, setReader] = useState("");
  const [readerQuery, setReaderQuery] = useState("");

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
  const needle = readerQuery.toLowerCase();
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
        eyebrow="Nghiệp vụ"
        title="Phiếu mượn"
        description="Theo dõi mọi phiếu mượn, nhận trả sách hoặc ghi nhận mất sách ngay trên danh sách."
      />
      {node}

      <Toolbar>
        <div role="tablist" aria-label="Lọc phiếu mượn" className="flex flex-wrap gap-1 rounded-lg border border-line bg-white p-1">
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
              className={`min-h-10 rounded-md px-3.5 py-1.5 text-sm ${
                filter === item.value ? "bg-ink font-medium text-paper" : "text-ink-soft hover:bg-paper-2"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <form
          className="flex flex-1 gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            setReaderQuery(reader.trim());
          }}
        >
          <label htmlFor="admin-loans-q" className="sr-only">Lọc trong trang</label>
          <input
            id="admin-loans-q"
            value={reader}
            onChange={(e) => {
              setReader(e.target.value);
              if (!e.target.value) setReaderQuery("");
            }}
            className={`${inputClass} max-w-sm`}
            placeholder="Lọc theo bạn đọc, sách hoặc mã vạch"
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
          <Spinner />
        ) : (
          <TableShell minWidth={860}>
            <caption className="sr-only">Danh sách phiếu mượn</caption>
            <thead className="border-b border-line bg-paper-2">
              <tr>
                <Th>Bạn đọc</Th>
                <Th>Sách</Th>
                <Th>Mượn</Th>
                <Th>Hạn trả</Th>
                <Th>Tình trạng</Th>
                <Th align="right"><span className="sr-only">Thao tác</span></Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((loan) => (
                <tr key={loan.id}>
                  <td className="px-4 py-3">
                    <span className="font-medium">{loan.user.fullName}</span>
                    <span className="block text-xs text-ink-faint">{loan.user.memberCode}</span>
                  </td>
                  <td className="px-4 py-3">
                    {loan.copy.book.title}
                    <span className="block font-mono text-xs text-ink-faint">{loan.copy.barcode}</span>
                  </td>
                  <td className="px-4 py-3 text-ink-soft">{formatDate(loan.borrowedAt)}</td>
                  <td className="px-4 py-3 text-ink-soft">{formatDate(loan.dueAt)}</td>
                  <td className="px-4 py-3">
                    <LoanStatusCell loan={loan} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      {loan.status === "ACTIVE" && (
                        <>
                          <button
                            type="button"
                            aria-label={`Nhận trả ${loan.copy.book.title}`}
                            disabled={busy}
                            onClick={() => giveBack.mutate(loan)}
                            className="rounded-md border border-line px-3 py-1.5 text-xs font-medium hover:bg-paper-2 disabled:opacity-50"
                          >
                            Nhận trả
                          </button>
                          <button
                            type="button"
                            aria-label={`Báo mất ${loan.copy.book.title}`}
                            disabled={busy}
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Ghi nhận mất "${loan.copy.book.title}"? Bạn đọc sẽ bị phạt theo giá bìa ${formatCurrency(loan.copy.book.price)}.`,
                                )
                              ) {
                                reportLost.mutate(loan);
                              }
                            }}
                            className="rounded-md border border-brand/30 px-3 py-1.5 text-xs font-medium text-brand hover:bg-brand-soft disabled:opacity-50"
                          >
                            Báo mất
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        )}
        {rows.length === 0 && !loans.isLoading && (
          <p className="py-10 text-center text-sm text-ink-soft">Không có phiếu mượn nào khớp.</p>
        )}
        {loans.data && <Pagination page={page} total={loans.data.total} limit={LIMIT} onPage={setPage} />}
      </div>
    </div>
  );
}

function LoanStatusCell({ loan }: { loan: Loan }) {
  if (loan.status === "RETURNED") {
    return (
      <span className="space-y-1">
        <Badge tone="good">Đã trả</Badge>
        {loan.returnedAt && <span className="block text-xs text-ink-faint">{formatDate(loan.returnedAt)}</span>}
      </span>
    );
  }
  if (loan.status === "LOST") return <Badge tone="bad">Mất sách</Badge>;
  return (
    <span className="space-y-1">
      <Badge tone={loan.isOverdue ? "bad" : "info"}>{describeDueDate(loan.dueAt, loan.isOverdue, loan.overdueDays)}</Badge>
      {!loan.isOverdue && (
        <span className="block">
          <RiskMeter risk={loan.predictedOverdueRisk} />
        </span>
      )}
    </span>
  );
}
