import sqlite3, json, sys
sys.stdout.reconfigure(encoding='utf-8')

conn = sqlite3.connect('racunovodstvo.db')
c = conn.cursor()
c.execute("SELECT id, filename, corrected_json FROM llama_learning_examples WHERE filename LIKE '%OrderSummary%' OR ocr_text LIKE '%aliexpress%' OR corrected_json LIKE '%aliexpress%'")
for row in c.fetchall():
    print(f"ID: {row[0]}, FILE: {row[1]}")
    data = json.loads(row[2])
    print("  Totals:", "skupaj:", data.get("znesek_skupaj"), "ddv:", data.get("znesek_ddv"), "brez:", data.get("znesek_brez_ddv"))
    print("  Postavke:")
    for p in data.get("postavke", []):
        print("   -", p.get("opis"), "| kol:", p.get("kolicina"), "| cena:", p.get("cena_enote"), "| ddv:", p.get("stopnja_ddv"), "| popust:", p.get("popust"), "| sk:", p.get("znesek_skupaj"))
    print()
