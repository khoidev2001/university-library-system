import "./public.css";

/** Hình minh hoạ cho trạng thái không có kết quả: cuốn sách mở và kính lúp, nét vẽ hiện dần. */
export function EmptyArt({ className = "" }: { className?: string }) {
  const stroke = { "--len": 100 } as React.CSSProperties;
  return (
    <svg viewBox="0 0 200 140" fill="none" className={className} aria-hidden="true">
      <ellipse cx="100" cy="124" rx="70" ry="8" className="fill-paper-2" />
      <path
        d="M100 40c-14-9-36-11-56-6v70c20-5 42-3 56 6 14-9 36-11 56-6V34c-20-5-42-3-56 6Z"
        className="fill-white stroke-primary anim-draw"
        strokeWidth="3"
        strokeLinejoin="round"
        pathLength={100}
        style={stroke}
      />
      <path d="M100 40v70" className="stroke-primary/40 anim-draw" strokeWidth="2.5" pathLength={100} style={stroke} />
      <path
        d="M56 56c10-2 24-1 34 3M56 70c10-2 24-1 34 3"
        className="stroke-line anim-draw"
        strokeWidth="3"
        strokeLinecap="round"
        pathLength={100}
        style={stroke}
      />
      <g className="anim-float">
        <circle cx="142" cy="46" r="18" className="fill-white/80 stroke-mint" strokeWidth="4" />
        <path d="m155 59 14 14" className="stroke-mint" strokeWidth="5" strokeLinecap="round" />
        <path d="M135 46h14" className="stroke-mint/60" strokeWidth="3" strokeLinecap="round" />
      </g>
    </svg>
  );
}
