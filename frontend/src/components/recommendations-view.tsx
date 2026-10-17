"use client";

import { useQuery } from "@tanstack/react-query";
import { Sparkles, TrendingUp } from "lucide-react";
import Link from "next/link";
import { BookCard } from "./book-card";
import { BookGridSkeleton, HeadingSkeleton } from "./public/skeletons";
import { Reveal } from "./motion";
import { ButtonLink, EmptyState, PageHeading } from "./ui";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { RecommendationResult } from "@/lib/types";

export function RecommendationsSkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10" role="status" aria-label="Đang chọn sách phù hợp với bạn">
      <HeadingSkeleton />
      <div className="mt-8">
        <BookGridSkeleton count={12} className="grid-cols-2 sm:grid-cols-3 lg:grid-cols-6" />
      </div>
    </div>
  );
}

export function RecommendationsView() {
  const { token } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["recommendations"],
    queryFn: () => apiFetch<RecommendationResult>("/recommendations/me?k=12", { token }),
    enabled: !!token,
  });

  if (isLoading) return <RecommendationsSkeleton />;

  const items = data?.items ?? [];
  const fromHistory = data?.source === "MODEL";

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <PageHeading
        title="Gợi ý cho bạn"
        description={
          fromHistory
            ? "Chọn ra từ lịch sử mượn và điểm đánh giá của bạn, cùng thói quen đọc của những bạn đọc có gu tương tự."
            : "Những cuốn được mượn nhiều nhất tại thư viện."
        }
      />

      {items.length > 0 && (
        <div
          className={`mt-6 flex items-start gap-4 rounded-[1.5rem] p-5 sm:items-center sm:p-6 ${
            fromHistory ? "bg-primary-soft" : "border border-line bg-white shadow-[var(--shadow-card)]"
          }`}
        >
          <span
            className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${
              fromHistory ? "bg-white text-primary" : "bg-primary-soft text-primary"
            }`}
            aria-hidden="true"
          >
            {fromHistory ? <Sparkles size={20} /> : <TrendingUp size={20} />}
          </span>
          <p className="text-sm leading-relaxed text-ink-soft sm:text-base">
            {fromHistory ? (
              <>
                <strong className="font-bold text-ink">Chọn riêng cho bạn.</strong> Mượn và đánh giá thêm sách, danh
                sách này sẽ càng sát sở thích.
              </>
            ) : (
              <>
                <strong className="font-bold text-ink">Chưa đủ dữ liệu để cá nhân hoá.</strong> Mượn và đánh giá vài
                cuốn, danh sách này sẽ sát hơn với sở thích của bạn.
              </>
            )}
          </p>
        </div>
      )}

      {items.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="Chưa có gợi ý nào, mời bạn mở đầu bằng một cuốn"
            hint="Thư viện cần thêm dữ liệu mượn để đưa ra gợi ý. Bạn có thể duyệt danh mục trong lúc chờ."
            action={<ButtonLink href="/books">Duyệt danh mục</ButtonLink>}
          />
        </div>
      ) : (
        <ul className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-6">
          {items.map((item, index) => (
            <li key={item.id}>
              <Reveal delay={(index % 6) * 50} className="h-full">
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
              </Reveal>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-10 text-sm text-ink-soft">
        Muốn tìm theo chủ đề cụ thể?{" "}
        <Link href="/books" className="link-underline font-semibold text-primary">
          Tra cứu toàn bộ danh mục
        </Link>
        .
      </p>
    </div>
  );
}
