"use client";

import { usePathname } from "next/navigation";
import { Lock, ShieldAlert } from "lucide-react";
import type { Role } from "@/lib/types";
import { useAuth } from "@/lib/auth";
import { ButtonLink, Skeleton } from "./ui";

/** Chặn truy cập phía giao diện; quyền thật vẫn do backend kiểm (RolesGuard). */
export function RequireRole({ roles, children }: { roles: Role[]; children: React.ReactNode }) {
  const { user, loading, can } = useAuth();
  const pathname = usePathname();

  if (loading) {
    return (
      <div role="status" aria-label="Đang kiểm tra quyền truy cập" className="mx-auto max-w-5xl space-y-4 px-4 py-10 sm:px-6">
        <Skeleton className="skeleton-shimmer h-10 w-64" />
        <Skeleton className="skeleton-shimmer h-5 w-96 max-w-full" />
        <Skeleton className="skeleton-shimmer mt-6 h-48 w-full rounded-[1.25rem]" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center sm:px-6">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary-soft text-primary" aria-hidden="true">
          <Lock size={26} />
        </span>
        <h1 className="mt-5 text-2xl font-bold">Cần đăng nhập</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">Trang này chỉ dành cho người dùng đã đăng nhập.</p>
        <div className="mt-7 flex justify-center">
          <ButtonLink href={`/login?next=${encodeURIComponent(pathname)}`}>Đăng nhập</ButtonLink>
        </div>
      </div>
    );
  }

  if (!can(...roles)) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center sm:px-6">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-danger-soft text-danger" aria-hidden="true">
          <ShieldAlert size={26} />
        </span>
        <h1 className="mt-5 text-2xl font-bold">Không có quyền truy cập</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">
          Tài khoản của bạn không được phép xem trang này. Nếu cần quyền, hãy liên hệ quản trị thư viện.
        </p>
        <div className="mt-7 flex justify-center">
          <ButtonLink href="/" variant="ghost">
            Về trang chủ
          </ButtonLink>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

