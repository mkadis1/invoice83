import sqlite3

def check():
    conn = sqlite3.connect("racunovodstvo.db")
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    print("Checking kontni_nacrt...")
    cursor.execute("SELECT * FROM kontni_nacrt")
    for row in cursor.fetchall():
        print(dict(row))
        
    print("\nChecking temeljnice_postavke (unique accounts)...")
    cursor.execute("SELECT DISTINCT konto FROM temeljnice_postavke")
    for row in cursor.fetchall():
        print(row['konto'])
        
    conn.close()

if __name__ == "__main__":
    check()
