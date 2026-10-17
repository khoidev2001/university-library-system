"use client";

import { Fragment, useEffect, useRef, useState } from "react";

/**
 * Bộ chuyển động dùng chung. Quy tắc để giữ 120 fps: chỉ animate transform và opacity,
 * dùng IntersectionObserver (không lắng nghe scroll), tự tắt khi người dùng chọn giảm chuyển động.
 */

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Phần tử trượt nhẹ từ dưới lên khi cuộn tới, chỉ chạy một lần. `delay` tính bằng ms để xếp so le. */
export function Reveal({
  children,
  delay = 0,
  className = "",
  as: Tag = "div",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  as?: "div" | "section" | "li" | "article";
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (prefersReducedMotion() || typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true);
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag
      ref={ref as never}
      style={{ transitionDelay: shown ? `${delay}ms` : "0ms" }}
      className={`transition-[opacity,transform] duration-[600ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] will-change-[opacity,transform] ${
        shown ? "translate-y-0 opacity-100" : "translate-y-5 opacity-0"
      } ${className}`}
    >
      {children}
    </Tag>
  );
}

/** Số đếm tăng dần từ 0 tới `value` khi cuộn tới. Định dạng theo kiểu Việt Nam. */
export function CountUp({
  value,
  duration = 1100,
  className = "",
}: {
  value: number;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (prefersReducedMotion() || typeof IntersectionObserver === "undefined") {
      setShown(value);
      return;
    }
    let raf = 0;
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        setShown(Math.round(value * eased));
        if (t < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    });
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [value, duration]);

  return (
    <span ref={ref} className={`tabular-nums ${className}`}>
      {shown.toLocaleString("vi-VN")}
    </span>
  );
}

/** Tiêu đề hiện từng từ một (kiểu SplitText của React Bits). Chỉ dùng cho tiêu đề ngắn ở phần giới thiệu. */
export function SplitWords({ text, className = "", startDelay = 0 }: { text: string; className?: string; startDelay?: number }) {
  const words = text.split(" ");
  // Bản chữ đầy đủ nằm trong sr-only (aria-label trên thẻ span không có vai trò là không hợp lệ);
  // khoảng trắng đặt giữa các khối inline-block, không để cuối khối vì trình duyệt sẽ bỏ nó.
  return (
    <span className={className}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {words.map((word, i) => (
          <Fragment key={`${word}-${i}`}>
            <span className="inline-block overflow-hidden pb-[0.08em] align-bottom">
              <span className="anim-word" style={{ animationDelay: `${startDelay + i * 70}ms` }}>
                {word}
              </span>
            </span>
            {i < words.length - 1 ? " " : null}
          </Fragment>
        ))}
      </span>
    </span>
  );
}
