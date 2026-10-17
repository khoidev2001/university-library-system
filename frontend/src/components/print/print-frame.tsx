"use client";

import { ArrowLeft, Info, Printer } from "lucide-react";
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
    <div className="mx-auto max-w-6xl px-4 py-8 print:max-w-none print:p-0 sm:px-6 sm:py-10">
      {/* @page chỉ khai báo được một lần cho cả tài liệu nên đặt theo lựa chọn hiện tại */}
      <style>{`@page { size: ${pageSize}; margin: 0; } @media print { html, body { background: #fff !important; } }`}</style>

      <div className="print:hidden">
        <Link
          href={backHref}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-white px-4 text-sm font-semibold text-ink-soft ring-1 ring-inset ring-line transition-colors hover:bg-paper-2 hover:text-ink"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Quay lại
        </Link>
        <h1 className="mt-4 text-2xl font-bold tracking-tight sm:text-[2rem] sm:leading-[1.15]">{title}</h1>
        <p className="mt-2 max-w-2xl text-[0.9375rem] leading-relaxed text-ink-soft">{description}</p>

        {options && (
          <div className="mt-6 rounded-[1.5rem] border border-line bg-white p-5 shadow-[var(--shadow-card)] sm:p-6">{options}</div>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button type="button" disabled={printDisabled} onClick={() => window.print()} className="min-h-12 px-7 text-[0.9375rem]">
            <Printer size={18} aria-hidden="true" />
            In
          </Button>
          {summary && (
            <p role="status" className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-ink-soft ring-1 ring-inset ring-line">
              {summary}
            </p>
          )}
        </div>
        <p className="mt-4 flex max-w-2xl items-start gap-2.5 rounded-2xl bg-primary-soft px-4 py-3 text-sm leading-relaxed text-primary-ink">
          <Info size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>
            Trong hộp thoại in: chọn tỉ lệ 100% (không chọn &quot;Vừa trang&quot;), lề &quot;Không có&quot;, bật &quot;Đồ họa nền&quot;.
            In thử một tờ giấy thường trước khi in lên giấy decal hoặc thẻ.
          </span>
        </p>
      </div>

      {/* Vùng xem trước: nền chấm như bàn làm việc, giấy nổi lên bằng bóng đổ. Khi in, mọi trang trí biến mất */}
      <div className="mt-7 rounded-[1.5rem] bg-paper-2 p-3 [background-image:radial-gradient(rgb(92_100_134/0.22)_1px,transparent_1px)] [background-size:18px_18px] print:mt-0 print:rounded-none print:bg-transparent print:bg-none print:p-0 sm:p-5">
        <div
          ref={box}
          className="w-full overflow-hidden print:overflow-visible"
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
      className={`relative overflow-hidden bg-white shadow-[0_12px_32px_-14px_rgb(21_26_51/0.4)] print:shadow-none ${last ? "" : "mb-4 print:mb-0 print:break-after-page"}`}
      style={{ width: `${widthMm}mm`, height: `${heightMm}mm` }}
    >
      {children}
    </section>
  );
}
