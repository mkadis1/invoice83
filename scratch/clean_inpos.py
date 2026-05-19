import os
import glob
import sqlite3

def main():
    # 1. Delete JSON files
    results_dir = "scratch/results"
    json_pattern = os.path.join(results_dir, "*inpos*.json")
    json_pattern_caps = os.path.join(results_dir, "*INPOS*.json")
    
    json_files = glob.glob(json_pattern) + glob.glob(json_pattern_caps)
    json_files = list(set(json_files))
    
    print(f"Deleting {len(json_files)} INPOS JSON files from scratch/results/:")
    for f in json_files:
        try:
            os.remove(f)
            print(f"  Deleted JSON: {f}")
        except Exception as e:
            print(f"  Error deleting JSON {f}: {e}")
            
    # 2. Delete documents from database
    conn = sqlite3.connect("racunovodstvo.db")
    cursor = conn.cursor()
    
    # Dynamically find all document IDs for partner 37 (INPOS, d.o.o.)
    cursor.execute("SELECT id FROM dokumenti WHERE partner_id = 37")
    doc_ids = [r[0] for r in cursor.fetchall()]
    
    print(f"\nDeleting document entries for IDs {doc_ids} from database:")
    for doc_id in doc_ids:
        # Get uploaded files to delete
        cursor.execute("SELECT filename FROM priloge WHERE parent_type = 'dokumenti' AND parent_id = ?", (doc_id,))
        for (fn,) in cursor.fetchall():
            path = os.path.join("uploads", fn)
            if os.path.exists(path):
                try:
                    os.remove(path)
                    print(f"  Deleted attachment file: {path}")
                except Exception as e:
                    print(f"  Error deleting attachment file {path}: {e}")
                    
        # Delete from db tables
        cursor.execute("DELETE FROM priloge WHERE parent_type = 'dokumenti' AND parent_id = ?", (doc_id,))
        cursor.execute("DELETE FROM dokumenti_postavke WHERE dokument_id = ?", (doc_id,))
        cursor.execute("DELETE FROM dokumenti WHERE id = ?", (doc_id,))
        print(f"  Deleted document ID {doc_id} from database.")
        
    conn.commit()
    conn.close()
    print("\nINPOS cleanup successfully finished!")

if __name__ == "__main__":
    main()
