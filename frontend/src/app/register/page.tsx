import type { Metadata } from "next";
import Link from "next/link";
import { RegisterForm } from "@/components/register-form";

export const metadata: Metadata = {
  title: "Đăng ký bạn đọc",
  description: "Tạo tài khoản bạn đọc để tra cứu, mượn và gia hạn sách tại thư viện trường.",
  alternates: { canonical: "/register" },
  robots: { index: false, follow: true },
};

export default function RegisterPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col justify-center px-4 py-16 sm:px-6">
      <h1 className="font-serif text-2xl font-bold">Đăng ký bạn đọc</h1>
      <p className="mt-2 text-sm text-ink-soft">
        Đã có tài khoản?{" "}
        <Link href="/login" className="font-medium text-brand hover:underline">
          Đăng nhập
        </Link>
        .
      </p>
      <div className="mt-7 rounded-xl border border-line bg-white p-6 shadow-sm">
        <RegisterForm />
      </div>
    </div>
  );
}
