import json
import os
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import firebase_admin
from firebase_admin import credentials, auth
from database import get_db

security = HTTPBearer()

# Initialize Firebase Admin
def init_firebase():
    if not firebase_admin._apps:
        # The service-account key is no longer committed to the repo, so the
        # deployed app has no file to point FIREBASE_SERVICE_ACCOUNT_PATH at.
        # credentials.Certificate() also accepts a parsed dict, so prefer the
        # whole JSON blob in an env var; the file path stays supported for
        # local dev where the key does sit on disk.
        cred_json = os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON")
        cred_path = os.environ.get("FIREBASE_SERVICE_ACCOUNT_PATH")

        source = None
        if cred_json:
            source = credentials.Certificate(json.loads(cred_json))
        elif cred_path:
            # Search candidate paths (CWD, backend dir, root workspace, frontend dir)
            root_dir = os.path.dirname(os.path.dirname(__file__))
            candidate_paths = [
                cred_path,
                os.path.abspath(cred_path),
                os.path.join(os.path.dirname(__file__), cred_path),
                os.path.join(root_dir, cred_path),
                os.path.join(root_dir, "frontend", cred_path)
            ]
            
            resolved_path = None
            for p in candidate_paths:
                if os.path.exists(p):
                    resolved_path = p
                    break

            if resolved_path:
                print(f"[FirebaseInit] Successfully found Firebase service account key at: {resolved_path}")
                source = credentials.Certificate(resolved_path)
            else:
                print(
                    f"Warning: FIREBASE_SERVICE_ACCOUNT_PATH file '{cred_path}' not found on disk. "
                    "Falling back to default Firebase App initialization."
                )

        try:
            if source:
                firebase_admin.initialize_app(source)
            else:
                firebase_admin.initialize_app()
        except Exception as e:
            print(f"Error initializing Firebase Admin SDK: {e}")
            if not firebase_admin._apps:
                print("Firebase Admin SDK failed to initialize.")

init_firebase()

async def get_verified_firebase_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """
    Dependency that extracts the Bearer token, verifies it with Firebase Admin,
    and returns the decoded token.
    """
    token = credentials.credentials
    try:
        # Allow 10 seconds of clock skew tolerance between local system time and Firebase servers
        decoded_token = auth.verify_id_token(token, check_revoked=True, clock_skew_seconds=10)
        return decoded_token
    except auth.RevokedIdTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has been revoked. Please sign in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid authentication credentials: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )

async def get_current_user(decoded_token: dict = Depends(get_verified_firebase_user)):
    """
    Dependency that returns the full MongoDB user document based on the verified Firebase token.
    Falls back to a default user dict if MongoDB is initializing or unavailable.

    Raises 404 (instead of auto-creating a "learner" doc) when a verified Firebase user has
    no MongoDB doc yet — this is the signal the frontend's ProtectedRoute uses to redirect to
    /onboarding. Auto-creating here used to silently insert the user as role="learner" /
    full_name="Quantum Learner" on whichever protected endpoint happened to fire first after
    login, so /api/user/me never actually 404'd and onboarding (role, age, interested topic)
    was permanently skipped.
    """
    db = get_db()
    uid = decoded_token.get("uid")

    user_doc = None
    if db is not None and uid:
        try:
            user_doc = await db.users.find_one({"firebase_uid": uid})
            if not user_doc:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not onboarded")
        except HTTPException:
            raise
        except Exception as e:
            print(f"[Auth Warning] Failed to query user document from DB: {e}")

    if not user_doc:
        default_name = decoded_token.get("name") or "Quantum Learner"
        return {
            "_id": uid,
            "firebase_uid": uid,
            "email": decoded_token.get("email", ""),
            "full_name": default_name,
            "display_name": default_name,
            "role": "learner",
            "xp_total": 0
        }
    
    user_doc["_id"] = str(user_doc.get("_id", uid))
    return user_doc

def require_role(*allowed_roles: str):
    """
    Dependency generator for RBAC. Returns a dependency that verifies the user has one of the allowed roles.
    """
    async def role_checker(user: dict = Depends(get_current_user)):
        if user.get("role") not in allowed_roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        return user
    return role_checker


# Educators and researchers share educator features, but only after identity verification.
STAFF_ROLES = ("educator", "researcher")


def is_verified_staff(user: dict) -> bool:
    return user.get("role") in STAFF_ROLES and (user.get("verification") or {}).get("status") == "approved"


async def require_verified_staff(user: dict = Depends(get_current_user)):
    if user.get("role") not in STAFF_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    if not is_verified_staff(user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Identity verification required")
    return user
