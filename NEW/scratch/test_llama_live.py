import sqlite3
import sys
import io
import json
import os
import sys

sys.path.insert(0, '.')
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

conn = sqlite3.connect('racunovodstvo.db')
c = conn.cursor()

# Vzamemo OCR tekst iz učnega primera 37
c.execute("SELECT ocr_text, corrected_json, filename FROM llama_learning_examples WHERE id = 37")
row = c.fetchone()
ocr_text, corrected_json, filename = row
conn.close()

print(f"Filename: {filename}")
print(f"\nOCR tekst (prvih 1000 znakov):")
print(ocr_text[:1000])
print("\n--- Kličemo Llama ---")

from invoice_ocr import parse_with_llama
result = parse_with_llama(ocr_text, filename, "llama3")
print("\nLlama rezultat:")
print(json.dumps(result, indent=2, ensure_ascii=False)[:2000])

print("\nPostavke:")
for p in result.get('postavke', []):
    print(f"  opis: {p.get('opis', '')[:50]}, popust: {p.get('popust')}, stopnja_ddv: {p.get('stopnja_ddv')}, cena: {p.get('cena_enote')}")
