import type { Metadata } from "next";
import { BooksAdminView } from "@/components/admin/books-admin-view";

export const metadata: Metadata = {
  title: "Quản lý sách",
  description: "Thêm, sửa, xoá đầu sách và quản lý bản sao trong kho.",
  robots: { index: false, follow: false },
};

export default function AdminBooksPage() {
  return <BooksAdminView />;
}
