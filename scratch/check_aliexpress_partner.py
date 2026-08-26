import sqlite3, json, sys
sys.stdout.reconfigure(encoding='utf-8')

conn = sqlite3.connect('racunovodstvo.db')
c = conn.cursor()
c.execute("SELECT * FROM partnerji WHERE UPPER(naziv) LIKE '%ALIEXPRESS%' OR UPPER(naziv) LIKE '%ALIBABA%' OR davcna_stevilka LIKE '%8264%'")
cols = [desc[0] for desc in c.description]
for row in c.fetchall():
    print(dict(zip(cols, row)))
