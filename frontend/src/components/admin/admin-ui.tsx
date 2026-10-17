"use client";

import { AlertTriangle, BookOpen, CheckCircle2, ChevronLeft, ChevronRight, Search, X, XCircle } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/api";
import { Button, inputClass } from "../ui";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function errorText(error: unknown, fallback = "Có lỗi xảy ra, vui lòng thử lại."): string {
  return error instanceof ApiError ? error.friendlyMessage : fallback;
}

/* ------------------------------------------------------------------ */
/* Thông báo nổi (toast)                                               */
/* ------------------------------------------------------------------ */

type Notice = { tone: "good" | "bad"; text: string; id: number } | null;

/**
 * Thông báo kết quả thao tác: hiện nổi ở đáy màn hình, tự ẩn sau vài giây, đóng được bằng nút.
 * `node` đặt ở đâu trong trang cũng được vì thẻ nổi cố định theo màn hình.
 */
export function useNotice() {
  const [notice, setNotice] = useState<Notice>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const counter = useRef(0);

  const dismiss = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setNotice(null);
  }, []);

  const show = useCallback((tone: "good" | "bad", text: string) => {
    counter.current += 1;
    setNotice({ tone, text, id: counter.current });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setNotice(null), 6000);
  }, []);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const node = notice ? (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[70] flex justify-center px-4 print:hidden">
      <div
        key={notice.id}
        role="status"
        className={`anim-sheet pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-2xl border bg-white py-3 pl-4 pr-2 text-sm leading-relaxed shadow-[0_18px_40px_-12px_rgb(21_26_51/0.28)] ${
          notice.tone === "good" ? "border-leaf/25" : "border-danger/25"
        }`}
      >
        {notice.tone === "good" ? (
          <CheckCircle2 size={20} aria-hidden="true" className="mt-0.5 shrink-0 text-leaf" />
        ) : (
          <XCircle size={20} aria-hidden="true" className="mt-0.5 shrink-0 text-danger" />
        )}
        <p className="min-w-0 flex-1 py-0.5 text-ink">{notice.text}</p>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Đóng thông báo"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-ink-faint transition-colors hover:bg-paper-2 hover:text-ink"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  ) : null;

  return { show, node };
}

/* ------------------------------------------------------------------ */
/* Hộp thoại                                                           */
/* ------------------------------------------------------------------ */

export function Modal({
  title,
  onClose,
  children,
  wide = false,
  description,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
  description?: string;
}) {
  const dialog = useRef<HTMLDivElement>(null);
  // Giữ onClose mới nhất mà không chạy lại hiệu ứng (chạy lại sẽ kéo focus về ô đầu khi gõ)
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  // Hộp thoại đúng nghĩa: chuyển focus vào trong, giữ Tab trong hộp, khoá cuộn nền, trả focus khi đóng.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const body = document.body;
    const overflow = body.style.overflow;
    body.style.overflow = "hidden";
    const root = dialog.current;
    const first =
      root?.querySelector<HTMLElement>('input:not([type="hidden"]), select, textarea') ??
      root?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeRef.current();
        return;
      }
      if (event.key !== "Tab" || !root) return;
      const items = [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (items.length === 0) return;
      const head = items[0];
      const tail = items[items.length - 1];
      if (event.shiftKey && document.activeElement === head) {
        event.preventDefault();
        tail.focus();
      } else if (!event.shiftKey && document.activeElement === tail) {
        event.preventDefault();
        head.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, []);

  return (
    <div className="anim-fade fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-ink/45">
      {/* Bấm ra ngoài hộp thì đóng; hộp nằm trong lớp riêng để vùng bấm không đè lên nội dung */}
      <div className="flex min-h-full items-end justify-center sm:items-start sm:px-4 sm:py-12" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
        <div
          ref={dialog}
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className={`anim-sheet w-full rounded-t-[1.75rem] border border-line bg-white px-5 pb-6 pt-3 shadow-[0_30px_70px_-20px_rgb(21_26_51/0.45)] sm:rounded-[1.75rem] sm:px-7 sm:pb-7 sm:pt-6 ${
            wide ? "sm:max-w-3xl" : "sm:max-w-lg"
          }`}
        >
          <div aria-hidden="true" className="mx-auto mb-3 h-1 w-10 rounded-full bg-line sm:hidden" />
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-xl font-bold tracking-tight">{title}</h2>
              {description && <p className="mt-1 text-sm leading-relaxed text-ink-soft">{description}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng"
              className="-mr-2 -mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-xl text-ink-soft transition-colors hover:bg-paper-2 hover:text-ink"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
          <div className="mt-5">{children}</div>
        </div>
      </div>
    </div>
  );
}

/** Thông báo lỗi trong biểu mẫu của hộp thoại. */
export function FormError({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-sm leading-relaxed text-danger">
      {children}
    </p>
  );
}

/** Hàng nút cuối biểu mẫu: nút chính bên phải. */
export function FormActions({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap justify-end gap-2 pt-2">{children}</div>;
}

/* ------------------------------------------------------------------ */
/* Xác nhận hành động nguy hiểm                                        */
/* ------------------------------------------------------------------ */

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel: string;
  /** danger cho thao tác xoá hoặc mất dữ liệu; primary cho thao tác thường. */
  tone?: "danger" | "primary";
}

/**
 * Hộp xác nhận trong ứng dụng, thay cho window.confirm: cùng ý nghĩa (bấm đồng ý mới chạy),
 * nhưng đồng bộ giao diện, có tên hành động rõ ràng và nút nguy hiểm màu đỏ.
 */
export function useConfirm() {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const confirm = useCallback((next: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      resolver.current?.(false);
      resolver.current = resolve;
      setOptions(next);
    });
  }, []);

  const settle = (ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setOptions(null);
  };

  const dialog = options ? (
    <Modal title={options.title} onClose={() => settle(false)}>
      <div className="flex gap-3">
        <span
          aria-hidden="true"
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
            options.tone === "primary" ? "bg-primary-soft text-primary" : "bg-danger-soft text-danger"
          }`}
        >
          <AlertTriangle size={20} />
        </span>
        <p className="pt-1.5 text-sm leading-relaxed text-ink-soft">{options.message}</p>
      </div>
      <div className="mt-6 flex flex-wrap justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => settle(false)}>
          Huỷ
        </Button>
        <Button type="button" variant={options.tone === "primary" ? "primary" : "danger"} onClick={() => settle(true)}>
          {options.confirmLabel}
        </Button>
      </div>
    </Modal>
  ) : null;

  return { confirm, dialog };
}

/* ------------------------------------------------------------------ */
/* Thanh công cụ, ô tìm kiếm, bộ lọc                                   */
/* ------------------------------------------------------------------ */

/** Hàng thanh công cụ: ô tìm kiếm, bộ lọc và nút hành động. */
export function Toolbar({ children }: { children: React.ReactNode }) {
  return <div className="mt-6 flex flex-wrap items-center gap-3">{children}</div>;
}

/** Ô tìm kiếm có biểu tượng kính lúp; nhãn chỉ dành cho trình đọc màn hình. */
export function SearchInput({
  id,
  label,
  value,
  onChange,
  placeholder,
  className = "",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={`relative min-w-[220px] flex-1 ${className}`}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Search size={18} aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-faint" />
      <input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`${inputClass} ps-11`}
        placeholder={placeholder}
        autoComplete="off"
      />
    </div>
  );
}

/** Bộ lọc dạng thanh chọn một trong nhiều (tablist): mục đang chọn nổi lên trên nền xám nhạt. */
export function FilterTabs<T extends string>({
  label,
  value,
  onChange,
  items,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  items: { value: T; label: string }[];
}) {
  return (
    <div role="tablist" aria-label={label} className="inline-flex max-w-full flex-wrap gap-1 rounded-2xl bg-paper-2 p-1">
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            className={`min-h-10 rounded-xl px-4 text-sm transition-[background-color,color,box-shadow] duration-150 ${
              active
                ? "bg-white font-semibold text-primary-ink shadow-[0_1px_2px_rgb(21_26_51/0.08),0_2px_8px_-2px_rgb(79_70_229/0.25)]"
                : "font-medium text-ink-soft hover:text-ink"
            }`}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Phân trang                                                          */
/* ------------------------------------------------------------------ */

export function Pagination({
  page,
  total,
  limit,
  onPage,
}: {
  page: number;
  total: number;
  limit: number;
  onPage: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / limit));
  if (total === 0) return null;
  if (total <= limit) return <p className="mt-4 text-sm text-ink-faint tabular-nums">{total.toLocaleString("vi-VN")} kết quả</p>;
  const from = (page - 1) * limit + 1;
  const to = Math.min(total, page * limit);
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
      <p className="text-ink-faint tabular-nums">
        Trang <strong className="font-semibold text-ink">{page}</strong> / {pages} ({from.toLocaleString("vi-VN")} đến{" "}
        {to.toLocaleString("vi-VN")} trong {total.toLocaleString("vi-VN")} kết quả)
      </p>
      <div className="flex gap-2">
        <Button variant="ghost" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          <ChevronLeft size={16} aria-hidden="true" />
          Trang trước
        </Button>
        <Button variant="ghost" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Trang sau
          <ChevronRight size={16} aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Bảng                                                                */
/* ------------------------------------------------------------------ */

/** Chạy trước khi vẽ để nhãn thẻ có ngay ở khung hình đầu; phía máy chủ dùng useEffect cho khỏi cảnh báo. */
const useBeforePaint = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * Chuẩn bị bảng cho giao diện thẻ trên điện thoại (xem khối `.table-cards` trong globals.css).
 * - Chép chữ tiêu đề cột vào `data-label` của từng ô, ô nào cũng có nhãn dù bảng vẽ lại hay đổi trang.
 * - Gán vai trò ARIA tường minh: khi CSS đổi display của bảng, một số trình đọc màn hình sẽ bỏ ngữ nghĩa bảng,
 *   có role thì vẫn đọc là bảng có hàng và cột.
 */
function prepareTableCards(table: HTMLTableElement) {
  table.setAttribute("role", "table");
  const headRows = table.tHead ? [...table.tHead.rows] : [];
  const labels: string[] = [];
  const headRow = headRows[headRows.length - 1];
  if (headRow) {
    for (const cell of headRow.cells) {
      const text = (cell.textContent ?? "").replace(/\s+/g, " ").trim();
      for (let i = 0; i < Math.max(1, cell.colSpan); i++) labels.push(text);
    }
  }
  for (const group of [table.tHead, ...table.tBodies, table.tFoot]) group?.setAttribute("role", "rowgroup");
  for (const row of table.rows) {
    row.setAttribute("role", "row");
    let column = 0;
    for (const cell of row.cells) {
      const isHead = cell.tagName === "TH";
      cell.setAttribute("role", isHead ? "columnheader" : "cell");
      const label = cell.colSpan > 1 ? "" : (labels[column] ?? "");
      column += Math.max(1, cell.colSpan);
      if (!isHead && cell.getAttribute("data-label") !== label) cell.setAttribute("data-label", label);
    }
  }
}

/**
 * Khung bảng dữ liệu. Từ 640px trở lên là bảng cuộn ngang như thường; dưới 640px mỗi hàng thành một thẻ dọc
 * (CSS `.table-cards`), vẫn là các thẻ table/tr/td nên trình đọc màn hình đọc đúng là bảng.
 * `variant="plain"` dùng khi bảng nằm trong một thẻ (Card) có sẵn viền và nền.
 */
export function TableShell({
  children,
  minWidth = 640,
  label,
  maxHeight,
  variant = "card",
}: {
  children: React.ReactNode;
  minWidth?: number;
  /** Có nhãn thì vùng cuộn nhận được focus bàn phím (cuộn bằng phím mũi tên). */
  label?: string;
  /** Giới hạn chiều cao (px) để bảng dài cuộn bên trong, tiêu đề cột dính trên cùng. */
  maxHeight?: number;
  variant?: "card" | "plain";
}) {
  const scrollable = !!label || !!maxHeight;
  const table = useRef<HTMLTableElement>(null);

  useBeforePaint(() => {
    const node = table.current;
    if (!node) return;
    prepareTableCards(node);
    // Hàng mới (đổi trang, tải lại, thêm dòng) có thể do thành phần con vẽ, nên theo dõi cả nhánh con.
    const observer = new MutationObserver(() => prepareTableCards(node));
    observer.observe(node, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return (
    <div
      className={`table-cards-shell relative overflow-auto ${
        variant === "plain" ? "table-cards-tinted" : "rounded-[1.25rem] border border-line bg-white shadow-[var(--shadow-card)]"
      }`}
      style={maxHeight ? { maxHeight } : undefined}
      {...(scrollable ? { role: "region", "aria-label": label ?? "Bảng dữ liệu, cuộn để xem hết", tabIndex: 0 } : {})}
    >
      <table
        ref={table}
        className="table-cards w-full text-sm [&_tbody>tr+tr]:border-t [&_tbody>tr+tr]:border-line/80 [&_tbody>tr]:transition-colors [&_tbody>tr:hover]:bg-paper/90"
        style={{ minWidth }}
      >
        {children}
      </table>
    </div>
  );
}

/**
 * Cách một ô hiện trên điện thoại (dưới 640px), không đổi gì ở màn hình rộng:
 * - `title`: dòng chính của thẻ, không nhãn, lên đầu thẻ;
 * - `actions`: hàng nút bấm rộng hết thẻ ở cuối thẻ;
 * - `full`: nhãn nằm trên, nội dung chiếm hết chiều rộng thẻ;
 * - `select`: ô chọn dòng, nằm góc trên bên phải thẻ.
 */
export type CardRole = "title" | "actions" | "full" | "select";

export function Th({
  children,
  align = "left",
  card,
}: {
  children?: React.ReactNode;
  align?: "left" | "right";
  card?: CardRole;
}) {
  return (
    <th
      scope="col"
      data-card={card}
      className={`sticky top-0 z-[1] whitespace-nowrap border-b border-line bg-paper px-4 py-3 text-xs font-semibold text-ink-faint ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  align = "left",
  className = "",
  card,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement> & { align?: "left" | "right"; card?: CardRole }) {
  return (
    <td {...props} data-card={card} className={`px-4 py-3.5 align-middle ${align === "right" ? "text-right" : "text-left"} ${className}`}>
      <div className="td-body">{children}</div>
    </td>
  );
}

/** Dòng bảng hiện lần lượt từ trên xuống (chỉ transform và opacity, tối đa 12 dòng đầu). */
export function Tr({ index = 0, children, className = "" }: { index?: number; children: React.ReactNode; className?: string }) {
  return (
    <tr
      className={`anim-rise ${className}`}
      style={{ animationDelay: `${Math.min(index, 11) * 28}ms`, animationDuration: "320ms" }}
    >
      {children}
    </tr>
  );
}

/** Khung chờ cho bảng: đúng số dòng nên trang không nhảy khi dữ liệu về. */
export function TableSkeleton({ rows = 8, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div
      role="status"
      aria-label="Đang tải dữ liệu"
      className="overflow-hidden rounded-[1.25rem] border border-line bg-white shadow-[var(--shadow-card)] max-sm:space-y-3 max-sm:overflow-visible max-sm:border-0 max-sm:bg-transparent max-sm:shadow-none"
    >
      <div className="flex gap-6 border-b border-line bg-paper px-4 py-3.5 max-sm:hidden">
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className="skeleton-shimmer h-3 flex-1 rounded-full bg-paper-2" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          className="flex items-center gap-6 border-b border-line/70 px-4 py-4 last:border-b-0 max-sm:flex-col max-sm:items-stretch max-sm:gap-3 max-sm:rounded-[1.25rem] max-sm:border max-sm:border-line max-sm:bg-white max-sm:p-4"
        >
          {Array.from({ length: cols }).map((_, c) => (
            <div key={c} className={`skeleton-shimmer h-4 flex-1 rounded-full bg-paper-2 max-sm:flex-none ${c === 0 ? "max-w-[34%] max-sm:max-w-[60%]" : ""}`} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Khung chờ nằm trong dòng chữ (dùng được bên trong thẻ p, không sinh thẻ div sai chuẩn HTML). */
export function InlineSkeleton({ className = "h-8 w-20" }: { className?: string }) {
  return <span aria-hidden="true" className={`inline-block animate-pulse rounded-xl bg-paper-2 align-middle ${className}`} />;
}

/** Khung chờ cho danh sách dọc. */
export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Đang tải dữ liệu" className="mt-4 space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton-shimmer h-12 rounded-xl bg-paper-2" />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Thành phần nhỏ dùng chung                                           */
/* ------------------------------------------------------------------ */

type Tone = "neutral" | "good" | "warn" | "bad" | "info";

const STATUS_TONES: Record<Tone, string> = {
  neutral: "bg-paper-2 text-ink-soft",
  good: "bg-leaf-soft text-leaf",
  warn: "bg-amber-soft text-amber",
  bad: "bg-danger-soft text-danger",
  info: "bg-primary-soft text-primary-ink",
};

/** Huy hiệu trạng thái có chấm màu phía trước (màu không phải dấu hiệu duy nhất: luôn kèm chữ). */
export function StatusBadge({ tone = "neutral", children }: { tone?: Tone; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_TONES[tone]}`}>
      <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
      {children}
    </span>
  );
}

/** Lớp CSS của nút hành động nhỏ trong dòng bảng; dùng lại cho liên kết trông như nút. */
export function rowButtonClass(danger = false): string {
  return `inline-flex min-h-10 items-center justify-center whitespace-nowrap rounded-xl px-3.5 text-[0.8125rem] font-semibold ring-1 ring-inset transition-[background-color,color,transform] duration-150 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-45 ${
    danger
      ? "text-danger ring-danger/20 hover:bg-danger-soft"
      : "bg-white text-ink-soft ring-line hover:bg-primary-soft hover:text-primary-ink hover:ring-primary/20"
  }`;
}

/** Nút hành động nhỏ trong dòng bảng; `danger` cho thao tác xoá hoặc không hoàn tác được. */
export function RowButton({
  children,
  danger = false,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { danger?: boolean }) {
  return (
    <button type="button" {...props} className={rowButtonClass(danger)}>
      {children}
    </button>
  );
}

const AVATAR_TONES = [
  "bg-primary-soft text-primary-ink",
  "bg-mint-soft text-leaf",
  "bg-amber-soft text-amber",
  "bg-paper-2 text-ink-soft",
];

/** Ảnh đại diện chữ cái đầu, màu cố định theo tên để cùng một người luôn cùng màu. */
export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const parts = name.trim().split(/\s+/);
  const initials = ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "")).toUpperCase();
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size }}
      className={`grid shrink-0 place-items-center rounded-full text-xs font-bold ${AVATAR_TONES[hash % AVATAR_TONES.length]}`}
    >
      {initials || "?"}
    </span>
  );
}

/** Ảnh bìa thu nhỏ; ảnh hỏng hoặc không có thì hiện ô biểu tượng sách. */
export function BookThumb({ coverUrl, title }: { coverUrl: string | null; title: string }) {
  const [broken, setBroken] = useState(false);
  return (
    <span className="grid h-14 w-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-primary-soft text-primary ring-1 ring-line">
      {coverUrl && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={coverUrl}
          alt=""
          loading="lazy"
          decoding="async"
          width={40}
          height={56}
          onError={() => setBroken(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <BookOpen size={16} aria-hidden="true" />
      )}
      <span className="sr-only">{title}</span>
    </span>
  );
}

/** Thanh tiến độ ngang: co giãn bằng transform nên mượt, tự chạy từ 0 khi hiện ra. */
export function GrowBar({
  fraction,
  delay = 0,
  className = "bg-primary",
  track = "bg-paper-2",
}: {
  fraction: number;
  delay?: number;
  className?: string;
  track?: string;
}) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setOn(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const clamped = Math.max(0, Math.min(1, fraction));
  return (
    <div aria-hidden="true" className={`h-1.5 w-full overflow-hidden rounded-full ${track}`}>
      <div
        className={`h-full w-full origin-left rounded-full transition-transform duration-[700ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] ${className}`}
        style={{ transform: `scaleX(${on ? clamped : 0})`, transitionDelay: `${delay}ms` }}
      />
    </div>
  );
}
