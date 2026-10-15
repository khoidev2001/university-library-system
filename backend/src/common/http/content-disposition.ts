/**
 * Header Content-Disposition cho file tải về, đúng RFC 6266 / 5987:
 * `filename` là bản ASCII an toàn (cho trình duyệt cũ), `filename*` là tên UTF-8 đầy đủ có dấu.
 * Chặn chèn header: ký tự điều khiển, dấu ngoặc kép và dấu gạch chéo bị loại khỏi tên.
 */
export function asciiFilename(name: string): string {
  const ascii = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^A-Za-z0-9._-]+/g, '_')
    .replace(/^[_.]+|_+$/g, '');
  return ascii || 'download';
}

function sanitizeDisplayName(name: string): string {
  // eslint-disable-next-line no-control-regex
  return (
    name
      .replace(/[\u0000-\u001F\u007F"\/:*?<>|]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim() || 'download'
  );
}

/** encodeURIComponent chừa lại !'()* — RFC 5987 bắt buộc mã hoá cả các ký tự này. */
function encodeRfc5987(value: string): string {
  return encodeURIComponent(value).replace(
    /['()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

export function contentDisposition(filename: string): string {
  const display = sanitizeDisplayName(filename);
  return `attachment; filename="${asciiFilename(display)}"; filename*=UTF-8''${encodeRfc5987(display)}`;
}
