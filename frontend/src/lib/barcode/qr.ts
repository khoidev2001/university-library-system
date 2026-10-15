import { encode } from "uqr";

/** Vùng yên tĩnh của QR theo chuẩn: 4 mô-đun. */
export const QR_QUIET_MODULES = 4;

/**
 * Ma trận QR (true = ô đen), không gồm vùng yên tĩnh. Mức sửa lỗi M (15%) đủ cho thẻ in và nhãn dán
 * bị xước nhẹ mà vẫn giữ mã nhỏ. Dùng chung một thư viện nhỏ (uqr, ~8KB gzip) chỉ nạp ở trang in.
 */
export function qrMatrix(text: string): boolean[][] {
  return encode(text, { ecc: "M", border: 0, boostEcc: false }).data;
}

/** Các ô đen liên tiếp trên cùng một hàng gộp thành đoạn để SVG gọn (một path thay cho hàng trăm rect). */
export function qrPath(matrix: boolean[][], offset = 0): string {
  const parts: string[] = [];
  matrix.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      if (!row[x]) {
        x++;
        continue;
      }
      let end = x;
      while (end < row.length && row[end]) end++;
      parts.push(`M${x + offset} ${y + offset}h${end - x}v1h-${end - x}z`);
      x = end;
    }
  });
  return parts.join("");
}
