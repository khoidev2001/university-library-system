"use client";

import { useRef } from "react";

/**
 * Bìa sách nghiêng nhẹ theo con trỏ (kiểu tilt card), kèm vệt sáng lướt qua mặt bìa.
 * Chỉ dùng transform và opacity; chỉ phản ứng với chuột và tự đứng yên khi người dùng chọn giảm chuyển động.
 */
export function TiltCover({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const sheen = useRef<HTMLDivElement>(null);
  const frame = useRef(0);

  const reset = () => {
    cancelAnimationFrame(frame.current);
    if (card.current) card.current.style.transform = "";
    if (sheen.current) sheen.current.style.opacity = "0";
  };

  return (
    <div
      ref={box}
      className={className}
      style={{ perspective: "900px" }}
      onPointerMove={(event) => {
        if (event.pointerType !== "mouse" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        const { clientX, clientY } = event;
        cancelAnimationFrame(frame.current);
        frame.current = requestAnimationFrame(() => {
          const rect = box.current?.getBoundingClientRect();
          if (!rect || !card.current) return;
          const x = (clientX - rect.left) / rect.width - 0.5;
          const y = (clientY - rect.top) / rect.height - 0.5;
          card.current.style.transform = `rotateY(${(x * 14).toFixed(2)}deg) rotateX(${(-y * 14).toFixed(2)}deg) scale3d(1.02, 1.02, 1.02)`;
          if (sheen.current) {
            sheen.current.style.opacity = "1";
            sheen.current.style.transform = `translate3d(${(x * 60).toFixed(1)}%, 0, 0)`;
          }
        });
      }}
      onPointerLeave={reset}
    >
      <div
        ref={card}
        className="relative transition-transform duration-200 ease-out will-change-transform"
        style={{ transformStyle: "preserve-3d" }}
      >
        {children}
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl" aria-hidden="true">
          <div
            ref={sheen}
            className="absolute inset-y-0 -left-1/2 w-full bg-gradient-to-r from-transparent via-white/30 to-transparent opacity-0 transition-opacity duration-200"
          />
        </div>
      </div>
    </div>
  );
}
