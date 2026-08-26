import os, sys
sys.path.insert(0, '.')
import invoice_ocr

# List recent PNG uploads
import glob
uploads = glob.glob('uploads/*.png')
for f in uploads:
    print(f)
    txt = invoice_ocr.extract_text_from_image(open(f, 'rb').read())
    print('OCR[:300]:', txt[:300])
    print('is_aliexpress:', invoice_ocr._is_aliexpress_document(f, txt))
    print('---')
