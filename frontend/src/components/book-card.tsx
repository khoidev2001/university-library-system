import Link from "next/link";
import type { BookSummary } from "@/lib/types";

interface BookCardProps {
  book: Pick<BookSummary, "id" | "title" | "coverUrl" | "copiesAvailable" | "copiesTotal"> & {
    authors: { name: string }[] | string[];
    category?: { name: string };
    publishedYear?: number | null;
  };
}

export function BookCover({
  title,
  coverUrl,
  className = "",
}: {
  title: string;
  coverUrl: string | null;
  className?: string;
}) {
  if (coverUrl) {
    return (
      // Ảnh bìa đến từ nhiều nguồn ngoài nên dùng thẻ img thường thay vì next/image
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={coverUrl}
        alt={`Bìa sách ${title}`}
        loading="lazy"
        decoding="async"
        width={200}
        height={300}
        className={`h-full w-full object-cover ${className}`}
      />
    );
  }
  return (
    <div
      className={`flex h-full w-full items-center justify-center bg-paper-2 p-3 ${className}`}
      role="img"
      aria-label={`Sách ${title} chưa có ảnh bìa`}
    >
      <span className="line-clamp-4 text-center font-serif text-xs leading-snug text-ink-faint">{title}</span>
    </div>
  );
}

export function AvailabilityTag({ available, total }: { available: number; total: number }) {
  const tone = available > 0 ? "bg-leaf-soft text-leaf" : "bg-brand-soft text-brand";
  const label = available > 0 ? `Còn ${available}/${total} bản` : "Đã mượn hết";
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${tone}`}>{label}</span>;
}

export function BookCard({ book }: BookCardProps) {
  const authorNames = book.authors.map((author) => (typeof author === "string" ? author : author.name));

  return (
    <article className="group cv-auto">
      <Link href={`/books/${book.id}`} className="block">
        <div className="aspect-[2/3] overflow-hidden rounded-lg border border-line bg-paper-2 shadow-sm transition-transform duration-200 group-hover:-translate-y-0.5">
          <BookCover title={book.title} coverUrl={book.coverUrl} className="transition-transform duration-300 group-hover:scale-[1.03]" />
        </div>
        <h3 className="mt-3 line-clamp-2 font-serif text-sm font-bold leading-snug group-hover:underline">
          {book.title}
        </h3>
      </Link>
      <p className="mt-1 line-clamp-1 text-xs text-ink-soft">{authorNames.join(", ") || "Khuyết danh"}</p>
      <p className="mt-1.5">
        <AvailabilityTag available={book.copiesAvailable} total={book.copiesTotal || book.copiesAvailable} />
      </p>
    </article>
  );
}
