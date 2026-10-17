"use client";

import { Check, Copy, Printer } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { SITE } from "@/lib/site";
import { useAuth } from "@/lib/auth";
import type { User } from "@/lib/types";
import { SuccessMark } from "./forms/success-mark";
import { Button } from "./ui";

/** Chỉ in phần phiếu: mọi thành phần khác của trang bị ẩn khi in (phiếu nằm trực tiếp dưới body). */
const PRINT_CSS = `
.print-slip-root { display: none; }
@media print {
  body > *:not(.print-slip-root) { display: none !important; }
  .print-slip-root { display: block !important; }
  @page { margin: 16mm; }
}`;

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Trang không an toàn (http) hoặc bị chặn quyền: dùng cách cũ
    try {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand("copy");
      area.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

/**
 * Hiện mật khẩu tạm đúng một lần, kèm nút sao chép và in phiếu trao cho bạn đọc.
 * Mật khẩu không được lưu ở đâu: đóng hộp thoại là mất.
 */
export function TempPasswordPanel({
  user,
  temporaryPassword,
  heading,
}: {
  user: User;
  temporaryPassword: string;
  heading: string;
}) {
  const { user: staff } = useAuth();
  const [copied, setCopied] = useState<"ok" | "fail" | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(null), 3000);
    return () => clearTimeout(timer);
  }, [copied]);

  const issuedAt = new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date());
  const loginUrl = typeof window === "undefined" ? "" : `${window.location.origin}/login`;

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3.5 rounded-2xl bg-leaf-soft p-4">
        <SuccessMark size={36} onSoft />
        <p role="status" className="pt-1 text-sm font-semibold leading-relaxed text-leaf">
          {heading}
        </p>
      </div>

      <dl className="divide-y divide-line rounded-2xl bg-paper-2 px-4 text-sm">
        <div className="flex justify-between gap-3 py-2.5">
          <dt className="text-ink-soft">Họ tên</dt>
          <dd className="min-w-0 break-words text-right font-semibold">{user.fullName}</dd>
        </div>
        <div className="flex justify-between gap-3 py-2.5">
          <dt className="text-ink-soft">Email đăng nhập</dt>
          <dd className="min-w-0 break-all text-right font-semibold">{user.email}</dd>
        </div>
        {user.memberCode && (
          <div className="flex justify-between gap-3 py-2.5">
            <dt className="text-ink-soft">Mã thẻ</dt>
            <dd className="font-semibold tabular-nums">{user.memberCode}</dd>
          </div>
        )}
      </dl>

      <div className="rounded-2xl border-2 border-dashed border-primary/30 bg-primary-soft/50 p-4 text-center">
        <p className="text-sm font-semibold text-primary-ink">Mật khẩu tạm</p>
        <p
          data-testid="temporary-password"
          className="mt-2 select-all break-all font-mono text-2xl font-bold tracking-wider text-ink"
        >
          {temporaryPassword}
        </p>
      </div>

      <p className="rounded-2xl bg-amber-soft px-4 py-3 text-sm leading-relaxed text-amber">
        Mật khẩu này chỉ hiện một lần. Hãy trao cho người dùng ngay; họ sẽ phải đổi mật khẩu ở lần đăng nhập đầu tiên.
      </p>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          variant="ghost"
          className="flex-1"
          onClick={async () => setCopied((await copyText(temporaryPassword)) ? "ok" : "fail")}
        >
          {copied === "ok" ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
          {copied === "ok" ? "Đã sao chép" : "Sao chép mật khẩu"}
        </Button>
        <Button type="button" variant="ghost" className="flex-1" onClick={() => window.print()}>
          <Printer size={16} aria-hidden="true" />
          In phiếu
        </Button>
      </div>
      <p aria-live="polite" className="min-h-4 text-xs text-ink-faint">
        {copied === "fail" ? "Không sao chép tự động được, hãy chọn và chép mật khẩu bằng tay." : ""}
      </p>

      {mounted &&
        createPortal(
          <div className="print-slip-root">
            <style>{PRINT_CSS}</style>
            <div style={{ fontFamily: "Arial, sans-serif", color: "#000", maxWidth: "120mm", margin: "0 auto" }}>
              <p style={{ fontSize: 12, margin: 0 }}>{SITE.university}</p>
              <h1 style={{ fontSize: 20, margin: "4px 0 12px" }}>Phiếu cấp mật khẩu tạm</h1>
              <table style={{ width: "100%", fontSize: 14, borderCollapse: "collapse" }}>
                <tbody>
                  <tr>
                    <td style={{ padding: "4px 0", width: "38%" }}>Họ tên</td>
                    <td style={{ padding: "4px 0", fontWeight: 700 }}>{user.fullName}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: "4px 0" }}>Email đăng nhập</td>
                    <td style={{ padding: "4px 0", fontWeight: 700 }}>{user.email}</td>
                  </tr>
                  {user.memberCode && (
                    <tr>
                      <td style={{ padding: "4px 0" }}>Mã thẻ</td>
                      <td style={{ padding: "4px 0", fontWeight: 700 }}>{user.memberCode}</td>
                    </tr>
                  )}
                </tbody>
              </table>
              <p style={{ fontSize: 12, margin: "16px 0 4px" }}>Mật khẩu tạm</p>
              <p
                style={{
                  fontFamily: "'Courier New', monospace",
                  fontSize: 26,
                  fontWeight: 700,
                  letterSpacing: 2,
                  border: "2px solid #000",
                  padding: "10px 12px",
                  margin: 0,
                  wordBreak: "break-all",
                }}
              >
                {temporaryPassword}
              </p>
              <ol style={{ fontSize: 13, lineHeight: 1.6, paddingLeft: 18, marginTop: 16 }}>
                <li>Đăng nhập tại: {loginUrl}</li>
                <li>Hệ thống sẽ yêu cầu bạn đặt mật khẩu mới ngay lần đầu.</li>
                <li>Không chia sẻ mật khẩu này. Tờ phiếu này nên được huỷ sau khi nhận.</li>
              </ol>
              <p style={{ fontSize: 11, marginTop: 20 }}>
                Cấp lúc {issuedAt}
                {staff ? ` bởi ${staff.fullName}` : ""}.
              </p>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
