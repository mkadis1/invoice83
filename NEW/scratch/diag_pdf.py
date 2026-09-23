import pdfplumber
import sys

pdf_path = r"c:\Users\mihak\My Drive\Dokumenti\Antigravity\Racunovodstvo\Sample\Processed\inpos 2430.pdf"

print("=== PDFPLUMBER DIRECT TEXT EXTRACTION ===\n")
with pdfplumber.open(pdf_path) as pdf:
    for i, page in enumerate(pdf.pages):
        print(f"--- PAGE {i+1} ---")
        text = page.extract_text()
        if text:
            print("TEXT LAYER FOUND:")
            print(text)
        else:
            print("NO TEXT LAYER")
        print()
