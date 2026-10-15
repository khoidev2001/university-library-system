import { API_BASE, ApiError, UNAUTHORIZED_EVENT, type ApiErrorBody } from "./api";

export interface DownloadResult {
  filename: string;
  bytes: number;
  /** Số dòng khớp bộ lọc (X-Total-Count) nếu máy chủ báo. */
  total: number | null;
  /** File bị cắt vì vượt trần số dòng của một lần xuất. */
  truncated: boolean;
}

export interface DownloadOptions {
  token: string | null;
  signal?: AbortSignal;
  /** Gọi khi có thêm dữ liệu về (đã giới hạn tần suất), bytes là số byte đã nhận. */
  onProgress?: (bytes: number) => void;
}

/** Lấy tên file từ Content-Disposition, ưu tiên filename* (UTF-8, có dấu). */
export function filenameFromDisposition(header: string | null, fallback: string): string {
  if (!header) return fallback;
  const star = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(header);
  if (star) {
    try {
      return decodeURIComponent(star[1].trim());
    } catch {
      /* rơi xuống bản ASCII */
    }
  }
  const plain = /filename\s*=\s*"([^"]+)"/i.exec(header) ?? /filename\s*=\s*([^;]+)/i.exec(header);
  return plain ? plain[1].trim() : fallback;
}

/** Lưu Blob thành file qua thẻ <a download>; tự giải phóng URL sau khi trình duyệt đã nhận. */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Chưa thu hồi ngay: một số trình duyệt cần thêm một nhịp để bắt đầu lưu
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * Tải file kèm Bearer token (thẻ <a> thường không gửi được header). Đọc theo từng khúc để báo tiến độ
 * và để giao diện không bị đứng khi file lớn; lỗi JSON của máy chủ được đổi thành ApiError.
 */
export async function downloadFile(path: string, options: DownloadOptions): Promise<DownloadResult> {
  const { token, signal, onProgress } = options;
  const response = await fetch(`${API_BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    signal,
  });

  if (!response.ok) {
    if (response.status === 401 && token) window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    let body: ApiErrorBody | null = null;
    try {
      body = (await response.json()) as ApiErrorBody;
    } catch {
      /* không phải JSON */
    }
    const message = Array.isArray(body?.message) ? body.message.join(". ") : body?.message;
    throw new ApiError(response.status, body?.error ?? "UNKNOWN", message ?? "Không tải được file.");
  }

  const chunks: BlobPart[] = [];
  let bytes = 0;
  let lastReport = 0;
  if (response.body) {
    const reader = response.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value as BlobPart);
      bytes += value.byteLength;
      const now = performance.now();
      if (onProgress && now - lastReport > 200) {
        lastReport = now;
        onProgress(bytes);
      }
    }
  } else {
    const blob = await response.blob();
    chunks.push(blob);
    bytes = blob.size;
  }
  onProgress?.(bytes);

  const type = response.headers.get("Content-Type") ?? "application/octet-stream";
  const filename = filenameFromDisposition(response.headers.get("Content-Disposition"), "tai-xuong");
  saveBlob(new Blob(chunks, { type }), filename);

  const total = Number(response.headers.get("X-Total-Count"));
  return {
    filename,
    bytes,
    total: Number.isFinite(total) && response.headers.has("X-Total-Count") ? total : null,
    truncated: response.headers.get("X-Export-Truncated") === "true",
  };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}
