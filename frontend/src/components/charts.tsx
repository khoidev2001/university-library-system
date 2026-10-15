"use client";

/**
 * Các biểu đồ recharts gom một chỗ để tải lười: recharts nặng (~110 kB) và chỉ hai trang
 * thống kê dùng, nên không được lọt vào gói JS của các trang còn lại.
 * Tắt animation vẽ lại của recharts để không giật khi dữ liệu về.
 */
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { InventoryRow, MonthCount } from "@/lib/types";

const SLICE_COLORS = ["#8c3b24", "#2f6b52", "#a9701a", "#16243c", "#76818f", "#c2824f", "#4a7fa3", "#7a5ea8"];

export function MonthlyBarChart({ data, fill = "#16243c", detailed = false }: { data: MonthCount[]; fill?: string; detailed?: boolean }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={detailed ? { top: 5, right: 5, bottom: 5, left: -18 } : { left: -16, right: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2dcd0" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 12, fill: "#76818f" }}
          tickLine={false}
          axisLine={detailed ? false : undefined}
        />
        <YAxis tick={{ fontSize: 12, fill: "#76818f" }} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip
          contentStyle={{ borderRadius: 8, border: "1px solid #e2dcd0", fontSize: 13 }}
          labelFormatter={(label) => `Tháng ${label}`}
          formatter={(value) => [`${Number(value ?? 0).toLocaleString("vi-VN")} lượt`, "Lượt mượn"]}
        />
        <Bar dataKey="count" fill={fill} radius={[4, 4, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function InventoryPieChart({ data }: { data: InventoryRow[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          dataKey="total"
          nameKey="category.name"
          cx="50%"
          cy="50%"
          innerRadius={48}
          outerRadius={84}
          paddingAngle={2}
          isAnimationActive={false}
        >
          {data.map((row, index) => (
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
          formatter={(_value, entry) => (entry?.payload as unknown as InventoryRow)?.category?.name ?? ""}
          wrapperStyle={{ fontSize: 12 }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
