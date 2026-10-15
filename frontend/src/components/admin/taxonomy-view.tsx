"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Author, Category, Page } from "@/lib/types";
import { Badge, Button, Card, PageHeading, Spinner, inputClass } from "../ui";
import { Modal, Pagination, errorText, useNotice } from "./admin-ui";

export function TaxonomyView() {
  const { show, node } = useNotice();
  return (
    <div>
      <PageHeading
        eyebrow="Kho sách"
        title="Tác giả và thể loại"
        description="Thể loại hoặc tác giả đang gắn với sách thì không xoá được, hãy chuyển sách sang mục khác trước."
      />
      {node}
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
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

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-serif text-lg font-bold">Thể loại</h2>
        <Button onClick={() => setEditing("new")}>Thêm thể loại</Button>
      </div>
      {categories.isLoading ? (
        <Spinner />
      ) : (
        <ul className="mt-4 divide-y divide-line">
          {(categories.data ?? []).map((category) => (
            <li key={category.id} className="flex items-center gap-3 py-2.5 text-sm">
              <span className="min-w-0 flex-1">
                <span className="font-medium">{category.name}</span>
                <span className="block text-xs text-ink-faint">{category.slug}</span>
              </span>
              <Badge tone="neutral">{category.bookCount ?? 0} sách</Badge>
              <button type="button" aria-label={`Sửa thể loại ${category.name}`} onClick={() => setEditing(category)} className="rounded-md border border-line px-3 py-1.5 text-xs font-medium hover:bg-paper-2">
                Sửa
              </button>
              <button
                type="button"
                aria-label={`Xoá thể loại ${category.name}`}
                disabled={remove.isPending}
                onClick={() => {
                  if (window.confirm(`Xoá thể loại ${category.name}?`)) remove.mutate(category);
                }}
                className="rounded-md border border-brand/30 px-3 py-1.5 text-xs font-medium text-brand hover:bg-brand-soft disabled:opacity-50"
              >
                Xoá
              </button>
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
        <div>
          <label htmlFor="cat-name" className="block text-sm font-medium">Tên thể loại</label>
          <input id="cat-name" required minLength={2} maxLength={100} value={name} onChange={(e) => setName(e.target.value)} className={`${inputClass} mt-1.5`} />
        </div>
        <div>
          <label htmlFor="cat-slug" className="block text-sm font-medium">Đường dẫn (slug)</label>
          <p className="mt-0.5 text-xs text-ink-faint">Chữ thường, số, dấu gạch ngang. Bỏ trống để tự sinh từ tên.</p>
          <input id="cat-slug" pattern="[a-z0-9]+(-[a-z0-9]+)*" value={slug} onChange={(e) => setSlug(e.target.value)} className={`${inputClass} mt-1.5`} />
        </div>
        {error && <p role="alert" className="rounded-md bg-brand-soft px-3 py-2 text-sm text-brand">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Huỷ</Button>
          <Button type="submit" disabled={save.isPending}>{save.isPending ? "Đang lưu..." : "Lưu"}</Button>
        </div>
      </form>
    </Modal>
  );
}

const AUTHOR_LIMIT = 12;

function AuthorsPanel({ notify }: { notify: Notify }) {
  const { token } = useAuth();
  const queryClient = useQueryClient();
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

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-serif text-lg font-bold">Tác giả</h2>
        <Button onClick={() => setEditing("new")}>Thêm tác giả</Button>
      </div>
      <form
        className="mt-4 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setQuery(search.trim());
          setPage(1);
        }}
      >
        <label htmlFor="author-q" className="sr-only">Tìm tác giả</label>
        <input id="author-q" value={search} onChange={(e) => setSearch(e.target.value)} className={inputClass} placeholder="Tên tác giả" />
        <Button type="submit" variant="ghost">Tìm</Button>
      </form>
      {authors.isLoading ? (
        <Spinner />
      ) : (
        <ul className="mt-3 divide-y divide-line">
          {(authors.data?.items ?? []).map((author) => (
            <li key={author.id} className="flex items-center gap-3 py-2.5 text-sm">
              <span className="min-w-0 flex-1 truncate font-medium">{author.name}</span>
              <Badge tone="neutral">{author.bookCount ?? 0} sách</Badge>
              <button type="button" aria-label={`Sửa tác giả ${author.name}`} onClick={() => setEditing(author)} className="rounded-md border border-line px-3 py-1.5 text-xs font-medium hover:bg-paper-2">
                Sửa
              </button>
              <button
                type="button"
                disabled={remove.isPending}
                onClick={() => {
                  if (window.confirm(`Xoá tác giả ${author.name}?`)) remove.mutate(author);
                }}
                className="rounded-md border border-brand/30 px-3 py-1.5 text-xs font-medium text-brand hover:bg-brand-soft disabled:opacity-50"
              >
                Xoá
              </button>
            </li>
          ))}
        </ul>
      )}
      {authors.data?.items.length === 0 && <p className="py-6 text-center text-sm text-ink-soft">Không tìm thấy tác giả.</p>}
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
        <div>
          <label htmlFor="author-name" className="block text-sm font-medium">Tên tác giả</label>
          <input id="author-name" required maxLength={150} value={name} onChange={(e) => setName(e.target.value)} className={`${inputClass} mt-1.5`} />
        </div>
        {error && <p role="alert" className="rounded-md bg-brand-soft px-3 py-2 text-sm text-brand">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Huỷ</Button>
          <Button type="submit" disabled={save.isPending}>{save.isPending ? "Đang lưu..." : "Lưu"}</Button>
        </div>
      </form>
    </Modal>
  );
}
