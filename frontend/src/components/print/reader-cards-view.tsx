"use client";

import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Page, User } from "@/lib/types";
import { Alert, Skeleton } from "../ui";
import { PaperSheet, PrintFrame } from "./print-frame";
import { CARD_HEIGHT_MM, CARD_WIDTH_MM, ReaderCard, type CardReader } from "./reader-card";

type Paper = "a4" | "card";

const A4_W = 210;
const A4_H = 297;
const COLS = 2;
const ROWS = 5;
const GAP_X = 4;
const GAP_Y = 2;
const PER_SHEET = COLS * ROWS;
const MAX_CARDS = 300;

const PAPERS: { value: Paper; label: string; hint: string }[] = [
  { value: "a4", label: "Giấy A4 (10 thẻ/tờ)", hint: "In ra giấy rồi cắt, hoặc in lên giấy decal dán lên thẻ trắng." },
  { value: "card", label: "Máy in thẻ (1 thẻ/trang)", hint: "Mỗi thẻ một trang cỡ 85,6 × 54 mm cho máy in thẻ nhựa." },
];

/** Gom tham số: ids cụ thể, hoặc bộ lọc danh sách bạn đọc (q, isActive, memberType). */
async function loadReaders(params: URLSearchParams, token: string | null): Promise<User[]> {
  const ids = (params.get("ids") ?? "")
    .split(",")
    .map((v) => Number(v))
    .filter((v) => Number.isInteger(v) && v > 0)
    .slice(0, MAX_CARDS);
  if (ids.length) {
    const found = await Promise.all(ids.map((id) => apiFetch<User>(`/users/${id}`, { token }).catch(() => null)));
    return found.filter((u): u is User => u !== null);
  }
  const base = new URLSearchParams({ role: "READER", limit: "100" });
  for (const key of ["q", "isActive"]) {
    const value = params.get(key);
    if (value) base.set(key, value);
  }
  const out: User[] = [];
  for (let page = 1; out.length < MAX_CARDS; page++) {
    base.set("page", String(page));
    const result = await apiFetch<Page<User>>(`/users?${base.toString()}`, { token });
    out.push(...result.items);
    if (out.length >= result.total || result.items.length === 0) break;
  }
  return out.slice(0, MAX_CARDS);
}

export function ReaderCardsView({ readerId }: { readerId?: number }) {
  const { token } = useAuth();
  const search = useSearchParams();
  const [paper, setPaper] = useState<Paper>("a4");

  const params = useMemo(() => {
    const p = new URLSearchParams(search.toString());
    if (readerId) p.set("ids", String(readerId));
    return p;
  }, [search, readerId]);

  const readers = useQuery({
    queryKey: ["print-readers", params.toString()],
    queryFn: () => loadReaders(params, token),
    enabled: !!token,
  });

  // Chỉ in được cho bạn đọc có mã thẻ
  const cards: CardReader[] = (readers.data ?? [])
    .filter((u): u is User & { memberCode: string } => !!u.memberCode)
    .map((u) => ({
      id: u.id,
      fullName: u.fullName,
      memberCode: u.memberCode,
      memberType: u.memberType,
      createdAt: u.createdAt,
    }));
  const skipped = (readers.data?.length ?? 0) - cards.length;
  const single = readerId !== undefined;

  const sheets: CardReader[][] = [];
  if (paper === "a4") for (let i = 0; i < cards.length; i += PER_SHEET) sheets.push(cards.slice(i, i + PER_SHEET));
  else for (const card of cards) sheets.push([card]);

  const sheetW = paper === "a4" ? A4_W : CARD_WIDTH_MM;
  const sheetH = paper === "a4" ? A4_H : CARD_HEIGHT_MM;
  const left = (A4_W - (COLS * CARD_WIDTH_MM + (COLS - 1) * GAP_X)) / 2;
  const top = (A4_H - (ROWS * CARD_HEIGHT_MM + (ROWS - 1) * GAP_Y)) / 2;

  return (
    <PrintFrame
      title={single ? "In thẻ bạn đọc" : "In thẻ bạn đọc hàng loạt"}
      description="Thẻ cỡ 85,6 × 54 mm (chuẩn thẻ ngân hàng) với mã vạch Code 128 và mã QR của mã thẻ; quầy mượn trả quét được trực tiếp."
      backHref="/librarian/readers"
      pageSize={paper === "a4" ? "A4" : `${CARD_WIDTH_MM}mm ${CARD_HEIGHT_MM}mm`}
      sheetWidthMm={sheetW}
      printDisabled={cards.length === 0}
      summary={
        readers.isLoading
          ? "Đang tải danh sách bạn đọc..."
          : `${cards.length} thẻ, ${sheets.length} ${paper === "a4" ? "tờ A4" : "trang"}`
      }
      options={
        <fieldset>
          <legend className="text-sm font-semibold">Khổ giấy</legend>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {PAPERS.map((item) => (
              <label
                key={item.value}
                className={`flex min-h-12 cursor-pointer items-start gap-3 rounded-2xl border-2 p-4 text-sm transition-colors ${
                  paper === item.value ? "border-primary bg-primary-soft/60" : "border-line hover:bg-paper-2"
                }`}
              >
                <input
                  type="radio"
                  name="paper"
                  value={item.value}
                  checked={paper === item.value}
                  onChange={() => setPaper(item.value)}
                  className="mt-0.5 h-5 w-5 accent-[var(--color-primary)]"
                />
                <span>
                  <span className="block font-semibold">{item.label}</span>
                  <span className="block text-xs text-ink-soft">{item.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      }
    >
      {readers.isLoading ? (
        <div role="status" aria-label="Đang tải bạn đọc" className="p-4 print:hidden">
          <Skeleton className="h-64 w-full" />
        </div>
      ) : readers.isError ? (
        <div className="p-4 print:hidden">
          <Alert tone="bad">Không tải được danh sách bạn đọc. Vui lòng thử lại.</Alert>
        </div>
      ) : cards.length === 0 ? (
        <div className="p-4 print:hidden">
          <Alert tone="info">Không có bạn đọc nào có mã thẻ để in.</Alert>
        </div>
      ) : (
        <>
          {skipped > 0 && (
            <div className="mb-4 print:hidden">
              <Alert tone="info">{skipped} tài khoản không có mã thẻ nên bị bỏ qua.</Alert>
            </div>
          )}
          {sheets.map((group, s) => (
            <PaperSheet key={s} widthMm={sheetW} heightMm={sheetH} last={s === sheets.length - 1}>
              {paper === "a4" ? (
                group.map((card, i) => (
                  <div
                    key={card.id}
                    className="absolute"
                    style={{
                      left: `${left + (i % COLS) * (CARD_WIDTH_MM + GAP_X)}mm`,
                      top: `${top + Math.floor(i / COLS) * (CARD_HEIGHT_MM + GAP_Y)}mm`,
                    }}
                  >
                    <ReaderCard reader={card} />
                  </div>
                ))
              ) : (
                <ReaderCard reader={group[0]} />
              )}
            </PaperSheet>
          ))}
        </>
      )}
    </PrintFrame>
  );
}

