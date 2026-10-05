import type { Metadata } from "next";
import { MyFinesView } from "@/components/my-fines-view";
import { RequireRole } from "@/components/require-role";

export const metadata: Metadata = {
  title: "Tiền phạt của tôi",
  description: "Theo dõi các khoản phạt quá hạn và tình trạng thanh toán.",
  robots: { index: false, follow: false },
};

export default function MyFinesPage() {
  return (
    <RequireRole roles={["READER"]}>
      <MyFinesView />
    </RequireRole>
  );
}
