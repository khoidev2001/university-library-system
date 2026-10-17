/** Logo trường (MUCE 1976). Tệp đã được cắt sát và nén; kích thước cố định để không nhảy bố cục. */
export function Logo({ size = 40, className = "" }: { size?: number; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo-muce.webp"
      alt="Logo Trường Đại học Xây dựng Miền Trung"
      width={size}
      height={Math.round(size * 1.054)}
      decoding="async"
      className={`shrink-0 select-none object-contain ${className}`}
    />
  );
}
