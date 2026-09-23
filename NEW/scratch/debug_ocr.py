import sys
import os
sys.path.append(os.getcwd())
import ocr_engine
import json
import os

pdf_path = r"c:\Users\mihak\My Drive\Dokumenti\Antigravity\Racunovodstvo\Sample\Processed\inpos 2430.pdf"
if os.path.exists(pdf_path):
    data = ocr_engine.process_sample_file(pdf_path)
    print(json.dumps(data, indent=4, ensure_ascii=False))
    
    # Also print the raw text to see what we are working with
    text = ocr_engine.extract_text_from_pdf(pdf_path)
    print("\n--- RAW TEXT ---\n")
    print(text)
else:
    print(f"File not found: {pdf_path}")
