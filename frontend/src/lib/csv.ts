/**
 * Dựng CSV phía trình duyệt (tải lại các dòng nhập lỗi). Cùng quy tắc với bộ ghi của backend:
 * UTF-8 có BOM để Excel đọc đúng tiếng Việt, RFC 4180 và chặn CSV injection bằng dấu nháy đơn đứng
 * trước ô văn bản bắt đầu bằng = + - @ tab CR.
 */
const FORMULA_START = /^[=+\-@\t\r]/;
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  let text = value.replace(CONTROL_CHARS, "");
  if (FORMULA_START.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const line = (cells: (string | number | null | undefined)[]) => cells.map(csvCell).join(",") + "\r\n";
  return "﻿" + line(headers) + rows.map(line).join("");
}
