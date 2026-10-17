import "./public.css";

const BOOKS = [
  { x: 14, w: 30, h: 96, tone: "text-primary" },
  { x: 48, w: 24, h: 120, tone: "text-mint" },
  { x: 76, w: 34, h: 84, tone: "text-primary" },
  { x: 114, w: 26, h: 108, tone: "text-ink-faint" },
  { x: 144, w: 32, h: 128, tone: "text-primary" },
  { x: 180, w: 24, h: 92, tone: "text-mint" },
  { x: 208, w: 30, h: 112, tone: "text-ink-faint" },
];

/** Giá sách vẽ bằng nét, từng cuốn hiện dần (dùng `.anim-draw`). Bọc trong DrawOnView để chỉ vẽ khi cuộn tới. */
export function ShelfArt({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 252 150" fill="none" className={className} aria-hidden="true">
      {BOOKS.map((book, i) => (
        <g key={book.x} className={book.tone}>
          <rect
            x={book.x}
            y={136 - book.h}
            width={book.w}
            height={book.h}
            rx="5"
            stroke="currentColor"
            strokeWidth="2.5"
            pathLength={100}
            className="anim-draw"
            style={{ "--len": 100, animationDelay: `${0.15 + i * 0.12}s` } as React.CSSProperties}
          />
          <path
            d={`M${book.x + 6} ${136 - book.h + 16}h${book.w - 12}`}
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            pathLength={100}
            className="anim-draw"
            style={{ "--len": 100, animationDelay: `${0.5 + i * 0.12}s` } as React.CSSProperties}
          />
        </g>
      ))}
      <path
        d="M2 140h248"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        pathLength={100}
        className="anim-draw text-ink"
        style={{ "--len": 100 } as React.CSSProperties}
      />
    </svg>
  );
}
