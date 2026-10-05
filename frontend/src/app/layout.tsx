import type { Metadata, Viewport } from "next";
import { Libre_Baskerville, Public_Sans } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Providers } from "@/components/providers";
import { SITE } from "@/lib/site";
import "./globals.css";

const display = Libre_Baskerville({
  weight: ["400", "700"],
  subsets: ["latin", "latin-ext"],
  variable: "--font-display",
  display: "swap",
});

const body = Public_Sans({
  subsets: ["latin", "latin-ext"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.name} | Tra cứu và mượn sách trực tuyến`,
    template: `%s | ${SITE.name}`,
  },
  description: SITE.description,
  keywords: [
    "thư viện đại học",
    "tra cứu sách",
    "mượn sách trực tuyến",
    "thư viện trường",
    "danh mục sách",
    SITE.university,
  ],
  authors: [{ name: SITE.university }],
  applicationName: SITE.name,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "vi_VN",
    url: SITE.url,
    siteName: SITE.name,
    title: `${SITE.name} | Tra cứu và mượn sách trực tuyến`,
    description: SITE.description,
  },
  twitter: {
    card: "summary_large_image",
    title: SITE.name,
    description: SITE.description,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
  category: "education",
};

export const viewport: Viewport = {
  themeColor: "#16243c",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Library",
    name: SITE.name,
    description: SITE.description,
    url: SITE.url,
    parentOrganization: { "@type": "CollegeOrUniversity", name: SITE.university },
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${SITE.url}/books?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <html lang="vi" className={`${display.variable} ${body.variable}`}>
      <body className="flex min-h-screen flex-col">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <a
          href="#noi-dung"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-ink focus:px-4 focus:py-2 focus:text-paper"
        >
          Bỏ qua phần đầu trang
        </a>
        <Providers>
          <SiteHeader />
          <main id="noi-dung" className="flex-1">
            {children}
          </main>
          <SiteFooter />
        </Providers>
      </body>
    </html>
  );
}
