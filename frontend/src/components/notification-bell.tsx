"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { apiFetch, formatDate } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { AppNotification } from "@/lib/types";

interface Inbox {
  items: AppNotification[];
  unread: number;
}

/** Chuông thông báo ở thanh đầu trang: số chưa đọc, danh sách gần đây, đánh dấu đã đọc. */
export function NotificationBell() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  const inbox = useQuery({
    queryKey: ["notifications"],
    queryFn: () => apiFetch<Inbox>("/notifications/me", { token }),
    enabled: !!token,
    refetchInterval: 60_000,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["notifications"] });
  const readOne = useMutation({
    mutationFn: (id: number) => apiFetch(`/notifications/${id}/read`, { method: "POST", token }),
    onSuccess: refresh,
  });
  const readAll = useMutation({
    mutationFn: () => apiFetch("/notifications/read-all", { method: "POST", token }),
    onSuccess: refresh,
  });

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (box.current && !box.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const unread = inbox.data?.unread ?? 0;
  const items = inbox.data?.items ?? [];

  return (
    <div className="relative" ref={box}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={unread > 0 ? `Thông báo, ${unread} chưa đọc` : "Thông báo"}
        className="relative rounded-md border border-line p-2 text-ink-soft transition-colors hover:bg-paper-2 hover:text-ink"
      >
        <Bell size={16} aria-hidden="true" />
        {unread > 0 && (
          <span className="absolute -right-1.5 -top-1.5 grid min-w-[18px] place-items-center rounded-full bg-brand px-1 text-[10px] font-bold leading-[18px] text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="anim-pop absolute right-0 z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-line bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="text-sm font-bold">Thông báo</h2>
            <button
              type="button"
              disabled={unread === 0 || readAll.isPending}
              onClick={() => readAll.mutate()}
              className="text-xs text-brand hover:underline disabled:text-ink-faint disabled:no-underline"
            >
              Đọc tất cả
            </button>
          </div>
          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-ink-faint">Chưa có thông báo nào.</p>
          ) : (
            <ul className="max-h-96 divide-y divide-line overflow-y-auto overscroll-contain">
              {items.map((item) => {
                const content = (
                  <>
                    <span className="flex items-start justify-between gap-2">
                      <span className={`text-sm ${item.readAt ? "text-ink-soft" : "font-semibold"}`}>{item.title}</span>
                      {!item.readAt && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand" aria-label="Chưa đọc" />}
                    </span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-ink-soft">{item.body}</span>
                    <span className="mt-1 block text-[11px] text-ink-faint">{formatDate(item.createdAt)}</span>
                  </>
                );
                const onOpen = () => {
                  if (!item.readAt) readOne.mutate(item.id);
                  setOpen(false);
                };
                return (
                  <li key={item.id}>
                    {item.link ? (
                      <Link href={item.link} onClick={onOpen} className="block px-4 py-3 hover:bg-paper-2">
                        {content}
                      </Link>
                    ) : (
                      <button type="button" onClick={onOpen} className="block w-full px-4 py-3 text-left hover:bg-paper-2">
                        {content}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
