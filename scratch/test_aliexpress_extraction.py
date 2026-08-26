import os, sys, json
sys.path.insert(0, '.')
import invoice_ocr

text = """‘AliExpress

summary
Order 1D: 3072616279066667
Order time: May 11, 2026
subtota e698
All discount eon
Shipping fee: 1.49
Total: €8.33
aT included

Shipping address
Mina Kadis sp. +386 70838383

Dobja vas 253, 2390 Ravne na Koroskem, Slovenia /5,
Ravne na Koroskem, Koroska, Slovenia, 2390

Payment method

446617 *#+# 3639 EUR 8.33
Paid on May 11, 2026

Item detail

Origin 1100mAh Battery for GoPro
WHITE

€6.98 x1
POWER Battery Factory Store

Things to note:
1. Items are sold by a third-party seller, not AliExpress. For
more information on the seller, please check online or in
the AliExpress app.

2. Import tax, duties and fees may be applicable upon
importation. This will depend on the tax and customs
policies in your destination count
"""

print("Testing llama_identify_supplier...")
supplier = invoice_ocr.llama_identify_supplier(text, "llama3")
print("Supplier identified:", supplier)

davcna = supplier.get("davcna_stevilka", "").strip() if supplier else ""
if not davcna and supplier:
    davcna = supplier.get("naziv", "").strip()

print("Getting supplier rules for:", davcna)
rules = invoice_ocr.get_supplier_rules(davcna)
print("Rules found:\n", rules)

print("\nCalling parse_with_llama...")
parsed = invoice_ocr.parse_with_llama(text, "OrderSummary202608263072616279066667.png", "llama3", rules=rules)
print("Parsed raw:", json.dumps(parsed, indent=2, ensure_ascii=False))

if parsed:
    post_processed = invoice_ocr.post_process_invoice_data(parsed)
    print("\nPost processed:", json.dumps(post_processed, indent=2, ensure_ascii=False))
