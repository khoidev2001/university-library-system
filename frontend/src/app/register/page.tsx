import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell, authLinkClass } from "@/components/auth-shell";
import { RegisterForm } from "@/components/register-form";

export const metadata: Metadata = {
  title: "Đăng ký bạn đọc",
  description: "Tạo tài khoản bạn đọc để tra cứu, mượn và gia hạn sách tại thư viện trường.",
  alternates: { canonical: "/register" },
  robots: { index: false, follow: true },
};

export default function RegisterPage() {
  return (
    <AuthShell
      variant="join"
      title="Đăng ký bạn đọc"
      description="Tạo tài khoản bằng mã sinh viên hoặc mã giảng viên để mượn, gia hạn và đặt trước sách."
      footer={
        <>
          Đã có tài khoản?
          <Link href="/login" className={authLinkClass}>
            Đăng nhập
          </Link>
        </>
      }
    >
      <RegisterForm />
    </AuthShell>
  );
}
