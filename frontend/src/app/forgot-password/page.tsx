import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/forgot-password-form";

export const metadata: Metadata = {
  title: "Quên mật khẩu",
  description: "Nhận liên kết đặt lại mật khẩu tài khoản thư viện qua email.",
  alternates: { canonical: "/forgot-password" },
  robots: { index: false, follow: true },
};

export default function ForgotPasswordPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col justify-center px-4 py-16 sm:px-6">
      <h1 className="font-serif text-2xl font-bold">Quên mật khẩu</h1>
      <p className="mt-2 text-sm text-ink-soft">
        Nhập email đã đăng ký, chúng tôi sẽ gửi liên kết để bạn đặt mật khẩu mới.
      </p>
      <div className="mt-7 rounded-xl border border-line bg-white p-6 shadow-sm">
        <ForgotPasswordForm />
      </div>
    </div>
  );
}
