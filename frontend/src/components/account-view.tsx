"use client";

import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { ApiError, apiFetch, formatDate } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { User } from "@/lib/types";
import { Alert, Badge, Button, Card, Field, PageHeading, Spinner, inputClass } from "./ui";

const ROLE_LABEL = { READER: "Bạn đọc", LIBRARIAN: "Thủ thư", ADMIN: "Quản trị viên" } as const;
const MEMBER_LABEL = { STUDENT: "Sinh viên", LECTURER: "Giảng viên" } as const;

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "Chưa có";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.friendlyMessage : fallback;
}

function AccountViewInner() {
  const { user, loading } = useAuth();
  const forced = useSearchParams().get("forced") === "1" || !!user?.mustChangePassword;

  if (loading) return <Spinner label="Đang tải tài khoản" />;
  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center sm:px-6">
        <h1 className="font-serif text-2xl font-bold">Cần đăng nhập</h1>
        <p className="mt-2 text-sm text-ink-soft">Đăng nhập để xem và chỉnh sửa tài khoản của bạn.</p>
        <Link
          href="/login?next=%2Faccount"
          className="mt-6 inline-flex min-h-10 items-center rounded-md bg-ink px-5 py-2.5 text-sm font-medium text-paper hover:bg-ink/90"
        >
          Đăng nhập
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <PageHeading
        eyebrow="Tài khoản"
        title="Tài khoản của tôi"
        description={
          forced
            ? undefined
            : "Xem thông tin, đổi tên hiển thị, đổi mật khẩu và chọn cách nhận nhắc hạn trả sách."
        }
      />

      {user.mustChangePassword && (
        <div className="mt-5">
          <Alert tone="info">
            <strong className="font-semibold text-ink">Bạn đang dùng mật khẩu tạm.</strong> Hãy đặt mật khẩu mới để tiếp
            tục sử dụng hệ thống.
          </Alert>
        </div>
      )}

      <div className="mt-6 space-y-6">
        {user.mustChangePassword ? (
          <ChangePasswordCard forced />
        ) : (
          <>
            <ProfileCard user={user} />
            <RemindersCard user={user} />
            <ChangePasswordCard forced={false} />
            <LoginInfoCard user={user} />
          </>
        )}
      </div>
    </div>
  );
}

function ProfileCard({ user }: { user: User }) {
  const { token, updateUser } = useAuth();
  const [fullName, setFullName] = useState(user.fullName);
  const [notice, setNotice] = useState<{ tone: "good" | "bad"; text: string } | null>(null);

  const save = useMutation({
    mutationFn: () =>
      apiFetch<User>("/auth/me", { method: "PATCH", body: { fullName: fullName.trim() }, token }),
    onSuccess: (updated) => {
      updateUser(updated);
      setFullName(updated.fullName);
      setNotice({ tone: "good", text: "Đã lưu tên hiển thị." });
    },
    onError: (error) => setNotice({ tone: "bad", text: errorMessage(error, "Không lưu được, vui lòng thử lại.") }),
  });

  const unchanged = fullName.trim() === user.fullName;

  return (
    <Card>
      <h2 className="font-serif text-lg font-bold">Thông tin tài khoản</h2>
      <dl className="mt-4 space-y-3 text-sm">
        <Row label="Email">{user.email}</Row>
        <Row label="Vai trò">
          <Badge tone="info">{ROLE_LABEL[user.role]}</Badge>
        </Row>
        {user.role === "READER" && (
          <>
            <Row label="Đối tượng">{user.memberType ? MEMBER_LABEL[user.memberType] : "Chưa có"}</Row>
            <Row label="Mã thẻ">{user.memberCode ?? "Chưa có"}</Row>
          </>
        )}
        {user.createdAt && <Row label="Ngày tạo">{formatDate(user.createdAt)}</Row>}
      </dl>
      <p className="mt-3 text-xs text-ink-faint">
        Email, vai trò và mã thẻ do thư viện quản lý; cần đổi hãy liên hệ thủ thư.
      </p>

      <form
        className="mt-5 space-y-3 border-t border-line pt-5"
        onSubmit={(event) => {
          event.preventDefault();
          setNotice(null);
          save.mutate();
        }}
      >
        <Field label="Họ và tên hiển thị" htmlFor="account-full-name">
          <input
            id="account-full-name"
            required
            minLength={2}
            maxLength={100}
            autoComplete="name"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            className={inputClass}
          />
        </Field>
        {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}
        <Button type="submit" disabled={save.isPending || unchanged} className="w-full sm:w-auto">
          {save.isPending ? "Đang lưu..." : "Lưu tên"}
        </Button>
      </form>
    </Card>
  );
}

function RemindersCard({ user }: { user: User }) {
  const { token, updateUser } = useAuth();
  const [notice, setNotice] = useState<{ tone: "good" | "bad"; text: string } | null>(null);
  const enabled = user.emailReminders !== false;

  const toggle = useMutation({
    mutationFn: (next: boolean) =>
      apiFetch<User>("/auth/me", { method: "PATCH", body: { emailReminders: next }, token }),
    onSuccess: (updated) => {
      updateUser(updated);
      setNotice({
        tone: "good",
        text: updated.emailReminders ? "Đã bật nhắc hạn qua email." : "Đã tắt nhắc hạn qua email.",
      });
    },
    onError: (error) => setNotice({ tone: "bad", text: errorMessage(error, "Không lưu được, vui lòng thử lại.") }),
  });

  return (
    <Card>
      <h2 className="font-serif text-lg font-bold">Nhắc hạn trả sách</h2>
      <label htmlFor="account-email-reminders" className="mt-3 flex min-h-11 cursor-pointer items-start gap-3 py-1">
        <input
          id="account-email-reminders"
          type="checkbox"
          checked={enabled}
          disabled={toggle.isPending}
          onChange={(event) => {
            setNotice(null);
            toggle.mutate(event.target.checked);
          }}
          className="mt-0.5 h-5 w-5 shrink-0 accent-ink"
        />
        <span className="text-sm">
          <span className="block font-medium">Gửi email khi sách sắp đến hạn hoặc đã quá hạn</span>
          <span className="mt-0.5 block text-ink-soft">
            Mỗi cuốn chỉ nhắc một lần cho mỗi loại. Thông báo trong web luôn hiển thị, dù bạn tắt email.
          </span>
        </span>
      </label>
      {notice && (
        <div className="mt-3">
          <Alert tone={notice.tone}>{notice.text}</Alert>
        </div>
      )}
    </Card>
  );
}

function ChangePasswordCard({ forced }: { forced: boolean }) {
  const { token, user, updateUser } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ current: "", next: "", confirm: "" });
  const [notice, setNotice] = useState<{ tone: "good" | "bad"; text: string } | null>(null);

  const change = useMutation({
    mutationFn: () =>
      apiFetch<User>("/auth/change-password", {
        method: "POST",
        body: { currentPassword: form.current, newPassword: form.next },
        token,
      }),
    onSuccess: (updated) => {
      updateUser(updated);
      setForm({ current: "", next: "", confirm: "" });
      setNotice({ tone: "good", text: "Đã đổi mật khẩu." });
      if (forced) {
        router.replace(updated.role === "READER" ? "/my/loans" : updated.role === "ADMIN" ? "/admin" : "/librarian/desk");
      }
    },
    onError: (error) => setNotice({ tone: "bad", text: errorMessage(error, "Không đổi được mật khẩu, vui lòng thử lại.") }),
  });

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setNotice(null);
    if (form.next !== form.confirm) {
      setNotice({ tone: "bad", text: "Hai mật khẩu mới nhập vào không giống nhau." });
      return;
    }
    if (form.next === form.current) {
      setNotice({ tone: "bad", text: "Mật khẩu mới phải khác mật khẩu hiện tại." });
      return;
    }
    change.mutate();
  }

  return (
    <Card>
      <h2 className="font-serif text-lg font-bold">Đổi mật khẩu</h2>
      <form onSubmit={onSubmit} className="mt-4 space-y-4">
        {/* Giúp trình quản lý mật khẩu của trình duyệt biết đang đổi mật khẩu của tài khoản nào */}
        <input type="text" name="username" autoComplete="username" value={user?.email ?? ""} readOnly hidden />
        <Field
          label={forced ? "Mật khẩu tạm đã nhận" : "Mật khẩu hiện tại"}
          htmlFor="account-current-password"
        >
          <input
            id="account-current-password"
            type="password"
            required
            autoComplete="current-password"
            value={form.current}
            onChange={(event) => setForm({ ...form, current: event.target.value })}
            className={inputClass}
          />
        </Field>
        <Field label="Mật khẩu mới" htmlFor="account-new-password" hint="Từ 8 ký tự trở lên">
          <input
            id="account-new-password"
            type="password"
            required
            minLength={8}
            maxLength={72}
            autoComplete="new-password"
            value={form.next}
            onChange={(event) => setForm({ ...form, next: event.target.value })}
            className={inputClass}
          />
        </Field>
        <Field label="Nhập lại mật khẩu mới" htmlFor="account-confirm-password">
          <input
            id="account-confirm-password"
            type="password"
            required
            minLength={8}
            maxLength={72}
            autoComplete="new-password"
            value={form.confirm}
            onChange={(event) => setForm({ ...form, confirm: event.target.value })}
            className={inputClass}
          />
        </Field>
        {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}
        <Button type="submit" disabled={change.isPending} className="w-full sm:w-auto">
          {change.isPending ? "Đang đổi..." : "Đổi mật khẩu"}
        </Button>
      </form>
    </Card>
  );
}

function LoginInfoCard({ user }: { user: User }) {
  return (
    <Card>
      <h2 className="font-serif text-lg font-bold">Thông tin đăng nhập</h2>
      <dl className="mt-4 space-y-3 text-sm">
        <Row label="Đăng nhập lần này">{formatDateTime(user.lastLoginAt)}</Row>
        <Row label="Lần đăng nhập trước">{formatDateTime(user.previousLoginAt)}</Row>
        <Row label="Đổi mật khẩu gần nhất">{formatDateTime(user.passwordChangedAt)}</Row>
      </dl>
      <p className="mt-3 text-xs text-ink-faint">
        Nếu thấy lần đăng nhập trước không phải của bạn, hãy đổi mật khẩu ngay.
      </p>
    </Card>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-line pb-3 last:border-none last:pb-0">
      <dt className="text-ink-faint">{label}</dt>
      <dd className="min-w-0 break-words text-right font-medium">{children}</dd>
    </div>
  );
}

export function AccountView() {
  return (
    <Suspense fallback={<Spinner label="Đang tải tài khoản" />}>
      <AccountViewInner />
    </Suspense>
  );
}
