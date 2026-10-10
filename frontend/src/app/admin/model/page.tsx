import type { Metadata } from "next";
import { ModelAdminView } from "@/components/admin/model-admin-view";

export const metadata: Metadata = {
  title: "Mô hình gợi ý và dự báo",
  description: "Số đo chất lượng mô hình gợi ý sách, dự báo trả trễ và huấn luyện lại.",
  robots: { index: false, follow: false },
};

export default function AdminModelPage() {
  return <ModelAdminView />;
}
