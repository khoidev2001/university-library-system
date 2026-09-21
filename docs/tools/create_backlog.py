"""Create the Product Backlog on GitHub from SRS.md Appendix A.

Reads the User Story table in docs/srs/SRS.md (single source of truth) and, via
the `gh` CLI, creates labels, sprint milestones and one issue per story.
Idempotent: an issue whose title starts with the same US id is skipped.

Usage:
  python create_backlog.py --repo owner/name            # create everything
  python create_backlog.py --repo owner/name --dry-run  # print only
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

SRS = Path(__file__).resolve().parents[1] / "srs" / "SRS.md"

LABELS = {
    "user-story": ("0E8A16", "Product backlog item"),
    "must": ("B60205", "MoSCoW: Must have"),
    "should": ("FBCA04", "MoSCoW: Should have"),
    "could": ("C5DEF5", "MoSCoW: Could have"),
    "sprint-1": ("1D76DB", "Sprint 1 (tuần 1-2)"),
    "sprint-2": ("0052CC", "Sprint 2 (tuần 3-4)"),
    "sprint-3": ("5319E7", "Sprint 3 (tuần 5-6)"),
}
MILESTONES = {
    "1": ("Sprint 1 — Auth, sách, bạn đọc, tìm kiếm", "2026-10-05"),
    "2": ("Sprint 2 — Mượn/trả, phạt, thống kê", "2026-10-19"),
    "3": ("Sprint 3 — AI gợi ý & dự báo", "2026-11-02"),
}


def gh(*args: str, check: bool = True) -> str:
    result = subprocess.run(["gh", *args], capture_output=True, text=True, encoding="utf-8")
    if check and result.returncode != 0:
        raise RuntimeError(f"gh {' '.join(args)}\n{result.stderr}")
    return result.stdout.strip()


def parse_stories(md: str) -> list[dict]:
    stories = []
    for line in md.splitlines():
        if not line.startswith("| US"):
            continue
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if len(cells) != 6:
            continue
        us_id, story, ac, points, priority, sprint = cells
        story = story.replace("**", "")
        criteria = re.split(r"\s(?=\d+\.\s)", ac)
        stories.append(
            {
                "id": us_id,
                "story": story,
                "criteria": [re.sub(r"^\d+\.\s*", "", c).strip() for c in criteria if c.strip()],
                "points": int(points),
                "priority": priority.lower(),
                "sprint": sprint,
            }
        )
    return stories


def issue_title(s: dict) -> str:
    short = re.sub(r"^As an? .+?, I want to ", "", s["story"], flags=re.IGNORECASE)
    short = re.split(r"(?:, so that|;)", short)[0]
    return f"{s['id']}: {short}"


def issue_body(s: dict) -> str:
    ac = "\n".join(f"- [ ] {c}" for c in s["criteria"])
    return (
        f"**User Story**\n\n{s['story']}\n\n"
        f"**Acceptance Criteria**\n\n{ac}\n\n"
        f"**Story Points:** {s['points']} · **Ưu tiên:** {s['priority'].capitalize()} · "
        f"**Sprint:** {s['sprint']}\n\n"
        f"Nguồn: `docs/srs/SRS.md` — Phụ lục A."
    )


def ensure_labels(repo: str, dry: bool) -> None:
    for name, (color, desc) in LABELS.items():
        print(f"label {name}")
        if not dry:
            gh("label", "create", name, "--repo", repo, "--color", color, "--description", desc, "--force")


def ensure_milestones(repo: str, dry: bool) -> dict[str, str]:
    existing = {}
    if not dry:
        raw = gh("api", f"repos/{repo}/milestones?state=all", check=False)
        for m in json.loads(raw or "[]"):
            existing[m["title"]] = m["title"]
    titles = {}
    for sprint, (title, due) in MILESTONES.items():
        titles[sprint] = title
        if title in existing:
            continue
        print(f"milestone {title}")
        if not dry:
            gh("api", f"repos/{repo}/milestones", "-f", f"title={title}", "-f", f"due_on={due}T23:59:59Z")
    return titles


def existing_issue_ids(repo: str) -> set[str]:
    raw = gh("issue", "list", "--repo", repo, "--state", "all", "--limit", "200", "--json", "title")
    return {t["title"].split(":")[0] for t in json.loads(raw or "[]")}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo", required=True)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    stories = parse_stories(SRS.read_text(encoding="utf-8"))
    if len(stories) < 15:
        sys.exit(f"only {len(stories)} stories parsed from {SRS}")
    print(f"{len(stories)} stories, {sum(s['points'] for s in stories)} points")

    ensure_labels(args.repo, args.dry_run)
    milestones = ensure_milestones(args.repo, args.dry_run)
    done = set() if args.dry_run else existing_issue_ids(args.repo)

    for s in stories:
        if s["id"] in done:
            print(f"skip {s['id']} (exists)")
            continue
        title = issue_title(s)
        labels = ["user-story", s["priority"], f"sprint-{s['sprint']}"]
        print(f"issue {title}  [{', '.join(labels)}]")
        if args.dry_run:
            continue
        gh(
            "issue", "create", "--repo", args.repo,
            "--title", title, "--body", issue_body(s),
            "--label", ",".join(labels), "--milestone", milestones[s["sprint"]],
        )


if __name__ == "__main__":
    main()
