"""Mô hình 1, gợi ý sách lai (PLAN mục 6).

Content-based: TF-IDF trên (tiêu đề + tác giả + thể loại + mô tả) → cosine similarity.
Collaborative: item-based trên ma trận bạn đọc × sách (lượt mượn và đánh giá >= 4).
Điểm cuối = content_weight × content + (1 - content_weight) × collaborative.

Đo chất lượng: giấu HOLDOUT_RATIO tương tác cuối của mỗi bạn đọc, tính Precision@5 / Recall@5.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import numpy as np
from scipy import sparse
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.preprocessing import normalize

from .config import settings
from .data_client import TrainingData

POSITIVE_RATING = 4  # đánh giá >= 4 sao coi như thích


@dataclass
class RecommenderMetrics:
    books: int
    users: int
    interactions: int
    precision_at_5: float | None
    recall_at_5: float | None
    evaluated_users: int
    trained_at: str | None


def build_corpus(books: list[dict[str, Any]]) -> list[str]:
    """Mô tả có thể trống (Google Books chưa chạy), khi đó TF-IDF dựa vào tiêu đề, tác giả, thể loại."""
    return [
        " ".join(
            filter(
                None,
                [
                    str(book.get("title") or ""),
                    str(book.get("authors") or ""),
                    str(book.get("category") or ""),
                    str(book.get("description") or "")[:2000],
                ],
            )
        )
        for book in books
    ]


class Recommender:
    """Giữ ma trận đã huấn luyện trong bộ nhớ; chưa huấn luyện thì `is_ready` = False."""

    def __init__(self) -> None:
        self.book_ids: list[int] = []
        self.index_of_book: dict[int, int] = {}
        self.user_items: dict[int, set[int]] = {}
        self.content_sim: np.ndarray | None = None
        self.item_sim: np.ndarray | None = None
        self.popular: list[int] = []
        self.metrics: RecommenderMetrics | None = None

    @property
    def is_ready(self) -> bool:
        return self.content_sim is not None and bool(self.book_ids)

    def fit(self, data: TrainingData, *, evaluate: bool = True) -> RecommenderMetrics:
        self.book_ids = [int(b["id"]) for b in data.books]
        self.index_of_book = {book_id: i for i, book_id in enumerate(self.book_ids)}

        tfidf = TfidfVectorizer(max_features=20000, stop_words="english", min_df=1)
        matrix = tfidf.fit_transform(build_corpus(data.books))
        self.content_sim = (normalize(matrix) @ normalize(matrix).T).toarray().astype(np.float32)
        np.fill_diagonal(self.content_sim, 0.0)

        interactions = self._positive_interactions(data)
        train, holdout = self._split(interactions) if evaluate else (interactions, {})

        self.user_items = train
        self.item_sim = self._item_similarity(train)
        self.popular = self._popular(train)

        precision, recall, evaluated = self._evaluate(holdout) if holdout else (None, None, 0)
        self.metrics = RecommenderMetrics(
            books=len(self.book_ids),
            users=len(train),
            interactions=sum(len(v) for v in train.values()),
            precision_at_5=precision,
            recall_at_5=recall,
            evaluated_users=evaluated,
            trained_at=data.generated_at,
        )
        return self.metrics

    def recommend(self, user_id: int, k: int) -> tuple[list[int], str]:
        """Trả (danh sách bookId, nguồn). Bạn đọc chưa có lịch sử → sách mượn nhiều."""
        if not self.is_ready:
            return [], "not_ready"
        seen = self.user_items.get(user_id, set())
        if not seen:
            return self.popular[:k], "popular"

        seen_idx = [self.index_of_book[b] for b in seen if b in self.index_of_book]
        if not seen_idx:
            return self.popular[:k], "popular"

        content_scores = self.content_sim[seen_idx].mean(axis=0)
        if self.item_sim is not None:
            collab_scores = self.item_sim[seen_idx].mean(axis=0)
        else:
            collab_scores = np.zeros_like(content_scores)

        scores = settings.content_weight * content_scores + (1 - settings.content_weight) * collab_scores
        scores[seen_idx] = -np.inf  # FR-AI-03: không gợi ý sách đã mượn

        top = np.argsort(-scores)[: k * 2]
        result = [self.book_ids[i] for i in top if np.isfinite(scores[i])][:k]
        return (result, "model") if result else (self.popular[:k], "popular")

    # --- nội bộ ---

    def _positive_interactions(self, data: TrainingData) -> dict[int, set[int]]:
        user_items: dict[int, set[int]] = {}
        for row in data.interactions:
            book_id = int(row["bookId"])
            if book_id not in self.index_of_book:
                continue
            if row["type"] == "RATING" and (row.get("score") or 0) < POSITIVE_RATING:
                continue
            user_items.setdefault(int(row["userId"]), set()).add(book_id)
        return user_items

    def _split(self, interactions: dict[int, set[int]]) -> tuple[dict[int, set[int]], dict[int, set[int]]]:
        """Giấu một phần tương tác của những bạn đọc có đủ lịch sử để đo được."""
        rng = np.random.default_rng(settings.random_seed)
        train: dict[int, set[int]] = {}
        holdout: dict[int, set[int]] = {}
        for user_id, items in interactions.items():
            if len(items) < 5:
                train[user_id] = set(items)
                continue
            ordered = sorted(items)
            rng.shuffle(ordered)
            cut = max(1, int(len(ordered) * settings.holdout_ratio))
            holdout[user_id] = set(ordered[:cut])
            train[user_id] = set(ordered[cut:])
        return train, holdout

    def _item_similarity(self, user_items: dict[int, set[int]]) -> np.ndarray | None:
        if not user_items:
            return None
        rows, cols = [], []
        for user_index, items in enumerate(user_items.values()):
            for book_id in items:
                rows.append(user_index)
                cols.append(self.index_of_book[book_id])
        if not rows:
            return None
        matrix = sparse.csr_matrix(
            (np.ones(len(rows), dtype=np.float32), (rows, cols)),
            shape=(len(user_items), len(self.book_ids)),
        )
        item_user = normalize(matrix.T.tocsr())
        similarity = (item_user @ item_user.T).toarray().astype(np.float32)
        np.fill_diagonal(similarity, 0.0)
        return similarity

    def _popular(self, user_items: dict[int, set[int]]) -> list[int]:
        counts: dict[int, int] = {}
        for items in user_items.values():
            for book_id in items:
                counts[book_id] = counts.get(book_id, 0) + 1
        return [book_id for book_id, _ in sorted(counts.items(), key=lambda kv: -kv[1])]

    def _evaluate(self, holdout: dict[int, set[int]], k: int = 5, max_users: int = 300) -> tuple[float, float, int]:
        users = list(holdout)[:max_users]
        precisions, recalls = [], []
        for user_id in users:
            recommended, _ = self.recommend(user_id, k)
            if not recommended:
                continue
            hits = len(set(recommended) & holdout[user_id])
            precisions.append(hits / k)
            recalls.append(hits / len(holdout[user_id]))
        if not precisions:
            return 0.0, 0.0, 0
        return round(float(np.mean(precisions)), 4), round(float(np.mean(recalls)), 4), len(precisions)
