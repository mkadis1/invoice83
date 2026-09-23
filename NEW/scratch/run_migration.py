import sys
import os
sys.path.append(os.getcwd())

import database
import json

def migrate():
    if os.path.exists("companies.json"):
        with open("companies.json", "r", encoding="utf-8") as f:
            registry = json.load(f)
            active_id = registry.get("active_id", "default")
            active_company = next((c for c in registry["items"] if c["id"] == active_id), registry["items"][0])
            database.set_active_db(active_company["db"])
    
    database.init_db()
    print("Migracija uspesno izvedena.")

if __name__ == "__main__":
    migrate()
