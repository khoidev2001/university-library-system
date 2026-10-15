import Link from "next/link";
import { Clock, Mail, MapPin, Phone } from "lucide-react";
import { SITE } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-line bg-paper-2">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-3">
        <section>
          <h2 className="font-serif text-lg font-bold">{SITE.shortName}</h2>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-ink-soft">{SITE.description}</p>
        </section>

        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-faint">Liên hệ</h2>
          <ul className="mt-3 space-y-0.5 text-sm text-ink-soft">
            <li className="flex gap-2.5">
              <MapPin size={16} className="mt-0.5 shrink-0 text-ink-faint" aria-hidden="true" />
              <span>{SITE.address}</span>
            </li>
            <li className="flex gap-2.5">
              <Clock size={16} className="mt-0.5 shrink-0 text-ink-faint" aria-hidden="true" />
              <span>{SITE.openingHours}</span>
            </li>
            <li className="flex gap-2.5">
              <Mail size={16} className="mt-0.5 shrink-0 text-ink-faint" aria-hidden="true" />
              <a href={`mailto:${SITE.email}`} className="inline-block py-1.5 hover:text-ink hover:underline">
                {SITE.email}
              </a>
            </li>
            <li className="flex gap-2.5">
              <Phone size={16} className="mt-0.5 shrink-0 text-ink-faint" aria-hidden="true" />
              <a href={`tel:${SITE.phone.replace(/\s/g, "")}`} className="inline-block py-1.5 hover:text-ink hover:underline">
                {SITE.phone}
              </a>
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-faint">Dịch vụ</h2>
          <ul className="mt-3 space-y-0.5 text-sm text-ink-soft">
            <li>
              <Link href="/books" className="inline-block py-1.5 hover:text-ink hover:underline">
                Tra cứu danh mục sách
              </Link>
            </li>
            <li>
              <Link href="/my/loans" className="inline-block py-1.5 hover:text-ink hover:underline">
                Sách đang mượn và gia hạn
              </Link>
            </li>
            <li>
              <Link href="/my/fines" className="inline-block py-1.5 hover:text-ink hover:underline">
                Tra cứu tiền phạt
              </Link>
            </li>
            <li>
              <Link href="/quy-dinh" className="inline-block py-1.5 hover:text-ink hover:underline">
                Quy định mượn trả
              </Link>
            </li>
          </ul>
        </section>
      </div>

      <div className="border-t border-line">
        <p className="mx-auto max-w-6xl px-4 py-5 text-xs text-ink-faint sm:px-6">
          © {new Date().getFullYear()} {SITE.university}. Dữ liệu sách mẫu lấy từ bộ goodbooks-10k, giấy phép CC BY-SA 4.0.
        </p>
      </div>
    </footer>
  );
}
