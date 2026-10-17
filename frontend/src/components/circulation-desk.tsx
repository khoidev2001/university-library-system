"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, BookDown, BookUp, ScanBarcode, UserRound, X } from "lucide-react";
import { useRef, useState } from "react";
import { Avatar } from "./avatar";
import { BookCover } from "./book-card";
import { InlineSpinner, TextField } from "./forms/controls";
import { SuccessMark } from "./forms/success-mark";
import { Badge, Button, PageHeading, Skeleton } from "./ui";
import { ApiError, apiFetch, formatCurrency, formatDate } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useDesktopAutofocus } from "@/lib/use-desktop-autofocus";
import type { BorrowResult, Loan, Page, ReturnResult } from "@/lib/types";
import "./ux-motion.css";

/** Kết quả gần nhất của một quầy: thành công, lỗi, hoặc chưa làm gì. */
type Outcome<T> = { kind: "ok"; data: T } | { kind: "error"; message: string } | null;

const CARD = "flex flex-col rounded-[1.5rem] border border-line bg-white p-5 shadow-[var(--shadow-card)] sm:p-7";
/** Vùng kết quả luôn có chiều cao tối thiểu cố định: kết quả hay lỗi hiện ra đều không làm trang nhảy. */
const RESULT_SLOT = "mt-6 flex min-h-[12.5rem] flex-1 flex-col [&>*]:flex-1";

/** Mức nguy cơ trả trễ: thanh đo đầy dần, màu theo ngưỡng 30% và 60%. */
function RiskBar({ risk }: { risk: number | null }) {
  if (risk === null) return <Badge tone="neutral">Chưa có dự báo trả trễ</Badge>;
  const percent = Math.round(risk * 100);
  const level =
    percent > 60
      ? { label: "Nguy cơ trả trễ cao", text: "text-danger", bar: "bg-danger" }
      : percent >= 30
        ? { label: "Nguy cơ trả trễ trung bình", text: "text-amber", bar: "bg-amber-500" }
        : { label: "Nguy cơ trả trễ thấp", text: "text-leaf", bar: "bg-leaf" };
  return (
    <div className="w-full max-w-[16rem]">
      <div className="flex items-baseline justify-between gap-3 text-xs">
        <span className={`font-semibold ${level.text}`}>{level.label}</span>
        <span className="font-bold tabular-nums">{percent}%</span>
      </div>
      <div
        role="meter"
        aria-label="Nguy cơ trả trễ"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="mt-1.5 h-2 overflow-hidden rounded-full bg-paper-2"
      >
        <div className={`ux-grow h-full rounded-full ${level.bar}`} style={{ ["--to" as string]: Math.max(percent, 4) / 100 }} />
      </div>
    </div>
  );
}

/** Trạng thái chờ: mời quét. Tia đỏ chạy qua mã vạch cho biết quầy đang sẵn sàng. */
function IdleSlot({ text }: { text: string }) {
  return (
    <div className="flex h-full min-h-[12.5rem] flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-paper/70 px-6 py-8 text-center">
      <div className="relative h-14 w-24 overflow-hidden" aria-hidden="true">
        <div className="flex h-full items-stretch justify-center gap-[3px] text-ink-faint/60">
          {[3, 1, 2, 1, 4, 1, 2, 3, 1, 2, 1, 3, 2, 1].map((w, i) => (
            <span key={i} className="rounded-[1px] bg-current" style={{ width: w * 1.6 }} />
          ))}
        </div>
        <span className="ux-laser absolute inset-x-0 top-1 h-0.5 rounded-full bg-danger shadow-[0_0_10px_rgb(200_30_69/0.7)]" />
      </div>
      <p className="mt-4 max-w-xs text-sm leading-relaxed text-ink-soft">{text}</p>
    </div>
  );
}

function ErrorSlot({ message }: { message: string }) {
  return (
    <div
      key={message}
      role="alert"
      className="ux-shake flex min-h-[12.5rem] flex-col items-center justify-center rounded-2xl border border-danger/20 bg-danger-soft px-6 py-8 text-center"
    >
      <span className="grid h-12 w-12 place-items-center rounded-full bg-white text-danger">
        <AlertCircle size={24} aria-hidden="true" />
      </span>
      <p className="mt-3 max-w-sm text-[0.9375rem] font-semibold leading-relaxed text-danger">{message}</p>
    </div>
  );
}

function PanelHeading({
  id,
  icon,
  tone,
  title,
  hint,
}: {
  id: string;
  icon: React.ReactNode;
  tone: string;
  title: string;
  hint: string;
}) {
  return (
    <div className="flex items-start gap-4">
      <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${tone}`} aria-hidden="true">
        {icon}
      </span>
      <div>
        <h2 id={id} className="text-xl font-bold tracking-tight">
          {title}
        </h2>
        <p className="mt-0.5 text-sm leading-relaxed text-ink-soft">{hint}</p>
      </div>
    </div>
  );
}

export function CirculationDesk() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [borrowForm, setBorrowForm] = useState({ barcode: "", memberCode: "" });
  const [borrowErrors, setBorrowErrors] = useState<{ barcode?: string; memberCode?: string }>({});
  const [returnBarcode, setReturnBarcode] = useState("");
  const [returnError, setReturnError] = useState<string | null>(null);
  const [borrowOutcome, setBorrowOutcome] = useState<Outcome<BorrowResult>>(null);
  const [returnOutcome, setReturnOutcome] = useState<Outcome<ReturnResult>>(null);

  const memberRef = useRef<HTMLInputElement>(null);
  const borrowBarcodeRef = useRef<HTMLInputElement>(null);
  const returnBarcodeRef = useRef<HTMLInputElement>(null);
  const returnCardRef = useRef<HTMLDivElement>(null);

  // Quầy thường bắt đầu bằng việc quét thẻ bạn đọc; chỉ tự focus trên máy tính để không bật bàn phím ảo
  useDesktopAutofocus(memberRef);

  const overdue = useQuery({
    queryKey: ["loans", "overdue"],
    queryFn: () => apiFetch<Page<Loan>>("/loans?overdue=true&limit=8", { token }),
    enabled: !!token,
  });

  const borrow = useMutation({
    mutationFn: () => apiFetch<BorrowResult>("/loans", { method: "POST", body: borrowForm, token }),
    onSuccess: (result) => {
      setBorrowOutcome({ kind: "ok", data: result });
      // Giữ mã bạn đọc để quét tiếp cuốn kế; đưa con trỏ về ô mã vạch
      setBorrowForm((form) => ({ barcode: "", memberCode: form.memberCode }));
      queryClient.invalidateQueries({ queryKey: ["loans"] });
      borrowBarcodeRef.current?.focus();
    },
    onError: (err) => {
      setBorrowOutcome({
        kind: "error",
        message: err instanceof ApiError ? err.friendlyMessage : "Không tạo được phiếu mượn.",
      });
      borrowBarcodeRef.current?.select();
    },
  });

  const returnLoan = useMutation({
    mutationFn: async () => {
      // Tìm đúng phiếu đang mở của mã vạch này ở máy chủ, không lọc trên 100 phiếu mới nhất
      const found = await apiFetch<Page<Loan>>(
        `/loans?status=ACTIVE&limit=1&barcode=${encodeURIComponent(returnBarcode.trim())}`,
        { token },
      );
      const loan = found.items[0];
      if (!loan) throw new ApiError(404, "LOAN_NOT_FOUND", "Không tìm thấy phiếu mượn đang mở cho mã vạch này.");
      return apiFetch<ReturnResult>(`/loans/${loan.id}/return`, { method: "POST", token });
    },
    onSuccess: (result) => {
      setReturnOutcome({ kind: "ok", data: result });
      setReturnBarcode("");
      queryClient.invalidateQueries({ queryKey: ["loans"] });
      returnBarcodeRef.current?.focus();
    },
    onError: (err) => {
      setReturnOutcome({ kind: "error", message: err instanceof ApiError ? err.friendlyMessage : "Không nhận trả được." });
      returnBarcodeRef.current?.select();
    },
  });

  function submitBorrow(event: React.FormEvent) {
    event.preventDefault();
    const found: typeof borrowErrors = {};
    if (!borrowForm.memberCode.trim()) found.memberCode = "Nhập hoặc quét mã bạn đọc.";
    if (!borrowForm.barcode.trim()) found.barcode = "Quét mã vạch của bản sao cần cho mượn.";
    setBorrowErrors(found);
    if (found.memberCode) return memberRef.current?.focus();
    if (found.barcode) return borrowBarcodeRef.current?.focus();
    borrow.mutate();
  }

  function submitReturn(event: React.FormEvent) {
    event.preventDefault();
    if (!returnBarcode.trim()) {
      setReturnError("Quét mã vạch của bản sao cần nhận trả.");
      returnBarcodeRef.current?.focus();
      return;
    }
    setReturnError(null);
    returnLoan.mutate();
  }

  /** Từ danh sách quá hạn: điền sẵn mã vạch vào quầy nhận trả để thủ thư chỉ còn bấm xác nhận. */
  function prepareReturn(barcode: string) {
    setReturnBarcode(barcode);
    setReturnError(null);
    returnCardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    returnBarcodeRef.current?.focus({ preventScroll: true });
  }

  const overdueItems = overdue.data?.items ?? [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <PageHeading
        title="Quầy mượn trả"
        description="Quét mã vạch bản sao và mã bạn đọc. Hệ thống tự kiểm tra hạn mức, sách quá hạn và tiền phạt."
      />

      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <section aria-labelledby="desk-borrow-title" className={CARD}>
          <PanelHeading
            id="desk-borrow-title"
            icon={<BookUp size={24} />}
            tone="bg-primary-soft text-primary"
            title="Cho mượn"
            hint="Quét thẻ bạn đọc rồi quét từng cuốn. Mã bạn đọc được giữ lại cho lượt kế tiếp."
          />
          <form className="mt-6 space-y-5" noValidate onSubmit={submitBorrow}>
            <TextField
              id="o-ma-ban-doc"
              ref={memberRef}
              label="Mã bạn đọc"
              size="lg"
              autoComplete="off"
              spellCheck={false}
              autoCapitalize="characters"
              value={borrowForm.memberCode}
              error={borrowErrors.memberCode}
              onChange={(event) => {
                setBorrowForm((f) => ({ ...f, memberCode: event.target.value }));
                if (borrowErrors.memberCode) setBorrowErrors((e) => ({ ...e, memberCode: undefined }));
              }}
              onKeyDown={(event) => {
                // Quét thẻ xong máy quét gõ Enter: nhảy xuống ô mã vạch thay vì gửi biểu mẫu trống
                if (event.key === "Enter" && borrowForm.memberCode.trim() && !borrowForm.barcode.trim()) {
                  event.preventDefault();
                  borrowBarcodeRef.current?.focus();
                }
              }}
              leading={<UserRound size={20} />}
              trailing={
                borrowForm.memberCode ? (
                  <button
                    type="button"
                    aria-label="Đổi bạn đọc (xoá mã bạn đọc)"
                    onClick={() => {
                      setBorrowForm((f) => ({ ...f, memberCode: "" }));
                      memberRef.current?.focus();
                    }}
                    className="absolute right-2 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-xl text-ink-faint transition-colors hover:bg-paper-2 hover:text-ink"
                  >
                    <X size={18} aria-hidden="true" />
                  </button>
                ) : null
              }
              placeholder="23Q74802012006"
            />
            <TextField
              id="o-barcode-muon"
              ref={borrowBarcodeRef}
              label="Mã vạch bản sao"
              size="lg"
              autoComplete="off"
              spellCheck={false}
              autoCapitalize="characters"
              value={borrowForm.barcode}
              error={borrowErrors.barcode}
              onChange={(event) => {
                setBorrowForm((f) => ({ ...f, barcode: event.target.value }));
                if (borrowErrors.barcode) setBorrowErrors((e) => ({ ...e, barcode: undefined }));
              }}
              leading={<ScanBarcode size={20} />}
              placeholder="LIB-000123-1"
            />
            <Button type="submit" disabled={borrow.isPending} aria-busy={borrow.isPending} className="min-h-13 w-full text-base">
              {borrow.isPending && <InlineSpinner />}
              {borrow.isPending ? "Đang xử lý..." : "Tạo phiếu mượn"}
            </Button>
          </form>

          <div className={RESULT_SLOT} aria-live="polite">
            {borrowOutcome?.kind === "ok" ? (
              <div
                key={borrowOutcome.data.loan.id}
                className="anim-pop flex min-h-[12.5rem] items-center gap-4 rounded-2xl bg-leaf-soft p-4 sm:gap-5 sm:p-5"
              >
                <div className="h-28 w-[4.75rem] shrink-0 overflow-hidden rounded-xl bg-white shadow-[0_8px_18px_-8px_rgb(21_26_51/0.35)] sm:h-32 sm:w-[5.5rem]">
                  <BookCover title={borrowOutcome.data.loan.copy.book.title} coverUrl={borrowOutcome.data.loan.copy.book.coverUrl} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-sm font-bold text-leaf">
                    <SuccessMark size={26} />
                    Đã cho mượn thành công
                  </p>
                  <p className="mt-2 line-clamp-2 font-semibold leading-snug">{borrowOutcome.data.loan.copy.book.title}</p>
                  <p className="mt-0.5 truncate text-sm text-ink-soft">
                    {borrowOutcome.data.loan.user.fullName} ({borrowOutcome.data.loan.user.memberCode})
                  </p>
                  <p className="mt-1.5 text-sm">
                    Hạn trả: <strong className="tabular-nums">{formatDate(borrowOutcome.data.loan.dueAt)}</strong>
                  </p>
                  <div className="mt-3">
                    <RiskBar risk={borrowOutcome.data.overdueRisk} />
                  </div>
                </div>
              </div>
            ) : borrowOutcome?.kind === "error" ? (
              <ErrorSlot message={borrowOutcome.message} />
            ) : (
              <IdleSlot text="Sẵn sàng. Quét thẻ bạn đọc và mã vạch bản sao, kết quả hiện ở đây." />
            )}
          </div>
        </section>

        <section aria-labelledby="desk-return-title" className={CARD} ref={returnCardRef}>
          <PanelHeading
            id="desk-return-title"
            icon={<BookDown size={24} />}
            tone="bg-leaf-soft text-leaf"
            title="Nhận trả"
            hint="Chỉ cần quét mã vạch bản sao. Hệ thống tự tìm phiếu đang mở của bản sao này."
          />
          <form className="mt-6 space-y-5" noValidate onSubmit={submitReturn}>
            <TextField
              id="o-barcode-tra"
              ref={returnBarcodeRef}
              label="Mã vạch bản sao"
              size="lg"
              autoComplete="off"
              spellCheck={false}
              autoCapitalize="characters"
              value={returnBarcode}
              error={returnError}
              onChange={(event) => {
                setReturnBarcode(event.target.value);
                if (returnError) setReturnError(null);
              }}
              leading={<ScanBarcode size={20} />}
              placeholder="LIB-000123-1"
            />
            <Button type="submit" disabled={returnLoan.isPending} aria-busy={returnLoan.isPending} className="min-h-13 w-full text-base">
              {returnLoan.isPending && <InlineSpinner />}
              {returnLoan.isPending ? "Đang xử lý..." : "Nhận trả sách"}
            </Button>
          </form>

          <div className={RESULT_SLOT} aria-live="polite">
            {returnOutcome?.kind === "ok" ? (
              <div
                key={returnOutcome.data.loan.id}
                className={`anim-pop flex min-h-[12.5rem] items-center gap-4 rounded-2xl p-4 sm:gap-5 sm:p-5 ${
                  returnOutcome.data.fine ? "bg-danger-soft" : "bg-leaf-soft"
                }`}
              >
                <div className="h-28 w-[4.75rem] shrink-0 overflow-hidden rounded-xl bg-white shadow-[0_8px_18px_-8px_rgb(21_26_51/0.35)] sm:h-32 sm:w-[5.5rem]">
                  <BookCover title={returnOutcome.data.loan.copy.book.title} coverUrl={returnOutcome.data.loan.copy.book.coverUrl} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`flex items-center gap-2 text-sm font-bold ${returnOutcome.data.fine ? "text-danger" : "text-leaf"}`}>
                    <SuccessMark size={26} tone={returnOutcome.data.fine ? "warn" : "good"} />
                    {returnOutcome.data.fine ? "Đã nhận trả, có phát sinh phạt" : "Đã nhận trả đúng hạn"}
                  </p>
                  <p className="mt-2 line-clamp-2 font-semibold leading-snug">{returnOutcome.data.loan.copy.book.title}</p>
                  {returnOutcome.data.fine ? (
                    <p className="mt-1.5 text-sm leading-relaxed">
                      Trễ {returnOutcome.data.overdueDays} ngày, phạt{" "}
                      <strong className="tabular-nums">{formatCurrency(returnOutcome.data.fine.amount)}</strong>. Thu tiền tại mục
                      Tiền phạt.
                    </p>
                  ) : (
                    <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
                      Bản sao đã trở lại trạng thái sẵn sàng cho mượn.
                    </p>
                  )}
                </div>
              </div>
            ) : returnOutcome?.kind === "error" ? (
              <ErrorSlot message={returnOutcome.message} />
            ) : (
              <IdleSlot text="Sẵn sàng. Quét mã vạch bản sao bạn đọc mang tới trả, kết quả hiện ở đây." />
            )}
          </div>
        </section>
      </div>

      <section aria-labelledby="tieu-de-qua-han" className={`${CARD} mt-5`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="tieu-de-qua-han" className="text-xl font-bold tracking-tight">
              Phiếu đang quá hạn
            </h2>
            <p className="mt-1 text-sm text-ink-soft">Nhắc bạn đọc mang sách tới trả để tránh phạt tăng thêm.</p>
          </div>
          {overdue.data && overdue.data.total > 0 && (
            <Badge tone="bad">
              {overdueItems.length < overdue.data.total
                ? `${overdueItems.length} trên ${overdue.data.total} phiếu`
                : `${overdue.data.total} phiếu`}
            </Badge>
          )}
        </div>

        {overdue.isLoading ? (
          <div className="mt-5 space-y-3" role="status" aria-label="Đang tải phiếu quá hạn">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-[4.5rem]" />
            ))}
          </div>
        ) : overdueItems.length === 0 ? (
          <div className="mt-5 flex flex-col items-center rounded-2xl border border-dashed border-line bg-paper/70 px-6 py-10 text-center">
            <SuccessMark size={48} />
            <p className="mt-4 font-semibold">Hiện không có phiếu nào quá hạn</p>
            <p className="mt-1 text-sm text-ink-soft">Mọi cuốn sách đang mượn đều còn trong hạn.</p>
          </div>
        ) : (
          <ul className="mt-5 divide-y divide-line" aria-label="Danh sách phiếu mượn đang quá hạn">
            {overdueItems.map((loan, index) => (
              <li
                key={loan.id}
                className="ux-row-in grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-3 py-4 sm:grid-cols-[auto_minmax(0,1.1fr)_minmax(0,1.4fr)_auto_auto]"
                style={{ animationDelay: `${index * 45}ms` }}
              >
                <Avatar name={loan.user.fullName} />
                <div className="min-w-0">
                  <p className="truncate font-semibold">{loan.user.fullName}</p>
                  <p className="truncate text-xs text-ink-faint tabular-nums">{loan.user.memberCode}</p>
                </div>
                <div className="col-span-2 min-w-0 sm:col-span-1">
                  <p className="line-clamp-1 text-sm font-medium">{loan.copy.book.title}</p>
                  <p className="text-xs text-ink-faint">
                    Hạn trả <span className="tabular-nums">{formatDate(loan.dueAt)}</span>
                  </p>
                </div>
                <Badge tone="bad">{loan.overdueDays} ngày</Badge>
                <button
                  type="button"
                  onClick={() => prepareReturn(loan.copy.barcode)}
                  aria-label={`Nhận trả ${loan.copy.book.title} của ${loan.user.fullName}`}
                  className="inline-flex min-h-10 items-center justify-center rounded-xl bg-primary-soft px-4 text-sm font-semibold text-primary-ink transition-colors hover:bg-primary/15"
                >
                  Nhận trả
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
