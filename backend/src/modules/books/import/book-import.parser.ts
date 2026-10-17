import { HttpStatus } from '@nestjs/common';
import { CsvParseError, parseCsvRows } from '../../../common/csv/csv-parser';
import { BusinessException } from '../../../common/exceptions/business.exception';
import {
  XlsxError,
  looksLikeZip,
  readXlsx,
} from '../../../common/xlsx/xlsx-reader';
import { slugify } from '../../categories/categories.service';
import { MAX_BOOK_PRICE } from '../dto/books.dto';
import { checkIsbn, normalizeIsbn } from './isbn';
import {
  IMPORT_COLUMNS,
  IMPORT_MAX_COPIES,
  IMPORT_MAX_ROWS,
  ImportBookData,
  ImportColumn,
  ParsedRow,
  RawRow,
  RowIssue,
} from './book-import.types';

// ---------------------------------------------------------------------------
// Đọc file → bảng
// ---------------------------------------------------------------------------

export interface ImportTable {
  fileType: 'csv' | 'xlsx';
  /** Chưa gồm dòng tiêu đề và dòng trống. */
  rows: { row: number; raw: RawRow }[];
  unknownColumns: string[];
  notes: string[];
}

const fileError = (
  code: string,
  message: string,
  status: HttpStatus = HttpStatus.UNSUPPORTED_MEDIA_TYPE,
) => new BusinessException(code, message, status);

const HEADER_ALIASES: Record<ImportColumn, string[]> = {
  title: ['title', 'tieude', 'tensach', 'ten'],
  authors: ['authors', 'author', 'tacgia'],
  category: ['category', 'theloai', 'danhmuc'],
  isbn: ['isbn'],
  publisher: ['publisher', 'nhaxuatban', 'nxb'],
  publishedYear: ['publishedyear', 'namxuatban', 'namxb', 'year', 'nam'],
  price: ['price', 'giabia', 'gia', 'giatien'],
  description: ['description', 'mota'],
  coverUrl: ['coverurl', 'cover', 'anhbia', 'diachianhbia', 'image'],
  copies: ['copies', 'sobansao', 'soban', 'soluong'],
  shelfLocation: ['shelflocation', 'shelf', 'vitrike', 'kesach', 'vitri'],
};

/** "Tác giả" → "tacgia", "published_Year" → "publishedyear". */
export function normalizeHeader(header: string): string {
  return header
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

const ALIAS_TO_COLUMN = new Map<string, ImportColumn>(
  IMPORT_COLUMNS.flatMap((col) =>
    HEADER_ALIASES[col].map((alias) => [alias, col] as const),
  ),
);

const ALLOWED_EXT = new Set(['csv', 'txt', 'xlsx']);

function extensionOf(filename: string): string {
  const m = /\.([A-Za-z0-9]+)$/.exec(filename.trim());
  return m ? m[1].toLowerCase() : '';
}

/** Chữ ký (magic bytes) của các định dạng hay bị gửi nhầm, để báo lỗi đúng thay vì "sai cột". */
function sniffForeignType(buf: Uint8Array): string | null {
  const startsWith = (...bytes: number[]) =>
    bytes.every((b, i) => buf[i] === b);
  if (startsWith(0xd0, 0xcf, 0x11, 0xe0))
    return 'Excel cũ (.xls) hoặc Word cũ, hãy lưu lại thành .xlsx hoặc CSV';
  if (startsWith(0x25, 0x50, 0x44, 0x46)) return 'PDF';
  if (startsWith(0x4d, 0x5a)) return 'chương trình thực thi (.exe)';
  if (startsWith(0x7f, 0x45, 0x4c, 0x46)) return 'chương trình thực thi';
  if (startsWith(0x89, 0x50, 0x4e, 0x47)) return 'ảnh PNG';
  if (startsWith(0xff, 0xd8, 0xff)) return 'ảnh JPEG';
  if (startsWith(0x47, 0x49, 0x46, 0x38)) return 'ảnh GIF';
  if (startsWith(0x1f, 0x8b)) return 'gzip';
  if (startsWith(0x52, 0x61, 0x72, 0x21)) return 'RAR';
  return null;
}

function decodeText(buf: Buffer): string {
  // UTF-16 có BOM (Excel "Unicode Text")
  if (buf[0] === 0xff && buf[1] === 0xfe)
    return buf.toString('utf16le').slice(1);
  if (buf[0] === 0xfe && buf[1] === 0xff) {
    const swapped = Buffer.from(buf.subarray(2));
    swapped.swap16();
    return swapped.toString('utf16le');
  }
  // NUL trong 8KB đầu = file nhị phân, không phải CSV
  if (buf.subarray(0, 8192).includes(0))
    throw fileError(
      'IMPORT_FILE_TYPE_INVALID',
      'File không phải CSV hoặc xlsx (có dữ liệu nhị phân)',
    );
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    throw fileError(
      'IMPORT_ENCODING',
      'File CSV phải lưu mã hoá UTF-8 (Excel: Lưu thành → CSV UTF-8)',
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}

/** Xác định loại bằng NỘI DUNG (không tin đuôi file hay Content-Type), rồi đọc ra mảng ô. */
function readCells(
  buf: Buffer,
  filename: string,
): {
  fileType: 'csv' | 'xlsx';
  cells: { row: number; cells: string[] }[];
  notes: string[];
} {
  const ext = extensionOf(filename);
  if (ext === 'xlsm' || ext === 'xlsb' || ext === 'xls')
    throw fileError(
      'IMPORT_FILE_TYPE_INVALID',
      ext === 'xlsm'
        ? 'File xlsm (có macro) không được chấp nhận, hãy lưu thành .xlsx'
        : `Định dạng .${ext} không được hỗ trợ, hãy lưu thành .xlsx hoặc CSV`,
    );
  if (ext && !ALLOWED_EXT.has(ext))
    throw fileError(
      'IMPORT_FILE_TYPE_INVALID',
      `Chỉ nhận file .csv hoặc .xlsx (nhận được .${ext})`,
    );

  const foreign = sniffForeignType(buf);
  if (foreign)
    throw fileError(
      'IMPORT_FILE_TYPE_INVALID',
      `Nội dung file là ${foreign}, không phải CSV hoặc xlsx`,
    );

  const notes: string[] = [];
  if (looksLikeZip(buf)) {
    if (ext === 'csv' || ext === 'txt')
      throw fileError(
        'IMPORT_FILE_TYPE_INVALID',
        'Đuôi file là CSV nhưng nội dung là file nén/xlsx',
      );
    try {
      const sheet = readXlsx(buf);
      if (sheet.hasFormulas)
        notes.push(
          'File có ô chứa công thức: chỉ lấy giá trị đã tính sẵn, công thức không được thực thi.',
        );
      const cells = sheet.rows.map((cells, i) => ({ row: i + 1, cells }));
      return { fileType: 'xlsx', cells, notes };
    } catch (e) {
      if (e instanceof XlsxError) {
        const status =
          e.code === 'TOO_MANY_ROWS' || e.code === 'CORRUPT'
            ? HttpStatus.UNPROCESSABLE_ENTITY
            : e.code === 'TOO_LARGE_UNCOMPRESSED'
              ? HttpStatus.PAYLOAD_TOO_LARGE
              : HttpStatus.UNSUPPORTED_MEDIA_TYPE;
        const code =
          e.code === 'MACRO_NOT_ALLOWED'
            ? 'IMPORT_MACRO_NOT_ALLOWED'
            : e.code === 'TOO_MANY_ROWS'
              ? 'IMPORT_TOO_MANY_ROWS'
              : e.code === 'TOO_LARGE_UNCOMPRESSED'
                ? 'IMPORT_FILE_TOO_LARGE'
                : e.code === 'CORRUPT'
                  ? 'IMPORT_MALFORMED'
                  : 'IMPORT_FILE_TYPE_INVALID';
        throw fileError(code, e.message, status);
      }
      throw e;
    }
  }

  if (ext === 'xlsx')
    throw fileError(
      'IMPORT_FILE_TYPE_INVALID',
      'Đuôi file là .xlsx nhưng nội dung không phải bảng tính Excel',
    );
  try {
    const rows = parseCsvRows(decodeText(buf), {
      maxRows: IMPORT_MAX_ROWS + 1,
      maxCellLength: 100_000,
    });
    return {
      fileType: 'csv',
      cells: rows.map((r) => ({ row: r.line, cells: r.cells })),
      notes,
    };
  } catch (e) {
    if (e instanceof CsvParseError) {
      throw fileError(
        e.message.includes('nhiều hơn')
          ? 'IMPORT_TOO_MANY_ROWS'
          : 'IMPORT_MALFORMED',
        `CSV không hợp lệ (gần dòng ${e.line}): ${e.message}`,
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    throw e;
  }
}

/** Đọc file người dùng tải lên thành các dòng có tên cột chuẩn. Ném BusinessException khi file hỏng. */
export function readImportTable(buf: Buffer, filename: string): ImportTable {
  const { fileType, cells, notes } = readCells(buf, filename);
  const nonEmpty = cells.filter((r) => r.cells.some((c) => c.trim() !== ''));
  if (nonEmpty.length === 0)
    throw fileError(
      'IMPORT_EMPTY',
      'File không có dữ liệu',
      HttpStatus.UNPROCESSABLE_ENTITY,
    );

  const [header, ...body] = nonEmpty;
  const colIndex = new Map<ImportColumn, number>();
  const unknownColumns: string[] = [];
  header.cells.forEach((h, i) => {
    const text = h.trim();
    if (!text) return;
    const col = ALIAS_TO_COLUMN.get(normalizeHeader(text));
    if (!col) unknownColumns.push(text);
    else if (colIndex.has(col))
      notes.push(`Cột "${text}" bị lặp, chỉ dùng cột đầu tiên cho "${col}".`);
    else colIndex.set(col, i);
  });
  if (!colIndex.has('title'))
    throw fileError(
      'IMPORT_MISSING_COLUMN',
      'Thiếu cột bắt buộc "title" (tiêu đề). Hãy dùng file mẫu.',
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  if (body.length > IMPORT_MAX_ROWS)
    throw fileError(
      'IMPORT_TOO_MANY_ROWS',
      `File có ${body.length} dòng dữ liệu, tối đa ${IMPORT_MAX_ROWS}. Hãy chia nhỏ file.`,
      HttpStatus.UNPROCESSABLE_ENTITY,
    );

  const rows = body.map((r) => {
    const raw: RawRow = {};
    for (const [col, i] of colIndex) {
      const value = (r.cells[i] ?? '').trim();
      if (value !== '') raw[col] = value;
    }
    return { row: r.row, raw };
  });
  return { fileType, rows, unknownColumns, notes };
}

// ---------------------------------------------------------------------------
// Kiểm tra từng dòng (thuần, không đụng DB)
// ---------------------------------------------------------------------------

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const FORMULA_START = /^[=+\-@]/;

/** NFC (tiếng Việt gõ ở nguồn khác nhau có thể là tổ hợp hoặc dựng sẵn), bỏ ký tự điều khiển. */
function cleanText(value: string, collapseSpaces: boolean): string {
  const text = value.normalize('NFC').replace(CONTROL_CHARS, '');
  return (collapseSpaces ? text.replace(/\s+/g, ' ') : text).trim();
}

/** "120000", "120.000", "120,000", "120000 đ" → 120000; số lẻ / chữ → null. */
export function parseVnd(value: string): number | null {
  const s = value.replace(/\s/g, '').replace(/(₫|vnđ|vnd|đ|d)$/i, '');
  let digits: string;
  if (/^\d+$/.test(s)) digits = s;
  else if (/^\d{1,3}([.,]\d{3})+$/.test(s)) digits = s.replace(/[.,]/g, '');
  else if (/^\d+[.,]0+$/.test(s)) digits = s.split(/[.,]/)[0];
  else return null;
  const n = Number(digits);
  return Number.isSafeInteger(n) ? n : null;
}

function parseWholeNumber(value: string): number | null {
  const s = value.replace(/\s/g, '');
  if (/^\d+$/.test(s)) return Number(s);
  if (/^\d+[.,]0+$/.test(s)) return Number(s.split(/[.,]/)[0]);
  return null;
}

/** Chỉ http / https, không khoảng trắng, độ dài hợp lý. */
export function isHttpUrl(value: string): boolean {
  if (value.length > 2000 || /\s/.test(value)) return false;
  try {
    const u = new URL(value);
    return (u.protocol === 'http:' || u.protocol === 'https:') && !!u.hostname;
  } catch {
    return false;
  }
}

export function parseRow(row: number, raw: RawRow): ParsedRow {
  const errors: RowIssue[] = [];
  const warnings: RowIssue[] = [];
  const err = (field: ImportColumn, code: string, message: string) =>
    errors.push({ field, code, message });
  const warn = (field: ImportColumn, code: string, message: string) =>
    warnings.push({ field, code, message });

  const text = (
    field: ImportColumn,
    max: number,
    collapse = true,
  ): string | null => {
    const v = raw[field];
    if (v === undefined) return null;
    const cleaned = cleanText(v, collapse);
    if (cleaned === '') return null;
    if (cleaned.length > max) {
      err(field, 'TOO_LONG', `Tối đa ${max} ký tự (đang có ${cleaned.length})`);
      return null;
    }
    if (FORMULA_START.test(cleaned))
      warn(
        field,
        'FORMULA_LIKE',
        'Giá trị bắt đầu bằng ký tự = + - @, được lưu như văn bản thường (không bao giờ chạy như công thức)',
      );
    return cleaned;
  };

  const title = text('title', 300);
  if (!title && !errors.some((e) => e.field === 'title'))
    err('title', 'TITLE_REQUIRED', 'Thiếu tiêu đề sách');

  // Tác giả: tách bằng dấu chấm phẩy, bỏ trùng không phân biệt hoa thường
  const authors: string[] = [];
  if (raw.authors !== undefined) {
    const seen = new Set<string>();
    for (const part of raw.authors.split(';')) {
      const name = cleanText(part, true);
      if (!name || seen.has(name.toLowerCase())) continue;
      if (name.length > 200) {
        err(
          'authors',
          'AUTHOR_TOO_LONG',
          `Tên tác giả quá dài (tối đa 200 ký tự): "${name.slice(0, 30)}…"`,
        );
        continue;
      }
      seen.add(name.toLowerCase());
      authors.push(name);
    }
    if (authors.length > 50)
      err('authors', 'TOO_MANY_AUTHORS', 'Tối đa 50 tác giả mỗi sách');
    if (authors.some((a) => FORMULA_START.test(a)))
      warn(
        'authors',
        'FORMULA_LIKE',
        'Tên tác giả bắt đầu bằng ký tự = + - @, được lưu như văn bản thường',
      );
  }
  if (authors.length === 0 && !errors.some((e) => e.field === 'authors'))
    warn(
      'authors',
      'AUTHORS_MISSING',
      'Không có tác giả, sẽ ghi "Khuyết danh"',
    );

  const category = text('category', 100);
  if (category && slugify(category) === '')
    err(
      'category',
      'CATEGORY_INVALID',
      'Tên thể loại phải có ít nhất một chữ cái hoặc chữ số',
    );
  if (!category)
    warn(
      'category',
      'CATEGORY_MISSING',
      'Không có thể loại, sẽ xếp vào "Chưa phân loại"',
    );

  let isbn: string | null = null;
  if (raw.isbn !== undefined) {
    const normalized = normalizeIsbn(cleanText(raw.isbn, false));
    const check = checkIsbn(normalized);
    if (normalized === '') isbn = null;
    else if (check.ok) isbn = normalized;
    else if ('reason' in check && check.reason === 'LENGTH')
      err(
        'isbn',
        'ISBN_LENGTH',
        `ISBN phải có 10 hoặc 13 ký tự (đang có ${normalized.length})`,
      );
    else if ('reason' in check && check.reason === 'CHARS')
      err(
        'isbn',
        'ISBN_CHARS',
        'ISBN chỉ gồm chữ số (ISBN-10 được kết thúc bằng X)',
      );
    else err('isbn', 'ISBN_CHECKSUM', 'ISBN sai chữ số kiểm, có thể gõ nhầm');
  }
  if (isbn === null && !errors.some((e) => e.field === 'isbn'))
    warn(
      'isbn',
      'ISBN_MISSING',
      'Không có ISBN: chỉ phát hiện trùng theo tiêu đề, nhập lại file có thể tạo sách trùng',
    );

  const publisher = text('publisher', 200);
  const description = text('description', 5000, false);
  const shelfLocation = text('shelfLocation', 50);

  let publishedYear: number | null = null;
  if (raw.publishedYear !== undefined) {
    const n = parseWholeNumber(raw.publishedYear);
    if (n === null || n < 1000 || n > 2100)
      err(
        'publishedYear',
        'YEAR_RANGE',
        'Năm xuất bản phải là số từ 1000 đến 2100',
      );
    else publishedYear = n;
  }

  let price: number | null = null;
  if (raw.price !== undefined) {
    const n = parseVnd(raw.price);
    if (n === null)
      err(
        'price',
        'PRICE_INVALID',
        'Giá bìa phải là số nguyên đồng (ví dụ 120000)',
      );
    else if (n > MAX_BOOK_PRICE)
      err(
        'price',
        'PRICE_RANGE',
        `Giá bìa tối đa ${MAX_BOOK_PRICE.toLocaleString('vi-VN')} đồng`,
      );
    else price = n;
  } else {
    warn(
      'price',
      'PRICE_MISSING',
      'Không có giá bìa, sách mới dùng giá mặc định 50.000đ (ảnh hưởng tiền phạt mất sách)',
    );
  }

  let coverUrl: string | null = null;
  if (raw.coverUrl !== undefined) {
    const v = cleanText(raw.coverUrl, false);
    if (v && !isHttpUrl(v))
      err(
        'coverUrl',
        'COVER_URL_INVALID',
        'Ảnh bìa phải là địa chỉ http:// hoặc https:// hợp lệ',
      );
    else coverUrl = v || null;
  }

  let copies: number | null = null;
  if (raw.copies !== undefined) {
    const n = parseWholeNumber(raw.copies);
    if (n === null || n > IMPORT_MAX_COPIES)
      err(
        'copies',
        'COPIES_RANGE',
        `Số bản sao phải là số nguyên từ 0 đến ${IMPORT_MAX_COPIES}`,
      );
    else copies = n;
  }

  const data: ImportBookData | null =
    errors.length === 0 && title
      ? {
          title,
          authors,
          category,
          isbn,
          publisher,
          publishedYear,
          price,
          description,
          coverUrl,
          copies,
          shelfLocation,
        }
      : null;
  return { row, raw, data, errors, warnings };
}
