import Link from "next/link";
import type { BookSummary } from "@/lib/types";
import { BookCover } from "./public/cover";

export { BookCover };

interface BookCardProps {
  book: Pick<BookSummary, "id" | "title" | "coverUrl" | "copiesAvailable" | "copiesTotal"> & {
    authors: { name: string }[] | string[];
    category?: { name: string };
    publishedYear?: number | null;
  };
}

/** Nhãn tình trạng: chấm màu cộng chữ, không chỉ dựa vào màu. */
export function AvailabilityTag({ available, total }: { available: number; total: number }) {
  const ok = available > 0;
  const tone = ok ? "bg-leaf-soft text-leaf" : "bg-amber-soft text-amber";
  const label = ok ? `Còn ${available}/${total} bản` : "Đã mượn hết";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-leaf" : "bg-amber"}`} aria-hidden="true" />
      {label}
    </span>
  );
}

export function BookCard({ book }: BookCardProps) {
  const authorNames = book.authors.map((author) => (typeof author === "string" ? author : author.name));

  return (
    <article className="group lift flex h-full flex-col rounded-[1.25rem] border border-line bg-white p-3 shadow-[var(--shadow-card)]">
      <Link href={`/books/${book.id}`} className="block rounded-xl">
        <div className="aspect-[2/3] overflow-hidden rounded-xl bg-paper-2 shadow-[0_12px_24px_-14px_rgb(21_26_51/0.55)]">
          <BookCover
            title={book.title}
            coverUrl={book.coverUrl}
            className="transition-transform duration-500 ease-out group-hover:scale-[1.04]"
          />
        </div>
        <h3 className="mt-3 line-clamp-2 min-h-[2.5rem] text-sm font-bold leading-snug transition-colors group-hover:text-primary">
          {book.title}
        </h3>
      </Link>
      <p className="mt-1 line-clamp-1 text-xs text-ink-soft">{authorNames.join(", ") || "Khuyết danh"}</p>
      <p className="mt-auto pt-3">
        <AvailabilityTag available={book.copiesAvailable} total={book.copiesTotal || book.copiesAvailable} />
      </p>
    </article>
  );
}
