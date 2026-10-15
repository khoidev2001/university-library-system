/**
 * Ghi CSV theo RFC 4180 cho bảng xuất dữ liệu.
 * - UTF-8 có BOM để Excel nhận đúng tiếng Việt khi mở bằng cú đúp.
 * - Chống CSV/formula injection: ô văn bản bắt đầu bằng = + - @ (hoặc tab / CR) bị Excel, LibreOffice,
 *   Google Sheets coi là công thức nên thêm dấu ' phía trước (khuyến nghị của OWASP).
 */
export const CSV_BOM = '\uFEFF';
export const CSV_EOL = '\r\n';

const FORMULA_START = /^[=+\-@\t\r]/;
const NEEDS_QUOTES = /[",\r\n]/;
// Ký tự điều khiển (trừ tab, LF, CR) vô nghĩa trong CSV và có thể làm hỏng trình đọc
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export type CsvValue = string | number | boolean | Date | null | undefined;

/** Vô hiệu hoá công thức: chỉ áp dụng cho văn bản, số thật (kể cả âm) được ghi nguyên. */
export function neutralizeFormula(text: string): string {
  return FORMULA_START.test(text) ? `'${text}` : text;
}

/** Văn bản an toàn để ghi vào bảng tính (CSV hoặc xlsx): bỏ ký tự điều khiển, vô hiệu hoá công thức. */
export function safeSpreadsheetText(raw: string): string {
  return neutralizeFormula(raw.replace(CONTROL_CHARS, ''));
}

/** Một ô CSV đã thoát. Số → chữ số trần; ngày → ISO UTC (nơi gọi nên tự định dạng theo giờ thư viện). */
export function csvCell(value: CsvValue): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number')
    return Number.isFinite(value) ? String(value) : '';
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  const raw = value instanceof Date ? value.toISOString() : value;
  const text = safeSpreadsheetText(raw);
  return NEEDS_QUOTES.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Một dòng CSV, kèm xuống dòng CRLF cuối. */
export function csvLine(values: readonly CsvValue[]): string {
  return values.map(csvCell).join(',') + CSV_EOL;
}
