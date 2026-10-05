"""Cấu hình AI Service, đọc từ biến môi trường (NFR-PORT-02)."""
from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    backend_url: str
    internal_api_key: str
    model_dir: str
    content_weight: float
    train_on_startup: bool
    holdout_ratio: float
    random_seed: int
    initial_training_attempts: int
    initial_training_retry_seconds: float

    @staticmethod
    def from_env() -> "Settings":
        return Settings(
            backend_url=os.environ.get("BACKEND_URL", "http://localhost:3000/api").rstrip("/"),
            internal_api_key=os.environ.get("INTERNAL_API_KEY", "dev-internal"),
            model_dir=os.environ.get("MODEL_DIR", "/tmp/uls-models"),
            # Trộn content-based và collaborative filtering (PLAN mục 6): 0.5/0.5
            content_weight=float(os.environ.get("CONTENT_WEIGHT", "0.5")),
            train_on_startup=os.environ.get("TRAIN_ON_STARTUP", "1") == "1",
            holdout_ratio=float(os.environ.get("HOLDOUT_RATIO", "0.2")),
            random_seed=int(os.environ.get("RANDOM_SEED", "42")),
            # Backend thường lên sau AI (compose, Render cold start) nên phải thử lại
            initial_training_attempts=int(os.environ.get("INITIAL_TRAINING_ATTEMPTS", "20")),
            initial_training_retry_seconds=float(os.environ.get("INITIAL_TRAINING_RETRY_SECONDS", "10")),
        )


settings = Settings.from_env()
