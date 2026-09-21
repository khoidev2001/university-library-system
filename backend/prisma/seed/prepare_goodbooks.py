"""Prepare the goodbooks-10k subset used by the seed (docs/PLAN.md mục 6).

Downloads books.csv + ratings.csv (CC BY-SA 4.0, zygmuntz/goodbooks-10k), keeps the
1.000 most-rated books that have an ISBN13, the 2.000 users with most ratings on those
books, and enriches books via Google Books (description, publisher, categories) with a
JSON cache so re-runs never re-download.

Usage (from backend/):
  ../ai-service/.venv/Scripts/python prisma/seed/prepare_goodbooks.py [--books 1000] [--users 2000] [--google 0|N]
Outputs: prisma/seed/data/{books.csv, ratings.csv, google-books.json}
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

import pandas as pd

RAW = "https://raw.githubusercontent.com/zygmuntz/goodbooks-10k/master/"
DATA = Path(__file__).resolve().parent / "data"
CACHE = DATA / "raw"
GOOGLE_URL = "https://www.googleapis.com/books/v1/volumes"


def download(name: str) -> Path:
    CACHE.mkdir(parents=True, exist_ok=True)
    target = CACHE / name
    if not target.exists():
        print(f"downloading {name} ...", flush=True)
        urllib.request.urlretrieve(RAW + name, target)
    return target


def select_books(n: int) -> pd.DataFrame:
    books = pd.read_csv(download("books.csv"))
    books = books[books["isbn13"].notna() & books["original_title"].notna()].copy()
    books["isbn13"] = books["isbn13"].astype("int64").astype(str)
    books = books.sort_values("ratings_count", ascending=False)
    books = books.drop_duplicates(subset="isbn13", keep="first").head(n)  # goodbooks có vài ISBN trùng
    out = pd.DataFrame(
        {
            "goodbooks_id": books["book_id"],
            "isbn13": books["isbn13"],
            "title": books["title"].str.strip(),
            "authors": books["authors"].str.strip(),
            "year": books["original_publication_year"].fillna(0).astype(int),
            "language": books["language_code"].fillna("eng"),
            "average_rating": books["average_rating"],
            "ratings_count": books["ratings_count"],
            "image_url": books["image_url"],
        }
    )
    return out.reset_index(drop=True)


GENRES: list[tuple[str, tuple[str, ...]]] = [
    ("Fantasy", ("fantasy", "magic", "dragons")),
    ("Science Fiction", ("science-fiction", "sci-fi", "scifi", "dystopia", "dystopian")),
    ("Mystery & Thriller", ("mystery", "thriller", "crime", "suspense", "detective")),
    ("Romance", ("romance", "love")),
    ("Horror", ("horror", "vampires", "zombies")),
    ("Young Adult", ("young-adult", "ya", "teen")),
    ("Children", ("children", "childrens", "picture-books", "kids")),
    ("Classics", ("classics", "classic", "literature")),
    ("History", ("history", "historical", "historical-fiction", "war")),
    ("Biography & Memoir", ("biography", "memoir", "autobiography")),
    ("Science", ("science", "physics", "biology", "psychology", "nature")),
    ("Philosophy & Religion", ("philosophy", "religion", "spirituality", "christian", "buddhism")),
    ("Business & Self-help", ("business", "self-help", "self-improvement", "leadership", "economics", "finance")),
    ("Comics & Graphic Novels", ("comics", "graphic-novels", "graphic-novel", "manga")),
    ("Poetry & Drama", ("poetry", "plays", "drama")),
    ("Humor", ("humor", "comedy", "funny")),
    ("Non-fiction", ("non-fiction", "nonfiction", "essays", "politics", "travel")),
    ("Fiction", ("fiction", "contemporary", "novels", "adult-fiction")),
]


def genre_from_tags(book_ids: set[int]) -> dict[int, str]:
    """Thể loại suy từ tag người dùng gắn (goodbooks book_tags + tags), theo thứ tự ưu tiên GENRES."""
    tags = pd.read_csv(download("tags.csv")).set_index("tag_id")["tag_name"].to_dict()
    book_tags = pd.read_csv(download("book_tags.csv"))
    ids = pd.read_csv(download("books.csv"))[["book_id", "goodreads_book_id"]]
    book_tags = book_tags.merge(ids, on="goodreads_book_id")
    book_tags = book_tags[book_tags["book_id"].isin(book_ids)].sort_values("count", ascending=False)
    result: dict[int, str] = {}
    for book_id, group in book_tags.groupby("book_id"):
        top = [str(tags.get(t, "")).lower() for t in group["tag_id"].head(40)]
        chosen = "Fiction"
        best = 10**9
        for genre, keys in GENRES:
            for i, tag in enumerate(top):
                if tag in keys and i < best:
                    best, chosen = i, genre
                    break
        result[int(book_id)] = chosen
    return result


def select_ratings(book_ids: set[int], n_users: int) -> pd.DataFrame:
    ratings = pd.read_csv(download("ratings.csv"))
    ratings = ratings[ratings["book_id"].isin(book_ids)]
    top_users = ratings.groupby("user_id").size().sort_values(ascending=False).head(n_users).index
    ratings = ratings[ratings["user_id"].isin(top_users)]
    return ratings[["user_id", "book_id", "rating"]].reset_index(drop=True)


def google_lookup(isbn: str, api_key: str | None) -> dict | None:
    params = {"q": f"isbn:{isbn}", "maxResults": "1"}
    if api_key:
        params["key"] = api_key
    url = f"{GOOGLE_URL}?{urllib.parse.urlencode(params)}"
    try:
        with urllib.request.urlopen(url, timeout=10) as res:
            body = json.load(res)
    except Exception as e:  # noqa: BLE001 — lỗi mạng/429: không cache, thử lại lần sau
        print(f"  {isbn}: {e}", file=sys.stderr)
        raise LookupError(str(e)) from e
    info = (body.get("items") or [{}])[0].get("volumeInfo")
    if not info:
        return None  # thật sự không có → cache None
    return {
        "title": info.get("title"),
        "authors": info.get("authors", []),
        "description": info.get("description"),
        "publisher": info.get("publisher"),
        "publishedDate": info.get("publishedDate"),
        "categories": info.get("categories", []),
        "pageCount": info.get("pageCount"),
        "thumbnail": (info.get("imageLinks") or {}).get("thumbnail"),
    }


def enrich(books: pd.DataFrame, limit: int, api_key: str | None) -> dict[str, dict | None]:
    cache_path = DATA / "google-books.json"
    cache: dict[str, dict | None] = json.loads(cache_path.read_text(encoding="utf-8")) if cache_path.exists() else {}
    todo = [isbn for isbn in books["isbn13"] if isbn not in cache][:limit]
    print(f"google books: {len(cache)} cached, fetching {len(todo)}", flush=True)
    failures = 0
    for i, isbn in enumerate(todo, 1):
        try:
            cache[isbn] = google_lookup(isbn, api_key)
            failures = 0
        except LookupError:
            failures += 1
            if failures >= 5:
                print("  quá nhiều lỗi liên tiếp (rate limit?) — dừng, sẽ tiếp tục ở lần chạy sau", flush=True)
                break
        if i % 25 == 0:
            cache_path.write_text(json.dumps(cache, ensure_ascii=False, indent=1), encoding="utf-8")
            print(f"  {i}/{len(todo)}", flush=True)
        time.sleep(0.35 if api_key else 1.2)  # tôn trọng giới hạn tần suất
    cache_path.write_text(json.dumps(cache, ensure_ascii=False, indent=1), encoding="utf-8")
    return cache


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--books", type=int, default=1000)
    parser.add_argument("--users", type=int, default=2000)
    parser.add_argument("--google", type=int, default=0, help="số ISBN gọi Google Books (0 = bỏ qua)")
    args = parser.parse_args()

    DATA.mkdir(parents=True, exist_ok=True)
    books = select_books(args.books)
    genres = genre_from_tags(set(books["goodbooks_id"]))
    books["genre"] = books["goodbooks_id"].map(genres).fillna("Fiction")
    ratings = select_ratings(set(books["goodbooks_id"]), args.users)
    books.to_csv(DATA / "books.csv", index=False)
    ratings.to_csv(DATA / "ratings.csv", index=False)
    print(f"books: {len(books)}, users: {ratings['user_id'].nunique()}, ratings: {len(ratings)}")

    if args.google > 0:
        cache = enrich(books, args.google, os.environ.get("GOOGLE_BOOKS_API_KEY"))
        checked = [cache[i] for i in books["isbn13"] if i in cache]
        with_desc = sum(1 for c in checked if c and c.get("description"))
        with_cat = sum(1 for c in checked if c and c.get("categories"))
        print(f"google coverage on {len(checked)} ISBN: description {with_desc}, categories {with_cat}")


if __name__ == "__main__":
    main()
