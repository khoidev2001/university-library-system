"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, BookMarked, BookOpen, CheckCircle2, HandCoins, Users } from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { apiFetch, formatCurrency, formatDate } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { InventoryRow, MonthCount, OverdueRow, Page, TopBookRow } from "@/lib/types";
import { CountUp, Reveal } from "../motion";
import { ButtonLink, Card, ChartSkeleton, PageHeading, Skeleton, StatCard } from "../ui";
import { GrowBar, InlineSkeleton, StatusBadge, Td, Th } from "./admin-ui";

const MonthlyBarChart = dynamic(() => import("../charts").then((m) => m.MonthlyBarChart), {
  ssr: false,
  loading: () => <ChartSkeleton />,
});

/** Chỉ cần tổng số nên lấy 1 dòng cho nhẹ. */
function useTotal(key: string, path: string) {
  const { token } = useAuth();
  return useQuery({
    queryKey: ["admin-total", key],
    queryFn: async () => (await apiFetch<Page<unknown>>(path, { token })).total,
    enabled: !!token,
  });
}

function Figure({ value }: { value: number | undefined }) {
  return value === undefined ? <InlineSkeleton /> : <CountUp value={value} />;
}

function StatLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="lift block h-full rounded-[1.25rem]">
      {children}
    </Link>
  );
}

/** Vòng phần trăm bản sao còn trên kệ: nét tròn có chuyển màu từ màu nhấn sang mint. */
function ShelfRing({ fraction }: { fraction: number }) {
  const size = 132;
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="anim-pop relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <defs>
          <linearGradient id="shelf-ring" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#4f46e5" />
            <stop offset="100%" stopColor="#14b8a6" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#edeff8" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="url(#shelf-ring)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${Math.max(0.001, fraction) * c} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <p className="text-2xl font-bold tabular-nums">
          <CountUp value={Math.round(fraction * 100)} />
          <span className="text-base text-ink-soft">%</span>
        </p>
      </div>
    </div>
  );
}

const RANK_STYLE = [
  "bg-primary text-white shadow-[0_6px_12px_-6px_rgb(79_70_229/0.8)]",
  "bg-primary-soft text-primary-ink",
  "bg-primary-soft text-primary-ink",
  "bg-paper-2 text-ink-soft",
  "bg-paper-2 text-ink-soft",
];

export function DashboardView() {
  const { token, user } = useAuth();

  const books = useTotal("books", "/books?limit=1");
  const readers = useTotal("readers", "/users?role=READER&limit=1");
  const active = useTotal("active-loans", "/loans?status=ACTIVE&limit=1");
  const overdueCount = useTotal("overdue-loans", "/loans?overdue=true&limit=1");
  const unpaid = useTotal("unpaid-fines", "/fines?paid=false&limit=1");

  const inventory = useQuery({
    queryKey: ["reports", "inventory"],
    queryFn: () => apiFetch<InventoryRow[]>("/reports/inventory", { token }),
    enabled: !!token,
  });
  const byMonth = useQuery({
    queryKey: ["reports", "loans-by-month"],
    queryFn: () => apiFetch<MonthCount[]>("/reports/loans-by-month?months=12", { token }),
    enabled: !!token,
  });
  const topBooks = useQuery({
    queryKey: ["reports", "top-books"],
    queryFn: () => apiFetch<TopBookRow[]>("/reports/top-books?limit=5", { token }),
    enabled: !!token,
  });
  const overdue = useQuery({
    queryKey: ["reports", "overdue"],
    queryFn: () => apiFetch<OverdueRow[]>("/reports/overdue", { token }),
    enabled: !!token,
  });

  const rows = inventory.data ?? [];
  const totalCopies = rows.reduce((sum, row) => sum + row.total, 0);
  const availableCopies = rows.reduce((sum, row) => sum + row.available, 0);
  const borrowedCopies = rows.reduce((sum, row) => sum + row.borrowed, 0);
  const offShelf = rows.reduce((sum, row) => sum + row.lost + row.maintenance + row.held, 0);
  const months = (byMonth.data ?? []).map((row) => ({ ...row, label: `${row.month.slice(5)}/${row.month.slice(2, 4)}` }));
  const loansYear = months.reduce((sum, row) => sum + row.count, 0);
  const peak = months.reduce<(typeof months)[number] | null>((best, row) => (!best || row.count > best.count ? row : best), null);
  const overdueRows = (overdue.data ?? []).slice(0, 6);
  const topMax = Math.max(1, ...(topBooks.data ?? []).map((row) => row.loanCount));

  return (
    <div>
      <PageHeading
        title="Bảng điều khiển"
        description={`Xin chào ${user?.fullName ?? ""}. Đây là tình hình thư viện tại thời điểm hiện tại.`}
        action={
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/librarian/desk">Mở quầy mượn trả</ButtonLink>
            <ButtonLink href="/admin/books" variant="ghost">
              Quản lý sách
            </ButtonLink>
          </div>
        }
      />

      <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Reveal delay={0}>
          <StatLink href="/admin/books">
            <StatCard label="Đầu sách" value={<Figure value={books.data} />} icon={<BookOpen size={18} />} hint="Trong danh mục" />
          </StatLink>
        </Reveal>
        <Reveal delay={60}>
          <StatLink href="/librarian/readers">
            <StatCard label="Bạn đọc" value={<Figure value={readers.data} />} icon={<Users size={18} />} hint="Tài khoản đã đăng ký" />
          </StatLink>
        </Reveal>
        <Reveal delay={120}>
          <StatLink href="/admin/loans?status=ACTIVE">
            <StatCard label="Phiếu đang mượn" value={<Figure value={active.data} />} icon={<BookMarked size={18} />} hint="Chưa trả" />
          </StatLink>
        </Reveal>
        <Reveal delay={180}>
          <StatLink href="/admin/loans?overdue=true">
            <StatCard
              label="Phiếu quá hạn"
              value={<Figure value={overdueCount.data} />}
              tone={overdueCount.data ? "danger" : "default"}
              icon={<AlertTriangle size={18} />}
              hint="Cần nhắc bạn đọc"
            />
          </StatLink>
        </Reveal>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal className="xl:col-span-8">
          <Card className="h-full">
            <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
              <div>
                <h2 className="text-lg font-bold">Lượt mượn 12 tháng gần nhất</h2>
                <p className="mt-1 text-sm text-ink-soft">
                  {peak && peak.count > 0
                    ? `Cao nhất vào tháng ${peak.label} với ${peak.count.toLocaleString("vi-VN")} lượt.`
                    : "Số phiếu mượn được tạo mỗi tháng."}
                </p>
              </div>
              <p className="sm:text-right">
                <span className="block text-3xl font-bold tracking-tight">
                  {byMonth.isLoading ? <InlineSkeleton className="h-9 w-24" /> : <CountUp value={loansYear} />}
                </span>
                <span className="text-xs text-ink-faint">lượt trong 12 tháng</span>
              </p>
            </div>
            <div className="mt-5 h-64" role="img" aria-label="Biểu đồ cột số lượt mượn theo tháng">
              {byMonth.isLoading ? <ChartSkeleton /> : <MonthlyBarChart data={months} />}
            </div>
          </Card>
        </Reveal>

        <div className="grid grid-cols-1 gap-4 xl:col-span-4">
          <Reveal delay={80}>
            <Card className="h-full">
              <h2 className="text-lg font-bold">Bản sao còn trên kệ</h2>
              {inventory.isLoading ? (
                <Skeleton className="mt-4 h-36 w-full" />
              ) : (
                <div className="mt-4 flex items-center gap-5">
                  <ShelfRing fraction={totalCopies > 0 ? availableCopies / totalCopies : 0} />
                  <dl className="min-w-0 flex-1 space-y-2.5 text-sm">
                    <div>
                      <dt className="text-xs text-ink-faint">Sẵn sàng cho mượn</dt>
                      <dd className="text-lg font-bold tabular-nums">
                        {availableCopies.toLocaleString("vi-VN")}
                        <span className="text-sm font-medium text-ink-faint"> / {totalCopies.toLocaleString("vi-VN")}</span>
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-ink-soft">
                      <dt>Đang mượn</dt>
                      <dd className="font-semibold tabular-nums text-ink">{borrowedCopies.toLocaleString("vi-VN")}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-ink-soft">
                      <dt>Giữ, mất, bảo trì</dt>
                      <dd className="font-semibold tabular-nums text-ink">{offShelf.toLocaleString("vi-VN")}</dd>
                    </div>
                  </dl>
                </div>
              )}
            </Card>
          </Reveal>
          <Reveal delay={140}>
            <StatLink href="/admin/fines?paid=false">
              <StatCard
                label="Khoản phạt chưa thu"
                value={<Figure value={unpaid.data} />}
                tone={unpaid.data ? "warn" : "default"}
                icon={<HandCoins size={18} />}
                hint="Bạn đọc còn nợ chưa mượn thêm được"
              />
            </StatLink>
          </Reveal>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal className="xl:col-span-8">
          <Card className="h-full !p-0">
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-3 pt-5 sm:px-6 sm:pt-6">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-bold">Bạn đọc đang quá hạn</h2>
                {overdueCount.data ? <StatusBadge tone="bad">{overdueCount.data.toLocaleString("vi-VN")} phiếu</StatusBadge> : null}
              </div>
              <ButtonLink href="/admin/loans?overdue=true" variant="soft">
                Xem tất cả
              </ButtonLink>
            </div>
            {overdue.isLoading ? (
              <div className="space-y-3 px-5 pb-6 sm:px-6">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12" />
                ))}
              </div>
            ) : overdueRows.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-6 pb-10 pt-4 text-center">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-leaf-soft text-leaf">
                  <CheckCircle2 size={24} aria-hidden="true" />
                </span>
                <p className="font-bold">Mọi bạn đọc đều đúng hạn</p>
                <p className="max-w-sm text-sm text-ink-soft">Hiện không có phiếu nào quá hạn. Danh sách này sẽ hiện ở đây khi có.</p>
              </div>
            ) : (
              <div className="relative overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm [&_tbody>tr+tr]:border-t [&_tbody>tr+tr]:border-line/80 [&_tbody>tr:hover]:bg-paper/90">
                  <caption className="sr-only">Phiếu mượn quá hạn gần đây</caption>
                  <thead>
                    <tr>
                      <Th>Bạn đọc</Th>
                      <Th>Sách</Th>
                      <Th>Hạn trả</Th>
                      <Th>Trễ</Th>
                      <Th align="right">Phạt ước tính</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {overdueRows.map((row) => (
                      <tr key={row.loanId}>
                        <Td className="whitespace-nowrap">
                          <span className="font-semibold">{row.user.fullName}</span>
                          <span className="block text-xs text-ink-faint">{row.user.memberCode}</span>
                        </Td>
                        <Td className="min-w-[11rem] max-w-[16rem]">
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
              </div>
            )}
          </Card>
        </Reveal>

        <Reveal delay={80} className="xl:col-span-4">
          <Card className="h-full">
            <h2 className="text-lg font-bold">Sách mượn nhiều nhất</h2>
            {topBooks.isLoading ? (
              <div className="mt-4 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12" />
                ))}
              </div>
            ) : (topBooks.data ?? []).length === 0 ? (
              <p className="mt-4 text-sm text-ink-soft">Chưa có lượt mượn nào để xếp hạng.</p>
            ) : (
              <ol className="mt-4 space-y-1">
                {(topBooks.data ?? []).map((row, index) => (
                  <li key={row.book.id}>
                    <Link
                      href={`/books/${row.book.id}`}
                      className="group flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-paper"
                    >
                      <span
                        className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-sm font-bold tabular-nums ${RANK_STYLE[index] ?? RANK_STYLE[4]}`}
                      >
                        {index + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-2 text-sm font-semibold group-hover:text-primary-ink">{row.book.title}</span>
                        <span className="mt-1.5 block">
                          <GrowBar fraction={row.loanCount / topMax} delay={index * 70} />
                        </span>
                      </span>
                      <span className="shrink-0 text-sm font-semibold tabular-nums text-ink-soft">{row.loanCount} lượt</span>
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </Reveal>
      </div>
    </div>
  );
}
