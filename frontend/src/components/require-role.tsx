"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@/lib/types";
import { useAuth } from "@/lib/auth";
import { Spinner } from "./ui";

/** Chặn truy cập phía giao diện; quyền thật vẫn do backend kiểm (RolesGuard). */
export function RequireRole({ roles, children }: { roles: Role[]; children: React.ReactNode }) {
  const { user, loading, can } = useAuth();
  const pathname = usePathname();

  if (loading) return <Spinner label="Đang kiểm tra quyền truy cập" />;

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center sm:px-6">
        <h1 className="font-serif text-2xl font-bold">Cần đăng nhập</h1>
        <p className="mt-2 text-sm text-ink-soft">Trang này chỉ dành cho người dùng đã đăng nhập.</p>
        <Link
          href={`/login?next=${encodeURIComponent(pathname)}`}
          className="mt-6 inline-flex rounded-md bg-ink px-5 py-2.5 text-sm font-medium text-paper hover:bg-ink/90"
        >
          Đăng nhập
        </Link>
      </div>
    );
  }

  if (!can(...roles)) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center sm:px-6">
        <h1 className="font-serif text-2xl font-bold">Không có quyền truy cập</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Tài khoản của bạn không được phép xem trang này. Nếu cần quyền, hãy liên hệ quản trị thư viện.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex rounded-md border border-line bg-white px-5 py-2.5 text-sm font-medium hover:bg-paper-2"
        >
          Về trang chủ
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
