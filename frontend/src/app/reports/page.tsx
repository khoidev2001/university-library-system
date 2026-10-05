import type { Metadata } from "next";
import { ReportsView } from "@/components/reports-view";
import { RequireRole } from "@/components/require-role";

export const metadata: Metadata = {
  title: "Thống kê thư viện",
  description: "Sách mượn nhiều, bạn đọc quá hạn, lượt mượn theo tháng và tồn kho theo thể loại.",
  robots: { index: false, follow: false },
};

export default function ReportsPage() {
  return (
    <RequireRole roles={["LIBRARIAN"]}>
      <ReportsView />
    </RequireRole>
  );
}
