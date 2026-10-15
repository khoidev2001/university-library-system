/**
 * Bộ mã hoá Code 128 tự chứa (không phụ thuộc thư viện nào), để in mã vạch bản sao và thẻ bạn đọc.
 *
 * Bảng 107 mẫu vạch là bảng chuẩn ISO/IEC 15417 (đối chiếu bằng jsbarcode và giải mã ngược bằng
 * zxing-wasm trong scripts/verify-barcodes.mts). Mỗi mẫu là 11 mô-đun (1 = vạch đen, 0 = trắng),
 * riêng mẫu dừng dài 13.
 *
 * Không có import nào để script kiểm thử chạy thẳng bằng Node.
 */
const PATTERNS: string[] = [
  '11011001100', '11001101100', '11001100110', '10010011000',
  '10010001100', '10001001100', '10011001000', '10011000100',
  '10001100100', '11001001000', '11001000100', '11000100100',
  '10110011100', '10011011100', '10011001110', '10111001100',
  '10011101100', '10011100110', '11001110010', '11001011100',
  '11001001110', '11011100100', '11001110100', '11101101110',
  '11101001100', '11100101100', '11100100110', '11101100100',
  '11100110100', '11100110010', '11011011000', '11011000110',
  '11000110110', '10100011000', '10001011000', '10001000110',
  '10110001000', '10001101000', '10001100010', '11010001000',
  '11000101000', '11000100010', '10110111000', '10110001110',
  '10001101110', '10111011000', '10111000110', '10001110110',
  '11101110110', '11010001110', '11000101110', '11011101000',
  '11011100010', '11011101110', '11101011000', '11101000110',
  '11100010110', '11101101000', '11101100010', '11100011010',
  '11101111010', '11001000010', '11110001010', '10100110000',
  '10100001100', '10010110000', '10010000110', '10000101100',
  '10000100110', '10110010000', '10110000100', '10011010000',
  '10011000010', '10000110100', '10000110010', '11000010010',
  '11001010000', '11110111010', '11000010100', '10001111010',
  '10100111100', '10010111100', '10010011110', '10111100100',
  '10011110100', '10011110010', '11110100100', '11110010100',
  '11110010010', '11011011110', '11011110110', '11110110110',
  '10101111000', '10100011110', '10001011110', '10111101000',
  '10111100010', '11110101000', '11110100010', '10111011110',
  '10111101110', '11101011110', '11110101110', '11010000100',
  '11010010000', '11010011100', '1100011101011',
];

const START_B = 104;
const START_C = 105;
const CODE_B = 100;
const CODE_C = 99;
const STOP = 106;
/** Vùng yên tĩnh tối thiểu hai bên theo chuẩn: 10 mô-đun. */
export const QUIET_MODULES = 10;

const isDigit = (c: string | undefined): boolean => c !== undefined && c >= "0" && c <= "9";

function digitRun(text: string, from: number): number {
  let n = 0;
  while (isDigit(text[from + n])) n++;
  return n;
}

/**
 * Dãy ký hiệu (gồm ký tự bắt đầu, ký tự kiểm và ký tự dừng). Dùng tập B cho chữ và ký hiệu; chuyển sang
 * tập C (hai chữ số một ký hiệu) khi gặp dãy ≥ 6 chữ số giữa chuỗi hoặc ≥ 4 chữ số ở đầu / cuối chuỗi.
 */
export function code128Symbols(text: string): number[] {
  if (text.length === 0) throw new RangeError("Chuỗi mã vạch rỗng");
  for (const ch of text)
    if (ch.charCodeAt(0) < 32 || ch.charCodeAt(0) > 126)
      throw new RangeError("Code 128 (tập B) chỉ mã hoá ký tự ASCII in được");

  const out: number[] = [];
  let set: "B" | "C";
  let i = 0;
  const lead = digitRun(text, 0);
  if (lead >= 4 || (lead === text.length && lead % 2 === 0)) {
    if (lead % 2 === 0) {
      out.push(START_C);
    } else {
      // Số chữ số lẻ: ký tự đầu đi bằng tập B, phần còn lại (chẵn) sang tập C
      out.push(START_B, text.charCodeAt(0) - 32, CODE_C);
      i = 1;
    }
    set = "C";
  } else {
    set = "B";
    out.push(START_B);
  }

  while (i < text.length) {
    const run = digitRun(text, i);
    const atEnd = i + run === text.length;
    if (set === "B") {
      if (run >= (atEnd ? 4 : 6)) {
        if (run % 2 === 1) {
          out.push(text.charCodeAt(i) - 32);
          i++;
        }
        out.push(CODE_C);
        set = "C";
        continue;
      }
      out.push(text.charCodeAt(i) - 32);
      i++;
    } else {
      if (run >= 2) {
        out.push(Number(text.slice(i, i + 2)));
        i += 2;
      } else {
        out.push(CODE_B);
        set = "B";
      }
    }
  }

  // Ký tự kiểm: (ký hiệu bắt đầu + Σ vị trí × giá trị) mod 103
  let sum = out[0];
  for (let p = 1; p < out.length; p++) sum += p * out[p];
  out.push(sum % 103, STOP);
  return out;
}

/** Chuỗi mô-đun "1101…" (không gồm vùng yên tĩnh). */
export function code128Modules(text: string): string {
  return code128Symbols(text)
    .map((s) => PATTERNS[s])
    .join("");
}

export interface BarRun {
  x: number;
  width: number;
}

/** Các vạch đen liên tiếp gộp thành đoạn (x, độ rộng) tính theo mô-đun. */
export function barRuns(modules: string): BarRun[] {
  const runs: BarRun[] = [];
  let start = -1;
  for (let i = 0; i <= modules.length; i++) {
    const black = modules[i] === "1";
    if (black && start < 0) start = i;
    if (!black && start >= 0) {
      runs.push({ x: start, width: i - start });
      start = -1;
    }
  }
  return runs;
}
