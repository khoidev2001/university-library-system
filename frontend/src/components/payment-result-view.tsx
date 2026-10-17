"use client";

import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useRef } from "react";
import { ApiError, apiFetch, formatCurrency, formatDateTime } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Payment } from "@/lib/types";
import { PAYMENT_STATUS_LABEL, PAYMENT_STATUS_TONE } from "./payment-status";
import { Clock, X } from "lucide-react";
import { Shimmer } from "./public/skeletons";
import { Alert, Badge, ButtonLink, Card, PageHeading } from "./ui";

/** Hỏi lại trạng thái mỗi 2 giây, tối đa chừng ngần này lần khi giao dịch còn PENDING (IPN có thể đến chậm). */
const POLL_MS = 2000;
const MAX_POLLS = 8;

const ERROR_TEXT: Record<string, string> = {
  invalid_signature:
    "Không xác minh được phản hồi từ VNPay (chữ ký không hợp lệ). Hệ thống không ghi nhận thanh toán nào. Nếu tài khoản ngân hàng của bạn đã bị trừ tiền, hãy liên hệ thủ thư kèm thời gian giao dịch.",
  invalid_amount: "Số tiền VNPay phản hồi không khớp với giao dịch. Hệ thống không ghi nhận thanh toán này.",
  not_found: "Không tìm thấy giao dịch tương ứng.",
  not_configured: "Thanh toán trực tuyến chưa được cấu hình.",
  unknown: "Có lỗi khi xử lý phản hồi từ VNPay. Hãy xem lịch sử thanh toán sau ít phút.",
};

export function PaymentResultView() {
  const { token } = useAuth();
  const params = useSearchParams();
  const error = params.get("error");
  const idParam = Number(params.get("paymentId"));
  const paymentId = Number.isInteger(idParam) && idParam > 0 ? idParam : null;

  const fetches = useRef(0);
  const payment = useQuery({
    queryKey: ["payment", paymentId],
    queryFn: () => {
      fetches.current += 1;
      return apiFetch<Payment>(`/payments/${paymentId}`, { token });
    },
    enabled: !!token && paymentId !== null && !error,
    refetchInterval: (query) =>
      query.state.data?.status === "PENDING" && query.state.dataUpdateCount < MAX_POLLS ? POLL_MS : false,
  });

  // Đọc dataUpdatedAt để React Query báo render lại sau mỗi lần hỏi, kể cả khi dữ liệu không đổi
  // (nếu không, bộ đếm `fetches` đổi mà màn hình vẫn kẹt ở "Đang chờ").
  void payment.dataUpdatedAt;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-10">
      <PageHeading title="Kết quả thanh toán phạt" />
      <div className="mt-6 space-y-4">
        {error ? (
          <>
            <Alert tone="bad">{ERROR_TEXT[error] ?? ERROR_TEXT.unknown}</Alert>
            <Actions />
          </>
        ) : paymentId === null ? (
          <>
            <Alert tone="bad">Thiếu mã giao dịch.</Alert>
            <Actions />
          </>
        ) : payment.isLoading ? (
          <div role="status" aria-label="Đang tải kết quả" className="space-y-4">
            <Shimmer className="h-44 rounded-[1.5rem]" />
            <Shimmer className="h-64 rounded-[1.5rem]" />
          </div>
        ) : payment.error ? (
          <>
            <Alert tone="bad">
              {payment.error instanceof ApiError && payment.error.status === 404
                ? "Không tìm thấy giao dịch này trong tài khoản của bạn."
                : "Không tải được kết quả giao dịch, vui lòng thử lại."}
            </Alert>
            <Actions />
          </>
        ) : payment.data ? (
          <Result
            payment={payment.data}
            waiting={fetches.current < MAX_POLLS}
            onRetry={() => payment.refetch()}
          />
        ) : null}
      </div>
    </div>
  );
}

function Actions() {
  return (
    <div className="flex flex-wrap gap-2">
      <ButtonLink href="/my/fines">Về trang tiền phạt</ButtonLink>
    </div>
  );
}

function Result({ payment, waiting, onRetry }: { payment: Payment; waiting: boolean; onRetry: () => void }) {
  const status = payment.status;
  // Tiền về sau khi khoản phạt đã được xử lý cách khác: chỉ hiện cảnh báo hoàn tiền, không nói "chưa thanh toán"
  const showStatusNotice = !payment.needsRefund;
  return (
    <>
      <StatusBanner payment={payment} />
      {showStatusNotice && status === "PAID" && (
        <Alert tone="good">
          Thanh toán thành công <strong>{formatCurrency(payment.amount)}</strong>. Các khoản phạt bên dưới đã được ghi nhận
          là đã thanh toán.
        </Alert>
      )}
      {showStatusNotice && status === "PENDING" && (
        <Alert tone="info">
          <p>
            {waiting ? "Đang chờ VNPay xác nhận kết quả..." : "Chưa nhận được xác nhận từ VNPay."} Nếu bạn đã thanh toán
            xong, kết quả sẽ tự cập nhật trong ít phút; nếu chưa, bạn có thể quay lại trang tiền phạt để huỷ giao dịch.
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 inline-flex min-h-10 items-center rounded-xl bg-white px-4 text-sm font-semibold ring-1 ring-inset ring-line hover:bg-paper-2"
          >
            Kiểm tra lại
          </button>
        </Alert>
      )}
      {showStatusNotice && status === "FAILED" && (
        <Alert tone="bad">Thanh toán không thành công (mã VNPay {payment.responseCode ?? "không rõ"}). Bạn chưa bị ghi nợ thêm, có thể thử lại.</Alert>
      )}
      {showStatusNotice && status === "CANCELLED" && <Alert tone="info">Giao dịch đã bị huỷ. Các khoản phạt vẫn chưa thanh toán.</Alert>}
      {showStatusNotice && status === "EXPIRED" && (
        <Alert tone="info">Giao dịch đã hết hạn thanh toán. Các khoản phạt vẫn chưa thanh toán, bạn có thể tạo giao dịch mới.</Alert>
      )}
      {payment.needsRefund && (
        <Alert tone="bad">
          Hệ thống nhận được tiền cho giao dịch này sau khi khoản phạt đã được xử lý bằng cách khác. Vui lòng liên hệ thủ
          thư để được hoàn tiền, mã giao dịch VNPay {payment.vnpTransactionNo ?? "(đang cập nhật)"}.
        </Alert>
      )}

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold">Giao dịch #{payment.id}</h2>
          <Badge tone={PAYMENT_STATUS_TONE[status]}>{PAYMENT_STATUS_LABEL[status]}</Badge>
        </div>
        <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <Row label="Số tiền" value={formatCurrency(payment.amount)} />
          <Row label="Mã tham chiếu" value={payment.txnRef} />
          <Row label="Mã giao dịch VNPay" value={payment.vnpTransactionNo ?? "Chưa có"} />
          <Row label="Ngân hàng" value={payment.bankCode ?? "Chưa có"} />
          <Row label="Tạo lúc" value={formatDateTime(payment.createdAt)} />
          <Row label={payment.paidAt ? "Thanh toán lúc" : "Hết hạn lúc"} value={formatDateTime(payment.paidAt ?? payment.expiresAt)} />
        </dl>
        <h3 className="mt-5 text-sm font-semibold">Khoản phạt trong giao dịch</h3>
        <ul className="mt-2 divide-y divide-line text-sm">
          {payment.fines.map((f) => (
            <li key={f.id} className="flex items-start justify-between gap-3 py-2.5">
              <span className="min-w-0">
                {f.bookTitle}
                <span className="block text-xs text-ink-faint">{f.type === "LOST" ? "Báo mất sách" : "Trả trễ"}</span>
              </span>
              <span className="shrink-0 font-medium">{formatCurrency(f.amount)}</span>
            </li>
          ))}
        </ul>
      </Card>
      <Actions />
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-2xl bg-paper p-3.5">
      <dt className="text-xs text-ink-faint">{label}</dt>
      <dd className="mt-0.5 break-words font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

/** Khối đầu kết quả: biểu tượng trạng thái lớn, tiêu đề ngắn và số tiền. Nét tích tự vẽ khi thanh toán thành công. */
function StatusBanner({ payment }: { payment: Payment }) {
  const status = payment.status;
  const paid = status === "PAID" && !payment.needsRefund;
  const pending = status === "PENDING";
  const title = payment.needsRefund
    ? "Cần hoàn tiền"
    : { PAID: "Đã thanh toán", PENDING: "Đang chờ xác nhận", FAILED: "Chưa thanh toán được", CANCELLED: "Giao dịch đã huỷ", EXPIRED: "Giao dịch hết hạn" }[status];
  const tone = paid
    ? "bg-leaf-soft text-leaf border-leaf/15"
    : pending
      ? "bg-primary-soft text-primary-ink border-primary/10"
      : status === "FAILED" || payment.needsRefund
        ? "bg-danger-soft text-danger border-danger/15"
        : "bg-paper-2 text-ink-soft border-line";

  return (
    <div className={`flex flex-col items-center rounded-[1.5rem] border px-6 py-8 text-center ${tone}`}>
      <span className="relative grid h-16 w-16 place-items-center rounded-full bg-white shadow-[var(--shadow-card)]" aria-hidden="true">
        {paid ? (
          <span className="anim-pop grid h-full w-full place-items-center">
            <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="m5 12.5 4.5 4.5L19 7.5" pathLength={100} className="anim-draw" style={{ "--len": 100 } as React.CSSProperties} />
            </svg>
          </span>
        ) : pending ? (
          <>
            <span className="anim-ring absolute inset-0 rounded-full" />
            <Clock size={28} />
          </>
        ) : (
          <X size={28} strokeWidth={2.5} />
        )}
      </span>
      <p className="mt-4 text-xl font-bold">{title}</p>
      <p className="mt-1 text-3xl font-bold tracking-tight tabular-nums text-ink">{formatCurrency(payment.amount)}</p>
    </div>
  );
}
