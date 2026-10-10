import type { Metadata } from "next";
import { Suspense } from "react";
import { LoansAdminView } from "@/components/admin/loans-admin-view";
import { Spinner } from "@/components/ui";

export const metadata: Metadata = {
  title: "Phiếu mượn",
  description: "Theo dõi mọi phiếu mượn, nhận trả hoặc ghi nhận mất sách.",
  robots: { index: false, follow: false },
};

export default function AdminLoansPage() {
  // useSearchParams cần Suspense để trang vẫn dựng tĩnh được
  return (
    <Suspense fallback={<Spinner />}>
      <LoansAdminView />
    </Suspense>
  );
}
