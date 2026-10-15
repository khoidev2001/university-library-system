import type { Metadata } from "next";
import { Suspense } from "react";
import { PaymentResultView } from "@/components/payment-result-view";
import { RequireRole } from "@/components/require-role";
import { Spinner } from "@/components/ui";

export const metadata: Metadata = {
  title: "Kết quả thanh toán phạt",
  description: "Kết quả thanh toán tiền phạt trực tuyến qua VNPay.",
  robots: { index: false, follow: false },
};

export default function PaymentResultPage() {
  return (
    <RequireRole roles={["READER"]}>
      <Suspense fallback={<Spinner />}>
        <PaymentResultView />
      </Suspense>
    </RequireRole>
  );
}
