from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from app.data_client import TrainingData
from app.overdue_model import FEATURE_NAMES, build_dataset, OverdueModel


def test_features_use_only_information_available_before_the_loan(training_data: TrainingData):
    x, y = build_dataset(training_data)

    assert x.shape[1] == len(FEATURE_NAMES)
    assert len(x) == len(y)
    # Phiếu đầu tiên của mỗi bạn đọc chưa có lịch sử → prior_loans = 0
    assert x[0][FEATURE_NAMES.index("prior_loans")] == 0
    assert set(y.tolist()) <= {0, 1}


def test_unreturned_loans_are_not_labelled():
    now = datetime.now(timezone.utc)
    data = TrainingData(
        books=[{"id": 1, "title": "T", "authors": "A", "category": "C", "description": None}],
        users=[{"id": 1, "memberType": "STUDENT"}],
        interactions=[
            {
                "userId": 1, "bookId": 1, "type": "LOAN", "score": None,
                "borrowedAt": (now - timedelta(days=5)).isoformat(),
                "dueAt": (now + timedelta(days=9)).isoformat(),
                "returnedAt": None, "categoryId": 1,
            }
        ],
    )
    x, y = build_dataset(data)
    assert len(x) == 0 and len(y) == 0


def test_fit_compares_both_models_and_picks_one(training_data: TrainingData):
    model = OverdueModel()
    metrics = model.fit(training_data)

    assert metrics is not None
    assert model.is_ready
    assert metrics.chosen in {"logistic_regression", "random_forest"}
    assert metrics.samples > 50
    assert 0.0 < metrics.positive_rate < 1.0
    for scores in (metrics.logistic_regression, metrics.random_forest):
        assert set(scores) == {"accuracy", "precision", "recall", "f1", "roc_auc"}
        assert 0.0 <= scores["roc_auc"] <= 1.0
    # Mô hình được chọn phải là mô hình có ROC-AUC cao hơn
    best = max(metrics.logistic_regression["roc_auc"], metrics.random_forest["roc_auc"])
    chosen = metrics.random_forest if metrics.chosen == "random_forest" else metrics.logistic_regression
    assert chosen["roc_auc"] == best


def test_predict_returns_a_probability(training_data: TrainingData):
    model = OverdueModel()
    model.fit(training_data)

    risk = model.predict(
        {"member_type": "STUDENT", "prior_loans": 5, "prior_overdue": 3,
         "active_loans": 2, "category_id": 1, "loan_days": 14, "month": 6}
    )
    assert 0.0 <= risk <= 1.0


def test_a_reader_who_always_returns_late_scores_higher(training_data: TrainingData):
    model = OverdueModel()
    model.fit(training_data)

    base = {"member_type": "STUDENT", "active_loans": 1, "category_id": 1, "loan_days": 14, "month": 3}
    careless = model.predict({**base, "prior_loans": 10, "prior_overdue": 9})
    reliable = model.predict({**base, "prior_loans": 10, "prior_overdue": 0})

    assert careless > reliable


def test_too_little_data_skips_training():
    model = OverdueModel()
    assert model.fit(TrainingData(books=[], users=[], interactions=[])) is None
    assert not model.is_ready
    with pytest.raises(RuntimeError):
        model.predict({"month": 1})
