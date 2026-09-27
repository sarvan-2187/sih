from fastapi import APIRouter, Depends, HTTPException
from database import get_db
from storage_service import generate_download_url
from auth import get_current_user, require_role, require_verified_staff
from bson import ObjectId
from datetime import datetime, timezone
from models.lms import CourseOut, serialize

router = APIRouter(prefix="/api", tags=["Default"])

async def resolve_course_id_from_resource(resource_id: str) -> str:
    db = get_db()
    resource = await db.resources.find_one({"_id": ObjectId(resource_id)})
    if not resource:
        raise HTTPException(404, "Resource not found")
    if "lesson_id" not in resource:
        raise HTTPException(400, "Resource is not part of a lesson")
    lesson = await db.lessons.find_one({"_id": resource["lesson_id"]})
    if not lesson:
        raise HTTPException(404, "Lesson not found")
    module = await db.modules.find_one({"_id": lesson["module_id"]})
    if not module:
        raise HTTPException(404, "Module not found")
    return str(module["course_id"])

async def require_course_access(course_id: str, user=Depends(get_current_user)):
    db = get_db()
    course = await db.courses.find_one({"_id": ObjectId(course_id)})
    if not course:
        raise HTTPException(404, "Course not found")
    if course.get("owner_uid") == user["firebase_uid"]:
        return course
    enrolled = await db.enrollments.find_one({
        "student_uid": user["firebase_uid"], 
        "course_id": ObjectId(course_id)
    })
    if not enrolled:
        raise HTTPException(403, "You must enroll in this course to access its content")
    return course

@router.get("/courses", response_model=list[CourseOut])
async def list_published_courses(user=Depends(get_current_user)):
    db = get_db()
    cursor = db.courses.find({"status": "published"}).sort("created_at", -1)
    courses = await cursor.to_list(length=100)
    return [serialize(c, CourseOut) for c in courses]

@router.get("/courses/{course_id}")
async def get_course_detail(course_id: str, user=Depends(get_current_user)):
    db = get_db()
    course = await db.courses.find_one({"_id": ObjectId(course_id)})
    if not course:
        raise HTTPException(404, "Course not found")
        
    is_owner = course.get("owner_uid") == user["firebase_uid"]
    enrolled = await db.enrollments.find_one({
        "student_uid": user["firebase_uid"], 
        "course_id": ObjectId(course_id)
    })
    
    has_access = is_owner or bool(enrolled)
    
    # Fetch modules
    modules_cursor = db.modules.find({"course_id": ObjectId(course_id)}).sort("order", 1)
    modules = await modules_cursor.to_list(length=100)
    
    for module in modules:
        module["id"] = str(module.pop("_id"))
        module["course_id"] = str(module["course_id"])
        
        # Fetch lessons for each module
        lessons_cursor = db.lessons.find({"module_id": ObjectId(module["id"])}).sort("order", 1)
        lessons = await lessons_cursor.to_list(length=100)
        
        for lesson in lessons:
            lesson["id"] = str(lesson.pop("_id"))
            lesson["module_id"] = str(lesson["module_id"])
            
            # Fetch resources if has access
            if has_access:
                resources_cursor = db.resources.find({"lesson_id": ObjectId(lesson["id"]), "status": "confirmed"})
                resources = await resources_cursor.to_list(length=100)
                for res in resources:
                    res["resource_id"] = str(res.pop("_id"))
                    res["lesson_id"] = str(res["lesson_id"])
                    if "b2_key" in res:
                        del res["b2_key"]
                lesson["resources"] = resources
            else:
                lesson["resources"] = [] # Hide resources if not enrolled
                
        module["lessons"] = lessons
        
    course["id"] = str(course.pop("_id"))
    course["modules"] = modules
    course["enrolled"] = bool(enrolled)
    
    return course

@router.post("/courses/{course_id}/join")
async def enroll_course(course_id: str, user=Depends(get_current_user)):
    db = get_db()
    course = await db.courses.find_one({"_id": ObjectId(course_id)})
    if not course:
        raise HTTPException(404, "Course not found")
    if course.get("status") != "published":
        raise HTTPException(400, "Cannot enroll in an unpublished course")
    if course.get("owner_uid") == user["firebase_uid"]:
        raise HTTPException(400, "Educators cannot enroll in their own courses")
        
    enrolled = await db.enrollments.find_one({
        "student_uid": user["firebase_uid"], 
        "course_id": ObjectId(course_id)
    })
    if enrolled:
        return {"message": "Already enrolled"}
        
    await db.enrollments.insert_one({
        "student_uid": user["firebase_uid"],
        "course_id": ObjectId(course_id),
        "enrolled_at": datetime.now(timezone.utc)
    })
    return {"message": "Successfully enrolled"}

@router.get("/student/enrollments")
async def list_student_enrollments(user=Depends(get_current_user)):
    db = get_db()
    cursor = db.enrollments.find({"student_uid": user["firebase_uid"]}).sort("enrolled_at", -1)
    enrollments = await cursor.to_list(length=100)
    
    result = []
    for enr in enrollments:
        course = await db.courses.find_one({"_id": enr["course_id"]})
        if course:
            result.append({
                "id": str(course["_id"]),
                "title": course.get("title"),
                "description": course.get("description"),
                "enrolled_at": enr["enrolled_at"]
            })
    return result

@router.get("/lessons/{lesson_id}")
async def get_lesson(lesson_id: str, user=Depends(get_current_user)):
    db = get_db()
    lesson = await db.lessons.find_one({"_id": ObjectId(lesson_id)})
    if not lesson:
        raise HTTPException(404, "Lesson not found")
        
    module = await db.modules.find_one({"_id": lesson["module_id"]})
    if not module:
        raise HTTPException(404, "Module not found")
        
    course_id = str(module["course_id"])
    await require_course_access(course_id, user)
    
    lesson["id"] = str(lesson.pop("_id"))
    lesson["module_id"] = str(lesson["module_id"])
    
    resources_cursor = db.resources.find({"lesson_id": ObjectId(lesson_id), "status": "confirmed"})
    resources = await resources_cursor.to_list(length=100)
    for res in resources:
        res["resource_id"] = str(res.pop("_id"))
        res["lesson_id"] = str(res["lesson_id"])
        if "b2_key" in res:
            del res["b2_key"]
    
    lesson["resources"] = resources
    lesson["course_id"] = course_id
    return lesson

@router.post("/lessons/{lesson_id}/complete")
async def complete_lesson(lesson_id: str, user=Depends(get_current_user)):
    db = get_db()
    
    lesson = await db.lessons.find_one({"_id": ObjectId(lesson_id)})
    if not lesson:
        raise HTTPException(404, "Lesson not found")
        
    module = await db.modules.find_one({"_id": lesson["module_id"]})
    if not module:
        raise HTTPException(404, "Module not found")
        
    await require_course_access(str(module["course_id"]), user)
    
    await db.lesson_progress.update_one(
        {"student_uid": user["firebase_uid"], "lesson_id": ObjectId(lesson_id)},
        {"$setOnInsert": {"completed_at": datetime.now(timezone.utc)}},
        upsert=True
    )
    return {"message": "Lesson marked as complete"}

@router.get("/courses/{course_id}/progress")
async def get_course_progress(course_id: str, user=Depends(get_current_user)):
    db = get_db()
    await require_course_access(course_id, user)
    
    # Get all modules for course
    modules_cursor = db.modules.find({"course_id": ObjectId(course_id)})
    modules = await modules_cursor.to_list(length=100)
    module_ids = [m["_id"] for m in modules]
    
    # Get all lessons for these modules
    lessons_cursor = db.lessons.find({"module_id": {"$in": module_ids}})
    lessons = await lessons_cursor.to_list(length=500)
    lesson_ids = [l["_id"] for l in lessons]
    
    total_lessons = len(lesson_ids)
    if total_lessons == 0:
        return {"progress_percentage": 0, "completed": 0, "total": 0}
        
    # Get completed lessons
    completed_cursor = db.lesson_progress.find({
        "student_uid": user["firebase_uid"],
        "lesson_id": {"$in": lesson_ids}
    })
    completed = await completed_cursor.to_list(length=500)
    
    completed_count = len(completed)
    progress = (completed_count / total_lessons) * 100
    
    return {
        "progress_percentage": round(progress, 2),
        "completed": completed_count,
        "total": total_lessons
    }

@router.get("/resources/{resource_id}/download-url")
async def get_download_url(resource_id: str, user=Depends(get_current_user)):
    db = get_db()
    if db is None:
        raise HTTPException(status_code=500, detail="Database not connected")
        
    course_id = await resolve_course_id_from_resource(resource_id)
    await require_course_access(course_id, user)
    
    resource = await db.resources.find_one({"_id": ObjectId(resource_id), "status": "confirmed"})
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")
        
    key = resource.get("b2_key", "")
    if key.startswith("http://") or key.startswith("https://"):
        return {"download_url": key}
        
    VIDEO_URL_TTL_SECONDS = 6 * 60 * 60  # 6 hours
    DEFAULT_URL_TTL_SECONDS = 3600
    
    ttl = VIDEO_URL_TTL_SECONDS if resource.get("resource_type") == "video" else DEFAULT_URL_TTL_SECONDS
    url = generate_download_url(key, expires_in=ttl)
    return {"download_url": url}

@router.get("/resources/{resource_id}/view-url")
async def get_view_url(resource_id: str, user=Depends(get_current_user)):
    db = get_db()
    if db is None:
        raise HTTPException(status_code=500, detail="Database not connected")
        
    course_id = await resolve_course_id_from_resource(resource_id)
    await require_course_access(course_id, user)
        
    resource = await db.resources.find_one({"_id": ObjectId(resource_id), "status": "confirmed"})
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")
        
    key = resource.get("b2_key", "")
    if key.startswith("http://") or key.startswith("https://"):
        return {"view_url": key}
        
    VIDEO_URL_TTL_SECONDS = 6 * 60 * 60  # 6 hours
    DEFAULT_URL_TTL_SECONDS = 3600
    
    ttl = VIDEO_URL_TTL_SECONDS if resource.get("resource_type") == "video" else DEFAULT_URL_TTL_SECONDS
    url = generate_download_url(key, expires_in=ttl)
    return {"view_url": url}

@router.get("/resources/{resource_id}")
async def get_resource(resource_id: str, user=Depends(get_current_user)):
    db = get_db()
    if db is None:
        raise HTTPException(status_code=500, detail="Database not connected")
        
    course_id = await resolve_course_id_from_resource(resource_id)
    await require_course_access(course_id, user)
        
    resource = await db.resources.find_one({"_id": ObjectId(resource_id), "status": "confirmed"})
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")
        
    resource["resource_id"] = str(resource.pop("_id"))
    if "lesson_id" in resource:
        resource["lesson_id"] = str(resource["lesson_id"])
    if "b2_key" in resource:
        del resource["b2_key"]
        
    return resource

@router.get("/resources")
async def list_resources(
    title: str = None,
    resource_type: str = None,
    user=Depends(require_verified_staff)
):
    db = get_db()
    if db is None:
        raise HTTPException(status_code=500, detail="Database not connected")
        
    query = {"status": "confirmed", "uploaded_by": user["firebase_uid"]}
    if title:
        query["title"] = {"$regex": title, "$options": "i"}
    if resource_type:
        query["resource_type"] = resource_type
        
    cursor = db.resources.find(query).limit(200)
    resources = await cursor.to_list(length=200)
    
    for resource in resources:
        resource["resource_id"] = str(resource.pop("_id"))
        if "lesson_id" in resource:
            resource["lesson_id"] = str(resource["lesson_id"])
        # We should NOT return the b2_key to the client for security, only the filename
        if "b2_key" in resource:
            del resource["b2_key"]
            
    return resources
