import type { Metadata } from "next";
import Link from "next/link";
import { BookCard } from "@/components/book-card";
import { SearchForm } from "@/components/search-form";
import { apiFetch } from "@/lib/api";
import type { BookSummary, Category, Page } from "@/lib/types";

// Tình trạng "còn mấy bản trên kệ" đổi theo từng lượt mượn trả, hiển thị sai là bạn đọc
// tới nơi mới biết hết sách. Vì vậy dựng trang theo từng yêu cầu thay vì cache.
export const dynamic = "force-dynamic";

interface SearchParams {
  q?: string;
  categoryId?: string;
  available?: string;
  page?: string;
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}): Promise<Metadata> {
  const params = await searchParams;
  const query = params.q?.trim();
  const title = query ? `Kết quả tìm kiếm cho "${query}"` : "Tra cứu danh mục sách";
  const description = query
    ? `Các đầu sách khớp với từ khoá "${query}" trong thư viện, kèm số bản sao còn trên kệ.`
    : "Tra cứu toàn bộ danh mục sách của thư viện theo tên sách, tác giả, ISBN hoặc thể loại.";
  return {
    title,
    description,
    alternates: { canonical: query ? `/books?q=${encodeURIComponent(query)}` : "/books" },
    openGraph: { title, description },
    // Trang kết quả tìm kiếm không nên vào chỉ mục, nhưng vẫn cho đi tiếp vào trang sách
    robots: query ? { index: false, follow: true } : { index: true, follow: true },
  };
}

export default async function BooksPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const categoryId = params.categoryId ?? "";
  const onlyAvailable = params.available === "true";
  const page = Math.max(1, Number(params.page ?? 1) || 1);

  const search = new URLSearchParams({ page: String(page), limit: "24" });
  if (query) search.set("q", query);
  if (categoryId) search.set("categoryId", categoryId);
  if (onlyAvailable) search.set("available", "true");

  const [result, categories] = await Promise.all([
    apiFetch<Page<BookSummary>>(`/books?${search}`, { cache: "no-store" }).catch(() => null),
    apiFetch<Category[]>("/categories", { next: { revalidate: 900 } }).catch(() => []),
  ]);

  const totalPages = result ? Math.max(1, Math.ceil(result.total / result.limit)) : 1;
  const activeCategory = categories.find((category) => String(category.id) === categoryId);

  const buildHref = (overrides: Partial<SearchParams>) => {
    const next = new URLSearchParams();
    const merged = { q: query, categoryId, available: onlyAvailable ? "true" : "", page: "1", ...overrides };
    if (merged.q) next.set("q", merged.q);
    if (merged.categoryId) next.set("categoryId", merged.categoryId);
    if (merged.available === "true") next.set("available", "true");
    if (merged.page && merged.page !== "1") next.set("page", merged.page);
    const qs = next.toString();
    return qs ? `/books?${qs}` : "/books";
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <nav aria-label="Đường dẫn" className="text-sm text-ink-faint">
        <ol className="flex items-center gap-1.5">
          <li>
            <Link href="/" className="hover:text-ink hover:underline">
              Trang chủ
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-ink">Tra cứu sách</li>
        </ol>
      </nav>

      <h1 className="mt-4 font-serif text-3xl font-bold">
        {query ? `Kết quả cho "${query}"` : "Danh mục sách"}
      </h1>
      <p className="mt-2 text-sm text-ink-soft">
        {result ? (
          <>
            Tìm thấy <strong className="font-semibold text-ink">{result.total.toLocaleString("vi-VN")}</strong> đầu sách
            {activeCategory ? ` trong thể loại ${activeCategory.name}` : ""}
            {onlyAvailable ? ", chỉ hiện sách còn trên kệ" : ""}.
          </>
        ) : (
          "Không kết nối được tới máy chủ danh mục."
        )}
      </p>

      <div className="mt-6 max-w-2xl">
        <SearchForm defaultValue={query} size="compact" />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[250px_minmax(0,1fr)]">
        <aside aria-label="Bộ lọc" className="space-y-6">
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-faint">Tình trạng</h2>
            <Link
              href={buildHref({ available: onlyAvailable ? "" : "true" })}
              className={`mt-3 flex items-center gap-2.5 rounded-md border px-3 py-2.5 text-sm transition-colors ${
                onlyAvailable ? "border-ink bg-ink text-paper" : "border-line bg-white hover:bg-paper-2"
              }`}
            >
              <span
                aria-hidden="true"
                className={`grid h-4 w-4 place-items-center rounded border ${
                  onlyAvailable ? "border-paper bg-paper text-ink" : "border-line"
                }`}
              >
                {onlyAvailable ? "✓" : ""}
              </span>
              Chỉ sách còn trên kệ
            </Link>
          </section>

          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-faint">Thể loại</h2>
            <ul className="mt-3 space-y-1">
              <li>
                <Link
                  href={buildHref({ categoryId: "" })}
                  className={`block rounded-md px-3 py-2 text-sm transition-colors ${
                    !categoryId ? "bg-paper-2 font-semibold" : "hover:bg-paper-2"
                  }`}
                >
                  Tất cả thể loại
                </Link>
              </li>
              {categories.map((category) => (
                <li key={category.id}>
                  <Link
                    href={buildHref({ categoryId: String(category.id) })}
                    className={`flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                      String(category.id) === categoryId ? "bg-paper-2 font-semibold" : "hover:bg-paper-2"
                    }`}
                  >
                    <span>{category.name}</span>
                    {category.bookCount !== undefined && (
                      <span className="text-xs text-ink-faint">{category.bookCount}</span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </aside>

        <div>
          {result && result.items.length > 0 ? (
            <>
              <ul className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 xl:grid-cols-4">
                {result.items.map((book) => (
                  <li key={book.id}>
                    <BookCard book={book} />
                  </li>
                ))}
              </ul>

              {totalPages > 1 && (
                <nav aria-label="Phân trang" className="mt-10 flex items-center justify-center gap-2">
                  {page > 1 && (
                    <Link
                      href={buildHref({ page: String(page - 1) })}
                      rel="prev"
                      className="rounded-md border border-line bg-white px-4 py-2 text-sm hover:bg-paper-2"
                    >
                      Trang trước
                    </Link>
                  )}
                  <span className="px-3 text-sm text-ink-soft">
                    Trang {page} trên {totalPages}
                  </span>
                  {page < totalPages && (
                    <Link
                      href={buildHref({ page: String(page + 1) })}
                      rel="next"
                      className="rounded-md border border-line bg-white px-4 py-2 text-sm hover:bg-paper-2"
                    >
                      Trang sau
                    </Link>
                  )}
                </nav>
              )}
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-line bg-white/60 px-6 py-16 text-center">
              <p className="font-serif text-lg font-bold">Không tìm thấy sách phù hợp</p>
              <p className="mx-auto mt-2 max-w-md text-sm text-ink-soft">
                Thử bớt từ khoá, kiểm tra chính tả, hoặc bỏ bộ lọc thể loại và tình trạng.
              </p>
              <p className="mt-5">
                <Link
                  href="/books"
                  className="inline-flex items-center rounded-md bg-ink px-4 py-2.5 text-sm font-medium text-paper hover:bg-ink/90"
                >
                  Xem toàn bộ danh mục
                </Link>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
