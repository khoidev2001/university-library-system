/** Ô chọn có vùng bấm 40×40px (ô hiển thị vẫn 20px) để bấm được bằng ngón tay trên điện thoại. */
export function TapCheckbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="-m-2 flex h-10 w-10 cursor-pointer items-center justify-center">
      <input
        type="checkbox"
        aria-label={label}
        className="h-5 w-5 accent-[var(--color-ink)]"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}
