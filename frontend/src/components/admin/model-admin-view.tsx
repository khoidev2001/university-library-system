"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { apiFetch, formatDate } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { ModelMetrics, OverdueAccuracy } from "@/lib/types";
import { Alert, Button, Card, PageHeading, Spinner } from "../ui";
import { errorText, useNotice } from "./admin-ui";

function pct(value: number | null | undefined): string {
  return value === null || value === undefined ? "Chưa có" : `${(value * 100).toFixed(1).replace(".", ",")}%`;
}

function when(value: string | null | undefined): string {
  return value ? `${formatDate(value)} ${new Date(value).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}` : "Chưa huấn luyện";
}

export function ModelAdminView() {
  const { token, can } = useAuth();
  const { show, node } = useNotice();
  // Mốc lần huấn luyện trước khi bấm; khi mốc đổi nghĩa là huấn luyện nền đã xong
  const [waitingFrom, setWaitingFrom] = useState<string | null | undefined>(undefined);

  const metrics = useQuery({
    queryKey: ["model-metrics"],
    queryFn: () => apiFetch<ModelMetrics>("/recommendations/metrics", { token }),
    enabled: !!token,
    retry: false,
    refetchInterval: (query) => {
      if (waitingFrom === undefined) return false;
      return query.state.data?.lastTraining?.at !== waitingFrom ? false : 4000;
    },
  });
  const accuracy = useQuery({
    queryKey: ["model-accuracy"],
    queryFn: () => apiFetch<OverdueAccuracy>("/recommendations/overdue-accuracy", { token }),
    enabled: !!token,
  });

  const train = useMutation({
    mutationFn: () => apiFetch<{ status: string }>("/recommendations/train", { method: "POST", token }),
    onSuccess: () => {
      show("good", "Đã gửi yêu cầu huấn luyện lại. Số đo sẽ tự cập nhật khi xong, thường mất 10 đến 30 giây.");
      setWaitingFrom(metrics.data?.lastTraining?.at ?? null);
    },
    onError: (error) => show("bad", errorText(error, "Không gửi được yêu cầu huấn luyện.")),
  });

  const training = waitingFrom !== undefined && metrics.data?.lastTraining?.at === waitingFrom;
  const recommender = metrics.data?.recommender;
  const overdue = metrics.data?.overdue;

  return (
    <div>
      <PageHeading
        eyebrow="Hệ thống"
        title="Mô hình gợi ý và dự báo"
        description="Theo dõi chất lượng mô hình gợi ý sách và dự báo nguy cơ trả trễ. Mô hình tự huấn luyện khi khởi động, quản trị viên có thể huấn luyện lại khi dữ liệu mượn trả thay đổi nhiều."
        action={
          can("ADMIN") ? (
            <Button
              disabled={train.isPending || training}
              onClick={() => {
                if (window.confirm("Huấn luyện lại mô hình từ dữ liệu mượn trả hiện tại?")) train.mutate();
              }}
            >
              {train.isPending ? "Đang gửi..." : training ? "Đang huấn luyện..." : "Huấn luyện lại"}
            </Button>
          ) : undefined
        }
      />
      {node}

      {metrics.isLoading ? (
        <Spinner />
      ) : metrics.isError ? (
        <div className="mt-6">
          <Alert tone="bad">
            {errorText(metrics.error, "Dịch vụ mô hình đang khởi động hoặc tạm thời không phản hồi.")} Hệ thống vẫn chạy bình
            thường: gợi ý rơi về danh sách sách mượn nhiều và dự báo trả trễ được bỏ qua.
          </Alert>
        </div>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Card>
            <h2 className="font-serif text-lg font-bold">Gợi ý sách cho bạn đọc</h2>
            {recommender ? (
              <dl className="mt-4 space-y-2.5 text-sm">
                <Stat label="Độ chính xác top 5 (Precision@5)" value={pct(recommender.precision_at_5)} />
                <Stat label="Độ phủ top 5 (Recall@5)" value={pct(recommender.recall_at_5)} />
                <Stat label="Số bạn đọc dùng để đánh giá" value={recommender.evaluated_users.toLocaleString("vi-VN")} />
                <Stat label="Số đầu sách" value={recommender.books.toLocaleString("vi-VN")} />
                <Stat label="Số bạn đọc" value={recommender.users.toLocaleString("vi-VN")} />
                <Stat label="Số lượt tương tác" value={recommender.interactions.toLocaleString("vi-VN")} />
                <Stat label="Huấn luyện lần cuối" value={when(recommender.trained_at)} />
              </dl>
            ) : (
              <p className="mt-3 text-sm text-ink-soft">Mô hình chưa được huấn luyện.</p>
            )}
          </Card>

          <Card>
            <h2 className="font-serif text-lg font-bold">Dự báo nguy cơ trả trễ</h2>
            {overdue ? (
              <dl className="mt-4 space-y-2.5 text-sm">
                <Stat label="Mô hình đang dùng" value={overdue.chosen === "random_forest" ? "Rừng ngẫu nhiên" : "Hồi quy logistic"} />
                <Stat label="Số mẫu huấn luyện" value={overdue.samples.toLocaleString("vi-VN")} />
                <Stat label="Tỷ lệ phiếu trả trễ trong dữ liệu" value={pct(overdue.positive_rate)} />
                <Stat label="ROC-AUC (hồi quy logistic)" value={fixed(overdue.logistic_regression.roc_auc)} />
                <Stat label="ROC-AUC (rừng ngẫu nhiên)" value={fixed(overdue.random_forest.roc_auc)} />
                <Stat label="Huấn luyện lần cuối" value={when(overdue.trained_at)} />
              </dl>
            ) : (
              <p className="mt-3 text-sm text-ink-soft">Mô hình chưa được huấn luyện.</p>
            )}
          </Card>
        </div>
      )}

      <Card className="mt-6">
        <h2 className="font-serif text-lg font-bold">Độ chính xác trên phiếu đã trả</h2>
        <p className="mt-1 text-sm text-ink-soft">
          So dự báo lúc cho mượn với kết quả thật khi bạn đọc trả sách, chỉ tính các phiếu được dự báo nguy cơ từ 50% trở lên.
        </p>
        {accuracy.isLoading ? (
          <Spinner />
        ) : accuracy.data ? (
          <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-4">
            <Metric label="Phiếu đã có dự báo" value={accuracy.data.sampled.toLocaleString("vi-VN")} />
            <Metric label="Dự báo nguy cơ cao" value={accuracy.data.predictedHigh.toLocaleString("vi-VN")} />
            <Metric label="Thực tế trả trễ" value={accuracy.data.actuallyLate.toLocaleString("vi-VN")} />
            <Metric label="Tỷ lệ đoán đúng" value={pct(accuracy.data.hitRate)} />
          </dl>
        ) : null}
        {accuracy.data && accuracy.data.sampled === 0 && (
          <p className="mt-3 text-sm text-ink-faint">Chưa có phiếu nào vừa được dự báo vừa được trả, nên chưa tính được.</p>
        )}
      </Card>

      {metrics.data?.note && <p className="mt-4 text-xs text-ink-faint">{metrics.data.note}</p>}
    </div>
  );
}

function fixed(value: number | undefined): string {
  return value === undefined ? "Chưa có" : value.toFixed(3).replace(".", ",");
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line pb-2 last:border-none">
      <dt className="text-ink-faint">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-ink-faint">{label}</dt>
      <dd className="mt-1 font-serif text-2xl font-bold">{value}</dd>
    </div>
  );
}
