"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { ApiError, apiFetch, formatCurrency } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Page, User, UserDetail } from "@/lib/types";
import { Alert, Badge, Button, Card, PageHeading, Spinner, inputClass } from "./ui";

// Hộp thoại chỉ cần khi thủ thư bấm nút: tải lười để trang danh sách nhẹ hơn
const CreateReaderModal = dynamic(() => import("./create-reader-modal").then((m) => m.CreateReaderModal), { ssr: false });
const ResetPasswordModal = dynamic(() => import("./reset-password-modal").then((m) => m.ResetPasswordModal), { ssr: false });

export function ReadersView() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
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

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <PageHeading
        eyebrow="Nghiệp vụ thủ thư"
        title="Quản lý bạn đọc"
        description="Tra cứu theo tên, email hoặc mã thẻ. Xem tình trạng mượn, khoá thẻ, cấp mật khẩu tạm và thêm bạn đọc mới tại quầy."
        action={<Button onClick={() => setCreating(true)}>Thêm bạn đọc</Button>}
      />

      {notice && (
        <div className="mt-5">
          <Alert tone={notice.tone}>{notice.text}</Alert>
        </div>
      )}

      <form
        className="mt-6 flex max-w-xl gap-2"
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
        <input
          id="o-tim-ban-doc"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className={inputClass}
          placeholder="Tên, email hoặc mã sinh viên"
        />
        <Button type="submit">Tìm</Button>
      </form>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="relative overflow-x-auto rounded-xl border border-line bg-white">
          {readers.isLoading ? (
            <Spinner />
          ) : (
            <table className="w-full text-sm sm:min-w-[560px]">
              <caption className="sr-only">Danh sách bạn đọc</caption>
              <thead className="border-b border-line bg-paper-2 text-left">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">Họ tên</th>
                  <th scope="col" className="hidden px-4 py-3 font-semibold sm:table-cell">Mã thẻ</th>
                  <th scope="col" className="hidden px-4 py-3 font-semibold sm:table-cell">Đối tượng</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Thẻ</th>
                  <th scope="col" className="px-4 py-3 font-semibold"><span className="sr-only">Thao tác</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {(readers.data?.items ?? []).map((reader) => (
                  <tr key={reader.id} className={selected === reader.id ? "bg-paper-2" : undefined}>
                    <td className="px-4 py-3">
                      <span className="font-medium">{reader.fullName}</span>
                      <span className="block break-all text-xs text-ink-faint">{reader.email}</span>
                      <span className="block text-xs text-ink-faint sm:hidden">
                        {reader.memberCode} · {reader.memberType === "LECTURER" ? "Giảng viên" : "Sinh viên"}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 text-ink-soft sm:table-cell">{reader.memberCode}</td>
                    <td className="hidden px-4 py-3 text-ink-soft sm:table-cell">
                      {reader.memberType === "LECTURER" ? "Giảng viên" : "Sinh viên"}
                    </td>
                    <td className="px-4 py-3">
                      {reader.isActive ? <Badge tone="good">Hoạt động</Badge> : <Badge tone="bad">Đang khoá</Badge>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setSelected(reader.id)}
                        aria-label={`Xem hồ sơ ${reader.fullName}`}
                        className="min-h-10 rounded-md border border-line px-3 py-1.5 text-xs font-medium hover:bg-paper-2"
                      >
                        Xem hồ sơ
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {readers.data?.items.length === 0 && (
            <p className="px-4 py-10 text-center text-sm text-ink-soft">Không tìm thấy bạn đọc phù hợp.</p>
          )}
        </div>

        <aside aria-label="Hồ sơ bạn đọc" ref={panel} className="scroll-mt-20">
          {selected === null ? (
            <Card className="text-sm text-ink-soft">Chọn một bạn đọc để xem hồ sơ chi tiết.</Card>
          ) : detail.isLoading ? (
            <Card><Spinner /></Card>
          ) : detail.data ? (
            <Card>
              <h2 className="font-serif text-lg font-bold">{detail.data.fullName}</h2>
              <p className="mt-0.5 text-sm text-ink-soft">{detail.data.email}</p>
              <dl className="mt-4 space-y-2.5 text-sm">
                <Row label="Mã thẻ">{detail.data.memberCode}</Row>
                <Row label="Đối tượng">
                  {detail.data.memberType === "LECTURER" ? "Giảng viên" : "Sinh viên"}
                </Row>
                <Row label="Đang mượn">{detail.data.activeLoans} cuốn</Row>
                <Row label="Quá hạn">
                  {detail.data.overdueLoans > 0 ? (
                    <Badge tone="bad">{detail.data.overdueLoans} cuốn</Badge>
                  ) : (
                    <Badge tone="good">Không có</Badge>
                  )}
                </Row>
                <Row label="Nợ phạt">
                  {detail.data.unpaidFines > 0 ? (
                    <span className="font-medium text-brand">{formatCurrency(detail.data.unpaidFines)}</span>
                  ) : (
                    "Không"
                  )}
                </Row>
              </dl>
              <Button
                variant={detail.data.isActive ? "danger" : "primary"}
                className="mt-5 w-full"
                disabled={toggleLock.isPending}
                onClick={() => toggleLock.mutate({ id: detail.data!.id, isActive: !detail.data!.isActive })}
              >
                {detail.data.isActive ? "Khoá thẻ bạn đọc" : "Mở thẻ bạn đọc"}
              </Button>
              <Button variant="ghost" className="mt-2 w-full" onClick={() => setResetting(true)}>
                Cấp lại mật khẩu
              </Button>
              <p className="mt-2 text-xs text-ink-faint">
                Dùng khi bạn đọc quên mật khẩu mà không nhận được email. Mật khẩu tạm hiện một lần để thủ thư trao lại.
              </p>
            </Card>
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

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line pb-2 last:border-none">
      <dt className="text-ink-faint">{label}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  );
}
