import Link from "next/link";
import { ArrowRight, BookMarked, CalendarClock, Library } from "lucide-react";
import { BookCard } from "@/components/book-card";
import { SearchForm } from "@/components/search-form";
import { apiFetch } from "@/lib/api";
import { SITE } from "@/lib/site";
import type { BookSummary, Category, LoanPolicy, Page } from "@/lib/types";

// Tình trạng "còn mấy bản trên kệ" đổi theo từng lượt mượn trả, hiển thị sai là bạn đọc
// tới nơi mới biết hết sách. Vì vậy dựng trang theo từng yêu cầu thay vì cache.
export const dynamic = "force-dynamic";

async function loadHome() {
  const [books, allBooks, categories, policies] = await Promise.all([
    apiFetch<Page<BookSummary>>("/books?available=true&limit=12", { cache: "no-store" }).catch(() => null),
    apiFetch<Page<BookSummary>>("/books?limit=1", { cache: "no-store" }).catch(() => null),
    apiFetch<Category[]>("/categories", { next: { revalidate: 900 } }).catch(() => []),
    apiFetch<LoanPolicy[]>("/policies", { next: { revalidate: 900 } }).catch(() => []),
  ]);
  return { books, allBooks, categories, policies };
}

export default async function HomePage() {
  const { books, allBooks, categories, policies } = await loadHome();
  const topCategories = [...categories]
    .sort((a, b) => (b.bookCount ?? 0) - (a.bookCount ?? 0))
    .slice(0, 10);
  const student = policies.find((policy) => policy.memberType === "STUDENT");
  const lecturer = policies.find((policy) => policy.memberType === "LECTURER");

  return (
    <>
      <section className="border-b border-line bg-gradient-to-b from-paper-2 to-paper">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[1fr_300px] lg:items-center">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">
              {SITE.university}
            </p>
            <h1 className="mt-3 font-serif text-4xl font-bold leading-[1.15] sm:text-5xl">
              Tìm sách trong thư viện, biết ngay còn trên kệ hay không
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink-soft sm:text-lg">
              Tra cứu toàn bộ danh mục theo tên sách, tác giả hoặc ISBN. Đăng nhập để xem sách đang mượn,
              gia hạn trực tuyến và theo dõi hạn trả.
            </p>
            <div className="mt-8 max-w-2xl">
              <SearchForm />
            </div>
            <p className="mt-3 text-sm text-ink-faint">
              Ví dụ: <Link href="/books?q=harry+potter" className="underline hover:text-ink">harry potter</Link>,{" "}
              <Link href="/books?q=rowling" className="underline hover:text-ink">rowling</Link>,{" "}
              <Link href="/books?q=9780439023481" className="underline hover:text-ink">9780439023481</Link>
            </p>
          </div>

          <aside className="rounded-xl border border-line bg-white/70 p-6" aria-label="Thư viện trong con số">
            <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-faint">
              Thư viện trong con số
            </h2>
            <dl className="mt-4 space-y-4">
              <div>
                <dt className="text-sm text-ink-soft">Đầu sách trong danh mục</dt>
                <dd className="font-serif text-3xl font-bold">
                  {(allBooks?.total ?? 0).toLocaleString("vi-VN")}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-ink-soft">Thể loại</dt>
                <dd className="font-serif text-3xl font-bold">{categories.length.toLocaleString("vi-VN")}</dd>
              </div>
              <div>
                <dt className="text-sm text-ink-soft">Đầu sách còn trên kệ</dt>
                <dd className="font-serif text-3xl font-bold text-leaf">
                  {(books?.total ?? 0).toLocaleString("vi-VN")}
                </dd>
              </div>
            </dl>
          </aside>
        </div>
      </section>

      {topCategories.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6" aria-labelledby="tieu-de-the-loai">
          <h2 id="tieu-de-the-loai" className="font-serif text-xl font-bold">
            Duyệt theo thể loại
          </h2>
          <ul className="mt-5 flex flex-wrap gap-2.5">
            {topCategories.map((category) => (
              <li key={category.id}>
                <Link
                  href={`/books?categoryId=${category.id}`}
                  className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-4 py-2 text-sm transition-colors hover:border-ink hover:bg-paper-2"
                >
                  {category.name}
                  {category.bookCount !== undefined && (
                    <span className="text-xs text-ink-faint">{category.bookCount}</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mx-auto max-w-6xl px-4 pb-4 sm:px-6" aria-labelledby="tieu-de-sach-moi">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 id="tieu-de-sach-moi" className="font-serif text-xl font-bold">
              Sách đang có trên kệ
            </h2>
            <p className="mt-1 text-sm text-ink-soft">Những đầu sách còn bản sao, mượn được ngay hôm nay.</p>
          </div>
          <Link
            href="/books?available=true"
            className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-brand hover:underline"
          >
            Xem tất cả
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>

        {books && books.items.length > 0 ? (
          <ul className="mt-6 grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-6">
            {books.items.map((book) => (
              <li key={book.id}>
                <BookCard book={book} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-6 rounded-lg border border-dashed border-line bg-white/60 px-5 py-10 text-center text-sm text-ink-soft">
            Danh mục đang được cập nhật. Vui lòng quay lại sau.
          </p>
        )}
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6" aria-labelledby="tieu-de-quy-dinh">
        <h2 id="tieu-de-quy-dinh" className="font-serif text-xl font-bold">
          Quy định mượn sách
        </h2>
        <div className="mt-6 grid gap-5 md:grid-cols-3">
          <article className="rounded-xl border border-line bg-white p-6">
            <Library size={22} className="text-brand" aria-hidden="true" />
            <h3 className="mt-3 font-serif text-base font-bold">Số sách được mượn</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              Sinh viên mượn tối đa {student?.maxBooks ?? 3} cuốn, giảng viên {lecturer?.maxBooks ?? 5} cuốn cùng lúc.
            </p>
          </article>
          <article className="rounded-xl border border-line bg-white p-6">
            <CalendarClock size={22} className="text-brand" aria-hidden="true" />
            <h3 className="mt-3 font-serif text-base font-bold">Thời hạn và gia hạn</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              Sinh viên giữ sách {student?.loanDays ?? 14} ngày, giảng viên {lecturer?.loanDays ?? 30} ngày.
              Mỗi phiếu gia hạn được {student?.renewLimit ?? 1} lần nếu chưa quá hạn.
            </p>
          </article>
          <article className="rounded-xl border border-line bg-white p-6">
            <BookMarked size={22} className="text-brand" aria-hidden="true" />
            <h3 className="mt-3 font-serif text-base font-bold">Trả trễ</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              Phạt {(student?.finePerDay ?? 5000).toLocaleString("vi-VN")} đồng mỗi ngày trễ, tính theo ngày lịch.
              Trả trong ngày hết hạn không bị phạt.
            </p>
          </article>
        </div>
        <p className="mt-5 text-sm">
          <Link href="/quy-dinh" className="font-medium text-brand hover:underline">
            Xem đầy đủ quy định mượn trả
          </Link>
        </p>
      </section>
    </>
  );
}
