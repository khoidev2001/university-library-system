from __future__ import annotations

from app.data_client import TrainingData
from app.recommender import build_corpus, Recommender


def test_corpus_joins_fields_and_survives_missing_description():
    corpus = build_corpus(
        [
            {"title": "Dune", "authors": "Herbert", "category": "Sci-Fi", "description": "Sand"},
            {"title": "No Desc", "authors": "A", "category": "History", "description": None},
        ]
    )
    assert "Dune" in corpus[0] and "Herbert" in corpus[0] and "Sand" in corpus[0]
    assert corpus[1].strip() == "No Desc A History"


def test_fit_reports_metrics_and_marks_ready(training_data: TrainingData):
    recommender = Recommender()
    metrics = recommender.fit(training_data)

    assert recommender.is_ready
    assert metrics.books == len(training_data.books)
    assert metrics.users > 0
    assert metrics.evaluated_users > 0
    assert 0.0 <= metrics.precision_at_5 <= 1.0
    assert 0.0 <= metrics.recall_at_5 <= 1.0


def test_recommendations_exclude_already_borrowed_books(training_data: TrainingData):
    recommender = Recommender()
    recommender.fit(training_data, evaluate=False)

    user_id = 1
    seen = recommender.user_items[user_id]
    book_ids, source = recommender.recommend(user_id, 10)

    assert source == "model"
    assert book_ids, "phải gợi ý được ít nhất một cuốn"
    assert not set(book_ids) & seen, "không được gợi ý sách bạn đọc đã mượn"


def test_recommendations_follow_the_reader_taste(training_data: TrainingData):
    """Bạn đọc chỉ mượn một thể loại → gợi ý phải nghiêng về thể loại đó."""
    recommender = Recommender()
    recommender.fit(training_data, evaluate=False)
    category_of = {int(b["id"]): b["category"] for b in training_data.books}

    user_id = 2
    favourite = {category_of[b] for b in recommender.user_items[user_id]}
    book_ids, _ = recommender.recommend(user_id, 5)
    matching = sum(1 for b in book_ids if category_of[b] in favourite)

    assert matching >= 3, f"chỉ {matching}/5 cuốn cùng thể loại ưa thích"


def test_cold_start_falls_back_to_popular(training_data: TrainingData):
    recommender = Recommender()
    recommender.fit(training_data, evaluate=False)

    book_ids, source = recommender.recommend(999_999, 5)

    assert source == "popular"
    assert len(book_ids) == 5


def test_untrained_recommender_reports_not_ready():
    recommender = Recommender()
    assert not recommender.is_ready
    assert recommender.recommend(1, 5) == ([], "not_ready")
