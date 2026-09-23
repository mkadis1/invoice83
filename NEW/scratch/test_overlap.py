import sys
import os
sys.path.append(os.getcwd())
import json
import re
from invoice_ocr import extract_text_from_pdf

def main():
    pdf_path = "sample/inpos 43-9038-560.pdf"
    text = extract_text_from_pdf(pdf_path)
    lines = text.split('\n')
    
    with open("scratch/results/inpos 43-9038-560.json", "r", encoding="utf-8") as f:
        data = json.load(f)
        
    for item in data.get("postavke", []):
        opis = item.get("opis", "").strip()
        print(f"\nDescription: {opis}")
        
        words_opis = set(w.lower() for w in re.findall(r'\b[a-zA-Z\d\-\u0161\u0111\u010d\u0107\u017e]{3,}\b', opis))
        print(f"Words in description: {words_opis}")
        
        best_line = None
        max_overlap = 0
        for line in lines:
            words_line = set(w.lower() for w in re.findall(r'\b[a-zA-Z\d\-\u0161\u0111\u010d\u0107\u017e]{3,}\b', line))
            overlap = len(words_opis.intersection(words_line))
            if overlap > 0:
                print(f"  Line: {line[:60]} -> Overlap: {overlap} (Intersection: {words_opis.intersection(words_line)})")
            if overlap > max_overlap:
                max_overlap = overlap
                best_line = line
                
        print(f"Best Match: {best_line} with overlap {max_overlap}")

if __name__ == "__main__":
    main()
