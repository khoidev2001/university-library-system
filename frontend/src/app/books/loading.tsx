import { BookGridSkeleton, Shimmer } from "@/components/public/skeletons";

/** Khung chờ trang tra cứu: tiêu đề, ô tìm, cột lọc và lưới sách đúng chỗ để không nhảy khi dữ liệu về. */
export default function BooksLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10" role="status" aria-label="Đang tải danh mục sách">
      <Shimmer className="h-5 w-40" />
      <div className="mt-4 grid items-end gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)]">
        <div>
          <Shimmer className="h-10 w-72 max-w-full" />
          <Shimmer className="mt-3 h-4 w-52" />
        </div>
        <Shimmer className="h-[3.25rem] rounded-2xl" />
      </div>
      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[16.5rem_minmax(0,1fr)]">
        <div className="hidden rounded-[1.25rem] border border-line bg-white p-5 lg:block">
          <Shimmer className="h-4 w-20" />
          <Shimmer className="mt-3 h-12" />
          <Shimmer className="mt-7 h-4 w-20" />
          <div className="mt-3 space-y-2">
            {Array.from({ length: 9 }, (_, i) => (
              <Shimmer key={i} className="h-9" />
            ))}
          </div>
        </div>
        <BookGridSkeleton count={12} className="grid-cols-2 sm:grid-cols-3 xl:grid-cols-4" />
      </div>
    </div>
  );
}
