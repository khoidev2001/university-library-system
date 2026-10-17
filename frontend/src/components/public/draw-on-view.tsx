"use client";

import { useEffect, useRef, useState } from "react";
import "./public.css";

/** Bọc các nét SVG dùng `.anim-draw`: chỉ bắt đầu vẽ khi khối cuộn vào màn hình. */
export function DrawOnView({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold: 0.25 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className={`draw-wait ${seen ? "is-in" : ""} ${className}`}>
      {children}
    </div>
  );
}
