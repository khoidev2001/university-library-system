"use client";

import { useMemo } from "react";
import { QUIET_MODULES, barRuns, code128Modules } from "@/lib/barcode/code128";
import { QR_QUIET_MODULES, qrMatrix, qrPath } from "@/lib/barcode/qr";

/**
 * Code 128 dạng SVG vector: co giãn theo kích thước CSS (mm) mà vẫn nét, bề rộng vạch là bội số nguyên
 * của một mô-đun nên máy quét đọc được. Chiều cao do className quyết định (preserveAspectRatio=none).
 */
export function Code128Svg({ value, className = "", title }: { value: string; className?: string; title?: string }) {
  const { path, width } = useMemo(() => {
    const modules = code128Modules(value);
    const d = barRuns(modules)
      .map((r) => `M${r.x + QUIET_MODULES} 0h${r.width}v1h-${r.width}z`)
      .join("");
    return { path: d, width: modules.length + QUIET_MODULES * 2 };
  }, [value]);

  return (
    <svg
      viewBox={`0 0 ${width} 1`}
      preserveAspectRatio="none"
      shapeRendering="crispEdges"
      role="img"
      aria-label={title ?? `Mã vạch ${value}`}
      className={className}
      data-barcode={value}
      data-modules={width}
    >
      <rect width={width} height={1} fill="#fff" />
      <path d={path} fill="#000" />
    </svg>
  );
}

/** QR dạng SVG vector, có vùng yên tĩnh 4 mô-đun. */
export function QrSvg({ value, className = "", title }: { value: string; className?: string; title?: string }) {
  const { path, size } = useMemo(() => {
    const matrix = qrMatrix(value);
    return { path: qrPath(matrix, QR_QUIET_MODULES), size: matrix.length + QR_QUIET_MODULES * 2 };
  }, [value]);

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label={title ?? `Mã QR ${value}`}
      className={className}
      data-qr={value}
    >
      <rect width={size} height={size} fill="#fff" />
      <path d={path} fill="#000" />
    </svg>
  );
}
