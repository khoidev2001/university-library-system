const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Múi giờ thư viện (phút so với UTC). Mặc định +07:00 — giờ Việt Nam.
 * Phạt tính theo NGÀY LỊCH địa phương, nên mốc này quyết định ranh giới ngày.
 */
export const LIBRARY_UTC_OFFSET_MINUTES = Number(
  process.env.LIBRARY_UTC_OFFSET_MINUTES ?? 420,
);

/** Mốc nửa đêm (theo giờ thư viện) của ngày chứa `d`, quy về epoch ms. */
function startOfLibraryDay(d: Date, offsetMinutes: number): number {
  const shifted = d.getTime() + offsetMinutes * 60 * 1000;
  return Math.floor(shifted / MS_PER_DAY) * MS_PER_DAY;
}

/**
 * Số ngày quá hạn (BR-07): đếm theo ngày lịch, không theo giờ.
 * Trả trong chính ngày hết hạn → 0; sang ngày hôm sau → 1; mỗi ngày lịch tiếp theo +1.
 */
export function overdueDays(
  dueAt: Date,
  at: Date = new Date(),
  offsetMinutes: number = LIBRARY_UTC_OFFSET_MINUTES,
): number {
  const days =
    (startOfLibraryDay(at, offsetMinutes) -
      startOfLibraryDay(dueAt, offsetMinutes)) /
    MS_PER_DAY;
  return days > 0 ? days : 0;
}

/**
 * Phiếu đang quá hạn (BR-09, trạng thái dẫn xuất): chưa trả và đã sang ngày sau hạn.
 * Dùng chung mốc ngày với overdueDays để hai nơi không lệch nhau.
 */
export function isOverdue(
  loan: { dueAt: Date; returnedAt: Date | null },
  at: Date = new Date(),
  offsetMinutes: number = LIBRARY_UTC_OFFSET_MINUTES,
): boolean {
  return (
    loan.returnedAt === null && overdueDays(loan.dueAt, at, offsetMinutes) > 0
  );
}

/**
 * Mốc để lọc phiếu quá hạn bằng SQL: `dueAt < overdueCutoff(now)`.
 * Chính là nửa đêm đầu ngày hôm nay theo giờ thư viện, nên khớp đúng với overdueDays.
 */
export function overdueCutoff(
  at: Date = new Date(),
  offsetMinutes: number = LIBRARY_UTC_OFFSET_MINUTES,
): Date {
  return new Date(
    startOfLibraryDay(at, offsetMinutes) - offsetMinutes * 60 * 1000,
  );
}

export function addDays(from: Date, days: number): Date {
  return new Date(from.getTime() + days * MS_PER_DAY);
}
