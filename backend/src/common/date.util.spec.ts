import {
  addDays,
  isOverdue,
  overdueCutoff,
  rangeEnd,
  rangeStart,
  overdueDays,
} from './date.util';

// Giờ thư viện mặc định UTC+7: 2026-10-05T09:00Z = 16:00 ngày 05/10 giờ Việt Nam.
const NOW = new Date('2026-10-05T09:00:00.000Z');

describe('overdueDays (BR-07, đếm theo ngày lịch)', () => {
  it('là 0 khi chưa tới hạn', () => {
    expect(overdueDays(new Date('2026-10-06T09:00:00.000Z'), NOW)).toBe(0);
  });

  it('là 0 khi trả trong chính ngày hết hạn, kể cả trễ vài giờ', () => {
    expect(overdueDays(NOW, NOW)).toBe(0);
    expect(overdueDays(new Date('2026-10-05T00:00:00.000Z'), NOW)).toBe(0); // 07:00 sáng cùng ngày
    expect(overdueDays(new Date('2026-10-04T17:00:00.000Z'), NOW)).toBe(0); // 00:00 cùng ngày (giờ VN)
  });

  it('cộng một ngày cho mỗi ngày lịch trôi qua', () => {
    expect(overdueDays(new Date('2026-10-04T16:59:00.000Z'), NOW)).toBe(1); // 23:59 hôm trước
    expect(overdueDays(new Date('2026-10-04T09:00:00.000Z'), NOW)).toBe(1);
    expect(overdueDays(new Date('2026-10-02T09:00:00.000Z'), NOW)).toBe(3);
  });

  it('đổi theo múi giờ được truyền vào', () => {
    // Cùng mốc, nhưng ở UTC thì 2026-10-04T20:00Z là ngày hôm qua → 1 ngày trễ
    expect(overdueDays(new Date('2026-10-04T20:00:00.000Z'), NOW, 0)).toBe(1);
    // còn ở giờ VN thì vẫn là 03:00 sáng cùng ngày 05/10 → chưa trễ
    expect(overdueDays(new Date('2026-10-04T20:00:00.000Z'), NOW, 420)).toBe(0);
  });
});

describe('isOverdue', () => {
  it('chỉ đúng với phiếu chưa trả và đã sang ngày sau hạn', () => {
    expect(
      isOverdue(
        { dueAt: new Date('2026-10-04T09:00:00.000Z'), returnedAt: null },
        NOW,
      ),
    ).toBe(true);
    expect(
      isOverdue(
        { dueAt: new Date('2026-10-05T00:00:00.000Z'), returnedAt: null },
        NOW,
      ),
    ).toBe(false);
    expect(
      isOverdue(
        { dueAt: new Date('2026-10-06T09:00:00.000Z'), returnedAt: null },
        NOW,
      ),
    ).toBe(false);
  });

  it('phiếu đã trả thì không bao giờ quá hạn', () => {
    expect(
      isOverdue(
        {
          dueAt: new Date('2026-10-01T09:00:00.000Z'),
          returnedAt: new Date('2026-10-04T09:00:00.000Z'),
        },
        NOW,
      ),
    ).toBe(false);
  });
});

describe('overdueCutoff', () => {
  it('là nửa đêm đầu ngày hôm nay theo giờ thư viện', () => {
    expect(overdueCutoff(NOW)).toEqual(new Date('2026-10-04T17:00:00.000Z')); // 00:00 ngày 05/10 giờ VN
  });

  it('khớp với overdueDays: phiếu lọt bộ lọc cũng là phiếu có ngày trễ > 0', () => {
    const cutoff = overdueCutoff(NOW);
    const sameDay = new Date('2026-10-05T02:00:00.000Z');
    const dayBefore = new Date('2026-10-04T10:00:00.000Z');
    expect(sameDay < cutoff).toBe(overdueDays(sameDay, NOW) > 0);
    expect(dayBefore < cutoff).toBe(overdueDays(dayBefore, NOW) > 0);
  });
});

describe('addDays', () => {
  it('cộng đúng số ngày và giữ nguyên giờ', () => {
    expect(addDays(NOW, 14)).toEqual(new Date('2026-10-19T09:00:00.000Z'));
    expect(addDays(NOW, 0)).toEqual(NOW);
  });
});

describe('rangeStart / rangeEnd (lọc báo cáo theo ngày giờ thư viện)', () => {
  it('ngày dạng YYYY-MM-DD bắt đầu lúc 00:00 giờ VN và kết thúc (loại trừ) lúc 00:00 ngày kế tiếp', () => {
    expect(rangeStart('2026-01-01')).toEqual(
      new Date('2025-12-31T17:00:00.000Z'),
    );
    expect(rangeEnd('2026-12-31')).toEqual(
      new Date('2026-12-31T17:00:00.000Z'),
    );
    // to = from = một ngày: khoảng [00:00, 24:00) của đúng ngày đó
    expect(
      rangeEnd('2026-03-15').getTime() - rangeStart('2026-03-15').getTime(),
    ).toBe(24 * 60 * 60 * 1000);
  });

  it('chuỗi có giờ dùng nguyên; đầu mút cuối cộng 1ms để phiếu đúng thời điểm đó vẫn được tính', () => {
    expect(rangeStart('2026-03-15T10:00:00Z')).toEqual(
      new Date('2026-03-15T10:00:00Z'),
    );
    expect(rangeEnd('2026-03-15T10:00:00Z')).toEqual(
      new Date('2026-03-15T10:00:00.001Z'),
    );
  });

  it('ngày không có thật cho Invalid Date thay vì tự trôi sang tháng sau', () => {
    expect(isNaN(rangeStart('2026-02-31').getTime())).toBe(true);
    expect(isNaN(rangeEnd('2026-13-01').getTime())).toBe(true);
  });
});
