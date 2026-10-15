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

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Mốc nửa đêm đầu ngày `YYYY-MM-DD` theo giờ thư viện, quy về UTC.
 * Ngày không có thật ("2026-02-31", V8 tự đổi thành 03-03) trả Invalid Date để người gọi từ chối.
 */
function libraryDayStart(dateOnly: string, offsetMinutes: number): Date {
  const utcMidnight = new Date(`${dateOnly}T00:00:00.000Z`);
  if (
    isNaN(utcMidnight.getTime()) ||
    utcMidnight.toISOString().slice(0, 10) !== dateOnly
  )
    return new Date(NaN);
  return new Date(utcMidnight.getTime() - offsetMinutes * 60_000);
}

/**
 * Đầu khoảng lọc (bao gồm): "2026-01-01" là 00:00 ngày đó theo giờ thư viện;
 * chuỗi có giờ thì dùng nguyên.
 */
export function rangeStart(
  value: string,
  offsetMinutes: number = LIBRARY_UTC_OFFSET_MINUTES,
): Date {
  return DATE_ONLY.test(value)
    ? libraryDayStart(value, offsetMinutes)
    : new Date(value);
}

/**
 * Cuối khoảng lọc (LOẠI TRỪ, dùng với `<`): "2026-12-31" bao trọn cả ngày 31
 * (đến 00:00 ngày 1/1); chuỗi có giờ thì lấy đúng thời điểm đó cộng 1ms để vẫn tính phiếu lúc đó.
 */
export function rangeEnd(
  value: string,
  offsetMinutes: number = LIBRARY_UTC_OFFSET_MINUTES,
): Date {
  return DATE_ONLY.test(value)
    ? addDays(libraryDayStart(value, offsetMinutes), 1)
    : new Date(new Date(value).getTime() + 1);
}
