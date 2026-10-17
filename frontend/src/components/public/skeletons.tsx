import "./public.css";

/** Khối giữ chỗ có vệt sáng quét qua (transform), đúng kích thước nội dung thật để trang không nhảy. */
export function Shimmer({ className = "" }: { className?: string }) {
  return <div className={`skeleton-shimmer rounded-xl bg-paper-2 ${className}`} aria-hidden="true" />;
}

export function BookCardSkeleton() {
  return (
    <div className="rounded-[1.25rem] border border-line bg-white p-3 shadow-[var(--shadow-card)]" aria-hidden="true">
      <Shimmer className="aspect-[2/3]" />
      <Shimmer className="mt-3 h-4 w-11/12" />
      <Shimmer className="mt-2 h-4 w-2/3" />
      <Shimmer className="mt-3 h-3 w-1/2" />
      <Shimmer className="mt-3 h-6 w-24 rounded-full" />
    </div>
  );
}

export function BookGridSkeleton({ count = 12, className = "grid-cols-2 sm:grid-cols-3 xl:grid-cols-4" }: { count?: number; className?: string }) {
  return (
    <ul className={`grid gap-4 sm:gap-5 ${className}`} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <li key={i}>
          <BookCardSkeleton />
        </li>
      ))}
    </ul>
  );
}

/** Dòng danh sách có bìa bên trái (phiếu mượn, đặt trước). */
export function ListRowSkeleton() {
  return (
    <div className="flex gap-4 rounded-[1.25rem] border border-line bg-white p-4 shadow-[var(--shadow-card)]" aria-hidden="true">
      <Shimmer className="aspect-[2/3] w-16 shrink-0 sm:w-20" />
      <div className="min-w-0 flex-1">
        <Shimmer className="h-5 w-2/3" />
        <Shimmer className="mt-2 h-3 w-1/3" />
        <Shimmer className="mt-5 h-3 w-3/4" />
        <Shimmer className="mt-5 h-9 w-40" />
      </div>
    </div>
  );
}

export function HeadingSkeleton() {
  return (
    <div aria-hidden="true">
      <Shimmer className="h-8 w-64 max-w-full" />
      <Shimmer className="mt-3 h-4 w-96 max-w-full" />
    </div>
  );
}

export function StatRowSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="rounded-[1.25rem] border border-line bg-white p-5 shadow-[var(--shadow-card)]">
          <Shimmer className="h-4 w-24" />
          <Shimmer className="mt-4 h-8 w-16" />
        </div>
      ))}
    </div>
  );
}
