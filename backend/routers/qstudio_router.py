import asyncio
import io
import uuid
from datetime import datetime, timedelta, timezone

import httpx
from bson import ObjectId
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from pypdf import PdfReader

from ai import ai_gateway, AITask, ChatMessage
from ai.exceptions import AIGatewayError
from auth import get_current_user
from database import get_db
from models.lms import serialize
from models.qstudio import (
    BlogPostResult,
    BriefingResult,
    FlashcardReviewRequest,
    FlashcardsResult,
    MindMapResult,
    OutputCreate,
    OutputOut,
    SourceCreate,
    SourceOut,
    SourceUploadUrlResponse,
    StudyGuideResult,
    StudySpaceCreate,
    StudySpaceOut,
    StudySpaceSummary,
    StudySpaceUpdate,
)
from rag.pipeline import index_source_for_rag, remove_source_index, remove_space_index
from routers.video_overview_router import (
    QSTUDIO_SERVICE_SECRET,
    QSTUDIO_SERVICE_URL,
    _trigger_qstudio_service,
)
from services.badge_engine import badge_engine
from services.srs_engine import calculate_sm2
from services.streak_engine import streak_engine
from services.xp_engine import xp_engine
from storage_service import delete_object, download_bytes, generate_download_url, generate_upload_url

router = APIRouter(prefix="/api/v1/qstudio", tags=["qStudio"])

# Matches the qBook dataset limit for consistency — not a hard technical ceiling.
SOURCE_MAX_BYTES = 10 * 1024 * 1024
# Cap on raw extracted PDF text stored per source (a few dozen pages' worth).
SOURCE_TEXT_MAX_CHARS = 50_000
# Cap on the combined grounding text handed to the LLM for any generation.
GROUNDING_MAX_CHARS = 8_000
AUDIO_URL_TTL_SECONDS = 6 * 60 * 60

# Output types with a generation handler wired up so far — see PLANS/qstudio.md
# and PLANS/qstudio-animation.md.
IMPLEMENTED_OUTPUT_TYPES = (
    "mindmap", "flashcards", "briefing", "study_guide", "blog_post", "video", "audio", "slides", "animation",
)
SLIDES_URL_TTL_SECONDS = 6 * 60 * 60
ANIMATION_URL_TTL_SECONDS = 6 * 60 * 60


# --------------------------------------------------------------------------
# Ownership helpers — mirror qbook_router.py's/_get_owned_dataset's exact shape
# --------------------------------------------------------------------------

async def _get_owned_study_space(db, study_space_id: str, uid: str) -> dict:
    if not ObjectId.is_valid(study_space_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Study space not found")
    doc = await db.qstudio_study_spaces.find_one({"_id": ObjectId(study_space_id)})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Study space not found")
    if doc["owner_uid"] != uid:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your study space")
    return doc


async def _get_owned_source(db, source_id: str, uid: str) -> dict:
    if not ObjectId.is_valid(source_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Source not found")
    doc = await db.qstudio_sources.find_one({"_id": ObjectId(source_id)})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Source not found")
    if doc["owner_uid"] != uid:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your source")
    return doc


async def _get_owned_output(db, output_id: str, uid: str) -> dict:
    if not ObjectId.is_valid(output_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Output not found")
    doc = await db.qstudio_outputs.find_one({"_id": ObjectId(output_id)})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Output not found")
    if doc["owner_uid"] != uid:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your output")
    return doc


def _serialize_study_space_summary(doc: dict, source_count: int, output_count: int) -> StudySpaceSummary:
    return StudySpaceSummary(
        id=str(doc["_id"]),
        title=doc["title"],
        source_count=source_count,
        output_count=output_count,
        updated_at=doc["updated_at"],
    )


def _extract_pdf_text(pdf_bytes: bytes) -> str:
    reader = PdfReader(io.BytesIO(pdf_bytes))
    text = "\n".join(page.extract_text() or "" for page in reader.pages)
    return text[:SOURCE_TEXT_MAX_CHARS]


async def _get_grounding_text(db, study_space_id: ObjectId) -> str:
    """A study space's combined grounding text — every confirmed source's text,
    concatenated and truncated to a token-safe length, exactly like
    qstudio_service/pipeline.py's _extract_pdf_text already truncates for the
    video-overview pipeline."""
    cursor = db.qstudio_sources.find({"study_space_id": study_space_id, "status": "confirmed"})
    parts = []
    async for source in cursor:
        text = source.get("extracted_text") if source["kind"] == "pdf" else source.get("text")
        if text:
            parts.append(text)
    return "\n\n".join(parts)[:GROUNDING_MAX_CHARS]


# --------------------------------------------------------------------------
# Study Spaces
# --------------------------------------------------------------------------

@router.post("/study-spaces", response_model=StudySpaceOut, status_code=status.HTTP_201_CREATED)
async def create_study_space(request: StudySpaceCreate, current_user: dict = Depends(get_current_user)):
    db = get_db()
    now = datetime.now(timezone.utc)
    doc = {
        "owner_uid": current_user["firebase_uid"],
        "title": request.title,
        "created_at": now,
        "updated_at": now,
    }
    result = await db.qstudio_study_spaces.insert_one(doc)
    doc["_id"] = result.inserted_id
    return serialize(doc, StudySpaceOut)


@router.get("/study-spaces", response_model=list[StudySpaceSummary])
async def list_study_spaces(current_user: dict = Depends(get_current_user)):
    db = get_db()
    uid = current_user["firebase_uid"]
    cursor = db.qstudio_study_spaces.find({"owner_uid": uid}).sort("updated_at", -1)
    study_spaces = await cursor.to_list(length=100)
    summaries = []
    for doc in study_spaces:
        source_count = await db.qstudio_sources.count_documents({"study_space_id": doc["_id"]})
        output_count = await db.qstudio_outputs.count_documents({"study_space_id": doc["_id"]})
        summaries.append(_serialize_study_space_summary(doc, source_count, output_count))
    return summaries


@router.get("/study-spaces/{study_space_id}", response_model=StudySpaceOut)
async def get_study_space(study_space_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    doc = await _get_owned_study_space(db, study_space_id, current_user["firebase_uid"])
    return serialize(doc, StudySpaceOut)


@router.patch("/study-spaces/{study_space_id}", response_model=StudySpaceOut)
async def rename_study_space(study_space_id: str, request: StudySpaceUpdate, current_user: dict = Depends(get_current_user)):
    db = get_db()
    doc = await _get_owned_study_space(db, study_space_id, current_user["firebase_uid"])

    title = request.title.strip()
    if not title:
        raise HTTPException(status_code=400, detail="Title cannot be empty")

    now = datetime.now(timezone.utc)
    await db.qstudio_study_spaces.update_one({"_id": doc["_id"]}, {"$set": {"title": title, "updated_at": now}})
    doc["title"] = title
    doc["updated_at"] = now
    return serialize(doc, StudySpaceOut)


@router.delete("/study-spaces/{study_space_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_study_space(study_space_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    doc = await _get_owned_study_space(db, study_space_id, current_user["firebase_uid"])
    space_id = doc["_id"]

    output_ids = [o["_id"] async for o in db.qstudio_outputs.find({"study_space_id": space_id}, {"_id": 1})]

    async for source in db.qstudio_sources.find({"study_space_id": space_id, "kind": "pdf"}):
        if source.get("b2_key"):
            try:
                delete_object(source["b2_key"])
            except Exception:
                pass  # best-effort cleanup — don't block deletion on a B2 hiccup

    await db.qstudio_sources.delete_many({"study_space_id": space_id})
    if output_ids:
        await db.qstudio_flashcard_reviews.delete_many({"output_id": {"$in": output_ids}})
    await db.qstudio_outputs.delete_many({"study_space_id": space_id})
    await remove_space_index(db, str(space_id))
    await db.qstudio_study_spaces.delete_one({"_id": space_id})


# --------------------------------------------------------------------------
# Sources
# --------------------------------------------------------------------------

@router.post("/study-spaces/{study_space_id}/sources/upload-url", response_model=SourceUploadUrlResponse)
async def get_source_upload_url(
    study_space_id: str, request: SourceCreate, current_user: dict = Depends(get_current_user)
):
    db = get_db()
    uid = current_user["firebase_uid"]
    await _get_owned_study_space(db, study_space_id, uid)

    if request.kind != "pdf":
        raise HTTPException(status_code=400, detail="Use POST /sources for text sources")
    if not request.filename or not request.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only .pdf files are supported for uploaded sources.")
    if not request.size_bytes or request.size_bytes > SOURCE_MAX_BYTES:
        raise HTTPException(
            status_code=400,
            detail=f"File exceeds the {SOURCE_MAX_BYTES // (1024 * 1024)}MB limit.",
        )

    safe_filename = request.filename.replace(" ", "_")
    key = f"qstudio/{study_space_id}/{uuid.uuid4()}_{safe_filename}"
    now = datetime.now(timezone.utc)
    doc = {
        "study_space_id": ObjectId(study_space_id),
        "owner_uid": uid,
        "kind": "pdf",
        "filename": safe_filename,
        "b2_key": key,
        "text": None,
        "extracted_text": None,
        "status": "pending",
        "rag_status": "not_indexed",
        "rag_error": None,
        "chunk_count": 0,
        "created_at": now,
    }
    result = await db.qstudio_sources.insert_one(doc)
    url = generate_upload_url(key, request.content_type or "application/pdf")
    return SourceUploadUrlResponse(upload_url=url, source_id=str(result.inserted_id))


@router.post("/study-spaces/{study_space_id}/sources", response_model=SourceOut, status_code=status.HTTP_201_CREATED)
async def create_text_source(
    study_space_id: str, request: SourceCreate, background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    uid = current_user["firebase_uid"]
    await _get_owned_study_space(db, study_space_id, uid)

    if request.kind != "text":
        raise HTTPException(status_code=400, detail="Use POST /sources/upload-url for pdf sources")
    if not request.text or not request.text.strip():
        raise HTTPException(status_code=400, detail="Text source cannot be empty")

    now = datetime.now(timezone.utc)
    doc = {
        "study_space_id": ObjectId(study_space_id),
        "owner_uid": uid,
        "kind": "text",
        "filename": None,
        "b2_key": None,
        "text": request.text,
        "extracted_text": None,
        "status": "confirmed",
        "rag_status": "not_indexed",
        "rag_error": None,
        "chunk_count": 0,
        "created_at": now,
    }
    result = await db.qstudio_sources.insert_one(doc)
    await db.qstudio_study_spaces.update_one({"_id": ObjectId(study_space_id)}, {"$set": {"updated_at": now}})
    doc["_id"] = result.inserted_id
    # RAG indexing (parse/chunk/embed) runs in the background exactly like the
    # existing Audio/Slides/Animation trigger jobs — it never blocks this
    # response, and a query against an in-flight source simply excludes it
    # until rag_status flips to "ready" (see rag/pipeline.py::index_source).
    background_tasks.add_task(index_source_for_rag, str(result.inserted_id), study_space_id, uid, "text", None, request.text)
    return serialize(doc, SourceOut)


@router.post("/sources/{source_id}/confirm", response_model=SourceOut)
async def confirm_source_upload(
    source_id: str, background_tasks: BackgroundTasks, current_user: dict = Depends(get_current_user),
):
    db = get_db()
    uid = current_user["firebase_uid"]
    doc = await _get_owned_source(db, source_id, uid)
    if doc["kind"] != "pdf":
        raise HTTPException(status_code=400, detail="Only pdf sources need confirmation")

    pdf_bytes = await asyncio.to_thread(download_bytes, doc["b2_key"])
    extracted_text = _extract_pdf_text(pdf_bytes)

    await db.qstudio_sources.update_one(
        {"_id": doc["_id"]},
        {"$set": {"status": "confirmed", "extracted_text": extracted_text}},
    )
    await db.qstudio_study_spaces.update_one(
        {"_id": doc["study_space_id"]}, {"$set": {"updated_at": datetime.now(timezone.utc)}}
    )
    doc["status"] = "confirmed"
    # RAG indexing re-parses the PDF bytes from B2 (not extracted_text above)
    # so page boundaries survive — see rag/parsing.py::parse_source.
    background_tasks.add_task(
        index_source_for_rag, source_id, str(doc["study_space_id"]), uid, "pdf", doc["filename"], None,
    )
    return serialize(doc, SourceOut)


@router.get("/study-spaces/{study_space_id}/sources", response_model=list[SourceOut])
async def list_sources(study_space_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    uid = current_user["firebase_uid"]
    await _get_owned_study_space(db, study_space_id, uid)
    cursor = db.qstudio_sources.find({"study_space_id": ObjectId(study_space_id)}).sort("created_at", -1)
    return [serialize(doc, SourceOut) async for doc in cursor]


@router.delete("/sources/{source_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_source(source_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    uid = current_user["firebase_uid"]
    doc = await _get_owned_source(db, source_id, uid)
    if doc.get("kind") == "pdf" and doc.get("b2_key"):
        delete_object(doc["b2_key"])
    await remove_source_index(db, str(doc["study_space_id"]), source_id)
    await db.qstudio_sources.delete_one({"_id": doc["_id"]})


# --------------------------------------------------------------------------
# Outputs
# --------------------------------------------------------------------------

MINDMAP_SYSTEM_PROMPT = (
    "You are creating a mind map that summarizes the source material the user provides. "
    "Produce a single root node (the overall topic) with up to 6 direct children, each of "
    "which may itself have up to 6 children, to a maximum depth of 3 levels total. Keep "
    "every label short — a handful of words, never a full sentence."
)

FLASHCARDS_SYSTEM_PROMPT = (
    "You are creating study flashcards from the source material the user provides. Produce "
    "between 8 and 20 cards. Each card has a short 'front' (a question or prompt) and a "
    "concise 'back' (the answer). Cover the material's distinct concepts — do not create "
    "near-duplicate cards."
)

BRIEFING_SYSTEM_PROMPT = (
    "You are writing a briefing document that summarizes the source material the user "
    "provides, for someone who has not read the source and needs to get up to speed quickly. "
    "Produce: a short 'overview' paragraph (3-5 sentences) covering what the material is about "
    "and why it matters; up to 8 'key_topics', each with a short title and a 2-4 sentence "
    "summary, covering the material's distinct topics in the order they matter most; and up to "
    "12 'glossary' entries for any technical terms a newcomer would need explained, each with "
    "the term and a one-sentence plain-language definition. Omit the glossary entirely if the "
    "material has no jargon worth defining."
)

STUDY_GUIDE_SYSTEM_PROMPT = (
    "You are creating a study guide from the source material the user provides, to help "
    "someone prepare for a test on this material. Produce: up to 10 'short_answer_questions', "
    "each with a focused 'question' and a concise correct 'answer' (a sentence or two, not an "
    "essay); up to 6 'essay_questions' — open-ended prompts (no answers) that encourage deeper "
    "reasoning or synthesis across the material, not simple recall; and up to 12 'glossary' "
    "entries for any technical terms a newcomer would need explained, each with the term and a "
    "one-sentence plain-language definition. Omit the glossary entirely if the material has no "
    "jargon worth defining."
)

BLOG_POST_SYSTEM_PROMPT = (
    "You are writing a highly readable blog post that distills the source material's most "
    "insightful takeaways for a general audience, not a dry summary. Produce: a catchy 'title'; "
    "an 'intro' paragraph that hooks the reader and previews what they'll learn; up to 6 "
    "'sections', each with a short 'heading' and a few well-written paragraphs of 'body' text "
    "that develop one idea at a time; and a 'conclusion' paragraph that ties the takeaways "
    "together. Write in an engaging, conversational tone — explain WHY the material matters, "
    "not just what it says."
)


async def _generate_mindmap(grounding_text: str, uid: str) -> dict:
    messages = [
        ChatMessage(role="system", content=MINDMAP_SYSTEM_PROMPT),
        ChatMessage(role="user", content=f"Source material:\n{grounding_text}"),
    ]
    response = await ai_gateway.chat(messages=messages, task=AITask.MINDMAP, response_model=MindMapResult, identity=uid)
    result: MindMapResult = response.parsed
    return result.model_dump()


async def _generate_flashcards(grounding_text: str, uid: str) -> dict:
    messages = [
        ChatMessage(role="system", content=FLASHCARDS_SYSTEM_PROMPT),
        ChatMessage(role="user", content=f"Source material:\n{grounding_text}"),
    ]
    response = await ai_gateway.chat(messages=messages, task=AITask.FLASHCARDS, response_model=FlashcardsResult, identity=uid)
    result: FlashcardsResult = response.parsed
    cards = [{"id": str(uuid.uuid4()), "front": c.front, "back": c.back} for c in result.cards]
    return {"cards": cards}


async def _generate_briefing(grounding_text: str, uid: str) -> dict:
    messages = [
        ChatMessage(role="system", content=BRIEFING_SYSTEM_PROMPT),
        ChatMessage(role="user", content=f"Source material:\n{grounding_text}"),
    ]
    response = await ai_gateway.chat(messages=messages, task=AITask.BRIEFING, response_model=BriefingResult, identity=uid)
    result: BriefingResult = response.parsed
    return result.model_dump()


async def _generate_study_guide(grounding_text: str, uid: str) -> dict:
    messages = [
        ChatMessage(role="system", content=STUDY_GUIDE_SYSTEM_PROMPT),
        ChatMessage(role="user", content=f"Source material:\n{grounding_text}"),
    ]
    response = await ai_gateway.chat(messages=messages, task=AITask.STUDY_GUIDE, response_model=StudyGuideResult, identity=uid)
    result: StudyGuideResult = response.parsed
    return result.model_dump()


async def _generate_blog_post(grounding_text: str, uid: str) -> dict:
    messages = [
        ChatMessage(role="system", content=BLOG_POST_SYSTEM_PROMPT),
        ChatMessage(role="user", content=f"Source material:\n{grounding_text}"),
    ]
    response = await ai_gateway.chat(messages=messages, task=AITask.BLOG_POST, response_model=BlogPostResult, identity=uid)
    result: BlogPostResult = response.parsed
    return result.model_dump()


async def _create_video_overview_pointer(
    db,
    study_space: dict,
    uid: str,
    params: dict,
    background_tasks: BackgroundTasks,
    grounding_text: str,
) -> dict:
    """Delegates to the existing Video Overview pipeline (video_overviews collection +
    qstudio_service) rather than generating anything itself — this output type is a thin
    pointer, per PLANS/qstudio.md §4. The frontend follows result.video_overview_id and
    polls the *existing* GET /api/video-overviews/{id} for status, exactly like
    VideoOverviewChatPage.tsx does today; this endpoint doesn't wait for rendering."""
    prompt = params.get("prompt") or f"Create a video overview covering: {study_space['title']}"
    template = params.get("template", "minimal_dark")
    voice = params.get("voice", "female")

    now = datetime.now(timezone.utc)
    doc = {
        "lesson_id": None,
        "requested_by": uid,
        "prompt": prompt,
        "source_resource_id": None,
        "source_text": grounding_text,
        "template": template,
        "voice": voice,
        "status": "queued",
        "error": None,
        "slide_script": None,
        "resource_id": None,
        "b2_key": None,
        "created_at": now,
        "updated_at": now,
    }
    insert_result = await db.video_overviews.insert_one(doc)
    video_overview_id = str(insert_result.inserted_id)
    background_tasks.add_task(_trigger_qstudio_service, video_overview_id)
    return {"video_overview_id": video_overview_id}


async def _trigger_audio_overview(output_id: str, grounding_text: str, voice_a: str, voice_b: str):
    """Fire-and-forget trigger for qstudio_service's Audio Overview pipeline — same
    BackgroundTasks pattern as _trigger_qstudio_service, but posts to a different
    internal endpoint and passes the grounding text/voice choices directly in the
    body rather than a Mongo doc id, since this pipeline needs no other job state."""
    if not QSTUDIO_SERVICE_URL or not QSTUDIO_SERVICE_SECRET:
        print(f"[qstudio_output {output_id}] QSTUDIO_SERVICE_URL/SECRET not configured; job left generating", flush=True)
        return
    async with httpx.AsyncClient(timeout=None) as client:
        try:
            response = await client.post(
                f"{QSTUDIO_SERVICE_URL}/internal/qstudio-audio-overview",
                json={
                    "output_id": output_id,
                    "grounding_text": grounding_text,
                    "voice_a": voice_a,
                    "voice_b": voice_b,
                },
                headers={"X-Internal-Secret": QSTUDIO_SERVICE_SECRET},
            )
            # Any non-2xx here (e.g. a 422 if qstudio_service's request shape ever
            # drifts from this payload) previously vanished silently — this call
            # doesn't raise for a 4xx/5xx response, only for connection-level errors.
            if response.status_code >= 400:
                print(
                    f"[qstudio_output {output_id}] qstudio_service audio pipeline rejected the "
                    f"trigger: {response.status_code} {response.text[:500]}", flush=True,
                )
        except httpx.HTTPError as e:
            print(f"[qstudio_output {output_id}] failed to trigger qstudio_service audio pipeline: {e}", flush=True)


async def _trigger_slides_overview(output_id: str, grounding_text: str, theme: str):
    """Fire-and-forget trigger for qstudio_service's Slides pipeline — same shape as
    _trigger_audio_overview, posting to a different internal endpoint."""
    if not QSTUDIO_SERVICE_URL or not QSTUDIO_SERVICE_SECRET:
        print(f"[qstudio_output {output_id}] QSTUDIO_SERVICE_URL/SECRET not configured; job left generating", flush=True)
        return
    async with httpx.AsyncClient(timeout=None) as client:
        try:
            response = await client.post(
                f"{QSTUDIO_SERVICE_URL}/internal/qstudio-slides",
                json={"output_id": output_id, "grounding_text": grounding_text, "theme": theme},
                headers={"X-Internal-Secret": QSTUDIO_SERVICE_SECRET},
            )
            if response.status_code >= 400:
                print(
                    f"[qstudio_output {output_id}] qstudio_service slides pipeline rejected the "
                    f"trigger: {response.status_code} {response.text[:500]}", flush=True,
                )
        except httpx.HTTPError as e:
            print(f"[qstudio_output {output_id}] failed to trigger qstudio_service slides pipeline: {e}", flush=True)


async def _trigger_animation_overview(output_id: str, grounding_text: str, voice: str | None, theme: str = "minimal_dark"):
    """Fire-and-forget trigger for qstudio_service's Animation pipeline — same
    shape as _trigger_audio_overview/_trigger_slides_overview, posting to a
    different internal endpoint. See PLANS/qstudio-animation.md §4."""
    if not QSTUDIO_SERVICE_URL or not QSTUDIO_SERVICE_SECRET:
        print(f"[qstudio_output {output_id}] QSTUDIO_SERVICE_URL/SECRET not configured; job left generating", flush=True)
        return
    async with httpx.AsyncClient(timeout=None) as client:
        try:
            response = await client.post(
                f"{QSTUDIO_SERVICE_URL}/internal/qstudio-animation",
                json={"output_id": output_id, "grounding_text": grounding_text, "voice": voice, "theme": theme},
                headers={"X-Internal-Secret": QSTUDIO_SERVICE_SECRET},
            )
            if response.status_code >= 400:
                print(
                    f"[qstudio_output {output_id}] qstudio_service animation pipeline rejected the "
                    f"trigger: {response.status_code} {response.text[:500]}", flush=True,
                )
        except httpx.HTTPError as e:
            print(f"[qstudio_output {output_id}] failed to trigger qstudio_service animation pipeline: {e}", flush=True)


@router.post("/study-spaces/{study_space_id}/outputs", response_model=OutputOut, status_code=status.HTTP_201_CREATED)
async def create_output(
    study_space_id: str,
    request: OutputCreate,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
):
    """Mind Map, Flashcards, Briefing Doc, Study Guide, and Blog Post are a single Groq
    call each — fast enough to answer inline rather than the queued/BackgroundTasks/poll
    dance Video Overview uses. See PLANS/qstudio.md §3. Video delegates to the existing
    Video Overview pipeline as a thin pointer (§4). Audio and Slides both run in
    qstudio_service and are left status="generating" for the frontend to poll."""
    db = get_db()
    uid = current_user["firebase_uid"]
    study_space = await _get_owned_study_space(db, study_space_id, uid)

    if request.type not in IMPLEMENTED_OUTPUT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail=f"'{request.type}' isn't implemented yet — only {IMPLEMENTED_OUTPUT_TYPES} are available so far.",
        )

    grounding_text = await _get_grounding_text(db, study_space["_id"])
    if not grounding_text.strip():
        raise HTTPException(status_code=400, detail="Add at least one source to this study space before generating.")

    now = datetime.now(timezone.utc)
    doc = {
        "study_space_id": study_space["_id"],
        "owner_uid": uid,
        "type": request.type,
        "params": request.params,
        "status": "generating",
        "error": None,
        "result": {},
        "created_at": now,
        "updated_at": now,
    }
    insert_result = await db.qstudio_outputs.insert_one(doc)
    output_id = insert_result.inserted_id

    # Audio Overview is genuinely asynchronous — a multi-line TTS + ffmpeg pipeline runs
    # in qstudio_service, which writes status/result back to this same qstudio_outputs
    # doc directly via Mongo when it finishes (same pattern the video_overviews
    # collection already uses). So unlike mindmap/flashcards/briefing/video, there is no
    # synchronous result here: updated_fields stays None and the doc is left
    # status="generating" for the frontend to poll via GET /outputs/{id}.
    updated_fields = None
    try:
        if request.type == "mindmap":
            output_result = await _generate_mindmap(grounding_text, uid)
            updated_fields = {"status": "ready", "result": output_result, "updated_at": datetime.now(timezone.utc)}
        elif request.type == "flashcards":
            output_result = await _generate_flashcards(grounding_text, uid)
            updated_fields = {"status": "ready", "result": output_result, "updated_at": datetime.now(timezone.utc)}
        elif request.type == "briefing":
            output_result = await _generate_briefing(grounding_text, uid)
            updated_fields = {"status": "ready", "result": output_result, "updated_at": datetime.now(timezone.utc)}
        elif request.type == "study_guide":
            output_result = await _generate_study_guide(grounding_text, uid)
            updated_fields = {"status": "ready", "result": output_result, "updated_at": datetime.now(timezone.utc)}
        elif request.type == "blog_post":
            output_result = await _generate_blog_post(grounding_text, uid)
            updated_fields = {"status": "ready", "result": output_result, "updated_at": datetime.now(timezone.utc)}
        elif request.type == "video":
            output_result = await _create_video_overview_pointer(
                db, study_space, uid, request.params, background_tasks, grounding_text
            )
            updated_fields = {"status": "ready", "result": output_result, "updated_at": datetime.now(timezone.utc)}
        elif request.type == "audio":
            voice_a = request.params.get("voice_a", "jenny")
            voice_b = request.params.get("voice_b", "guy")
            background_tasks.add_task(_trigger_audio_overview, str(output_id), grounding_text, voice_a, voice_b)
        elif request.type == "slides":
            theme = request.params.get("theme", "minimal_dark")
            background_tasks.add_task(_trigger_slides_overview, str(output_id), grounding_text, theme)
        else:  # "animation"
            # No default — omitting `voice` (or passing null) means a silent
            # animation. See qstudio_service/pipeline_manim.py.
            voice = request.params.get("voice")
            theme = request.params.get("theme", "minimal_dark")
            background_tasks.add_task(_trigger_animation_overview, str(output_id), grounding_text, voice, theme)
    except AIGatewayError as e:
        # Every provider failed -- in practice free-tier rate limits. The per-provider list
        # ("groq:AIRateLimitError, gemini:...") belongs in the server log, not on a
        # learner's screen, where it was being shown verbatim.
        print(f"[QStudio] {request.type} generation failed on every provider: {e.attempts}", flush=True)
        updated_fields = {
            "status": "failed",
            "error": "The AI models are busy right now. Wait about a minute, then click Regenerate.",
            "updated_at": datetime.now(timezone.utc),
        }
    except Exception as e:
        updated_fields = {"status": "failed", "error": str(e), "updated_at": datetime.now(timezone.utc)}

    if updated_fields is not None:
        await db.qstudio_outputs.update_one({"_id": output_id}, {"$set": updated_fields})
        doc.update(updated_fields)
    await db.qstudio_study_spaces.update_one({"_id": study_space["_id"]}, {"$set": {"updated_at": datetime.now(timezone.utc)}})

    doc["_id"] = output_id
    return serialize(doc, OutputOut)


@router.get("/study-spaces/{study_space_id}/outputs", response_model=list[OutputOut])
async def list_outputs(study_space_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    uid = current_user["firebase_uid"]
    await _get_owned_study_space(db, study_space_id, uid)
    cursor = db.qstudio_outputs.find({"study_space_id": ObjectId(study_space_id)}).sort("created_at", -1)
    return [serialize(doc, OutputOut) async for doc in cursor]


@router.get("/outputs/{output_id}", response_model=OutputOut)
async def get_output(output_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    doc = await _get_owned_output(db, output_id, current_user["firebase_uid"])
    return serialize(doc, OutputOut)


@router.delete("/outputs/{output_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_output(output_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    doc = await _get_owned_output(db, output_id, current_user["firebase_uid"])
    await db.qstudio_flashcard_reviews.delete_many({"output_id": doc["_id"]})
    await db.qstudio_outputs.delete_one({"_id": doc["_id"]})


# --------------------------------------------------------------------------
# Flashcard review — reuses the existing SM-2 engine and gamification hooks
# exactly as flashcards.py::review_flashcard does, scoped to qStudio's own
# qstudio_flashcard_reviews collection instead of flashcard_reviews.
# --------------------------------------------------------------------------

@router.post("/outputs/{output_id}/flashcards/{card_id}/review")
async def review_qstudio_flashcard(
    output_id: str,
    card_id: str,
    payload: FlashcardReviewRequest,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    uid = current_user["firebase_uid"]
    output_doc = await _get_owned_output(db, output_id, uid)
    if output_doc["type"] != "flashcards":
        raise HTTPException(status_code=400, detail="This output is not a flashcards deck")

    cards = output_doc.get("result", {}).get("cards", [])
    if not any(c["id"] == card_id for c in cards):
        raise HTTPException(status_code=404, detail="Card not found in this deck")

    review_record = await db.qstudio_flashcard_reviews.find_one({
        "output_id": output_doc["_id"], "card_id": card_id, "owner_uid": uid,
    })
    current_ef = review_record.get("ease_factor", 2.5) if review_record else 2.5
    current_interval = review_record.get("interval_days", 1) if review_record else 1
    current_reps = review_record.get("repetitions", 0) if review_record else 0

    new_ef, new_interval, new_reps = calculate_sm2(
        payload.recall_rating, current_ef, current_interval, current_reps
    )
    now = datetime.now(timezone.utc)
    next_date = now + timedelta(days=new_interval)

    await db.qstudio_flashcard_reviews.update_one(
        {"output_id": output_doc["_id"], "card_id": card_id, "owner_uid": uid},
        {
            "$set": {
                "ease_factor": new_ef,
                "interval_days": new_interval,
                "repetitions": new_reps,
                "last_reviewed_at": now,
                "next_review_date": next_date,
            }
        },
        upsert=True,
    )

    xp_result = await xp_engine.award_xp(
        db=db,
        firebase_uid=uid,
        source="qstudio_flashcard",
        amount=5,
        idempotent_key=f"qstudio_review_{output_id}_{card_id}_{now.strftime('%Y%m%d%H%M')}",
    )
    await streak_engine.record_daily_activity(db, uid)
    new_badges = await badge_engine.check_and_award_badges(db, uid)

    return {
        "xp_awarded": xp_result.get("xp_awarded", 0),
        "next_review_date": next_date.isoformat(),
        "ease_factor": new_ef,
        "interval_days": new_interval,
        "new_badges": new_badges,
    }


# --------------------------------------------------------------------------
# Audio Overview playback URL — mirrors GET /api/video-overviews/{id}/view-url's
# shape: the finished mp3 isn't attached to a lesson's `resources` collection (there's
# no lesson here either), so it reads the B2 key straight off the qstudio_outputs doc.
# --------------------------------------------------------------------------

@router.get("/outputs/{output_id}/audio-url")
async def get_audio_output_url(output_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    doc = await _get_owned_output(db, output_id, current_user["firebase_uid"])
    if doc["type"] != "audio":
        raise HTTPException(status_code=400, detail="This output is not an audio overview")
    b2_key = doc.get("result", {}).get("b2_key")
    if doc["status"] != "ready" or not b2_key:
        raise HTTPException(status_code=409, detail="Audio is not ready yet")

    url = generate_download_url(b2_key, expires_in=AUDIO_URL_TTL_SECONDS)
    return {"audio_url": url}


# --------------------------------------------------------------------------
# Slides playback URLs — same shape as the audio-url endpoint above, but signs
# one URL per rendered slide image plus the downloadable deck PDF in one call,
# since SlidesViewer (frontend) needs all of them up front for its carousel.
# --------------------------------------------------------------------------

@router.get("/outputs/{output_id}/slides-urls")
async def get_slides_output_urls(output_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    doc = await _get_owned_output(db, output_id, current_user["firebase_uid"])
    if doc["type"] != "slides":
        raise HTTPException(status_code=400, detail="This output is not a slide deck")
    result = doc.get("result", {})
    image_keys = result.get("slide_images", [])
    pdf_key = result.get("pdf_b2_key")
    if doc["status"] != "ready" or not image_keys or not pdf_key:
        raise HTTPException(status_code=409, detail="Slides are not ready yet")

    return {
        "image_urls": [generate_download_url(key, expires_in=SLIDES_URL_TTL_SECONDS) for key in image_keys],
        "pdf_url": generate_download_url(pdf_key, expires_in=SLIDES_URL_TTL_SECONDS),
    }


# --------------------------------------------------------------------------
# Animation playback URL — same shape as the audio-url endpoint above, plus a
# thumbnail URL for the study-space card preview before playback.
# --------------------------------------------------------------------------

@router.get("/outputs/{output_id}/animation-url")
async def get_animation_output_url(output_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    doc = await _get_owned_output(db, output_id, current_user["firebase_uid"])
    if doc["type"] != "animation":
        raise HTTPException(status_code=400, detail="This output is not an animation")
    result = doc.get("result", {})
    b2_key = result.get("b2_key")
    thumbnail_b2_key = result.get("thumbnail_b2_key")
    if doc["status"] != "ready" or not b2_key:
        raise HTTPException(status_code=409, detail="Animation is not ready yet")

    return {
        "video_url": generate_download_url(b2_key, expires_in=ANIMATION_URL_TTL_SECONDS),
        "thumbnail_url": generate_download_url(thumbnail_b2_key, expires_in=ANIMATION_URL_TTL_SECONDS) if thumbnail_b2_key else None,
    }
