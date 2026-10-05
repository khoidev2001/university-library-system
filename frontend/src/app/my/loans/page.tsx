import type { Metadata } from "next";
import { MyLoansView } from "@/components/my-loans-view";
import { RequireRole } from "@/components/require-role";

export const metadata: Metadata = {
  title: "Sách tôi đang mượn",
  description: "Danh sách sách đang mượn, hạn trả và lịch sử mượn của bạn.",
  robots: { index: false, follow: false },
};

export default function MyLoansPage() {
  return (
    <RequireRole roles={["READER"]}>
      <MyLoansView />
    </RequireRole>
  );
}
