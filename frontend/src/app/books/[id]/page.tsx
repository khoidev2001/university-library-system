import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Barcode, Building2, CalendarDays, Layers, Library, Star } from "lucide-react";
import { AvailabilityTag, BookCard, BookCover } from "@/components/book-card";
import { TiltCover } from "@/components/public/tilt-cover";
import { RateBookPanel } from "@/components/rate-book-panel";
import { ReserveBookPanel } from "@/components/reserve-book-panel";
import { apiFetch } from "@/lib/api";
import { SITE } from "@/lib/site";
import type { BookDetail, BookSummary, Page } from "@/lib/types";

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

  // Sách cùng thể loại, ưu tiên cuốn còn trên kệ. Lỗi mạng thì chỉ ẩn mục này, không làm hỏng trang.
  const related = await apiFetch<Page<BookSummary>>(`/books?categoryId=${book.category.id}&limit=9`, { cache: "no-store" })
    .then((page) => page.items.filter((item) => item.id !== book.id).slice(0, 6))
    .catch(() => [] as BookSummary[]);

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

  const inStock = book.copiesAvailable > 0;
  const total = book.copiesTotal;
  const copyDots = Math.min(total, 12);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <nav aria-label="Đường dẫn" className="relative z-10 text-sm text-ink-faint">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href="/" className="inline-flex min-h-10 items-center hover:text-ink hover:underline">
              Trang chủ
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link href="/books" className="inline-flex min-h-10 items-center hover:text-ink hover:underline">
              Danh mục sách
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link
              href={`/books?categoryId=${book.category.id}`}
              className="inline-flex min-h-10 items-center hover:text-ink hover:underline"
            >
              {book.category.name}
            </Link>
          </li>
        </ol>
      </nav>

      <article className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[21rem_minmax(0,1fr)] lg:gap-14">
        <div className="relative">
          <div className="relative mx-auto w-full max-w-[13.5rem] sm:max-w-[16rem] lg:max-w-none lg:sticky lg:top-24">
            <div
              aria-hidden="true"
              className="anim-blob absolute -inset-4 rounded-[2.5rem] bg-primary-soft"
            />
            <TiltCover className="relative">
              <div className="aspect-[2/3] overflow-hidden rounded-2xl bg-paper-2 shadow-[0_40px_60px_-26px_rgb(21_26_51/0.6)] ring-1 ring-ink/5">
                <BookCover title={book.title} coverUrl={book.coverUrl} hiRes priority />
              </div>
            </TiltCover>
          </div>
        </div>

        <div className="min-w-0">
          <Link
            href={`/books?categoryId=${book.category.id}`}
            className="inline-flex min-h-10 items-center rounded-full bg-primary-soft px-4 text-sm font-semibold text-primary-ink hover:bg-primary/15"
          >
            {book.category.name}
          </Link>
          <h1 className="mt-3 text-3xl font-bold leading-[1.12] tracking-tight sm:text-5xl">{book.title}</h1>
          <p className="mt-3 text-lg text-ink-soft">{authors.length > 0 ? authors.join(", ") : "Khuyết danh"}</p>

          <div className="mt-4 flex min-h-6 flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            {book.ratingCount > 0 && book.ratingAvg !== null ? (
              <>
                <span className="flex gap-0.5" aria-hidden="true">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <Star
                      key={value}
                      size={18}
                      className={value <= Math.round(book.ratingAvg!) ? "fill-[#f59e0b] text-[#d97706]" : "text-[#c3c8de]"}
                    />
                  ))}
                </span>
                <span className="font-bold tabular-nums">{book.ratingAvg.toFixed(1)} trên 5</span>
                <span className="text-ink-faint">({book.ratingCount.toLocaleString("vi-VN")} lượt đánh giá)</span>
              </>
            ) : (
              <span className="text-ink-faint">Chưa có đánh giá nào</span>
            )}
          </div>

          <section
            aria-labelledby="tieu-de-tinh-trang"
            className={`mt-7 rounded-[1.5rem] border p-5 sm:p-6 ${
              inStock ? "border-leaf/15 bg-leaf-soft" : "border-amber/15 bg-amber-soft"
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 id="tieu-de-tinh-trang" className="sr-only">
                  Tình trạng trên kệ
                </h2>
                <p className={`text-4xl font-bold tabular-nums tracking-tight ${inStock ? "text-leaf" : "text-amber"}`}>
                  {book.copiesAvailable}
                  <span className="text-2xl text-ink-faint">/{total}</span>
                </p>
                <p className="mt-1 text-sm font-medium text-ink-soft">bản đang có trên kệ</p>
              </div>
              <AvailabilityTag available={book.copiesAvailable} total={total} />
            </div>

            {copyDots > 0 && (
              <ul className="mt-4 flex flex-wrap gap-1.5" aria-hidden="true">
                {Array.from({ length: copyDots }, (_, i) => (
                  <li
                    key={i}
                    className={`h-7 w-3.5 rounded-[0.3rem] ${
                      i < book.copiesAvailable ? (inStock ? "bg-leaf" : "bg-amber") : "bg-ink/10"
                    }`}
                  />
                ))}
                {total > copyDots && <li className="self-center pl-1 text-xs text-ink-faint">+{total - copyDots}</li>}
              </ul>
            )}

            <p className="mt-4 flex items-start gap-2 text-sm leading-relaxed text-ink-soft">
              <Library size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
              {inStock
                ? "Mang thẻ bạn đọc tới quầy thủ thư để mượn cuốn này."
                : "Tất cả bản sao đang được mượn. Vui lòng quay lại sau."}
            </p>
            <ReserveBookPanel bookId={book.id} available={book.copiesAvailable} />
          </section>

          <section className="mt-8" aria-labelledby="tieu-de-thong-tin">
            <h2 id="tieu-de-thong-tin" className="text-xl font-bold">
              Thông tin xuất bản
            </h2>
            <dl className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(11.5rem,1fr))] gap-3">
              <Fact icon={<Layers size={18} />} label="Thể loại">
                <Link href={`/books?categoryId=${book.category.id}`} className="inline-flex min-h-10 items-center text-primary hover:underline">
                  {book.category.name}
                </Link>
              </Fact>
              {book.publishedYear && (
                <Fact icon={<CalendarDays size={18} />} label="Năm xuất bản">
                  {book.publishedYear}
                </Fact>
              )}
              {book.publisher && (
                <Fact icon={<Building2 size={18} />} label="Nhà xuất bản">
                  {book.publisher}
                </Fact>
              )}
              {book.isbn && (
                <Fact icon={<Barcode size={18} />} label="ISBN">
                  <span className="whitespace-nowrap tabular-nums">{book.isbn}</span>
                </Fact>
              )}
              <Fact icon={<Library size={18} />} label="Tổng số bản">
                {total}
              </Fact>
            </dl>
          </section>

          {book.description && (
            <section className="mt-8" aria-labelledby="tieu-de-gioi-thieu">
              <h2 id="tieu-de-gioi-thieu" className="text-xl font-bold">
                Giới thiệu
              </h2>
              <p className="mt-3 max-w-3xl whitespace-pre-line text-[0.9375rem] leading-[1.75] text-ink-soft">
                {book.description}
              </p>
            </section>
          )}

          <RateBookPanel bookId={book.id} />
        </div>
      </article>

      {related.length > 0 && (
        <section className="mt-16" aria-labelledby="tieu-de-cung-the-loai">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 id="tieu-de-cung-the-loai" className="text-2xl font-bold">
              Cùng thể loại {book.category.name}
            </h2>
            <Link
              href={`/books?categoryId=${book.category.id}`}
              className="link-underline inline-flex min-h-10 items-center text-sm font-semibold text-primary"
            >
              Xem cả thể loại
            </Link>
          </div>
          <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-6">
            {related.map((item) => (
              <li key={item.id}>
                <BookCard book={item} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Fact({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-4 shadow-[var(--shadow-card)]">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary-soft text-primary" aria-hidden="true">
        {icon}
      </span>
      <dt className="mt-3 text-xs text-ink-faint">{label}</dt>
      <dd className="mt-0.5 break-words font-semibold">{children}</dd>
    </div>
  );
}
