"""Mô hình 2 — dự báo nguy cơ trả trễ (PLAN mục 6).

Đặc trưng: số lần mượn trước đó, số/tỉ lệ lần trễ trước đó, số sách đang giữ,
loại bạn đọc, thể loại sách, số ngày mượn, tháng mượn (mùa thi).
So Logistic Regression với Random Forest trên 20% tập kiểm tra, chọn ROC-AUC cao hơn.

LƯU Ý: dữ liệu lịch sử là MÔ PHỎNG (xem prisma/seed/simulate-loans.ts), nên các số đo
dưới đây phản ánh quy luật mô phỏng, không phải hành vi bạn đọc thật. Báo cáo phải ghi rõ.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import datetime
from typing import Any

import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score, roc_auc_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from .config import settings
from .data_client import TrainingData

FEATURE_NAMES = [
    "prior_loans",
    "prior_overdue",
    "prior_overdue_rate",
    "active_loans",
    "is_lecturer",
    "category_id",
    "loan_days",
    "month",
    "is_exam_month",
]
EXAM_MONTHS = {1, 6}


@dataclass
class ModelScores:
    accuracy: float
    precision: float
    recall: float
    f1: float
    roc_auc: float


@dataclass
class OverdueMetrics:
    samples: int
    positive_rate: float
    chosen: str
    logistic_regression: dict[str, float]
    random_forest: dict[str, float]
    trained_at: str | None


def parse_time(value: str | None) -> datetime | None:
    if not value:
        return None
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def build_dataset(data: TrainingData) -> tuple[np.ndarray, np.ndarray]:
    """Dựng đặc trưng theo trình tự thời gian: mỗi phiếu chỉ dùng thông tin có TRƯỚC khi mượn."""
    lecturer_ids = {int(u["id"]) for u in data.users if u.get("memberType") == "LECTURER"}
    loans = [row for row in data.interactions if row["type"] == "LOAN" and row.get("borrowedAt")]
    loans.sort(key=lambda r: r["borrowedAt"])

    prior_loans: dict[int, int] = {}
    prior_overdue: dict[int, int] = {}
    open_loans: dict[int, list[datetime]] = {}

    features, labels = [], []
    for row in loans:
        user_id = int(row["userId"])
        borrowed_at = parse_time(row["borrowedAt"])
        due_at = parse_time(row["dueAt"])
        returned_at = parse_time(row.get("returnedAt"))
        if borrowed_at is None or due_at is None:
            continue
        if returned_at is None:
            continue  # chưa trả thì chưa có nhãn

        # số sách đang giữ tại thời điểm mượn
        still_open = [d for d in open_loans.get(user_id, []) if d > borrowed_at]
        open_loans[user_id] = still_open

        seen = prior_loans.get(user_id, 0)
        late_before = prior_overdue.get(user_id, 0)
        features.append(
            [
                seen,
                late_before,
                (late_before / seen) if seen else 0.0,
                len(still_open),
                1.0 if user_id in lecturer_ids else 0.0,
                float(row.get("categoryId") or 0),
                (due_at - borrowed_at).days,
                borrowed_at.month,
                1.0 if borrowed_at.month in EXAM_MONTHS else 0.0,
            ]
        )
        is_late = returned_at.date() > due_at.date()
        labels.append(1 if is_late else 0)

        prior_loans[user_id] = seen + 1
        if is_late:
            prior_overdue[user_id] = late_before + 1
        open_loans.setdefault(user_id, []).append(returned_at)

    return np.array(features, dtype=np.float64), np.array(labels, dtype=np.int8)


def score_model(model: Any, x_test: np.ndarray, y_test: np.ndarray) -> ModelScores:
    predictions = model.predict(x_test)
    probabilities = model.predict_proba(x_test)[:, 1]
    return ModelScores(
        accuracy=round(float(accuracy_score(y_test, predictions)), 4),
        precision=round(float(precision_score(y_test, predictions, zero_division=0)), 4),
        recall=round(float(recall_score(y_test, predictions, zero_division=0)), 4),
        f1=round(float(f1_score(y_test, predictions, zero_division=0)), 4),
        roc_auc=round(float(roc_auc_score(y_test, probabilities)), 4),
    )


class OverdueModel:
    def __init__(self) -> None:
        self.model: Any | None = None
        self.metrics: OverdueMetrics | None = None

    @property
    def is_ready(self) -> bool:
        return self.model is not None

    def fit(self, data: TrainingData) -> OverdueMetrics | None:
        x, y = build_dataset(data)
        # Cần đủ mẫu và cả hai nhãn, nếu không thì không huấn luyện (giữ mô hình cũ).
        if len(y) < 50 or len(np.unique(y)) < 2:
            return None

        x_train, x_test, y_train, y_test = train_test_split(
            x, y, test_size=0.2, random_state=settings.random_seed, stratify=y
        )
        logistic = Pipeline(
            [("scaler", StandardScaler()), ("clf", LogisticRegression(max_iter=1000, class_weight="balanced"))]
        ).fit(x_train, y_train)
        forest = RandomForestClassifier(
            n_estimators=200, max_depth=12, min_samples_leaf=5,
            class_weight="balanced", random_state=settings.random_seed, n_jobs=-1,
        ).fit(x_train, y_train)

        logistic_scores = score_model(logistic, x_test, y_test)
        forest_scores = score_model(forest, x_test, y_test)
        chosen_is_forest = forest_scores.roc_auc >= logistic_scores.roc_auc
        self.model = forest if chosen_is_forest else logistic

        self.metrics = OverdueMetrics(
            samples=int(len(y)),
            positive_rate=round(float(y.mean()), 4),
            chosen="random_forest" if chosen_is_forest else "logistic_regression",
            logistic_regression=asdict(logistic_scores),
            random_forest=asdict(forest_scores),
            trained_at=data.generated_at,
        )
        return self.metrics

    def predict(self, features: dict[str, Any]) -> float:
        if self.model is None:
            raise RuntimeError("Mô hình dự báo chưa sẵn sàng")
        month = int(features.get("month") or 1)
        prior_loans = float(features.get("prior_loans") or 0)
        prior_overdue = float(features.get("prior_overdue") or 0)
        vector = np.array(
            [[
                prior_loans,
                prior_overdue,
                (prior_overdue / prior_loans) if prior_loans else 0.0,
                float(features.get("active_loans") or 0),
                1.0 if features.get("member_type") == "LECTURER" else 0.0,
                float(features.get("category_id") or 0),
                float(features.get("loan_days") or 14),
                float(month),
                1.0 if month in EXAM_MONTHS else 0.0,
            ]],
            dtype=np.float64,
        )
        return round(float(self.model.predict_proba(vector)[0, 1]), 4)
