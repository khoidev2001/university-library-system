"""Lấy dữ liệu huấn luyện từ Backend (SDD ADR #4: AI không kết nối trực tiếp CSDL)."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

import httpx

from .config import settings


@dataclass
class TrainingData:
    books: list[dict[str, Any]] = field(default_factory=list)
    users: list[dict[str, Any]] = field(default_factory=list)
    interactions: list[dict[str, Any]] = field(default_factory=list)
    generated_at: str | None = None

    @property
    def is_empty(self) -> bool:
        return not self.books or not self.interactions


class BackendUnavailableError(RuntimeError):
    """Backend không trả được dữ liệu, giữ nguyên mô hình cũ, không làm sập service."""


def fetch_training_data(timeout: float = 60.0) -> TrainingData:
    url = f"{settings.backend_url}/internal/training-data"
    try:
        response = httpx.get(url, headers={"X-Internal-Key": settings.internal_api_key}, timeout=timeout)
        response.raise_for_status()
        payload = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise BackendUnavailableError(f"Không lấy được dữ liệu huấn luyện từ {url}: {exc}") from exc

    return TrainingData(
        books=payload.get("books", []),
        users=payload.get("users", []),
        interactions=payload.get("interactions", []),
        generated_at=payload.get("generatedAt"),
    )
