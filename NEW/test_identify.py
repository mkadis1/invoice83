import sys
sys.path.append('d:/Antigravity/Racunovodstvo')
import invoice_ocr

text = """
JKP d.o.o.
Davčna št.: SI12345678
Račun št. 2026-123
"""

supplier = invoice_ocr.llama_identify_supplier(text)
print("Supplier identified:", supplier)
