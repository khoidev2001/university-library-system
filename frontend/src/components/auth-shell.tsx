import { BellRing, BookOpenCheck, CalendarClock, Sparkles } from "lucide-react";
import { Logo } from "./logo";
import { SITE } from "@/lib/site";
import "./ux-motion.css";

const PANEL = {
  welcome: {
    headline: "Mượn sách nhanh hơn, trả đúng hạn hơn.",
    points: [
      { icon: CalendarClock, text: "Gia hạn trực tuyến, không cần xếp hàng ở quầy" },
      { icon: BellRing, text: "Nhắc hạn trả qua email và ngay trên web" },
      { icon: Sparkles, text: "Gợi ý sách theo những gì bạn đã đọc" },
    ],
  },
  join: {
    headline: "Một tài khoản cho cả kho sách của trường.",
    points: [
      { icon: BookOpenCheck, text: "Tra cứu và xem sách còn trên kệ trước khi đến" },
      { icon: CalendarClock, text: "Đặt trước cuốn đang có người mượn" },
      { icon: Sparkles, text: "Nhận gợi ý phù hợp với chuyên ngành" },
    ],
  },
  recover: {
    headline: "Lấy lại tài khoản chỉ trong vài phút.",
    points: [
      { icon: BellRing, text: "Liên kết đặt lại gửi thẳng vào email của bạn" },
      { icon: CalendarClock, text: "Liên kết có hiệu lực 1 giờ và dùng được một lần" },
      { icon: BookOpenCheck, text: "Không nhận được thư? Thủ thư tại quầy cấp mật khẩu tạm" },
    ],
  },
} as const;

/** Tấm bìa sách trang trí: chỉ là hình khối, không phải ảnh thật. */
function BookCover({ className, spine, lines }: { className: string; spine: string; lines: string }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl shadow-[0_18px_40px_-14px_rgb(21_26_51/0.55)] ${className}`}>
      <div className={`absolute inset-y-0 left-0 w-3.5 ${spine}`} />
      <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/35 to-transparent" />
      <div className="absolute bottom-5 left-7 right-5 space-y-2">
        <div className={`h-2 w-4/5 rounded-full ${lines}`} />
        <div className={`h-2 w-3/5 rounded-full ${lines} opacity-60`} />
      </div>
    </div>
  );
}

/**
 * Khung hai nửa cho các trang xác thực: bên trái là bảng thương hiệu có hình động,
 * bên phải là thẻ biểu mẫu. Màn hình hẹp chỉ còn một cột sạch.
 */
export function AuthShell({
  title,
  description,
  variant = "welcome",
  footer,
  children,
}: {
  title: string;
  description?: React.ReactNode;
  variant?: keyof typeof PANEL;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  const panel = PANEL[variant];
  return (
    <div className="bg-aurora">
      <div className="mx-auto grid max-w-6xl items-stretch gap-6 px-4 py-6 sm:px-6 sm:py-10 lg:min-h-[44rem] lg:grid-cols-[1.08fr_1fr] lg:py-12">
        <aside
          aria-label={`Giới thiệu ${SITE.name}`}
          className="relative hidden overflow-hidden rounded-[2rem] bg-[linear-gradient(150deg,#312e81_0%,#4338ca_48%,#5b4ef0_100%)] p-10 text-white lg:flex lg:flex-col"
        >
          {/* Lưới chấm và quầng sáng: ảnh nền tĩnh và hai khối trôi chậm, chỉ transform */}
          <div
            aria-hidden="true"
            className="absolute inset-0 opacity-70 [background-image:radial-gradient(rgb(255_255_255/0.16)_1px,transparent_1px)] [background-size:24px_24px] [mask-image:linear-gradient(to_bottom,black,transparent_75%)]"
          />
          <div
            aria-hidden="true"
            className="anim-blob absolute -right-24 -top-28 h-96 w-96 rounded-full bg-[radial-gradient(circle,rgb(20_184_166/0.55),transparent_65%)]"
          />
          <div
            aria-hidden="true"
            className="anim-blob absolute -bottom-32 -left-28 h-[26rem] w-[26rem] rounded-full bg-[radial-gradient(circle,rgb(167_139_250/0.5),transparent_65%)] [animation-delay:-7s]"
          />

          <div className="relative flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white shadow-[0_8px_20px_-8px_rgb(0_0_0/0.4)]">
              <Logo size={30} />
            </span>
            <span className="leading-tight">
              <span className="block text-lg font-bold tracking-tight">{SITE.shortName}</span>
              <span className="block text-sm text-white/85">Đại học Xây dựng Miền Trung</span>
            </span>
          </div>

          <div className="relative mt-10 max-w-md">
            <p className="text-[2rem] font-bold leading-[1.15] tracking-tight text-balance">{panel.headline}</p>
            <ul className="mt-6 space-y-3.5">
              {panel.points.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-start gap-3 text-[0.9375rem] leading-snug">
                  <span className="mt-px grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/15">
                    <Icon size={15} aria-hidden="true" />
                  </span>
                  {text}
                </li>
              ))}
            </ul>
          </div>

          {/* Hình động trang trí: ba bìa sách trôi nhẹ và một thẻ nhắc hạn */}
          <div aria-hidden="true" className="relative mt-auto h-64 select-none">
            <svg className="absolute inset-0 h-full w-full" viewBox="0 0 520 256" fill="none" preserveAspectRatio="none">
              <path
                d="M0 170 C 90 40, 210 10, 310 80 S 470 200, 520 70"
                stroke="white"
                strokeOpacity="0.4"
                strokeWidth="2"
                strokeLinecap="round"
                className="anim-draw"
                style={{ ["--len" as string]: 620 }}
              />
            </svg>
            <div className="anim-float absolute bottom-3 left-[6%]">
              <div className="-rotate-[9deg]">
                <BookCover className="h-44 w-32 bg-white" spine="bg-primary" lines="bg-primary/40" />
              </div>
            </div>
            <div className="anim-float-rev absolute bottom-8 left-[30%]">
              <div className="rotate-[3deg]">
                <BookCover className="h-52 w-36 bg-mint" spine="bg-teal-800" lines="bg-white/70" />
              </div>
            </div>
            <div className="anim-float absolute bottom-2 left-[58%] [animation-delay:-3s]">
              <div className="rotate-[9deg]">
                <BookCover className="h-40 w-28 bg-amber-300" spine="bg-amber-600" lines="bg-amber-800/40" />
              </div>
            </div>
            <div className="anim-float-rev absolute right-0 top-2 [animation-delay:-2s]">
              <div className="w-48 rounded-2xl bg-white p-3.5 text-ink shadow-[0_16px_36px_-12px_rgb(21_26_51/0.5)]">
                <p className="flex items-center gap-2 text-xs font-semibold text-ink-soft">
                  <span className="grid h-6 w-6 place-items-center rounded-lg bg-primary-soft text-primary">
                    <CalendarClock size={13} />
                  </span>
                  Hạn trả còn 5 ngày
                </p>
                <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-paper-2">
                  <div className="h-full w-2/3 rounded-full bg-gradient-to-r from-primary to-mint" />
                </div>
              </div>
            </div>
          </div>
        </aside>

        <section className="flex items-center justify-center">
          <div className="anim-rise w-full max-w-[28rem] rounded-[1.75rem] border border-line bg-white p-6 shadow-[var(--shadow-card)] sm:p-9">
            <div className="flex items-center gap-2.5 lg:hidden">
              <Logo size={30} />
              <span className="text-sm font-bold">{SITE.shortName}</span>
            </div>
            <h1 className="mt-5 text-[1.75rem] font-bold leading-tight tracking-tight lg:mt-0">{title}</h1>
            {description && <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-soft">{description}</p>}
            <div className="mt-7">{children}</div>
            {footer && (
              <div className="mt-7 flex flex-wrap items-center justify-center gap-x-1.5 border-t border-line pt-5 text-sm text-ink-soft">
                {footer}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

/** Liên kết nhấn màu primary dùng trong các biểu mẫu xác thực; vùng bấm cao 40px. */
export const authLinkClass =
  "inline-flex min-h-10 items-center rounded-lg px-1 font-semibold text-primary hover:text-primary-hover hover:underline";
