import { LIBRARY_UTC_OFFSET_MINUTES } from '../../common/date.util';

export type ExportFormat = 'csv' | 'xlsx';

export const CSV_CONTENT_TYPE = 'text/csv; charset=utf-8';
export const XLSX_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const pad = (n: number, width = 2) => String(n).padStart(width, '0');

/** Dời thời điểm UTC sang "giờ treo tường" của thư viện, đọc ra bằng các hàm getUTC*. */
export function toLibraryWallClock(
  date: Date,
  offsetMinutes: number = LIBRARY_UTC_OFFSET_MINUTES,
): Date {
  return new Date(date.getTime() + offsetMinutes * 60_000);
}

/** "2026-10-15" theo giờ thư viện. */
export function formatLibraryDate(
  date: Date,
  offsetMinutes: number = LIBRARY_UTC_OFFSET_MINUTES,
): string {
  const d = toLibraryWallClock(date, offsetMinutes);
  return `${pad(d.getUTCFullYear(), 4)}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** "2026-10-15 14:30" theo giờ thư viện (Excel đọc được thành ngày giờ ở mọi locale). */
export function formatLibraryDateTime(
  date: Date,
  offsetMinutes: number = LIBRARY_UTC_OFFSET_MINUTES,
): string {
  const d = toLibraryWallClock(date, offsetMinutes);
  return `${formatLibraryDate(date, offsetMinutes)} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/** Nhãn thời điểm gắn vào tên file: "20261015-1430". */
export function fileStamp(date: Date = new Date()): string {
  return formatLibraryDateTime(date).replace(/[-: ]/g, (c) =>
    c === ' ' ? '-' : '',
  );
}
