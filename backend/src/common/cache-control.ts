/**
 * Cache-Control cho dữ liệu danh mục công khai (không phụ thuộc người dùng).
 * max-age=0 giữ trình duyệt luôn hỏi lại (số bản còn đổi ngay khi có người mượn / trả),
 * còn CDN / proxy (Vercel rewrite → Render) được giữ ngắn hạn để giảm tải cho backend.
 */
export const CATALOG_CACHE =
  'public, max-age=0, s-maxage=30, stale-while-revalidate=60';
/** Dữ liệu ít đổi (thể loại, chính sách mượn). */
export const STATIC_CACHE =
  'public, max-age=60, s-maxage=300, stale-while-revalidate=600';
