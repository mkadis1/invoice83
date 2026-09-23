import sqlite3

conn = sqlite3.connect('racunovodstvo.db')
c = conn.cursor()

c.execute("SELECT id, naziv, davcna_stevilka, updated_at, length(extraction_rules), substr(extraction_rules, 1, 200) FROM llama_supplier_rules ORDER BY updated_at DESC")
rows = c.fetchall()
print(f"Total supplier rules: {len(rows)}\n")
for r in rows:
    print(f"ID={r[0]}, naziv={r[1]}, davcna={r[2]}, updated={r[3]}, rules_len={r[4]}")
    print(f"  Preview: {r[5][:150]}")
    print()

conn.close()
