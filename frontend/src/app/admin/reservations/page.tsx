import type { Metadata } from "next";
import { ReservationsAdminView } from "@/components/admin/reservations-admin-view";

export const metadata: Metadata = {
  title: "Đặt trước",
  description: "Hàng đợi bạn đọc đặt trước sách.",
  robots: { index: false, follow: false },
};

export default function AdminReservationsPage() {
  return <ReservationsAdminView />;
}
