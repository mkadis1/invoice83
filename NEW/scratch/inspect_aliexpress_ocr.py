import sqlite3, json, sys
sys.stdout.reconfigure(encoding='utf-8')

conn = sqlite3.connect('racunovodstvo.db')
c = conn.cursor()
c.execute("SELECT id, filename, ocr_text, corrected_json FROM llama_learning_examples WHERE filename LIKE '%OrderSummary%' OR ocr_text LIKE '%aliexpress%' ORDER BY id DESC LIMIT 3")
rows = c.fetchall()
for row in rows:
    print(f"=== ID: {row[0]}, FILENAME: {row[1]} ===")
    print("--- OCR TEXT ---")
    print(row[2])
    print("--- CORRECTED JSON ---")
    print(row[3])
    print("\n" + "="*60 + "\n")
