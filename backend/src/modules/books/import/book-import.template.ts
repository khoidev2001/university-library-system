import * as ExcelJS from 'exceljs';
import { CSV_BOM, csvLine } from '../../../common/csv/csv-writer';
import {
  IMPORT_COLUMNS,
  IMPORT_MAX_COPIES,
  IMPORT_MAX_FILE_BYTES,
  IMPORT_MAX_ROWS,
  ImportColumn,
} from './book-import.types';

const EXAMPLE: Record<ImportColumn, string | number> = {
  title: 'Lập trình hướng đối tượng với Java',
  authors: 'Nguyễn Văn A; Trần Thị B',
  category: 'Công nghệ thông tin',
  isbn: '9780306406157',
  publisher: 'NXB Giáo dục Việt Nam',
  publishedYear: 2023,
  price: 95000,
  description: 'Giáo trình dùng cho học phần Lập trình hướng đối tượng.',
  coverUrl: 'https://example.com/bia-sach.jpg',
  copies: 3,
  shelfLocation: 'Kệ A2-03',
};

const GUIDE: Record<ImportColumn, [required: string, note: string]> = {
  title: ['Bắt buộc', 'Tiêu đề sách, tối đa 300 ký tự.'],
  authors: [
    'Nên có',
    'Nhiều tác giả cách nhau bằng dấu chấm phẩy (;). Trống = "Khuyết danh".',
  ],
  category: [
    'Nên có',
    'Tên thể loại. Chưa có thì được tạo mới. Trống = "Chưa phân loại".',
  ],
  isbn: [
    'Nên có',
    'ISBN-10 hoặc ISBN-13, có hoặc không có gạch ngang, kiểm chữ số kiểm. Dùng để phát hiện sách trùng khi nhập lại.',
  ],
  publisher: ['Không', 'Nhà xuất bản, tối đa 200 ký tự.'],
  publishedYear: ['Không', 'Năm xuất bản, từ 1000 đến 2100.'],
  price: [
    'Nên có',
    'Giá bìa bằng đồng, số nguyên (120000). Dùng tính phạt khi mất sách. Trống = 50.000đ.',
  ],
  description: ['Không', 'Mô tả ngắn, tối đa 5000 ký tự.'],
  coverUrl: ['Không', 'Địa chỉ ảnh bìa, chỉ chấp nhận http:// hoặc https://.'],
  copies: [
    'Không',
    `Số bản sao, từ 0 đến ${IMPORT_MAX_COPIES}. Trống = 1 với sách mới. Với sách đã có, là số bản sao tối thiểu cần có (chỉ bổ sung, không bao giờ xoá).`,
  ],
  shelfLocation: [
    'Không',
    'Vị trí kệ gán cho các bản sao mới, ví dụ "Kệ A2-03".',
  ],
};

export function importTemplateCsv(): string {
  return (
    CSV_BOM +
    csvLine(IMPORT_COLUMNS) +
    csvLine(IMPORT_COLUMNS.map((c) => EXAMPLE[c]))
  );
}

export async function importTemplateXlsx(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'ULS';
  const ws = wb.addWorksheet('Sách', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  ws.columns = IMPORT_COLUMNS.map((key) => ({
    header: key,
    key,
    width:
      key === 'title' || key === 'description'
        ? 44
        : key === 'authors' || key === 'category'
          ? 28
          : 18,
    // ISBN và vị trí kệ là văn bản: Excel không được biến 9780306406157 thành 9,78031E+12
    style: key === 'isbn' || key === 'shelfLocation' ? { numFmt: '@' } : {},
  }));
  const header = ws.getRow(1);
  header.font = { bold: true };
  header.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF1ECE1' },
  };
  ws.addRow(IMPORT_COLUMNS.map((c) => EXAMPLE[c]));

  const guide = wb.addWorksheet('Hướng dẫn');
  guide.columns = [
    { header: 'Cột', width: 18 },
    { header: 'Mức độ', width: 12 },
    { header: 'Ghi chú', width: 100 },
  ];
  guide.getRow(1).font = { bold: true };
  for (const c of IMPORT_COLUMNS) guide.addRow([c, GUIDE[c][0], GUIDE[c][1]]);
  guide.addRow([]);
  guide.addRow([
    'Giới hạn',
    '',
    `Tối đa ${IMPORT_MAX_ROWS} dòng, ${IMPORT_MAX_FILE_BYTES / 1024 / 1024} MB mỗi file. Chỉ đọc sheet đầu tiên ("Sách"). Xoá dòng ví dụ trước khi nhập.`,
  ]);
  return Buffer.from(await wb.xlsx.writeBuffer());
}
