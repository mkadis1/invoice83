import sys
import os
sys.path.append(os.getcwd())
from ocr_engine import extract_text_from_pdf, parse_invoice_data
import json

pdf_path = r'uploads\9df56ebfd5434d89a72b162add34392a.pdf'
text = extract_text_from_pdf(pdf_path)
print("--- RAW TEXT ---")
print(text)
print("--- PARSED DATA ---")
data = parse_invoice_data(text)
print(json.dumps(data, indent=4, ensure_ascii=False))
