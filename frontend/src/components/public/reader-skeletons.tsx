import { BookGridSkeleton, HeadingSkeleton, ListRowSkeleton, Shimmer, StatRowSkeleton } from "./skeletons";

/**
 * Khung chờ cho khu bạn đọc. Đặt riêng khỏi các tệp view để loading.tsx chỉ kéo theo phần khung chờ nhỏ
 * này chứ không kéo cả view (react-query, biểu mẫu) vào gói tải trước.
 */

export function MyLoansSkeleton() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10" role="status" aria-label="Đang tải sách đang mượn">
      <HeadingSkeleton />
      <div className="mt-6">
        <StatRowSkeleton count={3} />
      </div>
      <div className="mt-8 space-y-4">
        <ListRowSkeleton />
        <ListRowSkeleton />
      </div>
    </div>
  );
}

export function MyReservationsSkeleton() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10" role="status" aria-label="Đang tải sách đã đặt trước">
      <HeadingSkeleton />
      <div className="mt-8 space-y-4">
        <ListRowSkeleton />
        <ListRowSkeleton />
      </div>
    </div>
  );
}

export function MyFinesSkeleton() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10" role="status" aria-label="Đang tải tiền phạt">
      <HeadingSkeleton />
      <Shimmer className="mt-6 h-28 rounded-[1.5rem]" />
      <div className="mt-6 space-y-3">
        <Shimmer className="h-16 rounded-[1.25rem]" />
        <Shimmer className="h-16 rounded-[1.25rem]" />
        <Shimmer className="h-16 rounded-[1.25rem]" />
      </div>
    </div>
  );
}

export function RecommendationsSkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10" role="status" aria-label="Đang chọn sách phù hợp với bạn">
      <HeadingSkeleton />
      <div className="mt-8">
        <BookGridSkeleton count={12} className="grid-cols-2 sm:grid-cols-3 lg:grid-cols-6" />
      </div>
    </div>
  );
}
