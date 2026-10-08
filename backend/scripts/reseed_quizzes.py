import asyncio
import os
import certifi
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.quiz_seed import seed_quiz_questions

load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI")

async def main():
    print("Reseeding MongoDB quiz questions...")
    kwargs = {"serverSelectionTimeoutMS": 15000}
    if "+srv" in MONGODB_URI:
        kwargs["tlsCAFile"] = certifi.where()
        
    client = AsyncIOMotorClient(MONGODB_URI, **kwargs)
    db = client.get_database("qrious-db")
    
    await seed_quiz_questions(db)
    client.close()

if __name__ == "__main__":
    asyncio.run(main())
