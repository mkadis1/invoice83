import sqlite3

def get_db():
    conn = sqlite3.connect("racunovodstvo.db")
    conn.row_factory = sqlite3.Row
    return conn

def safe_print(msg):
    try:
        print(msg)
    except UnicodeEncodeError:
        print(msg.encode('ascii', 'replace').decode('ascii'))

def main():
    conn = get_db()
    cursor = conn.cursor()
    
    # 1. Fetch all received invoices
    # We order them by datum_izdaje ASC, then id ASC
    cursor.execute(
        "SELECT id, poslovno_leto, datum_izdaje, stevilka, interna_stevilka, "
        "(SELECT naziv FROM partnerji WHERE id = partner_id) as partner_name "
        "FROM dokumenti "
        "WHERE tip = 'prejeti_racuni' "
        "ORDER BY datum_izdaje ASC, id ASC"
    )
    invoices = cursor.fetchall()
    
    if not invoices:
        safe_print("No received invoices found in database!")
        conn.close()
        return
        
    safe_print(f"Found {len(invoices)} received invoices. Re-indexing all of them by issue date...")
    
    # We group and sequence by business year
    yearly_sequences = {}
    updates = []
    
    for inv in invoices:
        inv_id = inv["id"]
        old_interna = inv["interna_stevilka"]
        datum = inv["datum_izdaje"]
        partner = inv["partner_name"] or "Neznan"
        
        # Extract year
        year = inv["poslovno_leto"]
        if datum:
            try:
                parts = datum.split("-")
                # Check if it's YYYY-MM-DD or DD-MM-YYYY
                if len(parts[0]) == 4:
                    parsed_year = int(parts[0])
                else:
                    parsed_year = int(parts[-1])
                
                if 1900 <= parsed_year <= 2100:
                    year = parsed_year
            except:
                pass
                
        # Get or start sequence for this year
        if year not in yearly_sequences:
            yearly_sequences[year] = 1
        
        seq = yearly_sequences[year]
        yearly_sequences[year] += 1
        
        # Format as 001-2026
        new_interna = f"{seq:03d}-{year}"
        
        updates.append((new_interna, inv_id, old_interna, datum, partner))
        
    # Execute updates
    for new_interna, inv_id, old_interna, datum, partner in updates:
        cursor.execute(
            "UPDATE dokumenti SET interna_stevilka = ? WHERE id = ?",
            (new_interna, inv_id)
        )
        safe_print(f"Updated: {partner} ({datum}) | Old: {old_interna} -> New: {new_interna}")
        
    conn.commit()
    conn.close()
    
    safe_print("\nAll received invoices successfully re-indexed!")

if __name__ == "__main__":
    main()
