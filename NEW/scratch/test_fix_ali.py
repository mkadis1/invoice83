import re, json
from datetime import datetime

def is_aliexpress_document(filename="", text=""):
    fn = (filename or "").lower()
    t = (text or "").lower()
    if "aliexpress" in fn or "ordersummary" in fn:
        return True
    if "aliexpress" in t or "alibaba" in t:
        return True
    if ("order id" in t or "order 1d" in t or "order time" in t) and ("item detail" in t or "shipping fee" in t or "vat included" in t or "things to note" in t):
        return True
    return False

def fix_aliexpress_data(data, text="", filename=""):
    if not data:
        data = {}
    
    # 1. Partner
    p = data.get("partner") or {}
    p["naziv"] = "Aliexpress"
    p["davcna_stevilka"] = "NL826439810B01"
    p["drzava"] = "Singapur"
    p["ulica"] = "10 Collyer Quay # 10-01, Ocean Financial Centre"
    p["kraj"] = "Singapur"
    p["postna_stevilka"] = "049315"
    p["tuji_partner_neprebran"] = False
    data["partner"] = p
    data["partner_naziv"] = p["naziv"]
    data["partner_davcna"] = p["davcna_stevilka"]
    data["partner_trr"] = ""
    
    # 2. Stevilka (Order ID: 15-18 digits)
    st = str(data.get("stevilka") or "")
    if not re.match(r'^\d{15,18}$', st):
        m = re.search(r'\b(\d{15,18})\b', text + " " + filename)
        if m:
            data["stevilka"] = m.group(1)
            
    # 3. Datum
    m_map = {'jan':'01','feb':'02','mar':'03','apr':'04','may':'05','jun':'06','jul':'07','aug':'08','sep':'09','oct':'10','nov':'11','dec':'12'}
    dt = data.get("datum_izdaje") or ""
    if not re.match(r'^\d{4}-\d{2}-\d{2}$', dt):
        pats = [
            r'(?:Order time|Paid on|Date)[^\w]*([A-Za-z]{3})\s+(\d{1,2})[,\.\s]+(\d{4})',
            r'([A-Za-z]{3})\s+(\d{1,2})[,\.\s]+(\d{4})',
            r'(\d{1,2})\s+([A-Za-z]{3})[,\.\s]+(\d{4})',
            r'(\d{4})-(\d{2})-(\d{2})'
        ]
        for pat in pats:
            m = re.search(pat, text, re.IGNORECASE)
            if m:
                try:
                    g = m.groups()
                    if len(g) == 3:
                        if g[0].lower()[:3] in m_map:
                            mm, d, y = m_map[g[0].lower()[:3]], g[1].zfill(2), g[2]
                            dt = f"{y}-{mm}-{d}"
                        elif g[1].lower()[:3] in m_map:
                            d, mm, y = g[0].zfill(2), m_map[g[1].lower()[:3]], g[2]
                            dt = f"{y}-{mm}-{d}"
                    elif len(g) == 3:
                        dt = f"{g[0]}-{g[1]}-{g[2]}"
                    break
                except:
                    pass
    if not dt:
        dt = datetime.now().strftime("%Y-%m-%d")
        
    data["datum_izdaje"] = dt
    data["datum_zapadlosti"] = dt
    data["datum_storitve_od"] = dt
    data["datum_storitve_do"] = dt
    data["datum_placila"] = dt
    data["sklic"] = ""
    data["placano"] = True
    data["placan"] = True
    data["nacin_placila"] = "Poslovna kartica"
    
    # 4. Total znesek
    z_skupaj = float(data.get("znesek_skupaj") or 0.0)
    if z_skupaj <= 0.01:
        m_tot = re.search(r'Total[^\d\n\r]*([\d]+[\.,][\d]{2})', text, re.IGNORECASE)
        m_eur = re.search(r'EUR[^\d\n\r]*([\d]+[\.,][\d]{2})', text, re.IGNORECASE)
        if m_tot:
            z_skupaj = float(m_tot.group(1).replace(',', '.'))
        elif m_eur:
            z_skupaj = float(m_eur.group(1).replace(',', '.'))
    data["znesek_skupaj"] = z_skupaj
    
    # 5. Postavke
    postavke = data.get("postavke") or []
    for p_item in postavke:
        p_item["stopnja_ddv"] = 22.0
        opis = (p_item.get("opis") or "").strip()
        kol = float(p_item.get("kolicina") or 1.0)
        cena = float(p_item.get("cena_enote") or 0.0)
        sk = float(p_item.get("znesek_skupaj") or 0.0)
        pop = float(p_item.get("popust") or 0.0)
        
        if "shipping" in opis.lower():
            p_item["opis"] = "Shipping fee"
            p_item["popust"] = 0.0
            if sk > 0:
                p_item["cena_enote"] = round(sk / 1.22, 4)
            elif cena > 0:
                p_item["znesek_skupaj"] = round(cena, 2)
                p_item["cena_enote"] = round(cena / 1.22, 4)
        else:
            # Check if cena is gross
            if sk > 0 and cena > 0:
                calc_gross = (cena * kol) * (1 - pop / 100)
                if abs(calc_gross - sk) < 0.05:
                    p_item["cena_enote"] = round(cena / 1.22, 4)
            elif sk > 0 and cena <= 0:
                p_item["cena_enote"] = round((sk / kol) / 1.22, 4)
                
    # 6. Recalculate totals
    if postavke:
        calc_tot = round(sum(float(p_item.get("znesek_skupaj") or 0.0) for p_item in postavke), 2)
        if abs(calc_tot - z_skupaj) < 0.05:
            z_skupaj = calc_tot
            data["znesek_skupaj"] = z_skupaj
            
    z_ddv = round(z_skupaj - (z_skupaj / 1.22), 2)
    z_brez = round(z_skupaj - z_ddv, 2)
    data["znesek_ddv"] = z_ddv
    data["znesek_brez_ddv"] = z_brez
    
    return data

# Test on the OCR text from earlier
import sqlite3
conn = sqlite3.connect('racunovodstvo.db')
c = conn.cursor()
c.execute("SELECT id, filename, ocr_text, corrected_json FROM llama_learning_examples WHERE id IN (167, 168, 125)")
for row in c.fetchall():
    print(f"=== TESTING FIX FOR ID {row[0]}: {row[1]} ===")
    parsed = json.loads(row[3])
    fixed = fix_aliexpress_data(parsed, row[2], row[1])
    print(json.dumps(fixed, indent=2, ensure_ascii=False))
    print()
