import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { ForgotPasswordForm } from "@/components/forgot-password-form";

export const metadata: Metadata = {
  title: "Quên mật khẩu",
  description: "Nhận liên kết đặt lại mật khẩu tài khoản thư viện qua email.",
  alternates: { canonical: "/forgot-password" },
  robots: { index: false, follow: true },
};

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      variant="recover"
      title="Quên mật khẩu"
      description="Nhập email đã đăng ký, chúng tôi sẽ gửi liên kết để bạn đặt mật khẩu mới."
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
