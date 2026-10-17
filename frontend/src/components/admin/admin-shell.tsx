"use client";

import {
  BarChart3,
  Bookmark,
  BookOpen,
  Brain,
  FolderTree,
  HandCoins,
  LayoutDashboard,
  Library,
  ScrollText,
  Settings2,
  UserCog,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import type { Role } from "@/lib/types";
import { useAuth } from "@/lib/auth";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; "aria-hidden"?: boolean }>;
  role: Role;
}

const GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: "Tổng quan",
    items: [
      { href: "/admin", label: "Bảng điều khiển", icon: LayoutDashboard, role: "LIBRARIAN" },
      { href: "/reports", label: "Thống kê chi tiết", icon: BarChart3, role: "LIBRARIAN" },
    ],
  },
  {
    title: "Kho sách",
    items: [
      { href: "/admin/books", label: "Sách và bản sao", icon: BookOpen, role: "LIBRARIAN" },
      { href: "/admin/taxonomy", label: "Tác giả và thể loại", icon: FolderTree, role: "LIBRARIAN" },
    ],
  },
  {
    title: "Nghiệp vụ",
    items: [
      { href: "/librarian/desk", label: "Quầy mượn trả", icon: Library, role: "LIBRARIAN" },
      { href: "/admin/loans", label: "Phiếu mượn", icon: ScrollText, role: "LIBRARIAN" },
      { href: "/admin/reservations", label: "Đặt trước", icon: Bookmark, role: "LIBRARIAN" },
      { href: "/admin/fines", label: "Khoản phạt", icon: HandCoins, role: "LIBRARIAN" },
      { href: "/librarian/readers", label: "Bạn đọc", icon: Users, role: "LIBRARIAN" },
    ],
  },
  {
    title: "Hệ thống",
    items: [
      { href: "/admin/users", label: "Tài khoản nhân viên", icon: UserCog, role: "ADMIN" },
      { href: "/admin/policies", label: "Chính sách mượn", icon: Settings2, role: "ADMIN" },
      { href: "/admin/model", label: "Mô hình gợi ý", icon: Brain, role: "LIBRARIAN" },
    ],
  },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { can } = useAuth();
  const chipBar = useRef<HTMLUListElement>(null);

  const groups = GROUPS.map((group) => ({ ...group, items: group.items.filter((item) => can(item.role)) })).filter(
    (group) => group.items.length > 0,
  );
  const flat = groups.flatMap((group) => group.items);

  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`);

  // Điện thoại: đưa chip của trang đang xem vào giữa thanh cuộn ngang
  useEffect(() => {
    const bar = chipBar.current;
    const current = bar?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!bar || !current) return;
    bar.scrollTo({ left: current.offsetLeft - bar.clientWidth / 2 + current.clientWidth / 2, behavior: "auto" });
  }, [pathname, flat.length]);

  return (
    <div className="mx-auto grid max-w-[88rem] grid-cols-1 gap-5 px-4 pb-10 pt-3 sm:px-6 lg:grid-cols-[16.5rem_minmax(0,1fr)] lg:gap-8 lg:pt-6">
      <aside aria-label="Menu quản trị" className="min-w-0 max-lg:contents lg:sticky lg:top-24 lg:self-start">
        {/* Điện thoại và máy tính bảng: thanh chip cuộn ngang, dính dưới thanh đầu trang */}
        <nav
          className="sticky top-[4.75rem] z-30 -mx-4 bg-paper/95 px-4 py-2 sm:-mx-6 sm:px-6 lg:hidden"
          aria-label="Điều hướng quản trị"
        >
          <ul
            ref={chipBar}
            className="flex gap-2 overflow-x-auto pb-1 [mask-image:linear-gradient(to_right,#000_calc(100%-28px),transparent)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {flat.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <li key={item.href} className="shrink-0 last:pr-6">
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`inline-flex min-h-10 items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors ${
                      active
                        ? "bg-primary text-white shadow-[0_6px_14px_-6px_rgb(79_70_229/0.7)]"
                        : "bg-white text-ink-soft ring-1 ring-line hover:bg-primary-soft hover:text-primary-ink"
                    }`}
                  >
                    <Icon size={16} aria-hidden={true} />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Máy tính: cột bên dạng thẻ, dính khi cuộn */}
        <nav
          className="hidden max-h-[calc(100dvh-7.5rem)] overflow-y-auto rounded-[1.5rem] border border-line bg-white p-3 pt-1 shadow-[var(--shadow-card)] [scrollbar-width:thin] lg:block"
          aria-label="Điều hướng quản trị"
        >
          {groups.map((group) => (
            <div key={group.title}>
              <p className="px-3 pb-1 pt-3.5 text-xs font-semibold text-ink-faint">{group.title}</p>
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={`group flex min-h-10 items-center gap-3 rounded-xl px-2 py-1 text-sm transition-colors ${
                          active
                            ? "bg-primary-soft font-semibold text-primary-ink"
                            : "font-medium text-ink-soft hover:bg-paper hover:text-ink"
                        }`}
                      >
                        <span
                          className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg transition-colors ${
                            active
                              ? "bg-primary text-white"
                              : "bg-paper-2 text-ink-soft group-hover:bg-primary-soft group-hover:text-primary"
                          }`}
                        >
                          <Icon size={16} aria-hidden={true} />
                        </span>
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </aside>

      <div className="min-w-0 pb-4 lg:pb-0">{children}</div>
    </div>
  );
}
