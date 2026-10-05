"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { BookCard } from "./book-card";
import { Alert, ButtonLink, EmptyState, PageHeading, Spinner } from "./ui";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { RecommendationResult } from "@/lib/types";

export function RecommendationsView() {
  const { token } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["recommendations"],
    queryFn: () => apiFetch<RecommendationResult>("/recommendations/me?k=12", { token }),
    enabled: !!token,
  });

  if (isLoading) return <Spinner label="Đang chọn sách phù hợp với bạn" />;

  const items = data?.items ?? [];
  const fromHistory = data?.source === "MODEL";

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <PageHeading
        eyebrow="Dành cho bạn"
        title="Gợi ý cho bạn"
        description={
          fromHistory
            ? "Chọn ra từ lịch sử mượn và điểm đánh giá của bạn, cùng thói quen đọc của những bạn đọc có gu tương tự."
            : "Những cuốn được mượn nhiều nhất tại thư viện."
        }
      />

      {!fromHistory && items.length > 0 && (
        <div className="mt-5">
          <Alert tone="info">
            Bạn chưa có đủ lịch sử mượn để cá nhân hoá. Mượn và đánh giá vài cuốn, danh sách này sẽ sát hơn với
            sở thích của bạn.
          </Alert>
        </div>
      )}

      {items.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="Chưa có gợi ý nào"
            hint="Thư viện cần thêm dữ liệu mượn để đưa ra gợi ý. Bạn có thể duyệt danh mục trong lúc chờ."
            action={<ButtonLink href="/books">Duyệt danh mục</ButtonLink>}
          />
        </div>
      ) : (
        <ul className="mt-8 grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-6">
          {items.map((item) => (
            <li key={item.id}>
              <BookCard
                book={{
                  id: item.id,
                  title: item.title,
                  coverUrl: item.coverUrl,
                  authors: item.authors,
                  copiesAvailable: item.copiesAvailable,
                  copiesTotal: item.copiesAvailable,
                  category: item.category,
                }}
              />
            </li>
          ))}
        </ul>
      )}

      <p className="mt-10 text-sm text-ink-soft">
        Muốn tìm theo chủ đề cụ thể?{" "}
        <Link href="/books" className="font-medium text-brand hover:underline">
          Tra cứu toàn bộ danh mục
        </Link>
        .
      </p>
    </div>
  );
}
