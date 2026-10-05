import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Không tìm thấy trang",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center sm:px-6">
      <p className="font-serif text-5xl font-bold text-ink-faint">404</p>
      <h1 className="mt-4 font-serif text-2xl font-bold">Không tìm thấy trang này</h1>
      <p className="mt-2 text-sm text-ink-soft">
        Đường dẫn có thể đã thay đổi, hoặc cuốn sách bạn tìm không còn trong danh mục.
      </p>
      <div className="mt-7 flex justify-center gap-3">
        <Link href="/" className="rounded-md bg-ink px-5 py-2.5 text-sm font-medium text-paper hover:bg-ink/90">
          Về trang chủ
        </Link>
        <Link href="/books" className="rounded-md border border-line bg-white px-5 py-2.5 text-sm font-medium hover:bg-paper-2">
          Tra cứu sách
        </Link>
      </div>
    </div>
  );
}
