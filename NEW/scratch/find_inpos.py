import sqlite3

def main():
    conn = sqlite3.connect("racunovodstvo.db")
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute(
        "SELECT d.id, d.stevilka, d.interna_stevilka, p.naziv "
        "FROM dokumenti d "
        "JOIN partnerji p ON d.partner_id = p.id "
        "WHERE LOWER(p.naziv) LIKE '%inpos%'"
    )
    
    rows = cursor.fetchall()
    print(f"Found {len(rows)} Inpos invoices:")
    for r in rows:
        print(f"ID={r['id']} | Interna={r['interna_stevilka']} | Stevilka={r['stevilka']} | Partner={r['naziv']}")
        
    conn.close()

if __name__ == "__main__":
    main()
