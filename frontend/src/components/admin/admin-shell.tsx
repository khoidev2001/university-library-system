"use client";

import {
  BarChart3,
  BookMarked,
  BookOpen,
  Brain,
  FolderTree,
  HandCoins,
  LayoutDashboard,
  Bookmark,
  Library,
  ScrollText,
  Settings2,
  UserCog,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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

  const groups = GROUPS.map((group) => ({ ...group, items: group.items.filter((item) => can(item.role)) })).filter(
    (group) => group.items.length > 0,
  );
  const flat = groups.flatMap((group) => group.items);

  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[230px_minmax(0,1fr)]">
      <aside aria-label="Menu quản trị" className="min-w-0 lg:sticky lg:top-24 lg:self-start">
        <div className="mb-4 hidden items-center gap-2 lg:flex">
          <BookMarked size={18} aria-hidden="true" className="text-brand" />
          <span className="font-serif text-lg font-bold">Quản trị thư viện</span>
        </div>

        {/* Điện thoại: thanh cuộn ngang gọn thay cho cột bên */}
        <nav className="-mx-4 overflow-x-auto px-4 lg:hidden" aria-label="Điều hướng quản trị">
          <ul className="flex gap-2 pb-2">
            {flat.map((item) => (
              <li key={item.href} className="shrink-0">
                <Link
                  href={item.href}
                  aria-current={isActive(item.href) ? "page" : undefined}
                  className={`block rounded-full border px-3.5 py-1.5 text-sm ${
                    isActive(item.href)
                      ? "border-ink bg-ink text-paper"
                      : "border-line bg-white text-ink-soft hover:bg-paper-2"
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav className="hidden space-y-6 lg:block" aria-label="Điều hướng quản trị">
          {groups.map((group) => (
            <div key={group.title}>
              <p className="px-3 text-xs font-semibold uppercase tracking-[0.12em] text-ink-faint">{group.title}</p>
              <ul className="mt-2 space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
                          active ? "bg-ink font-medium text-paper" : "text-ink-soft hover:bg-paper-2 hover:text-ink"
                        }`}
                      >
                        <Icon size={16} aria-hidden={true} />
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

      <div className="min-w-0">{children}</div>
    </div>
  );
}
