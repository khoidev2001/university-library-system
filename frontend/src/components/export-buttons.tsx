"use client";

import { FileDown, FileSpreadsheet, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { downloadFile, formatBytes } from "@/lib/download";
import { Button, inputClass } from "./ui";

export type ExportDataset = "overdue-loans" | "loans" | "top-books" | "inventory" | "fines" | "readers" | "books";

type Params = Record<string, string | number | boolean | null | undefined>;

interface ExportButtonsProps {
  dataset: ExportDataset;
  /** Bộ lọc hiện tại của trang; giá trị rỗng / undefined bị bỏ qua. */
  params?: Params;
  /** Cho chọn thêm khoảng ngày (from / to) trước khi xuất. */
  dateRange?: boolean;
  /** Tên bộ dữ liệu để đọc cho trình đọc màn hình, ví dụ "phiếu mượn". */
  subject: string;
  className?: string;
}

type Format = "csv" | "xlsx";

type Status =
  | { kind: "idle" }
  | { kind: "running"; format: Format; bytes: number }
  | { kind: "done"; text: string; warn: boolean }
  | { kind: "error"; text: string };

function buildQuery(params: Params, format: Format, from: string, to: string): string {
  const query = new URLSearchParams({ format });
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    query.set(key, String(value));
  }
  if (from) query.set("from", from);
  if (to) query.set("to", to);
  return query.toString();
}

/**
 * Nút "Xuất CSV" / "Xuất Excel" theo bộ lọc đang xem. Tải bằng fetch kèm token rồi lưu thành file;
 * đọc theo khúc để hiện số byte đã nhận và huỷ được giữa chừng, không treo giao diện khi file lớn.
 */
export function ExportButtons({ dataset, params = {}, dateRange = false, subject, className = "" }: ExportButtonsProps) {
  const { token } = useAuth();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const abort = useRef<AbortController | null>(null);
  const id = useId();

  // Rời trang giữa lúc đang tải thì dừng luôn việc tải
  useEffect(() => () => abort.current?.abort(), []);

  const running = status.kind === "running";
  const rangeInvalid = !!from && !!to && from > to;

  async function start(format: Format) {
    if (running) return;
    if (rangeInvalid) {
      setStatus({ kind: "error", text: "Ngày bắt đầu phải trước ngày kết thúc." });
      return;
    }
    const controller = new AbortController();
    abort.current = controller;
    setStatus({ kind: "running", format, bytes: 0 });
    try {
      const result = await downloadFile(`/exports/${dataset}?${buildQuery(params, format, from, to)}`, {
        token,
        signal: controller.signal,
        onProgress: (bytes) => setStatus({ kind: "running", format, bytes }),
      });
      const rows = result.total !== null ? `${result.total.toLocaleString("vi-VN")} dòng, ` : "";
      setStatus({
        kind: "done",
        warn: result.truncated,
        text: result.truncated
          ? `Đã tải ${result.filename} nhưng chỉ gồm một phần: số dòng vượt giới hạn một lần xuất (${rows}${formatBytes(result.bytes)}). Hãy thu hẹp bộ lọc hoặc khoảng ngày.`
          : `Đã tải ${result.filename} (${rows}${formatBytes(result.bytes)}).`,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setStatus({ kind: "idle" });
      } else {
        setStatus({
          kind: "error",
          text: error instanceof ApiError ? error.friendlyMessage : "Không xuất được file, vui lòng thử lại.",
        });
      }
    } finally {
      abort.current = null;
    }
  }

  return (
    <div className={className}>
      <div className="flex flex-wrap items-end gap-2">
        {dateRange && (
          <>
            <div>
              <label htmlFor={`${id}-from`} className="block text-xs font-medium text-ink-soft">
                Từ ngày
              </label>
              <input
                id={`${id}-from`}
                type="date"
                value={from}
                max={to || undefined}
                onChange={(event) => setFrom(event.target.value)}
                className={`${inputClass} mt-1 min-h-10 w-auto`}
              />
            </div>
            <div>
              <label htmlFor={`${id}-to`} className="block text-xs font-medium text-ink-soft">
                Đến ngày
              </label>
              <input
                id={`${id}-to`}
                type="date"
                value={to}
                min={from || undefined}
                onChange={(event) => setTo(event.target.value)}
                className={`${inputClass} mt-1 min-h-10 w-auto`}
              />
            </div>
          </>
        )}
        <Button
          type="button"
          variant="ghost"
          className="min-h-10"
          disabled={running}
          aria-label={`Xuất ${subject} ra CSV`}
          onClick={() => start("csv")}
        >
          <FileDown size={16} aria-hidden="true" />
          Xuất CSV
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="min-h-10"
          disabled={running}
          aria-label={`Xuất ${subject} ra Excel`}
          onClick={() => start("xlsx")}
        >
          <FileSpreadsheet size={16} aria-hidden="true" />
          Xuất Excel
        </Button>
        {running && (
          <Button type="button" variant="ghost" className="min-h-10" onClick={() => abort.current?.abort()}>
            <X size={16} aria-hidden="true" />
            Huỷ
          </Button>
        )}
      </div>
      <p
        role="status"
        aria-live="polite"
        className={`mt-2 text-xs ${
          status.kind === "error" ? "text-brand" : status.kind === "done" && status.warn ? "text-amber" : "text-ink-soft"
        } ${status.kind === "idle" ? "sr-only" : ""}`}
      >
        {status.kind === "running" &&
          `Đang xuất ${status.format === "csv" ? "CSV" : "Excel"}${status.bytes ? `, đã nhận ${formatBytes(status.bytes)}` : ""}...`}
        {(status.kind === "done" || status.kind === "error") && status.text}
      </p>
    </div>
  );
}
