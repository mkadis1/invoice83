import sqlite3

conn = sqlite3.connect('racunovodstvo.db')
c = conn.cursor()

# Show current bad rules
c.execute("SELECT id, naziv, updated_at, substr(extraction_rules, 1, 100) FROM llama_supplier_rules WHERE naziv LIKE '%INPOS%'")
for r in c.fetchall():
    print(f"ID={r[0]}, naziv={r[1]}, updated={r[2]}")
    print(f"Rules preview: {r[3]}")
    print()

# Delete the bad INPOS rules (they have hardcoded stevilka "43-9038-4528")
c.execute("DELETE FROM llama_supplier_rules WHERE naziv LIKE '%INPOS%'")
print(f"Deleted {c.rowcount} INPOS supplier rules")

conn.commit()
conn.close()
print("Done.")
