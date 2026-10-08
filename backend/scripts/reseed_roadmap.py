import asyncio
from database import connect_to_mongo, get_db
from services.roadmap_seed import seed_roadmap

async def run():
    print("Connecting to MongoDB...")
    await connect_to_mongo()
    db = get_db()
    if db is None:
        print("Error: Could not connect to database")
        return
    
    print("Reseeding Quantum Roadmap topics across all domains...")
    inserted_count = await seed_roadmap(db)
    print(f"Successfully seeded {inserted_count} total roadmap topics into MongoDB!")

    # Report breakdown per domain
    domains = await db.roadmap_topics.distinct("domain")
    print("\n--- Seeded Domain Material Breakdown ---")
    for d in domains:
        count = await db.roadmap_topics.count_documents({"domain": d})
        print(f"Domain '{d}': {count} topics with slide deck PDF, video reference, and cheatsheet materials.")

if __name__ == "__main__":
    asyncio.run(run())
