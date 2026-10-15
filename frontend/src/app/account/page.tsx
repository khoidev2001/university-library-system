import type { Metadata } from "next";
import { AccountView } from "@/components/account-view";

export const metadata: Metadata = {
  title: "Tài khoản của tôi",
  description: "Xem thông tin tài khoản, đổi mật khẩu và chọn cách nhận nhắc hạn trả sách.",
  robots: { index: false, follow: false },
};

export default function AccountPage() {
  return <AccountView />;
}
