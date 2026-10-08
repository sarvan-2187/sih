import asyncio
from database import connect_to_mongo, get_db

async def unlock_all():
    await connect_to_mongo()
    db = get_db()
    result = await db.algorithm_catalog.update_many(
        {},
        {"$set": {"status": "unlocked"}}
    )
    print(f"Unlocked {result.modified_count} algorithms.")

if __name__ == "__main__":
    asyncio.run(unlock_all())
