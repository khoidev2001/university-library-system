"use client";

import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { LabelCopy } from "@/lib/import-types";
import { Alert, Field, Spinner, inputClass } from "../ui";
import { Code128Svg } from "./barcode-svg";
import { LABEL_LAYOUTS, placeLabels, type LabelLayout } from "./label-layouts";
import { PaperSheet, PrintFrame } from "./print-frame";

function CopyLabel({ copy, layout }: { copy: LabelCopy; layout: LabelLayout }) {
  const small = layout.h < 27;
  return (
    <div
      className="flex flex-col overflow-hidden bg-white text-black"
      style={{ width: `${layout.w}mm`, height: `${layout.h}mm`, padding: small ? "1.6mm 2.4mm" : "2.2mm 3mm" }}
    >
      <p className={`${small ? "line-clamp-1 text-[5.8pt]" : "line-clamp-2 text-[6.8pt]"} font-bold leading-[1.15]`}>
        {copy.book.title}
      </p>
      <Code128Svg value={copy.barcode} className="mt-[0.8mm] min-h-0 w-full flex-1" />
      <div className="mt-[0.6mm] flex items-baseline justify-between gap-2 leading-none">
        <span className={`font-mono ${small ? "text-[5.6pt]" : "text-[6.6pt]"} tracking-[0.06em]`}>{copy.barcode}</span>
        {copy.shelfLocation && (
          <span className={`truncate font-bold ${small ? "text-[6pt]" : "text-[7.6pt]"}`}>{copy.shelfLocation}</span>
        )}
      </div>
    </div>
  );
}

export function CopyLabelsView() {
  const { token } = useAuth();
  const search = useSearchParams();
  const [layoutId, setLayoutId] = useState(LABEL_LAYOUTS[0].id);
  const [skip, setSkip] = useState(0);
  const [hideLost, setHideLost] = useState(true);

  const layout = LABEL_LAYOUTS.find((l) => l.id === layoutId) ?? LABEL_LAYOUTS[0];
  const query = useMemo(() => {
    const q = new URLSearchParams();
    for (const key of ["bookIds", "copyIds"]) {
      const value = search.get(key);
      if (value) q.set(key, value);
    }
    return q.toString();
  }, [search]);

  const copies = useQuery({
    queryKey: ["print-labels", query],
    queryFn: () => apiFetch<LabelCopy[]>(`/copies/labels?${query}`, { token }),
    enabled: !!token && query !== "",
  });

  const list = (copies.data ?? []).filter((c) => !hideLost || c.status !== "LOST");
  const perSheet = layout.cols * layout.rows;
  const effectiveSkip = layout.roll ? 0 : Math.min(skip, perSheet - 1);
  const { placements, sheets } = placeLabels(layout, list.length, effectiveSkip);
  const pages = Array.from({ length: sheets }, (_, s) => placements.filter((p) => p.sheet === s));

  return (
    <PrintFrame
      title="In nhãn mã vạch bản sao"
      description="Nhãn gồm tên sách, mã vạch Code 128 của bản sao (dạng LIB-000123-1) và vị trí kệ. Quầy mượn trả quét mã này vào ô mã vạch."
      backHref="/admin/books"
      pageSize={layout.roll ? `${layout.pageW}mm ${layout.pageH}mm` : "A4"}
      sheetWidthMm={layout.pageW}
      printDisabled={list.length === 0}
      summary={
        copies.isLoading
          ? "Đang tải bản sao..."
          : `${list.length} nhãn, ${sheets} ${layout.roll ? "trang" : "tờ A4"}`
      }
      options={
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
          <Field label="Loại giấy nhãn" htmlFor="label-layout">
            <select
              id="label-layout"
              value={layoutId}
              onChange={(event) => {
                setLayoutId(event.target.value);
                setSkip(0);
              }}
              className={`${inputClass} min-h-10`}
            >
              {LABEL_LAYOUTS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Bỏ trống ô đầu tiên"
            hint={layout.roll ? "Không áp dụng cho cuộn nhãn" : `Từ 0 đến ${perSheet - 1}, dùng tiếp tờ đã in dở`}
            htmlFor="label-skip"
          >
            <input
              id="label-skip"
              type="number"
              inputMode="numeric"
              min={0}
              max={perSheet - 1}
              disabled={layout.roll}
              value={effectiveSkip}
              onChange={(event) => setSkip(Math.max(0, Math.floor(Number(event.target.value) || 0)))}
              className={`${inputClass} min-h-10`}
            />
          </Field>
          <label className="flex min-h-10 items-center gap-2.5 text-sm md:col-span-2">
            <input
              type="checkbox"
              checked={hideLost}
              onChange={(event) => setHideLost(event.target.checked)}
              className="h-5 w-5 accent-[var(--color-ink)]"
            />
            Bỏ qua bản sao đã báo mất
          </label>
        </div>
      }
    >
      {query === "" ? (
        <div className="p-4 print:hidden">
          <Alert tone="info">Chưa chọn sách nào. Hãy quay lại danh sách sách và chọn sách cần in nhãn.</Alert>
        </div>
      ) : copies.isLoading ? (
        <Spinner label="Đang tải bản sao" />
      ) : copies.isError ? (
        <div className="p-4 print:hidden">
          <Alert tone="bad">Không tải được bản sao. Có thể bạn chọn quá nhiều sách (tối đa 2000 nhãn mỗi lần).</Alert>
        </div>
      ) : list.length === 0 ? (
        <div className="p-4 print:hidden">
          <Alert tone="info">Không có bản sao nào để in nhãn.</Alert>
        </div>
      ) : (
        pages.map((group, s) => (
          <PaperSheet key={s} widthMm={layout.pageW} heightMm={layout.pageH} last={s === pages.length - 1}>
            {group.map((p) => (
              <div
                key={p.index}
                className="absolute outline outline-1 outline-dashed outline-ink/15 print:outline-none"
                style={{ left: `${p.x}mm`, top: `${p.y}mm` }}
              >
                <CopyLabel copy={list[p.index!]} layout={layout} />
              </div>
            ))}
          </PaperSheet>
        ))
      )}
    </PrintFrame>
  );
}
