/** Dấu tích vẽ nét khi hiện ra (kiểu Magic UI): vòng tròn bật lên rồi nét tích được vẽ. Trang trí, ẩn khỏi trình đọc màn hình. */
export function SuccessMark({ tone = "good", size = 56 }: { tone?: "good" | "warn"; size?: number }) {
  const color = tone === "good" ? "text-leaf bg-leaf-soft" : "text-amber bg-amber-soft";
  return (
    <span
      aria-hidden="true"
      className={`anim-pop grid shrink-0 place-items-center rounded-full ${color}`}
      style={{ width: size, height: size }}
    >
      <svg
        width={size * 0.5}
        height={size * 0.5}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {tone === "good" ? (
          <path d="M5 12.5l4.5 4.5L19 7.5" className="anim-draw" style={{ ["--len" as string]: 24 }} />
        ) : (
          <>
            <path d="M12 6.5v7" className="anim-draw" style={{ ["--len" as string]: 8 }} />
            <path d="M12 17.5h.01" />
          </>
        )}
      </svg>
    </span>
  );
}
