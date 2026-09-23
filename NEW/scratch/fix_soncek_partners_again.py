import sqlite3

def main():
    conn = sqlite3.connect('racunovodstvo.db')
    cursor = conn.cursor()
    
    # 1. Update documents to point to master partner ID 56 (SONČEK d.o.o.)
    cursor.execute("""
        UPDATE dokumenti 
        SET partner_id = 56 
        WHERE partner_id IN (
            SELECT id FROM partnerji 
            WHERE id != 56 
            AND (naziv LIKE '%son%cek%' OR naziv LIKE '%son%ček%')
        )
    """)
    updated_count = cursor.rowcount
    print(f"Updated {updated_count} documents to point to partner ID 56.")
    
    # 2. Delete duplicate Soncek partners
    cursor.execute("""
        DELETE FROM partnerji 
        WHERE id != 56 
        AND (naziv LIKE '%son%cek%' OR naziv LIKE '%son%ček%')
    """)
    deleted_count = cursor.rowcount
    print(f"Deleted {deleted_count} duplicate Soncek partners from database.")
    
    conn.commit()
    conn.close()

if __name__ == "__main__":
    main()
