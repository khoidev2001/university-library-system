"use client";

/**
 * Các biểu đồ recharts gom một chỗ để tải lười: recharts nặng (~110 kB) và chỉ hai trang
 * thống kê dùng, nên không được lọt vào gói JS của các trang còn lại.
 *
 * Chuyển động: cột mọc lên từ đáy bằng scaleY (transform, so le theo thứ tự cột), vòng tròn hiện bằng
 * scale + opacity; tắt animation vẽ lại của recharts (chạy bằng JS trên thuộc tính bố cục) cho nhẹ.
 * Màu lấy từ bảng màu của hệ thiết kế (primary, mint, tím, vàng...).
 */
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { InventoryRow, MonthCount } from "@/lib/types";

const INK_FAINT = "#5c6486";
const LINE = "#e4e7f3";

/** Bảng màu cho các lát tròn: bắt đầu bằng màu nhấn, tránh đỏ (đỏ dành cho lỗi). */
export const SLICE_COLORS = ["#4f46e5", "#14b8a6", "#8b5cf6", "#f59e0b", "#38bdf8", "#ec4899", "#84cc16", "#64748b"];

const BAR_KEYFRAMES = `
@keyframes chart-bar-grow { from { transform: scaleY(0); opacity: 0.4; } to { transform: scaleY(1); opacity: 1; } }
`;

interface BarShapeProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  index?: number;
  peak?: boolean;
}

/** Cột bo tròn hai góc trên, mọc từ đáy. Cột cao nhất đậm hơn, các cột khác nhạt để mắt dừng đúng chỗ. */
function RoundedBar({ x = 0, y = 0, width = 0, height = 0, index = 0, peak = false }: BarShapeProps) {
  if (height <= 0 || width <= 0) return null;
  const r = Math.min(10, width / 2, height);
  const d = `M${x},${y + height} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + width - r},${y} Q${x + width},${y} ${x + width},${y + r} L${x + width},${y + height} Z`;
  return (
    <path
      d={d}
      fill={peak ? "url(#bar-peak)" : "url(#bar-soft)"}
      style={{
        transformBox: "fill-box",
        transformOrigin: "50% 100%",
        animation: `chart-bar-grow 640ms ${index * 45}ms cubic-bezier(0.2, 0.8, 0.2, 1) both`,
      }}
    />
  );
}

function BarTip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ value?: number | string }>;
  label?: string | number;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm shadow-[0_12px_28px_-10px_rgb(21_26_51/0.3)]">
      <p className="text-xs text-ink-faint">Tháng {label}</p>
      <p className="mt-0.5 font-bold tabular-nums text-ink">
        {Number(payload[0].value ?? 0).toLocaleString("vi-VN")} <span className="font-medium text-ink-soft">lượt mượn</span>
      </p>
    </div>
  );
}

export function MonthlyBarChart({ data, detailed = false }: { data: MonthCount[]; detailed?: boolean }) {
  const max = data.reduce((m, row) => Math.max(m, row.count), 0);
  const peakIndex = max > 0 ? data.findIndex((row) => row.count === max) : -1;
  return (
    <>
      <style>{BAR_KEYFRAMES}</style>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: detailed ? -14 : -18 }} barCategoryGap="22%">
          <defs>
            <linearGradient id="bar-peak" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7c6cff" />
              <stop offset="100%" stopColor="#4f46e5" />
            </linearGradient>
            <linearGradient id="bar-soft" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.16" />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="2 5" stroke={LINE} vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 12, fill: INK_FAINT }}
            tickLine={false}
            axisLine={false}
            dy={6}
            interval={detailed ? 0 : "preserveStartEnd"}
            tickFormatter={detailed ? (value: string) => value.slice(0, 2) : undefined}
          />
          <YAxis tick={{ fontSize: 12, fill: INK_FAINT }} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip cursor={{ fill: "rgb(79 70 229 / 0.06)", radius: 10 }} content={<BarTip />} />
          <Bar
            dataKey="count"
            isAnimationActive={false}
            shape={(props: unknown) => {
              const p = props as BarShapeProps;
              return <RoundedBar {...p} peak={p.index === peakIndex} />;
            }}
          />
        </BarChart>
      </ResponsiveContainer>
    </>
  );
}

/** Vòng tròn tồn kho theo thể loại: tổng ở giữa, chú thích dạng danh sách kèm số bản và tỷ lệ. */
export function InventoryPieChart({ data }: { data: InventoryRow[] }) {
  const total = data.reduce((sum, row) => sum + row.total, 0);
  return (
    <div className="@container">
    <div className="flex flex-col items-center gap-5 @md:flex-row @md:gap-6">
      <div
        className="anim-pop relative h-44 w-44 shrink-0"
        role="img"
        aria-label={`Biểu đồ tròn tồn kho theo thể loại, tổng ${total.toLocaleString("vi-VN")} bản sao`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="total"
              nameKey="category.name"
              cx="50%"
              cy="50%"
              innerRadius={58}
              outerRadius={84}
              paddingAngle={3}
              cornerRadius={6}
              stroke="none"
              isAnimationActive={false}
            >
              {data.map((row, index) => (
                <Cell key={row.category.id} fill={SLICE_COLORS[index % SLICE_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ borderRadius: 12, border: `1px solid ${LINE}`, fontSize: 13, boxShadow: "0 12px 28px -10px rgb(21 26 51 / 0.3)" }}
              formatter={(value, _name, entry) => [
                `${Number(value ?? 0).toLocaleString("vi-VN")} bản`,
                (entry?.payload as unknown as InventoryRow)?.category?.name ?? "",
              ]}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="text-2xl font-bold tabular-nums">{total.toLocaleString("vi-VN")}</p>
            <p className="text-xs text-ink-faint">bản sao</p>
          </div>
        </div>
      </div>

      <ul className="grid w-full min-w-0 flex-1 gap-1 text-sm">
        {data.map((row, index) => (
          <li key={row.category.id} className="flex items-center gap-3 rounded-lg px-2 py-1.5">
            <span
              aria-hidden="true"
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: SLICE_COLORS[index % SLICE_COLORS.length] }}
            />
            <span className="min-w-0 flex-1 truncate text-ink-soft">{row.category.name}</span>
            <span className="shrink-0 font-semibold tabular-nums">{row.total.toLocaleString("vi-VN")}</span>
            <span className="w-11 shrink-0 text-right text-xs tabular-nums text-ink-faint">
              {total > 0 ? Math.round((row.total / total) * 100) : 0}%
            </span>
          </li>
        ))}
      </ul>
    </div>
    </div>
  );
}
