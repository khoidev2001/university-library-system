import type { Metadata } from "next";
import { MyReservationsView } from "@/components/my-reservations-view";
import { RequireRole } from "@/components/require-role";

export const metadata: Metadata = {
  title: "Sách đã đặt trước",
  description: "Theo dõi vị trí hàng đợi và sách đang được giữ cho bạn.",
  robots: { index: false, follow: false },
};

export default function MyReservationsPage() {
  return (
    <RequireRole roles={["READER"]}>
      <MyReservationsView />
    </RequireRole>
  );
}
