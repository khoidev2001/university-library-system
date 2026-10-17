import Link from "next/link";
import { BookCover } from "./cover";
import "./public.css";

export interface MarqueeBook {
  id: number;
  title: string;
  coverUrl: string | null;
}

/**
 * Dải bìa sách chạy ngang (kiểu marquee của Magic UI). Dựng hai bản liền nhau rồi dịch -50%
 * nên vòng lặp liền mạch. Dừng khi rê chuột hoặc khi một bìa đang được focus; bản sao bị ẩn khỏi trình đọc màn hình.
 */
export function CoverMarquee({ books }: { books: MarqueeBook[] }) {
  if (books.length < 6) return null;
  const doubled = [...books, ...books];

  return (
    <section aria-label="Một số cuốn sách trong thư viện" className="cover-marquee-mask cover-marquee-scroll overflow-hidden">
      <ul className="anim-marquee flex w-max gap-4 py-6 pr-4">
        {doubled.map((book, index) => {
          const copy = index >= books.length;
          return (
            <li key={`${book.id}-${index}`} aria-hidden={copy || undefined} className="w-[6.5rem] shrink-0 sm:w-28">
              <Link
                href={`/books/${book.id}`}
                tabIndex={copy ? -1 : undefined}
                className="block rounded-xl transition-transform duration-300 ease-out hover:-translate-y-2"
              >
                <div className="aspect-[2/3] overflow-hidden rounded-xl bg-paper-2 shadow-[0_14px_24px_-14px_rgb(21_26_51/0.55)]">
                  <BookCover title={book.title} coverUrl={book.coverUrl} />
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
