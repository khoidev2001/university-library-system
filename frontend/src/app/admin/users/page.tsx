import type { Metadata } from "next";
import { UsersAdminView } from "@/components/admin/users-admin-view";
import { RequireRole } from "@/components/require-role";

export const metadata: Metadata = {
  title: "Tài khoản",
  description: "Tạo và quản lý tài khoản thủ thư, quản trị viên và bạn đọc.",
  robots: { index: false, follow: false },
};

export default function AdminUsersPage() {
  return (
    <RequireRole roles={["ADMIN"]}>
      <UsersAdminView />
    </RequireRole>
  );
}
