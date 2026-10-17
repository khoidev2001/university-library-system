"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { apiFetch, formatCurrency } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Author, BookCopy, BookDetail, BookSummary, Category, CopyStatus, ImportReport, Page } from "@/lib/types";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ExportButtons } from "../export-buttons";
import { TapCheckbox } from "../tap-checkbox";
import { Plus, X } from "lucide-react";
import { Button, ButtonLink, EmptyState, Field, PageHeading, inputClass } from "../ui";
import {
  BookThumb,
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
  rowButtonClass,
  useConfirm,
  useNotice,
} from "./admin-ui";

// Hộp thoại nhập file chỉ nạp khi thủ thư bấm "Nhập từ file", không làm nặng trang danh sách sách
const BookImportDialog = dynamic(() => import("./book-import-dialog").then((m) => m.BookImportDialog), { ssr: false });

const LIMIT = 15;

const COPY_STATUS: Record<CopyStatus, { label: string; tone: "good" | "info" | "bad" | "warn" }> = {
  AVAILABLE: { label: "Sẵn sàng", tone: "good" },
  BORROWED: { label: "Đang mượn", tone: "info" },
  LOST: { label: "Mất", tone: "bad" },
  MAINTENANCE: { label: "Bảo trì", tone: "warn" },
  HELD: { label: "Đang giữ cho bạn đọc", tone: "info" },
};

export function BooksAdminView() {
  const { token, can } = useAuth();
  const queryClient = useQueryClient();
  const { show, node } = useNotice();
  const { confirm, dialog: confirmDialog } = useConfirm();

  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<BookSummary | "new" | null>(null);
  const [copiesOf, setCopiesOf] = useState<BookSummary | null>(null);
  const [importing, setImporting] = useState(false);
  const [importingFile, setImportingFile] = useState(false);
  const [picked, setPicked] = useState<Set<number>>(new Set());

  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: () => apiFetch<Category[]>("/categories"),
  });

  const books = useQuery({
    queryKey: ["admin-books", query, categoryId, page],
    queryFn: () =>
      apiFetch<Page<BookSummary>>(
        `/books?limit=${LIMIT}&page=${page}${query ? `&q=${encodeURIComponent(query)}` : ""}${
          categoryId ? `&categoryId=${categoryId}` : ""
        }`,
      ),
    placeholderData: (previous) => previous,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-books"] });
    queryClient.invalidateQueries({ queryKey: ["admin-total"] });
    queryClient.invalidateQueries({ queryKey: ["reports"] });
  };

  const remove = useMutation({
    mutationFn: (book: BookSummary) => apiFetch<void>(`/books/${book.id}`, { method: "DELETE", token }),
    onSuccess: (_data, book) => {
      show("good", `Đã xoá sách "${book.title}".`);
      refresh();
    },
    onError: (error) => show("bad", errorText(error, "Không xoá được sách.")),
  });

  const filtered = query !== "" || categoryId !== "";
  const items = books.data?.items ?? [];

  return (
    <div>
      <PageHeading
        title="Sách và bản sao"
        description="Thêm, sửa, xoá đầu sách và quản lý từng bản sao trên kệ."
        action={
          <div className="flex flex-wrap gap-2">
            {can("ADMIN") && (
              <Button variant="ghost" onClick={() => setImporting(true)}>
                Nhập theo ISBN
              </Button>
            )}
            <Button variant="ghost" onClick={() => setImportingFile(true)}>
              Nhập từ file
            </Button>
            <Button onClick={() => setEditing("new")}>
              <Plus size={18} aria-hidden="true" />
              Thêm sách
            </Button>
          </div>
        }
      />
      {node}
      {confirmDialog}

      <Toolbar>
        <form
          className="flex flex-1 flex-wrap items-center gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            setQuery(search.trim());
            setPage(1);
          }}
        >
          <SearchInput id="admin-books-q" label="Tìm sách" value={search} onChange={setSearch} placeholder="Tiêu đề, tác giả hoặc ISBN" />
          <div>
            <label htmlFor="admin-books-category" className="sr-only">
              Lọc theo thể loại
            </label>
            <select
              id="admin-books-category"
              value={categoryId}
              onChange={(event) => {
                setCategoryId(event.target.value);
                setPage(1);
              }}
              className={`${inputClass} pr-9`}
            >
              <option value="">Mọi thể loại</option>
              {(categories.data ?? []).map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit">Tìm</Button>
        </form>
      </Toolbar>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <ExportButtons dataset="books" subject="danh mục sách" params={{ q: query, categoryId }} />
        {picked.size > 0 ? (
          <ButtonLink href={`/librarian/labels?bookIds=${[...picked].join(",")}`} variant="soft">
            In nhãn mã vạch ({picked.size} sách)
          </ButtonLink>
        ) : (
          <Button type="button" variant="ghost" disabled title="Tích chọn sách trong bảng để in nhãn bản sao">
            In nhãn mã vạch
          </Button>
        )}
      </div>

      <div className="mt-5">
        {books.isLoading ? (
          <TableSkeleton rows={8} cols={5} />
        ) : items.length === 0 ? (
          <EmptyState
            title={filtered ? "Không có sách nào khớp" : "Kho sách còn trống"}
            hint={
              filtered
                ? "Thử bớt từ khoá hoặc chọn thể loại khác để thấy nhiều kết quả hơn."
                : "Thêm đầu sách đầu tiên hoặc nhập cả danh mục từ file để bắt đầu."
            }
            action={
              filtered ? (
                <Button
                  variant="soft"
                  onClick={() => {
                    setSearch("");
                    setQuery("");
                    setCategoryId("");
                    setPage(1);
                  }}
                >
                  Xoá bộ lọc
                </Button>
              ) : (
                <Button onClick={() => setEditing("new")}>Thêm sách</Button>
              )
            }
          />
        ) : (
          <TableShell minWidth={860}>
            <caption className="sr-only">Danh sách đầu sách</caption>
            <thead>
              <tr>
                <th scope="col" className="sticky top-0 w-12 border-b border-line bg-paper px-4 py-3">
                  <TapCheckbox
                    label="Chọn tất cả sách trên trang này"
                    checked={items.length > 0 && items.every((b) => picked.has(b.id))}
                    onChange={(checked) => {
                      const next = new Set(picked);
                      for (const b of items) {
                        if (checked) next.add(b.id);
                        else next.delete(b.id);
                      }
                      setPicked(next);
                    }}
                  />
                </th>
                <Th>Sách</Th>
                <Th>Thể loại</Th>
                <Th>Giá bìa</Th>
                <Th>Bản sao</Th>
                <Th align="right">
                  <span className="sr-only">Thao tác</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {items.map((book, index) => (
                <Tr key={book.id} index={index}>
                  <Td className="w-12">
                    <TapCheckbox
                      label={`Chọn ${book.title} để in nhãn`}
                      checked={picked.has(book.id)}
                      onChange={(checked) => {
                        const next = new Set(picked);
                        if (checked) next.add(book.id);
                        else next.delete(book.id);
                        setPicked(next);
                      }}
                    />
                  </Td>
                  <Td>
                    <div className="flex max-w-[24rem] items-center gap-3">
                      <BookThumb coverUrl={book.coverUrl} title={book.title} />
                      <div className="min-w-0">
                        <span className="line-clamp-2 font-semibold">{book.title}</span>
                        <span className="block truncate text-xs text-ink-faint">
                          {book.authors.map((author) => author.name).join(", ") || "Chưa có tác giả"}
                          {book.isbn ? ` · ISBN ${book.isbn}` : ""}
                        </span>
                      </div>
                    </div>
                  </Td>
                  <Td className="whitespace-nowrap text-ink-soft">{book.category.name}</Td>
                  <Td className="whitespace-nowrap text-ink-soft">{formatCurrency(book.price)}</Td>
                  <Td>
                    <StatusBadge tone={book.copiesAvailable > 0 ? "good" : "warn"}>
                      {book.copiesAvailable}/{book.copiesTotal}
                    </StatusBadge>
                  </Td>
                  <Td>
                    <div className="flex justify-end gap-1.5">
                      <RowButton aria-label={`Bản sao của ${book.title}`} onClick={() => setCopiesOf(book)}>
                        Bản sao
                      </RowButton>
                      <RowButton aria-label={`Sửa ${book.title}`} onClick={() => setEditing(book)}>
                        Sửa
                      </RowButton>
                      <RowButton
                        danger
                        aria-label={`Xoá ${book.title}`}
                        disabled={remove.isPending}
                        onClick={async () => {
                          const ok = await confirm({
                            title: "Xoá đầu sách",
                            message: `Xoá sách "${book.title}" cùng toàn bộ bản sao và đánh giá? Thao tác này không hoàn tác được.`,
                            confirmLabel: "Xoá sách",
                          });
                          if (ok) remove.mutate(book);
                        }}
                      >
                        Xoá
                      </RowButton>
                    </div>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </TableShell>
        )}
        {books.data && <Pagination page={page} total={books.data.total} limit={LIMIT} onPage={setPage} />}
      </div>

      {editing && (
        <BookFormModal
          book={editing === "new" ? null : editing}
          categories={categories.data ?? []}
          onClose={() => setEditing(null)}
          onSaved={(message) => {
            setEditing(null);
            show("good", message);
            refresh();
          }}
        />
      )}
      {copiesOf && (
        <CopiesModal
          book={copiesOf}
          onClose={() => setCopiesOf(null)}
          onChanged={() => {
            refresh();
          }}
        />
      )}
      {importingFile && (
        <BookImportDialog
          onClose={() => setImportingFile(false)}
          onDone={() => {
            refresh();
            queryClient.invalidateQueries({ queryKey: ["categories"] });
          }}
        />
      )}
      {importing && (
        <ImportModal
          onClose={() => setImporting(false)}
          onDone={() => {
            refresh();
          }}
        />
      )}
    </div>
  );
}

interface BookForm {
  title: string;
  isbn: string;
  publisher: string;
  publishedYear: string;
  price: string;
  coverUrl: string;
  description: string;
  categoryId: string;
  authors: Author[];
}

function BookFormModal({
  book,
  categories,
  onClose,
  onSaved,
}: {
  book: BookSummary | null;
  categories: Category[];
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const { token } = useAuth();
  const [error, setError] = useState<string | null>(null);

  // Mô tả chỉ có ở API chi tiết nên tải thêm khi sửa
  const detail = useQuery({
    queryKey: ["admin-book-detail", book?.id],
    queryFn: () => apiFetch<BookDetail>(`/books/${book!.id}`),
    enabled: !!book,
  });

  const [form, setForm] = useState<BookForm>({
    title: book?.title ?? "",
    isbn: book?.isbn ?? "",
    publisher: book?.publisher ?? "",
    publishedYear: book?.publishedYear ? String(book.publishedYear) : "",
    price: book ? String(book.price) : "",
    coverUrl: book?.coverUrl ?? "",
    description: "",
    categoryId: book ? String(book.category.id) : "",
    authors: book?.authors ?? [],
  });
  const [descriptionTouched, setDescriptionTouched] = useState(false);
  const description = descriptionTouched ? form.description : (detail.data?.description ?? "");

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        title: form.title.trim(),
        isbn: form.isbn.trim() || undefined,
        publisher: form.publisher.trim() || undefined,
        publishedYear: form.publishedYear ? Number(form.publishedYear) : undefined,
        price: Number(form.price),
        coverUrl: form.coverUrl.trim() || undefined,
        description: description.trim() || undefined,
        categoryId: Number(form.categoryId),
        authorIds: form.authors.map((author) => author.id),
      };
      return book
        ? apiFetch<BookSummary>(`/books/${book.id}`, { method: "PATCH", body: payload, token })
        : apiFetch<BookSummary>("/books", { method: "POST", body: payload, token });
    },
    onSuccess: (saved) => onSaved(book ? `Đã cập nhật "${saved.title}".` : `Đã thêm sách "${saved.title}".`),
    onError: (err) => setError(errorText(err, "Không lưu được sách.")),
  });

  const set = <K extends keyof BookForm>(key: K, value: BookForm[K]) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <Modal title={book ? "Sửa thông tin sách" : "Thêm sách mới"} onClose={onClose} wide>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          if (form.authors.length === 0) {
            setError("Cần chọn ít nhất một tác giả.");
            return;
          }
          save.mutate();
        }}
      >
        <Field label="Tiêu đề" htmlFor="bf-title">
          <input id="bf-title" required maxLength={300} value={form.title} onChange={(e) => set("title", e.target.value)} className={inputClass} />
        </Field>
        <div className="grid items-end gap-4 sm:grid-cols-2">
          <Field label="Thể loại" htmlFor="bf-category">
            <select id="bf-category" required value={form.categoryId} onChange={(e) => set("categoryId", e.target.value)} className={inputClass}>
              <option value="">Chọn thể loại</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="ISBN" hint="10 đến 13 chữ số, có thể bỏ trống" htmlFor="bf-isbn">
            <input id="bf-isbn" value={form.isbn} onChange={(e) => set("isbn", e.target.value)} className={inputClass} />
          </Field>
          <Field label="Nhà xuất bản" htmlFor="bf-publisher">
            <input id="bf-publisher" maxLength={200} value={form.publisher} onChange={(e) => set("publisher", e.target.value)} className={inputClass} />
          </Field>
          <Field label="Năm xuất bản" htmlFor="bf-year">
            <input id="bf-year" type="number" min={1000} max={2100} value={form.publishedYear} onChange={(e) => set("publishedYear", e.target.value)} className={inputClass} />
          </Field>
          <Field label="Giá bìa (đồng)" hint="Dùng tính phạt khi mất sách" htmlFor="bf-price">
            <input id="bf-price" required type="number" min={0} value={form.price} onChange={(e) => set("price", e.target.value)} className={inputClass} />
          </Field>
          <Field label="Địa chỉ ảnh bìa" htmlFor="bf-cover">
            <input id="bf-cover" type="url" value={form.coverUrl} onChange={(e) => set("coverUrl", e.target.value)} className={inputClass} placeholder="https://..." />
          </Field>
        </div>
        <Field label="Mô tả" htmlFor="bf-description">
          <textarea
            id="bf-description"
            rows={4}
            maxLength={5000}
            value={description}
            onChange={(e) => {
              setDescriptionTouched(true);
              set("description", e.target.value);
            }}
            className={inputClass}
          />
        </Field>
        <AuthorPicker selected={form.authors} onChange={(authors) => set("authors", authors)} />

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

function AuthorPicker({ selected, onChange }: { selected: Author[]; onChange: (authors: Author[]) => void }) {
  const { token } = useAuth();
  const [text, setText] = useState("");

  const results = useQuery({
    queryKey: ["author-search", text],
    queryFn: () => apiFetch<Page<Author>>(`/authors?limit=8${text ? `&q=${encodeURIComponent(text)}` : ""}`),
    enabled: text.trim().length > 0,
  });

  const create = useMutation({
    mutationFn: (name: string) => apiFetch<Author>("/authors", { method: "POST", body: { name }, token }),
    onSuccess: (author) => {
      onChange([...selected, author]);
      setText("");
    },
  });

  const available = (results.data?.items ?? []).filter((author) => !selected.some((s) => s.id === author.id));
  const trimmed = text.trim();
  const exact = (results.data?.items ?? []).some((author) => author.name.toLowerCase() === trimmed.toLowerCase());

  return (
    <div>
      <label htmlFor="bf-author" className="block text-sm font-semibold">
        Tác giả
      </label>
      <p className="mt-0.5 text-xs text-ink-faint">Gõ tên để tìm, chưa có thì thêm mới ngay tại đây.</p>
      {selected.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-2">
          {selected.map((author) => (
            <li key={author.id} className="inline-flex items-center gap-1 rounded-full bg-primary-soft py-0.5 pl-3.5 pr-1 text-sm font-medium text-primary-ink">
              {author.name}
              <button
                type="button"
                aria-label={`Bỏ tác giả ${author.name}`}
                onClick={() => onChange(selected.filter((s) => s.id !== author.id))}
                className="grid h-9 w-9 place-items-center rounded-full text-primary-ink/70 transition-colors hover:bg-white hover:text-danger"
              >
                <X size={14} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <input id="bf-author" value={text} onChange={(e) => setText(e.target.value)} className={`${inputClass} mt-2`} placeholder="Tìm tác giả..." autoComplete="off" />
      {trimmed && (
        <ul className="mt-2 divide-y divide-line overflow-hidden rounded-xl border border-line bg-white text-sm shadow-[var(--shadow-card)]">
          {available.map((author) => (
            <li key={author.id}>
              <button type="button" onClick={() => { onChange([...selected, author]); setText(""); }} className="block min-h-11 w-full px-4 py-2.5 text-left transition-colors hover:bg-paper">
                {author.name}
              </button>
            </li>
          ))}
          {!exact && (
            <li>
              <button type="button" disabled={create.isPending} onClick={() => create.mutate(trimmed)} className="block min-h-11 w-full px-4 py-2.5 text-left font-semibold text-primary-ink transition-colors hover:bg-primary-soft">
                Thêm tác giả mới &quot;{trimmed}&quot;
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

function CopiesModal({ book, onClose, onChanged }: { book: BookSummary; onClose: () => void; onChanged: () => void }) {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [barcode, setBarcode] = useState("");
  const [shelf, setShelf] = useState("");
  const { show, node } = useNotice();

  const copies = useQuery({
    queryKey: ["admin-copies", book.id],
    queryFn: () => apiFetch<BookCopy[]>(`/books/${book.id}/copies`, { token }),
    enabled: !!token,
  });

  const done = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-copies", book.id] });
    onChanged();
  };

  const add = useMutation({
    mutationFn: () =>
      apiFetch<BookCopy>(`/books/${book.id}/copies`, {
        method: "POST",
        body: { barcode: barcode.trim(), shelfLocation: shelf.trim() || undefined },
        token,
      }),
    onSuccess: (copy) => {
      show("good", `Đã thêm bản sao ${copy.barcode}.`);
      setBarcode("");
      setShelf("");
      done();
    },
    onError: (error) => show("bad", errorText(error, "Không thêm được bản sao.")),
  });

  const update = useMutation({
    mutationFn: ({ id, body }: { id: number; body: { status?: CopyStatus; shelfLocation?: string } }) =>
      apiFetch<BookCopy>(`/copies/${id}`, { method: "PATCH", body, token }),
    onSuccess: () => {
      show("good", "Đã cập nhật bản sao.");
      done();
    },
    onError: (error) => show("bad", errorText(error, "Không cập nhật được bản sao.")),
  });

  return (
    <Modal title={`Bản sao: ${book.title}`} onClose={onClose} wide>
      {node}
      <form
        className="flex flex-wrap items-end gap-3 rounded-2xl bg-paper p-4"
        onSubmit={(event) => {
          event.preventDefault();
          add.mutate();
        }}
      >
        <div className="min-w-[180px] flex-1">
          <Field label="Mã vạch mới" htmlFor="copy-barcode">
            <input id="copy-barcode" required pattern="[A-Za-z0-9-]{3,40}" title="Chữ, số, dấu gạch ngang, 3 đến 40 ký tự" value={barcode} onChange={(e) => setBarcode(e.target.value)} className={inputClass} />
          </Field>
        </div>
        <div className="min-w-[140px] flex-1">
          <Field label="Vị trí kệ" htmlFor="copy-shelf">
            <input id="copy-shelf" maxLength={50} value={shelf} onChange={(e) => setShelf(e.target.value)} className={inputClass} placeholder="Kệ A2-03" />
          </Field>
        </div>
        <Button type="submit" disabled={add.isPending}>
          Thêm bản sao
        </Button>
      </form>

      <div className="mt-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-ink-soft">{copies.data ? `${copies.data.length} bản sao` : ""}</p>
          <Link
            href={`/librarian/labels?bookIds=${book.id}`}
            target="_blank"
            rel="noopener"
            className={rowButtonClass()}
          >
            In nhãn mã vạch tất cả bản sao
          </Link>
        </div>
        {copies.isLoading ? (
          <TableSkeleton rows={4} cols={4} />
        ) : (copies.data ?? []).length === 0 ? (
          <EmptyState title="Đầu sách này chưa có bản sao" hint="Nhập mã vạch ở trên để thêm bản sao đầu tiên lên kệ." />
        ) : (
          <TableShell minWidth={620} maxHeight={380} label="Danh sách bản sao, cuộn để xem hết">
            <caption className="sr-only">Danh sách bản sao</caption>
            <thead>
              <tr>
                <Th>Mã vạch</Th>
                <Th>Vị trí kệ</Th>
                <Th>Trạng thái</Th>
                <Th align="right">
                  <span className="sr-only">In nhãn</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {(copies.data ?? []).map((copy) => (
                <CopyRow
                  key={copy.id}
                  copy={copy}
                  pending={update.isPending}
                  onSave={(body) => update.mutate({ id: copy.id, body })}
                />
              ))}
            </tbody>
          </TableShell>
        )}
        <p className="mt-3 text-xs leading-relaxed text-ink-faint">
          Bản sao đang được mượn đổi trạng thái qua quầy mượn trả. Đánh dấu Mất hoặc Bảo trì ở đây khi cần gỡ khỏi kệ.
        </p>
      </div>
    </Modal>
  );
}

function CopyRow({
  copy,
  pending,
  onSave,
}: {
  copy: BookCopy;
  pending: boolean;
  onSave: (body: { status?: CopyStatus; shelfLocation?: string }) => void;
}) {
  const [shelf, setShelf] = useState(copy.shelfLocation ?? "");
  const borrowed = copy.status === "BORROWED";
  return (
    <tr>
      <Td className="whitespace-nowrap py-2.5 font-semibold tabular-nums">{copy.barcode}</Td>
      <Td className="py-2.5">
        <input
          aria-label={`Vị trí kệ của ${copy.barcode}`}
          value={shelf}
          onChange={(e) => setShelf(e.target.value)}
          onBlur={() => {
            if (shelf.trim() !== (copy.shelfLocation ?? "")) onSave({ shelfLocation: shelf.trim() });
          }}
          className={`${inputClass} min-h-10`}
        />
      </Td>
      <Td className="py-2.5">
        {borrowed ? (
          <StatusBadge tone="info">{COPY_STATUS.BORROWED.label}</StatusBadge>
        ) : (
          <select
            aria-label={`Trạng thái của ${copy.barcode}`}
            value={copy.status}
            disabled={pending}
            onChange={(e) => onSave({ status: e.target.value as CopyStatus })}
            className={`${inputClass} min-h-10 pr-9`}
          >
            {(["AVAILABLE", "MAINTENANCE", "LOST"] as const).map((status) => (
              <option key={status} value={status}>
                {COPY_STATUS[status].label}
              </option>
            ))}
          </select>
        )}
      </Td>
      <Td align="right" className="py-2.5">
        <Link
          href={`/librarian/labels?copyIds=${copy.id}`}
          target="_blank"
          rel="noopener"
          aria-label={`In nhãn của ${copy.barcode}`}
          className={rowButtonClass()}
        >
          In nhãn
        </Link>
      </Td>
    </tr>
  );
}

function ImportModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { token } = useAuth();
  const [text, setText] = useState("");
  const [report, setReport] = useState<ImportReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useMutation({
    mutationFn: (isbns: string[]) => apiFetch<ImportReport>("/books/import", { method: "POST", body: { isbns }, token }),
    onSuccess: (result) => {
      setReport(result);
      onDone();
    },
    onError: (err) => setError(errorText(err, "Không nhập được.")),
  });

  const isbns = text
    .split(/[\s,;]+/)
    .map((value) => value.trim())
    .filter(Boolean);

  return (
    <Modal title="Nhập sách theo ISBN" onClose={onClose}>
      <p className="text-sm leading-relaxed text-ink-soft">
        Mỗi ISBN một dòng (tối đa 100). Hệ thống lấy thông tin từ Google Books, bỏ qua ISBN đã có trong kho.
      </p>
      <label htmlFor="import-isbns" className="sr-only">
        Danh sách ISBN
      </label>
      <textarea id="import-isbns" rows={6} value={text} onChange={(e) => setText(e.target.value)} className={`${inputClass} mt-3 tabular-nums`} placeholder={"9780439023481\n9780061120084"} />
      {error && (
        <div className="mt-3">
          <FormError>{error}</FormError>
        </div>
      )}
      {report && (
        <div className="mt-4 space-y-2 rounded-2xl bg-paper p-4 text-sm">
          <p className="font-semibold text-leaf">Đã thêm {report.created.length} đầu sách.</p>
          {report.skipped.length > 0 && (
            <ul className="space-y-1 text-ink-soft">
              {report.skipped.map((item) => (
                <li key={item.isbn}>
                  {item.isbn}: {item.reason === "EXISTS" ? "đã có trong kho" : "không tìm thấy trên Google Books"}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Đóng
        </Button>
        <Button
          disabled={run.isPending || isbns.length === 0 || isbns.length > 100}
          onClick={() => {
            setError(null);
            setReport(null);
            run.mutate(isbns);
          }}
        >
          {run.isPending ? "Đang nhập..." : `Nhập ${isbns.length || ""} ISBN`}
        </Button>
      </div>
    </Modal>
  );
}
