import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ReaderCardsView } from "@/components/print/reader-cards-view";
import { RequireRole } from "@/components/require-role";
import { PrintSkeleton } from "@/components/route-skeletons";

export const metadata: Metadata = {
  title: "In thẻ bạn đọc",
  description: "In thẻ bạn đọc cỡ 85,6 × 54 mm với mã vạch và mã QR.",
  robots: { index: false, follow: false },
};

export default async function ReaderCardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const readerId = Number(id);
  if (!Number.isInteger(readerId) || readerId < 1) notFound();
  return (
    <RequireRole roles={["LIBRARIAN"]}>
      <Suspense fallback={<PrintSkeleton />}>
        <ReaderCardsView readerId={readerId} />
      </Suspense>
    </RequireRole>
  );
}
