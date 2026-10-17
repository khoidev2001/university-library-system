import Link from "next/link";
import { BookCheck, Layers } from "lucide-react";
import { BookCard } from "@/components/book-card";
import { CountUp, Reveal, SplitWords } from "@/components/motion";
import { CoverMarquee } from "@/components/public/cover-marquee";
import { DrawOnView } from "@/components/public/draw-on-view";
import { HeroArt } from "@/components/public/hero-art";
import { HomeActions, HomeCtaTile } from "@/components/public/home-actions";
import { ShelfArt } from "@/components/public/shelf-art";
import { SpotlightCard } from "@/components/public/spotlight-card";
import { SearchForm } from "@/components/search-form";
import { ButtonLink } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { SITE } from "@/lib/site";
import type { BookSummary, Category, LoanPolicy, Page } from "@/lib/types";

// Tình trạng "còn mấy bản trên kệ" đổi theo từng lượt mượn trả, hiển thị sai là bạn đọc
// tới nơi mới biết hết sách. Vì vậy dựng trang theo từng yêu cầu thay vì cache.
export const dynamic = "force-dynamic";

async function loadHome() {
  const [books, moreBooks, allBooks, categories, policies] = await Promise.all([
    apiFetch<Page<BookSummary>>("/books?available=true&limit=12", { cache: "no-store" }).catch(() => null),
    // Dải bìa chạy ngang lấy từ trang 2 để không trùng với lưới bên dưới
    apiFetch<Page<BookSummary>>("/books?available=true&limit=24&page=2", { cache: "no-store" }).catch(() => null),
    apiFetch<Page<BookSummary>>("/books?limit=1", { cache: "no-store" }).catch(() => null),
    apiFetch<Category[]>("/categories", { next: { revalidate: 900 } }).catch(() => []),
    apiFetch<LoanPolicy[]>("/policies", { next: { revalidate: 900 } }).catch(() => []),
  ]);
  return { books, moreBooks, allBooks, categories, policies };
}

const SUGGESTED: { label: string; q: string; hideOnPhone?: boolean }[] = [
  { label: "Harry Potter", q: "harry potter" },
  { label: "Rowling", q: "rowling" },
  { label: "9780439023481", q: "9780439023481", hideOnPhone: true },
];

export default async function HomePage() {
  const { books, moreBooks, allBooks, categories, policies } = await loadHome();
  const topCategories = [...categories].sort((a, b) => (b.bookCount ?? 0) - (a.bookCount ?? 0)).slice(0, 12);
  const student = policies.find((policy) => policy.memberType === "STUDENT");
  const lecturer = policies.find((policy) => policy.memberType === "LECTURER");

  const featured = (books?.items ?? []).filter((book) => book.coverUrl).slice(0, 3);
  const strip = (moreBooks?.items.length ?? 0) >= 6 ? moreBooks!.items : (books?.items ?? []);

  const totalBooks = allBooks?.total ?? 0;
  const availableBooks = books?.total ?? 0;
  const fine = (student?.finePerDay ?? 5000).toLocaleString("vi-VN");

  return (
    <>
      <section className="bg-aurora relative overflow-hidden">
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-4 pb-10 pt-10 sm:px-6 sm:pt-14 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] lg:gap-6 lg:pb-14 lg:pt-16">
          <div>
            <h1 className="text-[2.5rem] font-bold leading-[1.08] tracking-tight sm:text-6xl">
              <SplitWords text="Tìm sách nhanh, biết ngay" />{" "}
              <span className="relative inline-block whitespace-nowrap text-primary">
                <SplitWords text="còn trên kệ" startDelay={420} />
                <svg
                  viewBox="0 0 300 14"
                  preserveAspectRatio="none"
                  className="absolute -bottom-1 left-0 h-2.5 w-full text-mint sm:h-3"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M3 9C48 3 96 12 150 6s108-2 147 3"
                    stroke="currentColor"
                    strokeWidth="5"
                    strokeLinecap="round"
                    pathLength={100}
                    className="anim-draw"
                    style={{ "--len": 100, animationDelay: "0.9s" } as React.CSSProperties}
                  />
                </svg>
              </span>
            </h1>
            <p className="anim-rise-2 mt-5 max-w-xl text-base leading-relaxed text-ink-soft sm:text-lg">
              Tra cứu toàn bộ danh mục của {SITE.shortName} theo tên sách, tác giả hoặc ISBN. Đăng nhập để theo dõi
              sách đang mượn, gia hạn trực tuyến và nhận gợi ý riêng.
            </p>

            <div className="anim-rise-3 mt-8 max-w-2xl">
              <SearchForm />
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="mr-1 text-sm text-ink-soft">Thử tìm</span>
                {SUGGESTED.map((item) => (
                  <Link
                    key={item.q}
                    href={`/books?q=${encodeURIComponent(item.q)}`}
                    className={`inline-flex min-h-10 items-center rounded-full bg-white/80 px-4 text-sm font-medium text-ink-soft ring-1 ring-line transition-colors hover:bg-white hover:text-primary hover:ring-primary/40 ${
                      item.hideOnPhone ? "hidden sm:inline-flex" : ""
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>

            <div className="mt-8">
              <HomeActions />
            </div>
          </div>

          <HeroArt books={featured} />
        </div>
      </section>

      <CoverMarquee books={strip} />

      <section className="mx-auto max-w-6xl px-4 pt-6 sm:px-6" aria-labelledby="tieu-de-sach-tren-ke">
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 id="tieu-de-sach-tren-ke" className="text-2xl font-bold sm:text-3xl">
                Đang có trên kệ
              </h2>
              <p className="mt-2 text-sm text-ink-soft sm:text-base">
                Những đầu sách còn bản sao, mượn được ngay hôm nay.
              </p>
            </div>
            <ButtonLink href="/books?available=true" variant="soft">
              Xem tất cả sách còn trên kệ
            </ButtonLink>
          </div>
        </Reveal>

        {books && books.items.length > 0 ? (
          <ul className="mt-7 grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 lg:grid-cols-6">
            {books.items.map((book, index) => (
              <li key={book.id}>
                <Reveal delay={(index % 6) * 50} className="h-full">
                  <BookCard book={book} />
                </Reveal>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-7 rounded-[1.25rem] border border-dashed border-line bg-white/70 px-5 py-12 text-center text-sm text-ink-soft">
            Danh mục đang được cập nhật. Vui lòng quay lại sau.
          </p>
        )}
      </section>

      {topCategories.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pt-16 sm:px-6" aria-labelledby="tieu-de-the-loai">
          <Reveal>
            <h2 id="tieu-de-the-loai" className="text-2xl font-bold sm:text-3xl">
              Duyệt theo thể loại
            </h2>
            <ul className="mt-6 flex flex-wrap gap-2.5">
              {topCategories.map((category) => (
                <li key={category.id}>
                  <Link
                    href={`/books?categoryId=${category.id}`}
                    className="lift inline-flex min-h-11 items-center gap-2.5 rounded-full border border-line bg-white py-2 pl-5 pr-2.5 text-sm font-semibold shadow-[var(--shadow-card)] hover:border-primary/40 hover:text-primary"
                  >
                    {category.name}
                    {category.bookCount !== undefined && (
                      <span className="grid min-w-7 place-items-center rounded-full bg-paper-2 px-2 py-0.5 text-xs font-semibold tabular-nums text-ink-soft">
                        {category.bookCount}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </Reveal>
        </section>
      )}

      <section className="mx-auto max-w-6xl px-4 pt-16 sm:px-6" aria-labelledby="tieu-de-so-lieu">
        <Reveal>
          <h2 id="tieu-de-so-lieu" className="text-2xl font-bold sm:text-3xl">
            Thư viện trong một cái nhìn
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-ink-soft sm:text-base">
            Số liệu cập nhật theo từng lượt mượn trả, cùng những quy định bạn cần biết trước khi mượn.
          </p>
        </Reveal>

        <div className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Reveal className="sm:col-span-2 lg:row-span-2">
            <SpotlightCard className="flex h-full flex-col justify-between rounded-[1.5rem] border border-primary/10 bg-primary-soft p-6 sm:p-8">
              <div>
                <p className="text-sm font-medium text-primary-ink">Đầu sách trong danh mục</p>
                <p className="mt-2 text-6xl font-bold tracking-tight text-ink sm:text-7xl">
                  <CountUp value={totalBooks} />
                </p>
                <p className="mt-3 max-w-xs text-sm leading-relaxed text-ink-soft">
                  Tra cứu theo tên sách, tác giả hoặc ISBN và xem ngay còn bao nhiêu bản trên kệ.
                </p>
              </div>
              <DrawOnView className="mt-8">
                <ShelfArt className="mx-auto h-auto w-full max-w-[17rem]" />
              </DrawOnView>
            </SpotlightCard>
          </Reveal>

          <Reveal delay={60}>
            <SpotlightCard className="h-full rounded-[1.5rem] border border-line bg-white p-6 shadow-[var(--shadow-card)]">
              <div className="flex h-full flex-col justify-between gap-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-ink-soft">Thể loại</p>
                    <p className="mt-2 text-5xl font-bold tracking-tight">
                      <CountUp value={categories.length} />
                    </p>
                  </div>
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary-soft text-primary" aria-hidden="true">
                    <Layers size={20} />
                  </span>
                </div>
                <Link href="/books" className="link-underline inline-flex min-h-10 w-fit items-center text-sm font-semibold text-primary">
                  Duyệt danh mục
                </Link>
              </div>
            </SpotlightCard>
          </Reveal>

          <Reveal delay={120}>
            <SpotlightCard
              glow="rgb(11 122 92 / 0.16)"
              className="h-full rounded-[1.5rem] border border-leaf/10 bg-leaf-soft p-6"
            >
              <div className="flex h-full flex-col justify-between gap-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-leaf">Đầu sách còn trên kệ</p>
                    <p className="mt-2 text-5xl font-bold tracking-tight text-leaf">
                      <CountUp value={availableBooks} />
                    </p>
                  </div>
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/70 text-leaf" aria-hidden="true">
                    <BookCheck size={20} />
                  </span>
                </div>
                <Link
                  href="/books?available=true"
                  className="link-underline inline-flex min-h-10 w-fit items-center text-sm font-semibold text-leaf"
                >
                  Mượn được ngay
                </Link>
              </div>
            </SpotlightCard>
          </Reveal>

          <Reveal className="sm:col-span-2" delay={60}>
            <SpotlightCard className="h-full rounded-[1.5rem] border border-line bg-white p-6 shadow-[var(--shadow-card)]">
              <div className="flex h-full flex-col">
              <p className="text-sm text-ink-soft">Hạn mức mượn</p>
              <div className="mt-4 grid flex-1 grid-cols-2 gap-4">
                <div className="rounded-2xl bg-paper p-4">
                  <p className="text-sm font-semibold">Sinh viên</p>
                  <p className="mt-2 text-2xl font-bold tabular-nums sm:text-3xl">{student?.maxBooks ?? 3} cuốn</p>
                  <p className="mt-1 text-sm text-ink-soft">giữ {student?.loanDays ?? 14} ngày</p>
                </div>
                <div className="rounded-2xl bg-paper p-4">
                  <p className="text-sm font-semibold">Giảng viên</p>
                  <p className="mt-2 text-2xl font-bold tabular-nums sm:text-3xl">{lecturer?.maxBooks ?? 5} cuốn</p>
                  <p className="mt-1 text-sm text-ink-soft">giữ {lecturer?.loanDays ?? 30} ngày</p>
                </div>
              </div>
              </div>
            </SpotlightCard>
          </Reveal>

          <Reveal delay={60}>
            <SpotlightCard className="h-full rounded-[1.5rem] border border-line bg-white p-6 shadow-[var(--shadow-card)]">
              <p className="text-sm text-ink-soft">Gia hạn trực tuyến</p>
              <p className="mt-2 text-3xl font-bold tracking-tight tabular-nums">{student?.renewLimit ?? 1} lần</p>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                Thêm {student?.renewExtraDays ?? 7} ngày cho mỗi phiếu, nếu chưa quá hạn.
              </p>
            </SpotlightCard>
          </Reveal>

          <Reveal delay={120}>
            <SpotlightCard
              glow="rgb(200 30 69 / 0.1)"
              className="h-full rounded-[1.5rem] border border-line bg-white p-6 shadow-[var(--shadow-card)]"
            >
              <p className="text-sm text-ink-soft">Trả trễ</p>
              <p className="mt-2 text-3xl font-bold tracking-tight tabular-nums">{fine} đồng</p>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                mỗi ngày trễ. Trả trong ngày hết hạn thì không bị phạt.
              </p>
            </SpotlightCard>
          </Reveal>

          <Reveal className="sm:col-span-2" delay={60}>
            <div className="relative h-full overflow-hidden rounded-[1.5rem] bg-ink p-6 text-white sm:p-8">
              <div
                aria-hidden="true"
                className="anim-blob pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full"
                style={{ background: "radial-gradient(closest-side, rgb(79 70 229 / 0.55), transparent)" }}
              />
              <div className="relative">
                <HomeCtaTile />
              </div>
            </div>
          </Reveal>
        </div>

        <p className="mt-6 text-sm">
          <Link href="/quy-dinh" className="link-underline inline-flex min-h-10 items-center font-semibold text-primary">
            Xem đầy đủ quy định mượn trả
          </Link>
        </p>
      </section>
    </>
  );
}
