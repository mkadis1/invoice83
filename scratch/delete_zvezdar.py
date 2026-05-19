import sqlite3
import os

def main():
    conn = sqlite3.connect('racunovodstvo.db')
    cursor = conn.cursor()

    cursor.execute("SELECT filename FROM priloge WHERE parent_type = 'dokumenti' AND parent_id = 287")
    row = cursor.fetchone()
    if row:
        att_path = os.path.join("uploads", row[0])
        if os.path.exists(att_path):
            os.remove(att_path)
            print(f"Deleted attachment file: {att_path}")

    cursor.execute("DELETE FROM priloge WHERE parent_type = 'dokumenti' AND parent_id = 287")
    cursor.execute("DELETE FROM dokumenti_postavke WHERE dokument_id = 287")
    cursor.execute("DELETE FROM dokumenti WHERE id = 287")
    conn.commit()
    conn.close()

    json_path = "scratch/results/Zvezdar 142.json"
    if os.path.exists(json_path):
        os.remove(json_path)
        print(f"Deleted json file: {json_path}")

if __name__ == "__main__":
    main()
