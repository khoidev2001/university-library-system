import type { Metadata } from "next";
import { CirculationDesk } from "@/components/circulation-desk";
import { RequireRole } from "@/components/require-role";

export const metadata: Metadata = {
  title: "Quầy mượn trả",
  description: "Màn hình nghiệp vụ cho thủ thư: cho mượn, nhận trả và theo dõi phiếu quá hạn.",
  robots: { index: false, follow: false },
};

export default function DeskPage() {
  return (
    <RequireRole roles={["LIBRARIAN"]}>
      <CirculationDesk />
    </RequireRole>
  );
}
