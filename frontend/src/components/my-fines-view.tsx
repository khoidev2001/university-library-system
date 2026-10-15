"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { ApiError, apiFetch, formatCurrency, formatDate, formatDateTime } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { CreatedPayment, Fine, Page, Payment, PaymentConfig, PaymentStatus } from "@/lib/types";
import { PAYMENT_STATUS_LABEL, PAYMENT_STATUS_TONE } from "./payment-status";
import { Alert, Badge, Button, EmptyState, PageHeading, Spinner } from "./ui";

const CARD = "rounded-xl border border-line bg-white";

export function MyFinesView() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [notice, setNotice] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["my-fines"],
    queryFn: () => apiFetch<{ items: Fine[]; unpaidTotal: number }>("/fines/me", { token }),
    enabled: !!token,
  });
  const config = useQuery({
    queryKey: ["payment-config"],
    queryFn: () => apiFetch<PaymentConfig>("/payments/config", { token }),
    enabled: !!token,
    staleTime: 60_000,
  });
  const history = useQuery({
    queryKey: ["my-payments"],
    queryFn: () => apiFetch<Page<Payment>>("/payments/me?limit=10", { token }),
    enabled: !!token,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["my-fines"] });
    queryClient.invalidateQueries({ queryKey: ["my-payments"] });
  };

  const pay = useMutation({
    mutationFn: (fineIds?: number[]) =>
      apiFetch<CreatedPayment>("/payments", { method: "POST", token, body: fineIds ? { fineIds } : {} }),
    onSuccess: (created) => {
      // paymentUrl do máy chủ ký sẵn; chỉ chuyển hướng khi là https (hoặc http cho môi trường thử)
      if (/^https?:\/\//.test(created.paymentUrl)) window.location.assign(created.paymentUrl);
    },
    onError: (error) => {
      setNotice(error instanceof ApiError ? error.friendlyMessage : "Không tạo được giao dịch, vui lòng thử lại.");
      refresh();
    },
  });

  const cancel = useMutation({
    mutationFn: (paymentId: number) => apiFetch<Payment>(`/payments/${paymentId}/cancel`, { method: "POST", token }),
    onSuccess: () => {
      setNotice("Đã huỷ giao dịch chờ. Bạn có thể chọn khoản phạt và thanh toán lại.");
      refresh();
    },
    onError: (error) => {
      setNotice(error instanceof ApiError ? error.friendlyMessage : "Không huỷ được giao dịch.");
      refresh();
    },
  });

  if (isLoading) return <Spinner />;

  const items = data?.items ?? [];
  const unpaid = data?.unpaidTotal ?? 0;
  const online = config.data?.online === true;
  const minAmount = config.data?.minAmount ?? 5000;

  const payable = items.filter((f) => !f.paidAt && f.onlinePayment?.status !== "PENDING");
  const payableTotal = payable.reduce((sum, f) => sum + f.amount, 0);
  const selectedFines = payable.filter((f) => selected.has(f.id));
  const selectedTotal = selectedFines.reduce((sum, f) => sum + f.amount, 0);
  const targetTotal = selectedFines.length > 0 ? selectedTotal : payableTotal;
  const targetIds = selectedFines.length > 0 ? selectedFines.map((f) => f.id) : undefined;
  const tooSmall = targetTotal > 0 && targetTotal < minAmount;

  const pending = (history.data?.items ?? []).find(
    (p) => p.status === "PENDING" && new Date(p.expiresAt).getTime() > Date.now(),
  );

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <PageHeading
        eyebrow="Tài khoản của tôi"
        title="Tiền phạt"
        description="Phạt phát sinh khi trả sách trễ hoặc báo mất sách. Bạn có thể thanh toán trực tuyến qua VNPay hoặc nộp tiền mặt tại quầy thủ thư."
      />

      <div className="mt-6 space-y-3">
        {unpaid > 0 ? (
          <Alert tone="bad">
            Tổng còn nợ: <strong>{formatCurrency(unpaid)}</strong>. Thư viện tạm dừng cho mượn và gia hạn
            cho tới khi bạn thanh toán.
          </Alert>
        ) : (
          <Alert tone="good">Bạn không còn khoản phạt nào chưa thanh toán.</Alert>
        )}
        {notice && <Alert tone="info">{notice}</Alert>}
        {pending && (
          <Alert tone="info">
            <p>
              Bạn có giao dịch <strong>{formatCurrency(pending.amount)}</strong> đang chờ thanh toán (hết hạn lúc{" "}
              {formatDateTime(pending.expiresAt)}). Nếu đã đóng trang VNPay giữa chừng, hãy huỷ giao dịch rồi tạo lại.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                variant="ghost"
                className="min-h-10"
                disabled={cancel.isPending}
                onClick={() => cancel.mutate(pending.id)}
              >
                Huỷ giao dịch chờ
              </Button>
              <Link
                href={`/my/payments/result?paymentId=${pending.id}`}
                className="inline-flex min-h-10 items-center rounded-md border border-line bg-white px-4 text-sm font-medium hover:bg-paper-2"
              >
                Kiểm tra kết quả
              </Link>
            </div>
          </Alert>
        )}
      </div>

      {payable.length > 0 && (
        <section aria-labelledby="online-pay" className={`${CARD} mt-6 p-5`}>
          <h2 id="online-pay" className="font-serif text-lg font-bold">
            Thanh toán trực tuyến
          </h2>
          {config.isLoading ? (
            <p className="mt-2 text-sm text-ink-faint">Đang kiểm tra cổng thanh toán...</p>
          ) : online ? (
            <>
              <p className="mt-1 text-sm text-ink-soft">
                {selectedFines.length > 0
                  ? `Đã chọn ${selectedFines.length} khoản, tổng ${formatCurrency(selectedTotal)}.`
                  : `Chưa chọn khoản nào: sẽ thanh toán tất cả ${payable.length} khoản chưa trả, tổng ${formatCurrency(payableTotal)}.`}{" "}
                Số tiền cuối cùng do hệ thống tính lại khi tạo giao dịch.
              </p>
              {tooSmall && (
                <p className="mt-2 text-sm text-brand">
                  VNPay yêu cầu tối thiểu {formatCurrency(minAmount)} mỗi giao dịch. Hãy chọn thêm khoản phạt hoặc nộp tại
                  quầy.
                </p>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  className="min-h-11 w-full sm:w-auto"
                  disabled={pay.isPending || tooSmall || !!pending}
                  onClick={() => {
                    setNotice(null);
                    pay.mutate(targetIds);
                  }}
                >
                  {pay.isPending
                    ? "Đang chuyển tới VNPay..."
                    : `Thanh toán ${formatCurrency(targetTotal)} qua VNPay`}
                </Button>
                {selectedFines.length > 0 && (
                  <Button variant="ghost" className="min-h-11" onClick={() => setSelected(new Set())}>
                    Bỏ chọn
                  </Button>
                )}
              </div>
              <p className="mt-3 text-xs text-ink-faint">
                Giao dịch giữ chỗ {config.data?.ttlMinutes ?? 15} phút. Trong thời gian đó thủ thư không thu tiền mặt
                được các khoản này.
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-ink-soft">
              Thanh toán trực tuyến hiện chưa được bật. Vui lòng nộp tiền phạt tại quầy thủ thư.
            </p>
          )}
        </section>
      )}

      {items.length === 0 ? (
        <div className="mt-8">
          <EmptyState title="Chưa có khoản phạt nào" hint="Trả sách đúng hạn để giữ nguyên tình trạng này." />
        </div>
      ) : (
        <>
          <ul className="mt-8 space-y-3 sm:hidden" aria-label="Danh sách khoản phạt của tôi">
            {items.map((fine) => (
              <li key={fine.id} className={`${CARD} p-4`}>
                <div className="flex items-start gap-3">
                  <SelectBox fine={fine} checked={selected.has(fine.id)} onToggle={toggle} enabled={online} compact />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{fine.loan?.copy.book.title ?? `Phiếu #${fine.loanId}`}</p>
                    <p className="mt-0.5 text-sm text-ink-soft">
                      {fine.type === "LOST" ? "Báo mất sách" : "Trả trễ"} · {formatDate(fine.createdAt)}
                    </p>
                    <p className="mt-1 font-medium">{formatCurrency(fine.amount)}</p>
                    <div className="mt-2">
                      <FineStatus fine={fine} />
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <div className={`${CARD} relative mt-8 hidden overflow-x-auto sm:block`}>
            <table className="w-full min-w-[640px] text-sm">
              <caption className="sr-only">Danh sách khoản phạt của tôi</caption>
              <thead className="border-b border-line bg-paper-2 text-left">
                <tr>
                  <th scope="col" className="w-12 px-3 py-3">
                    <span className="sr-only">Chọn</span>
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">Sách</th>
                  <th scope="col" className="whitespace-nowrap px-4 py-3 font-semibold">Lý do</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Số tiền</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Ngày lập</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Tình trạng</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {items.map((fine) => (
                  <tr key={fine.id}>
                    <td className="px-3 py-1">
                      <SelectBox fine={fine} checked={selected.has(fine.id)} onToggle={toggle} enabled={online} />
                    </td>
                    <td className="px-4 py-3 font-medium">{fine.loan?.copy.book.title ?? `Phiếu #${fine.loanId}`}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-ink-soft">{fine.type === "LOST" ? "Báo mất sách" : "Trả trễ"}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-medium">{formatCurrency(fine.amount)}</td>
                    <td className="px-4 py-3 text-ink-soft">{formatDate(fine.createdAt)}</td>
                    <td className="px-4 py-3">
                      <FineStatus fine={fine} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <section aria-labelledby="pay-history" className="mt-10">
        <h2 id="pay-history" className="font-serif text-xl font-bold">
          Lịch sử thanh toán trực tuyến
        </h2>
        {history.isLoading ? (
          <Spinner />
        ) : (history.data?.items ?? []).length === 0 ? (
          <p className="mt-3 text-sm text-ink-soft">Bạn chưa có giao dịch trực tuyến nào.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {(history.data?.items ?? []).map((p) => (
              <li key={p.id} className={`${CARD} flex flex-wrap items-center justify-between gap-3 p-4`}>
                <div className="min-w-0">
                  <p className="font-medium">
                    {formatCurrency(p.amount)}{" "}
                    <span className="text-sm font-normal text-ink-soft">· {p.fines.length} khoản phạt</span>
                  </p>
                  <p className="mt-0.5 text-sm text-ink-soft">
                    {formatDateTime(p.createdAt)}
                    {p.vnpTransactionNo ? ` · Mã GD VNPay ${p.vnpTransactionNo}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge tone={PAYMENT_STATUS_TONE[p.status as PaymentStatus]}>{PAYMENT_STATUS_LABEL[p.status]}</Badge>
                  <Link
                    href={`/my/payments/result?paymentId=${p.id}`}
                    className="inline-flex min-h-10 items-center rounded-md border border-line px-3 text-sm font-medium hover:bg-paper-2"
                  >
                    Chi tiết
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function SelectBox({
  fine,
  checked,
  onToggle,
  enabled,
  compact = false,
}: {
  fine: Fine;
  checked: boolean;
  onToggle: (id: number) => void;
  enabled: boolean;
  /** Dạng thẻ trên điện thoại: khoản không chọn được thì không chừa ô trống. */
  compact?: boolean;
}) {
  const selectable = enabled && !fine.paidAt && fine.onlinePayment?.status !== "PENDING";
  if (!selectable) return compact ? null : <span className="inline-block h-10 w-10 shrink-0" aria-hidden="true" />;
  return (
    <label className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center">
      <input
        type="checkbox"
        checked={checked}
        onChange={() => onToggle(fine.id)}
        className="h-5 w-5 accent-[var(--color-ink)]"
        aria-label={`Chọn thanh toán ${fine.loan?.copy.book.title ?? `phiếu ${fine.loanId}`}, ${formatCurrency(fine.amount)}`}
      />
    </label>
  );
}

function FineStatus({ fine }: { fine: Fine }) {
  if (fine.paidAt) {
    return (
      <span className="space-y-1">
        <Badge tone="good">Đã thanh toán {formatDate(fine.paidAt)}</Badge>
        {fine.onlinePayment?.status === "PAID" && (
          <span className="block text-xs text-ink-faint">Qua VNPay</span>
        )}
      </span>
    );
  }
  if (fine.onlinePayment?.status === "PENDING") return <Badge tone="warn">Đang chờ thanh toán VNPay</Badge>;
  return <Badge tone="bad">Chưa thanh toán</Badge>;
}
