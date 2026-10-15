/** Bố cục tờ nhãn. Mọi số đo tính bằng mm, gốc ở góc trên trái của trang giấy. */
export interface LabelLayout {
  id: string;
  name: string;
  /** Kích thước trang giấy (A4 hoặc cuộn nhãn). */
  pageW: number;
  pageH: number;
  cols: number;
  rows: number;
  /** Kích thước một nhãn. */
  w: number;
  h: number;
  /** Lề từ mép giấy tới nhãn đầu tiên. */
  top: number;
  left: number;
  /** Khoảng cách giữa các nhãn. */
  gapX: number;
  gapY: number;
  /** Cuộn nhãn: mỗi nhãn một trang, không có lưới. */
  roll?: boolean;
}

export const LABEL_LAYOUTS: LabelLayout[] = [
  {
    id: "3x8",
    name: "3 × 8 · 24 nhãn/tờ A4 · 63,5 × 33,9 mm (cỡ Avery L7159)",
    pageW: 210,
    pageH: 297,
    cols: 3,
    rows: 8,
    w: 63.5,
    h: 33.9,
    top: 15.15,
    left: 7.2,
    gapX: 2.54,
    gapY: 0,
  },
  {
    id: "2x7",
    name: "2 × 7 · 14 nhãn/tờ A4 · 99,1 × 38,1 mm (cỡ Avery L7163)",
    pageW: 210,
    pageH: 297,
    cols: 2,
    rows: 7,
    w: 99.1,
    h: 38.1,
    top: 15.15,
    left: 4.65,
    gapX: 2.54,
    gapY: 0,
  },
  {
    id: "4x10",
    name: "4 × 10 · 40 nhãn/tờ A4 · 52,5 × 29,7 mm (nhãn nhỏ, chia đều tờ)",
    pageW: 210,
    pageH: 297,
    cols: 4,
    rows: 10,
    w: 52.5,
    h: 29.7,
    top: 0,
    left: 0,
    gapX: 0,
    gapY: 0,
  },
  {
    id: "roll",
    name: "Cuộn nhãn 50 × 25 mm · 1 nhãn/trang (máy in nhãn nhiệt)",
    pageW: 50,
    pageH: 25,
    cols: 1,
    rows: 1,
    w: 50,
    h: 25,
    top: 0,
    left: 0,
    gapX: 0,
    gapY: 0,
    roll: true,
  },
];

export interface Placement {
  sheet: number;
  /** Vị trí trên tờ (mm). */
  x: number;
  y: number;
  /** Chỉ số trong danh sách nhãn, hoặc null cho ô trống đã bỏ qua. */
  index: number | null;
}

/**
 * Xếp `count` nhãn vào các tờ, bỏ trống `skip` ô đầu (tờ đã dùng dở). Cuộn nhãn bỏ qua `skip`.
 * Trả về vị trí từng nhãn và tổng số tờ.
 */
export function placeLabels(layout: LabelLayout, count: number, skip: number): { placements: Placement[]; sheets: number } {
  const perSheet = layout.cols * layout.rows;
  const offset = layout.roll ? 0 : Math.max(0, Math.min(skip, perSheet - 1));
  const placements: Placement[] = [];
  for (let i = 0; i < count; i++) {
    const slot = i + offset;
    const sheet = Math.floor(slot / perSheet);
    const inSheet = slot % perSheet;
    placements.push({
      sheet,
      x: layout.left + (inSheet % layout.cols) * (layout.w + layout.gapX),
      y: layout.top + Math.floor(inSheet / layout.cols) * (layout.h + layout.gapY),
      index: i,
    });
  }
  const sheets = count === 0 ? 0 : Math.floor((count - 1 + offset) / perSheet) + 1;
  return { placements, sheets };
}
