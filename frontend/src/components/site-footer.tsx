import Link from "next/link";
import { Clock, Mail, MapPin, Phone } from "lucide-react";
import { SITE } from "@/lib/site";
import { Logo } from "./logo";

const SERVICES = [
  { href: "/books", label: "Tra cứu danh mục sách" },
  { href: "/my/loans", label: "Sách đang mượn và gia hạn" },
  { href: "/my/fines", label: "Tra cứu tiền phạt" },
  { href: "/quy-dinh", label: "Quy định mượn trả" },
];

export function SiteFooter() {
  const linkClass = "inline-flex min-h-10 items-center text-ink-soft transition-colors hover:text-primary";
  return (
    <footer className="mt-24 px-3 pb-3 print:hidden sm:px-4">
      <div className="mx-auto max-w-6xl overflow-hidden rounded-[1.75rem] bg-ink text-white">
        <div className="grid gap-10 px-6 py-12 sm:px-10 md:grid-cols-[1.4fr_1fr_1fr]">
          <section>
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white">
                <Logo size={34} />
              </span>
              <div className="leading-tight">
                <h2 className="text-lg font-bold">{SITE.shortName}</h2>
                <p className="text-sm text-white/70">{SITE.university}</p>
              </div>
            </div>
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-white/75">{SITE.description}</p>
          </section>

          <section>
            <h2 className="text-base font-semibold">Liên hệ</h2>
            <ul className="mt-4 space-y-3 text-sm text-white/80">
              <li className="flex gap-3">
                <MapPin size={16} className="mt-0.5 shrink-0 text-white/60" aria-hidden="true" />
                <span>{SITE.address}</span>
              </li>
              <li className="flex gap-3">
                <Clock size={16} className="mt-0.5 shrink-0 text-white/60" aria-hidden="true" />
                <span>{SITE.openingHours}</span>
              </li>
              <li className="flex gap-3">
                <Mail size={16} className="mt-0.5 shrink-0 text-white/60" aria-hidden="true" />
                <a href={`mailto:${SITE.email}`} className="inline-flex min-h-6 items-center hover:text-white hover:underline">
                  {SITE.email}
                </a>
              </li>
              <li className="flex gap-3">
                <Phone size={16} className="mt-0.5 shrink-0 text-white/60" aria-hidden="true" />
                <a href={`tel:${SITE.phone.replace(/\s/g, "")}`} className="inline-flex min-h-6 items-center hover:text-white hover:underline">
                  {SITE.phone}
                </a>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold">Dịch vụ</h2>
            <ul className="mt-3 text-sm">
              {SERVICES.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className={`${linkClass} !text-white/80 hover:!text-white`}>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="border-t border-white/10 px-6 py-5 text-xs text-white/60 sm:px-10">
          © {new Date().getFullYear()} {SITE.university}. Dữ liệu sách mẫu lấy từ bộ goodbooks-10k, giấy phép CC BY-SA 4.0.
        </div>
      </div>
    </footer>
  );
}
