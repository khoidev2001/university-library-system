import { Skeleton } from "../ui";
import { TableSkeleton } from "./admin-ui";

/** Khung chờ chung cho các trang quản trị: tiêu đề, thanh công cụ và bảng, đúng chỗ nội dung sẽ hiện. */
export function AdminPageSkeleton() {
  return (
    <div role="status" aria-label="Đang tải trang">
      <Skeleton className="h-9 w-64 rounded-xl" />
      <Skeleton className="mt-3 h-4 w-full max-w-xl rounded-full" />
      <div className="mt-6 flex flex-wrap gap-3">
        <Skeleton className="h-12 w-72 rounded-2xl" />
        <Skeleton className="h-12 w-40 rounded-xl" />
      </div>
      <div className="mt-6">
        <TableSkeleton rows={7} cols={5} />
      </div>
    </div>
  );
}
