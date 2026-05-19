import sqlite3

def main():
    conn = sqlite3.connect("racunovodstvo.db")
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # 1. Update the primary partner (ID 56) to clean SONČEK d.o.o. and ensure the tax ID is SI24011100
    cursor.execute(
        "UPDATE partnerji SET naziv = ?, davcna_stevilka = ? WHERE id = ?",
        ("SONČEK d.o.o.", "SI24011100", 56)
    )
    print("Updated partner 56.")
    
    # 2. Redirect all documents from IDs 86, 87 to ID 56
    target_partner_ids = [86, 87]
    cursor.execute(
        f"UPDATE dokumenti SET partner_id = 56 WHERE partner_id IN ({','.join(map(str, target_partner_ids))})"
    )
    affected_docs = cursor.rowcount
    print(f"Redirected {affected_docs} documents from partner IDs {target_partner_ids} to primary partner ID 56.")
    
    # 3. Delete secondary partners from the database
    cursor.execute(
        f"DELETE FROM partnerji WHERE id IN ({','.join(map(str, target_partner_ids))})"
    )
    deleted_partners = cursor.rowcount
    print(f"Deleted secondary partners with IDs {target_partner_ids} (total: {deleted_partners}).")
    
    conn.commit()
    conn.close()
    print("\nSONCEK partner consolidation successfully completed!")

if __name__ == "__main__":
    main()
