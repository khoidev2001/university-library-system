"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { apiFetch, formatCurrency, formatDate } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { InventoryRow, MonthCount, OverdueRow, TopBookRow } from "@/lib/types";
import { Badge, Card, PageHeading, Spinner } from "./ui";

const SLICE_COLORS = ["#8c3b24", "#2f6b52", "#a9701a", "#16243c", "#76818f", "#c2824f", "#4a7fa3", "#7a5ea8"];

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

  if (topBooks.isLoading || byMonth.isLoading) return <Spinner label="Đang tổng hợp số liệu" />;

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

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <PageHeading
        eyebrow="Báo cáo"
        title="Thống kê thư viện"
        description="Số liệu tổng hợp theo thời gian thực từ dữ liệu mượn trả."
      />

      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Chỉ số tổng quan">
        <StatTile label="Bản sao trong kho" value={totalCopies.toLocaleString("vi-VN")} />
        <StatTile label="Đang được mượn" value={borrowedCopies.toLocaleString("vi-VN")} />
        <StatTile label="Lượt mượn 12 tháng" value={totalLoansYear.toLocaleString("vi-VN")} />
        <StatTile
          label="Phiếu đang quá hạn"
          value={overdueRows.length.toLocaleString("vi-VN")}
          tone={overdueRows.length > 0 ? "bad" : "good"}
          hint={overdueRows.length > 0 ? `Phạt ước tính ${formatCurrency(estimatedFines)}` : undefined}
        />
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="font-serif text-lg font-bold">Lượt mượn theo tháng</h2>
          <p className="mt-1 text-sm text-ink-soft">Mười hai tháng gần nhất.</p>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={months} margin={{ top: 5, right: 5, bottom: 5, left: -18 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2dcd0" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#76818f" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 12, fill: "#76818f" }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: "1px solid #e2dcd0", fontSize: 13 }}
                  labelFormatter={(label) => `Tháng ${label}`}
                  formatter={(value) => [`${Number(value ?? 0).toLocaleString("vi-VN")} lượt`, "Lượt mượn"]}
                />
                <Bar dataKey="count" fill="#8c3b24" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <h2 className="font-serif text-lg font-bold">Tồn kho theo thể loại</h2>
          <p className="mt-1 text-sm text-ink-soft">Tám thể loại có nhiều bản sao nhất.</p>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={topInventory}
                  dataKey="total"
                  nameKey="category.name"
                  cx="50%"
                  cy="50%"
                  innerRadius={48}
                  outerRadius={84}
                  paddingAngle={2}
                >
                  {topInventory.map((row, index) => (
                    <Cell key={row.category.id} fill={SLICE_COLORS[index % SLICE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: "1px solid #e2dcd0", fontSize: 13 }}
                  formatter={(value, _name, entry) => [
                    `${Number(value ?? 0).toLocaleString("vi-VN")} bản`,
                    (entry?.payload as unknown as InventoryRow)?.category?.name ?? "",
                  ]}
                />
                <Legend
                  verticalAlign="bottom"
                  height={44}
                  formatter={(_value, entry) =>
                    (entry?.payload as unknown as InventoryRow)?.category?.name ?? ""
                  }
                  wrapperStyle={{ fontSize: 12 }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <section className="mt-10" aria-labelledby="tieu-de-top-sach">
        <h2 id="tieu-de-top-sach" className="font-serif text-xl font-bold">
          Sách được mượn nhiều nhất
        </h2>
        <ol className="mt-4 divide-y divide-line rounded-xl border border-line bg-white">
          {(topBooks.data ?? []).map((row, index) => (
            <li key={row.book.id} className="flex items-center gap-4 px-4 py-3">
              <span className="w-6 shrink-0 text-center font-serif text-lg font-bold text-ink-faint">
                {index + 1}
              </span>
              <Link href={`/books/${row.book.id}`} className="min-w-0 flex-1 truncate text-sm font-medium hover:underline">
                {row.book.title}
              </Link>
              <span className="shrink-0 text-sm text-ink-soft">{row.loanCount.toLocaleString("vi-VN")} lượt</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-10" aria-labelledby="tieu-de-bao-cao-qua-han">
        <h2 id="tieu-de-bao-cao-qua-han" className="font-serif text-xl font-bold">
          Bạn đọc đang quá hạn
        </h2>
        {overdueRows.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed border-line bg-white/60 px-5 py-8 text-center text-sm text-ink-soft">
            Không có bạn đọc nào quá hạn.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-line bg-white">
            <table className="w-full min-w-[720px] text-sm">
              <caption className="sr-only">Bạn đọc đang giữ sách quá hạn</caption>
              <thead className="border-b border-line bg-paper-2 text-left">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">Bạn đọc</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Sách</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Hạn trả</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Số ngày trễ</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Phạt ước tính</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {overdueRows.slice(0, 15).map((row) => (
                  <tr key={row.loanId}>
                    <td className="px-4 py-3">
                      <span className="font-medium">{row.user.fullName}</span>
                      <span className="block text-xs text-ink-faint">{row.user.memberCode}</span>
                    </td>
                    <td className="px-4 py-3">{row.book.title}</td>
                    <td className="px-4 py-3 text-ink-soft">{formatDate(row.dueAt)}</td>
                    <td className="px-4 py-3">
                      <Badge tone="bad">{row.overdueDays} ngày</Badge>
                    </td>
                    <td className="px-4 py-3 font-medium">{formatCurrency(row.estimatedFine)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {overdueRows.length > 15 && (
              <p className="border-t border-line px-4 py-3 text-xs text-ink-faint">
                Hiển thị 15 trên {overdueRows.length} phiếu quá hạn.
              </p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function StatTile({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "good" | "bad";
}) {
  const accent = tone === "bad" ? "text-brand" : tone === "good" ? "text-leaf" : "text-ink";
  return (
    <div className="rounded-xl border border-line bg-white p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">{label}</p>
      <p className={`mt-2 font-serif text-3xl font-bold ${accent}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-soft">{hint}</p>}
    </div>
  );
}
