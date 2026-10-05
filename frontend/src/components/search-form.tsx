"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

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
      className="flex w-full gap-2"
    >
      <div className="relative flex-1">
        <Search
          size={large ? 20 : 16}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint"
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
          placeholder="Tìm theo tên sách, tác giả hoặc ISBN"
          className={`w-full rounded-lg border border-line bg-white outline-none transition-colors placeholder:text-ink-faint focus:border-ink ${
            large ? "py-4 pl-11 pr-4 text-base" : "py-2.5 pl-9 pr-3 text-sm"
          }`}
        />
      </div>
      <button
        type="submit"
        className={`shrink-0 rounded-lg bg-ink font-medium text-paper transition-colors hover:bg-ink/90 ${
          large ? "px-6 text-base" : "px-4 text-sm"
        }`}
      >
        Tìm
      </button>
    </form>
  );
}
