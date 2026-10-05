"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, BookDown, BookUp, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { BookCover } from "./book-card";
import { Alert, Badge, Button, Card, Field, PageHeading, RiskMeter, inputClass } from "./ui";
import { ApiError, apiFetch, formatCurrency, formatDate } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { BorrowResult, Loan, Page, ReturnResult } from "@/lib/types";

export function CirculationDesk() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [borrowForm, setBorrowForm] = useState({ barcode: "", memberCode: "" });
  const [returnBarcode, setReturnBarcode] = useState("");
  const [lastBorrow, setLastBorrow] = useState<BorrowResult | null>(null);
  const [lastReturn, setLastReturn] = useState<ReturnResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const overdue = useQuery({
    queryKey: ["loans", "overdue"],
    queryFn: () => apiFetch<Page<Loan>>("/loans?overdue=true&limit=8", { token }),
    enabled: !!token,
  });

  const borrow = useMutation({
    mutationFn: () => apiFetch<BorrowResult>("/loans", { method: "POST", body: borrowForm, token }),
    onSuccess: (result) => {
      setLastBorrow(result);
      setLastReturn(null);
      setError(null);
      setBorrowForm({ barcode: "", memberCode: borrowForm.memberCode });
      queryClient.invalidateQueries({ queryKey: ["loans"] });
    },
    onError: (err) => {
      setLastBorrow(null);
      setError(err instanceof ApiError ? err.friendlyMessage : "Không tạo được phiếu mượn.");
    },
  });

  const returnLoan = useMutation({
    mutationFn: async () => {
      const found = await apiFetch<Page<Loan>>(`/loans?status=ACTIVE&limit=100`, { token });
      const loan = found.items.find((item) => item.copy.barcode === returnBarcode.trim());
      if (!loan) throw new ApiError(404, "LOAN_NOT_FOUND", "Không tìm thấy phiếu mượn đang mở cho mã vạch này.");
      return apiFetch<ReturnResult>(`/loans/${loan.id}/return`, { method: "POST", token });
    },
    onSuccess: (result) => {
      setLastReturn(result);
      setLastBorrow(null);
      setError(null);
      setReturnBarcode("");
      queryClient.invalidateQueries({ queryKey: ["loans"] });
    },
    onError: (err) => {
      setLastReturn(null);
      setError(err instanceof ApiError ? err.friendlyMessage : "Không nhận trả được.");
    },
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <PageHeading
        eyebrow="Nghiệp vụ thủ thư"
        title="Quầy mượn trả"
        description="Quét mã vạch bản sao và nhập mã bạn đọc. Hệ thống tự kiểm tra hạn mức, sách quá hạn và tiền phạt."
      />

      {error && (
        <div className="mt-5">
          <Alert tone="bad">{error}</Alert>
        </div>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="flex items-center gap-2 font-serif text-lg font-bold">
            <BookUp size={19} className="text-brand" aria-hidden="true" />
            Cho mượn
          </h2>
          <form
            className="mt-4 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              borrow.mutate();
            }}
          >
            <Field label="Mã vạch bản sao" htmlFor="o-barcode-muon">
              <input
                id="o-barcode-muon"
                required
                autoFocus
                value={borrowForm.barcode}
                onChange={(event) => setBorrowForm((f) => ({ ...f, barcode: event.target.value }))}
                className={inputClass}
                placeholder="LIB-000123-1"
              />
            </Field>
            <Field label="Mã bạn đọc" htmlFor="o-ma-ban-doc">
              <input
                id="o-ma-ban-doc"
                required
                value={borrowForm.memberCode}
                onChange={(event) => setBorrowForm((f) => ({ ...f, memberCode: event.target.value }))}
                className={inputClass}
                placeholder="23Q74802012006"
              />
            </Field>
            <Button type="submit" disabled={borrow.isPending} className="w-full">
              {borrow.isPending ? "Đang xử lý..." : "Tạo phiếu mượn"}
            </Button>
          </form>

          {lastBorrow && (
            <div className="mt-5 rounded-lg border border-leaf/30 bg-leaf-soft p-4">
              <p className="flex items-center gap-2 font-medium text-leaf">
                <CheckCircle2 size={17} aria-hidden="true" />
                Đã cho mượn thành công
              </p>
              <div className="mt-3 flex gap-3">
                <div className="h-20 w-14 shrink-0 overflow-hidden rounded border border-line bg-paper-2">
                  <BookCover title={lastBorrow.loan.copy.book.title} coverUrl={lastBorrow.loan.copy.book.coverUrl} />
                </div>
                <div className="min-w-0 text-sm">
                  <p className="font-medium">{lastBorrow.loan.copy.book.title}</p>
                  <p className="mt-0.5 text-ink-soft">
                    {lastBorrow.loan.user.fullName} ({lastBorrow.loan.user.memberCode})
                  </p>
                  <p className="mt-1.5">
                    Hạn trả: <strong>{formatDate(lastBorrow.loan.dueAt)}</strong>
                  </p>
                  <p className="mt-2">
                    <RiskMeter risk={lastBorrow.overdueRisk} />
                  </p>
                </div>
              </div>
            </div>
          )}
        </Card>

        <Card>
          <h2 className="flex items-center gap-2 font-serif text-lg font-bold">
            <BookDown size={19} className="text-leaf" aria-hidden="true" />
            Nhận trả
          </h2>
          <form
            className="mt-4 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              returnLoan.mutate();
            }}
          >
            <Field label="Mã vạch bản sao" htmlFor="o-barcode-tra" hint="Hệ thống tự tìm phiếu đang mở của bản sao này">
              <input
                id="o-barcode-tra"
                required
                value={returnBarcode}
                onChange={(event) => setReturnBarcode(event.target.value)}
                className={inputClass}
                placeholder="LIB-000123-1"
              />
            </Field>
            <Button type="submit" variant="ghost" disabled={returnLoan.isPending} className="w-full">
              {returnLoan.isPending ? "Đang xử lý..." : "Nhận trả sách"}
            </Button>
          </form>

          {lastReturn && (
            <div
              className={`mt-5 rounded-lg border p-4 ${
                lastReturn.fine ? "border-brand/30 bg-brand-soft" : "border-leaf/30 bg-leaf-soft"
              }`}
            >
              <p className={`flex items-center gap-2 font-medium ${lastReturn.fine ? "text-brand" : "text-leaf"}`}>
                {lastReturn.fine ? <AlertTriangle size={17} aria-hidden="true" /> : <CheckCircle2 size={17} aria-hidden="true" />}
                {lastReturn.fine ? "Đã nhận trả, có phát sinh phạt" : "Đã nhận trả đúng hạn"}
              </p>
              <p className="mt-2 text-sm font-medium">{lastReturn.loan.copy.book.title}</p>
              {lastReturn.fine ? (
                <p className="mt-1.5 text-sm">
                  Trễ {lastReturn.overdueDays} ngày, phạt{" "}
                  <strong>{formatCurrency(lastReturn.fine.amount)}</strong>. Thu tiền tại mục Tiền phạt.
                </p>
              ) : (
                <p className="mt-1.5 text-sm text-ink-soft">Bản sao đã trở lại trạng thái sẵn sàng cho mượn.</p>
              )}
            </div>
          )}
        </Card>
      </div>

      <section className="mt-12" aria-labelledby="tieu-de-qua-han">
        <h2 id="tieu-de-qua-han" className="font-serif text-xl font-bold">
          Phiếu đang quá hạn
        </h2>
        <p className="mt-1 text-sm text-ink-soft">Nhắc bạn đọc mang sách tới trả để tránh phạt tăng thêm.</p>
        {overdue.isLoading ? (
          <p className="mt-4 text-sm text-ink-faint">Đang tải...</p>
        ) : (overdue.data?.items.length ?? 0) === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed border-line bg-white/60 px-5 py-8 text-center text-sm text-ink-soft">
            Hiện không có phiếu nào quá hạn.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-line bg-white">
            <table className="w-full min-w-[640px] text-sm">
              <caption className="sr-only">Danh sách phiếu mượn đang quá hạn</caption>
              <thead className="border-b border-line bg-paper-2 text-left">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">Bạn đọc</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Sách</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Hạn trả</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Số ngày trễ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {overdue.data!.items.map((loan) => (
                  <tr key={loan.id}>
                    <td className="px-4 py-3">
                      <span className="font-medium">{loan.user.fullName}</span>
                      <span className="block text-xs text-ink-faint">{loan.user.memberCode}</span>
                    </td>
                    <td className="px-4 py-3">{loan.copy.book.title}</td>
                    <td className="px-4 py-3 text-ink-soft">{formatDate(loan.dueAt)}</td>
                    <td className="px-4 py-3">
                      <Badge tone="bad">{loan.overdueDays} ngày</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
