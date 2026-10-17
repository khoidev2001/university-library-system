"""AI Service, gợi ý sách và dự báo trả trễ (LAB 3).

Hợp đồng API: SDD mục 5.9. Mô hình được huấn luyện lại khi service khởi động
(TRAIN_ON_STARTUP) và khi gọi POST /train; dữ liệu lấy từ Backend, không chạm CSDL.
"""
from __future__ import annotations

import logging
import threading
import time
from dataclasses import asdict
from datetime import datetime, timezone
from typing import Any

from contextlib import asynccontextmanager

from fastapi import BackgroundTasks, FastAPI, HTTPException, Query
from pydantic import BaseModel, Field

from .config import settings
from .data_client import BackendUnavailableError, fetch_training_data
from .overdue_model import OverdueModel
from .recommender import Recommender

logger = logging.getLogger("uls.ai")
logging.basicConfig(level=logging.INFO)

def initial_training() -> None:
    """Huấn luyện lần đầu, thử lại cho tới khi Backend sẵn sàng.

    Trong docker compose (và trên Render) AI thường lên trước Backend, nên lần gọi đầu
    hay thất bại. Không có vòng thử lại thì mô hình nằm im mãi dù Backend đã sống.
    """
    for attempt in range(1, settings.initial_training_attempts + 1):
        if run_training().get("status") == "ok":
            return
        if attempt < settings.initial_training_attempts:
            logger.info(
                "Chưa huấn luyện được (lần %s/%s), thử lại sau %ss",
                attempt, settings.initial_training_attempts, settings.initial_training_retry_seconds,
            )
            time.sleep(settings.initial_training_retry_seconds)
    logger.warning("Bỏ cuộc huấn luyện lần đầu; gọi POST /train khi Backend sẵn sàng.")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Huấn luyện lần đầu chạy nền để service trả /health ngay, không chờ mô hình."""
    if settings.train_on_startup:
        threading.Thread(target=initial_training, name="uls-ai-initial-training", daemon=True).start()
    yield


app = FastAPI(
    title="University Library System, AI Service",
    description="Gợi ý sách (TF-IDF + item-based CF) và dự báo nguy cơ trả trễ (LogReg / RandomForest).",
    version="1.0.0",
    lifespan=lifespan,
)

recommender = Recommender()
overdue_model = OverdueModel()
training_lock = threading.Lock()
last_training: dict[str, Any] = {"status": "never", "at": None, "error": None}


class PredictOverdueRequest(BaseModel):
    member_type: str = Field(default="STUDENT")
    prior_loans: int = 0
    prior_overdue: int = 0
    active_loans: int = 0
    category_id: int = 0
    loan_days: int = 14
    month: int = Field(default=1, ge=1, le=12)


def run_training() -> dict[str, Any]:
    """Huấn luyện cả hai mô hình. Lỗi backend KHÔNG làm sập service, giữ mô hình cũ."""
    if not training_lock.acquire(blocking=False):
        return {"status": "already_running"}
    try:
        data = fetch_training_data()
        if data.is_empty:
            last_training.update(status="skipped", at=datetime.now(timezone.utc).isoformat(), error="Không có dữ liệu")
            return last_training
        recommender.fit(data)
        overdue_model.fit(data)
        last_training.update(status="ok", at=datetime.now(timezone.utc).isoformat(), error=None)
        logger.info(
            "Huấn luyện xong: %s sách, %s bạn đọc, P@5=%s; dự báo trễ chọn %s",
            recommender.metrics.books if recommender.metrics else "?",
            recommender.metrics.users if recommender.metrics else "?",
            recommender.metrics.precision_at_5 if recommender.metrics else "?",
            overdue_model.metrics.chosen if overdue_model.metrics else "chưa đủ dữ liệu",
        )
    except BackendUnavailableError as exc:
        last_training.update(status="failed", at=datetime.now(timezone.utc).isoformat(), error=str(exc))
        logger.warning("Huấn luyện thất bại: %s", exc)
    finally:
        training_lock.release()
    return last_training


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "service": "ai-service",
        "models": {
            "recommender": "ready" if recommender.is_ready else "not_loaded",
            "overdue": "ready" if overdue_model.is_ready else "not_loaded",
        },
        "lastTraining": last_training,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/recommend")
def recommend(user_id: int = Query(..., ge=1), k: int = Query(10, ge=1, le=50)) -> dict[str, Any]:
    if not recommender.is_ready:
        raise HTTPException(status_code=503, detail="Mô hình gợi ý chưa sẵn sàng")
    book_ids, source = recommender.recommend(user_id, k)
    return {"user_id": user_id, "book_ids": book_ids, "source": source}


@app.post("/predict-overdue")
def predict_overdue(request: PredictOverdueRequest) -> dict[str, Any]:
    if not overdue_model.is_ready:
        raise HTTPException(status_code=503, detail="Mô hình dự báo chưa sẵn sàng")
    risk = overdue_model.predict(request.model_dump())
    chosen = overdue_model.metrics.chosen if overdue_model.metrics else "unknown"
    return {"risk": risk, "model": chosen}


@app.post("/train", status_code=202)
def train(background_tasks: BackgroundTasks) -> dict[str, Any]:
    background_tasks.add_task(run_training)
    return {"status": "training"}


@app.get("/metrics")
def metrics() -> dict[str, Any]:
    return {
        "recommender": asdict(recommender.metrics) if recommender.metrics else None,
        "overdue": asdict(overdue_model.metrics) if overdue_model.metrics else None,
        "lastTraining": last_training,
        "note": "Lịch sử mượn/trả là dữ liệu mô phỏng; số đo phản ánh quy luật mô phỏng.",
    }
