import sqlite3
import json
import requests
import time
import sys

sys.stdout.reconfigure(encoding='utf-8')

def call_llama(prompt, system_msg="You are an AI assistant for data extraction.", model="llama3"):
    url = "http://localhost:11434/api/chat"
    messages = [
        {"role": "system", "content": system_msg},
        {"role": "user", "content": prompt}
    ]
    payload = {
        "model": model,
        "messages": messages,
        "stream": False
    }
    try:
        response = requests.post(url, json=payload, timeout=60)
        response.raise_for_status()
        res_json = response.json()
        return res_json['message']['content']
    except Exception as e:
        print(f"Llama call failed: {e}")
        return None

def main():
    conn = sqlite3.connect('racunovodstvo.db')
    cursor = conn.cursor()
    
    # Preverimo in ustvarimo tabelo
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS llama_supplier_rules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        davcna_stevilka TEXT UNIQUE,
        naziv TEXT,
        extraction_rules TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    """)
    conn.commit()
        
    cursor.execute("SELECT id, ocr_text, corrected_json FROM llama_learning_examples")
    examples = cursor.fetchall()
    
    supplier_examples = {}
    
    # Skupiniranje po dobavitelju
    for ex in examples:
        id, ocr_text, corrected_json = ex
        try:
            data = json.loads(corrected_json)
            partner = data.get("partner", {})
            davcna = partner.get("davcna_stevilka", "").strip()
            naziv = partner.get("naziv", "").strip()
            
            if not davcna:
                davcna = naziv  # Zasilni identifikator, če ni davčne
                
            if not davcna:
                continue
                
            if davcna not in supplier_examples:
                supplier_examples[davcna] = {
                    "naziv": naziv,
                    "examples": []
                }
            supplier_examples[davcna]["examples"].append((ocr_text, corrected_json))
        except:
            continue
            
    print(f"Nasel {len(supplier_examples)} unikatnih dobaviteljev iz zgodovine ucenja.")
    
    for davcna, info in supplier_examples.items():
        # Preveri, če že imamo pravila
        cursor.execute("SELECT id FROM llama_supplier_rules WHERE davcna_stevilka = ?", (davcna,))
        if cursor.fetchone():
            print(f"Pravila za {davcna} že obstajajo. Preskakujem.")
            continue
            
        print(f"Generiram pravila za {davcna} ...")
        
        # Zgradimo prompt za generiranje pravil iz vseh primerov
        examples_text = ""
        for i, (ocr, correct_json) in enumerate(info["examples"]):
            examples_text += f"--- EXAMPLE {i+1} ---\nOCR TEXT:\n{ocr}\n\nCORRECT EXTRACTED JSON:\n{correct_json}\n\n"
            
        system_msg = "You are an expert data extraction analyst. Your job is to analyze OCR texts and their correct JSON extractions to write concise extraction rules for this specific supplier."
        prompt = f"""Based on the following examples of OCR text and their correctly extracted JSON data for supplier "{info['naziv']}", write a concise set of extraction rules. 
These rules will be used as instructions for another LLM to extract data correctly from this supplier's future invoices.
Focus on:
1. Where to find the invoice number (stevilka).
2. Where to find the dates (datum_izdaje, datum_storitve_od, datum_storitve_do).
3. Where to find the amounts (znesek_skupaj, znesek_brez_ddv, znesek_ddv).
4. Any specific quirks about this supplier's line items (postavke).

DO NOT output JSON. Output a bulleted list of concise instructions in English or Slovenian.

{examples_text}"""

        rules = call_llama(prompt, system_msg)
        if rules:
            cursor.execute("""
                INSERT INTO llama_supplier_rules (davcna_stevilka, naziv, extraction_rules)
                VALUES (?, ?, ?)
            """, (davcna, info['naziv'], rules))
            conn.commit()
            print(f"Uspesno shranjena pravila za {davcna}.")
        else:
            print(f"Napaka pri generiranju pravil za {davcna}.")
            
    conn.close()
    print("Migracija koncana.")

if __name__ == "__main__":
    main()
