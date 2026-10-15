"use client";

import { X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
import { ApiError } from "@/lib/api";
import { Alert, Button } from "../ui";

export function errorText(error: unknown, fallback = "Có lỗi xảy ra, vui lòng thử lại."): string {
  return error instanceof ApiError ? error.friendlyMessage : fallback;
}

type Notice = { tone: "good" | "bad"; text: string } | null;

/** Thông báo kết quả thao tác, tự ẩn sau vài giây. */
export function useNotice() {
  const [notice, setNotice] = useState<Notice>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((tone: "good" | "bad", text: string) => {
    setNotice({ tone, text });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setNotice(null), 6000);
  }, []);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const node = notice ? (
    <div className="mt-5">
      <Alert tone={notice.tone}>{notice.text}</Alert>
    </div>
  ) : null;

  return { show, node };
}

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
  if (total <= limit) return <p className="mt-3 text-xs text-ink-faint">{total} kết quả</p>;
  return (
    <div className="mt-4 flex items-center justify-between gap-3 text-sm">
      <p className="text-ink-faint">
        Trang {page} / {pages} ({total} kết quả)
      </p>
      <div className="flex gap-2">
        <Button variant="ghost" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Trang trước
        </Button>
        <Button variant="ghost" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Trang sau
        </Button>
      </div>
    </div>
  );
}

export function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
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
    const first = root?.querySelector<HTMLElement>('input:not([type="hidden"]), select, textarea') ?? root?.querySelector<HTMLElement>(FOCUSABLE);
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
    <div className="fixed inset-0 z-50 flex items-start justify-center overscroll-contain anim-fade overflow-y-auto bg-ink/40 px-4 py-10">
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`anim-sheet w-full rounded-xl border border-line bg-paper p-6 shadow-xl ${wide ? "max-w-3xl" : "max-w-lg"}`}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 className="font-serif text-xl font-bold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="rounded-md p-1.5 text-ink-soft hover:bg-paper-2"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
}

/** Hàng thanh công cụ: ô tìm kiếm, bộ lọc và nút hành động. */
export function Toolbar({ children }: { children: React.ReactNode }) {
  return <div className="mt-6 flex flex-wrap items-end gap-3">{children}</div>;
}

export function TableShell({ children, minWidth = 640 }: { children: React.ReactNode; minWidth?: number }) {
  return (
    <div className="relative overflow-x-auto rounded-xl border border-line bg-white">
      <table className="w-full text-sm" style={{ minWidth }}>
        {children}
      </table>
    </div>
  );
}

export function Th({ children, align = "left" }: { children?: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th scope="col" className={`px-4 py-3 font-semibold ${align === "right" ? "text-right" : "text-left"}`}>
      {children}
    </th>
  );
}
