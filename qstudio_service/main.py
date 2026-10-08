import asyncio
import os
from contextlib import asynccontextmanager

from bson import ObjectId
from fastapi import FastAPI, Header, HTTPException

from ai import ai_gateway
from database import connect_to_mongo, close_mongo_connection, get_db
from models.qstudio import AnimationTrigger, AudioOverviewTrigger, SlidesTrigger
from models.video_overview import VideoOverviewTrigger
from pipeline import run_pipeline
from pipeline_audio import run_audio_pipeline
from pipeline_manim import run_animation_pipeline
from pipeline_slides import run_slides_pipeline

QSTUDIO_SERVICE_SECRET = os.getenv("QSTUDIO_SERVICE_SECRET")

# Each pipeline already offloads its blocking subprocess.run (ffmpeg/Manim) calls via
# asyncio.to_thread, so the event loop itself never blocks — but to_thread's default
# executor allows far more concurrent threads than this host has CPU cores, so multiple
# simultaneous renders would thrash the CPU and blow each pipeline's own internal ffmpeg/
# Manim timeouts, surfacing as jobs that look stuck. This semaphore caps actual concurrent
# renders to the VPS's vCPU count — additional submissions queue here (awaiting the
# semaphore) without blocking the server from accepting/serving other requests.
# ponytail: fixed cap, not read from CPU count — raise RENDER_CONCURRENCY env var if this
# VPS is resized.
RENDER_CONCURRENCY = int(os.getenv("RENDER_CONCURRENCY", "2"))
_render_semaphore = asyncio.Semaphore(RENDER_CONCURRENCY)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_to_mongo()
    # get_db() returns None until connect_to_mongo() above has run — same
    # ordering constraint as backend/main.py's own ai_gateway.configure() call.
    ai_gateway.configure(db_provider=get_db)
    yield
    await close_mongo_connection()


app = FastAPI(
    title="Qrious qStudio Service",
    description="Internal, HTTP-triggered rendering service for qStudio's heavy-dependency outputs "
                 "(Video Overview, Audio Overview, Slides). Not user-facing. Renamed from "
                 "'video_service' now that it hosts more than video — see PLANS/qstudio.md §0a.",
    lifespan=lifespan,
)


@app.get("/health")
async def health():
    return {"status": "healthy"}


@app.get("/ai/health")
async def ai_health():
    """Unauthenticated like /health above — this service has no end-user auth
    concept at all (only the X-Internal-Secret on the state-changing POST
    endpoints below), so there's no existing auth dependency to reuse here
    the way backend/routers/ai_gateway_router.py does."""
    health = await ai_gateway.health()
    return health.model_dump()


@app.post("/internal/video-overview")
async def render_video_overview(payload: VideoOverviewTrigger, x_internal_secret: str = Header(...)):
    print(f"[{payload.video_overview_id}] received trigger request", flush=True)

    if not QSTUDIO_SERVICE_SECRET or x_internal_secret != QSTUDIO_SERVICE_SECRET:
        print(f"[{payload.video_overview_id}] rejected: invalid or missing internal secret", flush=True)
        raise HTTPException(status_code=401, detail="Invalid internal secret")

    db = get_db()
    job = await db.video_overviews.find_one({"_id": ObjectId(payload.video_overview_id)})
    if job is None:
        print(f"[{payload.video_overview_id}] rejected: job not found in MongoDB", flush=True)
        raise HTTPException(status_code=404, detail="Video overview job not found")

    print(f"[{payload.video_overview_id}] starting pipeline", flush=True)
    async with _render_semaphore:
        result = await run_pipeline(job)
    print(f"[{payload.video_overview_id}] pipeline finished: {result}", flush=True)
    return result


@app.post("/internal/qstudio-audio-overview")
async def render_audio_overview(payload: AudioOverviewTrigger, x_internal_secret: str = Header(...)):
    print(f"[qstudio-audio {payload.output_id}] received trigger request", flush=True)

    if not QSTUDIO_SERVICE_SECRET or x_internal_secret != QSTUDIO_SERVICE_SECRET:
        print(f"[qstudio-audio {payload.output_id}] rejected: invalid or missing internal secret", flush=True)
        raise HTTPException(status_code=401, detail="Invalid internal secret")

    print(f"[qstudio-audio {payload.output_id}] starting pipeline", flush=True)
    async with _render_semaphore:
        await run_audio_pipeline(payload.output_id, payload.grounding_text, payload.voice_a, payload.voice_b)
    print(f"[qstudio-audio {payload.output_id}] pipeline finished", flush=True)
    return {"status": "done"}


@app.post("/internal/qstudio-slides")
async def render_slides(payload: SlidesTrigger, x_internal_secret: str = Header(...)):
    print(f"[qstudio-slides {payload.output_id}] received trigger request", flush=True)

    if not QSTUDIO_SERVICE_SECRET or x_internal_secret != QSTUDIO_SERVICE_SECRET:
        print(f"[qstudio-slides {payload.output_id}] rejected: invalid or missing internal secret", flush=True)
        raise HTTPException(status_code=401, detail="Invalid internal secret")

    print(f"[qstudio-slides {payload.output_id}] starting pipeline", flush=True)
    async with _render_semaphore:
        await run_slides_pipeline(payload.output_id, payload.grounding_text, payload.theme)
    print(f"[qstudio-slides {payload.output_id}] pipeline finished", flush=True)
    return {"status": "done"}


@app.post("/internal/qstudio-animation")
async def render_animation(payload: AnimationTrigger, x_internal_secret: str = Header(...)):
    print(f"[qstudio-animation {payload.output_id}] received trigger request", flush=True)

    if not QSTUDIO_SERVICE_SECRET or x_internal_secret != QSTUDIO_SERVICE_SECRET:
        print(f"[qstudio-animation {payload.output_id}] rejected: invalid or missing internal secret", flush=True)
        raise HTTPException(status_code=401, detail="Invalid internal secret")

    print(f"[qstudio-animation {payload.output_id}] starting pipeline", flush=True)
    async with _render_semaphore:
        await run_animation_pipeline(payload.output_id, payload.grounding_text, payload.voice, payload.theme)
    print(f"[qstudio-animation {payload.output_id}] pipeline finished", flush=True)
    return {"status": "done"}
