"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, BookMarked, Library, TrendingUp } from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { apiFetch, formatCurrency, formatDate } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { InventoryRow, MonthCount, OverdueRow, TopBookRow } from "@/lib/types";
import { ExportButtons } from "./export-buttons";
import { CountUp, Reveal } from "./motion";
import { ButtonLink, Card, ChartSkeleton, EmptyState, PageHeading, Skeleton, StatCard } from "./ui";
import { GrowBar, InlineSkeleton, StatusBadge, Td, Th } from "./admin/admin-ui";

const MonthlyBarChart = dynamic(() => import("./charts").then((m) => m.MonthlyBarChart), {
  ssr: false,
  loading: () => <ChartSkeleton />,
});
const InventoryPieChart = dynamic(() => import("./charts").then((m) => m.InventoryPieChart), {
  ssr: false,
  loading: () => <ChartSkeleton />,
});

const OVERDUE_SHOWN = 10;

const RANK_STYLE = [
  "bg-primary text-white shadow-[0_6px_12px_-6px_rgb(79_70_229/0.8)]",
  "bg-primary-soft text-primary-ink",
  "bg-primary-soft text-primary-ink",
];

export function ReportsView() {
  const { token } = useAuth();

  const topBooks = useQuery({
    queryKey: ["reports", "top-books"],
    queryFn: () => apiFetch<TopBookRow[]>("/reports/top-books?limit=8", { token }),
    enabled: !!token,
  });
  const overdue = useQuery({
    queryKey: ["reports", "overdue"],
    queryFn: () => apiFetch<OverdueRow[]>("/reports/overdue", { token }),
    enabled: !!token,
  });
  const byMonth = useQuery({
    queryKey: ["reports", "loans-by-month"],
    queryFn: () => apiFetch<MonthCount[]>("/reports/loans-by-month?months=12", { token }),
    enabled: !!token,
  });
  const inventory = useQuery({
    queryKey: ["reports", "inventory"],
    queryFn: () => apiFetch<InventoryRow[]>("/reports/inventory", { token }),
    enabled: !!token,
  });

  const loading = topBooks.isLoading || byMonth.isLoading;

  const months = (byMonth.data ?? []).map((row) => ({
    ...row,
    label: row.month.slice(5) + "/" + row.month.slice(2, 4),
  }));
  const inventoryRows = [...(inventory.data ?? [])].sort((a, b) => b.total - a.total);
  const topInventory = inventoryRows.slice(0, 8);
  const overdueRows = overdue.data ?? [];
  const totalCopies = inventoryRows.reduce((sum, row) => sum + row.total, 0);
  const borrowedCopies = inventoryRows.reduce((sum, row) => sum + row.borrowed, 0);
  const totalLoansYear = months.reduce((sum, row) => sum + row.count, 0);
  const estimatedFines = overdueRows.reduce((sum, row) => sum + row.estimatedFine, 0);
  const topMax = Math.max(1, ...(topBooks.data ?? []).map((row) => row.loanCount));

  const figure = (value: number) => (loading ? <InlineSkeleton /> : <CountUp value={value} />);

  return (
    <div>
      <PageHeading
        title="Thống kê thư viện"
        description="Số liệu tổng hợp theo thời gian thực từ dữ liệu mượn trả."
      />

      <section className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4" aria-label="Chỉ số tổng quan">
        <Reveal>
          <StatCard label="Bản sao trong kho" value={figure(totalCopies)} icon={<Library size={18} />} hint="Mọi thể loại, mọi trạng thái" />
        </Reveal>
        <Reveal delay={60}>
          <StatCard label="Đang được mượn" value={figure(borrowedCopies)} icon={<BookMarked size={18} />} hint="Bản sao đang ở chỗ bạn đọc" />
        </Reveal>
        <Reveal delay={120}>
          <StatCard label="Lượt mượn 12 tháng" value={figure(totalLoansYear)} icon={<TrendingUp size={18} />} hint="Tính theo ngày mượn" />
        </Reveal>
        <Reveal delay={180}>
          <StatCard
            label="Phiếu đang quá hạn"
            value={figure(overdueRows.length)}
            tone={overdueRows.length > 0 ? "danger" : "good"}
            icon={<AlertTriangle size={18} />}
            hint={overdueRows.length > 0 ? `Phạt ước tính ${formatCurrency(estimatedFines)}` : "Không có phiếu nào trễ hạn"}
          />
        </Reveal>
      </section>

      <div className="mt-4 grid gap-4 xl:grid-cols-12">
        <Reveal className="xl:col-span-6">
          <Card className="flex h-full flex-col">
            <h2 className="text-lg font-bold">Lượt mượn theo tháng</h2>
            <p className="mt-1 text-sm text-ink-soft">Mười hai tháng gần nhất. Tháng cao nhất được tô đậm.</p>
            <div className="relative mt-5 min-h-64 flex-1" role="img" aria-label="Biểu đồ cột số lượt mượn theo tháng">
              <div className="absolute inset-0">{byMonth.isLoading ? <ChartSkeleton /> : <MonthlyBarChart data={months} detailed />}</div>
            </div>
          </Card>
        </Reveal>

        <Reveal delay={80} className="xl:col-span-6">
          <Card className="h-full">
            <h2 className="text-lg font-bold">Tồn kho theo thể loại</h2>
            <p className="mt-1 text-sm text-ink-soft">Tám thể loại có nhiều bản sao nhất.</p>
            <div className="mt-5">
              {inventory.isLoading ? <Skeleton className="h-44" /> : <InventoryPieChart data={topInventory} />}
            </div>
          </Card>
        </Reveal>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-12">
        <Reveal className="xl:col-span-4">
          <Card className="h-full">
            <h2 className="text-lg font-bold">Sách được mượn nhiều nhất</h2>
            {topBooks.isLoading ? (
              <Skeleton className="mt-4 h-64" />
            ) : (topBooks.data ?? []).length === 0 ? (
              <p className="mt-4 text-sm text-ink-soft">Chưa có lượt mượn nào để xếp hạng.</p>
            ) : (
              <ol className="mt-4 space-y-1">
                {(topBooks.data ?? []).map((row, index) => (
                  <li key={row.book.id}>
                    <Link
                      href={`/books/${row.book.id}`}
                      className="group flex min-h-12 items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-paper"
                    >
                      <span
                        className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-sm font-bold tabular-nums ${RANK_STYLE[index] ?? "bg-paper-2 text-ink-soft"}`}
                      >
                        {index + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-2 text-sm font-semibold group-hover:text-primary-ink">{row.book.title}</span>
                        <span className="mt-1.5 block">
                          <GrowBar fraction={row.loanCount / topMax} delay={index * 60} />
                        </span>
                      </span>
                      <span className="shrink-0 text-sm font-semibold tabular-nums text-ink-soft">
                        {row.loanCount.toLocaleString("vi-VN")} lượt
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </Reveal>

        <Reveal delay={80} className="xl:col-span-8">
          <section aria-labelledby="overdue-heading" className="h-full">
            <Card className="h-full !p-0">
              <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-3 pt-5 sm:px-6 sm:pt-6">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 id="overdue-heading" className="text-lg font-bold">
                    Bạn đọc đang quá hạn
                  </h2>
                  {overdueRows.length > 0 && <StatusBadge tone="bad">{overdueRows.length.toLocaleString("vi-VN")} phiếu</StatusBadge>}
                </div>
                {overdueRows.length > OVERDUE_SHOWN && (
                  <ButtonLink href="/admin/loans?overdue=true" variant="soft">
                    Xem tất cả
                  </ButtonLink>
                )}
              </div>
              {overdue.isLoading ? (
                <div className="px-5 pb-6 sm:px-6">
                  <Skeleton className="h-48" />
                </div>
              ) : overdueRows.length === 0 ? (
                <div className="px-5 pb-6 sm:px-6">
                  <EmptyState title="Không có bạn đọc nào quá hạn" hint="Danh sách sẽ hiện ở đây khi có phiếu quá hạn." />
                </div>
              ) : (
                <div className="relative overflow-x-auto">
                  <table className="w-full min-w-[640px] text-sm [&_tbody>tr+tr]:border-t [&_tbody>tr+tr]:border-line/80 [&_tbody>tr:hover]:bg-paper/90">
                    <caption className="sr-only">Bạn đọc đang giữ sách quá hạn</caption>
                    <thead>
                      <tr>
                        <Th>Bạn đọc</Th>
                        <Th>Sách</Th>
                        <Th>Hạn trả</Th>
                        <Th>Số ngày trễ</Th>
                        <Th align="right">Phạt ước tính</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {overdueRows.slice(0, OVERDUE_SHOWN).map((row) => (
                        <tr key={row.loanId}>
                          <Td className="whitespace-nowrap">
                            <span className="font-semibold">{row.user.fullName}</span>
                            <span className="block text-xs tabular-nums text-ink-faint">{row.user.memberCode}</span>
                          </Td>
                          <Td className="min-w-[11rem] max-w-[14rem]">
                            <span className="line-clamp-2">{row.book.title}</span>
                          </Td>
                          <Td className="whitespace-nowrap text-ink-soft">{formatDate(row.dueAt)}</Td>
                          <Td>
                            <StatusBadge tone="bad">{row.overdueDays} ngày</StatusBadge>
                          </Td>
                          <Td align="right" className="whitespace-nowrap font-semibold">
                            {formatCurrency(row.estimatedFine)}
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {overdueRows.length > OVERDUE_SHOWN && (
                    <p className="px-5 pb-5 pt-3 text-xs text-ink-faint sm:px-6">
                      Hiển thị {OVERDUE_SHOWN} trên {overdueRows.length.toLocaleString("vi-VN")} phiếu quá hạn.
                    </p>
                  )}
                </div>
              )}
            </Card>
          </section>
        </Reveal>
      </div>

      <Reveal className="mt-4">
        <section aria-labelledby="export-heading">
          <Card>
            <h2 id="export-heading" className="text-lg font-bold">
              Xuất báo cáo
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-ink-soft">
              CSV (UTF-8, mở được bằng Excel) hoặc Excel. Ngày tính theo giờ thư viện (UTC+7); tối đa 100.000 dòng mỗi lần.
            </p>
            <ul className="mt-4 divide-y divide-line rounded-2xl bg-paper">
              <ExportRow title="Phiếu mượn quá hạn" hint="Kèm số ngày trễ và phạt ước tính tính đến hôm nay.">
                <ExportButtons dataset="overdue-loans" subject="phiếu mượn quá hạn" />
              </ExportRow>
              <ExportRow title="Phiếu mượn theo khoảng ngày" hint="Lọc theo ngày mượn; bỏ trống để xuất tất cả.">
                <ExportButtons dataset="loans" dateRange subject="phiếu mượn" />
              </ExportRow>
              <ExportRow title="Sách mượn nhiều nhất" hint="Top 100 đầu sách trong khoảng ngày chọn.">
                <ExportButtons dataset="top-books" params={{ limit: 100 }} dateRange subject="sách mượn nhiều nhất" />
              </ExportRow>
              <ExportRow title="Tồn kho theo thể loại" hint="Số bản sao theo từng trạng thái.">
                <ExportButtons dataset="inventory" subject="tồn kho theo thể loại" />
              </ExportRow>
            </ul>
          </Card>
        </section>
      </Reveal>
    </div>
  );
}

function ExportRow({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <li className="flex flex-col gap-3 px-4 py-4 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs text-ink-soft">{hint}</p>
      </div>
      {children}
    </li>
  );
}
