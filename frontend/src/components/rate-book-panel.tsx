"use client";

import { Star } from "lucide-react";
import { useState } from "react";
import { ApiError, apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Alert } from "./ui";

/** Bạn đọc chấm điểm sách đã mượn và trả (US17). Ẩn với người chưa đăng nhập. */
export function RateBookPanel({ bookId }: { bookId: number }) {
  const { token, can } = useAuth();
  const [hover, setHover] = useState(0);
  const [score, setScore] = useState(0);
  const [status, setStatus] = useState<{ tone: "good" | "bad"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  if (!token || !can("READER")) return null;

  async function submit(value: number) {
    setSaving(true);
    setStatus(null);
    try {
      await apiFetch(`/books/${bookId}/ratings`, { method: "POST", body: { score: value }, token });
      setScore(value);
      setStatus({ tone: "good", text: `Đã ghi nhận ${value} sao. Cảm ơn bạn.` });
    } catch (error) {
      setStatus({
        tone: "bad",
        text: error instanceof ApiError ? error.friendlyMessage : "Không gửi được đánh giá.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mt-8 rounded-xl border border-line bg-white p-5" aria-labelledby="tieu-de-danh-gia">
      <h2 id="tieu-de-danh-gia" className="font-serif text-lg font-bold">
        Đánh giá cuốn này
      </h2>
      <p className="mt-1 text-sm text-ink-soft">
        Bạn chấm điểm được sau khi đã mượn và trả cuốn sách. Điểm của bạn giúp gợi ý sát hơn.
      </p>
      <div className="mt-3 flex items-center gap-1" role="group" aria-label="Chọn số sao">
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            type="button"
            disabled={saving}
            onClick={() => submit(value)}
            onMouseEnter={() => setHover(value)}
            onMouseLeave={() => setHover(0)}
            aria-label={`${value} sao`}
            className="rounded p-1 transition-transform hover:scale-110 disabled:opacity-50"
          >
            <Star
              size={26}
              className={value <= (hover || score) ? "fill-amber text-amber" : "text-line"}
              aria-hidden="true"
            />
          </button>
        ))}
      </div>
      {status && (
        <div className="mt-3">
          <Alert tone={status.tone}>{status.text}</Alert>
        </div>
      )}
    </section>
  );
}
