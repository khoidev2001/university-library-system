import {
  CsvParseError,
  detectDelimiter,
  parseCsv,
  parseCsvRows,
} from './csv-parser';
import {
  CSV_BOM,
  csvCell,
  csvLine,
  neutralizeFormula,
  safeSpreadsheetText,
} from './csv-writer';

describe('csv-writer', () => {
  it('thoát dấu phẩy, ngoặc kép và xuống dòng theo RFC 4180', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('nói "xin chào"')).toBe('"nói ""xin chào"""');
    expect(csvCell('dòng 1\ndòng 2')).toBe('"dòng 1\ndòng 2"');
    expect(csvCell('có\r\nCRLF')).toBe('"có\r\nCRLF"');
    expect(csvCell('đơn giản')).toBe('đơn giản');
  });

  it('null, undefined → ô trống; số và boolean ghi trần', () => {
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
    expect(csvCell(0)).toBe('0');
    expect(csvCell(1725000)).toBe('1725000');
    expect(csvCell(NaN)).toBe('');
    expect(csvCell(true)).toBe('TRUE');
  });

  it.each([
    '=1+1',
    '+SUM(A1)',
    '-2+3',
    '@SUM(1)',
    '\tcmd',
    '\rcmd',
    '=HYPERLINK("http://x","y")',
  ])('vô hiệu hoá công thức: %j', (payload) => {
    const out = csvCell(payload);
    // Ô (sau khi bỏ ngoặc kép bao ngoài) phải bắt đầu bằng ' để Excel coi là văn bản
    const inner = out.startsWith('"') ? out.slice(1, -1) : out;
    expect(inner.startsWith("'")).toBe(true);
  });

  it('số âm là số thật nên KHÔNG bị thêm dấu nháy, còn chuỗi "-5" thì có', () => {
    expect(csvCell(-5)).toBe('-5');
    expect(csvCell('-5')).toBe("'-5");
  });

  it('không đụng vào văn bản bình thường chứa ký hiệu ở giữa', () => {
    expect(neutralizeFormula('a=b')).toBe('a=b');
    expect(neutralizeFormula("O'Reilly")).toBe("O'Reilly");
    expect(neutralizeFormula('Email: a@b.c')).toBe('Email: a@b.c');
  });

  it('bỏ ký tự điều khiển nhưng giữ tab / xuống dòng hợp lệ trong nội dung', () => {
    expect(safeSpreadsheetText('a\u0000b\u0007c')).toBe('abc');
    expect(csvCell('a\tb')).toBe('a\tb');
  });

  it('csvLine nối bằng dấu phẩy và kết thúc CRLF; BOM là U+FEFF', () => {
    expect(csvLine(['a', 1, null, 'b,c'])).toBe('a,1,,"b,c"\r\n');
    expect(CSV_BOM).toBe('﻿');
  });
});

describe('csv-parser', () => {
  it('đọc cơ bản, CRLF / LF / CR, có BOM', () => {
    expect(parseCsv('﻿a,b\r\n1,2\n3,4\r5,6')).toEqual([
      ['a', 'b'],
      ['1', '2'],
      ['3', '4'],
      ['5', '6'],
    ]);
  });

  it('ô có ngoặc kép chứa dấu phẩy, xuống dòng và "" thoát', () => {
    expect(parseCsv('t,d\n"A, B","dòng 1\ndòng 2 ""trích"""\n')).toEqual([
      ['t', 'd'],
      ['A, B', 'dòng 1\ndòng 2 "trích"'],
    ]);
  });

  it('khứ hồi: parse(csvLine(x)) == x, kể cả dữ liệu hiểm', () => {
    const rows = [
      ['Tiêu đề', 'Mô tả'],
      ['He said "hi", then left', 'a\r\nb'],
      ['', 'ô trống đầu'],
      ['ngoặc "', ','],
    ];
    const text = rows.map((r) => csvLine(r)).join('');
    expect(parseCsv(text)).toEqual(rows);
  });

  it('tự nhận dấu chấm phẩy (Excel tiếng Việt) và tab', () => {
    expect(parseCsv('a;b;c\n1;2;3')).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', '3'],
    ]);
    expect(parseCsv('a\tb\n1\t2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
    expect(detectDelimiter('"a;b",c,d\n')).toBe(',');
  });

  it('bỏ dòng trống nhưng giữ đúng số dòng gốc', () => {
    const rows = parseCsvRows('a,b\n\n1,2\n\n\n3,4');
    expect(rows.map((r) => r.line)).toEqual([1, 3, 6]);
  });

  it('dòng toàn dấu phân cách vẫn là một dòng (không bị nuốt)', () => {
    expect(parseCsv('a,b\n,\n1,2')).toEqual([
      ['a', 'b'],
      ['', ''],
      ['1', '2'],
    ]);
  });

  it('ngoặc kép mở mà không đóng → lỗi, có số dòng', () => {
    expect(() => parseCsv('a,b\n"chưa đóng,2\n3,4')).toThrow(CsvParseError);
    try {
      parseCsv('a,b\n"chưa đóng,2');
    } catch (e) {
      expect((e as CsvParseError).line).toBeGreaterThanOrEqual(2);
    }
  });

  it('ký tự thừa sau ngoặc kép đóng được nối vào ô (giống Excel), không văng lỗi', () => {
    expect(parseCsv('"abc"def,x')).toEqual([['abcdef', 'x']]);
  });

  it('chặn file quá nhiều dòng và ô quá dài', () => {
    const many = Array.from({ length: 11 }, (_, i) => `r${i}`).join('\n');
    expect(() => parseCsv(many, { maxRows: 10 })).toThrow(/nhiều hơn 10 dòng/);
    expect(() =>
      parseCsv(`a,${'x'.repeat(50)}`, { maxCellLength: 20 }),
    ).toThrow(/dài quá/);
  });

  it('file rỗng → không có dòng nào', () => {
    expect(parseCsv('')).toEqual([]);
    expect(parseCsv('﻿')).toEqual([]);
  });
});
