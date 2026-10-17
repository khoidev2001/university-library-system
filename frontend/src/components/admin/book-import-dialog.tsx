"use client";

import { FileSpreadsheet, FileUp, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { toCsv } from "@/lib/csv";
import { downloadFile, formatBytes, saveBlob } from "@/lib/download";
import {
  IMPORT_COLUMNS,
  IMPORT_MAX_FILE_BYTES,
  type ImportFailure,
  type ImportFileReport,
  type ImportPreview,
  type ImportPreviewRow,
  type OnDuplicate,
} from "@/lib/import-types";
import { uploadFile } from "@/lib/upload";
import { Alert, Badge, Button } from "../ui";
import { Modal, TableShell, Th } from "./admin-ui";

type Phase = "pick" | "analyzing" | "preview" | "importing" | "done";
type RowFilter = "all" | "error" | "warning";

const PAGE_SIZE = 100;
const ACCEPT = ".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const ACTION_LABEL: Record<ImportPreviewRow["action"], string> = {
  create: "Tạo mới",
  update: "Cập nhật",
  skip: "Bỏ qua (đã có)",
  none: "Không nhập",
};

function extensionOf(name: string): string {
  return /\.([A-Za-z0-9]+)$/.exec(name)?.[1].toLowerCase() ?? "";
}

function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.friendlyMessage : "Không đọc được file, vui lòng thử lại.";
}

/** CSV các dòng lỗi: giữ nguyên các cột nhập (sửa xong tải lên lại được) và thêm cột "error". */
function failedRowsCsv(rows: { row: number; reason: string; raw: ImportFailure["raw"] }[]): Blob {
  const text = toCsv(
    [...IMPORT_COLUMNS, "error", "row"],
    rows.map((r) => [...IMPORT_COLUMNS.map((c) => r.raw[c] ?? ""), r.reason, r.row]),
  );
  return new Blob([text], { type: "text/csv;charset=utf-8" });
}

export function BookImportDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { token } = useAuth();
  const [phase, setPhase] = useState<Phase>("pick");
  const [file, setFile] = useState<File | null>(null);
  const [onDuplicate, setOnDuplicate] = useState<OnDuplicate>("skip");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [report, setReport] = useState<ImportFileReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [upload, setUpload] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [filter, setFilter] = useState<RowFilter>("all");
  const [shown, setShown] = useState(PAGE_SIZE);
  const [templateBusy, setTemplateBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => () => abort.current?.abort(), []);

  const analyze = useCallback(
    async (target: File, duplicate: OnDuplicate) => {
      abort.current?.abort();
      const controller = new AbortController();
      abort.current = controller;
      setPhase("analyzing");
      setError(null);
      setUpload(0);
      try {
        const result = await uploadFile<ImportPreview>(
          `/books/import-file?dryRun=true&onDuplicate=${duplicate}`,
          target,
          { token, signal: controller.signal, onUploadProgress: setUpload },
        );
        setPreview(result);
        setFilter(result.counts.error > 0 ? "error" : "all");
        setShown(PAGE_SIZE);
        setPhase("preview");
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setError(errorMessage(e));
        setPhase("pick");
      }
    },
    [token],
  );

  function choose(selected: File | undefined) {
    if (!selected) return;
    const ext = extensionOf(selected.name);
    if (ext !== "csv" && ext !== "xlsx") {
      setError("Chỉ nhận file .csv hoặc .xlsx. File .xls cũ hoặc .xlsm (có macro) hãy lưu lại thành .xlsx.");
      return;
    }
    if (selected.size > IMPORT_MAX_FILE_BYTES) {
      setError(`File ${formatBytes(selected.size)} vượt giới hạn 5 MB. Hãy chia nhỏ file.`);
      return;
    }
    if (selected.size === 0) {
      setError("File rỗng.");
      return;
    }
    setFile(selected);
    setReport(null);
    void analyze(selected, onDuplicate);
  }

  async function confirm() {
    if (!file) return;
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setPhase("importing");
    setError(null);
    setUpload(0);
    try {
      const result = await uploadFile<ImportFileReport>(`/books/import-file?dryRun=false&onDuplicate=${onDuplicate}`, file, {
        token,
        signal: controller.signal,
        onUploadProgress: setUpload,
      });
      setReport(result);
      setPhase("done");
      onDone();
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(errorMessage(e));
      setPhase("preview");
    }
  }

  function reset() {
    abort.current?.abort();
    setFile(null);
    setPreview(null);
    setReport(null);
    setError(null);
    setPhase("pick");
    if (input.current) input.current.value = "";
  }

  async function template(format: "csv" | "xlsx") {
    setTemplateBusy(true);
    setError(null);
    try {
      await downloadFile(`/books/import-template?format=${format}`, { token });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setTemplateBusy(false);
    }
  }

  const rows = preview?.rows ?? [];
  const visible = rows.filter((r) => filter === "all" || r.status === filter);
  const counts = preview?.counts;
  const writable = counts ? counts.create + counts.update : 0;

  return (
    <Modal title="Nhập sách từ file" onClose={onClose} wide>
      {error && (
        <div className="mb-4">
          <Alert tone="bad">{error}</Alert>
        </div>
      )}

      {(phase === "pick" || phase === "analyzing") && (
        <div>
          <p className="text-sm text-ink-soft">
            Chọn file CSV (UTF-8) hoặc Excel (.xlsx), tối đa 5 MB và 5000 dòng. Hệ thống kiểm tra từng dòng trước,
            chỉ ghi vào kho khi bạn xác nhận.
          </p>

          <label
            htmlFor="book-import-file"
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              if (phase === "pick") choose(event.dataTransfer.files[0]);
            }}
            className={`mt-4 flex min-h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors focus-within:border-ink focus-within:bg-paper-2 ${
              dragging ? "border-ink bg-paper-2" : "border-line bg-white hover:bg-paper-2"
            }`}
          >
            <FileUp size={28} aria-hidden="true" className="text-ink-soft" />
            <span className="text-sm font-medium">Kéo thả file vào đây hoặc bấm để chọn</span>
            <span className="text-xs text-ink-soft">.csv hoặc .xlsx</span>
            <input
              ref={input}
              id="book-import-file"
              type="file"
              accept={ACCEPT}
              disabled={phase === "analyzing"}
              className="sr-only"
              onChange={(event) => choose(event.target.files?.[0])}
            />
          </label>

          {phase === "analyzing" && file && (
            <div className="mt-4" role="status">
              <p className="text-sm">
                Đang kiểm tra <strong>{file.name}</strong> ({formatBytes(file.size)})...
              </p>
              <ProgressBar fraction={upload} />
            </div>
          )}

          <div className="mt-5 rounded-lg border border-line bg-white p-4">
            <p className="text-sm font-medium">Chưa có file mẫu?</p>
            <p className="mt-1 text-xs text-ink-soft">
              Mẫu có đủ cột (title, authors, category, isbn, publisher, publishedYear, price, description, coverUrl,
              copies, shelfLocation) và một dòng ví dụ. Nhiều tác giả cách nhau bằng dấu chấm phẩy.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" variant="ghost" className="min-h-10" disabled={templateBusy} onClick={() => template("csv")}>
                <FileSpreadsheet size={16} aria-hidden="true" />
                Tải mẫu CSV
              </Button>
              <Button type="button" variant="ghost" className="min-h-10" disabled={templateBusy} onClick={() => template("xlsx")}>
                <FileSpreadsheet size={16} aria-hidden="true" />
                Tải mẫu Excel
              </Button>
            </div>
          </div>
        </div>
      )}

      {(phase === "preview" || phase === "importing") && preview && counts && (
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm">
              <strong>{file?.name}</strong> · {preview.totalRows.toLocaleString("vi-VN")} dòng ·{" "}
              {preview.fileType === "xlsx" ? "Excel" : "CSV"}
            </p>
            <Button type="button" variant="ghost" className="min-h-10" disabled={phase === "importing"} onClick={reset}>
              <RotateCcw size={16} aria-hidden="true" />
              Chọn file khác
            </Button>
          </div>

          <fieldset className="mt-3" disabled={phase === "importing"}>
            <legend className="text-sm font-medium">Khi ISBN đã có trong kho</legend>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {(
                [
                  ["skip", "Bỏ qua"],
                  ["update", "Cập nhật thông tin và bổ sung bản sao còn thiếu"],
                ] as const
              ).map(([value, label]) => (
                <label
                  key={value}
                  className={`flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm ${
                    onDuplicate === value ? "border-ink bg-paper-2" : "border-line bg-white"
                  }`}
                >
                  <input
                    type="radio"
                    name="on-duplicate"
                    value={value}
                    checked={onDuplicate === value}
                    onChange={() => {
                      setOnDuplicate(value);
                      if (file) void analyze(file, value);
                    }}
                    className="h-4 w-4 accent-[var(--color-ink)]"
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>

          <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5" aria-label="Tóm tắt kiểm tra">
            <Stat label="Tạo mới" value={counts.create} tone="good" />
            <Stat label="Cập nhật" value={counts.update} tone="info" />
            <Stat label="Bỏ qua (đã có)" value={counts.skip} tone="neutral" />
            <Stat label="Lỗi" value={counts.error} tone={counts.error > 0 ? "bad" : "neutral"} />
            <Stat label="Cảnh báo" value={counts.warning} tone={counts.warning > 0 ? "warn" : "neutral"} />
          </dl>

          {(preview.notes.length > 0 || preview.unknownColumns.length > 0 || preview.newCategories.length > 0) && (
            <div className="mt-3 space-y-2">
              {preview.newCategories.length > 0 && (
                <Alert tone="info">Sẽ tạo thêm thể loại: {preview.newCategories.join(", ")}.</Alert>
              )}
              {preview.unknownColumns.length > 0 && (
                <Alert tone="info">Cột không nhận ra nên bị bỏ qua: {preview.unknownColumns.join(", ")}.</Alert>
              )}
              {preview.notes.map((note) => (
                <Alert key={note} tone="info">
                  {note}
                </Alert>
              ))}
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <div role="tablist" aria-label="Lọc dòng" className="flex flex-wrap gap-1 rounded-lg border border-line bg-white p-1">
              {(
                [
                  ["all", `Tất cả (${rows.length})`],
                  ["error", `Lỗi (${counts.error})`],
                  ["warning", `Cảnh báo (${counts.warning})`],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={filter === value}
                  onClick={() => {
                    setFilter(value);
                    setShown(PAGE_SIZE);
                  }}
                  className={`min-h-10 rounded-md px-3 text-sm ${
                    filter === value ? "bg-ink font-medium text-paper" : "text-ink-soft hover:bg-paper-2"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {counts.error > 0 && (
              <Button
                type="button"
                variant="ghost"
                className="min-h-10"
                onClick={() =>
                  saveBlob(
                    failedRowsCsv(
                      rows
                        .filter((r) => r.status === "error" && r.raw)
                        .map((r) => ({ row: r.row, reason: r.errors.map((e) => e.message).join("; "), raw: r.raw! })),
                    ),
                    "dong-loi-nhap-sach.csv",
                  )
                }
              >
                Tải các dòng lỗi (CSV)
              </Button>
            )}
          </div>

          <div className="mt-3">
            <TableShell minWidth={760} label="Bảng kết quả kiểm tra, cuộn ngang để xem hết">
              <caption className="sr-only">Kết quả kiểm tra từng dòng</caption>
              <thead className="border-b border-line bg-paper-2">
                <tr>
                  <Th>Dòng</Th>
                  <Th>Trạng thái</Th>
                  <Th>Sách</Th>
                  <Th>Thể loại</Th>
                  <Th>Bản</Th>
                  <Th>Ghi chú</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {visible.slice(0, shown).map((r) => (
                  <tr key={r.row} className="align-top">
                    <td className="px-4 py-2.5 tabular text-ink-soft">{r.row}</td>
                    <td className="px-4 py-2.5">
                      <Badge tone={r.status === "error" ? "bad" : r.status === "warning" ? "warn" : "good"}>
                        {r.status === "error" ? "Lỗi" : r.status === "warning" ? "Cảnh báo" : "Hợp lệ"}
                      </Badge>
                      <span className="mt-1 block text-xs text-ink-soft">{ACTION_LABEL[r.action]}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="font-medium">{r.title || "(thiếu tiêu đề)"}</span>
                      {r.isbn && <span className="block font-mono text-xs text-ink-faint">{r.isbn}</span>}
                    </td>
                    <td className="px-4 py-2.5 text-ink-soft">{r.category ?? "-"}</td>
                    <td className="px-4 py-2.5 text-ink-soft">{r.copies ?? "-"}</td>
                    <td className="px-4 py-2.5">
                      <ul className="space-y-0.5 text-xs">
                        {r.errors.map((issue, i) => (
                          <li key={`e${i}`} className="text-brand">
                            {issue.message}
                          </li>
                        ))}
                        {r.warnings.map((issue, i) => (
                          <li key={`w${i}`} className="text-amber">
                            {issue.message}
                          </li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                ))}
              </tbody>
            </TableShell>
            {visible.length === 0 && <p className="py-6 text-center text-sm text-ink-soft">Không có dòng nào.</p>}
            {visible.length > shown && (
              <div className="mt-3 text-center">
                <Button type="button" variant="ghost" className="min-h-10" onClick={() => setShown((n) => n + PAGE_SIZE)}>
                  Hiện thêm ({visible.length - shown} dòng)
                </Button>
              </div>
            )}
          </div>

          {phase === "importing" && (
            <div className="mt-4" role="status">
              <p className="text-sm">
                {upload < 1 ? "Đang gửi file lên máy chủ..." : "Máy chủ đang ghi vào kho sách, có thể mất vài chục giây..."}
              </p>
              <ProgressBar fraction={upload < 1 ? upload : null} />
            </div>
          )}

          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={phase === "importing"}>
              Đóng
            </Button>
            <Button type="button" onClick={confirm} disabled={phase === "importing" || writable === 0}>
              {phase === "importing"
                ? "Đang nhập..."
                : writable === 0
                  ? "Không có dòng nào để nhập"
                  : counts.error > 0
                    ? `Nhập ${writable.toLocaleString("vi-VN")} dòng hợp lệ (bỏ qua ${counts.error} dòng lỗi)`
                    : `Nhập ${writable.toLocaleString("vi-VN")} dòng`}
            </Button>
          </div>
        </div>
      )}

      {phase === "done" && report && (
        <div>
          <Alert tone={report.failed.length > 0 ? "info" : "good"}>
            Đã nhập xong {report.totalRows.toLocaleString("vi-VN")} dòng.
          </Alert>
          <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Kết quả nhập">
            <Stat label="Đã tạo" value={report.created} tone="good" />
            <Stat label="Đã cập nhật" value={report.updated} tone="info" />
            <Stat label="Bỏ qua" value={report.skipped} tone="neutral" />
            <Stat label="Thất bại" value={report.failed.length} tone={report.failed.length > 0 ? "bad" : "neutral"} />
          </dl>
          <p className="mt-3 text-sm text-ink-soft">
            Tạo thêm {report.createdCopies.toLocaleString("vi-VN")} bản sao
            {report.newCategories.length > 0 ? `, thể loại mới: ${report.newCategories.join(", ")}` : ""}.
          </p>

          {report.failed.length > 0 && (
            <div className="mt-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">Các dòng không nhập được</h3>
                <Button
                  type="button"
                  variant="ghost"
                  className="min-h-10"
                  onClick={() => saveBlob(failedRowsCsv(report.failed), "dong-loi-nhap-sach.csv")}
                >
                  Tải các dòng lỗi (CSV)
                </Button>
              </div>
              <div className="mt-2">
                <TableShell minWidth={520} label="Bảng các dòng nhập thất bại">
                  <caption className="sr-only">Các dòng nhập thất bại</caption>
                  <thead className="border-b border-line bg-paper-2">
                    <tr>
                      <Th>Dòng</Th>
                      <Th>Sách</Th>
                      <Th>Lý do</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {report.failed.slice(0, 100).map((f) => (
                      <tr key={f.row} className="align-top">
                        <td className="px-4 py-2.5 tabular text-ink-soft">{f.row}</td>
                        <td className="px-4 py-2.5">{f.raw.title ?? "-"}</td>
                        <td className="px-4 py-2.5 text-xs text-brand">{f.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </TableShell>
                {report.failed.length > 100 && (
                  <p className="mt-2 text-xs text-ink-soft">
                    Hiển thị 100 trên {report.failed.length} dòng; tải CSV để xem đủ.
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <Button type="button" variant="ghost" onClick={reset}>
              Nhập file khác
            </Button>
            <Button type="button" onClick={onClose}>
              Xong
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: "good" | "info" | "neutral" | "bad" | "warn" }) {
  const color = { good: "text-leaf", info: "text-ink", neutral: "text-ink-soft", bad: "text-brand", warn: "text-amber" }[tone];
  return (
    <div className="rounded-lg border border-line bg-white px-3 py-2">
      <dt className="text-xs text-ink-soft">{label}</dt>
      <dd className={`text-xl font-bold tabular ${color}`}>{value.toLocaleString("vi-VN")}</dd>
    </div>
  );
}

/** Thanh tiến độ. fraction = null: chưa biết tiến độ (máy chủ đang xử lý), chỉ nhấp nháy bằng opacity. */
function ProgressBar({ fraction }: { fraction: number | null }) {
  return (
    <div
      role="progressbar"
      aria-label="Tiến độ"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={fraction === null ? undefined : Math.round(fraction * 100)}
      className="mt-2 h-2 w-full overflow-hidden rounded-full bg-paper-2"
    >
      <div
        className={`h-full w-full origin-left rounded-full bg-ink ${fraction === null ? "animate-pulse" : ""}`}
        style={{ transform: `scaleX(${fraction ?? 1})` }}
      />
    </div>
  );
}
