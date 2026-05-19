import os
import json
import glob
import sqlite3

def get_db():
    conn = sqlite3.connect("racunovodstvo.db")
    conn.row_factory = sqlite3.Row
    return conn

def safe_print(msg):
    try:
        print(msg)
    except UnicodeEncodeError:
        print(msg.encode('ascii', 'replace').decode('ascii'))

def main():
    results_dir = "scratch/results"
    json_files = glob.glob(os.path.join(results_dir, "*.json"))
    
    if not json_files:
        safe_print("No JSON files found in scratch/results/ to import!")
        return
        
    conn = get_db()
    cursor = conn.cursor()
    
    imported_count = 0
    skipped_count = 0
    
    for filepath in json_files:
        filename = os.path.basename(filepath)
        with open(filepath, "r", encoding="utf-8") as f:
            try:
                data = json.load(f)
            except Exception as e:
                safe_print(f"Error loading {filename}: {e}")
                continue
                
        # 1. Partner
        partner_data = data.get("partner", {})
        naziv = partner_data.get("naziv", "Neznan Partner").strip()
        davcna = partner_data.get("davcna_stevilka", "").strip()
        
        # Fallbacks for specific known partners
        if not davcna:
            if "ajpes" in naziv.lower():
                davcna = "SI53655189"
            elif "telemach" in naziv.lower():
                davcna = "SI66863627"
            elif "a1" in naziv.lower():
                davcna = "SI60595256"
            elif "gls" in naziv.lower() or "general logistics" in naziv.lower():
                davcna = "SI74531891"
            elif "ebull" in naziv.lower():
                davcna = "SI50788641"
            elif "petrol" in naziv.lower():
                davcna = "SI80267432"
            elif "conrad" in naziv.lower():
                davcna = "SI81152396"
            elif "bauhaus" in naziv.lower():
                davcna = "SI86657593"
            elif "inpos" in naziv.lower():
                davcna = "SI24300305"
            elif "mimovrste" in naziv.lower():
                davcna = "SI22421376"
                
        # Standardise davcna to include SI prefix if it's 8 digits
        if len(davcna) == 8 and davcna.isdigit():
            davcna = "SI" + davcna
            
        partner_id = None
        if davcna:
            # Check by tax ID
            cursor.execute("SELECT id FROM partnerji WHERE davcna_stevilka = ?", (davcna,))
            row = cursor.fetchone()
            if row:
                partner_id = row["id"]
                
        if not partner_id:
            # Check by name
            cursor.execute("SELECT id FROM partnerji WHERE LOWER(naziv) = ?", (naziv.lower(),))
            row = cursor.fetchone()
            if row:
                partner_id = row["id"]
            else:
                # Create partner
                cursor.execute(
                    "INSERT INTO partnerji (naziv, davcna_stevilka, drzava, vrsta) VALUES (?, ?, ?, ?)",
                    (naziv, davcna, "Slovenija", "dobavitelj")
                )
                partner_id = cursor.lastrowid
                safe_print(f"Created new partner: {naziv} ({davcna})")
                
        # 2. Document
        stevilka = data.get("stevilka", "").strip()
        if not stevilka:
            stevilka = "NEZNANA_" + os.path.splitext(filename)[0]
            
        # Check if already imported
        cursor.execute(
            "SELECT id FROM dokumenti WHERE stevilka = ? AND partner_id = ? AND tip = 'prejeti_racuni'",
            (stevilka, partner_id)
        )
        if cursor.fetchone():
            safe_print(f"[{filename}] Invoice {stevilka} already imported. Skipping.")
            skipped_count += 1
            continue
            
        # Extract dates and amounts
        datum_izdaje = data.get("datum_izdaje", "")
        datum_zapadlosti = data.get("datum_zapadlosti", "")
        datum_storitve_od = data.get("datum_storitve_od", "") or datum_izdaje
        datum_storitve_do = data.get("datum_storitve_do", "") or datum_izdaje
        
        # Poslovno leto
        poslovno_leto = 2026
        if datum_izdaje:
            try:
                poslovno_leto = int(datum_izdaje.split("-")[0])
            except:
                pass
                
        znesek_skupaj = float(data.get("znesek_skupaj", 0.0))
        znesek_brez_ddv = float(data.get("znesek_brez_ddv", 0.0))
        znesek_ddv = float(data.get("znesek_ddv", 0.0))
        
        # Calculate/validate totals if empty
        if znesek_skupaj == 0 and znesek_brez_ddv > 0:
            znesek_skupaj = round(znesek_brez_ddv + znesek_ddv, 2)
        elif znesek_brez_ddv == 0 and znesek_skupaj > 0:
            znesek_ddv = round(znesek_skupaj * 0.22 / 1.22, 2)
            znesek_brez_ddv = round(znesek_skupaj - znesek_ddv, 2)
            
        # Interna številka: PR-[leto]-[next_id]
        cursor.execute(
            "SELECT interna_stevilka FROM dokumenti WHERE tip = 'prejeti_racuni' AND poslovno_leto = ? ORDER BY id DESC LIMIT 1",
            (poslovno_leto,)
        )
        last_row = cursor.fetchone()
        next_seq = 1
        if last_row and last_row["interna_stevilka"]:
            try:
                parts = last_row["interna_stevilka"].split("-")
                next_seq = int(parts[-1]) + 1
            except:
                pass
        interna_stevilka = f"PR-{poslovno_leto}-{next_seq:04d}"
        
        # Insert document
        cursor.execute(
            """
            INSERT INTO dokumenti (
                poslovno_leto, tip, stevilka, partner_id, datum_izdaje, datum_zapadlosti,
                znesek_brez_ddv, znesek_ddv, znesek_skupaj, status, datum_storitve_od, datum_storitve_do, interna_stevilka
            ) VALUES (?, 'prejeti_racuni', ?, ?, ?, ?, ?, ?, ?, 'neplačano', ?, ?, ?)
            """,
            (
                poslovno_leto, stevilka, partner_id, datum_izdaje, datum_zapadlosti,
                znesek_brez_ddv, znesek_ddv, znesek_skupaj, datum_storitve_od, datum_storitve_do, interna_stevilka
            )
        )
        dokument_id = cursor.lastrowid
        
        # Postavke
        postavke = data.get("postavke", [])
        if not postavke:
            postavke = [{
                "opis": "Uvožene storitve po računu",
                "kolicina": 1.0,
                "enota_mere": "kos",
                "cena_enote": znesek_brez_ddv,
                "popust": 0.0,
                "stopnja_ddv": 22.0,
                "znesek_skupaj": znesek_skupaj
            }]
            
        for p in postavke:
            opis = p.get("opis", "Stavka računa").strip() or "Stavka računa"
            kolicina = float(p.get("kolicina", 1.0))
            enota_mere = p.get("enota_mere", "kos").strip() or "kos"
            cena_enote = float(p.get("cena_enote", 0.0))
            popust = float(p.get("popust", 0.0))
            stopnja_ddv = float(p.get("stopnja_ddv", 22.0))
            postavka_skupaj = float(p.get("znesek_skupaj", 0.0))
            
            if postavka_skupaj == 0:
                postavka_skupaj = round(kolicina * cena_enote * (1 - popust/100.0) * (1 + stopnja_ddv/100.0), 2)
                
            cursor.execute(
                """
                INSERT INTO dokumenti_postavke (
                    dokument_id, opis, kolicina, cena_enote, stopnja_ddv, znesek_skupaj, popust, enota_mere
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (dokument_id, opis, kolicina, cena_enote, stopnja_ddv, postavka_skupaj, popust, enota_mere)
            )
            
        safe_print(f"[{filename}] Successfully imported invoice {stevilka} ({naziv}) -> {interna_stevilka} for {znesek_skupaj} EUR")
        imported_count += 1
        
    conn.commit()
    conn.close()
    
    safe_print(f"\nImport finished! Imported: {imported_count}, Skipped: {skipped_count}, Total files: {len(json_files)}")

if __name__ == "__main__":
    main()
