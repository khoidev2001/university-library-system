import type { Metadata } from "next";
import { Suspense } from "react";
import { FinesAdminView } from "@/components/admin/fines-admin-view";
import { Spinner } from "@/components/ui";

export const metadata: Metadata = {
  title: "Khoản phạt",
  description: "Ghi nhận thu tiền phạt trả trễ và mất sách.",
  robots: { index: false, follow: false },
};

export default function AdminFinesPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <FinesAdminView />
    </Suspense>
  );
}
