"use client";

import { SlidersHorizontal, X } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

const FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Bộ lọc trên điện thoại: nút mở một ngăn kéo từ dưới lên. Nội dung bộ lọc là các liên kết do máy chủ dựng,
 * nên bấm vào là đổi trang; ngăn kéo tự đóng khi địa chỉ đổi. Có bẫy phím Tab, đóng bằng Esc, trả focus về nút mở.
 */
export function FilterDrawer({ activeCount, children }: { activeCount: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const panel = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    opener.current?.focus();
  }, []);

  // Đổi địa chỉ (chọn bộ lọc) thì đóng ngăn kéo
  useEffect(() => setOpen(false), [pathname, search]);

  useEffect(() => {
    if (!open) return;
    const previous = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    panel.current?.querySelector<HTMLElement>("button")?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
        return;
      }
      if (event.key !== "Tab" || !panel.current) return;
      const items = Array.from(panel.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.documentElement.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  return (
    <>
      <button
        ref={opener}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-ink ring-1 ring-inset ring-line transition-colors hover:bg-paper-2"
      >
        <SlidersHorizontal size={16} aria-hidden="true" />
        Bộ lọc
        {activeCount > 0 && (
          <span className="grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1.5 text-xs font-bold text-white">
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-50" role="presentation">
          <div className="anim-fade absolute inset-0 bg-ink/45" onClick={close} aria-hidden="true" />
          <div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-label="Bộ lọc sách"
            className="anim-sheet absolute inset-x-0 bottom-0 flex max-h-[88vh] flex-col rounded-t-[1.75rem] bg-white shadow-[0_-20px_50px_-20px_rgb(21_26_51/0.45)]"
          >
            <div className="flex items-center justify-between px-5 pb-2 pt-5">
              <h2 className="text-lg font-bold">Bộ lọc</h2>
              <button
                type="button"
                onClick={close}
                aria-label="Đóng bộ lọc"
                className="grid h-11 w-11 place-items-center rounded-xl text-ink-soft ring-1 ring-inset ring-line hover:bg-paper-2"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <div className="overflow-y-auto overscroll-contain px-5 pb-6">{children}</div>
            <div className="border-t border-line p-4">
              <button
                type="button"
                onClick={close}
                className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-white shadow-[0_6px_16px_-6px_rgb(79_70_229/0.7)] hover:bg-primary-hover"
              >
                Xem kết quả
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
