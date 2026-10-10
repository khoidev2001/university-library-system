import type { Metadata } from "next";
import { DashboardView } from "@/components/admin/dashboard-view";

export const metadata: Metadata = {
  title: "Bảng điều khiển quản trị",
  description: "Tổng quan hoạt động thư viện: số đầu sách, phiếu mượn, quá hạn và khoản phạt.",
  robots: { index: false, follow: false },
};

export default function AdminDashboardPage() {
  return <DashboardView />;
}
