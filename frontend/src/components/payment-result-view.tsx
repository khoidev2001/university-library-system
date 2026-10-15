"use client";

import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { ApiError, apiFetch, formatCurrency, formatDateTime } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Payment } from "@/lib/types";
import { PAYMENT_STATUS_LABEL, PAYMENT_STATUS_TONE } from "./payment-status";
import { Alert, Badge, ButtonLink, Card, PageHeading, Spinner } from "./ui";

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

  const payment = useQuery({
    queryKey: ["payment", paymentId],
    queryFn: () => apiFetch<Payment>(`/payments/${paymentId}`, { token }),
    enabled: !!token && paymentId !== null && !error,
    refetchInterval: (query) =>
      query.state.data?.status === "PENDING" && query.state.dataUpdateCount < MAX_POLLS ? POLL_MS : false,
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <PageHeading eyebrow="Thanh toán trực tuyến" title="Kết quả thanh toán phạt" />
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
          <Spinner label="Đang tải kết quả" />
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
          <Result payment={payment.data} polling={payment.isFetching} onRetry={() => payment.refetch()} />
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

function Result({ payment, polling, onRetry }: { payment: Payment; polling: boolean; onRetry: () => void }) {
  const status = payment.status;
  return (
    <>
      {status === "PAID" && (
        <Alert tone="good">
          Thanh toán thành công <strong>{formatCurrency(payment.amount)}</strong>. Các khoản phạt bên dưới đã được ghi nhận
          là đã thanh toán.
        </Alert>
      )}
      {status === "PENDING" && (
        <Alert tone="info">
          <p>
            {polling ? "Đang chờ VNPay xác nhận kết quả..." : "Chưa nhận được xác nhận từ VNPay."} Nếu bạn đã thanh toán
            xong, kết quả sẽ tự cập nhật trong ít phút; nếu chưa, bạn có thể quay lại trang tiền phạt để huỷ giao dịch.
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 inline-flex min-h-10 items-center rounded-md border border-line bg-white px-4 text-sm font-medium hover:bg-paper-2"
          >
            Kiểm tra lại
          </button>
        </Alert>
      )}
      {status === "FAILED" && (
        <Alert tone="bad">Thanh toán không thành công (mã VNPay {payment.responseCode ?? "không rõ"}). Bạn chưa bị ghi nợ thêm, có thể thử lại.</Alert>
      )}
      {status === "CANCELLED" && <Alert tone="info">Giao dịch đã bị huỷ. Các khoản phạt vẫn chưa thanh toán.</Alert>}
      {status === "EXPIRED" && (
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
          <h2 className="font-serif text-lg font-bold">Giao dịch #{payment.id}</h2>
          <Badge tone={PAYMENT_STATUS_TONE[status]}>{PAYMENT_STATUS_LABEL[status]}</Badge>
        </div>
        <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <Row label="Số tiền" value={formatCurrency(payment.amount)} />
          <Row label="Mã tham chiếu" value={payment.txnRef} mono />
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

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-ink-faint">{label}</dt>
      <dd className={`mt-0.5 break-words font-medium ${mono ? "font-mono text-xs" : ""}`}>{value}</dd>
    </div>
  );
}
