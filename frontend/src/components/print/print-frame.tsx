"use client";

import { ArrowLeft, Printer } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button } from "../ui";

const MM_TO_PX = 96 / 25.4;

/**
 * Tỉ lệ thu nhỏ để cả tờ giấy (rộng widthMm) vừa chiều ngang vùng xem trước trên màn hình hẹp.
 * Chỉ ảnh hưởng bản xem trên màn hình; khi in, CSS đặt lại tỉ lệ 1 nên không đổi kích thước thật.
 */
function useFitScale(widthMm: number) {
  const box = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState({ scale: 1, height: 0 });

  useEffect(() => {
    const el = box.current;
    const content = inner.current;
    if (!el || !content) return;
    const measure = () => {
      const scale = Math.min(1, el.clientWidth / (widthMm * MM_TO_PX));
      setFit({ scale, height: content.offsetHeight * scale });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    observer.observe(content);
    return () => observer.disconnect();
  }, [widthMm]);

  return { box, inner, fit };
}

interface PrintFrameProps {
  title: string;
  description: string;
  backHref: string;
  /** Khổ giấy cho @page, ví dụ "A4" hoặc "85.6mm 54mm". */
  pageSize: string;
  /** Bề rộng một tờ (mm) để tính tỉ lệ xem trước. */
  sheetWidthMm: number;
  /** Ô tuỳ chọn (chọn khổ giấy, bố cục...) hiện phía trên bản xem trước, ẩn khi in. */
  options?: React.ReactNode;
  /** Dòng tóm tắt cạnh nút In, ví dụ "12 thẻ, 2 tờ". */
  summary?: string;
  printDisabled?: boolean;
  children: React.ReactNode;
}

/**
 * Khung dùng chung cho mọi trang in: thanh công cụ (ẩn khi in), bản xem trước co theo màn hình và
 * quy tắc @page. Header / footer / menu của site được ẩn khi in bằng print:hidden ở chính các thành phần đó.
 */
export function PrintFrame({
  title,
  description,
  backHref,
  pageSize,
  sheetWidthMm,
  options,
  summary,
  printDisabled,
  children,
}: PrintFrameProps) {
  const { box, inner, fit } = useFitScale(sheetWidthMm);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 print:max-w-none print:p-0 sm:px-6">
      {/* @page chỉ khai báo được một lần cho cả tài liệu nên đặt theo lựa chọn hiện tại */}
      <style>{`@page { size: ${pageSize}; margin: 0; } @media print { html, body { background: #fff !important; } }`}</style>

      <div className="print:hidden">
        <Link
          href={backHref}
          className="inline-flex min-h-10 items-center gap-1.5 text-sm text-ink-soft hover:text-ink hover:underline"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Quay lại
        </Link>
        <h1 className="mt-2 font-serif text-2xl font-bold sm:text-3xl">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-soft">{description}</p>

        {options && <div className="mt-5 rounded-xl border border-line bg-white p-4">{options}</div>}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button type="button" disabled={printDisabled} onClick={() => window.print()} className="min-h-10">
            <Printer size={16} aria-hidden="true" />
            In
          </Button>
          {summary && (
            <p role="status" className="text-sm text-ink-soft">
              {summary}
            </p>
          )}
        </div>
        <p className="mt-3 max-w-2xl text-xs text-ink-faint">
          Trong hộp thoại in: chọn tỉ lệ 100% (không chọn &quot;Vừa trang&quot;), lề &quot;Không có&quot;, bật &quot;Đồ họa nền&quot;.
          In thử một tờ giấy thường trước khi in lên giấy decal hoặc thẻ.
        </p>
      </div>

      {/* Vùng xem trước: thu nhỏ bằng transform trên màn hình, trả về nguyên kích thước khi in */}
      <div
        ref={box}
        className="mt-6 w-full overflow-hidden rounded-xl bg-paper-2 p-0 print:mt-0 print:overflow-visible print:rounded-none print:bg-transparent"
        style={{ ["--fit-h" as string]: `${fit.height}px`, ["--fit-s" as string]: String(fit.scale) }}
      >
        <div className="h-[var(--fit-h)] print:h-auto">
          <div
            ref={inner}
            className="mx-auto origin-top-left scale-[var(--fit-s)] print:mx-0 print:scale-100"
            style={{ width: `${sheetWidthMm}mm` }}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Một tờ giấy: kích thước thật theo mm, ngắt trang sau mỗi tờ. */
export function PaperSheet({
  widthMm,
  heightMm,
  children,
  last,
}: {
  widthMm: number;
  heightMm: number;
  children: React.ReactNode;
  last: boolean;
}) {
  return (
    <section
      className={`relative overflow-hidden bg-white shadow-sm print:shadow-none ${last ? "" : "mb-4 print:mb-0 print:break-after-page"}`}
      style={{ width: `${widthMm}mm`, height: `${heightMm}mm` }}
    >
      {children}
    </section>
  );
}
