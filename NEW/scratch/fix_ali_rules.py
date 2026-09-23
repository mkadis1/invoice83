import sqlite3

conn = sqlite3.connect('racunovodstvo.db')
c = conn.cursor()

# Show the full Aliexpress rule
c.execute("SELECT id, naziv, extraction_rules FROM llama_supplier_rules WHERE id=58")
r = c.fetchone()
if r:
    print(f"=== Aliexpress rule (ID={r[0]}) ===")
    print(r[2])
    print()

# Delete the bad Aliexpress rule (it has hardcoded order number)
c.execute("DELETE FROM llama_supplier_rules WHERE id=58")
print(f"Deleted Aliexpress rule (ID=58)")

# Also delete the whole llama_supplier_rules for Aliexpress just in case
c.execute("DELETE FROM llama_supplier_rules WHERE naziv LIKE '%liexpress%' OR davcna_stevilka LIKE '%NL826%'")
print(f"Deleted {c.rowcount} additional Aliexpress rules")

conn.commit()
conn.close()
print("Done.")
