import sqlite3
import sys
import io
import json

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

conn = sqlite3.connect('racunovodstvo.db')
c = conn.cursor()

# Poglejmo kateri Telemach primeri so shranjeni za ucenje
print("=== LLAMA LEARNING EXAMPLES - TELEMACH POSTAVKE ===")
c.execute("SELECT id, filename, corrected_json FROM llama_learning_examples WHERE filename LIKE '%telemach%' OR filename LIKE '%Telemach%'")
examples = c.fetchall()
for ex in examples:
    print(f"\nID: {ex[0]}, filename: {ex[1]}")
    try:
        data = json.loads(ex[2])
        for p in data.get('postavke', []):
            print(f"  opis: {p.get('opis', '')[:50]}, popust: {p.get('popust')}, stopnja_ddv: {p.get('stopnja_ddv')}, cena: {p.get('cena_enote')}")
    except Exception as e:
        print(f"  ERROR: {e}")
        print(f"  raw: {ex[2][:200]}")

conn.close()
