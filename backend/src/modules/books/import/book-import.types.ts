/** Giới hạn của nhập sách từ file. Đổi ở đây là đổi cho cả kiểm tra lẫn tài liệu. */
export const IMPORT_MAX_FILE_BYTES = 5 * 1024 * 1024;
export const IMPORT_MAX_ROWS = 5000;
export const IMPORT_MAX_COPIES = 50;
export const IMPORT_BATCH_SIZE = 100;

export type ImportColumn =
  | 'title'
  | 'authors'
  | 'category'
  | 'isbn'
  | 'publisher'
  | 'publishedYear'
  | 'price'
  | 'description'
  | 'coverUrl'
  | 'copies'
  | 'shelfLocation';

/** Thứ tự cột trong file mẫu. */
export const IMPORT_COLUMNS: ImportColumn[] = [
  'title',
  'authors',
  'category',
  'isbn',
  'publisher',
  'publishedYear',
  'price',
  'description',
  'coverUrl',
  'copies',
  'shelfLocation',
];

export type OnDuplicate = 'skip' | 'update';

/** Một dòng đã chuẩn hoá. Trường null = ô để trống. */
export interface ImportBookData {
  title: string;
  authors: string[];
  category: string | null;
  isbn: string | null;
  publisher: string | null;
  publishedYear: number | null;
  price: number | null;
  description: string | null;
  coverUrl: string | null;
  copies: number | null;
  shelfLocation: string | null;
}

export interface RowIssue {
  field: ImportColumn | null;
  code: string;
  message: string;
}

export type RawRow = Partial<Record<ImportColumn, string>>;

export interface ParsedRow {
  /** Số dòng trong file gốc (dòng 1 là tiêu đề, dữ liệu đầu tiên là dòng 2). */
  row: number;
  raw: RawRow;
  data: ImportBookData | null;
  errors: RowIssue[];
  warnings: RowIssue[];
}

export type RowAction = 'create' | 'update' | 'skip' | 'none';

export interface ImportPreviewRow {
  row: number;
  status: 'ok' | 'warning' | 'error';
  action: RowAction;
  title: string | null;
  isbn: string | null;
  category: string | null;
  copies: number | null;
  errors: RowIssue[];
  warnings: RowIssue[];
  /** Chỉ kèm theo ở dòng lỗi để tải lại thành CSV sửa rồi nhập lại. */
  raw?: RawRow;
}

export interface ImportPreview {
  dryRun: true;
  fileType: 'csv' | 'xlsx';
  totalRows: number;
  counts: {
    ok: number;
    warning: number;
    error: number;
    create: number;
    update: number;
    skip: number;
  };
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

export interface ImportReport {
  dryRun: false;
  fileType: 'csv' | 'xlsx';
  totalRows: number;
  created: number;
  updated: number;
  skipped: number;
  failed: ImportFailure[];
  createdCopies: number;
  newCategories: string[];
  notes: string[];
}
