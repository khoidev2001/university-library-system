import { Shimmer } from "@/components/public/skeletons";

export default function PaymentResultLoading() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-10" role="status" aria-label="Đang tải kết quả">
      <Shimmer className="h-8 w-72 max-w-full" />
      <Shimmer className="mt-6 h-44 rounded-[1.5rem]" />
      <Shimmer className="mt-4 h-64 rounded-[1.5rem]" />
    </div>
  );
}
