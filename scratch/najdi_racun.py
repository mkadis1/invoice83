import sqlite3
import os
import sys

# Nastavimo kodiranje na utf-8, da se izognemo UnicodeEncodeError
sys.stdout.reconfigure(encoding='utf-8')

dbs = ["racunovodstvo.db", "comp_43a4d859.db"]

for db_name in dbs:
    if not os.path.exists(db_name):
        print(f"{db_name} ne obstaja")
        continue
    print(f"=== Iscem v {db_name} ===")
    conn = sqlite3.connect(db_name)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # Preverimo v tabeli dokumenti
    try:
        # Iscemo s stevilko, neobcutljivo na velikost crk
        cursor.execute("SELECT id, tip, stevilka, partner_id, znesek_skupaj, status FROM dokumenti WHERE stevilka LIKE ?", ("%HCY-20866449%",))
        rows = cursor.fetchall()
        if not rows:
            print("  Racuna s to stevilko ni v tabeli dokumenti.")
        for row in rows:
            print(f"  Najden dokument ID: {row['id']}, Tip: {row['tip']}, St: {row['stevilka']}, Partner ID: {row['partner_id']}, Skupaj: {row['znesek_skupaj']}, Status: {row['status']}")
            
            # Preverimo partnerja
            cursor.execute("SELECT naziv FROM partnerji WHERE id = ?", (row['partner_id'],))
            p_row = cursor.fetchone()
            partner_naziv = p_row['naziv'] if p_row else "Neznan"
            print(f"    Partner: {partner_naziv}")
            
            # Preverimo ali je ze povezan (likvidiran) v placila_povezave
            cursor.execute("SELECT * FROM placila_povezave WHERE dokument_id = ?", (row['id'],))
            connections = cursor.fetchall()
            if connections:
                print("    Ze zabelezene povezave:")
                for conn_row in connections:
                    print(f"      Povezava ID: {conn_row['id']}, Izpisek postavka ID: {conn_row['izpisek_postavka_id']}, Znesek: {conn_row['znesek']}")
            else:
                print("    Nima povezav (likvidacije).")
                
    except Exception as e:
        print(f"  Napaka pri branju: {e}")
        
    conn.close()
