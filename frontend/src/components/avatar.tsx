const TINTS = [
  "bg-primary-soft text-primary-ink",
  "bg-mint-soft text-teal-800",
  "bg-amber-soft text-amber",
  "bg-leaf-soft text-leaf",
  "bg-violet-100 text-violet-800",
  "bg-sky-100 text-sky-800",
];

const SIZES = {
  sm: "h-9 w-9 rounded-xl text-xs",
  md: "h-11 w-11 rounded-2xl text-sm",
  lg: "h-14 w-14 rounded-2xl text-lg",
  xl: "h-20 w-20 rounded-[1.5rem] text-2xl",
} as const;

/** Chữ cái đầu họ và đầu tên: "Nguyễn Văn An" thành "NA". */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const first = words[0][0];
  const last = words.length > 1 ? words[words.length - 1][0] : "";
  return `${first}${last}`.toLocaleUpperCase("vi-VN");
}

/** Ảnh đại diện chữ cái. Màu cố định theo tên nên cùng một người luôn cùng một màu. */
export function Avatar({ name, size = "md", className = "" }: { name: string; size?: keyof typeof SIZES; className?: string }) {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return (
    <span
      aria-hidden="true"
      className={`inline-grid shrink-0 select-none place-items-center font-bold ${SIZES[size]} ${TINTS[hash % TINTS.length]} ${className}`}
    >
      {initialsOf(name)}
    </span>
  );
}

/** Nhãn trạng thái có chấm màu phía trước (chấm chỉ là trang trí, chữ vẫn nói đủ ý). */
export function StatusPill({
  tone,
  children,
  pulse = false,
}: {
  tone: "good" | "bad" | "warn" | "neutral";
  children: React.ReactNode;
  pulse?: boolean;
}) {
  const styles = {
    good: "bg-leaf-soft text-leaf",
    bad: "bg-danger-soft text-danger",
    warn: "bg-amber-soft text-amber",
    neutral: "bg-paper-2 text-ink-soft",
  }[tone];
  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${styles}`}>
      <span aria-hidden="true" className={`relative h-2 w-2 rounded-full bg-current ${pulse ? "ux-dot" : ""}`} />
      {children}
    </span>
  );
}
