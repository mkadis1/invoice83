import sqlite3

def main():
    conn = sqlite3.connect("racunovodstvo.db")
    cursor = conn.cursor()
    
    # Correct JKP Ravne partner name
    cursor.execute(
        "UPDATE partnerji SET naziv = 'JKP Ravne na Koroškem, d.o.o.' WHERE davcna_stevilka = 'SI20356846'"
    )
    print(f"Updated rows in partnerji: {cursor.rowcount}")
    
    conn.commit()
    conn.close()
    print("Database updated!")

if __name__ == "__main__":
    main()
