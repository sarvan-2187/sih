"""Seed the Q-Rating task bank and schedule a round. Safe to re-run.

Usage:
    python seed_qrating_round.py              # next Sunday 19:00 IST
    python seed_qrating_round.py --now        # starts in 1 minute (demo)
    python seed_qrating_round.py --round 2 --now

Seeding tasks never overwrites a difficulty the engine has already learned from
a real round, so re-running this is always safe.
"""
import argparse
import asyncio
from datetime import datetime, time, timedelta, timezone

from database import close_mongo_connection, connect_to_mongo, get_db
from services.qrating.rounds_service import create_round, ensure_tasks_seeded
from services.qrating.task_seed import ROUND_1_TASKS

IST = timezone(timedelta(hours=5, minutes=30))
CONTEST_HOUR = time(19, 0)  # 19:00 IST, the slot the UI advertises


def next_sunday_slot(now: datetime) -> datetime:
    """The next Sunday 19:00 IST strictly in the future."""
    local = now.astimezone(IST)
    days_ahead = (6 - local.weekday()) % 7  # Monday is 0, Sunday is 6
    candidate = datetime.combine(local.date() + timedelta(days=days_ahead), CONTEST_HOUR,
                                 tzinfo=IST)
    if candidate <= local:
        candidate += timedelta(days=7)
    return candidate.astimezone(timezone.utc)


async def main(round_number: int, start_now: bool, duration: int) -> None:
    await connect_to_mongo()
    db = get_db()
    if db is None:
        raise SystemExit("No database connection - check MONGODB_URI in backend/.env")

    count = await ensure_tasks_seeded(db)
    print("OK  seeded %d tasks" % count)

    now = datetime.now(timezone.utc)
    starts_at = now + timedelta(minutes=1) if start_now else next_sunday_slot(now)
    round_doc = await create_round(
        db, round_number, "Weekly Round %d" % round_number, starts_at,
        [task["slug"] for task in ROUND_1_TASKS], duration_minutes=duration)

    print("OK  Round %d scheduled" % round_number)
    print("    starts  %s  (%s IST)" % (
        round_doc["starts_at"].isoformat(timespec="minutes"),
        round_doc["starts_at"].astimezone(IST).strftime("%a %d %b %H:%M")))
    print("    ends    %s" % round_doc["ends_at"].isoformat(timespec="minutes"))
    print("    tasks   %s" % ", ".join(entry["slug"] for entry in round_doc["tasks"]))
    print("    total   %d points" % sum(task["points"] for task in ROUND_1_TASKS))
    await close_mongo_connection()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--round", type=int, default=1, help="round number (default 1)")
    parser.add_argument("--now", action="store_true",
                        help="start in 1 minute instead of next Sunday")
    parser.add_argument("--duration", type=int, default=90, help="minutes (default 90)")
    args = parser.parse_args()
    asyncio.run(main(args.round, args.now, args.duration))
