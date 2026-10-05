import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "@/components/login-form";

export const metadata: Metadata = {
  title: "Đăng nhập",
  description: "Đăng nhập để xem sách đang mượn, gia hạn trực tuyến và theo dõi tiền phạt.",
  alternates: { canonical: "/login" },
  robots: { index: false, follow: true },
};

export default function LoginPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col justify-center px-4 py-16 sm:px-6">
      <h1 className="font-serif text-2xl font-bold">Đăng nhập</h1>
      <p className="mt-2 text-sm text-ink-soft">
        Dùng tài khoản thư viện đã cấp. Chưa có tài khoản?{" "}
        <Link href="/register" className="font-medium text-brand hover:underline">
          Đăng ký bạn đọc
        </Link>
        .
      </p>
      <div className="mt-7 rounded-xl border border-line bg-white p-6 shadow-sm">
        <LoginForm />
      </div>
    </div>
  );
}
