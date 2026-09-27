import os
os.environ["HF_HUB_OFFLINE"] = "1"

import asyncio
import traceback
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pymongo.errors import PyMongoError
from contextlib import asynccontextmanager
from ai import ai_gateway
from ai.exceptions import AIGatewayError
from ai.rate_limit import RateLimitExceeded
from database import connect_to_mongo, close_mongo_connection, get_db
from services.algorithm_service import algorithm_service
from services.arxiv_fetcher import sync_all_news
from services.quiz_seed import seed_quiz_questions
from services.roadmap_seed import seed_roadmap_topics
from services.flashcard_seed import seed_flashcards
from services.course_seed import seed_domain_courses
from services.badge_engine import badge_engine

async def cleanup_orphaned_data(db):
    """Remove enrollment and lesson_progress records that reference deleted courses/lessons."""
    try:
        # Load every valid id (ids only): a capped list would mark real enrollments/progress as orphans.
        courses = await db.courses.find({}, {"_id": 1}).to_list(None)
        valid_course_ids = {c["_id"] for c in courses}
        lessons = await db.lessons.find({}, {"_id": 1}).to_list(None)
        valid_lesson_ids = {l["_id"] for l in lessons}

        # Enrollments pointing to deleted courses
        all_enrollments = await db.enrollments.find({}, {"_id": 1, "course_id": 1}).to_list(1000)
        orphan_enrollment_ids = [e["_id"] for e in all_enrollments if e["course_id"] not in valid_course_ids]
        if orphan_enrollment_ids:
            result = await db.enrollments.delete_many({"_id": {"$in": orphan_enrollment_ids}})
            print(f"[Cleanup] Removed {result.deleted_count} orphaned enrollment(s)")

        # Lesson progress pointing to deleted lessons
        all_progress = await db.lesson_progress.find({}, {"_id": 1, "lesson_id": 1}).to_list(5000)
        orphan_progress_ids = [p["_id"] for p in all_progress if p["lesson_id"] not in valid_lesson_ids]
        if orphan_progress_ids:
            result = await db.lesson_progress.delete_many({"_id": {"$in": orphan_progress_ids}})
            print(f"[Cleanup] Removed {result.deleted_count} orphaned lesson_progress record(s)")
    except Exception as e:
        print(f"[Cleanup Warning] Non-critical orphan cleanup failed: {e}")
from services.qroute_notifier import poll_and_notify_jobs
from routers.qroute_router import warm_device_cache

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    try:
        await connect_to_mongo()
        await algorithm_service.seed_if_empty()
        await seed_roadmap_topics(get_db())
        await seed_quiz_questions(get_db())
        await seed_flashcards(get_db())
        await seed_domain_courses(get_db())
        await cleanup_orphaned_data(get_db())
        await badge_engine.seed_badges(get_db())
    except Exception as e:
        print(f"[Lifespan Startup Warning] MongoDB initialization/seeding deferred due to network connectivity: {e}")

    # get_db() returns None until connect_to_mongo() above has run, so the AI
    # Gateway's usage-tracking writes (ai/usage.py) can only be wired up now,
    # not at ai_gateway's own module-import time.
    ai_gateway.configure(db_provider=get_db)

    # Run initial news fetch in background task immediately (non-blocking)
    try:
        asyncio.create_task(sync_all_news())
        # Same treatment for QRoute's provider device lists: cold SDK imports +
        # per-provider network calls are far too slow to run inside the first
        # user's request (see qroute_router._DEVICE_FETCH_BUDGET_SECONDS).
        asyncio.create_task(warm_device_cache())
    except Exception as e:
        print(f"[Lifespan News Warning] Non-critical news task deferred: {e}")

    # Setup APScheduler for 6-hour recurring sync
    scheduler = AsyncIOScheduler()
    try:
        scheduler.add_job(
            sync_all_news,
            trigger="interval",
            hours=6,
            id="quantum_news_sync",
            replace_existing=True
        )
        scheduler.add_job(
            poll_and_notify_jobs,
            trigger="interval",
            seconds=90,
            id="qroute_email_poller",
            replace_existing=True,
        )
        scheduler.start()
        print("[Scheduler] Started Quantum News 6-hour auto-refresh scheduler!")
    except Exception as e:
        print(f"[Scheduler Warning] Failed to start scheduler: {e}")

    yield

    # Shutdown
    print("[Scheduler] Shutting down Quantum News scheduler...")
    try:
        scheduler.shutdown()
    except Exception:
        pass
    await close_mongo_connection()

app = FastAPI(
    title="Qrious API",
    description="Backend API built with FastAPI",
    version="1.0.0",
    lifespan=lifespan
)

@app.exception_handler(PyMongoError)
async def pymongo_exception_handler(request: Request, exc: PyMongoError):
    print(f"[Database Error] MongoDB connection error: {exc}")
    return JSONResponse(
        status_code=503,
        content={
            "detail": "Database service temporarily unavailable. Please check MongoDB Atlas cluster status or network connection.",
            "error_code": "DB_UNAVAILABLE"
        }
    )

@app.exception_handler(AIGatewayError)
async def ai_gateway_exception_handler(request: Request, exc: AIGatewayError):
    # Every configured provider failed for this request — normalized per the
    # task spec's §30 "graceful degradation": never leak a provider-specific
    # exception message/stack trace to the client. `exc.attempts` (which
    # providers were tried and how each failed) is logged server-side only.
    print(f"[AI Gateway] all providers failed for task '{exc.task}': {exc.attempts}", flush=True)
    return JSONResponse(
        status_code=503,
        content={
            "detail": "AI services are temporarily unavailable. Please try again shortly.",
            "error_code": "AI_SERVICE_UNAVAILABLE",
        },
    )

@app.exception_handler(RateLimitExceeded)
async def ai_rate_limit_exception_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={
            "detail": "You've made too many AI requests recently. Please slow down and try again shortly.",
            "error_code": "AI_RATE_LIMIT_EXCEEDED",
        },
    )

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def add_cors_headers(request, call_next):
    origin = request.headers.get("origin")
    if request.method == "OPTIONS":
        from fastapi.responses import Response
        response = Response(status_code=200)
    else:
        try:
            response = await call_next(request)
        except Exception:
            # An unhandled exception would otherwise propagate past this
            # middleware to Starlette's outermost error handler, which builds
            # its 500 WITHOUT the CORS headers added below — so the browser
            # discards the response and the frontend sees an unexplained
            # "Network Error" instead of the failure. Turning it into a real
            # response here keeps every error explainable in the UI. (This is
            # what hid a qBraid SDK ImportError behind a blank QRoute panel.)
            traceback.print_exc()
            response = JSONResponse(
                status_code=500,
                content={"detail": "Internal server error. Check the backend logs for the traceback."},
            )


    if origin:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Allow-Methods"] = "*"
        response.headers["Access-Control-Allow-Headers"] = "*"
    return response


from fastapi.staticfiles import StaticFiles

@app.get("/")
async def root():
    return {
        "message": "Welcome to Qrious API!",
        "status": "running"
    }

# Mount static slides directory
slides_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "public", "slides")
if os.path.exists(slides_path):
    app.mount("/slides", StaticFiles(directory=slides_path), name="slides")


@app.get("/health")
async def health_check():
    return {
        "status": "healthy"
    }

@app.get("/api/v1/health")
async def api_v1_health_check():
    return {
        "status": "ok"
    }


from routers.accounts import router as accounts_router
from routers.educator import router as educator_router
from routers.default import router as default_router
from routers.live import router as live_router
from routers.gates_playground_router import router as gates_playground_router
from routers.code_playground_router import router as code_playground_router
from routers.algorithm_explorer_router import router as algorithm_explorer_router
from routers.simulation_router import router as simulation_router
from routers.ai_tutor_router import router as ai_tutor_router
from routers.video_overview_router import router as video_overview_router
from routers.news import router as news_router
from routers.quiz import router as quiz_router
from routers.roadmap import router as roadmap_router
from routers.flashcards import router as flashcards_router
from routers.notes import router as notes_router
from routers.xp import router as xp_router
from routers.badges import router as badges_router
from routers.streak import router as streak_router
from routers.puzzles import router as puzzles_router
from routers.qbook_router import router as qbook_router
from routers.qbook_datasets_router import router as qbook_datasets_router
from routers.qbraid_router import router as qbraid_router
from routers.qroute_router import router as qroute_router
from routers.qstudio_router import router as qstudio_router
from routers.qstudio_rag_router import router as qstudio_rag_router
from routers.analytics import router as analytics_router
from routers.ai_gateway_router import router as ai_gateway_router
from routers.bloch_router import router as bloch_router
from routers.quantum_execution_router import router as quantum_execution_router
from routers.qforge_router import router as qforge_router
from routers.reviews import router as reviews_router
from routers.quantum_optimizer import router as quantum_optimizer_router
from routers.verification import router as verification_router
from routers.admin import router as admin_router
from routers.mentorship import router as mentorship_router
from routers.educator_analytics import router as educator_analytics_router
from routers.classrooms import router as classrooms_router

app.include_router(accounts_router)
app.include_router(verification_router)
app.include_router(admin_router)
app.include_router(mentorship_router)
app.include_router(educator_analytics_router)
app.include_router(classrooms_router)
app.include_router(educator_router)
app.include_router(default_router)
app.include_router(live_router)
app.include_router(gates_playground_router)
app.include_router(code_playground_router)
app.include_router(algorithm_explorer_router)
app.include_router(simulation_router)
app.include_router(ai_tutor_router)
app.include_router(video_overview_router)
app.include_router(news_router)
app.include_router(quiz_router)
app.include_router(roadmap_router)
app.include_router(flashcards_router)
app.include_router(notes_router)
app.include_router(reviews_router)
app.include_router(xp_router)
app.include_router(badges_router)
app.include_router(streak_router)
app.include_router(puzzles_router)
app.include_router(qbook_router)
app.include_router(qbook_datasets_router)
app.include_router(qbraid_router)
app.include_router(qroute_router)
app.include_router(qstudio_router)
app.include_router(qstudio_rag_router)
app.include_router(analytics_router)
app.include_router(ai_gateway_router)
app.include_router(bloch_router)
app.include_router(quantum_execution_router)
app.include_router(qforge_router)
app.include_router(quantum_optimizer_router)
