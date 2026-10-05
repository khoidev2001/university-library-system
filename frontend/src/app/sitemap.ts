import type { MetadataRoute } from "next";
import { apiFetch } from "@/lib/api";
import { SITE } from "@/lib/site";
import type { BookSummary, Category, Page } from "@/lib/types";

export const revalidate = 3600;

/** Sitemap gồm trang tĩnh, trang thể loại và các đầu sách (tối đa 1.000 mục cho gọn). */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE.url}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${SITE.url}/books`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE.url}/quy-dinh`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
  ];

  const [books, categories] = await Promise.all([
    apiFetch<Page<BookSummary>>("/books?limit=100&page=1", { next: { revalidate: 3600 } }).catch(() => null),
    apiFetch<Category[]>("/categories", { next: { revalidate: 3600 } }).catch(() => []),
  ]);

  const categoryRoutes: MetadataRoute.Sitemap = categories.map((category) => ({
    url: `${SITE.url}/books?categoryId=${category.id}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  const bookRoutes: MetadataRoute.Sitemap = (books?.items ?? []).map((book) => ({
    url: `${SITE.url}/books/${book.id}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [...staticRoutes, ...categoryRoutes, ...bookRoutes];
}
