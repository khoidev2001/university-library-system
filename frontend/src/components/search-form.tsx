"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import "./public/public.css";

/**
 * Ô tìm kiếm. Dạng `large` là nhân vật chính của trang chủ (bo tròn lớn, bóng nổi);
 * dạng `compact` dùng ở trang tra cứu. Viền focus hiện trên cả khung để thấy rõ khi dùng bàn phím.
 */
export function SearchForm({
  defaultValue = "",
  size = "large",
  autoFocus = false,
}: {
  defaultValue?: string;
  size?: "large" | "compact";
  autoFocus?: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState(defaultValue);
  const large = size === "large";

  return (
    <form
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        const query = value.trim();
        router.push(query ? `/books?q=${encodeURIComponent(query)}` : "/books");
      }}
      className={`flex w-full items-center gap-2 bg-white ring-1 ring-line transition-shadow focus-within:ring-2 focus-within:ring-primary ${
        large
          ? "rounded-[1.75rem] p-2 shadow-[var(--shadow-lift)]"
          : "rounded-2xl p-1.5 shadow-[var(--shadow-card)]"
      }`}
    >
      <div className="relative min-w-0 flex-1">
        <Search
          size={large ? 22 : 18}
          className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-primary ${large ? "left-4" : "left-3.5"}`}
          aria-hidden="true"
        />
        <label htmlFor="o-tim-kiem" className="sr-only">
          Tìm theo tên sách, tác giả hoặc ISBN
        </label>
        <input
          id="o-tim-kiem"
          type="search"
          name="q"
          value={value}
          autoFocus={autoFocus}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Tên sách, tác giả, ISBN"
          className={`search-input w-full rounded-xl bg-transparent text-ink outline-none placeholder:text-ink-faint [&::-webkit-search-cancel-button]:hidden ${
            large ? "h-12 pl-12 pr-3 text-base sm:text-lg" : "h-10 pl-10 pr-3 text-sm"
          }`}
        />
      </div>
      <button
        type="submit"
        aria-label="Tìm sách"
        className={`shrink-0 rounded-[1.25rem] bg-primary font-semibold text-white shadow-[0_8px_18px_-8px_rgb(79_70_229/0.8)] transition-[background-color,transform] duration-150 hover:bg-primary-hover active:scale-[0.97] ${
          large ? "h-12 px-6 text-base" : "h-10 rounded-xl px-5 text-sm"
        }`}
      >
        <span className="max-sm:hidden">Tìm sách</span>
        <span className="sm:hidden">Tìm</span>
      </button>
    </form>
  );
}
