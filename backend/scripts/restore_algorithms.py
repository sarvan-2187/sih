import json
import os
import asyncio
from database import connect_to_mongo, get_db

async def run():
    await connect_to_mongo()
    db = get_db()
    with open(os.path.join(os.path.dirname(__file__), 'parsed_algorithms.json'), 'r', encoding='utf-8') as f:
        data = json.load(f)
        
    print("Restoring MongoDB content from parsed_algorithms.json...")
    updated = 0
    for alg in data:
        # Restore content but keep it unlocked and keep example_circuit if it exists?
        # Actually, let's just overwrite 'content' to undo the bad regex
        await db.algorithm_catalog.update_one(
            {'id': alg['id']}, 
            {'$set': {'content': alg['content']}}
        )
        updated += 1
        
    print(f"Update complete. Restored {updated} algorithms.")

if __name__ == '__main__':
    asyncio.run(run())
