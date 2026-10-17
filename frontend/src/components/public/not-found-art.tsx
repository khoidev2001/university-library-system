import "./public.css";

const SPINES = [
  { x: 20, w: 26, h: 96, tone: "text-primary" },
  { x: 50, w: 22, h: 112, tone: "text-mint" },
  { x: 76, w: 30, h: 88, tone: "text-primary" },
  { x: 110, w: 24, h: 104, tone: "text-ink-faint" },
  // Chừa một khoảng trống: cuốn sách bị mất
  { x: 214, w: 28, h: 100, tone: "text-mint" },
  { x: 246, w: 24, h: 116, tone: "text-primary" },
  { x: 274, w: 30, h: 92, tone: "text-ink-faint" },
];

/** Giá sách thiếu một cuốn, cuốn lạc đang lơ lửng phía trên chỗ trống. Dùng cho trang 404. */
export function NotFoundArt({ className = "" }: { className?: string }) {
  const draw = (delay: number) => ({ "--len": 100, animationDelay: `${delay}s` }) as React.CSSProperties;
  return (
    <svg viewBox="0 0 324 190" fill="none" className={className} aria-hidden="true">
      {SPINES.map((spine, i) => (
        <rect
          key={spine.x}
          x={spine.x}
          y={160 - spine.h}
          width={spine.w}
          height={spine.h}
          rx="5"
          stroke="currentColor"
          strokeWidth="3"
          className={`anim-draw ${spine.tone}`}
          pathLength={100}
          style={draw(0.1 + i * 0.1)}
        />
      ))}
      <path d="M4 164h316" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" className="anim-draw text-ink" pathLength={100} style={draw(0)} />

      <g className="anim-float" style={{ transformOrigin: "172px 70px" }}>
        <g transform="rotate(14 172 70)">
          <rect x="152" y="22" width="40" height="96" rx="6" className="fill-white stroke-primary" strokeWidth="3" />
          <path d="M162 40h20M162 52h14" className="stroke-primary/40" strokeWidth="3" strokeLinecap="round" />
          <text x="172" y="98" textAnchor="middle" className="fill-primary text-[22px] font-bold">
            ?
          </text>
        </g>
      </g>
      <path d="M150 168c6 6 16 6 22 0" className="stroke-mint" strokeWidth="3" strokeLinecap="round" opacity="0.7" />
    </svg>
  );
}
