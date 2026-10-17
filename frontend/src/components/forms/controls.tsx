"use client";

import { AlertCircle, Check, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import "../ux-motion.css";

const FIELD_BASE =
  "ux-field w-full rounded-2xl border bg-white text-ink outline-none transition-[border-color,box-shadow] placeholder:text-ink-faint disabled:bg-paper-2 disabled:text-ink-faint";
const FIELD_OK = "border-line hover:border-ink-faint/50 focus:border-primary focus:shadow-[0_0_0_4px_rgb(79_70_229/0.14)]";
const FIELD_BAD = "border-danger focus:shadow-[0_0_0_4px_rgb(200_30_69/0.14)]";
const FIELD_SIZE = { md: "min-h-12 px-4 py-2.5 text-[0.9375rem]", lg: "min-h-14 px-5 py-3 text-lg" } as const;

export function fieldClass(opts: { error?: boolean; size?: "md" | "lg"; extra?: string } = {}): string {
  return `${FIELD_BASE} ${opts.error ? FIELD_BAD : FIELD_OK} ${FIELD_SIZE[opts.size ?? "md"]} ${opts.extra ?? ""}`;
}

/** Thông báo lỗi nằm ngay dưới ô nhập; trình đọc màn hình đọc ngay khi nó xuất hiện. */
export function FieldError({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <p id={id} role="alert" className="mt-1.5 flex items-start gap-1.5 text-sm font-medium text-danger">
      <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

interface TextFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  id: string;
  label: string;
  hint?: string;
  error?: string | null;
  size?: "md" | "lg";
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  wrapperClassName?: string;
  ref?: React.Ref<HTMLInputElement>;
}

/** Ô nhập có nhãn, gợi ý và lỗi tại chỗ. Lỗi gắn aria-invalid và aria-describedby để máy đọc nối đúng ô. */
export function TextField({
  id,
  label,
  hint,
  error,
  size = "md",
  leading,
  trailing,
  wrapperClassName = "",
  className = "",
  ref,
  ...props
}: TextFieldProps) {
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className={wrapperClassName}>
      <label htmlFor={id} className="block text-sm font-semibold">
        {label}
      </label>
      {hint && (
        <p id={`${id}-hint`} className="mt-0.5 text-xs text-ink-faint">
          {hint}
        </p>
      )}
      <div className="relative mt-2">
        {leading && (
          <span className="pointer-events-none absolute inset-y-0 left-4 grid place-items-center text-ink-faint" aria-hidden="true">
            {leading}
          </span>
        )}
        <input
          {...props}
          id={id}
          ref={ref}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={fieldClass({ error: !!error, size, extra: `${leading ? "pl-12" : ""} ${trailing ? "pr-14" : ""} ${className}` })}
        />
        {trailing}
      </div>
      {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
    </div>
  );
}

/** Ô mật khẩu có nút hiện / ẩn. Nút luôn bấm được bằng bàn phím và báo trạng thái qua aria-pressed. */
export function PasswordField(props: Omit<TextFieldProps, "type" | "trailing" | "leading">) {
  const [shown, setShown] = useState(false);
  return (
    <TextField
      {...props}
      type={shown ? "text" : "password"}
      trailing={
        <button
          type="button"
          onClick={() => setShown((value) => !value)}
          aria-pressed={shown}
          aria-label={shown ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
          className="absolute right-1.5 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-xl text-ink-faint transition-colors hover:bg-paper-2 hover:text-ink"
        >
          {shown ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
        </button>
      }
    />
  );
}

export function SelectField({
  id,
  label,
  hint,
  children,
  ...props
}: Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "size"> & { id: string; label: string; hint?: string }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold">
        {label}
      </label>
      {hint && <p className="mt-0.5 text-xs text-ink-faint">{hint}</p>}
      <select {...props} id={id} className={fieldClass({ extra: "mt-2" })}>
        {children}
      </select>
    </div>
  );
}

/** Chọn một trong vài mục ngắn: hai ba nút liền khối thay cho ô thả xuống. Là radio thật nên mũi tên trái phải đổi lựa chọn. */
export function Segmented<T extends string>({
  legend,
  name,
  value,
  onChange,
  options,
}: {
  legend: string;
  name: string;
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <fieldset>
      <legend className="text-sm font-semibold">{legend}</legend>
      <div className="mt-2 grid auto-cols-fr grid-flow-col gap-1 rounded-2xl bg-paper-2 p-1">
        {options.map((option) => (
          <label key={option.value} className="relative cursor-pointer">
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="peer sr-only"
            />
            <span className="flex min-h-10 items-center justify-center rounded-xl px-3 text-sm font-semibold text-ink-soft transition-[background-color,color,box-shadow] hover:text-ink peer-checked:bg-white peer-checked:text-primary-ink peer-checked:shadow-[var(--shadow-card)] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary">
              {option.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Công tắc bật tắt. Là checkbox thật mang role="switch": bàn phím (Space) và trình đọc màn hình dùng bình thường. */
export function Switch({
  id,
  checked,
  onChange,
  disabled,
  label,
  description,
}: {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label: string;
  description?: string;
}) {
  return (
    <label htmlFor={id} className={`flex min-h-12 justify-between gap-5 ${description ? "items-start" : "items-center"} ${disabled ? "cursor-wait" : "cursor-pointer"}`}>
      <span className="min-w-0 text-sm">
        <span className="block font-semibold">{label}</span>
        {description && <span className="mt-1 block leading-relaxed text-ink-soft">{description}</span>}
      </span>
      <span className={`relative shrink-0 ${description ? "mt-0.5" : ""}`}>
        <input
          id={id}
          type="checkbox"
          role="switch"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
          className="peer sr-only"
        />
        <span
          aria-hidden="true"
          className="block h-7 w-12 rounded-full bg-white ring-2 ring-inset ring-ink-faint transition-[background-color,box-shadow] peer-checked:bg-primary peer-checked:ring-primary peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary peer-disabled:opacity-60"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-1.5 top-1.5 h-4 w-4 rounded-full bg-ink-faint transition-[transform,background-color] duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)] peer-checked:translate-x-5 peer-checked:bg-white"
        />
      </span>
    </label>
  );
}

/** Ô tích có vùng bấm 40x40px; ô hiển thị vẫn 20px. */
export function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="-m-1 grid h-10 w-10 cursor-pointer place-items-center">
      <input
        type="checkbox"
        aria-label={label}
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className="grid h-5 w-5 place-items-center rounded-md border-2 border-ink-faint bg-white text-white transition-colors peer-checked:border-primary peer-checked:bg-primary peer-checked:[&>svg]:scale-100 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary"
      >
        <Check size={13} strokeWidth={3.5} className="scale-0 transition-transform duration-150" />
      </span>
    </label>
  );
}

/** Vòng xoay nhỏ đặt trong nút khi đang gửi. */
export function InlineSpinner() {
  return <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent opacity-80" aria-hidden="true" />;
}

/** Lỗi cấp biểu mẫu (từ máy chủ). Rung nhẹ khi xuất hiện, chỉ bằng transform nên không đẩy bố cục. */
export function FormError({ children }: { children: React.ReactNode }) {
  return (
    <div
      key={typeof children === "string" ? children : undefined}
      role="alert"
      className="ux-shake flex items-start gap-2.5 rounded-2xl border border-danger/20 bg-danger-soft px-4 py-3 text-sm font-medium leading-relaxed text-danger"
    >
      <AlertCircle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}
