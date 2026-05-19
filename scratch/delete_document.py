import sys
import sqlite3

def get_db():
    conn = sqlite3.connect("racunovodstvo.db")
    conn.row_factory = sqlite3.Row
    return conn

def main():
    if len(sys.argv) < 2:
        print("Usage: python delete_document.py <interna_stevilka>")
        return
        
    interna = sys.argv[1]
    
    conn = get_db()
    cursor = conn.cursor()
    
    # Find document
    cursor.execute("SELECT id, tip, stevilka FROM dokumenti WHERE interna_stevilka = ?", (interna,))
    row = cursor.fetchone()
    if not row:
        print(f"Document with internal number '{interna}' not found!")
        conn.close()
        return
        
    doc_id = row["id"]
    tip = row["tip"]
    stevilka = row["stevilka"]
    
    print(f"Found document: ID={doc_id}, Tip={tip}, Stevilka={stevilka}, Interna={interna}")
    
    # 1. Delete priloge
    cursor.execute("SELECT filename FROM priloge WHERE parent_type = 'dokumenti' AND parent_id = ?", (doc_id,))
    priloge = cursor.fetchall()
    for p in priloge:
        fn = p["filename"]
        # Delete file if exists
        path = os.path.join("uploads", fn)
        if os.path.exists(path):
            try:
                os.remove(path)
                print(f"Deleted attachment file: {path}")
            except Exception as e:
                print(f"Error deleting file {path}: {e}")
                
    cursor.execute("DELETE FROM priloge WHERE parent_type = 'dokumenti' AND parent_id = ?", (doc_id,))
    print(f"Deleted database attachments for document ID {doc_id}")
    
    # 2. Delete postavk
    cursor.execute("DELETE FROM dokumenti_postavke WHERE dokument_id = ?", (doc_id,))
    print(f"Deleted database items for document ID {doc_id}")
    
    # 3. Delete document
    cursor.execute("DELETE FROM dokumenti WHERE id = ?", (doc_id,))
    print(f"Deleted document ID {doc_id} from database")
    
    conn.commit()
    conn.close()
    
    print(f"Successfully deleted document '{interna}' from database!")

if __name__ == "__main__":
    import os
    main()
