import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

/** Danh sách số trang rút gọn: luôn có trang đầu, trang cuối và hai trang lân cận trang hiện tại. */
function pageWindow(page: number, total: number): (number | "gap")[] {
  const wanted = new Set([1, total, page - 1, page, page + 1]);
  const sorted = [...wanted].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  sorted.forEach((n, i) => {
    if (i > 0 && n - sorted[i - 1] > 1) out.push("gap");
    out.push(n);
  });
  return out;
}

export function Pagination({
  page,
  totalPages,
  hrefFor,
}: {
  page: number;
  totalPages: number;
  hrefFor: (page: number) => string;
}) {
  if (totalPages <= 1) return null;
  const base = "inline-flex h-11 min-w-11 items-center justify-center rounded-xl px-3 text-sm font-semibold transition-colors";

  return (
    <nav aria-label="Phân trang" className="mt-12 flex flex-wrap items-center justify-center gap-2">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} rel="prev" className={`${base} gap-1 bg-white text-ink ring-1 ring-inset ring-line hover:bg-paper-2`}>
          <ChevronLeft size={16} aria-hidden="true" />
          <span className="hidden sm:inline">Trang trước</span>
          <span className="sr-only sm:hidden">Trang trước</span>
        </Link>
      ) : null}

      {pageWindow(page, totalPages).map((item, index) =>
        item === "gap" ? (
          <span key={`gap-${index}`} className="px-1 text-ink-faint" aria-hidden="true">
            …
          </span>
        ) : item === page ? (
          <span key={item} aria-current="page" className={`${base} bg-primary text-white shadow-[0_6px_16px_-6px_rgb(79_70_229/0.7)]`}>
            <span className="sr-only">Trang </span>
            {item}
          </span>
        ) : (
          <Link key={item} href={hrefFor(item)} className={`${base} bg-white text-ink-soft ring-1 ring-inset ring-line hover:bg-paper-2 hover:text-ink`}>
            <span className="sr-only">Trang </span>
            {item}
          </Link>
        ),
      )}

      {page < totalPages ? (
        <Link href={hrefFor(page + 1)} rel="next" className={`${base} gap-1 bg-white text-ink ring-1 ring-inset ring-line hover:bg-paper-2`}>
          <span className="hidden sm:inline">Trang sau</span>
          <span className="sr-only sm:hidden">Trang sau</span>
          <ChevronRight size={16} aria-hidden="true" />
        </Link>
      ) : null}
    </nav>
  );
}
