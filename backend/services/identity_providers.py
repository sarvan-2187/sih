"""HTTP clients for ORCID (free public API) and Didit (ID + liveness + face match)."""
import os
from urllib.parse import urlencode, urlparse

import httpx
from fastapi import HTTPException

DIDIT_API = "https://verification.didit.me/v3"


def _env(name: str, default: str = "") -> str:
    return (os.getenv(name) or default).strip("'\" ")


def _require(*names: str) -> list[str]:
    values = [_env(n) for n in names]
    missing = [n for n, v in zip(names, values) if not v]
    if missing:
        raise HTTPException(status_code=503, detail=f"Verification provider not configured: set {', '.join(missing)} in backend/.env")
    return values


# ---------------- ORCID ----------------

def orcid_authorize_url(state: str) -> str:
    client_id, redirect_uri = _require("ORCID_CLIENT_ID", "ORCID_REDIRECT_URI")
    base = _env("ORCID_BASE_URL", "https://orcid.org").rstrip("/")
    query = urlencode({"client_id": client_id, "response_type": "code", "scope": "/authenticate", "redirect_uri": redirect_uri, "state": state})
    return f"{base}/oauth/authorize?{query}"


async def orcid_exchange_code(code: str) -> dict:
    """Returns {"orcid", "name"} for the authenticated iD."""
    client_id, client_secret, redirect_uri = _require("ORCID_CLIENT_ID", "ORCID_CLIENT_SECRET", "ORCID_REDIRECT_URI")
    base = _env("ORCID_BASE_URL", "https://orcid.org").rstrip("/")
    async with httpx.AsyncClient(timeout=15) as client:
        res = await client.post(f"{base}/oauth/token", headers={"Accept": "application/json"}, data={
            "client_id": client_id, "client_secret": client_secret, "grant_type": "authorization_code",
            "code": code, "redirect_uri": redirect_uri,
        })
    if res.status_code != 200:
        raise HTTPException(status_code=400, detail="ORCID sign-in failed")
    data = res.json()
    return {"orcid": data["orcid"], "name": data.get("name") or ""}


async def orcid_public_record(orcid: str) -> dict:
    """Current employments and works count from the public record (best effort)."""
    host = urlparse(_env("ORCID_BASE_URL", "https://orcid.org")).netloc
    pub = f"https://pub.{host}/v3.0/{orcid}"
    employments, works_count = [], 0
    try:
        async with httpx.AsyncClient(timeout=15, headers={"Accept": "application/json"}) as client:
            emp = (await client.get(f"{pub}/employments")).json()
            works = (await client.get(f"{pub}/works")).json()
        for group in emp.get("affiliation-group", []):
            for summary in group.get("summaries", []):
                e = summary.get("employment-summary") or {}
                employments.append({
                    "organization": (e.get("organization") or {}).get("name"),
                    "role": e.get("role-title"),
                    "current": e.get("end-date") is None,
                })
        works_count = len(works.get("group", []))
    except (httpx.HTTPError, ValueError) as e:
        print(f"[ORCID] public record fetch failed for {orcid}: {e}")
    return {"employments": employments, "works_count": works_count}


# ---------------- Didit ----------------

async def didit_create_session(uid: str, email: str) -> dict:
    api_key, workflow_id = _require("DIDIT_API_KEY", "DIDIT_WORKFLOW_ID")
    body = {"workflow_id": workflow_id, "vendor_data": uid, "contact_details": {"email": email}}
    if _env("DIDIT_CALLBACK_URL"):
        body["callback"] = _env("DIDIT_CALLBACK_URL")
    async with httpx.AsyncClient(timeout=20) as client:
        res = await client.post(f"{DIDIT_API}/session/", headers={"x-api-key": api_key}, json=body)
    if res.status_code not in (200, 201):
        print(f"[Didit] create session failed {res.status_code}: {res.text[:300]}")
        raise HTTPException(status_code=502, detail="Could not start ID verification")
    data = res.json()
    return {"session_id": data["session_id"], "url": data["url"]}


def _document_name(decision: dict) -> str:
    # The decision GET returns document results at the root; field names have varied across API versions.
    for key in ("id_verifications", "documents", "id_verification"):
        docs = decision.get(key)
        for doc in docs if isinstance(docs, list) else [docs] if isinstance(docs, dict) else []:
            name = doc.get("full_name") or " ".join(filter(None, [doc.get("first_name"), doc.get("last_name")]))
            if name:
                return name
    return ""


async def didit_decision(session_id: str) -> dict:
    """Returns {"status", "full_name", "vendor_data"} for a session."""
    (api_key,) = _require("DIDIT_API_KEY")
    async with httpx.AsyncClient(timeout=20) as client:
        res = await client.get(f"{DIDIT_API}/session/{session_id}/decision/", headers={"x-api-key": api_key})
    if res.status_code != 200:
        raise HTTPException(status_code=502, detail="Could not read ID verification result")
    data = res.json()
    return {"status": data.get("status"), "full_name": _document_name(data), "vendor_data": data.get("vendor_data")}
