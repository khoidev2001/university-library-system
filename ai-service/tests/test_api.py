from __future__ import annotations

import httpx
import pytest
from fastapi.testclient import TestClient

from app import main as app_main
from app.data_client import BackendUnavailableError, fetch_training_data
from app.main import app
from tests.conftest import make_training_data

client = TestClient(app)


@pytest.fixture(autouse=True)
def reset_models():
    """Mỗi test tự quyết mô hình đã huấn luyện hay chưa."""
    app_main.recommender.__init__()
    app_main.overdue_model.__init__()
    app_main.last_training.update(status="never", at=None, error=None)
    yield


def train_from_fixture() -> None:
    data = make_training_data()
    app_main.recommender.fit(data, evaluate=True)
    app_main.overdue_model.fit(data)


def test_health_reports_model_state():
    body = client.get("/health").json()
    assert body["status"] == "ok"
    assert body["models"] == {"recommender": "not_loaded", "overdue": "not_loaded"}

    train_from_fixture()
    body = client.get("/health").json()
    assert body["models"] == {"recommender": "ready", "overdue": "ready"}


def test_endpoints_return_503_until_trained():
    assert client.get("/recommend", params={"user_id": 1}).status_code == 503
    assert client.post("/predict-overdue", json={"member_type": "STUDENT"}).status_code == 503


def test_recommend_returns_book_ids():
    train_from_fixture()
    response = client.get("/recommend", params={"user_id": 1, "k": 5})
    assert response.status_code == 200
    body = response.json()
    assert body["user_id"] == 1
    assert len(body["book_ids"]) == 5
    assert body["source"] in {"model", "popular"}


def test_recommend_validates_its_query():
    train_from_fixture()
    assert client.get("/recommend", params={"user_id": 0}).status_code == 422
    assert client.get("/recommend", params={"user_id": 1, "k": 999}).status_code == 422


def test_predict_overdue_returns_risk_and_model_name():
    train_from_fixture()
    response = client.post(
        "/predict-overdue",
        json={"member_type": "STUDENT", "prior_loans": 4, "prior_overdue": 2,
              "active_loans": 1, "category_id": 2, "loan_days": 14, "month": 6},
    )
    assert response.status_code == 200
    body = response.json()
    assert 0.0 <= body["risk"] <= 1.0
    assert body["model"] in {"logistic_regression", "random_forest"}


def test_metrics_exposes_both_models_and_the_simulation_note():
    train_from_fixture()
    body = client.get("/metrics").json()
    assert body["recommender"]["books"] > 0
    assert body["overdue"]["chosen"] in {"logistic_regression", "random_forest"}
    assert "mô phỏng" in body["note"]


def test_training_survives_an_unreachable_backend(monkeypatch):
    def explode(*_args, **_kwargs):
        raise BackendUnavailableError("backend đang tắt")

    monkeypatch.setattr(app_main, "fetch_training_data", explode)
    result = app_main.run_training()

    assert result["status"] == "failed"
    assert "backend đang tắt" in result["error"]
    assert client.get("/health").status_code == 200  # service vẫn sống


def test_training_is_skipped_when_backend_has_no_data(monkeypatch):
    from app.data_client import TrainingData

    monkeypatch.setattr(app_main, "fetch_training_data", lambda *a, **k: TrainingData())
    assert app_main.run_training()["status"] == "skipped"


def test_train_endpoint_schedules_a_background_run(monkeypatch):
    calls: list[int] = []
    monkeypatch.setattr(app_main, "run_training", lambda: calls.append(1))
    response = client.post("/train")
    assert response.status_code == 202
    assert response.json() == {"status": "training"}
    assert calls == [1]


def test_fetch_training_data_wraps_transport_errors(monkeypatch):
    def boom(*_args, **_kwargs):
        raise httpx.ConnectError("connection refused")

    monkeypatch.setattr(httpx, "get", boom)
    with pytest.raises(BackendUnavailableError):
        fetch_training_data()
