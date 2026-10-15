import { Inflate, strFromU8 } from 'fflate';
import { SaxesParser } from 'saxes';

/**
 * Đọc an toàn sheet đầu tiên của file .xlsx do người dùng tải lên.
 *
 * Vì sao không dùng thư viện đọc xlsx có sẵn: file đến từ bên ngoài, cần kiểm soát cứng
 *  - zip bomb: giải nén theo từng khúc 16KB nén và ĐẾM BYTE THẬT, vượt trần là dừng (không tin kích
 *    thước khai trong tiêu đề zip, vốn có thể nói dối);
 *  - macro / đối tượng nhúng: từ chối file chứa vbaProject.bin, macrosheet, ActiveX, OLE;
 *  - công thức: chỉ lấy giá trị đã tính (`<v>`), không bao giờ đánh giá công thức;
 *  - XML: saxes không nạp thực thể tự định nghĩa trong DOCTYPE nên không có "billion laughs".
 */
export class XlsxError extends Error {
  constructor(
    readonly code:
      | 'NOT_XLSX'
      | 'MACRO_NOT_ALLOWED'
      | 'TOO_LARGE_UNCOMPRESSED'
      | 'TOO_MANY_ROWS'
      | 'CORRUPT',
    message: string,
  ) {
    super(message);
    this.name = 'XlsxError';
  }
}

export interface XlsxLimits {
  /** Giải nén tối đa cho một phần (sheet / sharedStrings), tính theo byte thật. */
  maxEntryBytes: number;
  /** Tổng byte giải nén của mọi phần đã đọc. */
  maxTotalBytes: number;
  maxEntries: number;
  /** Số dòng sheet tối đa kể cả dòng tiêu đề. */
  maxRows: number;
  maxCols: number;
  maxCellLength: number;
}

export const DEFAULT_XLSX_LIMITS: XlsxLimits = {
  maxEntryBytes: 25 * 1024 * 1024,
  maxTotalBytes: 40 * 1024 * 1024,
  maxEntries: 500,
  maxRows: 6000,
  maxCols: 60,
  maxCellLength: 100_000,
};

export interface XlsxSheet {
  /** rows[i] là dòng số i+1 của sheet (dòng trống là mảng rỗng). Mỗi ô là chuỗi, ô trống là ''. */
  rows: string[][];
  /** Có ô nào chứa công thức không (ta chỉ đọc giá trị đã tính). */
  hasFormulas: boolean;
  sheetName: string;
}

interface ZipEntry {
  name: string;
  method: number;
  compSize: number;
  uncompSize: number;
  localOffset: number;
  flags: number;
}

const FORBIDDEN_PARTS = [
  /vbaProject\.bin$/i,
  /^xl\/macrosheets\//i,
  /^xl\/dialogsheets\//i,
  /^xl\/activeX\//i,
  /^xl\/embeddings\//i,
  /^xl\/ctrlProps\//i,
  /\.exe$/i,
  /\.dll$/i,
];

/** Dấu hiệu đầu file zip. */
export function looksLikeZip(buf: Uint8Array): boolean {
  return (
    buf.length > 4 &&
    buf[0] === 0x50 &&
    buf[1] === 0x4b &&
    buf[2] === 0x03 &&
    buf[3] === 0x04
  );
}

function readCentralDirectory(buf: Uint8Array, limits: XlsxLimits): ZipEntry[] {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let eocd = -1;
  const lowest = Math.max(0, buf.length - 22 - 0xffff);
  for (let i = buf.length - 22; i >= lowest; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0)
    throw new XlsxError(
      'NOT_XLSX',
      'Không phải file xlsx hợp lệ (thiếu danh mục zip)',
    );
  const total = view.getUint16(eocd + 10, true);
  const cdSize = view.getUint32(eocd + 12, true);
  const cdOffset = view.getUint32(eocd + 16, true);
  if (total === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff)
    throw new XlsxError('NOT_XLSX', 'File zip64 không được hỗ trợ');
  if (total > limits.maxEntries)
    throw new XlsxError(
      'TOO_LARGE_UNCOMPRESSED',
      'File xlsx chứa quá nhiều phần',
    );
  if (cdOffset + cdSize > buf.length)
    throw new XlsxError('CORRUPT', 'Danh mục zip bị hỏng');

  const entries: ZipEntry[] = [];
  let p = cdOffset;
  for (let i = 0; i < total; i++) {
    if (p + 46 > buf.length || view.getUint32(p, true) !== 0x02014b50)
      throw new XlsxError('CORRUPT', 'Danh mục zip bị hỏng');
    const flags = view.getUint16(p + 8, true);
    const method = view.getUint16(p + 10, true);
    const compSize = view.getUint32(p + 20, true);
    const uncompSize = view.getUint32(p + 24, true);
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    const localOffset = view.getUint32(p + 42, true);
    const name = strFromU8(buf.subarray(p + 46, p + 46 + nameLen));
    entries.push({ name, method, compSize, uncompSize, localOffset, flags });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

function readEntry(
  buf: Uint8Array,
  entry: ZipEntry,
  budget: { left: number },
  limits: XlsxLimits,
): Uint8Array {
  if (entry.flags & 1)
    throw new XlsxError('NOT_XLSX', 'File xlsx đặt mật khẩu không được hỗ trợ');
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const lo = entry.localOffset;
  if (lo + 30 > buf.length || view.getUint32(lo, true) !== 0x04034b50)
    throw new XlsxError('CORRUPT', 'Tiêu đề phần zip bị hỏng');
  const start =
    lo + 30 + view.getUint16(lo + 26, true) + view.getUint16(lo + 28, true);
  const end = start + entry.compSize;
  if (end > buf.length) throw new XlsxError('CORRUPT', 'Phần zip bị cắt cụt');
  const data = buf.subarray(start, end);
  const cap = Math.min(limits.maxEntryBytes, budget.left);

  if (entry.method === 0) {
    if (data.length > cap)
      throw new XlsxError('TOO_LARGE_UNCOMPRESSED', 'Dữ liệu giải nén quá lớn');
    budget.left -= data.length;
    return data;
  }
  if (entry.method !== 8)
    throw new XlsxError('NOT_XLSX', 'Kiểu nén zip không được hỗ trợ');

  const chunks: Uint8Array[] = [];
  let written = 0;
  const inflater = new Inflate((chunk) => {
    written += chunk.length;
    if (written > cap)
      throw new XlsxError(
        'TOO_LARGE_UNCOMPRESSED',
        'Dữ liệu giải nén quá lớn (nghi zip bomb)',
      );
    chunks.push(chunk);
  });
  try {
    const STEP = 16 * 1024;
    for (let o = 0; o < data.length; o += STEP) {
      inflater.push(
        data.subarray(o, Math.min(o + STEP, data.length)),
        o + STEP >= data.length,
      );
    }
  } catch (e) {
    if (e instanceof XlsxError) throw e;
    throw new XlsxError(
      'CORRUPT',
      'Không giải nén được dữ liệu trong file xlsx',
    );
  }
  budget.left -= written;
  const out = new Uint8Array(written);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

/** "AB12" → chỉ số cột (0 = A). */
function columnIndex(ref: string): number {
  let n = 0;
  for (const ch of ref) {
    const code = ch.charCodeAt(0);
    if (code < 65 || code > 90) break;
    n = n * 26 + (code - 64);
  }
  return n - 1;
}

function parseSax(
  xml: string,
  onOpen: (name: string, attrs: Record<string, string>) => void,
  onText: (text: string) => void,
  onClose: (name: string) => void,
): void {
  const parser = new SaxesParser({ xmlns: false });
  parser.on('opentag', (tag) =>
    onOpen(tag.name, tag.attributes as Record<string, string>),
  );
  parser.on('text', onText);
  parser.on('closetag', (tag) => onClose(tag.name));
  parser.on('error', (e) => {
    throw new XlsxError(
      'CORRUPT',
      `XML trong file xlsx không hợp lệ: ${e.message}`,
    );
  });
  parser.write(xml).close();
}

function parseSharedStrings(xml: string, limits: XlsxLimits): string[] {
  const strings: string[] = [];
  let current: string | null = null;
  let inT = false;
  let phoneticDepth = 0;
  parseSax(
    xml,
    (name) => {
      if (name === 'si') current = '';
      else if (name === 'rPh') phoneticDepth++;
      else if (name === 't') inT = true;
    },
    (text) => {
      if (inT && phoneticDepth === 0 && current !== null) {
        current += text;
        if (current.length > limits.maxCellLength)
          current = current.slice(0, limits.maxCellLength);
      }
    },
    (name) => {
      if (name === 'si') {
        strings.push(current ?? '');
        current = null;
      } else if (name === 'rPh') phoneticDepth--;
      else if (name === 't') inT = false;
    },
  );
  return strings;
}

/** Số lưu dạng văn bản trong XML ("9.78043902348E12") → chữ số đầy đủ khi là số nguyên. */
function normalizeNumber(raw: string): string {
  const trimmed = raw.trim();
  if (!/[eE]/.test(trimmed)) return trimmed;
  const n = Number(trimmed);
  return Number.isFinite(n) && Number.isInteger(n) && Math.abs(n) < 1e15
    ? String(n)
    : trimmed;
}

interface CellState {
  col: number;
  type: string;
  value: string;
  inline: string;
}

function parseSheet(
  xml: string,
  shared: string[],
  limits: XlsxLimits,
): { rows: string[][]; hasFormulas: boolean } {
  const rows: string[][] = [];
  let hasFormulas = false;
  let rowNumber = 0;
  let nextCol = 0;
  let cell: CellState | null = null;
  let capture: 'v' | 'is' | null = null;
  let inInlineT = false;

  const finishCell = (c: CellState) => {
    if (c.col < 0 || c.col >= limits.maxCols) return;
    let text: string;
    switch (c.type) {
      case 's':
        text = shared[parseInt(c.value, 10)] ?? '';
        break;
      case 'inlineStr':
        text = c.inline;
        break;
      case 'str':
        text = c.value;
        break;
      case 'b':
        text = c.value.trim() === '1' ? 'TRUE' : 'FALSE';
        break;
      case 'e':
        text = '';
        break;
      default:
        text = normalizeNumber(c.value);
    }
    if (text.length > limits.maxCellLength)
      text = text.slice(0, limits.maxCellLength);
    if (text === '') return;
    const row = (rows[rowNumber - 1] ??= []);
    while (row.length <= c.col) row.push('');
    row[c.col] = text;
  };

  parseSax(
    xml,
    (name, attrs) => {
      if (name === 'row') {
        rowNumber = attrs.r ? parseInt(attrs.r, 10) : rowNumber + 1;
        if (!Number.isInteger(rowNumber) || rowNumber < 1)
          throw new XlsxError('CORRUPT', 'Số dòng sheet không hợp lệ');
        if (rowNumber > limits.maxRows)
          throw new XlsxError(
            'TOO_MANY_ROWS',
            `Sheet có nhiều hơn ${limits.maxRows - 1} dòng dữ liệu`,
          );
        nextCol = 0;
      } else if (name === 'c') {
        const col = attrs.r ? columnIndex(attrs.r) : nextCol;
        nextCol = col + 1;
        cell = { col, type: attrs.t ?? 'n', value: '', inline: '' };
      } else if (name === 'v' && cell) capture = 'v';
      else if (name === 'is' && cell) capture = 'is';
      else if (name === 't' && capture === 'is') inInlineT = true;
      else if (name === 'f') hasFormulas = true;
    },
    (text) => {
      const c = cell as CellState | null;
      if (!c) return;
      if (capture === 'v') c.value += text;
      else if (capture === 'is' && inInlineT) c.inline += text;
    },
    (name) => {
      if (name === 'v' || name === 'is') capture = null;
      else if (name === 't') inInlineT = false;
      else if (name === 'c') {
        const c = cell as CellState | null;
        cell = null;
        if (c) finishCell(c);
      }
    },
  );
  // Dòng trống giữa chừng là undefined → mảng rỗng, để chỉ số = số dòng - 1
  for (let i = 0; i < rows.length; i++) rows[i] ??= [];
  return { rows, hasFormulas };
}

function resolveTarget(target: string): string {
  return target.startsWith('/')
    ? target.slice(1)
    : `xl/${target.replace(/^\.\//, '')}`;
}

/** Đọc sheet đầu tiên. Ném XlsxError nếu không phải xlsx hợp lệ / có macro / giải nén quá lớn. */
export function readXlsx(
  buf: Uint8Array,
  limits: XlsxLimits = DEFAULT_XLSX_LIMITS,
): XlsxSheet {
  if (!looksLikeZip(buf))
    throw new XlsxError('NOT_XLSX', 'Không phải file xlsx (sai định dạng)');
  const entries = readCentralDirectory(buf, limits);
  const byName = new Map(entries.map((e) => [e.name, e]));

  for (const e of entries) {
    if (FORBIDDEN_PARTS.some((re) => re.test(e.name)))
      throw new XlsxError(
        'MACRO_NOT_ALLOWED',
        'File chứa macro hoặc đối tượng nhúng, không được chấp nhận',
      );
  }
  if (!byName.has('[Content_Types].xml') || !byName.has('xl/workbook.xml'))
    throw new XlsxError('NOT_XLSX', 'Không phải bảng tính Excel (.xlsx)');

  const budget = { left: limits.maxTotalBytes };
  const text = (name: string): string | null => {
    const entry = byName.get(name);
    return entry ? strFromU8(readEntry(buf, entry, budget, limits)) : null;
  };

  const contentTypes = text('[Content_Types].xml') ?? '';
  if (/macroEnabled|vbaProject/i.test(contentTypes))
    throw new XlsxError(
      'MACRO_NOT_ALLOWED',
      'File xlsm chứa macro không được chấp nhận',
    );

  // Sheet đầu tiên theo thứ tự trong workbook.xml
  let sheetName = '';
  let sheetRid = '';
  parseSax(
    text('xl/workbook.xml') ?? '',
    (name, attrs) => {
      if (name === 'sheet' && !sheetRid) {
        sheetName = attrs.name ?? '';
        sheetRid = attrs['r:id'] ?? '';
      }
    },
    () => undefined,
    () => undefined,
  );
  if (!sheetRid) throw new XlsxError('NOT_XLSX', 'Workbook không có sheet nào');

  let target = '';
  parseSax(
    text('xl/_rels/workbook.xml.rels') ?? '',
    (name, attrs) => {
      if (name === 'Relationship' && attrs.Id === sheetRid)
        target = attrs.Target ?? '';
    },
    () => undefined,
    () => undefined,
  );
  const sheetPath = target ? resolveTarget(target) : 'xl/worksheets/sheet1.xml';
  const sheetXml = text(sheetPath);
  if (sheetXml === null)
    throw new XlsxError('CORRUPT', 'Không tìm thấy dữ liệu sheet đầu tiên');

  const sharedXml = text('xl/sharedStrings.xml');
  const shared = sharedXml ? parseSharedStrings(sharedXml, limits) : [];
  const { rows, hasFormulas } = parseSheet(sheetXml, shared, limits);
  return { rows, hasFormulas, sheetName };
}
