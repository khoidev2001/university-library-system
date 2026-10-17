"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LogOut, Menu, UserRound, X } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { SITE } from "@/lib/site";
import { Logo } from "./logo";
import { NotificationBell } from "./notification-bell";

interface NavItem {
  href: string;
  label: string;
  show: (can: ReturnType<typeof useAuth>["can"], signedIn: boolean) => boolean;
  mobileOnly?: boolean;
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
  // Chỉ hiện trong menu di động; trên màn hình rộng, tên người dùng ở góc phải dẫn tới đây
  { href: "/account", label: "Tài khoản của tôi", show: (_can, signedIn) => signedIn, mobileOnly: true },
];

export function SiteHeader() {
  const { user, logout, can, loading } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [raised, setRaised] = useState(false);

  // Đóng menu di động khi đổi trang
  useEffect(() => setOpen(false), [pathname]);

  // Thanh đầu trang đổ bóng khi cuộn: một lần đọc scrollY mỗi khung, không ép bố cục lại
  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        setRaised(window.scrollY > 8);
        ticking = false;
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const items = NAV.filter((item) => item.show(can, !!user));

  return (
    <header className="sticky top-0 z-40 px-3 pt-3 print:hidden sm:px-4">
      <div
        className={`mx-auto flex max-w-6xl items-center gap-3 rounded-[1.25rem] border bg-white/95 px-3 py-2 transition-shadow duration-300 sm:px-4 ${
          raised ? "border-line shadow-[0_10px_30px_-12px_rgb(21_26_51/0.22)]" : "border-line/70 shadow-[var(--shadow-card)]"
        }`}
      >
        <Link href="/" className="flex min-h-11 shrink-0 items-center gap-3 rounded-xl pr-2" aria-label={`Trang chủ ${SITE.shortName}`}>
          <Logo size={36} />
          <span className="hidden leading-tight sm:block">
            <span className="block text-[0.95rem] font-bold tracking-tight">{SITE.shortName}</span>
            <span className="block text-xs text-ink-faint">Đại học Xây dựng Miền Trung</span>
          </span>
        </Link>

        <nav aria-label="Điều hướng chính" className="ml-auto hidden items-center gap-1 lg:flex">
          {items
            .filter((item) => !item.mobileOnly)
            .map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`inline-flex min-h-10 items-center rounded-xl px-3.5 text-sm font-medium transition-colors ${
                    active ? "bg-primary-soft text-primary-ink" : "text-ink-soft hover:bg-paper-2 hover:text-ink"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
        </nav>

        <div className="ml-auto flex items-center gap-2 lg:ml-0">
          {!loading && user ? (
            <>
              <NotificationBell />
              <Link
                href="/account"
                aria-label={`Tài khoản của ${user.fullName}`}
                aria-current={pathname === "/account" ? "page" : undefined}
                className="hidden min-h-10 max-w-[12rem] items-center gap-2.5 rounded-xl py-1 pl-1 pr-3 transition-colors hover:bg-paper-2 sm:flex"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-white" aria-hidden="true">
                  {initials(user.fullName)}
                </span>
                <span className="min-w-0 text-left text-sm leading-tight">
                  <span className="block truncate font-semibold">{user.fullName}</span>
                  <span className="block text-xs text-ink-faint">{roleLabel(user.role)}</span>
                </span>
              </Link>
              <button
                type="button"
                onClick={logout}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-ink-soft ring-1 ring-inset ring-line transition-colors hover:bg-paper-2 hover:text-ink"
                aria-label="Đăng xuất"
                title="Đăng xuất"
              >
                <LogOut size={16} aria-hidden="true" />
              </button>
            </>
          ) : (
            !loading && (
              <Link
                href="/login"
                className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white shadow-[0_6px_16px_-6px_rgb(79_70_229/0.7)] transition-colors hover:bg-primary-hover"
              >
                <UserRound size={16} aria-hidden="true" />
                Đăng nhập
              </Link>
            )
          )}
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-ink-soft ring-1 ring-inset ring-line transition-colors hover:bg-paper-2 lg:hidden"
            aria-expanded={open}
            aria-controls="menu-di-dong"
            aria-label={open ? "Đóng menu" : "Mở menu"}
          >
            {open ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
          </button>
        </div>
      </div>

      {open && (
        <nav
          id="menu-di-dong"
          aria-label="Điều hướng di động"
          className="anim-menu mx-auto mt-2 max-w-6xl rounded-[1.25rem] border border-line bg-white p-2 shadow-[var(--shadow-lift)] lg:hidden"
          style={{ transformOrigin: "top right" }}
        >
          <ul className="grid gap-0.5">
            {items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`flex min-h-11 items-center rounded-xl px-4 text-sm font-medium ${
                      active ? "bg-primary-soft text-primary-ink" : "text-ink-soft hover:bg-paper-2 hover:text-ink"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </header>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const last = parts[parts.length - 1] ?? "";
  const first = parts.length > 1 ? parts[0] : "";
  return ((first[0] ?? "") + (last[0] ?? "")).toUpperCase() || "?";
}

function roleLabel(role: string): string {
  if (role === "ADMIN") return "Quản trị";
  if (role === "LIBRARIAN") return "Thủ thư";
  return "Bạn đọc";
}
