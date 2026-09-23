import sqlite3

def main():
    conn = sqlite3.connect("racunovodstvo.db")
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # 1. Update the primary partner (ID 37)
    cursor.execute(
        "UPDATE partnerji SET naziv = ?, davcna_stevilka = ? WHERE id = ?",
        ("INPOS, d.o.o.", "SI70868565", 37)
    )
    print("Updated partner 37 to 'INPOS, d.o.o.' with SI70868565.")
    
    # 2. Redirect all documents from IDs 63, 79, 80 to ID 37
    target_partner_ids = [63, 79, 80]
    cursor.execute(
        f"UPDATE dokumenti SET partner_id = 37 WHERE partner_id IN ({','.join(map(str, target_partner_ids))})"
    )
    affected_docs = cursor.rowcount
    print(f"Redirected {affected_docs} documents from partner IDs {target_partner_ids} to primary partner ID 37.")
    
    # 3. Delete secondary partners from the database
    cursor.execute(
        f"DELETE FROM partnerji WHERE id IN ({','.join(map(str, target_partner_ids))})"
    )
    deleted_partners = cursor.rowcount
    print(f"Deleted secondary partners with IDs {target_partner_ids} (total: {deleted_partners}).")
    
    conn.commit()
    conn.close()
    print("\nINPOS partner consolidation successfully completed!")

if __name__ == "__main__":
    main()
