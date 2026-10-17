import type { Metadata } from "next";
import { Suspense } from "react";
import { ReaderCardsView } from "@/components/print/reader-cards-view";
import { RequireRole } from "@/components/require-role";
import { PrintSkeleton } from "@/components/route-skeletons";

export const metadata: Metadata = {
  title: "In thẻ bạn đọc hàng loạt",
  description: "In thẻ cho nhiều bạn đọc đã chọn hoặc theo bộ lọc.",
  robots: { index: false, follow: false },
};

export default function ReaderCardsPage() {
  // useSearchParams cần Suspense để trang vẫn dựng tĩnh được
  return (
    <RequireRole roles={["LIBRARIAN"]}>
      <Suspense fallback={<PrintSkeleton />}>
        <ReaderCardsView />
      </Suspense>
    </RequireRole>
  );
}
