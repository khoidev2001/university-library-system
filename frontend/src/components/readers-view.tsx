"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CreditCard, KeyRound, Lock, LockOpen, Printer, Search, UserPlus, Users } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ApiError, apiFetch, formatCurrency } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Page, User, UserDetail } from "@/lib/types";
import { Avatar, StatusPill } from "./avatar";
import { ExportButtons } from "./export-buttons";
import { Checkbox, fieldClass } from "./forms/controls";
import { Alert, Button, ButtonLink, PageHeading, Skeleton } from "./ui";
import "./ux-motion.css";

// Hộp thoại chỉ cần khi thủ thư bấm nút: tải lười để trang danh sách nhẹ hơn
const CreateReaderModal = dynamic(() => import("./create-reader-modal").then((m) => m.CreateReaderModal), { ssr: false });
const ResetPasswordModal = dynamic(() => import("./reset-password-modal").then((m) => m.ResetPasswordModal), { ssr: false });

const CARD = "rounded-[1.5rem] border border-line bg-white shadow-[var(--shadow-card)]";
const typeLabel = (type: User["memberType"]) => (type === "LECTURER" ? "Giảng viên" : "Sinh viên");

export function ReadersView() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [notice, setNotice] = useState<{ tone: "good" | "bad"; text: string } | null>(null);
  const [creating, setCreating] = useState(false);
  const [resetting, setResetting] = useState(false);
  const panel = useRef<HTMLElement>(null);

  // Màn hình hẹp: hồ sơ nằm dưới danh sách, cuộn tới đó khi chọn một bạn đọc
  useEffect(() => {
    if (selected !== null && window.matchMedia("(max-width: 1023px)").matches) {
      panel.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [selected]);

  const readers = useQuery({
    queryKey: ["readers", query],
    queryFn: () =>
      apiFetch<Page<User>>(`/users?role=READER&limit=20${query ? `&q=${encodeURIComponent(query)}` : ""}`, { token }),
    enabled: !!token,
  });

  const detail = useQuery({
    queryKey: ["reader", selected],
    queryFn: () => apiFetch<UserDetail>(`/users/${selected}`, { token }),
    enabled: !!token && selected !== null,
  });

  const toggleLock = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      apiFetch<User>(`/users/${id}`, { method: "PATCH", body: { isActive }, token }),
    onSuccess: (user) => {
      setNotice({
        tone: "good",
        text: user.isActive ? `Đã mở thẻ cho ${user.fullName}.` : `Đã khoá thẻ của ${user.fullName}.`,
      });
      queryClient.invalidateQueries({ queryKey: ["readers"] });
      queryClient.invalidateQueries({ queryKey: ["reader"] });
    },
    onError: (error) =>
      setNotice({ tone: "bad", text: error instanceof ApiError ? error.friendlyMessage : "Không cập nhật được." }),
  });

  const items = readers.data?.items ?? [];
  const allPicked = items.length > 0 && items.every((r) => picked.has(r.id));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <PageHeading
        title="Quản lý bạn đọc"
        description="Tra cứu theo tên, email hoặc mã thẻ. Xem tình trạng mượn, khoá thẻ, cấp mật khẩu tạm và thêm bạn đọc mới tại quầy."
        action={
          <Button onClick={() => setCreating(true)}>
            <UserPlus size={18} aria-hidden="true" />
            Thêm bạn đọc
          </Button>
        }
      />

      {notice && (
        <div className="mt-5">
          <Alert tone={notice.tone}>{notice.text}</Alert>
        </div>
      )}

      {/* Thanh công cụ: tìm kiếm, xuất dữ liệu, in thẻ */}
      <div className={`${CARD} mt-6 space-y-4 p-4 sm:p-5`}>
        <form
          className="flex w-full max-w-xl gap-2"
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            setQuery(search.trim());
            setSelected(null);
          }}
        >
          <label htmlFor="o-tim-ban-doc" className="sr-only">
            Tìm bạn đọc
          </label>
          <div className="relative min-w-0 flex-1">
            <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-faint" aria-hidden="true" />
            <input
              id="o-tim-ban-doc"
              type="search"
              autoComplete="off"
              enterKeyHint="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className={fieldClass({ extra: "pl-11" })}
              placeholder="Tên, email hoặc mã sinh viên"
            />
          </div>
          <Button type="submit" className="min-h-12">
            Tìm
          </Button>
        </form>
        <div className="flex flex-wrap items-start justify-between gap-3 border-t border-line pt-4">
          <ExportButtons dataset="readers" subject="danh sách bạn đọc" params={{ q: query }} />
          <div className="flex flex-wrap items-center gap-2">
            {picked.size > 0 ? (
              <ButtonLink href={`/librarian/readers/cards?ids=${[...picked].join(",")}`} variant="soft">
                <Printer size={16} aria-hidden="true" />
                In thẻ đã chọn ({picked.size})
              </ButtonLink>
            ) : (
              <Button type="button" variant="ghost" disabled title="Tích chọn bạn đọc trong danh sách để in thẻ">
                <Printer size={16} aria-hidden="true" />
                In thẻ đã chọn
              </Button>
            )}
            <ButtonLink href={`/librarian/readers/cards${query ? `?q=${encodeURIComponent(query)}` : ""}`} variant="ghost">
              {query ? "In thẻ theo kết quả tìm" : "In thẻ tất cả bạn đọc"}
            </ButtonLink>
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
        <section aria-label="Danh sách bạn đọc" className={`${CARD} overflow-hidden`}>
          <div className="flex items-center gap-3 border-b border-line bg-paper/70 px-4 py-2.5">
            <Checkbox
              label="Chọn tất cả bạn đọc trên trang này"
              checked={allPicked}
              onChange={(checked) => {
                const next = new Set(picked);
                for (const r of items) {
                  if (checked) next.add(r.id);
                  else next.delete(r.id);
                }
                setPicked(next);
              }}
            />
            <p className="text-sm text-ink-soft" aria-live="polite">
              {readers.isLoading
                ? "Đang tải danh sách..."
                : readers.data
                  ? `Hiển thị ${items.length} trên ${readers.data.total.toLocaleString("vi-VN")} bạn đọc`
                  : ""}
            </p>
          </div>

          {readers.isLoading ? (
            <div className="space-y-2 p-4" role="status" aria-label="Đang tải danh sách bạn đọc">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-[4.25rem]" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-14 text-center">
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-primary-soft text-primary" aria-hidden="true">
                <Users size={26} />
              </span>
              <p className="mt-4 text-lg font-bold">Không tìm thấy bạn đọc phù hợp.</p>
              <p className="mt-1 max-w-sm text-sm text-ink-soft">Thử tìm bằng một phần tên, email hoặc mã sinh viên khác.</p>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {items.map((reader, index) => {
                const active = selected === reader.id;
                return (
                  <li
                    key={reader.id}
                    className={`ux-row-in flex items-center gap-2 px-4 py-2 transition-colors sm:gap-3 ${active ? "bg-primary-soft/60" : "hover:bg-paper/70"}`}
                    style={{ animationDelay: `${Math.min(index, 10) * 30}ms` }}
                  >
                    <Checkbox
                      label={`Chọn ${reader.fullName} để in thẻ`}
                      checked={picked.has(reader.id)}
                      onChange={(checked) => {
                        const next = new Set(picked);
                        if (checked) next.add(reader.id);
                        else next.delete(reader.id);
                        setPicked(next);
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setSelected(reader.id)}
                      aria-label={`Xem hồ sơ ${reader.fullName}`}
                      aria-current={active ? "true" : undefined}
                      className="flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-xl text-left"
                    >
                      <Avatar name={reader.fullName} size="md" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{reader.fullName}</span>
                        <span className="block truncate text-xs text-ink-faint">{reader.email}</span>
                        <span className="mt-0.5 block text-xs text-ink-soft sm:hidden">
                          {reader.memberCode}, {typeLabel(reader.memberType)}
                        </span>
                      </span>
                    </button>
                    <span className="hidden w-36 shrink-0 text-sm sm:block">
                      <span className="block font-medium tabular-nums">{reader.memberCode}</span>
                      <span className="block text-xs text-ink-faint">{typeLabel(reader.memberType)}</span>
                    </span>
                    <span className="hidden shrink-0 md:block">
                      {reader.isActive ? <StatusPill tone="good">Hoạt động</StatusPill> : <StatusPill tone="bad">Đang khoá</StatusPill>}
                    </span>
                    <Link
                      href={`/librarian/readers/${reader.id}/card`}
                      aria-label={`In thẻ của ${reader.fullName}`}
                      title="In thẻ"
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-ink-soft transition-colors hover:bg-paper-2 hover:text-primary"
                    >
                      <CreditCard size={19} aria-hidden="true" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <aside aria-label="Hồ sơ bạn đọc" ref={panel} className="scroll-mt-24 lg:sticky lg:top-24">
          {selected === null ? (
            <div className="rounded-[1.5rem] border border-dashed border-line bg-white/70 px-6 py-12 text-center">
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary-soft text-primary" aria-hidden="true">
                <Users size={26} />
              </span>
              <p className="mt-4 text-sm leading-relaxed text-ink-soft">Chọn một bạn đọc để xem hồ sơ chi tiết.</p>
            </div>
          ) : detail.isLoading ? (
            <div className={`${CARD} space-y-4 p-6`} role="status" aria-label="Đang tải hồ sơ">
              <Skeleton className="h-20 w-20 rounded-[1.5rem]" />
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-24" />
            </div>
          ) : detail.data ? (
            <div key={detail.data.id} className={`${CARD} anim-sheet p-6`}>
              <div className="flex items-start gap-4">
                <Avatar name={detail.data.fullName} size="xl" />
                <div className="min-w-0 pt-1">
                  <h2 className="text-xl font-bold leading-tight tracking-tight">{detail.data.fullName}</h2>
                  <p className="mt-1 break-all text-sm text-ink-soft">{detail.data.email}</p>
                  <div className="mt-2.5">
                    {detail.data.isActive ? <StatusPill tone="good">Hoạt động</StatusPill> : <StatusPill tone="bad">Đang khoá</StatusPill>}
                  </div>
                </div>
              </div>

              <dl className="mt-5 grid grid-cols-3 gap-2.5 text-center">
                <div className="rounded-2xl bg-paper-2 px-2 py-3">
                  <dt className="text-xs text-ink-soft">Đang mượn</dt>
                  <dd className="mt-1 text-xl font-bold tabular-nums">
                    {detail.data.activeLoans}
                    <span className="ml-1 text-xs font-medium text-ink-soft">cuốn</span>
                  </dd>
                </div>
                <div className={`rounded-2xl px-2 py-3 ${detail.data.overdueLoans > 0 ? "bg-danger-soft" : "bg-leaf-soft"}`}>
                  <dt className={`text-xs ${detail.data.overdueLoans > 0 ? "text-danger" : "text-leaf"}`}>Quá hạn</dt>
                  <dd className={`mt-1 text-xl font-bold tabular-nums ${detail.data.overdueLoans > 0 ? "text-danger" : "text-leaf"}`}>
                    {detail.data.overdueLoans > 0 ? (
                      <>
                        {detail.data.overdueLoans}
                        <span className="ml-1 text-xs font-medium">cuốn</span>
                      </>
                    ) : (
                      <span className="text-base">Không có</span>
                    )}
                  </dd>
                </div>
                <div className={`rounded-2xl px-2 py-3 ${detail.data.unpaidFines > 0 ? "bg-danger-soft" : "bg-paper-2"}`}>
                  <dt className={`text-xs ${detail.data.unpaidFines > 0 ? "text-danger" : "text-ink-soft"}`}>Nợ phạt</dt>
                  <dd className={`mt-1 font-bold tabular-nums ${detail.data.unpaidFines > 0 ? "text-sm text-danger sm:text-base" : "text-base"}`}>
                    {detail.data.unpaidFines > 0 ? formatCurrency(detail.data.unpaidFines) : "Không"}
                  </dd>
                </div>
              </dl>

              <dl className="mt-4 divide-y divide-line text-sm">
                <div className="flex items-center justify-between gap-3 py-2.5">
                  <dt className="text-ink-soft">Mã thẻ</dt>
                  <dd className="font-semibold tabular-nums">{detail.data.memberCode}</dd>
                </div>
                <div className="flex items-center justify-between gap-3 py-2.5">
                  <dt className="text-ink-soft">Đối tượng</dt>
                  <dd className="font-semibold">{typeLabel(detail.data.memberType)}</dd>
                </div>
              </dl>

              <div className="mt-4 space-y-2">
                <Button
                  variant={detail.data.isActive ? "danger" : "primary"}
                  className="w-full"
                  disabled={toggleLock.isPending}
                  onClick={() => toggleLock.mutate({ id: detail.data!.id, isActive: !detail.data!.isActive })}
                >
                  {detail.data.isActive ? <Lock size={17} aria-hidden="true" /> : <LockOpen size={17} aria-hidden="true" />}
                  {detail.data.isActive ? "Khoá thẻ bạn đọc" : "Mở thẻ bạn đọc"}
                </Button>
                <Button variant="ghost" className="w-full" onClick={() => setResetting(true)}>
                  <KeyRound size={17} aria-hidden="true" />
                  Cấp lại mật khẩu
                </Button>
                <div className="flex [&>a]:w-full">
                  <ButtonLink href={`/librarian/readers/${detail.data.id}/card`} variant="ghost">
                    <CreditCard size={17} aria-hidden="true" />
                    In thẻ bạn đọc
                  </ButtonLink>
                </div>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-ink-faint">
                Cấp lại mật khẩu dùng khi bạn đọc quên mật khẩu mà không nhận được email. Mật khẩu tạm hiện một lần để thủ thư
                trao lại.
              </p>
            </div>
          ) : null}
        </aside>
      </div>

      {creating && (
        <CreateReaderModal
          onClose={() => setCreating(false)}
          onCreated={() => queryClient.invalidateQueries({ queryKey: ["readers"] })}
        />
      )}
      {resetting && detail.data && (
        <ResetPasswordModal
          target={detail.data}
          onClose={() => setResetting(false)}
          onDone={() => queryClient.invalidateQueries({ queryKey: ["reader"] })}
        />
      )}
    </div>
  );
}
