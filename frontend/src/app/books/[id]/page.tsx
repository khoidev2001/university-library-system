import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Star } from "lucide-react";
import { AvailabilityTag, BookCover } from "@/components/book-card";
import { RateBookPanel } from "@/components/rate-book-panel";
import { ReserveBookPanel } from "@/components/reserve-book-panel";
import { apiFetch } from "@/lib/api";
import { SITE } from "@/lib/site";
import type { BookDetail } from "@/lib/types";

// Tình trạng "còn mấy bản trên kệ" đổi theo từng lượt mượn trả, hiển thị sai là bạn đọc
// tới nơi mới biết hết sách. Vì vậy dựng trang theo từng yêu cầu thay vì cache.
export const dynamic = "force-dynamic";

async function getBook(id: string): Promise<BookDetail | null> {
  if (!/^\d+$/.test(id)) return null;
  try {
    return await apiFetch<BookDetail>(`/books/${id}`, { cache: "no-store" });
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const book = await getBook(id);
  if (!book) return { title: "Không tìm thấy sách", robots: { index: false, follow: false } };

  const authors = book.authors.map((author) => author.name).join(", ");
  const description =
    book.description?.slice(0, 200) ??
    `${book.title}${authors ? ` của ${authors}` : ""}, thể loại ${book.category.name}. Hiện còn ${book.copiesAvailable} trên ${book.copiesTotal} bản tại thư viện.`;

  return {
    title: book.title,
    description,
    alternates: { canonical: `/books/${book.id}` },
    openGraph: {
      type: "book",
      title: book.title,
      description,
      images: book.coverUrl ? [{ url: book.coverUrl, alt: `Bìa sách ${book.title}` }] : undefined,
    },
  };
}

export default async function BookDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const book = await getBook(id);
  if (!book) notFound();

  const authors = book.authors.map((author) => author.name);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Book",
    name: book.title,
    author: authors.map((name) => ({ "@type": "Person", name })),
    ...(book.isbn ? { isbn: book.isbn } : {}),
    ...(book.publisher ? { publisher: { "@type": "Organization", name: book.publisher } } : {}),
    ...(book.publishedYear ? { datePublished: String(book.publishedYear) } : {}),
    ...(book.description ? { description: book.description } : {}),
    ...(book.coverUrl ? { image: book.coverUrl } : {}),
    genre: book.category.name,
    inLanguage: "en",
    url: `${SITE.url}/books/${book.id}`,
    ...(book.ratingCount > 0 && book.ratingAvg
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: Number(book.ratingAvg.toFixed(2)),
            ratingCount: book.ratingCount,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
    offers: {
      "@type": "Offer",
      availability:
        book.copiesAvailable > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      price: 0,
      priceCurrency: "VND",
      seller: { "@type": "Library", name: SITE.name },
    },
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <nav aria-label="Đường dẫn" className="text-sm text-ink-faint">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href="/" className="inline-block py-2.5 hover:text-ink hover:underline">
              Trang chủ
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link href="/books" className="inline-block py-2.5 hover:text-ink hover:underline">
              Danh mục sách
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link href={`/books?categoryId=${book.category.id}`} className="inline-block py-2.5 hover:text-ink hover:underline">
              {book.category.name}
            </Link>
          </li>
        </ol>
      </nav>

      <article className="mt-6 grid grid-cols-1 gap-10 md:grid-cols-[260px_minmax(0,1fr)]">
        <div>
          <div className="aspect-[2/3] overflow-hidden rounded-xl border border-line bg-paper-2 shadow-sm">
            <BookCover title={book.title} coverUrl={book.coverUrl} />
          </div>
          <div className="mt-4 space-y-3 rounded-xl border border-line bg-white p-4">
            <AvailabilityTag available={book.copiesAvailable} total={book.copiesTotal} />
            <p className="text-sm text-ink-soft">
              {book.copiesAvailable > 0
                ? "Mang thẻ bạn đọc tới quầy để mượn cuốn này."
                : "Tất cả bản sao đang được mượn. Vui lòng quay lại sau."}
            </p>
          </div>
          <ReserveBookPanel bookId={book.id} available={book.copiesAvailable} />
        </div>

        <div>
          <h1 className="font-serif text-3xl font-bold leading-tight">{book.title}</h1>
          <p className="mt-2 text-base text-ink-soft">
            {authors.length > 0 ? authors.join(", ") : "Khuyết danh"}
          </p>

          {book.ratingCount > 0 && book.ratingAvg !== null && (
            <p className="mt-3 flex items-center gap-2 text-sm">
              <span className="flex" aria-hidden="true">
                {[1, 2, 3, 4, 5].map((value) => (
                  <Star
                    key={value}
                    size={16}
                    className={value <= Math.round(book.ratingAvg!) ? "fill-amber text-amber" : "text-line"}
                  />
                ))}
              </span>
              <span className="font-medium">{book.ratingAvg.toFixed(1)} trên 5</span>
              <span className="text-ink-faint">({book.ratingCount.toLocaleString("vi-VN")} lượt đánh giá)</span>
            </p>
          )}

          {book.description && (
            <section className="mt-6" aria-labelledby="tieu-de-gioi-thieu">
              <h2 id="tieu-de-gioi-thieu" className="font-serif text-lg font-bold">
                Giới thiệu
              </h2>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink-soft">{book.description}</p>
            </section>
          )}

          <section className="mt-8" aria-labelledby="tieu-de-thong-tin">
            <h2 id="tieu-de-thong-tin" className="font-serif text-lg font-bold">
              Thông tin xuất bản
            </h2>
            <dl className="mt-3 grid grid-cols-1 gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
              <Row label="Thể loại">
                <Link href={`/books?categoryId=${book.category.id}`} className="text-brand hover:underline">
                  {book.category.name}
                </Link>
              </Row>
              {book.publisher && <Row label="Nhà xuất bản">{book.publisher}</Row>}
              {book.publishedYear && <Row label="Năm xuất bản">{book.publishedYear}</Row>}
              {book.isbn && <Row label="ISBN">{book.isbn}</Row>}
              <Row label="Tổng số bản">{book.copiesTotal}</Row>
              <Row label="Đang còn">{book.copiesAvailable}</Row>
            </dl>
          </section>

          <RateBookPanel bookId={book.id} />
        </div>
      </article>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-line pb-2 sm:border-none sm:pb-0">
      <dt className="text-ink-faint">{label}</dt>
      <dd className="text-right font-medium sm:text-left">{children}</dd>
    </div>
  );
}
