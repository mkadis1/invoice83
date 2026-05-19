import os
import sys
import json
import requests
import pdfplumber
import io

sys.path.insert(0, '.')
from invoice_ocr import extract_text_from_pdf

def parse_with_llama(text, model="llama3"):
    url = "http://localhost:11434/api/chat"
    
    prompt = f"""
Extract structured invoice data from the following OCR/text representation of an invoice.
Return ONLY a valid JSON object matching this schema:
{{
  "stevilka": "Invoice number (string, e.g. '2602011739412')",
  "datum_izdaje": "Issue date (YYYY-MM-DD)",
  "datum_zapadlosti": "Due date (YYYY-MM-DD)",
  "datum_storitve_od": "Service start date (YYYY-MM-DD, or empty string)",
  "datum_storitve_do": "Service end date (YYYY-MM-DD, or empty string)",
  "znesek_skupaj": Total amount with tax (float),
  "znesek_ddv": Total VAT amount (float),
  "znesek_brez_ddv": Total amount without tax (float),
  "partner": {{
    "naziv": "Supplier/Issuer company name (string, e.g. 'A1 Slovenija d.d.'). DO NOT confuse with buyer (Miha Kadiš or SIM 83)",
    "davcna_stevilka": "Supplier tax ID (string, e.g. 'SI60595256'). ONLY the supplier's, not the buyer's (buyer is SI11648236)"
  }},
  "postavke": [
    {{
      "opis": "Line item description",
      "kolicina": Quantity (float, default 1.0),
      "enota_mere": "Unit of measure (string, default 'kos')",
      "cena_enote": Unit price with or without tax (float),
      "popust": Discount percentage (float, default 0.0),
      "stopnja_ddv": VAT rate percentage (float, default 22.0),
      "znesek_skupaj": Line item total with tax (float)
    }}
  ]
}}

Here is the invoice text:
---
{text}
---
"""

    payload = {
        "model": model,
        "messages": [
            {
                "role": "system",
                "content": "You are a precise accounting extraction assistant. You only output valid JSON matching the requested schema. No conversational text."
            },
            {
                "role": "user",
                "content": prompt
            }
        ],
        "stream": False,
        "format": "json",
        "options": {
            "temperature": 0.0
        }
    }
    
    try:
        response = requests.post(url, json=payload, timeout=60)
        response.raise_for_status()
        res_json = response.json()
        content = res_json['message']['content']
        return json.loads(content)
    except Exception as e:
        print(f"Ollama Error: {e}")
        return None

if __name__ == "__main__":
    pdf_path = "sample/A1 racun_2602011739412.pdf"
    if not os.path.exists(pdf_path):
        print(f"Path not found: {pdf_path}")
        sys.exit(1)
        
    print(f"Extracting text from {pdf_path}...")
    text = extract_text_from_pdf(pdf_path)
    
    print("Sending to Ollama (llama3)...")
    res = parse_with_llama(text, "llama3")
    print("\nResult:")
    print(json.dumps(res, indent=2, ensure_ascii=True))
    with open("scratch/res_llama.json", "w", encoding="utf-8") as f:
        json.dump(res, f, indent=2, ensure_ascii=False)
    print("\nSaved result to scratch/res_llama.json")
