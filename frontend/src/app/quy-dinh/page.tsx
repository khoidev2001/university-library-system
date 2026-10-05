import type { Metadata } from "next";
import Link from "next/link";
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

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />

      <h1 className="font-serif text-3xl font-bold">Quy định mượn trả sách</h1>
      <p className="mt-3 text-sm leading-relaxed text-ink-soft">
        Áp dụng cho toàn bộ bạn đọc của {SITE.university}. Mọi thao tác mượn và trả thực hiện tại quầy thủ thư
        trong giờ mở cửa: {SITE.openingHours}.
      </p>

      <section className="mt-10" aria-labelledby="muc-han-muc">
        <h2 id="muc-han-muc" className="font-serif text-xl font-bold">
          Hạn mức theo đối tượng
        </h2>
        <div className="mt-4 overflow-x-auto rounded-xl border border-line bg-white">
          <table className="w-full min-w-[520px] text-sm">
            <caption className="sr-only">Hạn mức mượn sách theo đối tượng bạn đọc</caption>
            <thead className="border-b border-line bg-paper-2 text-left">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">Đối tượng</th>
                <th scope="col" className="px-4 py-3 font-semibold">Số cuốn</th>
                <th scope="col" className="px-4 py-3 font-semibold">Thời hạn</th>
                <th scope="col" className="px-4 py-3 font-semibold">Gia hạn</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              <tr>
                <th scope="row" className="px-4 py-3 text-left font-medium">Sinh viên</th>
                <td className="px-4 py-3">{student?.maxBooks ?? 3} cuốn</td>
                <td className="px-4 py-3">{student?.loanDays ?? 14} ngày</td>
                <td className="px-4 py-3">
                  {student?.renewLimit ?? 1} lần, thêm {student?.renewExtraDays ?? 7} ngày
                </td>
              </tr>
              <tr>
                <th scope="row" className="px-4 py-3 text-left font-medium">Giảng viên</th>
                <td className="px-4 py-3">{lecturer?.maxBooks ?? 5} cuốn</td>
                <td className="px-4 py-3">{lecturer?.loanDays ?? 30} ngày</td>
                <td className="px-4 py-3">
                  {lecturer?.renewLimit ?? 1} lần, thêm {lecturer?.renewExtraDays ?? 14} ngày
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10" aria-labelledby="muc-dieu-kien">
        <h2 id="muc-dieu-kien" className="font-serif text-xl font-bold">
          Điều kiện được mượn
        </h2>
        <ul className="mt-4 space-y-2.5 text-sm leading-relaxed text-ink-soft">
          <li>Thẻ bạn đọc đang hoạt động, chưa bị khoá.</li>
          <li>Chưa mượn vượt số cuốn tối đa của đối tượng.</li>
          <li>Không đang giữ cuốn nào quá hạn.</li>
          <li>Không còn khoản phạt nào chưa thanh toán.</li>
          <li>Bản sao cần mượn đang ở trạng thái sẵn sàng trên kệ.</li>
        </ul>
      </section>

      <section className="mt-10" aria-labelledby="muc-phat">
        <h2 id="muc-phat" className="font-serif text-xl font-bold">
          Phạt trả trễ và mất sách
        </h2>
        <p className="mt-4 text-sm leading-relaxed text-ink-soft">
          Phạt trả trễ là {(student?.finePerDay ?? 5000).toLocaleString("vi-VN")} đồng cho mỗi ngày lịch trễ.
          Trả trong chính ngày hết hạn, dù muộn giờ, không bị tính phạt. Sang ngày hôm sau tính một ngày.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
          Khi làm mất sách, bạn đọc bồi thường theo giá bìa cộng với tiền phạt trễ tính đến ngày báo mất.
          Thủ thư lập biên bản và ghi nhận ngay trên hệ thống.
        </p>
      </section>

      <section className="mt-10" aria-labelledby="muc-gia-han">
        <h2 id="muc-gia-han" className="font-serif text-xl font-bold">
          Gia hạn trực tuyến
        </h2>
        <p className="mt-4 text-sm leading-relaxed text-ink-soft">
          Bạn đọc tự gia hạn trong mục{" "}
          <Link href="/my/loans" className="font-medium text-brand hover:underline">
            Sách của tôi
          </Link>
          . Hệ thống từ chối gia hạn khi phiếu đã quá hạn, đã hết lượt gia hạn, hoặc tài khoản còn nợ phạt.
        </p>
      </section>
    </div>
  );
}
