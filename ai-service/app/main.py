"""AI Service — gợi ý sách và dự báo trả trễ (LAB 3).

Sprint 0: chỉ có /health. Các endpoint /recommend, /predict-overdue, /train
được thêm ở Sprint 3 theo docs/PLAN.md mục 6.
"""
from datetime import datetime, timezone

from fastapi import FastAPI

app = FastAPI(
    title="University Library System — AI Service",
    description="Gợi ý sách (hybrid TF-IDF + item-based CF) và dự báo nguy cơ trả trễ.",
    version="0.1.0",
)


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "service": "ai-service",
        "models": {"recommender": "not_loaded", "overdue": "not_loaded"},
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
