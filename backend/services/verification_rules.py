"""Pure rules for educator/researcher identity verification (no DB, no network) — see
docs/superpowers/specs/2026-09-27-roles-verification-mentorship-design.md."""
import hashlib
import hmac
import re
import secrets

# ponytail: static free-mail blocklist, not an institution allowlist; admin review catches the rest.
FREE_MAIL_DOMAINS = {
    "gmail.com", "googlemail.com", "yahoo.com", "yahoo.co.in", "ymail.com", "outlook.com", "hotmail.com",
    "live.com", "msn.com", "icloud.com", "me.com", "aol.com", "proton.me", "protonmail.com", "zoho.com",
    "rediffmail.com", "gmx.com", "mail.com", "yandex.com", "tutanota.com",
}
EMAIL_RE = re.compile(r"^[^@\s]+@([A-Za-z0-9-]+\.)+[A-Za-z]{2,}$")
CODE_TTL_SECONDS = 600
MAX_CODE_ATTEMPTS = 5
TITLES = {"dr", "prof", "professor", "mr", "mrs", "ms", "miss", "shri", "smt"}


def is_institutional_email(email: str) -> bool:
    email = (email or "").strip().lower()
    return bool(EMAIL_RE.match(email)) and email.rsplit("@", 1)[1] not in FREE_MAIL_DOMAINS


def generate_code() -> str:
    return f"{secrets.randbelow(10**6):06d}"


def hash_code(uid: str, code: str) -> str:
    return hashlib.sha256(f"{uid}:{code.strip()}".encode()).hexdigest()


def name_tokens(name: str) -> set[str]:
    words = re.findall(r"[a-z]+", (name or "").lower())
    return {w for w in words if len(w) > 1 and w not in TITLES}


def names_match(id_name: str, *other_names: str):
    """True/False when the ID name can be compared with at least one other name, else None.
    A match needs 2 shared name tokens (or all tokens of a one-word name)."""
    id_tokens = name_tokens(id_name)
    others = [name_tokens(n) for n in other_names if name_tokens(n)]
    if not id_tokens or not others:
        return None
    return all(len(id_tokens & o) >= min(2, len(id_tokens), len(o)) for o in others)


def missing_requirements(role: str, v: dict) -> list[str]:
    profile = v.get("profile") or {}
    missing = []
    if not (profile.get("institution") and profile.get("designation")):
        missing.append("profile")
    if not (v.get("email_check") or {}).get("verified_at"):
        missing.append("institutional_email")
    if (v.get("id_check") or {}).get("status") != "Approved":
        missing.append("id_check")
    has_orcid = bool((v.get("orcid") or {}).get("orcid"))
    if role == "researcher" and not has_orcid:
        missing.append("orcid")
    if role == "educator" and not (has_orcid or v.get("proof_key")):
        missing.append("orcid_or_proof")
    return missing


def public_verification(v: dict) -> dict:
    """Verification block without secrets (email code hash/attempts, OAuth state, raw proof key)."""
    v = dict(v or {})
    v.pop("orcid_state", None)
    if v.get("email_check"):
        ec = v["email_check"]
        v["email_check"] = {"email": ec.get("email"), "verified_at": ec.get("verified_at"), "code_sent": bool(ec.get("code_hash"))}
    v["has_proof"] = bool(v.pop("proof_key", None))
    return v


def didit_simple_signature_ok(secret: str, signature: str, timestamp: str, session_id: str, status: str,
                              webhook_type: str, now: int) -> bool:
    """X-Signature-Simple: HMAC-SHA256 over "{timestamp}:{session_id}:{status}:{webhook_type}".
    It authenticates only the envelope, so callers must re-fetch the decision from Didit."""
    try:
        if abs(now - int(timestamp)) > 300:
            return False
    except (TypeError, ValueError):
        return False
    message = f"{timestamp}:{session_id}:{status}:{webhook_type}".encode()
    expected = hmac.new(secret.encode(), message, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature or "")
