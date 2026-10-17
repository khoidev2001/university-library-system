"use client";

import { useRef } from "react";

/**
 * Thẻ có quầng sáng đi theo con trỏ (kiểu Spotlight của Aceternity / Magic UI).
 * Quầng sáng là một phần tử riêng, di chuyển bằng transform và hiện bằng opacity nên không ép bố cục lại.
 * Chỉ phản ứng với chuột; trên cảm ứng thẻ đứng yên.
 */
export function SpotlightCard({
  children,
  className = "",
  glow = "rgb(79 70 229 / 0.16)",
}: {
  children: React.ReactNode;
  className?: string;
  glow?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const light = useRef<HTMLDivElement>(null);
  const frame = useRef(0);

  return (
    <div
      ref={box}
      onPointerMove={(event) => {
        if (event.pointerType !== "mouse") return;
        const { clientX, clientY } = event;
        cancelAnimationFrame(frame.current);
        frame.current = requestAnimationFrame(() => {
          const rect = box.current?.getBoundingClientRect();
          const el = light.current;
          if (!rect || !el) return;
          el.style.transform = `translate3d(${clientX - rect.left - 160}px, ${clientY - rect.top - 160}px, 0)`;
          el.style.opacity = "1";
        });
      }}
      onPointerLeave={() => {
        cancelAnimationFrame(frame.current);
        if (light.current) light.current.style.opacity = "0";
      }}
      className={`relative overflow-hidden ${className}`}
    >
      <div
        ref={light}
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-0 h-80 w-80 rounded-full opacity-0 transition-opacity duration-300"
        style={{ background: `radial-gradient(closest-side, ${glow}, transparent)`, willChange: "transform, opacity" }}
      />
      <div className="relative h-full">{children}</div>
    </div>
  );
}
