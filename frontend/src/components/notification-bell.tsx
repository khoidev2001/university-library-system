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
  const { token, user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  const inbox = useQuery({
    queryKey: ["notifications"],
    queryFn: () => apiFetch<Inbox>("/notifications/me", { token }),
    // Tài khoản đang dùng mật khẩu tạm bị backend chặn mọi API ngoài đổi mật khẩu
    enabled: !!token && !user?.mustChangePassword,
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
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl text-ink-soft ring-1 ring-inset ring-line transition-colors hover:bg-paper-2 hover:text-ink"
      >
        <Bell size={16} aria-hidden="true" />
        {unread > 0 && (
          <span className="absolute -right-1.5 -top-1.5 grid min-w-5 place-items-center rounded-full bg-primary px-1 text-[11px] font-bold leading-5 tabular-nums text-white ring-2 ring-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="anim-sheet fixed inset-x-3 top-[5rem] z-50 overflow-hidden rounded-[1.25rem] border border-line bg-white shadow-[var(--shadow-lift)] sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-3 sm:w-[22rem]">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="text-base font-bold">Thông báo</h2>
            <button
              type="button"
              disabled={unread === 0 || readAll.isPending}
              onClick={() => readAll.mutate()}
              className="inline-flex min-h-10 items-center rounded-lg px-2 text-sm font-semibold text-primary hover:bg-primary-soft disabled:text-ink-faint disabled:hover:bg-transparent"
            >
              Đọc tất cả
            </button>
          </div>
          {items.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-primary-soft text-primary" aria-hidden="true">
                <Bell size={20} />
              </span>
              <p className="mt-3 text-sm font-semibold">Chưa có thông báo nào</p>
              <p className="mt-1 text-xs text-ink-faint">Nhắc hạn trả và tin từ thư viện sẽ hiện ở đây.</p>
            </div>
          ) : (
            <ul className="max-h-[26rem] divide-y divide-line overflow-y-auto overscroll-contain">
              {items.map((item) => {
                const content = (
                  <>
                    <span className="flex items-start justify-between gap-2">
                      <span className={`text-sm ${item.readAt ? "text-ink-soft" : "font-semibold"}`}>{item.title}</span>
                      {!item.readAt && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Chưa đọc" />}
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
                      <Link href={item.link} onClick={onOpen} className={`block px-4 py-3 hover:bg-paper-2 ${item.readAt ? "" : "bg-primary-soft/40"}`}>
                        {content}
                      </Link>
                    ) : (
                      <button type="button" onClick={onOpen} className={`block w-full px-4 py-3 text-left hover:bg-paper-2 ${item.readAt ? "" : "bg-primary-soft/40"}`}>
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
