"""Grant the admin role to an existing (already signed-up) user. The only way to create an admin.
Usage: python promote_admin.py someone@institution.edu
"""
import asyncio
import sys

from database import connect_to_mongo, close_mongo_connection, get_db


async def promote(email: str):
    await connect_to_mongo()
    res = await get_db().users.update_many({"email": email}, {"$set": {"role": "admin"}})
    print(f"Updated {res.modified_count} user(s) to 'admin' role." if res.matched_count else f"No user with email {email}. Sign up first.")
    await close_mongo_connection()


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("Usage: python promote_admin.py <email>")
    asyncio.run(promote(sys.argv[1].strip().lower()))
