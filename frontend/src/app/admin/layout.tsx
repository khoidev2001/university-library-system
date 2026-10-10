import { AdminShell } from "@/components/admin/admin-shell";
import { RequireRole } from "@/components/require-role";

/** Mọi trang quản trị dùng chung khung và cùng yêu cầu tối thiểu là thủ thư. */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireRole roles={["LIBRARIAN"]}>
      <AdminShell>{children}</AdminShell>
    </RequireRole>
  );
}
