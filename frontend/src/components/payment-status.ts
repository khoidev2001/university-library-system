import type { PaymentStatus } from "@/lib/types";

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  PENDING: "Đang chờ",
  PAID: "Đã thanh toán",
  FAILED: "Thất bại",
  EXPIRED: "Hết hạn",
  CANCELLED: "Đã huỷ",
};

export const PAYMENT_STATUS_TONE: Record<PaymentStatus, "neutral" | "good" | "warn" | "bad" | "info"> = {
  PENDING: "warn",
  PAID: "good",
  FAILED: "bad",
  EXPIRED: "neutral",
  CANCELLED: "neutral",
};
