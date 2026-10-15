import * as ExcelJS from 'exceljs';
import { strToU8, zipSync } from 'fflate';
import { csvLine } from '../../../common/csv/csv-writer';
import {
  isHttpUrl,
  normalizeHeader,
  parseRow,
  parseVnd,
  readImportTable,
} from './book-import.parser';
import { IMPORT_COLUMNS, IMPORT_MAX_ROWS } from './book-import.types';
import { importTemplateCsv, importTemplateXlsx } from './book-import.template';

const csv = (...rows: string[][]) =>
  Buffer.from(rows.map((r) => csvLine(r)).join(''));
const codes = (r: { errors: { code: string }[] }) =>
  r.errors.map((e) => e.code);
const wcodes = (r: { warnings: { code: string }[] }) =>
  r.warnings.map((e) => e.code);

describe('parseVnd', () => {
  it.each([
    ['120000', 120000],
    ['120.000', 120000],
    ['120,000', 120000],
    ['1.200.000', 1200000],
    ['95000 đ', 95000],
    ['95000₫', 95000],
    ['95000 VND', 95000],
    ['0', 0],
    ['120000.0', 120000],
  ])('%s → %d', (input, expected) => {
    expect(parseVnd(input)).toBe(expected);
  });
  it.each(['12.5', 'abc', '-5', '1.2.3', '', '12 000 abc', '1e5'])(
    '%j không hợp lệ',
    (input) => {
      expect(parseVnd(input)).toBeNull();
    },
  );
});

describe('isHttpUrl', () => {
  it('chỉ nhận http / https', () => {
    expect(isHttpUrl('https://example.com/a.jpg')).toBe(true);
    expect(isHttpUrl('http://example.com')).toBe(true);
    for (const bad of [
      'javascript:alert(1)',
      'data:text/html;base64,AAAA',
      'file:///etc/passwd',
      'ftp://x.com/a',
      '//evil.com/x',
      'example.com/a.jpg',
      'https://',
      'https://a b.com',
      `https://x.com/${'a'.repeat(2100)}`,
    ])
      expect(isHttpUrl(bad)).toBe(false);
  });
});

describe('parseRow', () => {
  const ok = {
    title: 'Giải tích 1',
    authors: 'Nguyễn A; Trần B ; nguyễn a',
    category: 'Toán học',
    isbn: '978-0-306-40615-7',
    publisher: 'NXB GD',
    publishedYear: '2020',
    price: '95.000',
    description: 'Mô tả',
    coverUrl: 'https://x.vn/a.jpg',
    copies: '3',
    shelfLocation: 'Kệ B1',
  };

  it('dòng hợp lệ: chuẩn hoá ISBN, tách và bỏ trùng tác giả, đổi số', () => {
    const r = parseRow(2, ok);
    expect(r.errors).toEqual([]);
    expect(r.data).toEqual({
      title: 'Giải tích 1',
      authors: ['Nguyễn A', 'Trần B'],
      category: 'Toán học',
      isbn: '9780306406157',
      publisher: 'NXB GD',
      publishedYear: 2020,
      price: 95000,
      description: 'Mô tả',
      coverUrl: 'https://x.vn/a.jpg',
      copies: 3,
      shelfLocation: 'Kệ B1',
    });
  });

  it('thiếu tiêu đề là lỗi', () => {
    expect(codes(parseRow(2, { ...ok, title: undefined }))).toContain(
      'TITLE_REQUIRED',
    );
  });

  it.each([
    ['1234', 'ISBN_LENGTH'],
    ['97803064061AB', 'ISBN_CHARS'],
    ['9780306406158', 'ISBN_CHECKSUM'],
  ])('ISBN %s → %s', (isbn, code) => {
    const r = parseRow(2, { ...ok, isbn });
    expect(codes(r)).toEqual([code]);
    expect(r.data).toBeNull();
  });

  it('ISBN-10 chữ X cuối viết thường vẫn hợp lệ', () => {
    expect(parseRow(2, { ...ok, isbn: '0-8044-2957-x' }).data?.isbn).toBe(
      '080442957X',
    );
  });

  it.each([
    ['publishedYear', '999', 'YEAR_RANGE'],
    ['publishedYear', '2101', 'YEAR_RANGE'],
    ['publishedYear', 'hai nghìn', 'YEAR_RANGE'],
    ['price', '-1', 'PRICE_INVALID'],
    ['price', '12.5', 'PRICE_INVALID'],
    ['price', '100000001', 'PRICE_RANGE'],
    ['copies', '51', 'COPIES_RANGE'],
    ['copies', '-1', 'COPIES_RANGE'],
    ['copies', '1.5', 'COPIES_RANGE'],
    ['coverUrl', 'javascript:alert(1)', 'COVER_URL_INVALID'],
    ['coverUrl', 'ftp://x/y.jpg', 'COVER_URL_INVALID'],
  ])('%s=%s → %s', (field, value, code) => {
    expect(codes(parseRow(2, { ...ok, [field]: value }))).toEqual([code]);
  });

  it('biên hợp lệ: năm 1000 / 2100, giá 0 / 100.000.000, copies 0 / 50', () => {
    const r = parseRow(2, {
      ...ok,
      publishedYear: '1000',
      price: '0',
      copies: '0',
    });
    expect(r.errors).toEqual([]);
    expect(r.data).toMatchObject({ publishedYear: 1000, price: 0, copies: 0 });
    const r2 = parseRow(2, {
      ...ok,
      publishedYear: '2100',
      price: '100000000',
      copies: '50',
    });
    expect(r2.errors).toEqual([]);
  });

  it('quá dài → lỗi, không cắt âm thầm', () => {
    expect(codes(parseRow(2, { ...ok, title: 'x'.repeat(301) }))).toContain(
      'TOO_LONG',
    );
    expect(codes(parseRow(2, { ...ok, publisher: 'x'.repeat(201) }))).toContain(
      'TOO_LONG',
    );
    expect(
      codes(parseRow(2, { ...ok, shelfLocation: 'x'.repeat(51) })),
    ).toContain('TOO_LONG');
    expect(
      codes(parseRow(2, { ...ok, description: 'x'.repeat(5001) })),
    ).toContain('TOO_LONG');
    expect(codes(parseRow(2, { ...ok, authors: 'y'.repeat(201) }))).toContain(
      'AUTHOR_TOO_LONG',
    );
  });

  it('thiếu tác giả / thể loại / giá / ISBN → cảnh báo chứ không lỗi', () => {
    const r = parseRow(2, { title: 'Chỉ có tiêu đề' });
    expect(r.errors).toEqual([]);
    expect(wcodes(r).sort()).toEqual(
      [
        'AUTHORS_MISSING',
        'CATEGORY_MISSING',
        'ISBN_MISSING',
        'PRICE_MISSING',
      ].sort(),
    );
    expect(r.data).toMatchObject({
      authors: [],
      category: null,
      isbn: null,
      price: null,
      copies: null,
    });
  });

  it('thể loại toàn ký hiệu → lỗi (không sinh được slug)', () => {
    expect(codes(parseRow(2, { ...ok, category: '###' }))).toEqual([
      'CATEGORY_INVALID',
    ]);
  });

  it('chuẩn hoá Unicode NFC và bỏ ký tự điều khiển', () => {
    const decomposed = 'Tiếng Việt'.normalize('NFD');
    const r = parseRow(2, { ...ok, title: `  ${decomposed}\u0000\u0007  ` });
    expect(r.data?.title).toBe('Tiếng Việt'.normalize('NFC'));
    expect(r.data?.title).toBe('Tiếng Việt');
  });

  it('tiêu đề giống công thức: cảnh báo, lưu nguyên như văn bản (không chạy công thức)', () => {
    const r = parseRow(2, { ...ok, title: '=HYPERLINK("http://evil","x")' });
    expect(r.errors).toEqual([]);
    expect(wcodes(r)).toContain('FORMULA_LIKE');
    expect(r.data?.title).toBe('=HYPERLINK("http://evil","x")');
  });
});

describe('readImportTable', () => {
  const header = [...IMPORT_COLUMNS];

  it('đọc CSV, nhận alias tiêu đề tiếng Việt và báo cột lạ', () => {
    const t = readImportTable(
      csv(
        ['Tiêu đề', 'Tác giả', 'ISBN', 'Cột lạ'],
        ['A', 'B', '9780306406157', 'z'],
      ),
      'sach.csv',
    );
    expect(t.fileType).toBe('csv');
    expect(t.unknownColumns).toEqual(['Cột lạ']);
    expect(t.rows).toEqual([
      { row: 2, raw: { title: 'A', authors: 'B', isbn: '9780306406157' } },
    ]);
  });

  it('bỏ dòng trống nhưng giữ số dòng gốc; ô trống không có trong raw', () => {
    const t = readImportTable(
      Buffer.from('title,isbn\n\nA,\n\nB,9780306406157\n'),
      'a.csv',
    );
    expect(t.rows.map((r) => r.row)).toEqual([3, 5]);
    expect(t.rows[0].raw).toEqual({ title: 'A' });
  });

  it('file mẫu CSV và xlsx tự đọc lại được và dòng ví dụ hợp lệ', async () => {
    const fromCsv = readImportTable(
      Buffer.from(importTemplateCsv()),
      'mau.csv',
    );
    const fromXlsx = readImportTable(await importTemplateXlsx(), 'mau.xlsx');
    expect(fromCsv.rows).toHaveLength(1);
    expect(fromXlsx.rows).toHaveLength(1);
    expect(fromXlsx.rows[0].raw).toEqual(fromCsv.rows[0].raw);
    const parsed = parseRow(2, fromCsv.rows[0].raw);
    expect(parsed.errors).toEqual([]);
    expect(parsed.data?.isbn).toBe('9780306406157');
  });

  it('CSV dấu chấm phẩy của Excel tiếng Việt, và UTF-8 có BOM', () => {
    const t = readImportTable(
      Buffer.from('﻿title;price\nSách A;95000\n'),
      'a.csv',
    );
    expect(t.rows[0].raw).toEqual({ title: 'Sách A', price: '95000' });
  });

  it('thiếu cột title → IMPORT_MISSING_COLUMN', () => {
    expect(() => readImportTable(csv(['authors'], ['x']), 'a.csv')).toThrow(
      expect.objectContaining({ code: 'IMPORT_MISSING_COLUMN' }),
    );
  });

  it('file rỗng hoặc chỉ có tiêu đề không dữ liệu', () => {
    expect(() => readImportTable(Buffer.from(''), 'a.csv')).toThrow(
      expect.objectContaining({ code: 'IMPORT_EMPTY' }),
    );
    expect(readImportTable(csv(header), 'a.csv').rows).toEqual([]);
  });

  it(`vượt ${IMPORT_MAX_ROWS} dòng dữ liệu → IMPORT_TOO_MANY_ROWS`, () => {
    const rows = [
      ['title'],
      ...Array.from({ length: IMPORT_MAX_ROWS + 1 }, (_, i) => [`s${i}`]),
    ];
    expect(() => readImportTable(csv(...rows), 'a.csv')).toThrow(
      expect.objectContaining({ code: 'IMPORT_TOO_MANY_ROWS' }),
    );
  });

  it('đúng IMPORT_MAX_ROWS dòng vẫn nhận', () => {
    const rows = [
      ['title'],
      ...Array.from({ length: IMPORT_MAX_ROWS }, (_, i) => [`s${i}`]),
    ];
    expect(readImportTable(csv(...rows), 'a.csv').rows).toHaveLength(
      IMPORT_MAX_ROWS,
    );
  });

  it('CSV hỏng (ngoặc kép không đóng) → IMPORT_MALFORMED kèm số dòng', () => {
    expect(() =>
      readImportTable(Buffer.from('title,authors\n"A,B\nC,D'), 'a.csv'),
    ).toThrow(
      expect.objectContaining({
        code: 'IMPORT_MALFORMED',
        message: expect.stringContaining('dòng'),
      }),
    );
  });

  it('CSV không phải UTF-8 (Windows-1258) → IMPORT_ENCODING', () => {
    expect(() =>
      readImportTable(
        Buffer.concat([
          Buffer.from('title\n'),
          Buffer.from([0x53, 0xe1, 0x63, 0x68, 0xff]),
        ]),
        'a.csv',
      ),
    ).toThrow(expect.objectContaining({ code: 'IMPORT_ENCODING' }));
  });

  it('UTF-16 có BOM (Excel "Unicode Text") đọc được', () => {
    const body = Buffer.concat([
      Buffer.from([0xff, 0xfe]),
      Buffer.from('title\tisbn\nSách\t9780306406157\n', 'utf16le'),
    ]);
    expect(readImportTable(body, 'a.txt').rows[0].raw).toEqual({
      title: 'Sách',
      isbn: '9780306406157',
    });
  });

  describe('từ chối file sai loại bằng nội dung, không chỉ đuôi', () => {
    const rejected = (
      buf: Buffer,
      name: string,
      code = 'IMPORT_FILE_TYPE_INVALID',
    ) =>
      expect(() => readImportTable(buf, name)).toThrow(
        expect.objectContaining({ code }),
      );

    it('PDF / exe / ảnh / gzip đổi tên thành .csv', () => {
      rejected(Buffer.from('%PDF-1.7 ...'), 'sach.csv');
      rejected(Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03]), 'sach.csv');
      rejected(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]), 'sach.csv');
      rejected(Buffer.from([0xff, 0xd8, 0xff, 0xe0]), 'sach.xlsx');
      rejected(Buffer.from([0x1f, 0x8b, 0x08, 0x00]), 'sach.csv');
    });
    it('.xls cũ (OLE2) và đuôi .xls / .xlsm / .pdf / .exe', () => {
      rejected(
        Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
        'sach.xlsx',
      );
      rejected(csv(['title'], ['x']), 'sach.xls');
      rejected(csv(['title'], ['x']), 'sach.xlsm');
      rejected(csv(['title'], ['x']), 'sach.pdf');
      rejected(csv(['title'], ['x']), 'sach.exe');
    });
    it('nhị phân có NUL đội lốt .csv', () => {
      rejected(
        Buffer.from([0x74, 0x69, 0x74, 0x6c, 0x65, 0x00, 0x01, 0x02]),
        'a.csv',
      );
    });
    it('đuôi .xlsx mà nội dung là văn bản; đuôi .csv mà nội dung là zip', async () => {
      rejected(csv(['title'], ['x']), 'a.xlsx');
      rejected(Buffer.from(await importTemplateXlsx()), 'a.csv');
    });
    it('zip không phải xlsx (docx) và xlsx có macro', () => {
      rejected(
        Buffer.from(
          zipSync({
            '[Content_Types].xml': strToU8('<Types/>'),
            'word/document.xml': strToU8('<d/>'),
          }),
        ),
        'a.xlsx',
      );
      const macro = Buffer.from(
        zipSync({
          '[Content_Types].xml': strToU8('<Types/>'),
          'xl/workbook.xml': strToU8('<workbook/>'),
          'xl/vbaProject.bin': new Uint8Array([1]),
        }),
      );
      rejected(macro, 'a.xlsx', 'IMPORT_MACRO_NOT_ALLOWED');
    });
    it('zip bomb → 413 IMPORT_FILE_TOO_LARGE dù file nén nhỏ', () => {
      const bomb = Buffer.from(
        zipSync({
          '[Content_Types].xml': strToU8('<Types/>'),
          'xl/workbook.xml': strToU8(
            '<workbook xmlns:r="x"><sheets><sheet name="S" r:id="rId1"/></sheets></workbook>',
          ),
          'xl/_rels/workbook.xml.rels': strToU8(
            '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>',
          ),
          'xl/worksheets/sheet1.xml': new Uint8Array(30 * 1024 * 1024).fill(
            0x20,
          ),
        }),
      );
      expect(bomb.length).toBeLessThan(500 * 1024);
      expect(() => readImportTable(bomb, 'a.xlsx')).toThrow(
        expect.objectContaining({ code: 'IMPORT_FILE_TOO_LARGE' }),
      );
    });
  });

  it('xlsx có công thức: chỉ lấy giá trị đã tính, kèm ghi chú', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Sách');
    ws.addRow(['title', 'price']);
    ws.addRow(['Sách A', { formula: '1+1', result: 2 }]);
    const t = readImportTable(
      Buffer.from(await wb.xlsx.writeBuffer()),
      'a.xlsx',
    );
    expect(t.rows[0].raw).toEqual({ title: 'Sách A', price: '2' });
    expect(t.notes.join(' ')).toContain('công thức');
  });

  it('normalizeHeader bỏ dấu và ký tự phân cách', () => {
    expect(normalizeHeader('Năm xuất bản')).toBe('namxuatban');
    expect(normalizeHeader('published_Year')).toBe('publishedyear');
    expect(normalizeHeader('Đường dẫn')).toBe('duongdan');
  });
});
