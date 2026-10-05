import type { Metadata } from "next";
import { PoliciesView } from "@/components/policies-view";
import { RequireRole } from "@/components/require-role";

export const metadata: Metadata = {
  title: "Chính sách mượn",
  description: "Cấu hình số cuốn tối đa, thời hạn mượn, số lần gia hạn và mức phạt theo đối tượng bạn đọc.",
  robots: { index: false, follow: false },
};

export default function PoliciesPage() {
  return (
    <RequireRole roles={["ADMIN"]}>
      <PoliciesView />
    </RequireRole>
  );
}
