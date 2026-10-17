"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import dynamic from "next/dynamic";
import { useState } from "react";
import { apiFetch, formatDate } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Page, Role, User } from "@/lib/types";
import { Button, EmptyState, Field, PageHeading, inputClass } from "../ui";
import {
  Avatar,
  FilterTabs,
  FormActions,
  FormError,
  Modal,
  Pagination,
  RowButton,
  SearchInput,
  StatusBadge,
  TableShell,
  TableSkeleton,
  Td,
  Th,
  Toolbar,
  Tr,
  errorText,
  useConfirm,
  useNotice,
} from "./admin-ui";

const LIMIT = 15;

// Chỉ tải khi bấm nút
const ResetPasswordModal = dynamic(() => import("../reset-password-modal").then((m) => m.ResetPasswordModal), { ssr: false });

const ROLE_LABEL: Record<Role, string> = {
  READER: "Bạn đọc",
  LIBRARIAN: "Thủ thư",
  ADMIN: "Quản trị viên",
};

const ROLE_ITEMS: { value: Role; label: string }[] = [
  { value: "LIBRARIAN", label: ROLE_LABEL.LIBRARIAN },
  { value: "ADMIN", label: ROLE_LABEL.ADMIN },
  { value: "READER", label: ROLE_LABEL.READER },
];

export function UsersAdminView() {
  const { token, user: me } = useAuth();
  const queryClient = useQueryClient();
  const { show, node } = useNotice();
  const { confirm, dialog: confirmDialog } = useConfirm();

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

  const items = users.data?.items ?? [];

  return (
    <div>
      <PageHeading
        title="Tài khoản"
        description="Tạo tài khoản thủ thư hoặc quản trị viên, đổi tên và khoá hoặc mở tài khoản. Bạn đọc tự đăng ký ở trang đăng ký."
        action={
          <Button onClick={() => setCreating(true)}>
            <Plus size={18} aria-hidden="true" />
            Tạo tài khoản nhân viên
          </Button>
        }
      />
      {node}
      {confirmDialog}

      <Toolbar>
        <FilterTabs
          label="Loại tài khoản"
          value={role}
          items={ROLE_ITEMS}
          onChange={(value) => {
            setRole(value);
            setPage(1);
          }}
        />
        <form
          className="flex min-w-[240px] flex-1 items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            setQuery(search.trim());
            setPage(1);
          }}
        >
          <SearchInput id="admin-users-q" label="Tìm tài khoản" value={search} onChange={setSearch} placeholder="Tên, email hoặc mã" className="max-w-sm" />
          <Button type="submit" variant="ghost">
            Tìm
          </Button>
        </form>
      </Toolbar>

      <div className="mt-5">
        {users.isLoading ? (
          <TableSkeleton rows={6} cols={4} />
        ) : items.length === 0 ? (
          <EmptyState
            title="Không có tài khoản nào"
            hint={query ? "Thử từ khoá khác hoặc chuyển sang loại tài khoản khác." : "Loại tài khoản này chưa có ai."}
          />
        ) : (
          <TableShell minWidth={720}>
            <caption className="sr-only">Danh sách tài khoản</caption>
            <thead>
              <tr>
                <Th>Họ tên</Th>
                <Th>Vai trò</Th>
                <Th>Ngày tạo</Th>
                <Th>Trạng thái</Th>
                <Th align="right">
                  <span className="sr-only">Thao tác</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {items.map((row, index) => {
                const isMe = row.id === me?.id;
                return (
                  <Tr key={row.id} index={index}>
                    <Td card="title">
                      <div className="flex items-center gap-3">
                        <Avatar name={row.fullName} />
                        <div className="min-w-0">
                          <span className="font-semibold">{row.fullName}</span>
                          {isMe && <span className="ml-2 text-xs font-medium text-primary-ink">(bạn)</span>}
                          <span className="block truncate text-xs text-ink-faint">{row.email}</span>
                        </div>
                      </div>
                    </Td>
                    <Td className="text-ink-soft">{ROLE_LABEL[row.role]}</Td>
                    <Td className="whitespace-nowrap text-ink-soft">{row.createdAt ? formatDate(row.createdAt) : ""}</Td>
                    <Td>
                      {row.isActive ? <StatusBadge tone="good">Hoạt động</StatusBadge> : <StatusBadge tone="bad">Đang khoá</StatusBadge>}
                    </Td>
                    <Td card="actions">
                      <div className="flex justify-end gap-2">
                        <RowButton aria-label={`Đổi tên ${row.fullName}`} onClick={() => setEditing(row)}>
                          Đổi tên
                        </RowButton>
                        <RowButton
                          aria-label={`Cấp lại mật khẩu cho ${row.fullName}`}
                          disabled={isMe}
                          title={isMe ? "Dùng chức năng đổi mật khẩu ở trang tài khoản" : undefined}
                          onClick={() => setResetting(row)}
                        >
                          Cấp mật khẩu
                        </RowButton>
                        <RowButton
                          danger={row.isActive}
                          aria-label={`${row.isActive ? "Khoá" : "Mở khoá"} tài khoản ${row.fullName}`}
                          disabled={isMe || toggle.isPending}
                          title={isMe ? "Không tự khoá tài khoản của mình" : undefined}
                          onClick={async () => {
                            if (!row.isActive) {
                              toggle.mutate(row);
                              return;
                            }
                            const ok = await confirm({
                              title: "Khoá tài khoản",
                              message: `Khoá tài khoản ${row.fullName}? Người này sẽ không đăng nhập được cho tới khi bạn mở lại.`,
                              confirmLabel: "Khoá tài khoản",
                            });
                            if (ok) toggle.mutate(row);
                          }}
                        >
                          {row.isActive ? "Khoá" : "Mở"}
                        </RowButton>
                      </div>
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </TableShell>
        )}
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
        {error && <FormError>{error}</FormError>}
        <FormActions>
          <Button type="button" variant="ghost" onClick={onClose}>
            Huỷ
          </Button>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? "Đang lưu..." : "Lưu"}
          </Button>
        </FormActions>
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
          <select id="staff-role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as "LIBRARIAN" | "ADMIN" })} className={`${inputClass} pr-9`}>
            <option value="LIBRARIAN">Thủ thư (mượn trả, quản lý kho)</option>
            <option value="ADMIN">Quản trị viên (toàn quyền, cấu hình)</option>
          </select>
        </Field>
        {error && <FormError>{error}</FormError>}
        <FormActions>
          <Button type="button" variant="ghost" onClick={onClose}>
            Huỷ
          </Button>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? "Đang tạo..." : "Tạo tài khoản"}
          </Button>
        </FormActions>
      </form>
    </Modal>
  );
}
