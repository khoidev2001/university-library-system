import { BookGridSkeleton, Shimmer } from "@/components/public/skeletons";

/** Khung chờ trang chủ: đúng bố cục phần giới thiệu và lưới sách để không nhảy khi dữ liệu về. */
export default function HomeLoading() {
  return (
    <div role="status" aria-label="Đang tải trang chủ">
      <div className="bg-aurora">
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-4 pb-10 pt-10 sm:px-6 sm:pt-14 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] lg:pb-14 lg:pt-16">
          <div>
            <Shimmer className="h-12 w-11/12 sm:h-16" />
            <Shimmer className="mt-3 h-12 w-2/3 sm:h-16" />
            <Shimmer className="mt-6 h-5 w-full max-w-xl" />
            <Shimmer className="mt-2 h-5 w-4/5 max-w-lg" />
            <Shimmer className="mt-8 h-[4.5rem] max-w-2xl rounded-[1.75rem]" />
            <Shimmer className="mt-6 h-11 w-72" />
          </div>
          <Shimmer className="mx-auto hidden aspect-square w-full max-w-[26rem] rounded-full lg:block" />
        </div>
      </div>
      <div className="mx-auto max-w-6xl px-4 pt-16 sm:px-6">
        <Shimmer className="h-8 w-56" />
        <div className="mt-7">
          <BookGridSkeleton count={6} className="grid-cols-2 sm:grid-cols-3 lg:grid-cols-6" />
        </div>
      </div>
    </div>
  );
}
