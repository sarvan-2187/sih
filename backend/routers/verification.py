"""Identity verification for educators & researchers: institutional email code, ORCID, Didit ID check,
optional PDF proof, then admin review (routers/admin.py)."""
import asyncio
import os
import secrets
import time
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field, field_validator

from auth import require_role, STAFF_ROLES
from database import get_db
from services import identity_providers as idp
from services.email_service import send_email
from services.verification_rules import (
    CODE_TTL_SECONDS, MAX_CODE_ATTEMPTS, didit_simple_signature_ok, generate_code, hash_code,
    is_institutional_email, missing_requirements, names_match, public_verification,
)
import storage_service

router = APIRouter(prefix="/api/verification", tags=["Verification"])
require_staff = require_role(*STAFF_ROLES)
LOCKED_STATUSES = ("pending", "approved")


def _frontend_url(path: str) -> str:
    base = (os.getenv("FRONTEND_URL") or "http://localhost:5173").strip("'\" ").rstrip("/")
    return f"{base}{path}"


def _v(user: dict) -> dict:
    return user.get("verification") or {}


def _ensure_editable(user: dict):
    if _v(user).get("status") in LOCKED_STATUSES:
        raise HTTPException(status_code=409, detail="Verification already submitted")


async def _set(uid: str, fields: dict, unset: Optional[list[str]] = None):
    update = {}
    if fields:
        update["$set"] = {f"verification.{k}": v for k, v in fields.items()}
    if unset:
        update["$unset"] = {f"verification.{k}": "" for k in unset}
    await get_db().users.update_one({"firebase_uid": uid}, update)


async def _refresh_name_match(uid: str):
    user = await get_db().users.find_one({"firebase_uid": uid})
    v = _v(user or {})
    match = names_match((v.get("id_check") or {}).get("full_name", ""), (v.get("orcid") or {}).get("name", ""), (user or {}).get("full_name", ""))
    await _set(uid, {"name_match": match})


def _view(user: dict) -> dict:
    v = _v(user)
    return {"role": user.get("role"), **public_verification(v), "status": v.get("status", "unsubmitted"),
            "missing": missing_requirements(user.get("role"), v)}


@router.get("/me")
async def get_my_verification(user=Depends(require_staff)):
    return _view(user)


class ProfileIn(BaseModel):
    institution: str = Field(min_length=2, max_length=160)
    designation: str = Field(min_length=2, max_length=100)
    department: str = Field(default="", max_length=120)
    research_areas: list[str] = Field(default_factory=list, max_length=10)
    profile_url: str = Field(default="", max_length=300)

    @field_validator("research_areas")
    @classmethod
    def _areas(cls, areas):
        return [a.strip()[:60] for a in areas if a.strip()]

    @field_validator("profile_url")
    @classmethod
    def _url(cls, url):
        if url and not url.startswith(("https://", "http://")):
            raise ValueError("Profile link must start with https://")
        return url


@router.put("/profile")
async def save_profile(profile: ProfileIn, user=Depends(require_staff)):
    _ensure_editable(user)
    await _set(user["firebase_uid"], {"profile": profile.model_dump()})
    return {"ok": True}


class EmailIn(BaseModel):
    email: str


@router.post("/email/send")
async def send_email_code(body: EmailIn, user=Depends(require_staff)):
    _ensure_editable(user)
    email = body.email.strip().lower()
    if not is_institutional_email(email):
        raise HTTPException(status_code=400, detail="Use your institution email (personal providers like Gmail are not accepted)")
    last = _v(user).get("email_check") or {}
    if last.get("sent_at") and datetime.utcnow() - last["sent_at"] < timedelta(seconds=60):
        raise HTTPException(status_code=429, detail="Please wait a minute before requesting another code")
    code = generate_code()
    await _set(user["firebase_uid"], {"email_check": {
        "email": email, "code_hash": hash_code(user["firebase_uid"], code), "attempts": 0,
        "sent_at": datetime.utcnow(), "expires_at": datetime.utcnow() + timedelta(seconds=CODE_TTL_SECONDS), "verified_at": None,
    }})
    await send_email(email, "Your Qrious verification code",
                     f"Your Qrious institutional email verification code is {code}. It expires in 10 minutes.")
    return {"ok": True}


class CodeIn(BaseModel):
    code: str = Field(min_length=6, max_length=6)


@router.post("/email/confirm")
async def confirm_email_code(body: CodeIn, user=Depends(require_staff)):
    _ensure_editable(user)
    ec = _v(user).get("email_check") or {}
    if not ec.get("code_hash"):
        raise HTTPException(status_code=400, detail="Request a code first")
    if ec.get("attempts", 0) >= MAX_CODE_ATTEMPTS or datetime.utcnow() > ec["expires_at"]:
        raise HTTPException(status_code=400, detail="Code expired. Request a new one")
    uid = user["firebase_uid"]
    if not secrets.compare_digest(hash_code(uid, body.code), ec["code_hash"]):
        await get_db().users.update_one({"firebase_uid": uid}, {"$inc": {"verification.email_check.attempts": 1}})
        raise HTTPException(status_code=400, detail="Incorrect code")
    await _set(uid, {"email_check": {"email": ec["email"], "verified_at": datetime.utcnow()}})
    return {"ok": True}


@router.get("/orcid/start")
async def orcid_start(user=Depends(require_staff)):
    _ensure_editable(user)
    state = secrets.token_urlsafe(24)
    url = idp.orcid_authorize_url(state)
    await _set(user["firebase_uid"], {"orcid_state": state})
    return {"url": url}


@router.get("/orcid/callback")
async def orcid_callback(state: str = "", code: str = "", error: str = ""):
    # Browser redirect from ORCID (no bearer token): the one-time state binds it to the user.
    db = get_db()
    user = await db.users.find_one({"verification.orcid_state": state}) if state else None
    if not user or error or not code:
        return RedirectResponse(_frontend_url("/verification?orcid=error"))
    uid = user["firebase_uid"]
    await _set(uid, {}, unset=["orcid_state"])
    try:
        ident = await idp.orcid_exchange_code(code)
    except HTTPException:
        return RedirectResponse(_frontend_url("/verification?orcid=error"))
    if await db.users.find_one({"verification.orcid.orcid": ident["orcid"], "firebase_uid": {"$ne": uid}}):
        return RedirectResponse(_frontend_url("/verification?orcid=in_use"))
    record = await idp.orcid_public_record(ident["orcid"])
    await _set(uid, {"orcid": {**ident, **record, "linked_at": datetime.utcnow()}})
    await _refresh_name_match(uid)
    return RedirectResponse(_frontend_url("/verification?orcid=linked"))


@router.post("/didit/session")
async def start_id_check(user=Depends(require_staff)):
    _ensure_editable(user)
    session = await idp.didit_create_session(user["firebase_uid"], user.get("email", ""))
    await _set(user["firebase_uid"], {"id_check": {"session_id": session["session_id"], "status": "Not Started"}})
    return {"url": session["url"]}


async def _store_decision(uid: str, session_id: str):
    decision = await idp.didit_decision(session_id)
    if decision.get("vendor_data") and decision["vendor_data"] != uid:
        raise HTTPException(status_code=400, detail="ID check does not belong to this account")
    await _set(uid, {"id_check": {"session_id": session_id, "status": decision["status"],
                                  "full_name": decision["full_name"], "checked_at": datetime.utcnow()}})
    await _refresh_name_match(uid)


@router.post("/didit/refresh")
async def refresh_id_check(user=Depends(require_staff)):
    session_id = (_v(user).get("id_check") or {}).get("session_id")
    if not session_id:
        raise HTTPException(status_code=400, detail="Start the ID check first")
    await _store_decision(user["firebase_uid"], session_id)
    return _view(await get_db().users.find_one({"firebase_uid": user["firebase_uid"]}))


@router.post("/didit/webhook")
async def didit_webhook(request: Request):
    secret = (os.getenv("DIDIT_WEBHOOK_SECRET") or "").strip("'\" ")
    if not secret:
        raise HTTPException(status_code=503, detail="Webhook not configured")
    body = await request.json()
    ok = didit_simple_signature_ok(secret, request.headers.get("x-signature-simple", ""), request.headers.get("x-timestamp", ""),
                                   body.get("session_id", ""), body.get("status", ""), body.get("webhook_type", ""), int(time.time()))
    if not ok:
        raise HTTPException(status_code=401, detail="Invalid signature")
    user = await get_db().users.find_one({"verification.id_check.session_id": body.get("session_id")})
    if user:
        await _store_decision(user["firebase_uid"], body["session_id"])  # never trust the body's decision
    return {"ok": True}


@router.post("/proof/upload-url")
async def proof_upload_url(user=Depends(require_staff)):
    _ensure_editable(user)
    key = f"verification/{user['firebase_uid']}.pdf"
    return {"upload_url": storage_service.generate_upload_url(key, "application/pdf", expires_in=600)}


@router.post("/proof/confirm")
async def proof_confirm(user=Depends(require_staff)):
    _ensure_editable(user)
    key = f"verification/{user['firebase_uid']}.pdf"
    try:
        head = await asyncio.to_thread(storage_service.s3_client.head_object, Bucket=storage_service.B2_BUCKET_NAME, Key=key)
    except Exception:
        raise HTTPException(status_code=400, detail="Upload not found. Please upload the PDF again")
    if head.get("ContentType") != "application/pdf" or head.get("ContentLength", 0) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Proof must be a PDF under 10 MB")
    await _set(user["firebase_uid"], {"proof_key": key})
    return {"ok": True}


@router.post("/submit")
async def submit_verification(user=Depends(require_staff)):
    _ensure_editable(user)
    missing = missing_requirements(user["role"], _v(user))
    if missing:
        raise HTTPException(status_code=400, detail={"message": "Complete all steps first", "missing": missing})
    await _set(user["firebase_uid"], {"status": "pending", "submitted_at": datetime.utcnow(), "rejection_reason": None})
    return {"ok": True}
