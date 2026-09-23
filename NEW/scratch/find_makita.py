import os, sys, json
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, '.')
import invoice_ocr

# Scan all PNGs for Makita or unusual content
import glob
uploads = sorted(glob.glob('uploads/*.png'), key=os.path.getmtime, reverse=True)
print(f"Total PNGs: {len(uploads)}")
for f in uploads[:80]:
    try:
        txt = invoice_ocr.extract_text_from_image(open(f, 'rb').read())
        if 'makita' in txt.lower() or 'dtm' in txt.lower() or '99' in txt or '82.82' in txt:
            print(f"=== {f} ===")
            print(txt[:600])
            print('is_aliexpress:', invoice_ocr._is_aliexpress_document(f, txt))
            print()
    except Exception as e:
        print(f"Error {f}: {e}")
