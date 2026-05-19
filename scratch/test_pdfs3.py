import sys, os
sys.path.insert(0, r'c:\Users\mihak\My Drive\Dokumenti\Antigravity\Racunovodstvo')
os.chdir(r'c:\Users\mihak\My Drive\Dokumenti\Antigravity\Racunovodstvo')
from invoice_ocr import extract_text_from_pdf

files = [
    'sample/Google 5474306531.pdf',
    'sample/Fanatec Invoice-F1276886.pdf',
    'sample/IKEA STO635-01-600254_TaxInvoice.pdf',
    'sample/JKP ERAC_202626733_8133692.pdf',
    'sample/H_35988861.pdf',
    'sample/Tuli Raccun-8018613-2-1-S2-26000154.pdf',
    'sample/stickerapp 3988626.pdf',
    'sample/Zvezdar 142.pdf',
    'sample/BM Racun_00000047.pdf',
    'sample/Conrad Invoice_9781842664.pdf',
    'sample/GMT Racun A4 POS_26-0B42-0000110.pdf',
]
with open('scratch/pdf_texts3.txt', 'w', encoding='utf-8') as out:
    for f in files:
        if not os.path.exists(f):
            import glob
            matches = glob.glob(f.replace(' ', '?'))
            if matches: f = matches[0]
            else:
                out.write(f'=== {os.path.basename(f)} === NOT FOUND\n\n')
                continue
        out.write(f'=== {os.path.basename(f)} ===\n')
        text = extract_text_from_pdf(f)
        out.write(text[:2500])
        out.write('\n\n')
print("Done")
