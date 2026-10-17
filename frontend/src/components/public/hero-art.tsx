import { Check, RefreshCw } from "lucide-react";
import { BookCover } from "./cover";
import "./public.css";

export interface HeroBook {
  id: number;
  title: string;
  coverUrl: string | null;
  copiesAvailable: number;
  copiesTotal: number;
}

/**
 * Hình minh hoạ phần giới thiệu: ba bìa sách thật nổi nhẹ trên nền quầng sáng, kèm hai thẻ thông tin.
 * Thuần trang trí (aria-hidden); mọi chuyển động chỉ là transform trên lớp riêng.
 */
export function HeroArt({ books }: { books: HeroBook[] }) {
  const [main, left, right] = books;
  if (!main) return null;

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[21rem] sm:max-w-[26rem] select-none" aria-hidden="true">
      <div className="anim-blob absolute inset-[4%] rounded-full bg-primary-soft" />
      <div className="anim-blob absolute -right-[2%] top-[58%] h-[34%] w-[34%] rounded-full bg-mint-soft" style={{ animationDelay: "-6s" }} />

      <svg viewBox="0 0 400 400" className="absolute inset-0 h-full w-full text-primary/35" fill="none">
        <circle
          cx="200"
          cy="200"
          r="176"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeDasharray="3 9"
          strokeLinecap="round"
          pathLength={100}
          className="anim-draw"
          style={{ "--len": 100 } as React.CSSProperties}
        />
      </svg>

      {left && (
        <div className="absolute left-[2%] top-[27%] w-[33%] anim-float-rev" style={{ animationDelay: "-2s" }}>
          <div className="aspect-[2/3] -rotate-[9deg] overflow-hidden rounded-xl bg-paper-2 shadow-[0_24px_40px_-18px_rgb(21_26_51/0.55)]">
            <BookCover title={left.title} coverUrl={left.coverUrl} hiRes />
          </div>
        </div>
      )}
      {right && (
        <div className="absolute right-[3%] top-[21%] w-[33%] anim-float-rev" style={{ animationDelay: "-4s" }}>
          <div className="aspect-[2/3] rotate-[8deg] overflow-hidden rounded-xl bg-paper-2 shadow-[0_24px_40px_-18px_rgb(21_26_51/0.55)]">
            <BookCover title={right.title} coverUrl={right.coverUrl} hiRes />
          </div>
        </div>
      )}
      <div className="absolute left-[30%] top-[12%] z-10 w-[40%] anim-float">
        <div className="aspect-[2/3] overflow-hidden rounded-2xl bg-paper-2 shadow-[0_34px_50px_-20px_rgb(21_26_51/0.6)] ring-4 ring-white">
          <BookCover title={main.title} coverUrl={main.coverUrl} hiRes priority />
        </div>
      </div>

      <div className="absolute bottom-[8%] left-0 z-20 anim-float" style={{ animationDelay: "-3s" }}>
        <div className="flex items-center gap-2.5 rounded-2xl bg-white py-2.5 pl-2.5 pr-4 shadow-[var(--shadow-lift)] ring-1 ring-line">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-leaf-soft text-leaf">
            <Check size={16} strokeWidth={3} />
          </span>
          <span className="text-sm font-semibold leading-tight">
            {main.copiesAvailable > 0 ? `Còn ${main.copiesAvailable} bản` : "Đã mượn hết"}
            <span className="block text-xs font-medium text-ink-faint">trên kệ hôm nay</span>
          </span>
        </div>
      </div>
      <div className="absolute right-0 top-[3%] z-20 anim-float-rev" style={{ animationDelay: "-1s" }}>
        <div className="flex items-center gap-2.5 rounded-2xl bg-white py-2.5 pl-2.5 pr-4 shadow-[var(--shadow-lift)] ring-1 ring-line">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-primary-soft text-primary">
            <RefreshCw size={15} strokeWidth={2.5} />
          </span>
          <span className="text-sm font-semibold leading-tight">
            Gia hạn
            <span className="block text-xs font-medium text-ink-faint">ngay trên web</span>
          </span>
        </div>
      </div>
    </div>
  );
}
