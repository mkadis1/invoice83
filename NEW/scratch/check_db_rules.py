import sqlite3, sys
sys.stdout.reconfigure(encoding='utf-8')

conn = sqlite3.connect('racunovodstvo.db')
c = conn.cursor()
c.execute("SELECT davcna_stevilka, naziv, extraction_rules FROM llama_supplier_rules WHERE davcna_stevilka LIKE '%8264%' OR UPPER(naziv) LIKE '%ALI%'")
rows = c.fetchall()
print('Number of matches:', len(rows))
for row in rows:
    print('KEY:', row[0], 'NAME:', row[1])
    print('RULES:\n', row[2])
    print('='*50)
