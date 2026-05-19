import sqlite3
import os

def main():
    conn = sqlite3.connect("racunovodstvo.db")
    cursor = conn.cursor()
    
    ids_to_delete = [79, 258]
    
    for doc_id in ids_to_delete:
        print(f"Deleting document ID: {doc_id}")
        
        # Delete priloge
        cursor.execute("SELECT filename FROM priloge WHERE parent_type = 'dokumenti' AND parent_id = ?", (doc_id,))
        priloge = cursor.fetchall()
        for p in priloge:
            fn = p[0]
            path = os.path.join("uploads", fn)
            if os.path.exists(path):
                try:
                    os.remove(path)
                    print(f"Deleted file: {path}")
                except Exception as e:
                    print(f"Error deleting file {path}: {e}")
                    
        cursor.execute("DELETE FROM priloge WHERE parent_type = 'dokumenti' AND parent_id = ?", (doc_id,))
        cursor.execute("DELETE FROM dokumenti_postavke WHERE dokument_id = ?", (doc_id,))
        cursor.execute("DELETE FROM dokumenti WHERE id = ?", (doc_id,))
        
    conn.commit()
    conn.close()
    print("Successfully cleaned up duplicates from the database!")

if __name__ == "__main__":
    main()
