"""Dữ liệu giả lập dùng chung cho test — đủ cấu trúc để huấn luyện thật được."""
from __future__ import annotations

import random
from datetime import datetime, timedelta, timezone

import pytest

from app.data_client import TrainingData

GENRES = ["Fantasy", "Science Fiction", "Classics", "History", "Romance"]


def make_training_data(books: int = 60, users: int = 40, seed: int = 7) -> TrainingData:
    rng = random.Random(seed)
    now = datetime.now(timezone.utc)

    book_rows = [
        {
            "id": book_id,
            "title": f"{GENRES[book_id % len(GENRES)]} Book {book_id}",
            "authors": f"Author {book_id % 11}",
            "category": GENRES[book_id % len(GENRES)],
            "description": f"A story about {GENRES[book_id % len(GENRES)].lower()} number {book_id}",
        }
        for book_id in range(1, books + 1)
    ]
    user_rows = [
        {"id": user_id, "memberType": "LECTURER" if user_id % 10 == 0 else "STUDENT"}
        for user_id in range(1, users + 1)
    ]

    interactions: list[dict] = []
    for user_id in range(1, users + 1):
        # Mỗi bạn đọc gắn với một thể loại ưa thích → tín hiệu để mô hình học được
        favourite = user_id % len(GENRES)
        picks = [b for b in range(1, books + 1) if b % len(GENRES) == favourite][:8]
        for order, book_id in enumerate(picks):
            borrowed = now - timedelta(days=300 - order * 20 - user_id)
            loan_days = 30 if user_id % 10 == 0 else 14
            due = borrowed + timedelta(days=loan_days)
            late = rng.random() < (0.5 if user_id % 3 == 0 else 0.1)
            returned = due + timedelta(days=rng.randint(1, 9) if late else -rng.randint(0, 5))
            interactions.append(
                {
                    "userId": user_id,
                    "bookId": book_id,
                    "type": "LOAN",
                    "score": None,
                    "borrowedAt": borrowed.isoformat(),
                    "dueAt": due.isoformat(),
                    "returnedAt": returned.isoformat(),
                    "categoryId": favourite + 1,
                }
            )
            interactions.append(
                {
                    "userId": user_id,
                    "bookId": book_id,
                    "type": "RATING",
                    "score": 5 if not late else 4,
                    "borrowedAt": None,
                    "dueAt": None,
                    "returnedAt": None,
                    "categoryId": None,
                }
            )

    return TrainingData(books=book_rows, users=user_rows, interactions=interactions, generated_at=now.isoformat())


@pytest.fixture()
def training_data() -> TrainingData:
    return make_training_data()
