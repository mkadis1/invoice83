import sys
import os
sys.path.insert(0, r'c:\Users\mihak\My Drive\Dokumenti\Antigravity\Racunovodstvo')
os.chdir(r'c:\Users\mihak\My Drive\Dokumenti\Antigravity\Racunovodstvo')

from invoice_ocr import process_invoice_data

sample_dir = 'sample'
files = sorted([f for f in os.listdir(sample_dir) if f.lower().endswith('.pdf')])

results = []
for fname in files:
    path = os.path.join(sample_dir, fname)
    try:
        data = process_invoice_data(path, fname)
        if data:
            p = data.get('partner', {})
            has_partner = p.get('naziv','').strip() not in ('', 'Neznan Partner')
            has_stevilka = data.get('stevilka','').strip() not in ('', 'NEZNANA')
            has_datum = bool(data.get('datum_izdaje',''))
            has_total = data.get('znesek_skupaj', 0) > 0
            has_postavke = len(data.get('postavke', [])) > 0
            ok = has_partner and has_stevilka and has_datum and has_total
            results.append({
                'file': fname,
                'ok': ok,
                'stevilka': data.get('stevilka',''),
                'partner': p.get('naziv',''),
                'datum': data.get('datum_izdaje',''),
                'total': data.get('znesek_skupaj', 0),
                'postavke': len(data.get('postavke', [])),
                'davcna': p.get('davcna_stevilka',''),
            })
    except Exception as ex:
        results.append({'file': fname, 'ok': False, 'error': str(ex)})

with open('scratch/parse_results.txt', 'w', encoding='utf-8') as out:
    out.write(f"{'FILE':<50} {'OK':<4} {'STEVILKA':<25} {'PARTNER':<35} {'DATUM':<12} {'TOTAL':<10} {'POST'}\n")
    out.write("-"*160 + "\n")
    for r in results:
        ok_str = "OK" if r.get('ok') else "FAIL"
        err = r.get('error','')
        if err:
            out.write(f"{r['file']:<50} FAIL  ERROR: {err}\n")
        else:
            out.write(f"{r['file']:<50} {ok_str:<4} {r.get('stevilka',''):<25} {r.get('partner',''):<35} {r.get('datum',''):<12} {r.get('total',0):<10.2f} {r.get('postavke',0)}\n")

print("Done - results in scratch/parse_results.txt")
