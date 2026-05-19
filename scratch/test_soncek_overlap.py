import re
from invoice_ocr import extract_text_from_pdf

def test():
    text = extract_text_from_pdf('Sample/soncek 2177.pdf')
    lines = [l.strip() for l in text.split('\n') if l.strip()]
    
    postavke = [
        {"opis": "1570MN IVERAL DIAMANTNO BELA 19mm :"},
        {"opis": "1570MN TRAK ROBNI ABS 23*1mm ("},
        {"opis": "'00084 __ROBLIEWEDOZOMMSPUR"}
    ]
    
    pat = r'(?:\d+[,.]\d*|[,.]\d+|\d+)'
    sep = r'[\s\W]+'
    # Use ([a-zA-Z\d]{{1,4}}) to allow digits/mixed case in units of measure (e.g. M2, TM, kos)
    num_pat = fr'({pat}){sep}([a-zA-Z\d]{{1,4}}){sep}({pat}){sep}({pat}){sep}({pat}){sep}({pat}){sep}({pat})'
    num_pat_no_rabat = fr'({pat}){sep}([a-zA-Z\d]{{1,4}}){sep}({pat}){sep}({pat}){sep}({pat}){sep}({pat})'

    for item in postavke:
        opis = item["opis"]
        max_overlap = 0
        target_idx = -1
        
        words_opis = set(w.lower() for w in re.findall(r'\b[a-zA-Z\d\-\u0161\u0111\u010d\u0107\u017e]{3,}\b', opis))
        print(f"\nItem opis: {opis}")
        
        for idx, line in enumerate(lines):
            words_line = set(w.lower() for w in re.findall(r'\b[a-zA-Z\d\-\u0161\u0111\u010d\u0107\u017e]{3,}\b', line))
            overlap = len(words_opis.intersection(words_line))
            if overlap > max_overlap:
                max_overlap = overlap
                target_idx = idx
        
        if target_idx != -1:
            print(f"  Best Match Line (idx {target_idx}): {lines[target_idx]}")
            # Try to find a numeric row match starting from target_idx up to target_idx + 2
            matched_line = None
            matched_groups = None
            matched_type = None
            
            for offset in range(3):
                test_idx = target_idx + offset
                if test_idx < len(lines):
                    line_to_test = lines[test_idx]
                    m = re.search(num_pat, line_to_test)
                    if m:
                        matched_line = line_to_test
                        matched_groups = m.groups()
                        matched_type = "7-columns (with rabat)"
                        break
                    m2 = re.search(num_pat_no_rabat, line_to_test)
                    if m2:
                        matched_line = line_to_test
                        matched_groups = m2.groups()
                        matched_type = "6-columns (no rabat)"
                        break
            
            print(f"    Matched row: {matched_line}")
            print(f"    Type: {matched_type}")
            print(f"    Groups: {matched_groups}")

if __name__ == "__main__":
    test()
