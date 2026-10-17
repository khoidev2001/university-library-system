import { AdminShell } from "@/components/admin/admin-shell";
import { RequireRole } from "@/components/require-role";

/** Trang thống kê dùng chung khung quản trị để thủ thư chuyển qua lại giữa các mục không mất menu. */
export default function ReportsLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireRole roles={["LIBRARIAN"]}>
      <AdminShell>{children}</AdminShell>
    </RequireRole>
  );
}
