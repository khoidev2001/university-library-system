import { asciiFilename, contentDisposition } from './content-disposition';

describe('contentDisposition', () => {
  it('tên tiếng Việt: bản ASCII bỏ dấu, filename* giữ nguyên UTF-8', () => {
    const h = contentDisposition('Phiếu mượn quá hạn 20261015-1415.csv');
    expect(h).toContain('attachment;');
    expect(h).toContain('filename="Phieu_muon_qua_han_20261015-1415.csv"');
    expect(h).toContain("filename*=UTF-8''Phi%E1%BA%BFu%20m%C6%B0%E1%BB%A3n");
    // Header chỉ chứa ASCII in được
    expect(h).toMatch(/^[\x20-\x7e]+$/);
  });

  it('chữ đ / Đ được đổi đúng thay vì bị bỏ', () => {
    expect(asciiFilename('Đã đọc.csv')).toBe('Da_doc.csv');
  });

  it('chặn chèn header qua xuống dòng, ngoặc kép, đường dẫn', () => {
    const h = contentDisposition('a"\r\nSet-Cookie: x=1/../b.csv');
    expect(h).not.toMatch(/[\r\n]/);
    expect(h.match(/"/g)).toHaveLength(2); // chỉ cặp ngoặc bao filename
    expect(h).not.toContain('/');
  });

  it('dấu nháy đơn và ngoặc trong filename* được mã hoá theo RFC 5987', () => {
    expect(contentDisposition("it's (x).csv")).toContain(
      'it%27s%20%28x%29.csv',
    );
  });

  it('tên rỗng / toàn ký tự cấm → "download"', () => {
    expect(contentDisposition('???')).toContain('filename="download"');
    expect(asciiFilename('')).toBe('download');
  });
});
