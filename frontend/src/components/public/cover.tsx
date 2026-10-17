"use client";

import { useEffect, useRef, useState } from "react";

/** Bộ màu cho bìa chưa có ảnh: chọn theo tên sách để cùng một cuốn luôn ra cùng một màu. Chữ trắng, đủ tương phản AA. */
const PALETTES = [
  "from-[#3730a3] to-[#4f46e5]",
  "from-[#115e59] to-[#0f766e]",
  "from-[#9f1239] to-[#be185d]",
  "from-[#1e3a8a] to-[#2563eb]",
  "from-[#6b21a8] to-[#7e22ce]",
  "from-[#92400e] to-[#b45309]",
];

function paletteFor(title: string): string {
  let hash = 0;
  for (let i = 0; i < title.length; i += 1) hash = (hash * 31 + title.charCodeAt(i)) >>> 0;
  return PALETTES[hash % PALETTES.length];
}

/**
 * Ảnh bìa của Goodreads có bản lớn (đuôi `l`) cạnh bản nhỏ (`m`). Màn hình lớn và màn Retina cần bản lớn,
 * nếu không tải được thì quay về bản gốc.
 */
export function upgradeCoverUrl(url: string): string {
  return url.replace(/(\/books\/\d+)m\//, "$1l/");
}

function GeneratedCover({ title, className = "" }: { title: string; className?: string }) {
  return (
    <div
      className={`relative flex h-full w-full flex-col justify-between bg-gradient-to-br p-3 text-white ${paletteFor(title)} ${className}`}
      role="img"
      aria-label={`Sách ${title} chưa có ảnh bìa`}
    >
      <span className="absolute inset-y-0 left-2 w-px bg-white/25" aria-hidden="true" />
      <span className="line-clamp-5 pl-2 text-[0.8125rem] font-bold leading-snug">{title}</span>
      <span className="pl-2 text-[0.6875rem] font-medium text-white/80">Thư viện MUCE</span>
    </div>
  );
}

/** Bìa sách: ảnh thật (tải lười), hoặc bìa vẽ sẵn theo tên sách khi chưa có hoặc ảnh lỗi. */
export function BookCover({
  title,
  coverUrl,
  className = "",
  hiRes = false,
  priority = false,
}: {
  title: string;
  coverUrl: string | null;
  className?: string;
  /** Dùng bản ảnh lớn cho các bìa hiển thị to. */
  hiRes?: boolean;
  /** Ảnh nằm ngay màn hình đầu: tải sớm thay vì tải lười. */
  priority?: boolean;
}) {
  const original = coverUrl ?? "";
  const wanted = hiRes && original ? upgradeCoverUrl(original) : original;
  const [src, setSrc] = useState(wanted);
  const [failed, setFailed] = useState(false);
  const img = useRef<HTMLImageElement | null>(null);

  const fallback = () => {
    if (src !== original && original) setSrc(original);
    else setFailed(true);
  };

  // Ảnh có thể đã lỗi trước khi React nhận quyền điều khiển (HTML dựng sẵn từ máy chủ)
  useEffect(() => {
    const el = img.current;
    if (el && el.complete && el.naturalWidth === 0) fallback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!original || failed) return <GeneratedCover title={title} className={className} />;

  return (
    // Ảnh bìa đến từ nhiều nguồn ngoài nên dùng thẻ img thường thay vì next/image
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={img}
      src={src}
      alt={`Bìa sách ${title}`}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      decoding="async"
      width={200}
      height={300}
      onError={fallback}
      className={`h-full w-full object-cover ${className}`}
    />
  );
}
