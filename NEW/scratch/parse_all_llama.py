import sys
sys.path.insert(0, '.')

import os
import json
import requests
import glob
from invoice_ocr import extract_text_from_pdf, parse_with_llama

def main():
    pdf_dir = "sample"
    out_dir = "scratch/results"
    os.makedirs(out_dir, exist_ok=True)
    
    # Get all PDFs in sample/
    files = glob.glob(os.path.join(pdf_dir, "*.pdf")) + glob.glob(os.path.join(pdf_dir, "*.PDF"))
    # Filter unique and ignore case
    files = list(set(files))
    
    # Filter out credit notes ("dobropis")
    files = [f for f in files if "dobropis" not in os.path.basename(f).lower()]
    files.sort()
    
    total = len(files)
    print(f"Found {total} invoices to process (excluding credit notes).")
    
    success_count = 0
    
    for idx, filepath in enumerate(files, 1):
        filename = os.path.basename(filepath)
        out_path = os.path.join(out_dir, filename.replace(".pdf", ".json").replace(".PDF", ".json"))
        
        # Check if already processed
        if os.path.exists(out_path):
            safe_filename = filename.encode('ascii', 'replace').decode('ascii')
            print(f"[{idx}/{total}] Skipping {safe_filename} (already processed).")
            success_count += 1
            continue
            
        safe_filename = filename.encode('ascii', 'replace').decode('ascii')
        print(f"[{idx}/{total}] Processing {safe_filename}...")
        try:
            text = extract_text_from_pdf(filepath)
            if not text.strip():
                print(f"  Warning: No text extracted from {safe_filename}. Might be empty/scanned.")
            
            # Send to Llama
            parsed = parse_with_llama(text, filename, "llama3")
            if parsed:
                with open(out_path, "w", encoding="utf-8") as f:
                    json.dump(parsed, f, indent=2, ensure_ascii=False)
                partner = parsed.get("partner", {}).get("naziv", "Unknown")
                total_amt = parsed.get("znesek_skupaj", 0.0)
                safe_partner = partner.encode('ascii', 'replace').decode('ascii')
                print(f"  Success! Partner: {safe_partner}, Total: {total_amt} EUR")
                success_count += 1
            else:
                print(f"  Failed to parse {safe_filename}")
        except Exception as e:
            print(f"  Error processing {safe_filename}: {e}")
            
    print(f"\nFinished! Successfully processed {success_count}/{total} invoices.")

if __name__ == "__main__":
    main()
