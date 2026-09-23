import sys
import os
sys.path.insert(0, r'c:\Users\mihak\My Drive\Dokumenti\Antigravity\Racunovodstvo')
os.chdir(r'c:\Users\mihak\My Drive\Dokumenti\Antigravity\Racunovodstvo')

from invoice_ocr import extract_text_from_pdf

files = [
    'sample/A1 racun_2602011739412.pdf',
    'sample/Telemach CLB-S1-1000427622.pdf',
    'sample/Google 5474306531.pdf',
    'sample/Petrol racun_317002066117.pdf',
    'sample/Shopster invoice-5240a2ae-b65d-442c-9a97-53b583138e6c.pdf',
    'sample/artlist_invoice_BTLbdPVDjbrTPq0q.pdf',
    'sample/e-racuni Racun_st._2026-00650.pdf',
    'sample/SuperStrela racun_da1_mk_67334.pdf',
    'sample/GLS invoice__1771-MK-29304989__myCjsCUo2AYDjSw6.pdf',
    'sample/Fanatec Invoice-F1276886.pdf',
    'sample/IKEA STO635-01-600254_TaxInvoice.pdf',
    'sample/Ebull Racun_st-_1389-2026.pdf',
    'sample/ebay 27219.pdf',
    'sample/Vanc Racun Kadis jan 2026.pdf',
    'sample/SILVA VALENTAN s.p.-RACUN-Stevilka_ 17_26.pdf',
    'sample/Bauhaus 0110052001.pdf',
]
with open('scratch/pdf_texts.txt', 'w', encoding='utf-8') as out:
    for f in files:
        if not os.path.exists(f):
            # Try with special chars
            continue
        out.write(f'=== {os.path.basename(f)} ===\n')
        text = extract_text_from_pdf(f)
        out.write(text[:2000])
        out.write('\n\n')

print("Done - output in scratch/pdf_texts.txt")

