import sqlite3

def check():
    conn = sqlite3.connect("racunovodstvo.db")
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    print("Unique accounts used in temeljnice_postavke:")
    cursor.execute("SELECT DISTINCT konto FROM temeljnice_postavke")
    accounts = [row['konto'] for row in cursor.fetchall()]
    print(", ".join(accounts))
        
    conn.close()

if __name__ == "__main__":
    check()
