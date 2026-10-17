"use client";

import { useMutation } from "@tanstack/react-query";
import { BellRing, History, KeyRound, UserRound } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useId, useRef, useState } from "react";
import { ApiError, apiFetch, formatDate } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { User } from "@/lib/types";
import { Avatar } from "./avatar";
import { InlineSpinner, PasswordField, Switch, TextField } from "./forms/controls";
import { Alert, Badge, Button, ButtonLink, PageHeading, Skeleton } from "./ui";

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

/** Một mục cài đặt: biểu tượng, tiêu đề, mô tả ngắn, rồi nội dung. */
function Section({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="rounded-[1.5rem] border border-line bg-white p-5 shadow-[var(--shadow-card)] sm:p-7">
      <div className="flex items-start gap-3.5">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary-soft text-primary" aria-hidden="true">
          {icon}
        </span>
        <div className="min-w-0 pt-0.5">
          <h2 id={id} className="text-lg font-bold leading-tight tracking-tight">
            {title}
          </h2>
          {description && <p className="mt-1 text-sm leading-relaxed text-ink-soft">{description}</p>}
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function AccountSkeleton() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10" role="status" aria-label="Đang tải tài khoản">
      <Skeleton className="h-9 w-64" />
      <div className="mt-8 grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        <Skeleton className="h-80 rounded-[1.5rem]" />
        <div className="space-y-5">
          <Skeleton className="h-44 rounded-[1.5rem]" />
          <Skeleton className="h-40 rounded-[1.5rem]" />
        </div>
      </div>
    </div>
  );
}

function AccountViewInner() {
  const { user, loading } = useAuth();
  const forced = useSearchParams().get("forced") === "1" || !!user?.mustChangePassword;

  if (loading) return <AccountSkeleton />;
  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center sm:px-6">
        <h1 className="text-2xl font-bold">Cần đăng nhập</h1>
        <p className="mt-2 text-sm text-ink-soft">Đăng nhập để xem và chỉnh sửa tài khoản của bạn.</p>
        <div className="mt-6 flex justify-center">
          <ButtonLink href="/login?next=%2Faccount">Đăng nhập</ButtonLink>
        </div>
      </div>
    );
  }

  if (user.mustChangePassword) {
    return (
      <div className="mx-auto max-w-xl px-4 py-8 sm:px-6 sm:py-10">
        <PageHeading title="Đặt mật khẩu mới" />
        <div className="mt-5">
          <Alert tone="info">
            <strong className="font-semibold text-ink">Bạn đang dùng mật khẩu tạm.</strong> Hãy đặt mật khẩu mới để tiếp tục
            sử dụng hệ thống.
          </Alert>
        </div>
        <div className="mt-5">
          <ChangePasswordCard forced />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <PageHeading
        title="Tài khoản của tôi"
        description={forced ? undefined : "Xem thông tin, đổi tên hiển thị, đổi mật khẩu và chọn cách nhận nhắc hạn trả sách."}
      />

      <div className="mt-8 grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start">
        <ProfileHero user={user} />
        <div className="space-y-5">
          <NameCard user={user} />
          <RemindersCard user={user} />
          <ChangePasswordCard forced={false} />
          <LoginInfoCard user={user} />
        </div>
      </div>
    </div>
  );
}

/** Thẻ hồ sơ: ảnh chữ cái lớn, vai trò và thông tin do thư viện quản lý. */
function ProfileHero({ user }: { user: User }) {
  return (
    <aside aria-label="Hồ sơ" className="overflow-hidden rounded-[1.5rem] border border-line bg-white shadow-[var(--shadow-card)] lg:sticky lg:top-24">
      <div className="h-24 bg-[linear-gradient(120deg,var(--color-primary-soft),var(--color-mint-soft))]" aria-hidden="true" />
      <div className="px-6 pb-6">
        <Avatar name={user.fullName} size="xl" className="-mt-10 ring-4 ring-white" />
        <h2 className="mt-3 text-xl font-bold leading-tight tracking-tight">{user.fullName}</h2>
        <p className="mt-1 break-all text-sm text-ink-soft">{user.email}</p>
        <div className="mt-3">
          <Badge tone="info">{ROLE_LABEL[user.role]}</Badge>
        </div>

        <dl className="mt-5 divide-y divide-line text-sm">
          {user.role === "READER" && (
            <>
              <Row label="Đối tượng">{user.memberType ? MEMBER_LABEL[user.memberType] : "Chưa có"}</Row>
              <Row label="Mã thẻ">{user.memberCode ?? "Chưa có"}</Row>
            </>
          )}
          {user.createdAt && <Row label="Ngày tạo">{formatDate(user.createdAt)}</Row>}
        </dl>
        <p className="mt-4 text-xs leading-relaxed text-ink-faint">
          Email, vai trò và mã thẻ do thư viện quản lý; cần đổi hãy liên hệ thủ thư.
        </p>
      </div>
    </aside>
  );
}

function NameCard({ user }: { user: User }) {
  const { token, updateUser } = useAuth();
  const [fullName, setFullName] = useState(user.fullName);
  const [nameError, setNameError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "good" | "bad"; text: string } | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  const save = useMutation({
    mutationFn: () => apiFetch<User>("/auth/me", { method: "PATCH", body: { fullName: fullName.trim() }, token }),
    onSuccess: (updated) => {
      updateUser(updated);
      setFullName(updated.fullName);
      setNotice({ tone: "good", text: "Đã lưu tên hiển thị." });
    },
    onError: (error) => setNotice({ tone: "bad", text: errorMessage(error, "Không lưu được, vui lòng thử lại.") }),
  });

  const unchanged = fullName.trim() === user.fullName;

  return (
    <Section icon={<UserRound size={21} />} title="Tên hiển thị" description="Tên này hiện ở góc phải thanh đầu trang.">
      <form
        className="space-y-4"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          setNotice(null);
          if (fullName.trim().length < 2) {
            setNameError("Nhập họ và tên (ít nhất 2 ký tự).");
            nameRef.current?.focus();
            return;
          }
          setNameError(null);
          save.mutate();
        }}
      >
        <TextField
          id="account-full-name"
          ref={nameRef}
          label="Họ và tên hiển thị"
          required
          minLength={2}
          maxLength={100}
          autoComplete="name"
          value={fullName}
          error={nameError}
          onChange={(event) => {
            setFullName(event.target.value);
            if (nameError) setNameError(null);
          }}
        />
        {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}
        <Button type="submit" disabled={save.isPending || unchanged} className="w-full sm:w-auto">
          {save.isPending && <InlineSpinner />}
          {save.isPending ? "Đang lưu..." : "Lưu tên"}
        </Button>
      </form>
    </Section>
  );
}

function RemindersCard({ user }: { user: User }) {
  const { token, updateUser } = useAuth();
  const [notice, setNotice] = useState<{ tone: "good" | "bad"; text: string } | null>(null);
  const enabled = user.emailReminders !== false;

  const toggle = useMutation({
    mutationFn: (next: boolean) => apiFetch<User>("/auth/me", { method: "PATCH", body: { emailReminders: next }, token }),
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
    <Section icon={<BellRing size={21} />} title="Nhắc hạn trả sách">
      <Switch
        id="account-email-reminders"
        checked={enabled}
        disabled={toggle.isPending}
        onChange={(next) => {
          setNotice(null);
          toggle.mutate(next);
        }}
        label="Gửi email khi sách sắp đến hạn hoặc đã quá hạn"
        description="Mỗi cuốn chỉ nhắc một lần cho mỗi loại. Thông báo trong web luôn hiển thị, dù bạn tắt email."
      />
      {notice && (
        <div className="mt-4">
          <Alert tone={notice.tone}>{notice.text}</Alert>
        </div>
      )}
    </Section>
  );
}

function ChangePasswordCard({ forced }: { forced: boolean }) {
  const { token, user, updateUser } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ current: "", next: "", confirm: "" });
  const [errors, setErrors] = useState<Partial<Record<"current" | "next" | "confirm", string>>>({});
  const [notice, setNotice] = useState<{ tone: "good" | "bad"; text: string } | null>(null);
  const refs = {
    current: useRef<HTMLInputElement>(null),
    next: useRef<HTMLInputElement>(null),
    confirm: useRef<HTMLInputElement>(null),
  };

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
    onError: (error) => {
      if (error instanceof ApiError && error.code === "WRONG_CURRENT_PASSWORD") {
        setErrors({ current: error.friendlyMessage });
        refs.current.current?.focus();
        return;
      }
      setNotice({ tone: "bad", text: errorMessage(error, "Không đổi được mật khẩu, vui lòng thử lại.") });
    },
  });

  function set(key: keyof typeof form, value: string) {
    setForm((previous) => ({ ...previous, [key]: value }));
    if (errors[key]) setErrors((previous) => ({ ...previous, [key]: undefined }));
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setNotice(null);
    const found: typeof errors = {};
    if (!form.current) found.current = forced ? "Nhập mật khẩu tạm bạn đã nhận." : "Nhập mật khẩu hiện tại.";
    if (form.next.length < 8) found.next = "Mật khẩu mới cần tối thiểu 8 ký tự.";
    else if (form.next === form.current) found.next = "Mật khẩu mới phải khác mật khẩu hiện tại.";
    if (!form.confirm) found.confirm = "Nhập lại mật khẩu mới để xác nhận.";
    else if (form.next !== form.confirm) found.confirm = "Hai mật khẩu mới nhập vào không giống nhau.";
    setErrors(found);
    const first = (["current", "next", "confirm"] as const).find((key) => found[key]);
    if (first) return refs[first].current?.focus();
    change.mutate();
  }

  return (
    <Section
      icon={<KeyRound size={21} />}
      title="Đổi mật khẩu"
      description={forced ? undefined : "Chọn mật khẩu mới dài ít nhất 8 ký tự."}
    >
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {/* Giúp trình quản lý mật khẩu của trình duyệt biết đang đổi mật khẩu của tài khoản nào */}
        <input type="text" name="username" autoComplete="username" value={user?.email ?? ""} readOnly hidden />
        <PasswordField
          id="account-current-password"
          ref={refs.current}
          label={forced ? "Mật khẩu tạm đã nhận" : "Mật khẩu hiện tại"}
          required
          autoComplete="current-password"
          value={form.current}
          error={errors.current}
          onChange={(event) => set("current", event.target.value)}
        />
        <PasswordField
          id="account-new-password"
          ref={refs.next}
          label="Mật khẩu mới"
          hint="Từ 8 ký tự trở lên"
          required
          minLength={8}
          maxLength={72}
          autoComplete="new-password"
          value={form.next}
          error={errors.next}
          onChange={(event) => set("next", event.target.value)}
        />
        <PasswordField
          id="account-confirm-password"
          ref={refs.confirm}
          label="Nhập lại mật khẩu mới"
          required
          minLength={8}
          maxLength={72}
          autoComplete="new-password"
          value={form.confirm}
          error={errors.confirm}
          onChange={(event) => set("confirm", event.target.value)}
        />
        {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}
        <Button type="submit" disabled={change.isPending} aria-busy={change.isPending} className="w-full sm:w-auto">
          {change.isPending && <InlineSpinner />}
          {change.isPending ? "Đang đổi..." : "Đổi mật khẩu"}
        </Button>
      </form>
    </Section>
  );
}

function LoginInfoCard({ user }: { user: User }) {
  return (
    <Section
      icon={<History size={21} />}
      title="Thông tin đăng nhập"
      description="Nếu thấy lần đăng nhập trước không phải của bạn, hãy đổi mật khẩu ngay."
    >
      <dl className="divide-y divide-line text-sm">
        <Row label="Đăng nhập lần này">{formatDateTime(user.lastLoginAt)}</Row>
        <Row label="Lần đăng nhập trước">{formatDateTime(user.previousLoginAt)}</Row>
        <Row label="Đổi mật khẩu gần nhất">{formatDateTime(user.passwordChangedAt)}</Row>
      </dl>
    </Section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3 first:pt-0 last:pb-0">
      <dt className="text-ink-soft">{label}</dt>
      <dd className="min-w-0 break-words text-right font-semibold tabular-nums">{children}</dd>
    </div>
  );
}

export function AccountView() {
  return (
    <Suspense fallback={<AccountSkeleton />}>
      <AccountViewInner />
    </Suspense>
  );
}
