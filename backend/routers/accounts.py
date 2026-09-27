from fastapi import APIRouter, Depends, HTTPException
from database import get_db
from auth import get_verified_firebase_user, get_current_user, STAFF_ROLES
from services.verification_rules import public_verification

router = APIRouter(prefix="/api", tags=["Accounts"])

@router.post("/onboarding")
async def save_onboarding(
    user_data: dict,
    decoded_token: dict = Depends(get_verified_firebase_user)
):
    db = get_db()
    if db is None:
        return {"error": "Database not connected"}
    
    firebase_uid = decoded_token.get("uid")
    email = decoded_token.get("email")
    email_verified = decoded_token.get("email_verified", False)
    existing_user = await db.users.find_one({"firebase_uid": firebase_uid})
    if existing_user:
        raise HTTPException(status_code=400, detail="User already onboarded")
        
    requested_role = user_data.get("role", "learner")
    # Educators/researchers pick their role freely; educator features stay locked until
    # identity verification (routers/verification.py) is approved by an admin. Admin is never self-selectable.
    assigned_role = requested_role if requested_role in STAFF_ROLES else "learner"
    if assigned_role in STAFF_ROLES and not email_verified:
        raise HTTPException(status_code=400, detail="Please verify your email address first.")

    user_dict = {
        "firebase_uid": firebase_uid,
        "email": email,
        "full_name": user_data.get("name"),
        "age": user_data.get("age"),
        "interested_topic": user_data.get("topic"),
        "role": assigned_role
    }
    if assigned_role in STAFF_ROLES:
        user_dict["verification"] = {"status": "unsubmitted"}
    
    await db.users.insert_one(user_dict)
    return {"message": "User saved successfully"}

@router.get("/user/me")
async def get_user(user: dict = Depends(get_current_user)):
    if "verification" in user:
        user = {**user, "verification": public_verification(user["verification"])}
    return user

@router.patch("/user/me")
async def update_user(
    update_data: dict,
    user: dict = Depends(get_current_user),
    decoded_token: dict = Depends(get_verified_firebase_user)
):
    db = get_db()
    if db is None:
        raise HTTPException(status_code=500, detail="Database not connected")
    
    firebase_uid = decoded_token.get("uid")
    
    # Filter allowed fields
    allowed_fields = ["full_name", "age", "interested_topic"]
    update_dict = {k: v for k, v in update_data.items() if k in allowed_fields}
    
    if update_dict:
        await db.users.update_one({"firebase_uid": firebase_uid}, {"$set": update_dict})
    
    updated_user = await db.users.find_one({"firebase_uid": firebase_uid})
    if updated_user and "_id" in updated_user:
        updated_user["_id"] = str(updated_user["_id"])
    if updated_user and "verification" in updated_user:
        updated_user["verification"] = public_verification(updated_user["verification"])
    return updated_user
