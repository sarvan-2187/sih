from fastapi import APIRouter, Depends, HTTPException
from database import get_db
from models.resource import UploadUrlRequest
from models.lms import (
    CourseCreate, CourseUpdate, ModuleCreate, ModuleUpdate, LessonCreate, LessonUpdate,
    CourseOut, ModuleOut, LessonOut, serialize
)
from storage_service import generate_upload_url
from auth import require_verified_staff, is_verified_staff, get_current_user
from routers.default import require_course_access
from datetime import datetime, timezone
from bson import ObjectId
import re

router = APIRouter(prefix="/api", tags=["Educator"])

async def require_course_owner(course_id: str, user=Depends(get_current_user)):
    db = get_db()
    course = await db.courses.find_one({"_id": ObjectId(course_id)})
    if not course:
        raise HTTPException(404, "Course not found")
    if not is_verified_staff(user) or course["owner_uid"] != user["firebase_uid"]:
        raise HTTPException(403, "Only the owning educator can modify this course")
    return course

async def require_lesson_owner(lesson_id: str, user=Depends(get_current_user)):
    db = get_db()
    lesson = await db.lessons.find_one({"_id": ObjectId(lesson_id)})
    if not lesson:
        raise HTTPException(404, "Lesson not found")
    module = await db.modules.find_one({"_id": lesson["module_id"]})
    if not module:
        raise HTTPException(404, "Module not found")
    course = await db.courses.find_one({"_id": module["course_id"]})
    if not course:
        raise HTTPException(404, "Course not found")
    if not is_verified_staff(user) or course["owner_uid"] != user["firebase_uid"]:
        raise HTTPException(403, "Only the owning educator can upload to this lesson")
    return course



@router.post("/courses", response_model=CourseOut)
async def create_course(course_data: CourseCreate, user=Depends(require_verified_staff)):
    db = get_db()
    new_course = {
        "title": course_data.title,
        "description": course_data.description,
        "owner_uid": user["firebase_uid"],
        "status": "draft",
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    result = await db.courses.insert_one(new_course)
    new_course["_id"] = result.inserted_id
    return serialize(new_course, CourseOut)

@router.patch("/courses/{course_id}", response_model=CourseOut)
async def update_course(course_id: str, course_data: CourseUpdate, course=Depends(require_course_owner)):
    db = get_db()
    update_data = course_data.model_dump(exclude_unset=True)
    if update_data:
        update_data["updated_at"] = datetime.now(timezone.utc)
        await db.courses.update_one({"_id": ObjectId(course_id)}, {"$set": update_data})
        
    updated = await db.courses.find_one({"_id": ObjectId(course_id)})
    return serialize(updated, CourseOut)

@router.post("/courses/{course_id}/publish", response_model=CourseOut)
async def publish_course(course_id: str, course=Depends(require_course_owner)):
    db = get_db()
    new_status = "draft" if course["status"] == "published" else "published"
    await db.courses.update_one({"_id": ObjectId(course_id)}, {"$set": {"status": new_status, "updated_at": datetime.now(timezone.utc)}})
    updated = await db.courses.find_one({"_id": ObjectId(course_id)})
    return serialize(updated, CourseOut)

@router.get("/educator/courses", response_model=list[CourseOut])
async def list_educator_courses(user=Depends(require_verified_staff)):
    db = get_db()
    cursor = db.courses.find({"owner_uid": user["firebase_uid"]}).sort("created_at", -1)
    courses = await cursor.to_list(length=100)
    return [serialize(c, CourseOut) for c in courses]

@router.get("/courses/{course_id}/modules", response_model=list[ModuleOut])
async def list_modules(course_id: str, user=Depends(get_current_user)):
    db = get_db()
    # Was reachable by ANY authenticated user for ANY course_id (draft or
    # someone else's, enrolled or not) -- get_course_detail already gates
    # module/lesson visibility behind enrollment/ownership, but this direct
    # endpoint bypassed that entirely. Same access rule enforced here now.
    await require_course_access(course_id, user)
    modules = await db.modules.find({"course_id": ObjectId(course_id)}).sort("order", 1).to_list(length=None)
    return [serialize(m, ModuleOut) for m in modules]

@router.post("/courses/{course_id}/modules", response_model=ModuleOut)
async def create_module(course_id: str, module_data: ModuleCreate, course=Depends(require_course_owner)):
    db = get_db()
    existing_count = await db.modules.count_documents({"course_id": ObjectId(course_id)})
    new_module = {
        "course_id": ObjectId(course_id),
        "title": module_data.title,
        "order": existing_count + 1
    }
    result = await db.modules.insert_one(new_module)
    new_module["_id"] = result.inserted_id
    return serialize(new_module, ModuleOut)

@router.get("/modules/{module_id}/lessons", response_model=list[LessonOut])
async def list_lessons(module_id: str, user=Depends(get_current_user)):
    db = get_db()
    # Same IDOR as list_modules above -- resolve the owning course and apply
    # the same access rule before returning lesson titles/structure.
    module = await db.modules.find_one({"_id": ObjectId(module_id)})
    if not module:
        raise HTTPException(404, "Module not found")
    await require_course_access(str(module["course_id"]), user)

    lessons = await db.lessons.find({"module_id": ObjectId(module_id)}).sort("order", 1).to_list(length=None)
    return [serialize(l, LessonOut) for l in lessons]

@router.post("/modules/{module_id}/lessons", response_model=LessonOut)
async def create_lesson(module_id: str, lesson_data: LessonCreate, user=Depends(get_current_user)):
    db = get_db()
    module = await db.modules.find_one({"_id": ObjectId(module_id)})
    if not module:
        raise HTTPException(404, "Module not found")
        
    course = await db.courses.find_one({"_id": module["course_id"]})
    if not course or not is_verified_staff(user) or course["owner_uid"] != user["firebase_uid"]:
        raise HTTPException(403, "Only the owning educator can modify this course")
        
    existing_count = await db.lessons.count_documents({"module_id": ObjectId(module_id)})
    new_lesson = {
        "module_id": ObjectId(module_id),
        "title": lesson_data.title,
        "order": existing_count + 1
    }
    result = await db.lessons.insert_one(new_lesson)
    new_lesson["_id"] = result.inserted_id
    return serialize(new_lesson, LessonOut)

ALLOWED_RESOURCE_TYPES = {"video", "ppt", "notes", "cheatsheet", "interactive_lab"}

def _safe_filename(filename: str) -> str:
    """Strips everything that isn't safe in a B2/S3 object key segment.
    request.resource_type/request.filename previously went straight into the
    storage key with zero validation -- a crafted value (e.g. containing
    "../") could construct a key outside the intended
    {resource_type}/{lesson_id}/ namespace, colliding with or overwriting an
    unrelated resource's object. Collapsing to a safe basename closes that."""
    filename = filename.replace(' ', '_')
    filename = re.sub(r'[^A-Za-z0-9._-]', '', filename)
    filename = filename.replace('..', '')
    return filename or "file"

@router.post("/lessons/{lesson_id}/resources/upload-url")
async def get_upload_url(lesson_id: str, request: UploadUrlRequest, course=Depends(require_lesson_owner), user=Depends(get_current_user)):
    db = get_db()
    if db is None:
        raise HTTPException(status_code=500, detail="Database not connected")

    if request.resource_type not in ALLOWED_RESOURCE_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid resource_type. Must be one of: {sorted(ALLOWED_RESOURCE_TYPES)}")

    PDF_ONLY_TYPES = {"ppt", "notes", "cheatsheet"}
    if request.resource_type in PDF_ONLY_TYPES and request.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="This resource type requires a PDF file")

    key = f"{request.resource_type}/{lesson_id}/{_safe_filename(request.filename)}"
    url = generate_upload_url(key, request.content_type)
    
    metadata = {
        "lesson_id": ObjectId(lesson_id),
        "resource_type": request.resource_type,
        "title": request.title,
        "description": request.description,
        "filename": request.filename,
        "b2_key": key,
        "uploaded_by": user.get("firebase_uid"),
        "uploaded_at": datetime.now(timezone.utc),
        "status": "pending"
    }
    
    result = await db.resources.insert_one(metadata)
    
    return {
        "upload_url": url, 
        "key": key, 
        "resource_id": str(result.inserted_id)
    }

@router.post("/resources/{resource_id}/confirm")
async def confirm_upload(resource_id: str, user=Depends(require_verified_staff)):
    db = get_db()
    if db is None:
        raise HTTPException(status_code=500, detail="Database not connected")
        
    result = await db.resources.update_one(
        {"_id": ObjectId(resource_id), "uploaded_by": user.get("firebase_uid")},
        {"$set": {"status": "confirmed"}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Resource not found or already confirmed")
        
    return {"message": "Resource upload confirmed"}

@router.delete("/courses/{course_id}")
async def delete_course(course_id: str, course=Depends(require_course_owner)):
    db = get_db()
    
    # Find all modules
    modules = await db.modules.find({"course_id": ObjectId(course_id)}).to_list(length=None)
    module_ids = [m["_id"] for m in modules]
    
    # Find all lessons
    lessons = await db.lessons.find({"module_id": {"$in": module_ids}}).to_list(length=None)
    lesson_ids = [l["_id"] for l in lessons]
    
    # Delete from database
    await db.resources.delete_many({"lesson_id": {"$in": lesson_ids}})
    await db.lesson_progress.delete_many({"lesson_id": {"$in": lesson_ids}})
    await db.lessons.delete_many({"module_id": {"$in": module_ids}})
    await db.modules.delete_many({"course_id": ObjectId(course_id)})
    await db.enrollments.delete_many({"course_id": ObjectId(course_id)})
    await db.courses.delete_one({"_id": ObjectId(course_id)})
    
    return {"message": "Course deleted"}

@router.patch("/modules/{module_id}", response_model=ModuleOut)
async def update_module(module_id: str, module_data: ModuleUpdate, user=Depends(get_current_user)):
    db = get_db()
    module = await db.modules.find_one({"_id": ObjectId(module_id)})
    if not module:
        raise HTTPException(404, "Module not found")
    await require_course_owner(str(module["course_id"]), user=user)
    
    update_data = module_data.model_dump(exclude_unset=True)
    if update_data:
        await db.modules.update_one({"_id": ObjectId(module_id)}, {"$set": update_data})
        
    updated = await db.modules.find_one({"_id": ObjectId(module_id)})
    return serialize(updated, ModuleOut)

@router.delete("/modules/{module_id}")
async def delete_module(module_id: str, user=Depends(get_current_user)):
    db = get_db()
    module = await db.modules.find_one({"_id": ObjectId(module_id)})
    if not module:
        raise HTTPException(404, "Module not found")
    await require_course_owner(str(module["course_id"]), user=user)
    
    lessons = await db.lessons.find({"module_id": ObjectId(module_id)}).to_list(length=None)
    lesson_ids = [l["_id"] for l in lessons]
    
    await db.resources.delete_many({"lesson_id": {"$in": lesson_ids}})
    await db.lesson_progress.delete_many({"lesson_id": {"$in": lesson_ids}})
    await db.lessons.delete_many({"module_id": ObjectId(module_id)})
    await db.modules.delete_one({"_id": ObjectId(module_id)})
    
    return {"message": "Module deleted"}

@router.patch("/lessons/{lesson_id}", response_model=LessonOut)
async def update_lesson(lesson_id: str, lesson_data: LessonUpdate, course=Depends(require_lesson_owner)):
    db = get_db()
    update_data = lesson_data.model_dump(exclude_unset=True)
    if update_data:
        await db.lessons.update_one({"_id": ObjectId(lesson_id)}, {"$set": update_data})
        
    updated = await db.lessons.find_one({"_id": ObjectId(lesson_id)})
    return serialize(updated, LessonOut)

@router.delete("/lessons/{lesson_id}")
async def delete_lesson(lesson_id: str, course=Depends(require_lesson_owner)):
    db = get_db()
    await db.resources.delete_many({"lesson_id": ObjectId(lesson_id)})
    await db.lesson_progress.delete_many({"lesson_id": ObjectId(lesson_id)})
    await db.lessons.delete_one({"_id": ObjectId(lesson_id)})
    
    return {"message": "Lesson deleted"}

@router.delete("/resources/{resource_id}")
async def delete_resource(resource_id: str, user=Depends(require_verified_staff)):
    db = get_db()
    resource = await db.resources.find_one({"_id": ObjectId(resource_id)})
    if not resource:
        raise HTTPException(404, "Resource not found")
        
    if resource["uploaded_by"] != user["firebase_uid"]:
        raise HTTPException(403, "Only the uploading educator can delete this resource")
        
    await db.resources.delete_one({"_id": ObjectId(resource_id)})
    return {"message": "Resource deleted"}
