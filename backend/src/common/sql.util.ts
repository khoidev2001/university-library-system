/**
 * Chuẩn hoá chuỗi tìm kiếm cho `contains` của Prisma: cắt khoảng trắng hai đầu và
 * thoát `%`, `_`, `\` (Prisma không thoát giúp nên "100%" hay "_" sẽ thành ký tự đại diện
 * và khớp mọi dòng). Trả undefined nếu chuỗi rỗng để bỏ điều kiện lọc.
 */
export function likePattern(q: string | undefined): string | undefined {
  const trimmed = q?.trim();
  if (!trimmed) return undefined;
  return trimmed.replace(/[\\%_]/g, (c) => `\\${c}`);
}
