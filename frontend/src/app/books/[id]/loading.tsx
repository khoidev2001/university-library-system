import { Shimmer } from "@/components/public/skeletons";

/** Khung chờ trang chi tiết sách: bìa bên trái, khối thông tin bên phải. */
export default function BookDetailLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10" role="status" aria-label="Đang tải thông tin sách">
      <Shimmer className="h-5 w-64 max-w-full" />
      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[21rem_minmax(0,1fr)] lg:gap-14">
        <Shimmer className="mx-auto aspect-[2/3] w-full max-w-[17rem] rounded-2xl lg:max-w-none" />
        <div>
          <Shimmer className="h-8 w-28 rounded-full" />
          <Shimmer className="mt-4 h-12 w-4/5" />
          <Shimmer className="mt-3 h-6 w-48" />
          <Shimmer className="mt-7 h-52 rounded-[1.5rem]" />
          <Shimmer className="mt-8 h-6 w-48" />
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Shimmer className="h-28 rounded-2xl" />
            <Shimmer className="h-28 rounded-2xl" />
            <Shimmer className="h-28 rounded-2xl" />
          </div>
        </div>
      </div>
    </div>
  );
}
