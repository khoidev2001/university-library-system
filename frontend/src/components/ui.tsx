import Link from "next/link";

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "good" | "warn" | "bad" | "info";
  children: React.ReactNode;
}) {
  const tones = {
    neutral: "bg-paper-2 text-ink-soft",
    good: "bg-leaf-soft text-leaf",
    warn: "bg-amber-soft text-amber",
    bad: "bg-brand-soft text-brand",
    info: "bg-ink/5 text-ink",
  } as const;
  return <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-line bg-white p-5 shadow-sm ${className}`}>{children}</div>;
}

export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
      <div>
        {eyebrow && (
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand">{eyebrow}</p>
        )}
        <h1 className="mt-1.5 font-serif text-2xl font-bold sm:text-3xl">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-sm text-ink-soft">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-line bg-white/60 px-6 py-14 text-center">
      <p className="font-serif text-lg font-bold">{title}</p>
      {hint && <p className="mx-auto mt-2 max-w-md text-sm text-ink-soft">{hint}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Alert({ tone = "bad", children }: { tone?: "bad" | "good" | "info"; children: React.ReactNode }) {
  const tones = {
    bad: "border-brand/30 bg-brand-soft text-brand",
    good: "border-leaf/30 bg-leaf-soft text-leaf",
    info: "border-line bg-paper-2 text-ink-soft",
  } as const;
  return (
    <div role="status" className={`rounded-lg border px-4 py-3 text-sm ${tones[tone]}`}>
      {children}
    </div>
  );
}

export function ButtonLink({
  href,
  children,
  variant = "primary",
}: {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "ghost";
}) {
  const styles =
    variant === "primary"
      ? "bg-ink text-paper hover:bg-ink/90"
      : "border border-line bg-white text-ink hover:bg-paper-2";
  return (
    <Link
      href={href}
      className={`inline-flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium transition-colors ${styles}`}
    >
      {children}
    </Link>
  );
}

export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" }) {
  const styles = {
    primary: "bg-ink text-paper hover:bg-ink/90 disabled:bg-ink/40",
    ghost: "border border-line bg-white text-ink hover:bg-paper-2 disabled:text-ink-faint",
    danger: "bg-brand text-white hover:bg-brand/90 disabled:bg-brand/40",
  }[variant];
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  hint,
  children,
  htmlFor,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  htmlFor: string;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-sm font-medium">
        {label}
      </label>
      {hint && <p className="mt-0.5 text-xs text-ink-faint">{hint}</p>}
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

export const inputClass =
  "w-full rounded-md border border-line bg-white px-3 py-2.5 text-sm outline-none transition-colors placeholder:text-ink-faint focus:border-ink";

export function Spinner({ label = "Đang tải" }: { label?: string }) {
  return (
    <p role="status" className="py-10 text-center text-sm text-ink-faint">
      {label}...
    </p>
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
