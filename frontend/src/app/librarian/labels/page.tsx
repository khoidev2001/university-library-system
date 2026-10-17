import type { Metadata } from "next";
import { Suspense } from "react";
import { CopyLabelsView } from "@/components/print/copy-labels-view";
import { RequireRole } from "@/components/require-role";
import { PrintSkeleton } from "@/components/route-skeletons";

export const metadata: Metadata = {
  title: "In nhãn mã vạch",
  description: "In nhãn mã vạch bản sao sách trên giấy decal A4 hoặc cuộn nhãn.",
  robots: { index: false, follow: false },
};

export default function CopyLabelsPage() {
  // useSearchParams cần Suspense để trang vẫn dựng tĩnh được
  return (
    <RequireRole roles={["LIBRARIAN"]}>
      <Suspense fallback={<PrintSkeleton />}>
        <CopyLabelsView />
      </Suspense>
    </RequireRole>
  );
}
