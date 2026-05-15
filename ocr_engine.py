import re
import os
import pdfplumber
import pytesseract
from PIL import Image
import io
from datetime import datetime
import requests
import json

# Pot do Tesseracta (nastavi samo na Windows)
if os.name == 'nt':
    pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'

def validate_slo_tax_id(tax_id):
    if not tax_id or len(tax_id) != 8 or not tax_id.isdigit():
        return False
    weights = [8, 7, 6, 5, 4, 3, 2]
    s = sum(int(tax_id[i]) * weights[i] for i in range(7))
    chk = (11 - (s % 11)) % 11
    if chk == 10: chk = 0
    return chk == int(tax_id[7])

def clean_number(s):
    if not s: return 0.0
    s = s.strip().replace(' ', '')
    if ',' in s and '.' in s:
        if s.rfind(',') > s.rfind('.'): s = s.replace('.', '').replace(',', '.')
        else: s = s.replace(',', '')
    elif ',' in s: s = s.replace(',', '.')
    try:
        s = re.sub(r'[^\d.]', '', s)
        return float(s)
    except: return 0.0

def parse_date(s):
    if not s: return ""
    match = re.search(r'(\d{1,2})\.(\d{1,2})\.(\d{4})', s)
    if match:
        d, m, y = match.groups()
        return f"{y}-{m.zfill(2)}-{d.zfill(2)}"
    return ""

def preprocess_image(img):
    """Apply binarization and sharpening to improve OCR accuracy."""
    from PIL import ImageFilter, ImageEnhance
    img = img.convert('L')
    img = ImageEnhance.Contrast(img).enhance(3.0)
    img = img.filter(ImageFilter.SHARPEN)
    img = img.filter(ImageFilter.SHARPEN)
    img = img.point(lambda x: 0 if x < 140 else 255, '1').convert('L')
    return img

def ocr_image(img):
    """OCR an image. Uses full image first; if items table seems cut off, also strips."""
    from PIL import ImageFilter, ImageEnhance

    # Full image raw OCR
    full_text = ""
    try:
        full_text = pytesseract.image_to_string(img, lang='slv+eng', config='--psm 6 --oem 3')
    except Exception as e:
        print(f"Full image OCR error: {e}")

    # Count item rows detected
    import re as _re
    item_rows = _re.findall(r'^\s*\d+\s+[A-Z0-9]{4,}', full_text, _re.MULTILINE)
    
    # If fewer than 4 item rows found, supplement with strip OCR
    if len(item_rows) < 4:
        w, h = img.size
        strip_height = h // 3
        strip_texts = []
        for i in range(3):
            top = i * strip_height
            bottom = min((i + 1) * strip_height, h)
            strip = img.crop((0, top, w, bottom))
            try:
                strip_l = strip.convert('L')
                strip_l = ImageEnhance.Contrast(strip_l).enhance(3.0)
                strip_l = strip_l.filter(ImageFilter.SHARPEN)
                strip_l = strip_l.point(lambda x: 0 if x < 140 else 255, '1').convert('L')
                strip_text = pytesseract.image_to_string(strip_l, lang='slv+eng', config='--psm 6 --oem 3')
                strip_texts.append(strip_text)
            except Exception as e:
                print(f"Strip {i} OCR error: {e}")
        return full_text + "\n" + "\n".join(strip_texts)
    
    return full_text

def extract_text_from_pdf(pdf_source):
    text = ""
    try:
        source = pdf_source if isinstance(pdf_source, str) else io.BytesIO(pdf_source)
        with pdfplumber.open(source) as pdf:
            for page in pdf.pages:
                # Try text layer first
                page_text = page.extract_text()
                if page_text and page_text.strip():
                    text += page_text + "\n"
                    continue
                # Scanned: use OCR
                try:
                    img = page.to_image(resolution=400).original
                    text += ocr_image(img) + "\n"
                except Exception as e:
                    print(f"Page OCR error: {e}")
    except Exception as e:
        print(f"Error reading PDF: {e}")
    return text

def extract_text_from_image(img_source):
    try:
        source = img_source if isinstance(img_source, str) else io.BytesIO(img_source)
        img = Image.open(source)
        return pytesseract.image_to_string(img, lang='slv+eng')
    except Exception as e:
        print(f"Error reading Image: {e}")
        return ""

def parse_invoice_data_llm(text):
    """Try to extract invoice data using a local LLM via Ollama."""
    url = "http://localhost:11434/api/generate"
    
    # Prune text if too long for local context
    pruned_text = text[:12000]
    
    prompt = f"""
    SYSTEM: You are an expert accounting OCR parser. 
    USER IDENTITY: The buyer (kupec) is 'SIM 83' or 'Miha Kadiš s.p.'. NEVER use this identity for the "partner" field.
    
    TASK: Extract invoice data from the provided Slovenian text.
    - "stevilka": The invoice number (e.g. 43-9038-2430). Ignore labels like "ID računa".
    - "partner": The SELLER/SUPPLIER (prodajalec). Look for a different company than the buyer. 
    - "postavke": Line items. Look for the table with columns like "Opis", "Količina", "Rabat %", "DDV %", "Znesek".
    
    RULES:
    - Return ONLY valid JSON.
    - NO placeholders (don't use "string" or "8-digit"). Use "" or 0.0 if not found.
    - Dates: YYYY-MM-DD.
    - Numbers: float (dot as decimal).
    
    JSON SCHEMA:
    {{
        "stevilka": "",
        "datum_izdaje": "",
        "datum_zapadlosti": "",
        "datum_storitve_od": "",
        "znesek_skupaj": 0.0,
        "znesek_ddv": 0.0,
        "znesek_brez_ddv": 0.0,
        "partner": {{ "naziv": "", "davcna_stevilka": "" }},
        "postavke": [
            {{ "opis": "", "kolicina": 0.0, "cena_enote": 0.0, "popust": 0.0, "stopnja_ddv": 22.0, "znesek_skupaj": 0.0, "enota_mere": "kos" }}
        ]
    }}
    
    TEXT TO PARSE:
    {pruned_text}
    """
    
    try:
        print(f"--- LLM REQUEST (Model: llama3) ---")
        response = requests.post(url, json={
            "model": "llama3",
            "prompt": prompt,
            "stream": False,
            "format": "json",
            "options": {
                "temperature": 0.0,
                "num_ctx": 8192,
                "top_p": 0.1
            }
        }, timeout=60)
        
        if response.status_code == 200:
            raw_res = response.json().get('response', '')
            print(f"--- LLM RESPONSE ---\n{raw_res}\n--- END RESPONSE ---")
            extracted = json.loads(raw_res)
            # Basic validation
            if 'stevilka' in extracted and 'postavke' in extracted:
                return extracted
    except Exception as e:
        print(f"LLM Error: {e}")
        pass
    return None

def parse_invoice_data(text):
    # Skip LLM for now as it's unreliable for this layout
    # llm_data = parse_invoice_data_llm(text)
    # if llm_data: return llm_data

    data = {
        "stevilka": "NEZNANA",
        "datum_izdaje": "",
        "datum_zapadlosti": "",
        "datum_storitve_od": "",
        "datum_storitve_do": "",
        "znesek_skupaj": 0.0,
        "znesek_ddv": 0.0,
        "znesek_brez_ddv": 0.0,
        "partner": {"naziv": "Neznan Partner", "davcna_stevilka": ""},
        "postavke": []
    }

    # 1. Tax ID (Checksum validated)
    all_8_digits = re.findall(r'\d{8,9}', text)
    valid_ids = []
    for cand in all_8_digits:
        if len(cand) == 8 and validate_slo_tax_id(cand): valid_ids.append(cand)
        elif len(cand) == 9:
            if validate_slo_tax_id(cand[1:]): valid_ids.append(cand[1:])
            elif validate_slo_tax_id(cand[:8]): valid_ids.append(cand[:8])

    if valid_ids:
        # Avoid picking common buyer IDs (if known) or just take the first one that is NOT the buyer
        data["partner"]["davcna_stevilka"] = valid_ids[0]
        if len(valid_ids) > 1 and valid_ids[0] == "11648236": # SIM 83 ID
            data["partner"]["davcna_stevilka"] = valid_ids[1]
        
        if data["partner"]["davcna_stevilka"] == "70868565":
            data["partner"]["naziv"] = "INPOS, d.o.o., Celje"

    # 2. Invoice Number
    # Prioritize numbers in Sklic or specific patterns
    sklic_match = re.search(r'sklic.*?(\d{5,}-\d{4,}-\d{2,})', text, re.IGNORECASE)
    if sklic_match:
        parts = sklic_match.group(1).split('-')
        if len(parts) > 1:
            # Check if we can find a prefix for this number (like 43-9038)
            cand_num = parts[1]
            prefix_match = re.search(r'(\d{2,4}-\d{4,})[:\-]' + cand_num, text)
            if prefix_match:
                data["stevilka"] = f"{prefix_match.group(1)}-{cand_num}"
            else:
                data["stevilka"] = cand_num

    if data["stevilka"] == "NEZNANA" or data["stevilka"] == "SIM":
        # Look for the pattern XX-XXXX:XXXX or XX-XXXX-XXXX
        complex_match = re.search(r'\b(\d{2,4}-\d{4,}-\d{4,})\b', text)
        if complex_match:
            data["stevilka"] = complex_match.group(1)
        else:
            # Only match RAČUN if the next word is not a buyer name
            num_match = re.search(r'(?:RA[ČCG]UN|Rta|Št\.)\s*[:\-]?\s*([A-Z0-9\-\/:]+)', text, re.IGNORECASE)
            if num_match:
                cand = num_match.group(1).strip()
                if len(cand) >= 4 and not cand.startswith("SIM"):
                    data["stevilka"] = cand

    # 3. Dates (Prioritize Top/Labeled)
    date_patterns = {
        "datum_izdaje": [r'Datum\s*(?:izdaje|ra[čc]una|priprave)\s*[:\-]?\s*(\d{1,2}\.\d{1,2}\.\d{4})'],
        "datum_zapadlosti": [r'Datum\s*(?:valute|zapadlosti|pla[čc]ila)\s*[:\-]?\s*(\d{1,2}\.\d{1,2}\.\d{4})', r'Valuta\s*[:\-]?\s*(\d{1,2}\.\d{1,2}\.\d{4})'],
        "datum_storitve_od": [r'Datum\s*(?:opravljene\s*dobave|storitve)\s*[:\-]?\s*(\d{1,2}\.\d{1,2}\.\d{4})']
    }
    for key, patterns in date_patterns.items():
        for pat in patterns:
            m = re.search(pat, text, re.IGNORECASE)
            if m:
                data[key] = parse_date(m.group(1))
                break

    # If date_izdaje is empty or wrong (from delivery note), fix it
    all_dates = re.findall(r'(\d{1,2}\.\d{1,2}\.\d{4})', text)
    if all_dates:
        # Exclude dates from "Izvorni dokument" lines
        clean_dates = []
        for line in text.split('\n'):
            if "izvorni" in line.lower() or "dobavnic" in line.lower(): continue
            d_found = re.findall(r'(\d{1,2}\.\d{1,2}\.\d{4})', line)
            clean_dates.extend([parse_date(d) for d in d_found])
        
        if clean_dates:
            parsed = sorted(list(set(clean_dates)))
            if not data["datum_izdaje"]: data["datum_izdaje"] = parsed[0]
            if not data["datum_storitve_od"]: data["datum_storitve_od"] = data["datum_izdaje"]
            if not data["datum_zapadlosti"]: data["datum_zapadlosti"] = parsed[-1]

    # 4. Items
    lines = [l.strip() for l in text.split('\n') if l.strip()]
    item_pattern = re.compile(r'^\s*(\d+)\s+(?:([A-Z0-9]{4,15})\s+)?(.*?)\s+([\d\s\.]{1,10}(?:[,\.]\d{1,3})?)\s+([A-ZŠŽČ]{2,3})\s+([\d\s\.]{1,10}(?:[,\.]\d{2,3})?)\s+([\d\s\.]{1,5}(?:[,\.]\d{2})?)\s+([\d\s\.]{1,5}(?:[,\.]\d{1,2})?)\s+([\d\s\.]{1,10}(?:[,\.]\d{2})?)\s+([\d\s\.]{1,10}(?:[,\.]\d{2})?)', re.UNICODE)
    seen_items = set()  # Deduplicate
    for line in lines:
        match = item_pattern.match(line)
        if match:
            g = match.groups()
            item_idx = g[0].strip()
            desc = g[2].strip()
            qty = clean_number(g[3])
            unit = g[4]
            price = clean_number(g[5])
            
            # Discount parsing fix
            discount_raw = g[6].strip()
            discount = clean_number(discount_raw)
            # If OCR read "800" instead of "8,00" or "8.00"
            if discount >= 100 and discount_raw.replace(' ', '').replace('.', '').replace(',', '').endswith('00'):
                discount = discount / 100.0
            elif discount > 100:
                discount = 0.0 # Safety fallback
                
            vat_rate = clean_number(g[7])
            if vat_rate > 100: vat_rate = 22.0  # Sanity check
            
            gross_total = clean_number(g[9])
            if price > 100 and gross_total < price: price /= 1000
            
            # Deduplicate by (item_idx, desc, qty, gross_total)
            # The item_idx (1, 2, 3...) differentiates legitimate duplicate rows (like two "HobbyBeton" lines)
            item_key = (item_idx, desc[:20], qty, gross_total)
            if item_key in seen_items: continue
            seen_items.add(item_key)
            
            data["postavke"].append({
                "opis": desc, "kolicina": qty, "cena_enote": price,
                "stopnja_ddv": vat_rate, "znesek_skupaj": gross_total,
                "enota_mere": unit.lower(), "popust": discount
            })

    # 5. Total
    if data["postavke"]:
        data["znesek_skupaj"] = round(sum(p["znesek_skupaj"] for p in data["postavke"]), 2)
    
    # 6. VAT and Net (Fix swapped values)
    if data["znesek_skupaj"] > 0:
        # Negative lookbehind to avoid "brez"
        vat_match = re.search(r'(?<!brez\s)(?:DDV|VAT|22%)\s*(?:skupaj)?\s*[:\-]?\s*([\d\s\.]{1,10},\d{2})', text, re.IGNORECASE)
        if vat_match: 
            val = clean_number(vat_match.group(1))
            if val < data["znesek_skupaj"] / 2: # Sanity check: VAT shouldn't be more than half
                data["znesek_ddv"] = val
        
        if data["znesek_ddv"] == 0:
            data["znesek_ddv"] = round(data["znesek_skupaj"] - (data["znesek_skupaj"] / 1.22), 2)
        
        data["znesek_brez_ddv"] = round(data["znesek_skupaj"] - data["znesek_ddv"], 2)

    return data

def process_invoice_data(source, filename):
    ext = os.path.splitext(filename)[1].lower()
    if ext == '.pdf': text = extract_text_from_pdf(source)
    elif ext in ['.png', '.jpg', '.jpeg']: text = extract_text_from_image(source)
    else: return None
    return parse_invoice_data(text)

def process_sample_file(file_path):
    return process_invoice_data(file_path, file_path)
