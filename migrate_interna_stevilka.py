import sqlite3
import os

DB_NAME = "racunovodstvo.db"

def migrate():
    if not os.path.exists(DB_NAME):
        print(f"Baza {DB_NAME} ne obstaja.")
        return

    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # Preveri če stolpec obstaja
    try:
        cursor.execute("ALTER TABLE dokumenti ADD COLUMN interna_stevilka TEXT")
        print("Dodan stolpec interna_stevilka.")
    except sqlite3.OperationalError:
        print("Stolpec interna_stevilka že obstaja.")

    # Pridobi vse prejete račune, urejene po datumu izdaje in ID-ju
    cursor.execute("""
        SELECT id, poslovno_leto, tip, stevilka, datum_izdaje 
        FROM dokumenti 
        ORDER BY poslovno_leto ASC, datum_izdaje ASC, id ASC
    """)
    rows = cursor.fetchall()

    year_counters = {}

    for row in rows:
        tip = row['tip']
        leto = row['poslovno_leto']
        
        if tip == 'prejeti_racuni':
            if leto not in year_counters:
                year_counters[leto] = 0
            
            year_counters[leto] += 1
            num = year_counters[leto]
            interna_st = f"{num:03d}-{leto}"
            
            cursor.execute("UPDATE dokumenti SET interna_stevilka = ? WHERE id = ?", (interna_st, row['id']))
            print(f"Dokument {row['id']} ({row['stevilka']}) -> {interna_st}")
        else:
            # Za ostale dokumente naj bo interna_stevilka enaka številki, če je prazna
            cursor.execute("UPDATE dokumenti SET interna_stevilka = stevilka WHERE id = ? AND (interna_stevilka IS NULL OR interna_stevilka = '')", (row['id'],))

    conn.commit()
    conn.close()
    print("Migracija zaključena.")

if __name__ == "__main__":
    migrate()
