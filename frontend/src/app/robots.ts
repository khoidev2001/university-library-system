import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Khu vực tài khoản và nghiệp vụ không có nội dung công khai
        disallow: ["/my/", "/librarian/", "/admin/", "/reports", "/recommendations", "/login", "/register", "/api/"],
      },
    ],
    sitemap: `${SITE.url}/sitemap.xml`,
    host: SITE.url,
  };
}
