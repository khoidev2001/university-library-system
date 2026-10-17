import type { Metadata } from "next";
import { BookOpenCheck, Check, Clock, GraduationCap, RefreshCw } from "lucide-react";
import { Reveal } from "@/components/motion";
import { ButtonLink } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { SITE } from "@/lib/site";
import type { LoanPolicy } from "@/lib/types";

export const revalidate = 900;

export const metadata: Metadata = {
  title: "Quy định mượn trả sách",
  description:
    "Số sách được mượn, thời hạn, điều kiện gia hạn, mức phạt trả trễ và quy định bồi thường khi mất sách tại thư viện trường.",
  alternates: { canonical: "/quy-dinh" },
  openGraph: {
    title: "Quy định mượn trả sách",
    description: "Hạn mức, thời hạn mượn, gia hạn và mức phạt tại thư viện trường.",
  },
};

export default async function RulesPage() {
  const policies = await apiFetch<LoanPolicy[]>("/policies", { next: { revalidate: 900 } }).catch(() => []);
  const student = policies.find((policy) => policy.memberType === "STUDENT");
  const lecturer = policies.find((policy) => policy.memberType === "LECTURER");

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "Sinh viên được mượn bao nhiêu cuốn một lúc?",
        acceptedAnswer: {
          "@type": "Answer",
          text: `Sinh viên mượn tối đa ${student?.maxBooks ?? 3} cuốn cùng lúc, mỗi cuốn trong ${student?.loanDays ?? 14} ngày.`,
        },
      },
      {
        "@type": "Question",
        name: "Trả sách trễ bị phạt bao nhiêu?",
        acceptedAnswer: {
          "@type": "Answer",
          text: `Mức phạt là ${(student?.finePerDay ?? 5000).toLocaleString("vi-VN")} đồng cho mỗi ngày lịch trễ. Trả trong chính ngày hết hạn không bị phạt.`,
        },
      },
      {
        "@type": "Question",
        name: "Khi nào không gia hạn được?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Không gia hạn được khi phiếu đã quá hạn, đã dùng hết lượt gia hạn, hoặc bạn đọc còn tiền phạt chưa thanh toán.",
        },
      },
    ],
  };

  const fine = (student?.finePerDay ?? 5000).toLocaleString("vi-VN");

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />

      <section className="bg-aurora">
        <div className="mx-auto max-w-5xl px-4 pb-10 pt-10 sm:px-6 sm:pb-12 sm:pt-14">
          <h1 className="anim-rise text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl">Quy định mượn trả sách</h1>
          <p className="anim-rise-2 mt-4 max-w-2xl text-base leading-relaxed text-ink-soft sm:text-lg">
            Áp dụng cho toàn bộ bạn đọc của {SITE.university}. Mọi thao tác mượn và trả thực hiện tại quầy thủ thư
            trong giờ mở cửa.
          </p>
          <p className="anim-rise-3 mt-5 inline-flex items-center gap-2.5 rounded-full bg-white px-4 py-2.5 text-sm font-semibold shadow-[var(--shadow-card)] ring-1 ring-line">
            <Clock size={16} className="text-primary" aria-hidden="true" />
            {SITE.openingHours}
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-4 pb-4 sm:px-6">
        <section aria-labelledby="muc-han-muc">
          <Reveal>
            <h2 id="muc-han-muc" className="text-2xl font-bold">
              Hạn mức theo đối tượng
            </h2>
          </Reveal>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <Reveal>
              <Audience
                icon={<GraduationCap size={22} />}
                name="Sinh viên"
                tone="primary"
                books={student?.maxBooks ?? 3}
                days={student?.loanDays ?? 14}
                renews={student?.renewLimit ?? 1}
                extra={student?.renewExtraDays ?? 7}
              />
            </Reveal>
            <Reveal delay={80}>
              <Audience
                icon={<BookOpenCheck size={22} />}
                name="Giảng viên"
                tone="mint"
                books={lecturer?.maxBooks ?? 5}
                days={lecturer?.loanDays ?? 30}
                renews={lecturer?.renewLimit ?? 1}
                extra={lecturer?.renewExtraDays ?? 14}
              />
            </Reveal>
          </div>
        </section>

        <section className="mt-14" aria-labelledby="muc-dieu-kien">
          <Reveal>
            <h2 id="muc-dieu-kien" className="text-2xl font-bold">
              Điều kiện được mượn
            </h2>
            <p className="mt-2 text-sm text-ink-soft sm:text-base">Cần đủ cả năm điều kiện dưới đây khi tới quầy.</p>
          </Reveal>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {CONDITIONS.map((text, index) => (
              <li key={text} className="sm:[&:last-child:nth-child(odd)]:col-span-2">
                <Reveal delay={index * 50} className="h-full">
                  <div className="flex h-full items-start gap-3 rounded-2xl border border-line bg-white p-4 shadow-[var(--shadow-card)]">
                    <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-leaf-soft text-leaf" aria-hidden="true">
                      <Check size={15} strokeWidth={3} />
                    </span>
                    <span className="text-[0.9375rem] leading-relaxed">{text}</span>
                  </div>
                </Reveal>
              </li>
            ))}
          </ul>
        </section>

        <div className="mt-14 grid gap-4 md:grid-cols-5">
          <section className="md:col-span-3" aria-labelledby="muc-phat">
            <Reveal className="h-full">
              <div className="flex h-full flex-col rounded-[1.5rem] border border-line bg-white p-6 shadow-[var(--shadow-card)] sm:p-8">
                <h2 id="muc-phat" className="text-xl font-bold">
                  Phạt trả trễ và mất sách
                </h2>
                <p className="mt-5 text-5xl font-bold tracking-tight tabular-nums text-danger">
                  {fine}
                  <span className="ml-2 text-lg font-semibold tracking-normal text-ink-soft">đồng mỗi ngày trễ</span>
                </p>
                <p className="mt-4 text-[0.9375rem] leading-relaxed text-ink-soft">
                  Tính theo ngày lịch. Trả trong chính ngày hết hạn, dù muộn giờ, không bị tính phạt. Sang ngày hôm
                  sau tính một ngày.
                </p>
                <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink-soft">
                  Khi làm mất sách, bạn đọc bồi thường theo giá bìa cộng với tiền phạt trễ tính đến ngày báo mất.
                  Thủ thư lập biên bản và ghi nhận ngay trên hệ thống.
                </p>
              </div>
            </Reveal>
          </section>

          <section className="md:col-span-2" aria-labelledby="muc-gia-han">
            <Reveal delay={80} className="h-full">
              <div className="flex h-full flex-col rounded-[1.5rem] bg-ink p-6 text-white sm:p-8">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/10" aria-hidden="true">
                  <RefreshCw size={20} />
                </span>
                <h2 id="muc-gia-han" className="mt-4 text-xl font-bold">
                  Gia hạn trực tuyến
                </h2>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-white/75">
                  Bạn đọc tự gia hạn trong mục Sách của tôi. Hệ thống từ chối gia hạn khi phiếu đã quá hạn, đã hết
                  lượt gia hạn, hoặc tài khoản còn nợ phạt.
                </p>
                <div className="mt-6">
                  <ButtonLink href="/my/loans">Mở sách của tôi</ButtonLink>
                </div>
              </div>
            </Reveal>
          </section>
        </div>

        <Reveal className="mt-14">
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-[1.5rem] bg-primary-soft p-6 sm:p-8">
            <div>
              <p className="text-lg font-bold">Còn điều chưa rõ?</p>
              <p className="mt-1 text-sm text-ink-soft">
                Hỏi thủ thư tại quầy hoặc liên hệ {SITE.email}, điện thoại {SITE.phone}.
              </p>
            </div>
            <ButtonLink href="/books" variant="ghost">
              Tra cứu sách
            </ButtonLink>
          </div>
        </Reveal>
      </div>
    </>
  );
}

const CONDITIONS = [
  "Thẻ bạn đọc đang hoạt động, chưa bị khoá.",
  "Chưa mượn vượt số cuốn tối đa của đối tượng.",
  "Không đang giữ cuốn nào quá hạn.",
  "Không còn khoản phạt nào chưa thanh toán.",
  "Bản sao cần mượn đang ở trạng thái sẵn sàng trên kệ.",
];

function Audience({
  icon,
  name,
  tone,
  books,
  days,
  renews,
  extra,
}: {
  icon: React.ReactNode;
  name: string;
  tone: "primary" | "mint";
  books: number;
  days: number;
  renews: number;
  extra: number;
}) {
  const iconTone = tone === "primary" ? "bg-primary-soft text-primary" : "bg-mint-soft text-[#0f766e]";
  return (
    <div className="h-full rounded-[1.5rem] border border-line bg-white p-6 shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-3">
        <span className={`grid h-11 w-11 place-items-center rounded-2xl ${iconTone}`} aria-hidden="true">
          {icon}
        </span>
        <h3 className="text-lg font-bold">{name}</h3>
      </div>
      <dl className="mt-5 grid grid-cols-2 gap-3">
        <Stat label="Mượn cùng lúc" value={`${books} cuốn`} />
        <Stat label="Thời hạn mỗi cuốn" value={`${days} ngày`} />
        <Stat label="Số lần gia hạn" value={`${renews} lần`} />
        <Stat label="Mỗi lần thêm" value={`${extra} ngày`} />
      </dl>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-paper p-4">
      <dt className="text-xs text-ink-soft">{label}</dt>
      <dd className="mt-1 text-xl font-bold tabular-nums">{value}</dd>
    </div>
  );
}
