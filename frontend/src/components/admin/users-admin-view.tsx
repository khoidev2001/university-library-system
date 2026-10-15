"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useState } from "react";
import { apiFetch, formatDate } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Page, Role, User } from "@/lib/types";
import { Badge, Button, Field, PageHeading, Spinner, inputClass } from "../ui";
import { Modal, Pagination, TableShell, Th, Toolbar, errorText, useNotice } from "./admin-ui";

const LIMIT = 15;

// Chỉ tải khi bấm nút
const ResetPasswordModal = dynamic(() => import("../reset-password-modal").then((m) => m.ResetPasswordModal), { ssr: false });

const ROLE_LABEL: Record<Role, string> = {
  READER: "Bạn đọc",
  LIBRARIAN: "Thủ thư",
  ADMIN: "Quản trị viên",
};

export function UsersAdminView() {
  const { token, user: me } = useAuth();
  const queryClient = useQueryClient();
  const { show, node } = useNotice();

  const [role, setRole] = useState<Role>("LIBRARIAN");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<User | null>(null);
  const [creating, setCreating] = useState(false);
  const [resetting, setResetting] = useState<User | null>(null);

  const users = useQuery({
    queryKey: ["admin-users", role, query, page],
    queryFn: () =>
      apiFetch<Page<User>>(
        `/users?role=${role}&limit=${LIMIT}&page=${page}${query ? `&q=${encodeURIComponent(query)}` : ""}`,
        { token },
      ),
    enabled: !!token,
    placeholderData: (previous) => previous,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin-users"] });

  const toggle = useMutation({
    mutationFn: (target: User) =>
      apiFetch<User>(`/users/${target.id}`, { method: "PATCH", body: { isActive: !target.isActive }, token }),
    onSuccess: (updated) => {
      show("good", updated.isActive ? `Đã mở tài khoản ${updated.fullName}.` : `Đã khoá tài khoản ${updated.fullName}.`);
      refresh();
    },
    onError: (error) => show("bad", errorText(error, "Không cập nhật được tài khoản.")),
  });

  return (
    <div>
      <PageHeading
        eyebrow="Hệ thống"
        title="Tài khoản"
        description="Tạo tài khoản thủ thư hoặc quản trị viên, đổi tên và khoá hoặc mở tài khoản. Bạn đọc tự đăng ký ở trang đăng ký."
        action={<Button onClick={() => setCreating(true)}>Tạo tài khoản nhân viên</Button>}
      />
      {node}

      <Toolbar>
        <div role="tablist" aria-label="Loại tài khoản" className="flex gap-1 rounded-lg border border-line bg-white p-1">
          {(["LIBRARIAN", "ADMIN", "READER"] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={role === value}
              onClick={() => {
                setRole(value);
                setPage(1);
              }}
              className={`min-h-10 rounded-md px-3.5 py-1.5 text-sm ${
                role === value ? "bg-ink font-medium text-paper" : "text-ink-soft hover:bg-paper-2"
              }`}
            >
              {ROLE_LABEL[value]}
            </button>
          ))}
        </div>
        <form
          className="flex flex-1 gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            setQuery(search.trim());
            setPage(1);
          }}
        >
          <label htmlFor="admin-users-q" className="sr-only">Tìm tài khoản</label>
          <input id="admin-users-q" value={search} onChange={(e) => setSearch(e.target.value)} className={`${inputClass} max-w-sm`} placeholder="Tên, email hoặc mã" />
          <Button type="submit" variant="ghost">Tìm</Button>
        </form>
      </Toolbar>

      <div className="mt-5">
        {users.isLoading ? (
          <Spinner />
        ) : (
          <TableShell minWidth={640}>
            <caption className="sr-only">Danh sách tài khoản</caption>
            <thead className="border-b border-line bg-paper-2">
              <tr>
                <Th>Họ tên</Th>
                <Th>Vai trò</Th>
                <Th>Ngày tạo</Th>
                <Th>Trạng thái</Th>
                <Th align="right"><span className="sr-only">Thao tác</span></Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {(users.data?.items ?? []).map((row) => {
                const isMe = row.id === me?.id;
                return (
                  <tr key={row.id}>
                    <td className="px-4 py-3">
                      <span className="font-medium">{row.fullName}</span>
                      {isMe && <span className="ml-2 text-xs text-ink-faint">(bạn)</span>}
                      <span className="block text-xs text-ink-faint">{row.email}</span>
                    </td>
                    <td className="px-4 py-3 text-ink-soft">{ROLE_LABEL[row.role]}</td>
                    <td className="px-4 py-3 text-ink-soft">{row.createdAt ? formatDate(row.createdAt) : ""}</td>
                    <td className="px-4 py-3">
                      {row.isActive ? <Badge tone="good">Hoạt động</Badge> : <Badge tone="bad">Đang khoá</Badge>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button type="button" aria-label={`Đổi tên ${row.fullName}`} onClick={() => setEditing(row)} className="min-h-10 rounded-md border border-line px-3 py-1.5 text-xs font-medium hover:bg-paper-2">
                          Đổi tên
                        </button>
                        <button
                          type="button"
                          aria-label={`Cấp lại mật khẩu cho ${row.fullName}`}
                          disabled={isMe}
                          title={isMe ? "Dùng chức năng đổi mật khẩu ở trang tài khoản" : undefined}
                          onClick={() => setResetting(row)}
                          className="min-h-10 rounded-md border border-line px-3 py-1.5 text-xs font-medium hover:bg-paper-2 disabled:opacity-40"
                        >
                          Cấp mật khẩu
                        </button>
                        <button
                          type="button"
                          aria-label={`${row.isActive ? "Khoá" : "Mở khoá"} tài khoản ${row.fullName}`}
                          disabled={isMe || toggle.isPending}
                          title={isMe ? "Không tự khoá tài khoản của mình" : undefined}
                          onClick={() => toggle.mutate(row)}
                          className="min-h-10 rounded-md border border-line px-3 py-1.5 text-xs font-medium hover:bg-paper-2 disabled:opacity-40"
                        >
                          {row.isActive ? "Khoá" : "Mở"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </TableShell>
        )}
        {users.data?.items.length === 0 && <p className="py-10 text-center text-sm text-ink-soft">Không có tài khoản nào.</p>}
        {users.data && <Pagination page={page} total={users.data.total} limit={LIMIT} onPage={setPage} />}
      </div>

      {editing && (
        <RenameModal
          user={editing}
          onClose={() => setEditing(null)}
          onSaved={(message) => {
            setEditing(null);
            show("good", message);
            refresh();
          }}
        />
      )}
      {resetting && <ResetPasswordModal target={resetting} onClose={() => setResetting(null)} onDone={refresh} />}
      {creating && (
        <CreateStaffModal
          onClose={() => setCreating(false)}
          onSaved={(message) => {
            setCreating(false);
            show("good", message);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function RenameModal({ user, onClose, onSaved }: { user: User; onClose: () => void; onSaved: (message: string) => void }) {
  const { token } = useAuth();
  const [fullName, setFullName] = useState(user.fullName);
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () => apiFetch<User>(`/users/${user.id}`, { method: "PATCH", body: { fullName: fullName.trim() }, token }),
    onSuccess: (updated) => onSaved(`Đã đổi tên thành ${updated.fullName}.`),
    onError: (err) => setError(errorText(err, "Không đổi được tên.")),
  });

  return (
    <Modal title="Đổi tên hiển thị" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          save.mutate();
        }}
      >
        <Field label="Họ và tên" htmlFor="rename-name">
          <input id="rename-name" required minLength={2} maxLength={100} value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputClass} />
        </Field>
        {error && <p role="alert" className="rounded-md bg-brand-soft px-3 py-2 text-sm text-brand">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Huỷ</Button>
          <Button type="submit" disabled={save.isPending}>{save.isPending ? "Đang lưu..." : "Lưu"}</Button>
        </div>
      </form>
    </Modal>
  );
}

function CreateStaffModal({ onClose, onSaved }: { onClose: () => void; onSaved: (message: string) => void }) {
  const { token } = useAuth();
  const [form, setForm] = useState({ fullName: "", email: "", password: "", role: "LIBRARIAN" as "LIBRARIAN" | "ADMIN" });
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () =>
      apiFetch<User>("/users", {
        method: "POST",
        body: { ...form, fullName: form.fullName.trim(), email: form.email.trim() },
        token,
      }),
    onSuccess: (created) => onSaved(`Đã tạo tài khoản ${ROLE_LABEL[created.role].toLowerCase()} ${created.fullName}.`),
    onError: (err) => setError(errorText(err, "Không tạo được tài khoản.")),
  });

  return (
    <Modal title="Tạo tài khoản nhân viên" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          save.mutate();
        }}
      >
        <Field label="Họ và tên" htmlFor="staff-name">
          <input id="staff-name" required minLength={2} maxLength={100} value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} className={inputClass} />
        </Field>
        <Field label="Email đăng nhập" htmlFor="staff-email">
          <input id="staff-email" required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputClass} />
        </Field>
        <Field label="Mật khẩu" hint="Tối thiểu 8 ký tự. Nên đổi sau lần đăng nhập đầu." htmlFor="staff-password">
          <input id="staff-password" required type="password" minLength={8} maxLength={72} autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className={inputClass} />
        </Field>
        <Field label="Vai trò" htmlFor="staff-role">
          <select id="staff-role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as "LIBRARIAN" | "ADMIN" })} className={inputClass}>
            <option value="LIBRARIAN">Thủ thư (mượn trả, quản lý kho)</option>
            <option value="ADMIN">Quản trị viên (toàn quyền, cấu hình)</option>
          </select>
        </Field>
        {error && <p role="alert" className="rounded-md bg-brand-soft px-3 py-2 text-sm text-brand">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Huỷ</Button>
          <Button type="submit" disabled={save.isPending}>{save.isPending ? "Đang tạo..." : "Tạo tài khoản"}</Button>
        </div>
      </form>
    </Modal>
  );
}
