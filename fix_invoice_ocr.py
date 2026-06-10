"""Fix script: remove duplicate _is_credit_note and fix_credit_note_data from invoice_ocr.py"""
content = open('invoice_ocr.py', encoding='utf-8').read()

# Find boundaries
start = content.find('\ndef _is_credit_note(filename, text):')
end = content.find('\ndef fix_sp_data(data, text, filename=')

print(f'start={start}, end={end}, len={len(content)}')
assert start > 0, "Could not find _is_credit_note"
assert end > start, "Could not find fix_sp_data after _is_credit_note"

new_section = '''
def _is_credit_note(filename, text):
    """Preveri ali je dokument dobropis (credit note)."""
    fn_lower = filename.lower()
    if 'dobropis' in fn_lower or 'credit_note' in fn_lower or 'creditnote' in fn_lower:
        return True
    if re.search(r'Dobropis\\s+(?:[\\u0160S]t|No)\\.?\\s+[A-Z0-9]', text, re.IGNORECASE):
        return True
    if re.search(r'credit\\s+note', text, re.IGNORECASE):
        return True
    return False


def fix_credit_note_data(data, text, filename=""):
    """Post-procesor za dobropise: popravi stevilko, vezni racun in zneske."""
    # 1. Stevilka dobropisa (npr. 'Dobropis St. C10000982776')
    m_st = re.search(r'Dobropis\\s+[S\\u0160]t\\.?\\s+([A-Z0-9][\\w\\-]{2,20})', text, re.IGNORECASE)
    if m_st:
        data['stevilka'] = m_st.group(1).strip()

    # 2. Vezni racun (originalni racun, na katerega se dobropis nanasa)
    m_vezni = re.search(r'VEZNI\\s+RA[C\\u010c]UN\\s*[:\\s]+([\\d\\w\\-]{5,25})', text, re.IGNORECASE)
    if m_vezni:
        data['vezni_racun'] = m_vezni.group(1).strip()
    elif not data.get('vezni_racun'):
        data['vezni_racun'] = ''

    # 3. Skupaj (Skupaj XXX,XX)
    m_skupaj = re.search(r'Skupaj\\s+([\\d.]+[,][\\d]{2}|[\\d]+[.][\\d]{2})', text, re.IGNORECASE)
    if m_skupaj:
        val = clean_number(m_skupaj.group(1))
        if val > 0:
            data['znesek_skupaj'] = val

    # 4. Brez DDV (Vrednost brez DDV XXX,XX)
    m_neto = re.search(r'Vrednost\\s+brez\\s+DDV\\s+([\\d.,]+)', text, re.IGNORECASE)
    if m_neto:
        data['znesek_brez_ddv'] = clean_number(m_neto.group(1))

    # 5. Znesek DDV
    m_ddv_zn = re.search(r'DDV\\s+([\\d.,]+)\\s*\\n\\s*([\\d.,]+)', text, re.IGNORECASE)
    if m_ddv_zn:
        v = clean_number(m_ddv_zn.group(2))
        if v > 0:
            data['znesek_ddv'] = v
    if not data.get('znesek_ddv') and data.get('znesek_skupaj') and data.get('znesek_brez_ddv'):
        data['znesek_ddv'] = round(data['znesek_skupaj'] - data['znesek_brez_ddv'], 2)

    # 6. Postavke: 'Naziv  Neto  DDV_zn  Skupaj' format
    if not data.get('postavke') or all(float(p.get('znesek_skupaj') or 0) == 0 for p in data.get('postavke', [])):
        item_pat = re.compile(
            r'^([A-Za-z\\u010d\\u0161\\u017e\\u010c\\u0160\\u017d][A-Za-z\\u010d\\u0161\\u017e\\u010c\\u0160\\u017d\\s]+?)\\s+([\\d.,]+)\\s+([\\d.,]+)\\s+([\\d.,]+)\\s*$',
            re.MULTILINE
        )
        items = []
        for mat in item_pat.finditer(text):
            opis, neto_s, ddv_s, skupaj_s = mat.groups()
            opis = opis.strip()
            neto_v = clean_number(neto_s)
            ddv_v = clean_number(ddv_s)
            sk_v = clean_number(skupaj_s)
            if sk_v > 0 and neto_v > 0 and len(opis) > 2:
                ddv_rate = round(ddv_v / neto_v * 100) if neto_v > 0 else 22.0
                items.append({
                    'opis': opis,
                    'kolicina': 1.0,
                    'enota_mere': 'kos',
                    'cena_enote': neto_v,
                    'popust': 0.0,
                    'stopnja_ddv': float(ddv_rate),
                    'znesek_skupaj': sk_v
                })
        if items:
            data['postavke'] = items

    return data

'''

new_content = content[:start] + new_section + content[end:]
open('invoice_ocr.py', 'w', encoding='utf-8').write(new_content)
print('Done! New function positions:')
lines = new_content.split('\n')
for i, line in enumerate(lines):
    if line.startswith('def ') and any(x in line for x in ['_is_credit', 'fix_credit', 'fix_sp_data']):
        print(f'  Line {i+1}: {line}')
