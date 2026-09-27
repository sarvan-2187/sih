"""Pure rules for institutional classrooms (no DB) — Part B of
docs/superpowers/specs/2026-09-27-student-analytics-and-classrooms-design.md."""
import re
import secrets
from datetime import datetime, timedelta
from statistics import mean
from typing import Optional

from services.course_analytics import AT_RISK_IDLE_DAYS, utc_naive

# Bump when the list of shared data changes; students who joined under an older version keep that record.
CONSENT_VERSION = "2026-09-27"
SHARED_WITH_FACULTY = [
    "Progress in every course you're enrolled in",
    "Quiz and pre/post assessment scores",
    "Quantum Roadmap topics started and completed",
    "Study streak, active days, XP and badges",
]
NEVER_SHARED = ["Personal notes and flashcards", "AI tutor, qStudio and qBook content", "Mentorship messages"]

_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # no 0/O/1/I
EMAIL_RE = re.compile(r"^[^@\s]+@([A-Za-z0-9-]+\.)+[A-Za-z]{2,}$")


def generate_join_code() -> str:
    return "".join(secrets.choice(_CODE_ALPHABET) for _ in range(8))


def normalize_code(code: str) -> str:
    return re.sub(r"[^A-Z0-9]", "", (code or "").upper())


def email_domain(email: str) -> str:
    return (email or "").strip().lower().rsplit("@", 1)[-1] if "@" in (email or "") else ""


def email_allowed(email: str, allowed_domains: list[str]) -> bool:
    """No domains configured = open to anyone with the code; otherwise exact domain or a subdomain of it."""
    if not allowed_domains:
        return True
    domain = email_domain(email)
    return bool(domain) and any(domain == d or domain.endswith("." + d) for d in allowed_domains)


def parse_invite_emails(raw: list[str], allowed_domains: list[str]) -> tuple[list[str], list[dict]]:
    """Returns (accepted unique emails, rejected [{email, reason}])."""
    accepted, rejected, seen = [], [], set()
    for item in raw:
        email = (item or "").strip().lower()
        if not email or email in seen:
            continue
        seen.add(email)
        if not EMAIL_RE.match(email):
            rejected.append({"email": email, "reason": "Not a valid email"})
        elif not email_allowed(email, allowed_domains):
            rejected.append({"email": email, "reason": "Outside your institution's email domain"})
        else:
            accepted.append(email)
    return accepted, rejected


def _title(slug: str, topic_titles: dict) -> str:
    return topic_titles.get(slug) or (slug or "Topic").replace("-", " ").title()


def platform_events(quizzes: list[dict], assessments: list[dict], progress: list[dict], badges: list[dict],
                    topic_titles: dict, badge_titles: dict) -> list[dict]:
    """Whole-platform learning events for the classroom-scope journey (same shape as course timeline events)."""
    events = []
    for q in quizzes:
        events.append({"type": "quiz_attempt", "at": utc_naive(q.get("submitted_at")),
                       "title": f"Quiz: {_title(q.get('topic_slug'), topic_titles)}", "detail": f"Scored {q.get('score_pct', 0)}%"})
    for a in assessments:
        kind = "Pre-assessment" if a.get("type") == "pre" else "Post-assessment"
        events.append({"type": "assessment", "at": utc_naive(a.get("submitted_at") or a.get("taken_at")),
                       "title": kind, "detail": f"Scored {a.get('score_pct', 0)}%"})
    for p in progress:
        name = _title(p.get("topic_slug"), topic_titles)
        if p.get("started_at"):
            events.append({"type": "topic_started", "at": utc_naive(p["started_at"]), "title": f"Started roadmap topic “{name}”"})
        if p.get("status") == "completed" and p.get("completed_at"):
            events.append({"type": "topic_completed", "at": utc_naive(p["completed_at"]), "title": f"Completed roadmap topic “{name}”"})
    for b in badges:
        events.append({"type": "badge_earned", "at": utc_naive(b.get("unlocked_at")),
                       "title": f"Earned badge “{badge_titles.get(b.get('badge_id'), b.get('badge_id'))}”"})
    return [e for e in events if e["at"]]


def learning_summary(xp_total: int, streak: Optional[dict], quizzes: list[dict], assessments: list[dict],
                     progress: list[dict], now: datetime) -> dict:
    def latest(kind: str):
        done = sorted((a for a in assessments if a.get("type") == kind),
                      key=lambda a: utc_naive(a.get("submitted_at") or a.get("taken_at")) or datetime.min)
        return done[-1].get("score_pct") if done else None

    pre, post = latest("pre"), latest("post")
    times = [utc_naive(q.get("submitted_at")) for q in quizzes] + [utc_naive(p.get("updated_at")) for p in progress]
    if streak and streak.get("last_activity_date"):
        times.append(datetime.fromisoformat(streak["last_activity_date"]))
    last_active = max((t for t in times if t), default=None)
    return {
        "xp_total": xp_total or 0,
        "current_streak": (streak or {}).get("current_streak", 0),
        "longest_streak": (streak or {}).get("max_streak", 0),
        "quizzes_taken": len(quizzes),
        "avg_quiz_score": round(mean(q.get("score_pct", 0) for q in quizzes), 1) if quizzes else None,
        "topics_completed": sum(1 for p in progress if p.get("status") == "completed"),
        "pre_score": pre, "post_score": post,
        "improvement": round(post - pre, 1) if pre is not None and post is not None else None,
        "last_active": last_active,
        "at_risk": last_active is None or (utc_naive(now) - last_active) > timedelta(days=AT_RISK_IDLE_DAYS),
    }


def active_days(history_dates: list[str], days: int, now: datetime) -> dict[str, int]:
    today = utc_naive(now).date()
    active = set(history_dates or [])
    return {d: int(d in active) for d in ((today - timedelta(days=i)).isoformat() for i in range(days - 1, -1, -1))}


def weak_topics(quizzes: list[dict], topic_titles: dict, limit: int = 5) -> list[dict]:
    """Class-wide topics with the lowest average quiz score (a topic needs 2+ attempts to count)."""
    by_topic: dict[str, list[float]] = {}
    for q in quizzes:
        by_topic.setdefault(q.get("topic_slug") or "general", []).append(q.get("score_pct", 0))
    rows = [{"topic_slug": s, "title": _title(s, topic_titles), "avg_score": round(mean(v), 1), "attempts": len(v)}
            for s, v in by_topic.items() if len(v) >= 2]
    return sorted(rows, key=lambda r: r["avg_score"])[:limit]
