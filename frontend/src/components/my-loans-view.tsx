"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { BookCover } from "./book-card";
import { Alert, Badge, Button, ButtonLink, EmptyState, PageHeading, Spinner } from "./ui";
import { ApiError, apiFetch, describeDueDate, formatCurrency, formatDate } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Fine, Loan, Page } from "@/lib/types";

export function MyLoansView() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<{ tone: "good" | "bad"; text: string } | null>(null);

  const active = useQuery({
    queryKey: ["my-loans", "ACTIVE"],
    queryFn: () => apiFetch<Page<Loan>>("/loans/me?status=ACTIVE&limit=50", { token }),
    enabled: !!token,
  });

  const history = useQuery({
    queryKey: ["my-loans", "history"],
    queryFn: () => apiFetch<Page<Loan>>("/loans/me?status=RETURNED&limit=10", { token }),
    enabled: !!token,
  });

  const fines = useQuery({
    queryKey: ["my-fines"],
    queryFn: () => apiFetch<{ items: Fine[]; unpaidTotal: number }>("/fines/me", { token }),
    enabled: !!token,
  });

  const renew = useMutation({
    mutationFn: (loanId: number) => apiFetch<Loan>(`/loans/${loanId}/renew`, { method: "POST", token }),
    onSuccess: (loan) => {
      setNotice({ tone: "good", text: `Đã gia hạn tới ngày ${formatDate(loan.dueAt)}.` });
      queryClient.invalidateQueries({ queryKey: ["my-loans"] });
    },
    onError: (error) => {
      setNotice({
        tone: "bad",
        text: error instanceof ApiError ? error.friendlyMessage : "Không gia hạn được.",
      });
    },
  });

  if (active.isLoading) return <Spinner />;

  const loans = active.data?.items ?? [];
  const unpaid = fines.data?.unpaidTotal ?? 0;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <PageHeading
        eyebrow="Tài khoản của tôi"
        title="Sách tôi đang mượn"
        description="Theo dõi hạn trả và gia hạn trực tuyến khi phiếu chưa quá hạn."
        action={<ButtonLink href="/my/fines" variant="ghost">Xem tiền phạt</ButtonLink>}
      />

      {notice && (
        <div className="mt-5">
          <Alert tone={notice.tone}>{notice.text}</Alert>
        </div>
      )}

      {unpaid > 0 && (
        <div className="mt-5">
          <Alert tone="bad">
            Bạn còn {formatCurrency(unpaid)} tiền phạt chưa thanh toán. Thư viện tạm dừng cho mượn và gia hạn
            cho tới khi bạn nộp tại quầy.
          </Alert>
        </div>
      )}

      <section className="mt-8" aria-labelledby="tieu-de-dang-muon">
        <h2 id="tieu-de-dang-muon" className="sr-only">
          Danh sách sách đang mượn
        </h2>
        {loans.length === 0 ? (
          <EmptyState
            title="Bạn chưa mượn cuốn nào"
            hint="Tìm sách trong danh mục rồi mang thẻ bạn đọc tới quầy để mượn."
            action={<ButtonLink href="/books">Tra cứu sách</ButtonLink>}
          />
        ) : (
          <ul className="space-y-4">
            {loans.map((loan) => (
              <li key={loan.id}>
                <article className="flex gap-4 rounded-xl border border-line bg-white p-4 shadow-sm">
                  <Link href={`/books/${loan.copy.book.id}`} className="w-16 shrink-0 sm:w-20">
                    <div className="aspect-[2/3] overflow-hidden rounded-md border border-line bg-paper-2">
                      <BookCover title={loan.copy.book.title} coverUrl={loan.copy.book.coverUrl} />
                    </div>
                  </Link>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-serif text-base font-bold leading-snug">
                      <Link href={`/books/${loan.copy.book.id}`} className="hover:underline">
                        {loan.copy.book.title}
                      </Link>
                    </h3>
                    <p className="mt-1 text-xs text-ink-faint">Mã vạch {loan.copy.barcode}</p>
                    <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1.5 text-sm">
                      <div className="flex gap-1.5">
                        <dt className="text-ink-faint">Mượn ngày</dt>
                        <dd>{formatDate(loan.borrowedAt)}</dd>
                      </div>
                      <div className="flex gap-1.5">
                        <dt className="text-ink-faint">Hạn trả</dt>
                        <dd className="font-medium">{formatDate(loan.dueAt)}</dd>
                      </div>
                      <div className="flex gap-1.5">
                        <dt className="text-ink-faint">Đã gia hạn</dt>
                        <dd>{loan.renewedCount} lần</dd>
                      </div>
                    </dl>
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <Badge tone={loan.isOverdue ? "bad" : "good"}>
                        {describeDueDate(loan.dueAt, loan.isOverdue, loan.overdueDays)}
                      </Badge>
                      <Button
                        variant="ghost"
                        disabled={renew.isPending || loan.isOverdue || unpaid > 0}
                        onClick={() => renew.mutate(loan.id)}
                      >
                        {renew.isPending && renew.variables === loan.id ? "Đang gia hạn..." : "Gia hạn"}
                      </Button>
                    </div>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        )}
      </section>

      {(history.data?.items.length ?? 0) > 0 && (
        <section className="mt-12" aria-labelledby="tieu-de-lich-su">
          <h2 id="tieu-de-lich-su" className="font-serif text-xl font-bold">
            Đã trả gần đây
          </h2>
          <ul className="mt-4 divide-y divide-line rounded-xl border border-line bg-white">
            {history.data!.items.map((loan) => (
              <li key={loan.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                <Link href={`/books/${loan.copy.book.id}`} className="font-medium hover:underline">
                  {loan.copy.book.title}
                </Link>
                <span className="text-ink-faint">
                  Trả ngày {loan.returnedAt ? formatDate(loan.returnedAt) : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
