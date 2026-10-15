import * as ExcelJS from 'exceljs';
import { strToU8, zipSync } from 'fflate';
import { XlsxError, readXlsx } from './xlsx-reader';

async function makeXlsx(
  fill: (ws: ExcelJS.Worksheet, wb: ExcelJS.Workbook) => void,
): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Sách');
  fill(ws, wb);
  return new Uint8Array(await wb.xlsx.writeBuffer());
}

const MIN_PARTS = {
  '[Content_Types].xml': strToU8(
    '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>',
  ),
  'xl/workbook.xml': strToU8(
    '<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="S" sheetId="1" r:id="rId1"/></sheets></workbook>',
  ),
  'xl/_rels/workbook.xml.rels': strToU8(
    '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="x" Target="worksheets/sheet1.xml"/></Relationships>',
  ),
};

describe('readXlsx', () => {
  it('đọc chuỗi tiếng Việt, số, ô trống và dòng trống đúng vị trí', async () => {
    const buf = await makeXlsx((ws) => {
      ws.addRow(['title', 'authors', 'price', 'publishedYear']);
      ws.addRow(['Lập trình Đại số', 'Nguyễn Văn A; Trần B', 120000, 2020]);
      ws.getRow(4).values = ['Sách dòng 4', undefined, 5];
    });
    const sheet = readXlsx(buf);
    expect(sheet.sheetName).toBe('Sách');
    expect(sheet.rows[0]).toEqual([
      'title',
      'authors',
      'price',
      'publishedYear',
    ]);
    expect(sheet.rows[1]).toEqual([
      'Lập trình Đại số',
      'Nguyễn Văn A; Trần B',
      '120000',
      '2020',
    ]);
    expect(sheet.rows[2]).toEqual([]); // dòng 3 trống
    expect(sheet.rows[3]).toEqual(['Sách dòng 4', '', '5']);
    expect(sheet.hasFormulas).toBe(false);
  });

  it('chỉ lấy giá trị đã tính của công thức và báo hasFormulas, không bao giờ chạy công thức', async () => {
    const buf = await makeXlsx((ws) => {
      ws.addRow(['title']);
      ws.addRow([
        { formula: 'HYPERLINK("http://evil","x")', result: 'kết quả cache' },
      ]);
    });
    const sheet = readXlsx(buf);
    expect(sheet.hasFormulas).toBe(true);
    expect(sheet.rows[1][0]).toBe('kết quả cache');
  });

  it('số lớn dạng khoa học trở về chữ số đầy đủ (ISBN-13 trong Excel)', () => {
    const sheetXml = `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1"><v>9.78043902348E12</v></c><c r="C1" t="inlineStr"><is><t>inline</t></is></c></row></sheetData></worksheet>`;
    const buf = zipSync({
      ...MIN_PARTS,
      'xl/worksheets/sheet1.xml': strToU8(sheetXml),
    });
    expect(readXlsx(buf).rows[0]).toEqual(['9780439023480', '', 'inline']);
  });

  it('từ chối file không phải zip', () => {
    expect(() => readXlsx(strToU8('title,authors\na,b'))).toThrow(XlsxError);
    expect(() => readXlsx(strToU8('%PDF-1.4 ...'))).toThrow(/xlsx/);
  });

  it('từ chối zip khác (docx) vì thiếu workbook', () => {
    const docx = zipSync({
      '[Content_Types].xml': strToU8('<Types/>'),
      'word/document.xml': strToU8('<w:document/>'),
    });
    expect(() => readXlsx(docx)).toThrow(
      expect.objectContaining({ code: 'NOT_XLSX' }),
    );
  });

  it('từ chối file có macro (vbaProject.bin)', () => {
    const buf = zipSync({
      ...MIN_PARTS,
      'xl/worksheets/sheet1.xml': strToU8('<worksheet/>'),
      'xl/vbaProject.bin': new Uint8Array([1, 2, 3]),
    });
    expect(() => readXlsx(buf)).toThrow(
      expect.objectContaining({ code: 'MACRO_NOT_ALLOWED' }),
    );
  });

  it('từ chối xlsm khai báo macroEnabled trong content types', () => {
    const buf = zipSync({
      ...MIN_PARTS,
      '[Content_Types].xml': strToU8(
        '<Types><Override PartName="/xl/workbook.xml" ContentType="application/vnd.ms-excel.sheet.macroEnabled.main+xml"/></Types>',
      ),
      'xl/worksheets/sheet1.xml': strToU8('<worksheet/>'),
    });
    expect(() => readXlsx(buf)).toThrow(
      expect.objectContaining({ code: 'MACRO_NOT_ALLOWED' }),
    );
  });

  it('zip bomb: sheet giải nén ra vượt trần bị chặn dù file nén rất nhỏ', () => {
    // 60MB khoảng trắng nén còn ~60KB
    const bomb = zipSync({
      ...MIN_PARTS,
      'xl/worksheets/sheet1.xml': new Uint8Array(60 * 1024 * 1024).fill(0x20),
    });
    expect(bomb.length).toBeLessThan(200 * 1024);
    expect(() => readXlsx(bomb)).toThrow(
      expect.objectContaining({ code: 'TOO_LARGE_UNCOMPRESSED' }),
    );
  });

  it('zip bomb khai dối kích thước trong tiêu đề vẫn bị chặn vì đếm byte thật', () => {
    const bomb = zipSync({
      ...MIN_PARTS,
      'xl/worksheets/sheet1.xml': new Uint8Array(60 * 1024 * 1024).fill(0x20),
    });
    // Sửa uncompressedSize trong central directory thành 100
    const view = new DataView(bomb.buffer, bomb.byteOffset, bomb.byteLength);
    let p = view.getUint32(bomb.length - 22 + 16, true);
    let patched = 0;
    while (view.getUint32(p, true) === 0x02014b50) {
      view.setUint32(p + 24, 100, true);
      patched++;
      p +=
        46 +
        view.getUint16(p + 28, true) +
        view.getUint16(p + 30, true) +
        view.getUint16(p + 32, true);
    }
    expect(patched).toBeGreaterThan(0);
    expect(() => readXlsx(bomb)).toThrow(
      expect.objectContaining({ code: 'TOO_LARGE_UNCOMPRESSED' }),
    );
  });

  it('quá nhiều dòng → TOO_MANY_ROWS', () => {
    const rows = Array.from(
      { length: 50 },
      (_, i) =>
        `<row r="${i + 1}"><c r="A${i + 1}" t="inlineStr"><is><t>x</t></is></c></row>`,
    ).join('');
    const buf = zipSync({
      ...MIN_PARTS,
      'xl/worksheets/sheet1.xml': strToU8(
        `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows}</sheetData></worksheet>`,
      ),
    });
    expect(() =>
      readXlsx(buf, {
        maxEntryBytes: 1e6,
        maxTotalBytes: 1e6,
        maxEntries: 50,
        maxRows: 10,
        maxCols: 5,
        maxCellLength: 100,
      }),
    ).toThrow(expect.objectContaining({ code: 'TOO_MANY_ROWS' }));
  });

  it('XML hỏng → CORRUPT; DOCTYPE với thực thể tự định nghĩa không được nạp', () => {
    const bad = zipSync({
      ...MIN_PARTS,
      'xl/worksheets/sheet1.xml': strToU8('<worksheet><sheetData><row'),
    });
    expect(() => readXlsx(bad)).toThrow(
      expect.objectContaining({ code: 'CORRUPT' }),
    );

    const xxe = `<?xml version="1.0"?><!DOCTYPE w [<!ENTITY a "AAAA"><!ENTITY b "&a;&a;&a;&a;">]><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>&b;</t></is></c></row></sheetData></worksheet>`;
    const buf = zipSync({
      ...MIN_PARTS,
      'xl/worksheets/sheet1.xml': strToU8(xxe),
    });
    // Hoặc bị từ chối, hoặc không bung thực thể; tuyệt đối không ra "AAAAAAAAAAAAAAAA"
    try {
      expect(readXlsx(buf).rows[0]?.[0] ?? '').not.toContain('AAAA');
    } catch (e) {
      expect(e).toBeInstanceOf(XlsxError);
    }
  });
});
