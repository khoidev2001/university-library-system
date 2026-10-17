import type { Metadata } from "next";
import Link from "next/link";
import { Check, X } from "lucide-react";
import { BookCard } from "@/components/book-card";
import { EmptyArt } from "@/components/public/empty-art";
import { FilterDrawer } from "@/components/public/filter-drawer";
import { Pagination } from "@/components/public/pagination";
import { SearchForm } from "@/components/search-form";
import { ButtonLink } from "@/components/ui";
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
  const hasFilters = !!(categoryId || onlyAvailable);
  const activeCount = (categoryId ? 1 : 0) + (onlyAvailable ? 1 : 0);

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

  const renderFilters = (prefix: string) => (
    <div className="space-y-7">
      <section aria-labelledby={`${prefix}-tinh-trang`}>
        <h2 id={`${prefix}-tinh-trang`} className="text-sm font-bold">
          Tình trạng
        </h2>
        <Link
          href={buildHref({ available: onlyAvailable ? "" : "true" })}
          aria-current={onlyAvailable ? "true" : undefined}
          className={`mt-3 flex min-h-12 items-center justify-between gap-3 rounded-2xl px-4 text-sm font-medium transition-colors ${
            onlyAvailable ? "bg-primary-soft text-primary-ink" : "bg-paper hover:bg-paper-2"
          }`}
        >
          Còn trên kệ
          <span
            aria-hidden="true"
            className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${onlyAvailable ? "bg-primary" : "bg-ink-faint/40"}`}
          >
            <span
              className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${
                onlyAvailable ? "translate-x-4" : ""
              }`}
            />
          </span>
          <span className="sr-only">{onlyAvailable ? "Đang bật" : "Đang tắt"}</span>
        </Link>
      </section>

      <section aria-labelledby={`${prefix}-the-loai`}>
        <h2 id={`${prefix}-the-loai`} className="text-sm font-bold">
          Thể loại
        </h2>
        <ul className="mt-3 space-y-0.5">
          <li>
            <Link
              href={buildHref({ categoryId: "" })}
              aria-current={!categoryId ? "true" : undefined}
              className={`flex min-h-11 items-center rounded-xl px-3 text-sm transition-colors ${
                !categoryId ? "bg-primary-soft font-semibold text-primary-ink" : "text-ink-soft hover:bg-paper-2 hover:text-ink"
              }`}
            >
              Tất cả thể loại
            </Link>
          </li>
          {categories.map((category) => {
            const active = String(category.id) === categoryId;
            return (
              <li key={category.id}>
                <Link
                  href={buildHref({ categoryId: String(category.id) })}
                  aria-current={active ? "true" : undefined}
                  className={`flex min-h-11 items-center justify-between gap-2 rounded-xl px-3 text-sm transition-colors ${
                    active ? "bg-primary-soft font-semibold text-primary-ink" : "text-ink-soft hover:bg-paper-2 hover:text-ink"
                  }`}
                >
                  <span className="min-w-0 truncate">{category.name}</span>
                  {active ? (
                    <Check size={16} aria-hidden="true" className="shrink-0" />
                  ) : (
                    category.bookCount !== undefined && (
                      <span className="shrink-0 text-xs tabular-nums text-ink-faint">{category.bookCount}</span>
                    )
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <nav aria-label="Đường dẫn" className="text-sm text-ink-faint">
        <ol className="flex items-center gap-1.5">
          <li>
            <Link href="/" className="inline-flex min-h-10 items-center hover:text-ink hover:underline">
              Trang chủ
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-ink">Tra cứu sách</li>
        </ol>
      </nav>

      <div className="mt-2 grid items-end gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)]">
        <div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {query ? `Kết quả cho "${query}"` : "Danh mục sách"}
          </h1>
          <p className="mt-2 text-sm text-ink-soft sm:text-base">
            {result ? (
              <>
                <strong className="font-bold text-ink tabular-nums">{result.total.toLocaleString("vi-VN")}</strong> đầu sách
                {activeCategory ? ` trong thể loại ${activeCategory.name}` : ""}
                {onlyAvailable ? ", chỉ hiện sách còn trên kệ" : ""}.
              </>
            ) : (
              "Không kết nối được tới máy chủ danh mục."
            )}
          </p>
        </div>
        <SearchForm defaultValue={query} size="compact" />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2 lg:hidden">
        <FilterDrawer activeCount={activeCount}>{renderFilters("ngan-keo")}</FilterDrawer>
      </div>

      {hasFilters && (
        <div className="mt-4 flex flex-wrap items-center gap-2" aria-label="Bộ lọc đang áp dụng" role="group">
          <span className="text-sm text-ink-soft">Đang lọc</span>
          {activeCategory && (
            <Link
              href={buildHref({ categoryId: "" })}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-primary-soft pl-4 pr-3 text-sm font-semibold text-primary-ink hover:bg-primary/15"
              aria-label={`Bỏ lọc thể loại ${activeCategory.name}`}
            >
              {activeCategory.name}
              <X size={14} aria-hidden="true" />
            </Link>
          )}
          {onlyAvailable && (
            <Link
              href={buildHref({ available: "" })}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-primary-soft pl-4 pr-3 text-sm font-semibold text-primary-ink hover:bg-primary/15"
              aria-label="Bỏ lọc chỉ sách còn trên kệ"
            >
              Còn trên kệ
              <X size={14} aria-hidden="true" />
            </Link>
          )}
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[16.5rem_minmax(0,1fr)]">
        <aside
          aria-label="Bộ lọc"
          className="hidden self-start rounded-[1.25rem] border border-line bg-white p-5 shadow-[var(--shadow-card)] lg:sticky lg:top-24 lg:block"
        >
          {renderFilters("cot-loc")}
        </aside>

        <div>
          {result && result.items.length > 0 ? (
            <>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 xl:grid-cols-4">
                {result.items.map((book) => (
                  <li key={book.id}>
                    <BookCard book={book} />
                  </li>
                ))}
              </ul>
              <Pagination page={page} totalPages={totalPages} hrefFor={(n) => buildHref({ page: String(n) })} />
            </>
          ) : result ? (
            <div className="rounded-[1.5rem] border border-dashed border-line bg-white/70 px-6 py-14 text-center">
              <EmptyArt className="mx-auto h-32 w-auto" />
              <p className="mt-4 text-xl font-bold">Chưa thấy cuốn nào khớp</p>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-soft">
                Thử bớt từ khoá, kiểm tra chính tả, hoặc bỏ bớt bộ lọc để thấy nhiều sách hơn.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                {hasFilters && (
                  <ButtonLink href={query ? `/books?q=${encodeURIComponent(query)}` : "/books"} variant="soft">
                    Bỏ bộ lọc
                  </ButtonLink>
                )}
                <ButtonLink href="/books" variant={hasFilters ? "ghost" : "primary"}>
                  Xem toàn bộ danh mục
                </ButtonLink>
              </div>
              {categories.length > 0 && (
                <div className="mx-auto mt-8 max-w-xl border-t border-line pt-6">
                  <p className="text-sm font-semibold">Hoặc thử một thể loại</p>
                  <ul className="mt-3 flex flex-wrap justify-center gap-2">
                    {[...categories]
                      .sort((a, b) => (b.bookCount ?? 0) - (a.bookCount ?? 0))
                      .slice(0, 6)
                      .map((category) => (
                        <li key={category.id}>
                          <Link
                            href={`/books?categoryId=${category.id}`}
                            className="inline-flex min-h-10 items-center rounded-full bg-white px-4 text-sm font-medium text-ink-soft ring-1 ring-line hover:text-primary hover:ring-primary/40"
                          >
                            {category.name}
                          </Link>
                        </li>
                      ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-[1.5rem] border border-danger/20 bg-danger-soft px-6 py-12 text-center">
              <p className="text-lg font-bold text-danger">Chưa tải được danh mục</p>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-soft">
                Máy chủ danh mục đang bận hoặc mất kết nối. Hãy thử lại sau vài giây.
              </p>
              <div className="mt-6 flex justify-center">
                <ButtonLink href={buildHref({ page: String(page) })} variant="ghost">
                  Thử lại
                </ButtonLink>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
