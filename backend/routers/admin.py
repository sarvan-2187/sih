"""Admin review of educator/researcher identity verification. Admins are created only via promote_admin.py."""
from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from auth import require_role, STAFF_ROLES
from database import get_db
from services.email_service import send_email
from services.verification_rules import missing_requirements, public_verification
import storage_service

router = APIRouter(prefix="/api/admin", tags=["Admin"])
require_admin = require_role("admin")


@router.get("/verifications")
async def list_verifications(status: Literal["pending", "approved", "rejected", "unsubmitted"] = "pending",
                             admin=Depends(require_admin)):
    query = {"role": {"$in": list(STAFF_ROLES)}, "verification.status": status}
    users = await get_db().users.find(query).sort("verification.submitted_at", 1).to_list(200)
    return [{
        "uid": u["firebase_uid"], "email": u.get("email"), "full_name": u.get("full_name"), "role": u.get("role"),
        "verification": public_verification(u.get("verification")),
        "missing": missing_requirements(u.get("role"), u.get("verification") or {}),
    } for u in users]


async def _staff_user(uid: str) -> dict:
    user = await get_db().users.find_one({"firebase_uid": uid, "role": {"$in": list(STAFF_ROLES)}})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.get("/verifications/{uid}/proof")
async def proof_download_url(uid: str, admin=Depends(require_admin)):
    key = ((await _staff_user(uid)).get("verification") or {}).get("proof_key")
    if not key:
        raise HTTPException(status_code=404, detail="No proof document uploaded")
    return {"url": storage_service.generate_download_url(key, expires_in=300)}


class DecisionIn(BaseModel):
    decision: Literal["approve", "reject"]
    reason: str = Field(default="", max_length=500)


@router.post("/verifications/{uid}/decision")
async def decide(uid: str, body: DecisionIn, admin=Depends(require_admin)):
    user = await _staff_user(uid)
    if (user.get("verification") or {}).get("status") != "pending":
        raise HTTPException(status_code=409, detail="Only pending verifications can be reviewed")
    if body.decision == "reject" and not body.reason.strip():
        raise HTTPException(status_code=400, detail="A reason is required to reject")
    status = "approved" if body.decision == "approve" else "rejected"
    await get_db().users.update_one({"firebase_uid": uid}, {"$set": {
        "verification.status": status, "verification.reviewed_at": datetime.utcnow(),
        "verification.reviewed_by": admin["firebase_uid"], "verification.rejection_reason": body.reason.strip() or None,
    }})
    message = ("Your identity has been verified. Educator features are now unlocked on Qrious."
               if status == "approved" else f"Your verification was not approved: {body.reason.strip()}\nYou can update your details and resubmit.")
    try:
        await send_email(user.get("email", ""), f"Qrious verification {status}", message)
    except Exception as e:
        print(f"[Admin] decision email failed for {uid}: {e}")
    return {"ok": True, "status": status}
