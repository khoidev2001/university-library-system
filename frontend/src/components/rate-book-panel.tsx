"use client";

import { Star } from "lucide-react";
import { useState } from "react";
import { ApiError, apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Alert } from "./ui";

const SCORE_WORDS = ["", "Chưa hay", "Tạm được", "Khá hay", "Hay", "Rất hay"];

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

  const shown = hover || score;

  return (
    <section
      className="mt-8 rounded-[1.5rem] border border-line bg-white p-5 shadow-[var(--shadow-card)] sm:p-6"
      aria-labelledby="tieu-de-danh-gia"
    >
      <h2 id="tieu-de-danh-gia" className="text-xl font-bold">
        Đánh giá cuốn này
      </h2>
      <p className="mt-1 text-sm leading-relaxed text-ink-soft">
        Bạn chấm điểm được sau khi đã mượn và trả cuốn sách. Điểm của bạn giúp gợi ý sát hơn.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="-ml-1 flex items-center" role="group" aria-label="Chọn số sao">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              disabled={saving}
              onClick={() => submit(value)}
              onMouseEnter={() => setHover(value)}
              onMouseLeave={() => setHover(0)}
              onFocus={() => setHover(value)}
              onBlur={() => setHover(0)}
              aria-label={`${value} sao`}
              className="grid h-11 w-11 place-items-center rounded-xl transition-transform duration-150 hover:scale-110 active:scale-95 disabled:opacity-50"
            >
              <Star
                size={28}
                className={`transition-colors ${value <= shown ? "fill-[#f59e0b] text-[#d97706]" : "text-[#c3c8de]"}`}
                aria-hidden="true"
              />
            </button>
          ))}
        </div>
        <span className="min-h-5 text-sm font-semibold text-ink-soft" aria-hidden="true">
          {SCORE_WORDS[shown]}
        </span>
      </div>
      {status && (
        <div className="mt-3">
          <Alert tone={status.tone}>{status.text}</Alert>
        </div>
      )}
    </section>
  );
}
