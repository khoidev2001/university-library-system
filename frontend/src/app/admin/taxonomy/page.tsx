import type { Metadata } from "next";
import { TaxonomyView } from "@/components/admin/taxonomy-view";

export const metadata: Metadata = {
  title: "Tác giả và thể loại",
  description: "Quản lý danh mục tác giả và thể loại sách.",
  robots: { index: false, follow: false },
};

export default function AdminTaxonomyPage() {
  return <TaxonomyView />;
}
