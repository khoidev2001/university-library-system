import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell, authLinkClass } from "@/components/auth-shell";
import { LoginForm } from "@/components/login-form";

export const metadata: Metadata = {
  title: "Đăng nhập",
  description: "Đăng nhập để xem sách đang mượn, gia hạn trực tuyến và theo dõi tiền phạt.",
  alternates: { canonical: "/login" },
  robots: { index: false, follow: true },
};

export default function LoginPage() {
  return (
    <AuthShell
      title="Đăng nhập"
      description="Chào mừng trở lại. Dùng tài khoản thư viện đã cấp để xem sách đang mượn và gia hạn trực tuyến."
      footer={
        <>
          Chưa có tài khoản?
          <Link href="/register" className={authLinkClass}>
            Đăng ký bạn đọc
          </Link>
        </>
      }
    >
      <LoginForm />
    </AuthShell>
  );
}
