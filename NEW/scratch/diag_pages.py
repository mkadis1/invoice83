import pdfplumber
import pytesseract
import os
import sys
sys.path.insert(0, r"c:\Users\mihak\My Drive\Dokumenti\Antigravity\Racunovodstvo")

os.name = 'nt'
pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'

from PIL import ImageFilter, ImageEnhance

pdf_path = r"c:\Users\mihak\My Drive\Dokumenti\Antigravity\Racunovodstvo\Sample\Processed\inpos 2430.pdf"

print("Testing each page individually...")
with pdfplumber.open(pdf_path) as pdf:
    print(f"Total pages: {len(pdf.pages)}")
    for i, page in enumerate(pdf.pages):
        print(f"\n=== PAGE {i+1} ===")
        text = page.extract_text()
        if text and text.strip():
            print(f"HAS TEXT LAYER ({len(text)} chars)")
            print(text[:500])
            continue
        print("No text layer, trying OCR...")
        try:
            img = page.to_image(resolution=400).original
            print(f"Image size: {img.size}")
            # Try raw first
            raw = pytesseract.image_to_string(img, lang='slv+eng', config='--psm 6 --oem 3')
            print(f"Raw OCR ({len(raw)} chars):")
            print(raw[:800])
        except Exception as e:
            print(f"ERROR: {e}")
            import traceback
            traceback.print_exc()
