"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { apiFetch, formatCurrency, formatDate } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { InventoryRow, MonthCount, OverdueRow, Page, TopBookRow } from "@/lib/types";
import { Badge, Card, PageHeading, Spinner } from "../ui";

/** Chỉ cần tổng số nên lấy 1 dòng cho nhẹ. */
function useTotal(key: string, path: string) {
  const { token } = useAuth();
  return useQuery({
    queryKey: ["admin-total", key],
    queryFn: async () => (await apiFetch<Page<unknown>>(path, { token })).total,
    enabled: !!token,
  });
}

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

  const totalCopies = (inventory.data ?? []).reduce((sum, row) => sum + row.total, 0);
  const availableCopies = (inventory.data ?? []).reduce((sum, row) => sum + row.available, 0);
  const months = (byMonth.data ?? []).map((row) => ({ ...row, label: `${row.month.slice(5)}/${row.month.slice(2, 4)}` }));
  const overdueRows = (overdue.data ?? []).slice(0, 6);

  const stats: { label: string; value: number | string | undefined; href: string; tone?: "bad" | "warn" }[] = [
    { label: "Đầu sách", value: books.data, href: "/admin/books" },
    {
      label: "Bản sao còn trên kệ",
      value: inventory.data ? `${availableCopies}/${totalCopies}` : undefined,
      href: "/admin/books",
    },
    { label: "Bạn đọc", value: readers.data, href: "/librarian/readers" },
    { label: "Phiếu đang mượn", value: active.data, href: "/admin/loans?status=ACTIVE" },
    { label: "Phiếu quá hạn", value: overdueCount.data, href: "/admin/loans?overdue=true", tone: "bad" },
    { label: "Khoản phạt chưa thu", value: unpaid.data, href: "/admin/fines?paid=false", tone: "warn" },
  ];

  return (
    <div>
      <PageHeading
        eyebrow="Quản trị"
        title="Bảng điều khiển"
        description={`Xin chào ${user?.fullName ?? ""}. Tình hình thư viện tại thời điểm hiện tại.`}
      />

      <ul className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3">
        {stats.map((stat) => {
          const highlight = typeof stat.value === "number" && stat.value > 0;
          return (
            <li key={stat.label}>
              <Link
                href={stat.href}
                className="block rounded-xl border border-line bg-white p-4 shadow-sm transition-colors hover:bg-paper-2"
              >
                <p className="text-xs text-ink-faint">{stat.label}</p>
                <p
                  className={`mt-1 font-serif text-2xl font-bold ${
                    highlight && stat.tone === "bad" ? "text-brand" : highlight && stat.tone === "warn" ? "text-amber" : ""
                  }`}
                >
                  {stat.value === undefined
                    ? "..."
                    : typeof stat.value === "number"
                      ? stat.value.toLocaleString("vi-VN")
                      : stat.value}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <h2 className="font-serif text-lg font-bold">Lượt mượn 12 tháng gần nhất</h2>
          {byMonth.isLoading ? (
            <Spinner />
          ) : (
            <div className="mt-4 h-64" role="img" aria-label="Biểu đồ cột số lượt mượn theo tháng">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={months} margin={{ left: -16, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2dcd0" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                  <Tooltip formatter={(value) => [value, "Lượt mượn"]} />
                  <Bar dataKey="count" fill="#16243c" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card>
          <h2 className="font-serif text-lg font-bold">Sách mượn nhiều nhất</h2>
          {topBooks.isLoading ? (
            <Spinner />
          ) : (
            <ol className="mt-3 space-y-2.5 text-sm">
              {(topBooks.data ?? []).map((row, index) => (
                <li key={row.book.id} className="flex items-baseline gap-3">
                  <span className="w-5 text-ink-faint">{index + 1}</span>
                  <Link href={`/books/${row.book.id}`} className="min-w-0 flex-1 truncate hover:underline">
                    {row.book.title}
                  </Link>
                  <span className="shrink-0 text-ink-soft">{row.loanCount} lượt</span>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>

      <Card className="mt-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-serif text-lg font-bold">Bạn đọc đang quá hạn</h2>
          <Link href="/admin/loans?overdue=true" className="text-sm text-brand hover:underline">
            Xem tất cả
          </Link>
        </div>
        {overdue.isLoading ? (
          <Spinner />
        ) : overdueRows.length === 0 ? (
          <p className="mt-3 text-sm text-ink-soft">Hiện không có phiếu nào quá hạn.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="text-left text-ink-faint">
                <tr>
                  <th scope="col" className="py-2 pr-4 font-medium">Bạn đọc</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Sách</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Hạn trả</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Trễ</th>
                  <th scope="col" className="py-2 text-right font-medium">Phạt ước tính</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {overdueRows.map((row) => (
                  <tr key={row.loanId}>
                    <td className="py-2.5 pr-4">
                      {row.user.fullName}
                      <span className="block text-xs text-ink-faint">{row.user.memberCode}</span>
                    </td>
                    <td className="py-2.5 pr-4">{row.book.title}</td>
                    <td className="py-2.5 pr-4 text-ink-soft">{formatDate(row.dueAt)}</td>
                    <td className="py-2.5 pr-4">
                      <Badge tone="bad">{row.overdueDays} ngày</Badge>
                    </td>
                    <td className="py-2.5 text-right font-medium">{formatCurrency(row.estimatedFine)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
