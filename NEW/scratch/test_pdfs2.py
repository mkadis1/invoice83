import sys, os
sys.path.insert(0, r'c:\Users\mihak\My Drive\Dokumenti\Antigravity\Racunovodstvo')
os.chdir(r'c:\Users\mihak\My Drive\Dokumenti\Antigravity\Racunovodstvo')
from invoice_ocr import extract_text_from_pdf

files = [
    'sample/GLS invoice__1771-MK-29304989__myCjsCUo2AYDjSw6.pdf',
    'sample/Fanatec Invoice-F1276886.pdf',
    'sample/Ebull Racun_st-_1389-2026.pdf',
    'sample/soncek 2177.pdf',
    'sample/e-racuni Racun_st._2026-00650.pdf',
    'sample/Bauhaus 0110052001.pdf',
    'sample/Petrol racun_317002066117.pdf',
    'sample/Telemach CLB-S1-1000427622.pdf',
    'sample/Vanc Racun Kadis jan 2026.pdf',
    'sample/SuperStrela racun_da1_mk_67334.pdf',
    'sample/IKEA STO635-01-600254_TaxInvoice.pdf',
]
with open('scratch/pdf_texts2.txt', 'w', encoding='utf-8') as out:
    for f in files:
        # try exact name first, then glob
        if not os.path.exists(f):
            import glob
            matches = glob.glob(f.replace('Kadis','Kadi?').replace('Racun','Ra?un'))
            if matches: f = matches[0]
            else: continue
        out.write(f'=== {os.path.basename(f)} ===\n')
        text = extract_text_from_pdf(f)
        out.write(text[:3000])
        out.write('\n\n')
print("Done")
