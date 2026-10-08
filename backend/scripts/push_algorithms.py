import json
from pymongo import MongoClient
import os
from dotenv import load_dotenv

load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI")
if not MONGODB_URI:
    raise ValueError("MONGODB_URI environment variable is not set")

def main():
    with open(os.path.join(os.path.dirname(__file__), 'parsed_algorithms.json'), 'r', encoding='utf-8') as f:
        data = json.load(f)
        
    print("Updating MongoDB...")
    client = MongoClient(MONGODB_URI)
    db = client.qrious_db
    collection = db.algorithm_catalog
    
    updated = 0
    for alg in data:
        if alg.get('status') == 'locked':
            continue
        # We update the algorithm content for unlocked algorithms
        collection.update_one({'id': alg['id']}, {'$set': {'content': alg['content']}})
        updated += 1
        
    print(f"Update complete. Pushed {updated} algorithms.")

if __name__ == '__main__':
    main()
