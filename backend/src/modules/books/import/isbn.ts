/** Chuẩn hoá ISBN do người dùng gõ: bỏ khoảng trắng, gạch ngang, chữ X cuối viết hoa. */
export function normalizeIsbn(raw: string): string {
  return raw.replace(/[\s-]/g, '').toUpperCase();
}

export type IsbnCheck =
  | { ok: true; kind: 10 | 13 }
  | { ok: false; reason: 'LENGTH' | 'CHARS' | 'CHECKSUM' };

function checksum10(digits: string): boolean {
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    const c = digits[i];
    const v = c === 'X' ? 10 : Number(c);
    sum += v * (10 - i);
  }
  return sum % 11 === 0;
}

function checkDigit13(first12: string): number {
  let sum = 0;
  for (let i = 0; i < 12; i++)
    sum += Number(first12[i]) * (i % 2 === 0 ? 1 : 3);
  return (10 - (sum % 10)) % 10;
}

/** Kiểm độ dài, ký tự và chữ số kiểm của ISBN-10 / ISBN-13 (đã qua normalizeIsbn). */
export function checkIsbn(isbn: string): IsbnCheck {
  if (isbn.length !== 10 && isbn.length !== 13)
    return { ok: false, reason: 'LENGTH' };
  if (isbn.length === 10) {
    if (!/^\d{9}[\dX]$/.test(isbn)) return { ok: false, reason: 'CHARS' };
    return checksum10(isbn)
      ? { ok: true, kind: 10 }
      : { ok: false, reason: 'CHECKSUM' };
  }
  if (!/^\d{13}$/.test(isbn)) return { ok: false, reason: 'CHARS' };
  return checkDigit13(isbn.slice(0, 12)) === Number(isbn[12])
    ? { ok: true, kind: 13 }
    : { ok: false, reason: 'CHECKSUM' };
}

/** ISBN-10 hợp lệ → dạng ISBN-13 (tiền tố 978). */
export function isbn10To13(isbn10: string): string {
  const body = `978${isbn10.slice(0, 9)}`;
  return body + checkDigit13(body);
}

/** ISBN-13 tiền tố 978 → ISBN-10; tiền tố 979 không có dạng ISBN-10 nên trả null. */
export function isbn13To10(isbn13: string): string | null {
  if (!isbn13.startsWith('978')) return null;
  const body = isbn13.slice(3, 12);
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(body[i]) * (10 - i);
  const check = (11 - (sum % 11)) % 11;
  return body + (check === 10 ? 'X' : String(check));
}

/**
 * Mọi dạng viết của cùng một ấn bản: cùng cuốn sách nhập ISBN-10 lần này và ISBN-13 lần sau
 * phải bị nhận ra là một, nếu không nhập lại file sẽ sinh sách trùng.
 */
export function isbnVariants(isbn: string): string[] {
  const check = checkIsbn(isbn);
  if (!check.ok) return [isbn];
  if (check.kind === 10) return [isbn, isbn10To13(isbn)];
  const ten = isbn13To10(isbn);
  return ten ? [isbn, ten] : [isbn];
}
