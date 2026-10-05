import type { Metadata } from "next";
import { RecommendationsView } from "@/components/recommendations-view";
import { RequireRole } from "@/components/require-role";

export const metadata: Metadata = {
  title: "Gợi ý cho bạn",
  description: "Những cuốn sách phù hợp với lịch sử mượn và đánh giá của bạn.",
  robots: { index: false, follow: false },
};

export default function RecommendationsPage() {
  return (
    <RequireRole roles={["READER"]}>
      <RecommendationsView />
    </RequireRole>
  );
}
