import type { Metadata } from "next";
import { ReadersView } from "@/components/readers-view";
import { RequireRole } from "@/components/require-role";

export const metadata: Metadata = {
  title: "Quản lý bạn đọc",
  description: "Tra cứu bạn đọc, xem hồ sơ mượn trả và khoá hoặc mở thẻ.",
  robots: { index: false, follow: false },
};

export default function ReadersPage() {
  return (
    <RequireRole roles={["LIBRARIAN"]}>
      <ReadersView />
    </RequireRole>
  );
}
