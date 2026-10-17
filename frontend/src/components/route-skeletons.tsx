import { Skeleton } from "./ui";

/** Khung chờ cho các trang của thủ thư: đúng bố cục thật nên trang không nhảy khi dữ liệu về. */
export function DeskSkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10" role="status" aria-label="Đang tải quầy mượn trả">
      <Skeleton className="h-9 w-56" />
      <Skeleton className="mt-3 h-4 w-full max-w-lg" />
      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <Skeleton className="h-[34rem] rounded-[1.5rem]" />
        <Skeleton className="h-[34rem] rounded-[1.5rem]" />
      </div>
      <Skeleton className="mt-5 h-72 rounded-[1.5rem]" />
    </div>
  );
}

export function ReadersSkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10" role="status" aria-label="Đang tải danh sách bạn đọc">
      <Skeleton className="h-9 w-64" />
      <Skeleton className="mt-3 h-4 w-full max-w-lg" />
      <Skeleton className="mt-6 h-36 rounded-[1.5rem]" />
      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Skeleton className="h-[34rem] rounded-[1.5rem]" />
        <Skeleton className="hidden h-72 rounded-[1.5rem] lg:block" />
      </div>
    </div>
  );
}

export function PrintSkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10" role="status" aria-label="Đang tải trang in">
      <Skeleton className="h-10 w-28 rounded-full" />
      <Skeleton className="mt-4 h-9 w-72" />
      <Skeleton className="mt-3 h-4 w-full max-w-xl" />
      <Skeleton className="mt-6 h-32 rounded-[1.5rem]" />
      <Skeleton className="mt-5 h-12 w-40" />
      <Skeleton className="mt-7 h-96 rounded-[1.5rem]" />
    </div>
  );
}
