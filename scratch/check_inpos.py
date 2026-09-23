import sqlite3, json

conn = sqlite3.connect('racunovodstvo.db')
c = conn.cursor()

# Check Llama settings
c.execute("SELECT * FROM llama_settings LIMIT 5")
cols = [d[0] for d in c.description]
rows = c.fetchall()
print("=== llama_settings ===")
for r in rows:
    print(dict(zip(cols, r)))

# Check if there are supplier-specific rules for INPOS
c.execute("SELECT * FROM llama_supplier_rules WHERE naziv LIKE '%INPOS%' OR naziv LIKE '%inpos%'")
cols = [d[0] for d in c.description]
rows = c.fetchall()
print("\n=== llama_supplier_rules for INPOS ===")
for r in rows:
    print(dict(zip(cols, r)))

# Check if there are learning examples for INPOS
c.execute("SELECT filename, substr(ocr_text, 1, 200), substr(corrected_json, 1, 300) FROM llama_learning_examples WHERE filename LIKE '%inpos%' OR filename LIKE '%INPOS%' OR ocr_text LIKE '%INPOS%' LIMIT 3")
cols = [d[0] for d in c.description]
rows = c.fetchall()
print("\n=== llama_learning_examples for INPOS ===")
for r in rows:
    print(r)

conn.close()
