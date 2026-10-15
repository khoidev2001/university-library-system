"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";

/**
 * Tài khoản đang dùng mật khẩu tạm (thủ thư vừa tạo / cấp lại) bị đưa tới trang tài khoản
 * cho tới khi đổi mật khẩu. Chốt thật nằm ở backend (403 PASSWORD_CHANGE_REQUIRED); đây chỉ để dễ dùng.
 */
export function PasswordChangeGate() {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const mustChange = !loading && !!user?.mustChangePassword;

  useEffect(() => {
    if (mustChange && pathname !== "/account") router.replace("/account?forced=1");
  }, [mustChange, pathname, router]);

  return null;
}
