"""Huấn luyện lần đầu phải thử lại: AI thường lên trước Backend."""
from __future__ import annotations

from app import main as app_main


def test_retries_until_the_backend_answers(monkeypatch):
    results = iter([{"status": "failed"}, {"status": "failed"}, {"status": "ok"}])
    calls: list[int] = []
    sleeps: list[float] = []

    monkeypatch.setattr(app_main, "run_training", lambda: (calls.append(1), next(results))[1])
    monkeypatch.setattr(app_main.time, "sleep", lambda s: sleeps.append(s))

    app_main.initial_training()

    assert len(calls) == 3, "phải thử lại cho tới khi thành công"
    assert len(sleeps) == 2, "giãn cách giữa các lần thử"


def test_stops_after_the_configured_number_of_attempts(monkeypatch):
    from dataclasses import replace

    calls: list[int] = []
    monkeypatch.setattr(app_main, "run_training", lambda: (calls.append(1), {"status": "failed"})[1])
    monkeypatch.setattr(app_main.time, "sleep", lambda _s: None)
    # Settings là frozen dataclass → thay cả đối tượng thay vì gán từng thuộc tính
    monkeypatch.setattr(app_main, "settings", replace(app_main.settings, initial_training_attempts=4))

    app_main.initial_training()

    assert len(calls) == 4, "không được thử vô hạn"


def test_stops_immediately_when_the_first_attempt_succeeds(monkeypatch):
    calls: list[int] = []
    monkeypatch.setattr(app_main, "run_training", lambda: (calls.append(1), {"status": "ok"})[1])
    monkeypatch.setattr(app_main.time, "sleep", lambda _s: None)

    app_main.initial_training()

    assert len(calls) == 1
