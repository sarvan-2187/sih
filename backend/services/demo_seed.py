import random
from datetime import datetime, timedelta
from typing import Dict, Any, List
from motor.motor_asyncio import AsyncIOMotorDatabase
from services.badge_engine import badge_engine

DEMO_NOTES = [
    {
        "title": "Superposition & Bloch Sphere Geometry",
        "content_markdown": "# Quantum Superposition Notes\n\nA single qubit state is represented as:\n$$\n|\\psi\\rangle = \\alpha|0\\rangle + \\beta|1\\rangle\n$$\nwhere $|\\alpha|^2 + |\\beta|^2 = 1$.\n\n### Bloch Sphere Coordinates\n- $\\theta \\in [0, \\pi]$ controls latitude (polar angle)\n- $\\phi \\in [0, 2\\pi)$ controls longitude (azimuthal angle)\n\nState vector in spherical coordinates:\n$$\n|\\psi\\rangle = \\cos\\left(\\frac{\\theta}{2}\\right)|0\\rangle + e^{i\\phi}\\sin\\left(\\frac{\\theta}{2}\\right)|1\\rangle\n$$",
        "tags": ["superposition", "bloch_sphere", "basics"],
        "pinned": True,
        "favorite": True
    },
    {
        "title": "Quantum Gates Cheat Sheet (H, Pauli-X, CNOT)",
        "content_markdown": "# Essential Quantum Gates Summary\n\n- **Hadamard (H)**: Creates equal superposition.\n  $$ H = \\frac{1}{\\sqrt{2}}\\begin{pmatrix} 1 & 1 \\\\ 1 & -1 \\end{pmatrix} $$\n- **Pauli-X (NOT)**: Flips $|0\\rangle \\leftrightarrow |1\\rangle$.\n- **CNOT**: Controlled-NOT gate creates 2-qubit Bell states:\n  $$ |\\Phi^+\\rangle = \\frac{1}{\\sqrt{2}}(|00\\rangle + |11\\rangle) $$",
        "tags": ["gates", "circuits", "bell_state"],
        "pinned": False,
        "favorite": True
    },
    {
        "title": "Grover's Search Algorithm Complexity",
        "content_markdown": "# Grover's Quantum Search\n\nAchieves quadratic speedup for unstructured search:\n- Classical search: $\\mathcal{O}(N)$\n- Grover's search: $\\mathcal{O}(\\sqrt{N})$\n\nUses **Oracle inversion** followed by **Diffusion operator** about the mean amplitude.",
        "tags": ["grover", "algorithms", "speedup"],
        "pinned": False,
        "favorite": False
    }
]

async def seed_demo_user_history(db: AsyncIOMotorDatabase, firebase_uid: str) -> Dict[str, Any]:
    """
    Seeds a realistic, non-empty learning history for a demo/judge user account.
    Ensures Analytics, Leaderboard, Notes, Roadmap, XP, Streaks, and Badges are fully populated.
    """
    if db is None or not firebase_uid:
        return {"status": "error", "message": "Database not connected or invalid UID"}

    now = datetime.utcnow()
    today_date = now.strftime("%Y-%m-%d")

    # 1. Update/Ensure User Record
    user_doc = await db.users.find_one({"firebase_uid": firebase_uid})
    if not user_doc:
        await db.users.insert_one({
            "firebase_uid": firebase_uid,
            "display_name": "Quantum Explorer",
            "email": "demo@qrious.quant",
            "xp_total": 850,
            "level": 4,
            "created_at": now - timedelta(days=30),
            "last_active_at": now
        })
    else:
        await db.users.update_one(
            {"firebase_uid": firebase_uid},
            {"$set": {"xp_total": max(user_doc.get("xp_total", 0), 850), "level": 4, "last_active_at": now}}
        )

    # 2. Seed Topic Roadmap Progress
    topics = [
        ("introduction", "completed", 100.0),
        ("qubits", "completed", 100.0),
        ("superposition", "completed", 100.0),
        ("entanglement", "completed", 100.0),
        ("gates", "in_progress", 60.0),
        ("measurement", "unlocked", 0.0),
        ("circuits", "locked", 0.0),
        ("deutsch", "locked", 0.0),
        ("grover", "locked", 0.0),
        ("shor", "locked", 0.0),
        ("advanced", "locked", 0.0),
    ]

    for topic_slug, status, pct in topics:
        await db.user_progress.update_one(
            {"firebase_uid": firebase_uid, "topic_slug": topic_slug},
            {
                "$set": {
                    "firebase_uid": firebase_uid,
                    "topic_slug": topic_slug,
                    "status": status,
                    "progress_pct": pct,
                    "started_at": now - timedelta(days=14),
                    "completed_at": now - timedelta(days=2) if status == "completed" else None
                }
            },
            upsert=True
        )

    # 3. Seed Quiz Attempts History
    attempts_data = [
        {
            "topic_slug": "introduction",
            "score": 100,
            "max_score": 100,
            "xp_earned": 50,
            "passed": True,
            "days_ago": 12,
            "answers": [
                {"concept": "quantum_basics", "correct": True},
                {"concept": "classical_vs_quantum", "correct": True}
            ]
        },
        {
            "topic_slug": "qubits",
            "score": 90,
            "max_score": 100,
            "xp_earned": 45,
            "passed": True,
            "days_ago": 9,
            "answers": [
                {"concept": "qubit_states", "correct": True},
                {"concept": "bloch_sphere", "correct": True},
                {"concept": "bloch_sphere", "correct": False}
            ]
        },
        {
            "topic_slug": "superposition",
            "score": 80,
            "max_score": 100,
            "xp_earned": 40,
            "passed": True,
            "days_ago": 6,
            "answers": [
                {"concept": "superposition_basics", "correct": True},
                {"concept": "bloch_sphere", "correct": False},
                {"concept": "superposition_math", "correct": True}
            ]
        },
        {
            "topic_slug": "entanglement",
            "score": 85,
            "max_score": 100,
            "xp_earned": 45,
            "passed": True,
            "days_ago": 3,
            "answers": [
                {"concept": "bell_states", "correct": True},
                {"concept": "spooky_action", "correct": True},
                {"concept": "quantum_teleportation", "correct": True}
            ]
        },
        {
            "topic_slug": "gates",
            "score": 70,
            "max_score": 100,
            "xp_earned": 35,
            "passed": True,
            "days_ago": 1,
            "answers": [
                {"concept": "pauli_gates", "correct": True},
                {"concept": "hadamard_gate", "correct": True},
                {"concept": "phase_kickback", "correct": False}
            ]
        }
    ]

    # Idempotent: re-running the seed replaces its own attempts instead of duplicating them.
    await db.quiz_attempts.delete_many({"firebase_uid": firebase_uid, "demo_seed": True})
    for att in attempts_data:
        att_time = now - timedelta(days=att["days_ago"])
        doc = {
            "firebase_uid": firebase_uid,
            "topic_slug": att["topic_slug"],
            "score": att["score"],
            "max_score": att["max_score"],
            "score_pct": att["score"],
            "xp_earned": att["xp_earned"],
            "passed": att["passed"],
            "answers": att["answers"],
            "submitted_at": att_time,
            "started_at": att_time - timedelta(minutes=5),
            "mode": "practice",
            "demo_seed": True
        }
        await db.quiz_attempts.insert_one(doc)

    # 4. Seed Pre and Post Assessments for quantified learning growth (+30.0% delta)
    pre_doc = {
        "firebase_uid": firebase_uid,
        "type": "pre",
        "topic_scope": ["introduction", "qubits", "superposition", "entanglement"],
        "question_ids": [],
        "status": "completed",
        "score_pct": 50.0,
        "total_correct": 5,
        "total_questions": 10,
        "xp_earned": 50,
        "answers": [
            {"concept": "bloch_sphere", "topic_slug": "superposition", "correct": False},
            {"concept": "qubit_states", "topic_slug": "qubits", "correct": True},
            {"concept": "bell_states", "topic_slug": "entanglement", "correct": False},
            {"concept": "quantum_basics", "topic_slug": "introduction", "correct": True},
            {"concept": "hadamard_gate", "topic_slug": "gates", "correct": False}
        ],
        "taken_at": now - timedelta(days=14),
        "submitted_at": now - timedelta(days=14)
    }
    post_doc = {
        "firebase_uid": firebase_uid,
        "type": "post",
        "topic_scope": ["introduction", "qubits", "superposition", "entanglement"],
        "question_ids": [],
        "status": "completed",
        "score_pct": 80.0,
        "total_correct": 8,
        "total_questions": 10,
        "xp_earned": 120,
        "answers": [
            {"concept": "bloch_sphere", "topic_slug": "superposition", "correct": True},
            {"concept": "qubit_states", "topic_slug": "qubits", "correct": True},
            {"concept": "bell_states", "topic_slug": "entanglement", "correct": True},
            {"concept": "quantum_basics", "topic_slug": "introduction", "correct": True},
            {"concept": "hadamard_gate", "topic_slug": "gates", "correct": True}
        ],
        "taken_at": now - timedelta(hours=2),
        "submitted_at": now - timedelta(hours=2)
    }

    # Upsert assessments
    await db.assessments.delete_many({"firebase_uid": firebase_uid})
    await db.assessments.insert_one(pre_doc)
    await db.assessments.insert_one(post_doc)

    # 5. Seed Personal Notes
    for note in DEMO_NOTES:
        await db.notes.update_one(
            {"firebase_uid": firebase_uid, "title": note["title"]},
            {
                "$set": {
                    "firebase_uid": firebase_uid,
                    "title": note["title"],
                    "content_markdown": note["content_markdown"],
                    "tags": note["tags"],
                    "pinned": note["pinned"],
                    "favorite": note["favorite"],
                    "created_at": now - timedelta(days=5),
                    "updated_at": now - timedelta(hours=1)
                }
            },
            upsert=True
        )

    # 6. Seed Daily Activity Streak
    await db.streaks.update_one(
        {"firebase_uid": firebase_uid},
        {
            "$set": {
                "firebase_uid": firebase_uid,
                "current_streak": 7,
                "longest_streak": 12,
                "max_streak": 12,  # field name the streak engine reads
                # Same shape the streak engine writes: the current 7-day run plus an earlier 12-day run.
                "history_dates": sorted({(now - timedelta(days=d)).strftime("%Y-%m-%d") for d in [*range(7), *range(12, 24)]}),
                "last_activity_date": today_date,
                "freeze_tokens": 2,
                "freeze_used_dates": []
            }
        },
        upsert=True
    )

    # 7. Seed 30-Day XP History for Heatmap Grid
    await db.xp_history.delete_many({"firebase_uid": firebase_uid, "source": "demo_seed"})
    for i in range(25, -1, -1):
        if i % 3 != 0: # Active 2 out of 3 days
            entry_date = now - timedelta(days=i)
            await db.xp_history.insert_one({
                "firebase_uid": firebase_uid,
                "source": "demo_seed",
                "amount": random.choice([25, 40, 50, 75]),
                "created_at": entry_date
            })

    # 8. Seed Flashcards SM-2 Reviews
    sample_fc = await db.flashcards.find_one()
    if sample_fc:
        fc_id = sample_fc["_id"]
        await db.flashcard_reviews.update_one(
            {"firebase_uid": firebase_uid, "flashcard_id": fc_id},
            {
                "$set": {
                    "firebase_uid": firebase_uid,
                    "flashcard_id": fc_id,
                    "ease_factor": 2.5,
                    "interval_days": 3,
                    "repetitions": 4,
                    "next_review_date": now - timedelta(hours=1),
                    "last_result": "remembered",
                    "bookmarked": True
                }
            },
            upsert=True
        )

    # 9. Trigger Badge Engine Evaluation
    unlocked_badges = await badge_engine.check_and_award_badges(db, firebase_uid)

    return {
        "status": "success",
        "message": "Demo user history successfully seeded!",
        "unlocked_badges_count": len(unlocked_badges)
    }
