import sqlite3

def check():
    conn = sqlite3.connect("racunovodstvo.db")
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    print("Checking ajpes_shema...")
    cursor.execute("SELECT count(*) as c FROM ajpes_shema")
    print(f"Count: {cursor.fetchone()['c']}")
    
    cursor.execute("SELECT * FROM ajpes_shema LIMIT 5")
    for row in cursor.fetchall():
        print(dict(row))
        
    conn.close()

if __name__ == "__main__":
    check()
