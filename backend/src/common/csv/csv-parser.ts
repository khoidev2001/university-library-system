/**
 * Đọc CSV (RFC 4180) cho nhập sách từ file. Chịu được: BOM, CRLF / LF / CR, ô có ngoặc kép chứa dấu
 * phân cách / xuống dòng / "" thoát, dấu phân cách `,` `;` hoặc tab (Excel bản tiếng Việt lưu bằng `;`).
 */
export class CsvParseError extends Error {
  constructor(
    message: string,
    readonly line: number,
  ) {
    super(message);
    this.name = 'CsvParseError';
  }
}

export interface CsvParseOptions {
  /** Mặc định tự nhận từ dòng đầu. */
  delimiter?: ',' | ';' | '\t';
  /** Vượt quá số dòng này thì dừng và báo lỗi (không đọc hết file khổng lồ). */
  maxRows?: number;
  maxCellLength?: number;
}

const DELIMITERS = [',', ';', '\t'] as const;

/** Chọn dấu phân cách xuất hiện nhiều nhất ngoài ngoặc kép ở dòng đầu. */
export function detectDelimiter(text: string): ',' | ';' | '\t' {
  const counts: Record<string, number> = { ',': 0, ';': 0, '\t': 0 };
  let inQuotes = false;
  for (const ch of text) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes && (ch === '\n' || ch === '\r')) break;
    else if (!inQuotes && ch in counts) counts[ch]++;
  }
  let best: (typeof DELIMITERS)[number] = ',';
  for (const d of DELIMITERS) if (counts[d] > counts[best]) best = d;
  return best;
}

export interface CsvRow {
  /** Số dòng (từ 1) nơi dòng dữ liệu bắt đầu, tính cả dòng trống đã bỏ qua. */
  line: number;
  cells: string[];
}

export function parseCsv(
  input: string,
  options: CsvParseOptions = {},
): string[][] {
  return parseCsvRows(input, options).map((r) => r.cells);
}

export function parseCsvRows(
  input: string,
  options: CsvParseOptions = {},
): CsvRow[] {
  const maxRows = options.maxRows ?? Infinity;
  const maxCell = options.maxCellLength ?? 100_000;
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const delimiter = options.delimiter ?? detectDelimiter(text);

  const rows: CsvRow[] = [];
  let startLine = 1;
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  let wasQuoted = false;
  let line = 1;
  let rowHasContent = false;

  const endCell = () => {
    if (cell.length > maxCell)
      throw new CsvParseError(`Ô dữ liệu dài quá ${maxCell} ký tự`, line);
    row.push(cell);
    cell = '';
    wasQuoted = false;
  };
  const endRow = () => {
    endCell();
    // Dòng trống hoàn toàn (không có ký tự nào) bị bỏ qua; dòng toàn dấu phân cách thì giữ để đánh số đúng
    if (rowHasContent) {
      rows.push({ line: startLine, cells: row });
      if (rows.length > maxRows)
        throw new CsvParseError(`File có nhiều hơn ${maxRows} dòng`, line);
    }
    row = [];
    rowHasContent = false;
  };
  const markContent = () => {
    if (!rowHasContent) startLine = line;
    rowHasContent = true;
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        if (ch === '\n') line++;
        cell += ch;
        if (cell.length > maxCell)
          throw new CsvParseError(`Ô dữ liệu dài quá ${maxCell} ký tự`, line);
      }
      continue;
    }
    if (ch === '"' && cell === '' && !wasQuoted) {
      markContent();
      inQuotes = true;
      wasQuoted = true;
    } else if (ch === delimiter) {
      markContent();
      endCell();
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      endRow();
      line++;
    } else {
      // Ký tự thừa ngay sau ngoặc kép đóng ("abc"xyz) hoặc ngoặc kép lạc giữa ô: Excel nối vào ô, ta làm giống
      cell += ch;
      markContent();
    }
  }
  if (inQuotes)
    throw new CsvParseError('Có dấu ngoặc kép mở nhưng không được đóng', line);
  if (rowHasContent || cell !== '' || row.length > 0) endRow();
  return rows;
}
