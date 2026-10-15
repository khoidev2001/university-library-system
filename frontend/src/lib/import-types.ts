/** Kiểu dữ liệu cho nhập sách từ file (POST /books/import-file), khớp backend/src/modules/books/import. */

export type ImportColumn =
  | "title"
  | "authors"
  | "category"
  | "isbn"
  | "publisher"
  | "publishedYear"
  | "price"
  | "description"
  | "coverUrl"
  | "copies"
  | "shelfLocation";

export const IMPORT_COLUMNS: ImportColumn[] = [
  "title",
  "authors",
  "category",
  "isbn",
  "publisher",
  "publishedYear",
  "price",
  "description",
  "coverUrl",
  "copies",
  "shelfLocation",
];

export const IMPORT_MAX_FILE_BYTES = 5 * 1024 * 1024;

export type OnDuplicate = "skip" | "update";
export type RawRow = Partial<Record<ImportColumn, string>>;

export interface RowIssue {
  field: ImportColumn | null;
  code: string;
  message: string;
}

export interface ImportPreviewRow {
  row: number;
  status: "ok" | "warning" | "error";
  action: "create" | "update" | "skip" | "none";
  title: string | null;
  isbn: string | null;
  category: string | null;
  copies: number | null;
  errors: RowIssue[];
  warnings: RowIssue[];
  raw?: RawRow;
}

export interface ImportPreview {
  dryRun: true;
  fileType: "csv" | "xlsx";
  totalRows: number;
  counts: { ok: number; warning: number; error: number; create: number; update: number; skip: number };
  newCategories: string[];
  unknownColumns: string[];
  notes: string[];
  rows: ImportPreviewRow[];
}

export interface ImportFailure {
  row: number;
  reason: string;
  raw: RawRow;
}

export interface ImportFileReport {
  dryRun: false;
  fileType: "csv" | "xlsx";
  totalRows: number;
  created: number;
  updated: number;
  skipped: number;
  failed: ImportFailure[];
  createdCopies: number;
  newCategories: string[];
  notes: string[];
}

/** Bản sao kèm sách, dùng in nhãn (GET /copies/labels). */
export interface LabelCopy {
  id: number;
  barcode: string;
  shelfLocation: string | null;
  status: "AVAILABLE" | "BORROWED" | "LOST" | "MAINTENANCE" | "HELD";
  book: { id: number; title: string; isbn: string | null };
}
