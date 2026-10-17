"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderTree, Plus } from "lucide-react";
import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Author, Category, Page } from "@/lib/types";
import { Button, Card, EmptyState, Field, PageHeading, inputClass } from "../ui";
import {
  Avatar,
  FormActions,
  FormError,
  ListSkeleton,
  Modal,
  Pagination,
  RowButton,
  SearchInput,
  errorText,
  useConfirm,
  useNotice,
} from "./admin-ui";

export function TaxonomyView() {
  const { show, node } = useNotice();
  return (
    <div>
      <PageHeading
        title="Tác giả và thể loại"
        description="Thể loại hoặc tác giả đang gắn với sách thì không xoá được, hãy chuyển sách sang mục khác trước."
      />
      {node}
      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <CategoriesPanel notify={show} />
        <AuthorsPanel notify={show} />
      </div>
    </div>
  );
}

type Notify = (tone: "good" | "bad", text: string) => void;

function CategoriesPanel({ notify }: { notify: Notify }) {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [editing, setEditing] = useState<Category | "new" | null>(null);

  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: () => apiFetch<Category[]>("/categories"),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["categories"] });

  const remove = useMutation({
    mutationFn: (category: Category) => apiFetch<void>(`/categories/${category.id}`, { method: "DELETE", token }),
    onSuccess: (_data, category) => {
      notify("good", `Đã xoá thể loại ${category.name}.`);
      refresh();
    },
    onError: (error) => notify("bad", errorText(error, "Không xoá được thể loại.")),
  });

  const list = categories.data ?? [];

  return (
    <Card>
      {confirmDialog}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Thể loại</h2>
          <p className="text-sm text-ink-faint">{categories.data ? `${list.length} thể loại` : "Đang tải..."}</p>
        </div>
        <Button onClick={() => setEditing("new")}>
          <Plus size={18} aria-hidden="true" />
          Thêm thể loại
        </Button>
      </div>
      {categories.isLoading ? (
        <ListSkeleton />
      ) : list.length === 0 ? (
        <div className="mt-4">
          <EmptyState title="Chưa có thể loại nào" hint="Thêm thể loại đầu tiên để phân loại sách trong kho." />
        </div>
      ) : (
        <ul className="mt-4 space-y-1">
          {list.map((category) => (
            <li
              key={category.id}
              className="flex items-center gap-3 rounded-2xl px-2 py-2 text-sm transition-colors hover:bg-paper"
            >
              <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
                <FolderTree size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 font-semibold">{category.name}</span>
                <span className="block truncate text-xs text-ink-faint">
                  {category.slug} · {(category.bookCount ?? 0).toLocaleString("vi-VN")} sách
                </span>
              </span>
              <RowButton aria-label={`Sửa thể loại ${category.name}`} onClick={() => setEditing(category)}>
                Sửa
              </RowButton>
              <RowButton
                danger
                aria-label={`Xoá thể loại ${category.name}`}
                disabled={remove.isPending}
                onClick={async () => {
                  const ok = await confirm({
                    title: "Xoá thể loại",
                    message: `Xoá thể loại ${category.name}? Thể loại đang có sách thì sẽ không xoá được.`,
                    confirmLabel: "Xoá thể loại",
                  });
                  if (ok) remove.mutate(category);
                }}
              >
                Xoá
              </RowButton>
            </li>
          ))}
        </ul>
      )}
      {editing && (
        <CategoryModal
          category={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(message) => {
            setEditing(null);
            notify("good", message);
            refresh();
          }}
        />
      )}
    </Card>
  );
}

function CategoryModal({
  category,
  onClose,
  onSaved,
}: {
  category: Category | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const { token } = useAuth();
  const [name, setName] = useState(category?.name ?? "");
  const [slug, setSlug] = useState(category?.slug ?? "");
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () => {
      const body = { name: name.trim(), slug: slug.trim() || undefined };
      return category
        ? apiFetch<Category>(`/categories/${category.id}`, { method: "PATCH", body, token })
        : apiFetch<Category>("/categories", { method: "POST", body, token });
    },
    onSuccess: (saved) => onSaved(category ? `Đã cập nhật thể loại ${saved.name}.` : `Đã thêm thể loại ${saved.name}.`),
    onError: (err) => setError(errorText(err, "Không lưu được thể loại.")),
  });

  return (
    <Modal title={category ? "Sửa thể loại" : "Thêm thể loại"} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          save.mutate();
        }}
      >
        <Field label="Tên thể loại" htmlFor="cat-name">
          <input id="cat-name" required minLength={2} maxLength={100} value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Đường dẫn (slug)" hint="Chữ thường, số, dấu gạch ngang. Bỏ trống để tự sinh từ tên." htmlFor="cat-slug">
          <input id="cat-slug" pattern="[a-z0-9]+(-[a-z0-9]+)*" value={slug} onChange={(e) => setSlug(e.target.value)} className={inputClass} />
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

const AUTHOR_LIMIT = 12;

function AuthorsPanel({ notify }: { notify: Notify }) {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Author | "new" | null>(null);

  const authors = useQuery({
    queryKey: ["admin-authors", query, page],
    queryFn: () =>
      apiFetch<Page<Author>>(`/authors?limit=${AUTHOR_LIMIT}&page=${page}${query ? `&q=${encodeURIComponent(query)}` : ""}`),
    placeholderData: (previous) => previous,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin-authors"] });

  const remove = useMutation({
    mutationFn: (author: Author) => apiFetch<void>(`/authors/${author.id}`, { method: "DELETE", token }),
    onSuccess: (_data, author) => {
      notify("good", `Đã xoá tác giả ${author.name}.`);
      refresh();
    },
    onError: (error) => notify("bad", errorText(error, "Không xoá được tác giả.")),
  });

  const items = authors.data?.items ?? [];

  return (
    <Card>
      {confirmDialog}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Tác giả</h2>
          <p className="text-sm text-ink-faint">
            {authors.data ? `${authors.data.total.toLocaleString("vi-VN")} tác giả` : "Đang tải..."}
          </p>
        </div>
        <Button onClick={() => setEditing("new")}>
          <Plus size={18} aria-hidden="true" />
          Thêm tác giả
        </Button>
      </div>
      <form
        className="mt-4 flex items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setQuery(search.trim());
          setPage(1);
        }}
      >
        <SearchInput id="author-q" label="Tìm tác giả" value={search} onChange={setSearch} placeholder="Tên tác giả" />
        <Button type="submit" variant="ghost">
          Tìm
        </Button>
      </form>
      {authors.isLoading ? (
        <ListSkeleton />
      ) : items.length === 0 ? (
        <div className="mt-4">
          <EmptyState title="Không tìm thấy tác giả" hint="Thử tên khác, hoặc thêm tác giả mới bằng nút phía trên." />
        </div>
      ) : (
        <ul className="mt-3 space-y-1">
          {items.map((author) => (
            <li
              key={author.id}
              className="flex items-center gap-3 rounded-2xl px-2 py-2 text-sm transition-colors hover:bg-paper"
            >
              <Avatar name={author.name} size={40} />
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 font-semibold">{author.name}</span>
                <span className="block text-xs text-ink-faint">{(author.bookCount ?? 0).toLocaleString("vi-VN")} sách</span>
              </span>
              <RowButton aria-label={`Sửa tác giả ${author.name}`} onClick={() => setEditing(author)}>
                Sửa
              </RowButton>
              <RowButton
                danger
                aria-label={`Xoá tác giả ${author.name}`}
                disabled={remove.isPending}
                onClick={async () => {
                  const ok = await confirm({
                    title: "Xoá tác giả",
                    message: `Xoá tác giả ${author.name}? Tác giả đang có sách thì sẽ không xoá được.`,
                    confirmLabel: "Xoá tác giả",
                  });
                  if (ok) remove.mutate(author);
                }}
              >
                Xoá
              </RowButton>
            </li>
          ))}
        </ul>
      )}
      {authors.data && <Pagination page={page} total={authors.data.total} limit={AUTHOR_LIMIT} onPage={setPage} />}
      {editing && (
        <AuthorModal
          author={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(message) => {
            setEditing(null);
            notify("good", message);
            refresh();
          }}
        />
      )}
    </Card>
  );
}

function AuthorModal({
  author,
  onClose,
  onSaved,
}: {
  author: Author | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const { token } = useAuth();
  const [name, setName] = useState(author?.name ?? "");
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () => {
      const body = { name: name.trim() };
      return author
        ? apiFetch<Author>(`/authors/${author.id}`, { method: "PATCH", body, token })
        : apiFetch<Author>("/authors", { method: "POST", body, token });
    },
    onSuccess: (saved) => onSaved(author ? `Đã cập nhật tác giả ${saved.name}.` : `Đã thêm tác giả ${saved.name}.`),
    onError: (err) => setError(errorText(err, "Không lưu được tác giả.")),
  });

  return (
    <Modal title={author ? "Sửa tác giả" : "Thêm tác giả"} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          save.mutate();
        }}
      >
        <Field label="Tên tác giả" htmlFor="author-name">
          <input id="author-name" required maxLength={150} value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
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
