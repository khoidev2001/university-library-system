import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { ResetPasswordForm } from "@/components/reset-password-form";

export const metadata: Metadata = {
  title: "Đặt lại mật khẩu",
  description: "Đặt mật khẩu mới cho tài khoản thư viện.",
  alternates: { canonical: "/reset-password" },
  // Liên kết chứa token: không để lộ qua Referer khi người dùng bấm sang trang khác
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

export default function ResetPasswordPage() {
  return (
    <AuthShell variant="recover" title="Đặt lại mật khẩu" description="Chọn mật khẩu mới cho tài khoản của bạn.">
      <ResetPasswordForm />
    </AuthShell>
  );
}
