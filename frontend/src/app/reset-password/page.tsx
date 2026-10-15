import type { Metadata } from "next";
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
    <div className="mx-auto flex max-w-md flex-col justify-center px-4 py-16 sm:px-6">
      <h1 className="font-serif text-2xl font-bold">Đặt lại mật khẩu</h1>
      <p className="mt-2 text-sm text-ink-soft">Chọn mật khẩu mới cho tài khoản của bạn.</p>
      <div className="mt-7 rounded-xl border border-line bg-white p-6 shadow-sm">
        <ResetPasswordForm />
      </div>
    </div>
  );
}
