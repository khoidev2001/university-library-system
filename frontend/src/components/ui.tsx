import Link from "next/link";

type Tone = "neutral" | "good" | "warn" | "bad" | "info" | "primary";

const BADGE_TONES: Record<Tone, string> = {
  neutral: "bg-paper-2 text-ink-soft",
  good: "bg-leaf-soft text-leaf",
  warn: "bg-amber-soft text-amber",
  bad: "bg-danger-soft text-danger",
  info: "bg-primary-soft text-primary-ink",
  primary: "bg-primary-soft text-primary-ink",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${BADGE_TONES[tone]}`}>
      {children}
    </span>
  );
}

/** Thẻ nền trắng bo lớn: khối nội dung cơ bản của toàn bộ giao diện. */
export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-[1.25rem] border border-line bg-white p-5 shadow-[var(--shadow-card)] sm:p-6 ${className}`}>{children}</div>;
}

/**
 * Tiêu đề trang. Không có nhãn chữ hoa phía trên: tiêu đề tự nói đủ ý.
 * Tham số `eyebrow` được giữ để các trang cũ biên dịch được nhưng không còn hiển thị, hãy xoá khi gặp.
 */
export function PageHeading({
  title,
  description,
  action,
}: {
  /** @deprecated không còn hiển thị */
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight sm:text-[2rem] sm:leading-[1.15]">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-[0.9375rem] leading-relaxed text-ink-soft">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/** Ô số liệu nhỏ: nhãn thường (không viết hoa), số lớn. */
export function StatCard({
  label,
  value,
  hint,
  tone = "default",
  icon,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: "default" | "danger" | "warn" | "good";
  icon?: React.ReactNode;
}) {
  const valueTone = { default: "text-ink", danger: "text-danger", warn: "text-amber", good: "text-leaf" }[tone];
  return (
    <div className="rounded-[1.25rem] border border-line bg-white p-5 shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-ink-soft">{label}</p>
        {icon && (
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary" aria-hidden="true">
            {icon}
          </span>
        )}
      </div>
      <p className={`mt-3 text-3xl font-bold tracking-tight tabular-nums ${valueTone}`}>{value}</p>
      {hint && <p className="mt-1.5 text-xs text-ink-faint">{hint}</p>}
    </div>
  );
}

/** Nút lọc dạng viên thuốc, dùng cho bộ lọc và tab. */
export function Chip({
  active = false,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex min-h-10 items-center rounded-full px-4 text-sm font-medium transition-colors ${
        active ? "bg-ink text-white" : "bg-white text-ink-soft ring-1 ring-line hover:bg-paper-2 hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-[1.25rem] border border-dashed border-line bg-white/70 px-6 py-14 text-center">
      <p className="text-lg font-bold">{title}</p>
      {hint && <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-soft">{hint}</p>}
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  );
}

export function Alert({ tone = "bad", children }: { tone?: "bad" | "good" | "info"; children: React.ReactNode }) {
  const tones = {
    bad: "border-danger/20 bg-danger-soft text-danger",
    good: "border-leaf/20 bg-leaf-soft text-leaf",
    info: "border-primary/15 bg-primary-soft text-primary-ink",
  } as const;
  return (
    <div role="status" className={`rounded-2xl border px-4 py-3 text-sm leading-relaxed ${tones[tone]}`}>
      {children}
    </div>
  );
}

const BUTTON_BASE =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold transition-[background-color,box-shadow,transform] duration-150 active:scale-[0.98] disabled:cursor-not-allowed";

const BUTTON_VARIANTS = {
  primary:
    "bg-primary text-white shadow-[0_6px_16px_-6px_rgb(79_70_229/0.7)] hover:bg-primary-hover disabled:bg-paper-2 disabled:text-ink-faint disabled:shadow-none",
  soft: "bg-primary-soft text-primary-ink hover:bg-primary/15 disabled:opacity-50",
  ghost: "bg-white text-ink ring-1 ring-inset ring-line hover:bg-paper-2 disabled:text-ink-faint",
  danger: "bg-danger text-white hover:bg-danger/90 disabled:bg-danger/40",
} as const;

export function ButtonLink({
  href,
  children,
  variant = "primary",
}: {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "soft" | "ghost";
}) {
  return (
    <Link href={href} className={`${BUTTON_BASE} ${BUTTON_VARIANTS[variant]}`}>
      {children}
    </Link>
  );
}

export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "soft" | "ghost" | "danger" }) {
  return (
    <button {...props} className={`${BUTTON_BASE} ${BUTTON_VARIANTS[variant]} ${className}`}>
      {children}
    </button>
  );
}

export function Field({
  label,
  hint,
  children,
  htmlFor,
  error,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  htmlFor: string;
  /** Lỗi tại chỗ: hiện dưới ô nhập, đọc được bằng trình đọc màn hình. */
  error?: string | null;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-sm font-semibold">
        {label}
      </label>
      {hint && <p className="mt-0.5 text-xs text-ink-faint">{hint}</p>}
      <div className="mt-2">{children}</div>
      {error && (
        <p role="alert" className="mt-1.5 text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export const inputClass =
  "min-h-11 w-full rounded-xl border border-line bg-white px-4 py-2.5 text-sm outline-none transition-[border-color,box-shadow] placeholder:text-ink-faint hover:border-ink-faint/50 focus:border-primary focus:shadow-[0_0_0_4px_rgb(79_70_229/0.14)]";

/** Khung chờ nội dung: giữ chỗ đúng kích thước để trang không nhảy khi dữ liệu về. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-paper-2 ${className}`} aria-hidden="true" />;
}

export function Spinner({ label = "Đang tải" }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-3 py-12 text-sm text-ink-faint">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-line border-t-primary" aria-hidden="true" />
      {label}…
    </div>
  );
}

/** Mức nguy cơ trả trễ hiển thị cho thủ thư (US19). Không hiện với bạn đọc. */
export function RiskMeter({ risk }: { risk: number | null }) {
  if (risk === null) {
    return <Badge tone="neutral">Chưa có dự báo</Badge>;
  }
  const percent = Math.round(risk * 100);
  const tone = percent > 60 ? "bad" : percent >= 30 ? "warn" : "good";
  const label = percent > 60 ? "Nguy cơ cao" : percent >= 30 ? "Nguy cơ trung bình" : "Nguy cơ thấp";
  return (
    <span className="inline-flex items-center gap-2">
      <Badge tone={tone}>
        {label}: {percent}%
      </Badge>
    </span>
  );
}

/** Khung giữ chỗ cho biểu đồ tải lười: đúng chiều cao nên không nhảy bố cục khi biểu đồ hiện ra. */
export function ChartSkeleton() {
  return <Skeleton className="h-full w-full" />;
}
