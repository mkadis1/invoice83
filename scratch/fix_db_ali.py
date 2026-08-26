import sqlite3, json

for db_path in ['racunovodstvo.db', 'demo/demo.db']:
    try:
        conn = sqlite3.connect(db_path)
        c = conn.cursor()
        
        # 1. Update llama_supplier_rules for NL826439810B01
        rules_text = """• The supplier is ALWAYS "Aliexpress" with tax ID "NL826439810B01" and country "Singapur".
• The invoice/document number ("stevilka") is the 15-18 digit numeric Order ID (e.g. "3072616279066667").
• "sklic" is ALWAYS empty string "" because payment is made via business card.
• "datum_izdaje", "datum_zapadlosti", "datum_storitve_od", "datum_storitve_do" are the order date in YYYY-MM-DD format.
• ALL prices on AliExpress are GROSS (with 22% VAT included).
• "cena_enote" for all line items MUST be net (without VAT): cena_enote = unit_gross_price / 1.22.
• "stopnja_ddv" is ALWAYS 22.0 for all items and shipping fee.
• "Shipping fee" MUST be a separate line item with kolicina=1.0, popust=0.0, stopnja_ddv=22.0, cena_enote=gross_shipping/1.22, znesek_skupaj=gross_shipping.
• "znesek_skupaj" is the total gross amount.
• "znesek_ddv" = znesek_skupaj - (znesek_skupaj / 1.22).
• "znesek_brez_ddv" = znesek_skupaj - znesek_ddv.
• "tuji_partner_neprebran" is ALWAYS false."""
        
        c.execute("UPDATE llama_supplier_rules SET extraction_rules = ?, updated_at = CURRENT_TIMESTAMP WHERE davcna_stevilka = 'NL826439810B01' OR UPPER(naziv) LIKE '%ALIEXPRESS%'", (rules_text,))
        
        # 2. Fix learning examples 167 & 168
        c.execute("SELECT id, corrected_json FROM llama_learning_examples WHERE id IN (167, 168)")
        rows = c.fetchall()
        for r_id, r_json in rows:
            data = json.loads(r_json)
            # fix postavke
            for p in data.get("postavke", []):
                p["stopnja_ddv"] = 22.0
                if "shipping" in p.get("opis", "").lower():
                    sk = float(p.get("znesek_skupaj") or 0.0)
                    p["cena_enote"] = round(sk / 1.22, 4)
                    p["popust"] = 0.0
                else:
                    sk = float(p.get("znesek_skupaj") or 0.0)
                    kol = float(p.get("kolicina") or 1.0)
                    if sk > 0 and kol > 0:
                        p["cena_enote"] = round((sk / kol) / 1.22, 4)
            z_sk = float(data.get("znesek_skupaj") or 0.0)
            z_ddv = round(z_sk - (z_sk / 1.22), 2)
            z_br = round(z_sk - z_ddv, 2)
            data["znesek_ddv"] = z_ddv
            data["znesek_brez_ddv"] = z_br
            c.execute("UPDATE llama_learning_examples SET corrected_json = ? WHERE id = ?", (json.dumps(data, ensure_ascii=False), r_id))
            print(f"[{db_path}] Updated example ID {r_id}")
            
        conn.commit()
        conn.close()
        print(f"[{db_path}] Database updated successfully.")
    except Exception as e:
        print(f"[{db_path}] Error: {e}")
