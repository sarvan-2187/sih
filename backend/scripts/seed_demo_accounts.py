"""Create/refresh the demo accounts shown on the login page. Safe to re-run.

demo-admin is intentionally NOT created: the login page routes it to a static
UI mockup (/admin-demo) so no real account can edit the site.
"""
import asyncio
from datetime import datetime, timedelta
from firebase_admin import auth
import auth as _init_firebase  # noqa: F401 — initializes the Firebase Admin app
from database import connect_to_mongo, close_mongo_connection, get_db

PASSWORD = "Demo@1234"
DEMO_ACCOUNTS = [
    ("demo-student@gmail.com", "Demo Student", "learner"),
    ("demo-educator@gmail.com", "Demo Educator", "educator"),
    ("demo-researcher@gmail.com", "Demo Researcher", "researcher"),
]
# Demo staff are pre-approved so visitors can explore educator features and mentorship without real ID checks.
DEMO_PROFILES = {
    "educator": {"institution": "Qrious Demo University", "designation": "Professor", "department": "Physics",
                 "research_areas": ["Quantum Algorithms", "Quantum Error Correction"], "profile_url": ""},
    "researcher": {"institution": "Qrious Demo University", "designation": "PhD Scholar", "department": "Computer Science",
                   "research_areas": ["Variational Algorithms"], "profile_url": ""},
}


def upsert_firebase_user(email: str, name: str) -> str:
    try:
        user = auth.get_user_by_email(email)
        auth.update_user(user.uid, password=PASSWORD, email_verified=True, display_name=name, disabled=False)
        return user.uid
    except auth.UserNotFoundError:
        return auth.create_user(email=email, password=PASSWORD, email_verified=True, display_name=name).uid


async def main():
    await connect_to_mongo()
    db = get_db()
    uids = {}
    for email, name, role in DEMO_ACCOUNTS:
        uid = upsert_firebase_user(email, name)
        fields = {"email": email, "role": role, "full_name": name, "display_name": name}
        if role in DEMO_PROFILES:
            fields["verification"] = {"status": "approved", "profile": DEMO_PROFILES[role],
                                      "reviewed_at": datetime.utcnow(), "reviewed_by": "demo-seed"}
        await db.users.update_one(
            {"firebase_uid": uid},
            {
                "$set": fields,
                "$setOnInsert": {"firebase_uid": uid, "xp_total": 0, "age": 21, "interested_topic": "Quantum Computing"},
            },
            upsert=True,
        )
        print(f"OK  {email}  role={role}  uid={uid}")
        uids[role] = uid
    await seed_demo_course(db, uids["educator"], uids["learner"])
    await seed_demo_classroom(db, uids["educator"], uids["learner"])
    await close_mongo_connection()


# Per demo learner: (quiz scores, active days in the last 3 weeks, xp). Demo Student gets the full
# demo history from services/demo_seed.py instead. Records are tagged demo_seed for easy cleanup.
DEMO_LEARNER_ACTIVITY = {
    "Aarav Sharma": ([72, 85, 91, 88], 16, 1420), "Diya Nair": ([64, 70, 78], 12, 980),
    "Rohan Iyer": ([35, 42], 3, 210), "Meera Pillai": ([55, 61, 67], 9, 640),
    "Kabir Rao": ([28], 2, 90), "Ananya Das": ([], 1, 20),
}


async def seed_demo_classroom(db, educator_uid: str, student_uid: str):
    """A classroom owned by Demo Educator whose members consented, with varied learning activity."""
    from services.classroom_rules import CONSENT_VERSION, generate_join_code
    from services.demo_seed import seed_demo_user_history

    if await db.classrooms.find_one({"owner_uid": educator_uid, "demo_seed": True}):
        print("OK  demo classroom already seeded")
        return
    now = datetime.utcnow()
    classroom_id = (await db.classrooms.insert_one({
        "name": "Quantum Computing · Batch A", "description": "Demo classroom for the institutional oversight view.",
        "institution": "Qrious Demo University", "allowed_email_domains": [], "owner_uid": educator_uid,
        "co_teacher_uids": [], "join_code": generate_join_code(), "status": "active", "demo_seed": True,
        "created_at": now - timedelta(days=30),
    })).inserted_id

    await seed_demo_user_history(db, student_uid)
    topics = [t["slug"] for t in await db.roadmap_topics.find({}, {"slug": 1}).sort("order_index", 1).to_list(4)] or ["quantum-basics"]
    for i, (name, _enrolled, _done, last_ago) in enumerate(DEMO_LEARNERS):
        uid = student_uid if name == "Demo Student" else f"demo-seed-learner-{i}"
        await db.classroom_members.update_one({"classroom_id": classroom_id, "student_uid": uid}, {"$set": {
            "joined_at": now - timedelta(days=28 - i), "consent_version": CONSENT_VERSION,
            "consented_at": now - timedelta(days=28 - i), "removed_at": None, "removed_by": None}}, upsert=True)
        if name not in DEMO_LEARNER_ACTIVITY:
            continue
        scores, active, xp = DEMO_LEARNER_ACTIVITY[name]
        for n, score in enumerate(scores):
            await db.quiz_attempts.insert_one({
                "firebase_uid": uid, "topic_slug": topics[n % len(topics)], "score_pct": score, "score": score, "max_score": 100,
                "answers": [], "xp_earned": score // 10, "demo_seed": True,
                "submitted_at": now - timedelta(days=last_ago + 3 * (len(scores) - 1 - n))})
        # Active days end on the learner's last activity, so idle learners show up as at risk.
        days = sorted({(now - timedelta(days=last_ago + d * 21 // max(active, 1))).strftime("%Y-%m-%d") for d in range(active)})
        await db.streaks.update_one({"firebase_uid": uid}, {"$set": {
            "firebase_uid": uid, "current_streak": min(active, 5) if last_ago <= 1 else 0, "max_streak": min(active, 7),
            "last_activity_date": days[-1] if days else None, "history_dates": days, "freeze_tokens": 1, "updated_at": now}}, upsert=True)
        await db.users.update_one({"firebase_uid": uid}, {"$set": {"xp_total": xp}})
    print(f"OK  demo classroom with {len(DEMO_LEARNERS)} consented members")


# (name, enrolled days ago, lessons completed of 6, last activity days ago) — gives the educator
# analytics a realistic mix: finished, on track, at risk, just enrolled.
DEMO_LEARNERS = [
    ("Demo Student", 21, 4, 1), ("Aarav Sharma", 25, 6, 3), ("Diya Nair", 18, 5, 2), ("Rohan Iyer", 28, 2, 12),
    ("Meera Pillai", 10, 3, 1), ("Kabir Rao", 14, 1, 11), ("Ananya Das", 5, 0, 5),
]
DEMO_COURSE = ("Foundations of Quantum Computing", [
    ("Qubits & Superposition", ["What is a qubit?", "The Bloch sphere", "Measurement"]),
    ("Gates & Circuits", ["Single-qubit gates", "Entanglement with CNOT", "Your first circuit"]),
])


async def seed_demo_course(db, educator_uid: str, student_uid: str):
    """A published course owned by Demo Educator with enrolled learners. Skipped if it already exists."""
    if await db.courses.find_one({"owner_uid": educator_uid, "demo_seed": True}):
        print("OK  demo course already seeded")
        return
    now = datetime.utcnow()
    title, modules = DEMO_COURSE
    course_id = (await db.courses.insert_one({
        "title": title, "description": "Build intuition for qubits, gates and circuits with interactive labs.",
        "owner_uid": educator_uid, "status": "published", "format": "recorded", "demo_seed": True,
        "created_at": now - timedelta(days=35), "updated_at": now,
    })).inserted_id
    lesson_ids = []
    for m_order, (m_title, lessons) in enumerate(modules, 1):
        module_id = (await db.modules.insert_one({"course_id": course_id, "title": m_title, "order": m_order})).inserted_id
        for l_order, l_title in enumerate(lessons, 1):
            lesson_ids.append((await db.lessons.insert_one({"module_id": module_id, "title": l_title, "order": l_order})).inserted_id)

    for i, (name, enrolled_ago, done, last_ago) in enumerate(DEMO_LEARNERS):
        uid = student_uid if name == "Demo Student" else f"demo-seed-learner-{i}"
        if uid != student_uid:  # profile only (no login) so the class isn't a single student
            await db.users.update_one({"firebase_uid": uid}, {"$set": {
                "firebase_uid": uid, "full_name": name, "display_name": name, "role": "learner", "is_demo_seed": True}}, upsert=True)
        enrolled_at = now - timedelta(days=enrolled_ago)
        await db.enrollments.update_one({"student_uid": uid, "course_id": course_id},
                                        {"$setOnInsert": {"enrolled_at": enrolled_at}}, upsert=True)
        for n in range(done):  # completions spread evenly from enrollment to last activity
            at = enrolled_at + (timedelta(days=enrolled_ago - last_ago) * (n + 1) / done)
            await db.lesson_progress.update_one({"student_uid": uid, "lesson_id": lesson_ids[n]},
                                                {"$setOnInsert": {"completed_at": at}}, upsert=True)
    print(f"OK  demo course '{title}' with {len(DEMO_LEARNERS)} enrolled learners")


if __name__ == "__main__":
    asyncio.run(main())
