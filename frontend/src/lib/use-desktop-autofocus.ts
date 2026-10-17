"use client";

import { useEffect, type RefObject } from "react";

/**
 * Tự đưa con trỏ vào ô nhập chính, nhưng chỉ trên máy có chuột và màn hình rộng.
 * Trên điện thoại, tự focus sẽ bật bàn phím ảo và che mất nội dung trang.
 */
export function useDesktopAutofocus(ref: RefObject<HTMLElement | null>, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const desktop = window.matchMedia("(hover: hover) and (pointer: fine) and (min-width: 1024px)").matches;
    if (desktop) ref.current?.focus({ preventScroll: true });
  }, [ref, enabled]);
}
