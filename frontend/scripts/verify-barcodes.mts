/**
 * Kiểm tra DEV: mã vạch do code128.ts / qr.ts sinh ra phải giải mã ngược được đúng chuỗi gốc bằng
 * một bộ đọc độc lập (zxing-wasm), ở kích thước nhỏ như khi in nhãn thật.
 *
 * Chạy: pnpm verify:barcodes   (Node >= 22.18, không cần build)
 */
import { createRequire } from "node:module";
import { readBarcodes } from "zxing-wasm/reader";
import { barRuns, code128Modules, QUIET_MODULES } from "../src/lib/barcode/code128.ts";
import { qrMatrix, QR_QUIET_MODULES } from "../src/lib/barcode/qr.ts";

const require = createRequire(import.meta.url);

interface Gray {
  data: Uint8ClampedArray;
  width: number;
  height: number;
  colorSpace: "srgb";
}

function toImage(rows: boolean[][], scale: number, quiet: number): Gray {
  const w = (rows[0].length + quiet * 2) * scale;
  const h = (rows.length + quiet * 2) * scale;
  const data = new Uint8ClampedArray(w * h * 4).fill(255);
  rows.forEach((row, ry) =>
    row.forEach((black, rx) => {
      if (!black) return;
      for (let dy = 0; dy < scale; dy++)
        for (let dx = 0; dx < scale; dx++) {
          const o = (((ry + quiet) * scale + dy) * w + (rx + quiet) * scale + dx) * 4;
          data[o] = data[o + 1] = data[o + 2] = 0;
        }
    }),
  );
  return { data, width: w, height: h, colorSpace: "srgb" };
}

function barcodeImage(text: string, scale: number): Gray {
  const bits = code128Modules(text);
  const line = Array.from({ length: bits.length }, (_, i) => bits[i] === '1');
  // 40 hàng giống nhau = vạch cao; dò quét ngang qua giữa vạch
  return padImage(Array.from({ length: 40 }, () => line), scale);
}

/** Vùng yên tĩnh chỉ ở hai bên (10 mô-đun) cộng 10 mô-đun trên dưới cho dễ tìm. */
function padImage(rows: boolean[][], scale: number): Gray {
  const padded = rows.map((r) => [...Array(QUIET_MODULES).fill(false), ...r, ...Array(QUIET_MODULES).fill(false)]);
  return toImage(padded, scale, 6);
}

const corpus = [
  "LIB-000123-1",
  "LIB-999999-50",
  "LIB-000001-1",
  "23Q74802012006",
  "SV000951",
  "GV12345",
  "0123456789",
  "12345",
  "1234567",
  "ab1234567890cd",
  "9780306406157",
  "Hello, World! ~",
  "A",
  "00",
  "x00000000y",
  "MUCE-2026-0042",
];
let seed = 42;
const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_./ ";
for (let i = 0; i < 40; i++)
  corpus.push(Array.from({ length: 3 + Math.floor(rnd() * 20) }, () => alphabet[Math.floor(rnd() * alphabet.length)]).join("").trim() || "Z9");

let failures = 0;
const check = (label: string, ok: boolean, detail = "") => {
  if (!ok) {
    failures++;
    console.error(`  FAIL ${label} ${detail}`);
  }
};

console.log("== Code 128 ==");
let decoded = 0;
let jsbarcodeEqual = 0;
let jsbarcodeShorter = 0;
const { default: JsBarcodeAuto } = require("jsbarcode/bin/barcodes/CODE128/CODE128_AUTO.js");
for (const text of corpus) {
  for (const scale of [2, 3]) {
    const results = await readBarcodes(barcodeImage(text, scale) as unknown as ImageData, {
      formats: ["Code128"],
      tryHarder: true,
      maxNumberOfSymbols: 1,
    });
    const got = results[0]?.text;
    check(`Code128 "${text}" @${scale}px/module`, got === text, `đọc được ${JSON.stringify(got)}`);
    if (got === text) decoded++;
  }
  const ref = new JsBarcodeAuto(text, {}).encode().data as string;
  const mine = code128Modules(text);
  if (ref === mine) jsbarcodeEqual++;
  else if (mine.length < ref.length) jsbarcodeShorter++;
  else check(`Code128 "${text}" không dài hơn jsbarcode`, mine.length <= ref.length, `${mine.length} > ${ref.length}`);
}
console.log(`  giải mã đúng ${decoded}/${corpus.length * 2} ảnh; trùng bit với jsbarcode ${jsbarcodeEqual}/${corpus.length}, ngắn hơn ${jsbarcodeShorter}`);

console.log("== Vạch đen/trắng không đổi khi gộp đoạn ==");
for (const text of corpus.slice(0, 5)) {
  const bits = code128Modules(text);
  const rebuilt = Array.from({ length: bits.length }, () => "0");
  for (const r of barRuns(bits)) for (let i = 0; i < r.width; i++) rebuilt[r.x + i] = "1";
  check(`barRuns "${text}"`, rebuilt.join("") === bits);
}

console.log("== QR ==");
let qrOk = 0;
const qrCorpus = ["23Q74802012006", "SV000951", "LIB-000123-1", "Nguyễn Văn Ký", "https://example.com/x?y=1"];
for (const text of qrCorpus) {
  for (const scale of [3, 5]) {
    const m = qrMatrix(text);
    const results = await readBarcodes(toImage(m, scale, QR_QUIET_MODULES) as unknown as ImageData, {
      formats: ["QRCode"],
      tryHarder: true,
    });
    const got = results[0]?.text;
    check(`QR "${text}" @${scale}px/module`, got === text, `đọc được ${JSON.stringify(got)}`);
    if (got === text) qrOk++;
  }
}
console.log(`  giải mã đúng ${qrOk}/${qrCorpus.length * 2} ảnh`);

if (failures > 0) {
  console.error(`\n${failures} lỗi`);
  process.exit(1);
}
console.log("\nOK: mọi mã vạch / QR giải mã ngược đúng.");
