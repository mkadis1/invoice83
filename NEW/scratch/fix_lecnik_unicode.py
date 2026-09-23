import os
import sqlite3
import subprocess

def main():
    # 1. Locate and delete Lecnik (with c/c-tilde, ord=269) file in results
    results_dir = "scratch/results"
    deleted_file = False
    for filename in os.listdir(results_dir):
        if "Le" in filename and "145" in filename:
            # check if it contains ord 269 (c-caron)
            if chr(269) in filename:
                path = os.path.join(results_dir, filename)
                os.remove(path)
                safe_path = path.replace(chr(269), 'c').replace(chr(353), 's')
                print(f"Deleted wrong filename from disk: {safe_path}")
                deleted_file = True
                
    # 2. Delete any document with number '2026-00145' from database
    conn = sqlite3.connect("racunovodstvo.db")
    cursor = conn.cursor()
    
    cursor.execute("SELECT id FROM dokumenti WHERE stevilka = '2026-00145'")
    docs = cursor.fetchall()
    for (doc_id,) in docs:
        print(f"Deleting document ID: {doc_id} from database")
        cursor.execute("DELETE FROM priloge WHERE parent_type = 'dokumenti' AND parent_id = ?", (doc_id,))
        cursor.execute("DELETE FROM dokumenti_postavke WHERE dokument_id = ?", (doc_id,))
        cursor.execute("DELETE FROM dokumenti WHERE id = ?", (doc_id,))
        
    conn.commit()
    conn.close()
    
    # 3. Re-run import, reorder, and fix attachments
    print("Running import, reordering, and fix attachments...")
    subprocess.run(["venv\\Scripts\\python.exe", "scratch\\import_llama_results.py"], check=True)
    subprocess.run(["venv\\Scripts\\python.exe", "scratch\\reorder_interna_stevilka.py"], check=True)
    subprocess.run(["venv\\Scripts\\python.exe", "scratch\\fix_attachments.py"], check=True)
    print("Done!")

if __name__ == "__main__":
    main()
