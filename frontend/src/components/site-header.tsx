"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { BookOpen, LogOut, Menu, UserRound, X } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { SITE } from "@/lib/site";
import { NotificationBell } from "./notification-bell";

interface NavItem {
  href: string;
  label: string;
  show: (can: ReturnType<typeof useAuth>["can"], signedIn: boolean) => boolean;
}

const NAV: NavItem[] = [
  { href: "/books", label: "Tra cứu sách", show: () => true },
  { href: "/recommendations", label: "Gợi ý cho bạn", show: (can) => can("READER") },
  { href: "/my/loans", label: "Sách của tôi", show: (can) => can("READER") },
  { href: "/my/reservations", label: "Đặt trước", show: (can) => can("READER") },
  { href: "/librarian/desk", label: "Quầy mượn trả", show: (can) => can("LIBRARIAN") },
  { href: "/librarian/readers", label: "Bạn đọc", show: (can) => can("LIBRARIAN") },
  { href: "/reports", label: "Thống kê", show: (can) => can("LIBRARIAN") },
  { href: "/admin", label: "Quản trị", show: (can) => can("LIBRARIAN") },
];

export function SiteHeader() {
  const { user, logout, can, loading } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const items = NAV.filter((item) => item.show(can, !!user));

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label={`Trang chủ ${SITE.shortName}`}>
          <span className="grid h-9 w-9 place-items-center rounded-md bg-ink text-paper">
            <BookOpen size={18} aria-hidden="true" />
          </span>
          <span className="hidden leading-tight sm:block">
            <span className="block font-serif text-base font-bold">Thư viện MUCE</span>
            <span className="block text-xs text-ink-faint">Đại học Xây dựng Miền Trung</span>
          </span>
        </Link>

        <nav aria-label="Điều hướng chính" className="ml-auto hidden items-center gap-1 lg:flex">
          {items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-md px-3 py-2 text-sm transition-colors ${
                  active ? "bg-paper-2 font-semibold text-ink" : "text-ink-soft hover:bg-paper-2 hover:text-ink"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2 lg:ml-0">
          {!loading && user ? (
            <div className="flex items-center gap-2">
              <NotificationBell />
              <span className="hidden text-right text-sm leading-tight sm:block">
                <span className="block font-medium">{user.fullName}</span>
                <span className="block text-xs text-ink-faint">{roleLabel(user.role)}</span>
              </span>
              <button
                type="button"
                onClick={logout}
                className="rounded-md border border-line p-2 text-ink-soft transition-colors hover:bg-paper-2 hover:text-ink"
                aria-label="Đăng xuất"
                title="Đăng xuất"
              >
                <LogOut size={16} aria-hidden="true" />
              </button>
            </div>
          ) : (
            !loading && (
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 rounded-md bg-ink px-3.5 py-2 text-sm font-medium text-paper transition-colors hover:bg-ink/90"
              >
                <UserRound size={15} aria-hidden="true" />
                Đăng nhập
              </Link>
            )
          )}
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="rounded-md border border-line p-2 text-ink-soft lg:hidden"
            aria-expanded={open}
            aria-controls="menu-di-dong"
            aria-label={open ? "Đóng menu" : "Mở menu"}
          >
            {open ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
          </button>
        </div>
      </div>

      {open && (
        <nav id="menu-di-dong" aria-label="Điều hướng di động" className="border-t border-line bg-paper lg:hidden">
          <ul className="mx-auto max-w-6xl px-4 py-2 sm:px-6">
            {items.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-md px-2 py-2.5 text-sm text-ink-soft hover:bg-paper-2 hover:text-ink"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}

function roleLabel(role: string): string {
  if (role === "ADMIN") return "Quản trị";
  if (role === "LIBRARIAN") return "Thủ thư";
  return "Bạn đọc";
}
