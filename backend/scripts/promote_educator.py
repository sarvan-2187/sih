import asyncio
from database import connect_to_mongo, get_db

async def promote():
    await connect_to_mongo()
    db = get_db()
    if db is None:
        print("Database not connected")
        return
    
    # Update role to educator for target email
    res = await db.users.update_many(
        {"email": "ch.sc.u4cse24142@ch.students.amrita.edu"},
        {"$set": {"role": "educator"}}
    )
    print(f"Updated {res.modified_count} user(s) to 'educator' role.")

if __name__ == '__main__':
    asyncio.run(promote())
