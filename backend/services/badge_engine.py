from typing import List, Dict, Any, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime
from services.xp_engine import xp_engine

SEED_BADGES: List[Dict[str, Any]] = [
    # --- ROADMAP & TOPICS ---
    {
        "badge_id": "first_topic",
        "title": "Quantum Pioneer",
        "description": "Completed your first Quantum Roadmap topic module.",
        "icon": "FaFlag",
        "category": "roadmap",
        "rarity": "common",
        "xp_bonus": 25
    },
    {
        "badge_id": "topic_master_5",
        "title": "Roadmap Scholar",
        "description": "Completed 5 Quantum Roadmap topic modules.",
        "icon": "FaGraduationCap",
        "category": "roadmap",
        "rarity": "rare",
        "xp_bonus": 50
    },
    {
        "badge_id": "topic_master_10",
        "title": "Quantum Explorer",
        "description": "Completed 10 Quantum Roadmap topic modules across computing and communication.",
        "icon": "FaCompass",
        "category": "roadmap",
        "rarity": "rare",
        "xp_bonus": 100
    },
    {
        "badge_id": "topic_master_25",
        "title": "Quantum Specialist",
        "description": "Completed 25 Quantum Roadmap topic modules with distinction.",
        "icon": "FaAtom",
        "category": "roadmap",
        "rarity": "epic",
        "xp_bonus": 250
    },
    {
        "badge_id": "roadmap_conqueror",
        "title": "Quantum Grandmaster",
        "description": "Mastered 30+ core Quantum Roadmap topics and communication modules!",
        "icon": "FaCrown",
        "category": "roadmap",
        "rarity": "legendary",
        "xp_bonus": 500
    },
    {
        "badge_id": "slides_explorer",
        "title": "Slide Deck Scholar",
        "description": "Explored 5 interactive lecture slide presentations.",
        "icon": "FaFilePdf",
        "category": "roadmap",
        "rarity": "common",
        "xp_bonus": 30
    },

    # --- QUIZZES & ASSESSMENTS ---
    {
        "badge_id": "first_quiz",
        "title": "Brainiac",
        "description": "Passed your first Quantum Quiz.",
        "icon": "FaQuestionCircle",
        "category": "quiz",
        "rarity": "common",
        "xp_bonus": 20
    },
    {
        "badge_id": "perfect_quiz",
        "title": "Absolute Zero Error",
        "description": "Achieved a perfect 100% score on a Quantum Quiz.",
        "icon": "FaStar",
        "category": "quiz",
        "rarity": "epic",
        "xp_bonus": 100
    },
    {
        "badge_id": "quiz_master_5",
        "title": "Quiz Master",
        "description": "Successfully passed 5 different Quantum Quizzes.",
        "icon": "FaCheckDouble",
        "category": "quiz",
        "rarity": "rare",
        "xp_bonus": 75
    },
    {
        "badge_id": "quiz_master_15",
        "title": "Quantum Scholar",
        "description": "Successfully passed 15 different Quantum Quizzes.",
        "icon": "FaGraduationCap",
        "category": "quiz",
        "rarity": "epic",
        "xp_bonus": 150
    },

    # --- PERSONAL NOTES ---
    {
        "badge_id": "first_note",
        "title": "Quantum Scribe",
        "description": "Created your first Personal Note.",
        "icon": "FaPen",
        "category": "notes",
        "rarity": "common",
        "xp_bonus": 15
    },
    {
        "badge_id": "note_collector_5",
        "title": "Knowledge Collector",
        "description": "Created 5 Personal Notes in your notebook.",
        "icon": "FaBook",
        "category": "notes",
        "rarity": "rare",
        "xp_bonus": 50
    },
    {
        "badge_id": "notes_master",
        "title": "Master Chronicler",
        "description": "Created 10 comprehensive personal notes in your quantum notebook.",
        "icon": "FaBookOpen",
        "category": "notes",
        "rarity": "epic",
        "xp_bonus": 100
    },

    # --- FLASHCARDS & RECALL ---
    {
        "badge_id": "first_flashcard",
        "title": "Memory Catalyst",
        "description": "Reviewed your first SM-2 Flashcard deck.",
        "icon": "FaLayerGroup",
        "category": "flashcards",
        "rarity": "common",
        "xp_bonus": 15
    },
    {
        "badge_id": "flashcard_master_20",
        "title": "Spaced Recall Genius",
        "description": "Completed 20 Flashcard reviews.",
        "icon": "FaBrain",
        "category": "flashcards",
        "rarity": "rare",
        "xp_bonus": 100
    },
    {
        "badge_id": "flashcard_master_50",
        "title": "Memory Grandmaster",
        "description": "Completed 50 SM-2 spaced repetition flashcard reviews.",
        "icon": "FaBrain",
        "category": "flashcards",
        "rarity": "epic",
        "xp_bonus": 200
    },

    # --- LEARNING STREAKS ---
    {
        "badge_id": "streak_3",
        "title": "Spark of Momentum",
        "description": "Maintained a 3-day active learning streak.",
        "icon": "FaFire",
        "category": "streak",
        "rarity": "common",
        "xp_bonus": 30
    },
    {
        "badge_id": "streak_7",
        "title": "Superposition Unlocked",
        "description": "Maintained a 7-day active learning streak.",
        "icon": "FaBolt",
        "category": "streak",
        "rarity": "rare",
        "xp_bonus": 75
    },
    {
        "badge_id": "streak_30",
        "title": "Entangled Consistency",
        "description": "Achieved a legendary 30-day active learning streak!",
        "icon": "FaTrophy",
        "category": "streak",
        "rarity": "legendary",
        "xp_bonus": 300
    },

    # --- LEVEL & XP RANKS ---
    {
        "badge_id": "level_5",
        "title": "Rising Star",
        "description": "Reached Level 5 in Quantum XP Rank.",
        "icon": "FaRocket",
        "category": "level",
        "rarity": "rare",
        "xp_bonus": 50
    },
    {
        "badge_id": "level_10",
        "title": "Quantum Luminary",
        "description": "Reached Level 10 in Quantum XP Rank!",
        "icon": "FaAward",
        "category": "level",
        "rarity": "epic",
        "xp_bonus": 200
    },
    {
        "badge_id": "quantum_architect",
        "title": "Quantum Architect",
        "description": "Earned over 1,000 total Quantum XP!",
        "icon": "FaGem",
        "category": "level",
        "rarity": "epic",
        "xp_bonus": 250
    },
    {
        "badge_id": "quantum_titan",
        "title": "Quantum Titan",
        "description": "Earned over 5,000 total Quantum XP!",
        "icon": "FaCrown",
        "category": "level",
        "rarity": "legendary",
        "xp_bonus": 500
    },

    # --- PUZZLES & CHALLENGES ---
    {
        "badge_id": "first_puzzle",
        "title": "Quantum Solver",
        "description": "Completed your first Quantum Puzzle.",
        "icon": "FaPuzzlePiece",
        "category": "puzzle",
        "rarity": "common",
        "xp_bonus": 15
    },
    {
        "badge_id": "puzzle_master_5",
        "title": "Logic Pioneer",
        "description": "Completed 5 Quantum Puzzles.",
        "icon": "FaBrain",
        "category": "puzzle",
        "rarity": "rare",
        "xp_bonus": 50
    },
    {
        "badge_id": "puzzle_conqueror_all",
        "title": "Enigma Conqueror",
        "description": "Completed all 30 Quantum Puzzles!",
        "icon": "FaTrophy",
        "category": "puzzle",
        "rarity": "legendary",
        "xp_bonus": 200
    },
    {
        "badge_id": "daily_puzzle_streak_1",
        "title": "Daily Voyager",
        "description": "Completed your first Daily Puzzle!",
        "icon": "FaPuzzlePiece",
        "category": "puzzle",
        "rarity": "common",
        "xp_bonus": 20
    },
    {
        "badge_id": "daily_puzzle_streak_30",
        "title": "Quantum Streak Master",
        "description": "Maintained a 30-day Daily Puzzle streak.",
        "icon": "FaFire",
        "category": "puzzle",
        "rarity": "epic",
        "xp_bonus": 150
    },
    {
        "badge_id": "daily_puzzle_streak_50",
        "title": "Daily Legend",
        "description": "Maintained an incredible 50-day Daily Puzzle streak!",
        "icon": "FaTrophy",
        "category": "puzzle",
        "rarity": "legendary",
        "xp_bonus": 300
    },

    # --- QFORGE SIMULATOR ---
    {
        "badge_id": "qforge_first_cooldown",
        "title": "Cryogenic Explorer",
        "description": "Reached base temperature on your first QForge build.",
        "icon": "FaSnowflake",
        "category": "qforge",
        "rarity": "common",
        "xp_bonus": 50
    },
    {
        "badge_id": "qforge_signal_master",
        "title": "Signal Integrity Master",
        "description": "Achieved zero signal-integrity warnings in QForge.",
        "icon": "FaWaveSquare",
        "category": "qforge",
        "rarity": "rare",
        "xp_bonus": 100
    },
    {
        "badge_id": "qforge_calibrated",
        "title": "Calibration Expert",
        "description": "Completed calibration of a superconducting QPU.",
        "icon": "FaSlidersH",
        "category": "qforge",
        "rarity": "epic",
        "xp_bonus": 150
    },

    # --- Q-RATING CONTESTS ---
    {
        "badge_id": "qrating_first_round",
        "title": "Rated",
        "description": "Competed in your first Q-Rating weekly round.",
        "icon": "FaMedal",
        "category": "qrating",
        "rarity": "common",
        "xp_bonus": 50
    },
    {
        "badge_id": "qrating_rounds_5",
        "title": "Regular Contender",
        "description": "Competed in 5 Q-Rating rounds.",
        "icon": "FaFlagCheckered",
        "category": "qrating",
        "rarity": "rare",
        "xp_bonus": 100
    },
    {
        "badge_id": "qrating_rounds_25",
        "title": "Seasoned Competitor",
        "description": "Competed in 25 Q-Rating rounds.",
        "icon": "FaShieldAlt",
        "category": "qrating",
        "rarity": "epic",
        "xp_bonus": 300
    },
    {
        "badge_id": "qrating_podium",
        "title": "On the Podium",
        "description": "Finished in the top 3 of a Q-Rating round.",
        "icon": "FaTrophy",
        "category": "qrating",
        "rarity": "rare",
        "xp_bonus": 150
    },
    {
        "badge_id": "qrating_round_winner",
        "title": "Round Winner",
        "description": "Took first place in a Q-Rating weekly round.",
        "icon": "FaCrown",
        "category": "qrating",
        "rarity": "legendary",
        "xp_bonus": 400
    },
    {
        "badge_id": "qrating_tier_entangler",
        "title": "Entangler",
        "description": "Reached 1400 Q-Rating.",
        "icon": "FaLink",
        "category": "qrating",
        "rarity": "rare",
        "xp_bonus": 150
    },
    {
        "badge_id": "qrating_tier_expert",
        "title": "Quantum Expert",
        "description": "Reached 1600 Q-Rating.",
        "icon": "FaStar",
        "category": "qrating",
        "rarity": "epic",
        "xp_bonus": 250
    },
    {
        "badge_id": "qrating_tier_master",
        "title": "Quantum Master",
        "description": "Reached 1900 Q-Rating.",
        "icon": "FaGem",
        "category": "qrating",
        "rarity": "epic",
        "xp_bonus": 400
    },
    {
        "badge_id": "qrating_tier_grandmaster",
        "title": "Quantum Grandmaster",
        "description": "Reached 2200 Q-Rating - the top of the ladder.",
        "icon": "FaCrown",
        "category": "qrating",
        "rarity": "legendary",
        "xp_bonus": 800
    },
    {
        "badge_id": "qrating_contest_streak_4",
        "title": "Four in a Row",
        "description": "Competed in 4 consecutive weekly rounds.",
        "icon": "FaFire",
        "category": "qrating",
        "rarity": "rare",
        "xp_bonus": 150
    },
    {
        "badge_id": "qrating_contest_streak_12",
        "title": "Never Misses a Sunday",
        "description": "Competed in 12 consecutive weekly rounds.",
        "icon": "FaCalendarCheck",
        "category": "qrating",
        "rarity": "legendary",
        "xp_bonus": 500
    },
    {
        "badge_id": "qrating_silicon_verified",
        "title": "Silicon Verified",
        "description": "Ran a Q-Rating hardware solution on a real quantum device.",
        "icon": "FaMicrochip",
        "category": "qrating",
        "rarity": "epic",
        "xp_bonus": 200
    }
]


class BadgeEngine:
    async def seed_badges(self, db: AsyncIOMotorDatabase):
        """Seed standard badges into badges collection."""
        if db is None:
            return
        # Clean up any legacy documents with null badge_slug to satisfy unique index
        try:
            await db.user_badges.delete_many({"badge_slug": None, "badge_id": None})
            await db.user_badges.update_many(
                {"badge_slug": None},
                [{"$set": {"badge_slug": "$badge_id"}}]
            )
        except Exception as e:
            print(f"[BadgeEngine] Migration warning: {e}")

        for badge in SEED_BADGES:
            b_copy = dict(badge)
            b_copy["slug"] = badge["badge_id"]
            b_copy["created_at"] = datetime.utcnow()
            await db.badges.update_one(
                {"badge_id": badge["badge_id"]},
                {"$set": b_copy},
                upsert=True
            )

    async def check_and_award_badges(self, db: AsyncIOMotorDatabase, firebase_uid: str) -> List[Dict[str, Any]]:
        """
        Idempotently checks user milestones and unlocks new badges.
        Returns list of newly unlocked badges.
        """
        if db is None or not firebase_uid:
            return []

        # Get existing unlocked badges
        unlocked_cursor = db.user_badges.find({"firebase_uid": firebase_uid})
        unlocked_records = await unlocked_cursor.to_list(length=100)
        unlocked_ids = {
            r.get("badge_id") or r.get("badge_slug") 
            for r in unlocked_records 
            if r.get("badge_id") or r.get("badge_slug")
        }

        # Gather user activity metrics
        user_doc = await db.users.find_one({"firebase_uid": firebase_uid}) or {}
        xp_total = user_doc.get("xp_total") or 0
        level = user_doc.get("level") or 1

        # Completed roadmap topics
        topics_count = await db.user_progress.count_documents({"firebase_uid": firebase_uid, "status": "completed"})

        # Quiz stats
        quizzes_count = await db.quiz_attempts.count_documents({"firebase_uid": firebase_uid, "passed": True})
        perfect_quiz_count = await db.quiz_attempts.count_documents({"firebase_uid": firebase_uid, "score_pct": 100})

        # Notes count
        notes_count = await db.notes.count_documents({"firebase_uid": firebase_uid})

        # Flashcards reviews count
        flashcard_reviews_count = await db.flashcard_reviews.count_documents({"firebase_uid": firebase_uid})

        # Streak
        streak_doc = await db.streaks.find_one({"firebase_uid": firebase_uid}) or {}
        current_streak = streak_doc.get("current_streak", 0)

        # Completed puzzles count
        puzzles_count = await db.puzzle_completions.count_documents({"firebase_uid": firebase_uid})

        # Daily puzzle streak count
        daily_streak_doc = await db.daily_puzzle_streaks.find_one({"firebase_uid": firebase_uid}) or {}
        daily_puzzle_streak = daily_streak_doc.get("current_streak", 0)

        # Q-Rating contests. peak_rating is used for the tier badges on purpose:
        # reaching a tier is an achievement, and a later bad round should not
        # silently revoke a badge already unlocked.
        qrating_profile = await db.qrating_profiles.find_one({"firebase_uid": firebase_uid}) or {}
        qrating_rounds = qrating_profile.get("rounds_played", 0)
        qrating_peak = qrating_profile.get("peak_rating", 0)
        qrating_streak = (qrating_profile.get("contest_streak") or {}).get("current", 0)
        qrating_best_rank = None
        if qrating_rounds:
            best = await db.qrating_standings.find_one({"firebase_uid": firebase_uid},
                                                       sort=[("rank", 1)])
            qrating_best_rank = (best or {}).get("rank")
        qrating_hw_verified = await db.qrating_submissions.count_documents(
            {"firebase_uid": firebase_uid, "hardware_verified": True})

        newly_unlocked = []

        # Check conditions against catalog
        all_badges_cursor = db.badges.find()
        all_badges = await all_badges_cursor.to_list(length=100)

        for badge in all_badges:
            b_id = badge["badge_id"]
            if b_id in unlocked_ids:
                continue

            should_unlock = False
            if b_id == "first_topic" and topics_count >= 1:
                should_unlock = True
            elif b_id == "topic_master_5" and topics_count >= 5:
                should_unlock = True
            elif b_id == "topic_master_10" and topics_count >= 10:
                should_unlock = True
            elif b_id == "topic_master_25" and topics_count >= 25:
                should_unlock = True
            elif b_id == "roadmap_conqueror" and topics_count >= 30:
                should_unlock = True
            elif b_id == "first_quiz" and quizzes_count >= 1:
                should_unlock = True
            elif b_id == "perfect_quiz" and perfect_quiz_count >= 1:
                should_unlock = True
            elif b_id == "quiz_master_5" and quizzes_count >= 5:
                should_unlock = True
            elif b_id == "quiz_master_15" and quizzes_count >= 15:
                should_unlock = True
            elif b_id == "first_note" and notes_count >= 1:
                should_unlock = True
            elif b_id == "note_collector_5" and notes_count >= 5:
                should_unlock = True
            elif b_id == "notes_master" and notes_count >= 10:
                should_unlock = True
            elif b_id == "first_flashcard" and flashcard_reviews_count >= 1:
                should_unlock = True
            elif b_id == "flashcard_master_20" and flashcard_reviews_count >= 20:
                should_unlock = True
            elif b_id == "flashcard_master_50" and flashcard_reviews_count >= 50:
                should_unlock = True
            elif b_id == "streak_3" and current_streak >= 3:
                should_unlock = True
            elif b_id == "streak_7" and current_streak >= 7:
                should_unlock = True
            elif b_id == "streak_30" and current_streak >= 30:
                should_unlock = True
            elif b_id == "level_5" and level >= 5:
                should_unlock = True
            elif b_id == "level_10" and level >= 10:
                should_unlock = True
            elif b_id == "quantum_architect" and xp_total >= 1000:
                should_unlock = True
            elif b_id == "quantum_titan" and xp_total >= 5000:
                should_unlock = True
            elif b_id == "first_puzzle" and puzzles_count >= 1:
                should_unlock = True
            elif b_id == "puzzle_master_5" and puzzles_count >= 5:
                should_unlock = True
            elif b_id == "puzzle_conqueror_all" and puzzles_count >= 30:
                should_unlock = True
            elif b_id == "daily_puzzle_streak_1" and daily_puzzle_streak >= 1:
                should_unlock = True
            elif b_id == "daily_puzzle_streak_30" and daily_puzzle_streak >= 30:
                should_unlock = True
            elif b_id == "daily_puzzle_streak_50" and daily_puzzle_streak >= 50:
                should_unlock = True
            elif b_id == "qrating_first_round" and qrating_rounds >= 1:
                should_unlock = True
            elif b_id == "qrating_rounds_5" and qrating_rounds >= 5:
                should_unlock = True
            elif b_id == "qrating_rounds_25" and qrating_rounds >= 25:
                should_unlock = True
            elif b_id == "qrating_podium" and qrating_best_rank is not None and qrating_best_rank <= 3:
                should_unlock = True
            elif b_id == "qrating_round_winner" and qrating_best_rank == 1:
                should_unlock = True
            elif b_id == "qrating_tier_entangler" and qrating_peak >= 1400:
                should_unlock = True
            elif b_id == "qrating_tier_expert" and qrating_peak >= 1600:
                should_unlock = True
            elif b_id == "qrating_tier_master" and qrating_peak >= 1900:
                should_unlock = True
            elif b_id == "qrating_tier_grandmaster" and qrating_peak >= 2200:
                should_unlock = True
            elif b_id == "qrating_contest_streak_4" and qrating_streak >= 4:
                should_unlock = True
            elif b_id == "qrating_contest_streak_12" and qrating_streak >= 12:
                should_unlock = True
            elif b_id == "qrating_silicon_verified" and qrating_hw_verified >= 1:
                should_unlock = True

            if should_unlock:
                now = datetime.utcnow()
                unlock_doc = {
                    "firebase_uid": firebase_uid,
                    "badge_id": b_id,
                    "badge_slug": b_id,
                    "unlocked_at": now
                }
                await db.user_badges.update_one(
                    {"firebase_uid": firebase_uid, "badge_id": b_id},
                    {"$set": unlock_doc},
                    upsert=True
                )

                # Award XP bonus
                xp_bonus = badge.get("xp_bonus", 25)
                if xp_bonus > 0:
                    await xp_engine.award_xp(
                        db=db,
                        firebase_uid=firebase_uid,
                        source="badge",
                        amount=xp_bonus,
                        idempotent_key=f"badge_bonus_{b_id}"
                    )

                badge_info = dict(badge)
                badge_info["_id"] = str(badge_info.get("_id", ""))
                badge_info["unlocked_at"] = now.isoformat()
                newly_unlocked.append(badge_info)

        return newly_unlocked

badge_engine = BadgeEngine()
