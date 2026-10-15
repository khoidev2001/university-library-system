"use client";

import { UserRound } from "lucide-react";
import { formatDate } from "@/lib/api";
import { SITE } from "@/lib/site";
import type { MemberType } from "@/lib/types";
import { Code128Svg, QrSvg } from "./barcode-svg";

export interface CardReader {
  id: number;
  fullName: string;
  memberCode: string;
  memberType: MemberType | null;
  createdAt?: string;
}

/** Kích thước thẻ chuẩn ISO/IEC 7810 ID-1. */
export const CARD_WIDTH_MM = 85.6;
export const CARD_HEIGHT_MM = 54;

const TYPE_LABEL: Record<MemberType, string> = { STUDENT: "Sinh viên", LECTURER: "Giảng viên" };

/**
 * Mặt trước thẻ bạn đọc 85,6 × 54 mm. Mọi kích thước tính bằng mm nên in ra đúng cỡ thẻ thật.
 * Mã vạch Code 128 chứa mã thẻ: quầy mượn trả quét thẳng vào ô "Mã bạn đọc".
 */
export function ReaderCard({ reader }: { reader: CardReader }) {
  return (
    <article
      aria-label={`Thẻ bạn đọc ${reader.fullName}`}
      className="relative overflow-hidden rounded-[3mm] border-[0.2mm] border-dashed border-ink/30 bg-white text-ink print:border-ink/20"
      style={{ width: `${CARD_WIDTH_MM}mm`, height: `${CARD_HEIGHT_MM}mm` }}
    >
      {/* Dải tên trường */}
      <header className="flex h-[10.5mm] flex-col justify-center bg-ink px-[4mm] text-paper [print-color-adjust:exact]">
        <p className="text-[6.6pt] font-bold uppercase leading-tight tracking-[0.02em]">{SITE.university}</p>
        <p className="text-[5.4pt] leading-tight opacity-90">Thẻ bạn đọc · {SITE.shortName}</p>
      </header>

      {/* Ảnh thẻ 3x4 */}
      <div
        aria-hidden="true"
        className="absolute left-[4mm] top-[13.5mm] grid h-[22mm] w-[17mm] place-items-center border-[0.2mm] border-dashed border-ink/40 text-ink-soft"
      >
        <div className="flex flex-col items-center">
          <UserRound className="h-[8mm] w-[8mm]" strokeWidth={1.4} />
          <span className="mt-[0.8mm] text-[4.6pt]">Ảnh 3×4</span>
        </div>
      </div>

      {/* Thông tin */}
      <div className="absolute left-[23.5mm] right-[4mm] top-[13mm]">
        <p className="line-clamp-2 text-[9pt] font-bold leading-[1.15]">{reader.fullName}</p>
        <dl className="mt-[1.2mm] space-y-[0.6mm] text-[6pt] leading-tight">
          <div className="flex gap-[1.5mm]">
            <dt className="w-[11mm] shrink-0 text-ink-soft">Mã thẻ</dt>
            <dd className="font-mono text-[7.2pt] font-bold">{reader.memberCode}</dd>
          </div>
          <div className="flex gap-[1.5mm]">
            <dt className="w-[11mm] shrink-0 text-ink-soft">Đối tượng</dt>
            <dd className="font-semibold">{reader.memberType ? TYPE_LABEL[reader.memberType] : "Bạn đọc"}</dd>
          </div>
          {reader.createdAt && (
            <div className="flex gap-[1.5mm]">
              <dt className="w-[11mm] shrink-0 text-ink-soft">Cấp ngày</dt>
              <dd>{formatDate(reader.createdAt)}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* Mã vạch + QR */}
      <div className="absolute bottom-[2mm] left-[2mm] flex flex-col items-center">
        <Code128Svg value={reader.memberCode} className="h-[8.5mm] w-[56mm]" />
        <span className="mt-[0.3mm] font-mono text-[5.2pt] leading-none tracking-[0.12em]">{reader.memberCode}</span>
      </div>
      <QrSvg value={reader.memberCode} className="absolute bottom-[1.5mm] right-[2mm] h-[15.5mm] w-[15.5mm]" />
    </article>
  );
}
