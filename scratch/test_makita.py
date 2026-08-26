import sys, json
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, '.')
import invoice_ocr

# Test the 99€ file
f = 'uploads/6d1bf7502d774dcd8600c5825fa6738e.png'
with open(f, 'rb') as fp:
    content = fp.read()

print(f"Testing {f}")
text = invoice_ocr.extract_text_from_image(content)
print("OCR text:")
print(text[:800])
print()
print("is_aliexpress:", invoice_ocr._is_aliexpress_document(f, text))

# Test fix_aliexpress_data standalone
data = {
    "stevilka": "UNKNOWN",
    "znesek_skupaj": 99.03,
    "znesek_ddv": 0.0,
    "znesek_brez_ddv": 0.0,
    "partner": {},
    "postavke": [
        {"opis": "PC USB Automatic Transmission Gear", "kolicina": 1.0, "cena_enote": 82.82, "stopnja_ddv": 0.0, "znesek_skupaj": 99.03, "popust": 0.0, "enota_mere": "kos"}
    ]
}

print("\n--- fix_aliexpress_data result ---")
fixed = invoice_ocr.fix_aliexpress_data(data, text, f)
print(json.dumps(fixed, indent=2, ensure_ascii=False))

print("\n--- After post_process_invoice_data ---")
post = invoice_ocr.post_process_invoice_data(dict(fixed))
print("znesek_ddv:", post.get("znesek_ddv"))
print("znesek_brez_ddv:", post.get("znesek_brez_ddv"))
for p in post.get("postavke", []):
    print(f"  {p.get('opis')}: cena={p.get('cena_enote')}, ddv={p.get('stopnja_ddv')}%, sk={p.get('znesek_skupaj')}")
