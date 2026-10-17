import type { Metadata } from "next";
import { NotFoundArt } from "@/components/public/not-found-art";
import { SearchForm } from "@/components/search-form";
import { ButtonLink } from "@/components/ui";

export const metadata: Metadata = {
  title: "Không tìm thấy trang",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <div className="bg-aurora">
      <div className="mx-auto max-w-2xl px-4 pb-20 pt-12 text-center sm:px-6 sm:pt-16">
        <NotFoundArt className="mx-auto h-auto w-full max-w-sm" />
        <h1 className="anim-rise mt-6 text-3xl font-bold tracking-tight sm:text-5xl">Cuốn này đã lạc khỏi kệ</h1>
        <p className="anim-rise-2 mx-auto mt-4 max-w-md text-base leading-relaxed text-ink-soft">
          Đường dẫn có thể đã thay đổi, hoặc cuốn sách bạn tìm không còn trong danh mục. Thử tìm lại bằng tên sách
          hoặc tác giả.
        </p>
        <div className="anim-rise-3 mx-auto mt-8 max-w-lg">
          <SearchForm size="compact" />
        </div>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <ButtonLink href="/">Về trang chủ</ButtonLink>
          <ButtonLink href="/books" variant="ghost">
            Duyệt danh mục
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
