from motor.motor_asyncio import AsyncIOMotorDatabase

async def create_all_indexes(db: AsyncIOMotorDatabase):
    """
    Creates all required indexes for Qrious MongoDB collections as specified in §3 of the blueprint.
    """
    print("Setting up MongoDB collection indexes...")
    
    # 1. users
    await db.users.create_index("firebase_uid", unique=True)

    # 2. roadmap_topics
    await db.roadmap_topics.create_index("slug", unique=True)
    await db.roadmap_topics.create_index("order_index")

    # 3. user_progress
    await db.user_progress.create_index([("firebase_uid", 1), ("topic_slug", 1)], unique=True)
    await db.user_progress.create_index([("firebase_uid", 1), ("status", 1)])

    # 4. quiz_questions
    await db.quiz_questions.create_index("topic_slug")
    await db.quiz_questions.create_index("difficulty")

    # 5. quiz_attempts
    await db.quiz_attempts.create_index([("firebase_uid", 1), ("submitted_at", -1)])

    # 6. flashcards
    await db.flashcards.create_index("firebase_uid")
    await db.flashcards.create_index("category")

    # 7. flashcard_reviews
    await db.flashcard_reviews.create_index([("firebase_uid", 1), ("next_review_date", 1)])

    # 8. notes
    await db.notes.create_index([("firebase_uid", 1), ("folder_id", 1)])
    await db.notes.create_index([("firebase_uid", 1), ("tags", 1)])

    # 9. badges & user_badges
    await db.badges.create_index("slug", unique=True)
    await db.user_badges.create_index([("firebase_uid", 1), ("badge_slug", 1)], unique=True)

    # 10. streaks
    await db.streaks.create_index("firebase_uid", unique=True)

    # 11. xp_history
    await db.xp_history.create_index([("firebase_uid", 1), ("created_at", -1)])

    # 12. assessments
    await db.assessments.create_index([("firebase_uid", 1), ("taken_at", -1)])

    # 13. qplanner_plans — one active plan per learner, the rest archived.
    # See PLANS/qplanner.md.
    await db.qplanner_plans.create_index([("firebase_uid", 1), ("status", 1)])

    # 14. qstudio_rag_chunks / qstudio_rag_messages — see PLANS/qstudio-rag.md
    await db.qstudio_rag_chunks.create_index([("study_space_id", 1), ("source_id", 1)])
    await db.qstudio_rag_chunks.create_index("chunk_id", unique=True)
    await db.qstudio_rag_messages.create_index([("study_space_id", 1), ("created_at", 1)])

    # Institutional classrooms
    await db.classrooms.create_index("join_code", unique=True)
    await db.classrooms.create_index("owner_uid")
    await db.classrooms.create_index("co_teacher_uids")
    await db.classroom_members.create_index([("classroom_id", 1), ("student_uid", 1)], unique=True)
    await db.classroom_members.create_index("student_uid")
    await db.classroom_invites.create_index([("classroom_id", 1), ("email", 1)], unique=True)
    await db.audit_log.create_index([("student_uid", 1), ("at", -1)])

    # Q-Rating: weekly contests and the rating ledger
    await db.qrating_tasks.create_index("slug", unique=True)
    await db.qrating_tasks.create_index("pillar")
    await db.qrating_rounds.create_index("round_number", unique=True)
    await db.qrating_rounds.create_index([("starts_at", -1)])
    await db.qrating_rounds.create_index("status")
    await db.qrating_registrations.create_index([("round_id", 1), ("firebase_uid", 1)], unique=True)
    # Submissions are append-only; this index backs both scoring and the public ledger.
    await db.qrating_submissions.create_index([("round_id", 1), ("firebase_uid", 1), ("task_id", 1)])
    await db.qrating_submissions.create_index([("firebase_uid", 1), ("submitted_at", -1)])
    await db.qrating_standings.create_index([("round_id", 1), ("firebase_uid", 1)], unique=True)
    await db.qrating_standings.create_index([("round_id", 1), ("rank", 1)])
    # The unique key is what makes finalize_round() safe to call twice.
    await db.qrating_history.create_index("idempotent_key", unique=True)
    await db.qrating_history.create_index([("firebase_uid", 1), ("created_at", -1)])
    await db.qrating_profiles.create_index("firebase_uid", unique=True)
    await db.qrating_profiles.create_index("handle", unique=True, sparse=True)
    await db.qrating_profiles.create_index([("rating", -1)])
    await db.qrating_seasons.create_index("season_id", unique=True)

    print("All MongoDB collection indexes created successfully!")
