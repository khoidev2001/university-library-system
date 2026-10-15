import type { Writable } from 'stream';
import * as ExcelJS from 'exceljs';
import {
  CSV_BOM,
  csvLine,
  safeSpreadsheetText,
} from '../../common/csv/csv-writer';
import {
  formatLibraryDate,
  formatLibraryDateTime,
  toLibraryWallClock,
} from './export-format';

/**
 * Kiểu cột quyết định cách ghi: CSV ghi chuỗi / số trần, xlsx ghi ô số / ngày thật để Excel
 * cộng, lọc, sắp xếp được (không phải chuỗi "120000" hay "15/10/2026").
 */
export type ColumnType = 'text' | 'int' | 'vnd' | 'date' | 'datetime';

export type CellValue = string | number | Date | null;

export interface ExportColumn<T> {
  header: string;
  width: number;
  type: ColumnType;
  value: (row: T) => CellValue;
}

export interface ExportSink {
  start(
    headers: string[],
    types: ColumnType[],
    widths: number[],
  ): Promise<void>;
  row(values: CellValue[]): Promise<void>;
  finish(): Promise<void>;
}

const NUM_FMT: Partial<Record<ColumnType, string>> = {
  int: '#,##0',
  vnd: '#,##0" ₫"',
  date: 'dd/mm/yyyy',
  datetime: 'dd/mm/yyyy hh:mm',
};

/** Chờ hàng đợi ghi của luồng cạn (backpressure); luồng đã đóng thì dừng xuất. */
async function drain(out: Writable): Promise<void> {
  if (out.destroyed || out.writableEnded) throw new ExportAborted();
  if (!out.writableNeedDrain) return;
  await new Promise<void>((resolve, reject) => {
    const onDrain = () => {
      cleanup();
      resolve();
    };
    const onClose = () => {
      cleanup();
      reject(new ExportAborted());
    };
    const cleanup = () => {
      out.off('drain', onDrain);
      out.off('close', onClose);
    };
    out.once('drain', onDrain);
    out.once('close', onClose);
  });
}

/** Người dùng đóng kết nối giữa chừng: dừng đọc DB, không phải lỗi hệ thống. */
export class ExportAborted extends Error {
  constructor() {
    super('Kết nối tải xuống đã đóng');
    this.name = 'ExportAborted';
  }
}

const FLUSH_BYTES = 64 * 1024;

export class CsvSink implements ExportSink {
  private buffer = '';
  private types: ColumnType[] = [];

  constructor(private readonly out: Writable) {}

  async start(headers: string[], types: ColumnType[]): Promise<void> {
    this.types = types;
    this.buffer = CSV_BOM + csvLine(headers);
    await this.flush();
  }

  async row(values: CellValue[]): Promise<void> {
    this.buffer += csvLine(
      values.map((v, i) => {
        if (v instanceof Date)
          return this.types[i] === 'date'
            ? formatLibraryDate(v)
            : formatLibraryDateTime(v);
        return v;
      }),
    );
    if (this.buffer.length >= FLUSH_BYTES) await this.flush();
  }

  async finish(): Promise<void> {
    await this.flush();
    await new Promise<void>((resolve) => this.out.end(resolve));
  }

  private async flush(): Promise<void> {
    if (this.buffer) {
      this.out.write(this.buffer);
      this.buffer = '';
    }
    await drain(this.out);
  }
}

export class XlsxSink implements ExportSink {
  private workbook?: ExcelJS.stream.xlsx.WorkbookWriter;
  private sheet?: ExcelJS.Worksheet;
  private types: ColumnType[] = [];
  private written = 0;

  constructor(
    private readonly out: Writable,
    private readonly sheetName: string,
  ) {}

  start(
    headers: string[],
    types: ColumnType[],
    widths: number[],
  ): Promise<void> {
    this.types = types;
    this.workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
      stream: this.out,
      useStyles: true,
      useSharedStrings: false,
    });
    this.workbook.creator = 'ULS';
    this.workbook.created = new Date();
    // Tên sheet tối đa 31 ký tự và không chứa : \ / ? * [ ]
    const name =
      this.sheetName.replace(/[:\/?*[\]]/g, ' ').slice(0, 31) || 'Dữ liệu';
    const sheet = this.workbook.addWorksheet(name, {
      views: [{ state: 'frozen', ySplit: 1 }],
    });
    sheet.columns = widths.map((width) => ({ width }));
    const header = sheet.addRow(headers);
    header.font = { bold: true };
    header.alignment = { vertical: 'middle', wrapText: true };
    header.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF1ECE1' },
    };
    header.commit();
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: headers.length },
    };
    this.sheet = sheet;
    return Promise.resolve();
  }

  async row(values: CellValue[]): Promise<void> {
    const sheet = this.sheet!;
    const row = sheet.addRow(
      // Ngày ghi theo giờ treo tường của thư viện: Excel không có múi giờ nên phải dời trước
      values.map((v) =>
        v instanceof Date
          ? toLibraryWallClock(v)
          : typeof v === 'string'
            ? safeSpreadsheetText(v)
            : v,
      ),
    );
    row.eachCell({ includeEmpty: false }, (cell, col) => {
      const fmt = NUM_FMT[this.types[col - 1]];
      if (fmt) cell.numFmt = fmt;
    });
    row.commit();
    // Nhường vòng lặp sự kiện để các yêu cầu khác không bị đứng khi xuất file lớn
    if (++this.written % 1000 === 0) {
      await new Promise<void>((r) => setImmediate(r));
      await drain(this.out);
    }
  }

  async finish(): Promise<void> {
    await this.sheet!.commit();
    await this.workbook!.commit();
  }
}
