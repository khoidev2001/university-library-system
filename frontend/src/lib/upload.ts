import { API_BASE, ApiError, UNAUTHORIZED_EVENT, type ApiErrorBody } from "./api";

export interface UploadOptions {
  token: string | null;
  signal?: AbortSignal;
  /** 0..1, theo số byte đã gửi lên (fetch chưa có sự kiện này nên dùng XMLHttpRequest). */
  onUploadProgress?: (fraction: number) => void;
}

/** Gửi một file multipart (trường "file") và đọc JSON trả về. Lỗi máy chủ thành ApiError. */
export function uploadFile<T>(path: string, file: File, options: UploadOptions): Promise<T> {
  const { token, signal, onUploadProgress } = options;
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE}${path}`);
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.responseType = "text";
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onUploadProgress?.(event.loaded / event.total);
    };
    xhr.onerror = () => reject(new ApiError(0, "NETWORK", "Không kết nối được máy chủ, vui lòng thử lại."));
    xhr.onabort = () => reject(new DOMException("Đã huỷ", "AbortError"));
    xhr.onload = () => {
      let payload: unknown = null;
      try {
        payload = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      } catch {
        /* thân không phải JSON (ví dụ trang lỗi của proxy) */
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(payload as T);
        return;
      }
      if (xhr.status === 401 && token) window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
      const body = payload as ApiErrorBody | null;
      const message = Array.isArray(body?.message) ? body.message.join(". ") : body?.message;
      const tooLarge = xhr.status === 413;
      reject(
        new ApiError(
          xhr.status,
          body?.error ?? (tooLarge ? "PAYLOAD_TOO_LARGE" : "UNKNOWN"),
          message ?? (tooLarge ? "File quá lớn (tối đa 5 MB)." : "Không nhập được file, vui lòng thử lại."),
        ),
      );
    };
    if (signal) {
      if (signal.aborted) {
        reject(new DOMException("Đã huỷ", "AbortError"));
        return;
      }
      signal.addEventListener("abort", () => xhr.abort(), { once: true });
    }
    const form = new FormData();
    form.append("file", file);
    xhr.send(form);
  });
}
