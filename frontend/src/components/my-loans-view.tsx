"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleCheck, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { BookCover } from "./book-card";
import { Reveal } from "./motion";
import { MyLoansSkeleton } from "./public/reader-skeletons";
import { Alert, Badge, Button, ButtonLink, EmptyState, PageHeading, StatCard } from "./ui";
import { ApiError, apiFetch, describeDueDate, formatCurrency, formatDate } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Fine, Loan, Page } from "@/lib/types";

const DAY = 86_400_000;

/** Thanh thời gian đã qua của một phiếu: co giãn bằng transform nên không ép bố cục lại. */
function DueBar({ loan }: { loan: Loan }) {
  const start = new Date(loan.borrowedAt).getTime();
  const end = new Date(loan.dueAt).getTime();
  const ratio = loan.isOverdue ? 1 : Math.min(1, Math.max(0.04, (Date.now() - start) / Math.max(1, end - start)));
  const soon = !loan.isOverdue && end - Date.now() <= 3 * DAY;
  const color = loan.isOverdue ? "bg-danger" : soon ? "bg-[#d97706]" : "bg-leaf";
  return (
    <div className="h-2 overflow-hidden rounded-full bg-paper-2" aria-hidden="true">
      <div className={`h-full origin-left rounded-full ${color}`} style={{ transform: `scaleX(${ratio})` }} />
    </div>
  );
}

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

  if (active.isLoading) return <MyLoansSkeleton />;

  const loans = active.data?.items ?? [];
  const unpaid = fines.data?.unpaidTotal ?? 0;
  const overdueCount = loans.filter((loan) => loan.isOverdue).length;
  const soonCount = loans.filter(
    (loan) => !loan.isOverdue && new Date(loan.dueAt).getTime() - Date.now() <= 3 * DAY,
  ).length;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <PageHeading
        title="Sách tôi đang mượn"
        description="Theo dõi hạn trả và gia hạn trực tuyến khi phiếu chưa quá hạn."
        action={<ButtonLink href="/my/fines" variant="ghost">Xem tiền phạt</ButtonLink>}
      />

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Đang mượn" value={loans.length} hint="cuốn đang giữ" />
        <StatCard label="Sắp đến hạn" value={soonCount} hint="trong 3 ngày tới" tone={soonCount > 0 ? "warn" : "default"} />
        <StatCard
          label="Quá hạn"
          value={overdueCount}
          hint={overdueCount > 0 ? "cần trả sớm" : "không có phiếu trễ"}
          tone={overdueCount > 0 ? "danger" : "default"}
        />
        <StatCard
          label="Tiền phạt chưa trả"
          value={formatCurrency(unpaid)}
          hint={unpaid > 0 ? "tạm dừng mượn và gia hạn" : "không còn nợ"}
          tone={unpaid > 0 ? "danger" : "default"}
        />
      </div>

      {notice && (
        <div className="mt-5">
          <Alert tone={notice.tone}>{notice.text}</Alert>
        </div>
      )}

      {unpaid > 0 && (
        <div className="mt-5">
          <Alert tone="bad">
            Bạn còn {formatCurrency(unpaid)} tiền phạt chưa thanh toán. Thư viện tạm dừng cho mượn và gia hạn
            cho tới khi bạn thanh toán.
          </Alert>
        </div>
      )}

      <section className="mt-8" aria-labelledby="tieu-de-dang-muon">
        <h2 id="tieu-de-dang-muon" className="sr-only">
          Danh sách sách đang mượn
        </h2>
        {loans.length === 0 ? (
          <EmptyState
            title="Kệ sách của bạn còn trống, mời chọn cuốn đầu tiên"
            hint="Tìm sách trong danh mục rồi mang thẻ bạn đọc tới quầy để mượn."
            action={<ButtonLink href="/books">Tra cứu sách</ButtonLink>}
          />
        ) : (
          <ul className="space-y-4">
            {loans.map((loan, index) => {
              const blocked = loan.isOverdue || unpaid > 0;
              return (
                <li key={loan.id}>
                  <Reveal delay={index * 40}>
                    <article className="flex gap-4 rounded-[1.25rem] border border-line bg-white p-4 shadow-[var(--shadow-card)] sm:gap-5 sm:p-5">
                      <Link href={`/books/${loan.copy.book.id}`} className="w-20 shrink-0 rounded-xl sm:w-24">
                        <div className="aspect-[2/3] overflow-hidden rounded-xl bg-paper-2 shadow-[0_12px_22px_-14px_rgb(21_26_51/0.6)]">
                          <BookCover title={loan.copy.book.title} coverUrl={loan.copy.book.coverUrl} />
                        </div>
                      </Link>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                          <div className="min-w-0">
                            <h3 className="text-base font-bold leading-snug sm:text-lg">
                              <Link href={`/books/${loan.copy.book.id}`} className="hover:text-primary">
                                {loan.copy.book.title}
                              </Link>
                            </h3>
                            <p className="mt-1 text-xs text-ink-faint">Mã vạch {loan.copy.barcode}</p>
                          </div>
                          <Badge tone={loan.isOverdue ? "bad" : "good"}>
                            {describeDueDate(loan.dueAt, loan.isOverdue, loan.overdueDays)}
                          </Badge>
                        </div>

                        <div className="mt-4">
                          <DueBar loan={loan} />
                          <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1.5 text-sm">
                            <div className="flex gap-1.5">
                              <dt className="text-ink-faint">Mượn ngày</dt>
                              <dd>{formatDate(loan.borrowedAt)}</dd>
                            </div>
                            <div className="flex gap-1.5">
                              <dt className="text-ink-faint">Hạn trả</dt>
                              <dd className="font-semibold">{formatDate(loan.dueAt)}</dd>
                            </div>
                            <div className="flex gap-1.5">
                              <dt className="text-ink-faint">Đã gia hạn</dt>
                              <dd>{loan.renewedCount} lần</dd>
                            </div>
                          </dl>
                        </div>

                        <div className="mt-4 flex flex-wrap items-center gap-3">
                          <Button
                            variant="soft"
                            disabled={renew.isPending || blocked}
                            onClick={() => renew.mutate(loan.id)}
                          >
                            <RefreshCw size={16} aria-hidden="true" />
                            {renew.isPending && renew.variables === loan.id ? "Đang gia hạn..." : "Gia hạn"}
                          </Button>
                          {blocked && (
                            <span className="text-xs text-ink-faint">
                              {loan.isOverdue ? "Phiếu quá hạn nên không gia hạn được." : "Còn nợ phạt nên chưa gia hạn được."}
                            </span>
                          )}
                        </div>
                      </div>
                    </article>
                  </Reveal>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {(history.data?.items.length ?? 0) > 0 && (
        <section className="mt-12" aria-labelledby="tieu-de-lich-su">
          <h2 id="tieu-de-lich-su" className="text-xl font-bold">
            Đã trả gần đây
          </h2>
          <ul className="mt-4 divide-y divide-line overflow-hidden rounded-[1.25rem] border border-line bg-white shadow-[var(--shadow-card)]">
            {history.data!.items.map((loan) => (
              <li key={loan.id} className="flex flex-wrap items-center justify-between gap-x-3 px-5 py-1 text-sm">
                <span className="flex min-w-0 items-center gap-3">
                  <CircleCheck size={18} className="shrink-0 text-leaf" aria-hidden="true" />
                  <Link href={`/books/${loan.copy.book.id}`} className="block truncate py-3 font-semibold hover:text-primary">
                    {loan.copy.book.title}
                  </Link>
                </span>
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
