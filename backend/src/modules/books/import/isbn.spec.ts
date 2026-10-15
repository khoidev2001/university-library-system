import {
  checkIsbn,
  isbn10To13,
  isbn13To10,
  isbnVariants,
  normalizeIsbn,
} from './isbn';

describe('isbn', () => {
  it('normalizeIsbn bỏ gạch ngang / khoảng trắng và viết hoa X', () => {
    expect(normalizeIsbn(' 978-0-439-02348-1 ')).toBe('9780439023481');
    expect(normalizeIsbn('0-8044-2957-x')).toBe('080442957X');
  });

  it.each(['9780439023481', '9780061120084', '9791234567896'])(
    'ISBN-13 hợp lệ: %s',
    (isbn) => {
      expect(checkIsbn(isbn)).toEqual({ ok: true, kind: 13 });
    },
  );

  it('ISBN-10 hợp lệ, kể cả chữ số kiểm X', () => {
    expect(checkIsbn('0306406152')).toEqual({ ok: true, kind: 10 });
    expect(checkIsbn('080442957X')).toEqual({ ok: true, kind: 10 });
  });

  it('sai chữ số kiểm → CHECKSUM', () => {
    expect(checkIsbn('9780439023482')).toEqual({
      ok: false,
      reason: 'CHECKSUM',
    });
    expect(checkIsbn('0306406153')).toEqual({ ok: false, reason: 'CHECKSUM' });
  });

  it('sai độ dài → LENGTH, sai ký tự → CHARS', () => {
    expect(checkIsbn('12345')).toEqual({ ok: false, reason: 'LENGTH' });
    expect(checkIsbn('97804390234811')).toEqual({
      ok: false,
      reason: 'LENGTH',
    });
    expect(checkIsbn('97804390234X1')).toEqual({ ok: false, reason: 'CHARS' });
    expect(checkIsbn('03064X6152')).toEqual({ ok: false, reason: 'CHARS' });
  });

  it('đổi qua lại ISBN-10 ↔ ISBN-13', () => {
    expect(isbn10To13('0306406152')).toBe('9780306406157');
    expect(isbn13To10('9780306406157')).toBe('0306406152');
    expect(isbn13To10('9791234567896')).toBeNull();
    expect(isbn10To13('080442957X')).toBe('9780804429573');
  });

  it('isbnVariants trả đủ hai dạng để nhận ra sách trùng', () => {
    expect(isbnVariants('0306406152').sort()).toEqual([
      '0306406152',
      '9780306406157',
    ]);
    expect(isbnVariants('9780306406157').sort()).toEqual([
      '0306406152',
      '9780306406157',
    ]);
    expect(isbnVariants('9791234567896')).toEqual(['9791234567896']);
    expect(isbnVariants('abc')).toEqual(['abc']);
  });
});
