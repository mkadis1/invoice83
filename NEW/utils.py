import os
import time
from datetime import datetime
from zoneinfo import ZoneInfo
import uuid
import database
import json
import re
import traceback
import xml.etree.ElementTree as ET
import base64
import requests
from bs4 import BeautifulSoup
import io
import shutil
from pathlib import Path
try:
    import invoice_ocr
except:
    pass
import pdf_parser

def get_now_slo():
    """Vrne trenutni čas v Sloveniji (Europe/Ljubljana) v formatu YYYY-MM-DD HH:MM:SS."""
    return datetime.now(ZoneInfo("Europe/Ljubljana")).strftime("%Y-%m-%d %H:%M:%S")

def get_companies_registry():
    if not os.path.exists(COMPANIES_FILE):
        registry = {
            "active_id": "default",
            "items": [{"id": "default", "name": "Privzeto podjetje", "db": "racunovodstvo.db"}]
        }
        with open(COMPANIES_FILE, "w", encoding="utf-8") as f:
            import json
            json.dump(registry, f, indent=4)
        return registry
    with open(COMPANIES_FILE, "r", encoding="utf-8") as f:
        import json
        return json.load(f)

def save_companies_registry(registry):
    with open(COMPANIES_FILE, "w", encoding="utf-8") as f:
        import json
        json.dump(registry, f, indent=4)

def _naslednja_sifra(cursor, vrsta: str) -> str:
    """Generira naslednjo šifro: A001, A002... ali S001, S002..."""
    prefix = "A" if vrsta == "artikel" else "S"
    cursor.execute(
        "SELECT sifra FROM artikli_storitve WHERE vrsta = ? ORDER BY sifra DESC LIMIT 1",
        (vrsta,)
    )
    row = cursor.fetchone()
    if row:
        try:
            num = int(row["sifra"][1:]) + 1
        except Exception:
            num = 1
    else:
        num = 1
    return f"{prefix}{num:03d}"

def get_sum_delna_placila(delna_placila_str):
    if not delna_placila_str:
        return 0.0
    try:
        import json
        data = json.loads(delna_placila_str)
        if isinstance(data, list):
            return sum(float(item.get('znesek', 0.0) or 0.0) for item in data)
    except:
        pass
    return 0.0

def extract_sklic_from_namen(namen: str) -> str:
    if not namen:
        return ""
    import re
    # Match standard SIXX sklic formats, e.g. SI12 2602011739412 or SI00-12345 or RF12 12345
    match = re.search(r'\b(SI\d{2}[-\s]?\d+([-\s]\d+)*)\b', namen, re.IGNORECASE)
    if match:
        return match.group(1).strip()
    match = re.search(r'\b(RF\d{2}[-\s]?\d+([-\s]\d+)*)\b', namen, re.IGNORECASE)
    if match:
        return match.group(1).strip()
    
    # Check for any other string starting with "SI" or "RF" and numbers
    match = re.search(r'\b(SI\d{2,12})\b', namen, re.IGNORECASE)
    if match:
        return match.group(1).strip()
    return ""

def _generate_ujp_soap_envelope(xml_content: bytes, stevilka: str) -> str:
    """Generira SOAP ovojnico za pošiljanje e-računa na UJP B2B."""
    import base64
    encoded = base64.b64encode(xml_content).decode('utf-8')
    return f"""<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                 xmlns:xsd="http://www.w3.org/2001/XMLSchema"
                 xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    <SendInvoice xmlns="http://ujpnet.ujp.gov.si/b2b/">
      <invoiceData>{encoded}</invoiceData>
      <fileName>eslog_{stevilka}.xml</fileName>
    </SendInvoice>
  </soap12:Body>
</soap12:Envelope>"""

def izracunaj_kontrolno_stevilko(stevilka_str):
    """
    Izračun kontrolne številke po modulu 97 (ISO 7064 MOD 97-10).
    Uporablja se za slovenske sklice SI12 (v nekaterih modulih).
    """
    # Odstrani vse ne-številčne znake
    s = "".join(filter(str.isdigit, stevilka_str))
    if not s:
        return "00"
    
    # Številka mora biti dolga do 13 mest
    s = s[:13]
    # Izračun: 98 - (številka * 100 % 97)
    try:
        n = int(s)
        res = (n * 100) % 97
        k = 98 - res
        return f"{k:02d}"
    except:
        return "00"

def format_money(val):
    if val is None: val = 0.0
    return f"{val:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".") + " €"

def generate_pdf_invoice(invoice_data, company_data, partner_data, items):
    from fpdf import FPDF
    import os
    import tempfile
    import qrcode

    class PDF(FPDF):
        def header(self):
            active_id = "default"
            if "get_companies_registry" in globals():
                try:
                    registry = globals()["get_companies_registry"]()
                    active_id = registry.get("active_id", "default")
                except Exception:
                    pass
            
            # Iskanje logotipa - preverimo vse možne končnice (podjetju-lasten ali globalni)
            logo_path = None
            for ext in ['png', 'jpg', 'jpeg', 'gif', 'PNG', 'JPG', 'JPEG', 'GIF']:
                p = f"static/uploads/logo_{active_id}.{ext}"
                if os.path.exists(p):
                    logo_path = p
                    break
            if not logo_path:
                for ext in ['png', 'jpg', 'jpeg', 'gif', 'PNG', 'JPG', 'JPEG', 'GIF']:
                    p = f"static/uploads/logo.{ext}"
                    if os.path.exists(p):
                        logo_path = p
                        break
            
            if logo_path:
                # Če logotip obstaja, narišemo samo sliko
                self.image(logo_path, 10, 8, 40)
            else:
                # Če logotipa ni, izrišemo tekstovni logotip
                self.set_font('DejaVu', 'B', 24)
                self.set_text_color(0, 0, 0)
                self.cell(15, 10, 'SIM', ln=0)
                self.set_text_color(230, 0, 0)
                self.cell(15, 10, '83', ln=0)
            
            self.set_draw_color(0, 74, 153)
            self.set_line_width(0.5)
            self.line(10, 30, 200, 30)
            
            # PREPREČEVANJE PREKRIVANJA: premaknemo kazalec pod črto!
            self.set_y(35)


    pdf = PDF()
    # Registracija fonta DejaVu
    pdf.add_font('DejaVu', '', 'DejaVuSans.ttf')
    pdf.add_font('DejaVu', 'B', 'DejaVuSans-Bold.ttf')
    pdf.add_font('DejaVu', 'I', 'DejaVuSans.ttf')
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()
    
    # Naslov računa (Desno poravnano, večji font)
    title = "RAČUN št."
    if invoice_data.get('tip') == 'ponudba' or invoice_data.get('tip') == 'ponudbe':
        title = "PONUDBA št."
    elif invoice_data.get('tip') == 'dobropis' or invoice_data.get('tip') == 'dobropisi':
        title = "DOBROPIS št."
        
    pdf.set_font('DejaVu', 'B', 16)
    pdf.set_text_color(25, 42, 86) # Temno modra
    pdf.cell(0, 10, f"{title} {invoice_data.get('stevilka', '')}", ln=1, align='R')
    pdf.set_text_color(0, 0, 0)
    
    def f_date(d):
        if not d: return d
        parts = d.split('-')
        if len(parts) == 3: return f"{parts[2]}.{parts[1]}.{parts[0]}"
        return d


    # Pošiljatelj (Levo)
    pdf.set_xy(10, 55)
    pdf.set_font('DejaVu', 'B', 10)
    pdf.cell(90, 5, 'IZDAJATELJ:', ln=1)
    pdf.set_font('DejaVu', '', 9)
    pdf.cell(90, 4, company_data.get('naziv', ''), ln=1)
    pdf.cell(90, 4, company_data.get('ulica', ''), ln=1)
    pdf.cell(90, 4, company_data.get('posta_kraj', ''), ln=1)
    # K1 — ZDDV-1, čl. 82: DDV-ID izdajatelja z "SI" predpono za zavezance
    company_davcna_raw = company_data.get('davcna_stevilka', '') or ''
    if company_data.get('zavezanec_za_ddv') and company_davcna_raw:
        company_davcna_clean = re.sub(r'[^0-9]', '', company_davcna_raw)
        pdf.cell(90, 4, f"ID za DDV: SI{company_davcna_clean}", ln=1)
    elif company_davcna_raw:
        pdf.cell(90, 4, f"Davčna št.: {company_davcna_raw}", ln=1)
    if company_data.get('trr'):
        pdf.cell(90, 4, f"TRR: {company_data.get('trr', '')}", ln=1)

    # Prejemnik (Desno)
    pdf.set_xy(110, 55)
    pdf.set_font('DejaVu', 'B', 10)
    pdf.cell(90, 5, 'PREJEMNIK:', ln=1, align='R')
    pdf.set_font('DejaVu', '', 9)
    pdf.set_xy(110, 60)
    # ZDDV-1, čl. 82: DDV-ID kupca — SI + čiščena davčna za zavezance
    partner_davcna_raw = partner_data.get('davcna_stevilka', '') or ''
    if partner_data.get('zavezanec_za_ddv') and partner_davcna_raw:
        partner_davcna_clean = re.sub(r'[^0-9]', '', partner_davcna_raw)
        partner_ddv_vrstica = f"ID za DDV: SI{partner_davcna_clean}"
    elif partner_davcna_raw:
        partner_ddv_vrstica = f"Davčna št.: {partner_davcna_raw}"
    else:
        partner_ddv_vrstica = ""
    prejemnik_vrstice = f"{partner_data.get('naziv', '')}\n{partner_data.get('ulica', '')}\n{partner_data.get('postna_stevilka', '')} {partner_data.get('kraj', '')}\n{partner_data.get('drzava', 'Slovenija')}"
    if partner_ddv_vrstica:
        prejemnik_vrstice += f"\n{partner_ddv_vrstica}"
    pdf.multi_cell(90, 4, prejemnik_vrstice, align='R')

    # Datumi - pod prejemnikom, desno (ne prekrivajo s prejem. blokom)
    d_od = invoice_data.get('datum_storitve_od', '')
    d_do = invoice_data.get('datum_storitve_do', '')
    dates_y = pdf.get_y() + 2
    pdf.set_font('DejaVu', '', 8)
    pdf.set_text_color(80, 80, 80)
    pdf.set_xy(110, dates_y); pdf.cell(90, 4, f"Datum izdaje: {invoice_data.get('datum_izdaje', '')}", align='R'); dates_y += 4
    pdf.set_xy(110, dates_y); pdf.cell(90, 4, f"Datum zapadlosti: {invoice_data.get('datum_zapadlosti', '')}", align='R'); dates_y += 4
    if d_od and d_do:
        pdf.set_xy(110, dates_y); pdf.cell(90, 4, f"Obdobje storitve: {f_date(d_od)} - {f_date(d_do)}", align='R')
    elif d_od:
        pdf.set_xy(110, dates_y); pdf.cell(90, 4, f"Datum storitve: {f_date(d_od)}", align='R')
    pdf.set_text_color(0, 0, 0)

    pdf.set_y(105)
    
    # Tabela postavk
    pdf.set_fill_color(230, 230, 230)
    pdf.set_font('DejaVu', 'B', 9)
    # Header cells
    # Header cells - Adjusted widths to fit Discount
    is_zavezanec = bool(company_data.get('zavezanec_za_ddv', False))
    if is_zavezanec:
        pdf.cell(75, 8, 'Opis storitve/izdelka', 1, 0, 'L', True)
        pdf.cell(12, 8, 'Kol.', 1, 0, 'C', True)
        pdf.cell(13, 8, 'EM', 1, 0, 'C', True)
        # ZDDV-1, čl. 82: cena na enoto mora biti jasno označena kot brez DDV
        pdf.cell(25, 8, 'Cena/en.b.DDV', 1, 0, 'R', True)
        pdf.cell(15, 8, 'Pop.%', 1, 0, 'C', True)
        pdf.cell(20, 8, 'DDV%', 1, 0, 'C', True)
        pdf.cell(30, 8, 'Znesek', 1, 1, 'R', True)
    else:
        pdf.cell(95, 8, 'Opis storitve/izdelka', 1, 0, 'L', True)
        pdf.cell(12, 8, 'Kol.', 1, 0, 'C', True)
        pdf.cell(13, 8, 'EM', 1, 0, 'C', True)
        pdf.cell(25, 8, 'Cena/en.', 1, 0, 'R', True)
        pdf.cell(15, 8, 'Pop.%', 1, 0, 'C', True)
        pdf.cell(30, 8, 'Znesek', 1, 1, 'R', True)
    
    pdf.set_font('DejaVu', '', 9)
    for it in items:
        x = pdf.get_x()
        y = pdf.get_y()
        
        desc = it.get('opis', '')
        w_opis = 75 if is_zavezanec else 95
        pdf.multi_cell(w_opis, 6, desc, border=1)
        new_y = pdf.get_y()
        row_h = new_y - y
        
        # Zapolnimo ostala polja v isti vrstici
        pdf.set_xy(x + w_opis, y)
        pdf.cell(12, row_h, str(it.get('kolicina', 1)), 1, 0, 'C')
        pdf.cell(13, row_h, it.get('enota_mere', 'kos'), 1, 0, 'C')
        pdf.cell(25, row_h, format_money(it.get('cena_enote', 0)), 1, 0, 'R')
        pdf.cell(15, row_h, f"{it.get('popust', 0)}%", 1, 0, 'C')
        if is_zavezanec:
            pdf.cell(20, row_h, f"{it.get('stopnja_ddv', 22)}%", 1, 0, 'C')
        pdf.cell(30, row_h, format_money(it.get('znesek_skupaj', 0)), 1, 1, 'R')
        
    pdf.ln(5)
    
    # Celotni znesek (na desni)
    pdf.set_font('DejaVu', '', 10)
    if is_zavezanec:
        # ZDDV-1, čl. 82: DDV seštevek dinamično po stopnjah (ne fiksno 22%)
        # Grupiramo postavke po stopnji DDV
        ddv_skupine = {}
        for it in items:
            stopnja = float(it.get('stopnja_ddv', 22) or 22)
            kol = float(it.get('kolicina', 1) or 1)
            cena = float(it.get('cena_enote', 0) or 0)
            popust = float(it.get('popust', 0) or 0)
            neto_postavke = round(kol * cena * (1 - popust / 100), 2)
            ddv_postavke = round(neto_postavke * stopnja / 100, 2)
            if stopnja not in ddv_skupine:
                ddv_skupine[stopnja] = {'osnova': 0.0, 'ddv': 0.0}
            ddv_skupine[stopnja]['osnova'] += neto_postavke
            ddv_skupine[stopnja]['ddv'] += ddv_postavke
        skupaj_osnova = sum(g['osnova'] for g in ddv_skupine.values())
        skupaj_ddv = sum(g['ddv'] for g in ddv_skupine.values())
        pdf.cell(160, 6, 'Skupaj brez DDV:', 0, 0, 'R')
        pdf.cell(30, 6, format_money(round(skupaj_osnova, 2)), 0, 1, 'R')
        # Ena vrstica na DDV skupino (kadar je več stopenj)
        for stopnja_ddv, g in sorted(ddv_skupine.items()):
            if stopnja_ddv == 0:
                label = 'DDV (0% — oproščeno):'
            else:
                label = f'DDV ({stopnja_ddv:.4g}%):'
            pdf.cell(160, 6, label, 0, 0, 'R')
            pdf.cell(30, 6, format_money(round(g['ddv'], 2)), 0, 1, 'R')
    
    pdf.ln(2)
    pdf.set_font('DejaVu', 'B', 12)
    pdf.set_draw_color(25, 42, 86)
    pdf.set_line_width(0.5)
    pdf.cell(140, 10, 'SKUPAJ ZA PLAČILO:', 'T B', 0, 'R')
    pdf.set_text_color(200, 0, 0) # Rdeča za poudarek zneska
    pdf.cell(50, 10, format_money(invoice_data.get('znesek_skupaj', 0)), 'T B', 1, 'R')
    pdf.set_text_color(0, 0, 0)
    
    zb = invoice_data.get('zakljucno_besedilo', '')
    if zb and zb.strip():
        pdf.ln(8)
        pdf.set_font('DejaVu', 'I', 9)
        pdf.multi_cell(0, 5, zb.strip())

    noga = invoice_data.get('noga_dokumenta', '')
    if noga and noga.strip():
        pdf.ln(5)
        pdf.set_font('DejaVu', '', 8)
        pdf.set_text_color(50, 50, 50)
        pdf.multi_cell(0, 4, noga.strip())

    # Posebna opomba za ne-zavezance (če niso zavezanci za DDV)
    legal_note = "DDV ni obračunan na podlagi 1. odstavka 94. člena ZDDV-1"
    if not company_data.get('zavezanec_za_ddv', False):
        if legal_note not in zb and legal_note not in noga:
            pdf.ln(5)
            pdf.set_font('DejaVu', 'I', 8)
            pdf.set_text_color(0, 0, 0)
            pdf.cell(0, 5, legal_note, ln=1, align='L')

    # Footer
    pdf.ln(10)
    pdf.set_font('DejaVu', '', 8)
    pdf.set_text_color(100, 100, 100)
    pdf.cell(0, 4, 'Hvala za vaše zaupanje.', ln=1)
    pdf.ln(2)
    
    # Ugotovimo ali vključimo plačilne podatke in QR kodo
    # SQLite shrani bool kot 0/1, .get() pa vrne None če ključa ni (npr. stari zapisi)
    # Ugotovimo ali vključimo plačilne podatke in QR kodo
    v_placilo = True
    if 'vkljuci_placilo' in invoice_data:
        v_raw = invoice_data['vkljuci_placilo']
        # SQLite shrani 0/1, JSON pa True/False. Preverimo vse možnosti.
        if v_raw == 0 or v_raw is False or str(v_raw).lower() == '0' or str(v_raw).lower() == 'false':
            v_placilo = False
    
    odstotek = invoice_data.get('odstotek_placila', 100)
    if odstotek is None: odstotek = 100
    try: odstotek = float(odstotek)
    except: odstotek = 100
    
    if v_placilo:
        pdf.set_font('DejaVu', 'B', 8)
        pdf.set_text_color(0, 0, 0)
        pdf.cell(0, 4, 'Plačilni podatki:', ln=1)
        pdf.set_font('DejaVu', '', 8)
        pdf.cell(0, 4, f"IBAN: {company_data.get('trr', '')}", ln=1)
        pdf.cell(0, 4, f"Banka: {company_data.get('banka', '')}", ln=1)
        
        if odstotek < 100:
            znesek_delni = invoice_data.get('znesek_skupaj', 0) * (odstotek / 100)
            pdf.cell(0, 4, f"Znesek za plačilo ({odstotek}%): {format_money(znesek_delni)}", ln=1)

        # SI00 in QR koda
        raw_num = "".join(filter(str.isdigit, invoice_data.get('stevilka', '')))
        # SI00 model ne zahteva kontrolne številke
        sklic_poln = raw_num
        pdf.cell(0, 4, f"Pri plačilu uporabite referenco plačila: SI00 {sklic_poln}", ln=1)
        
        # UPN-QR generiranje (Uradni slovenski standard ZBS)
        iban = company_data.get('trr', '').replace(' ', '')
        # Upoštevamo odstotek plačila za QR kodo
        znesek_za_qr = invoice_data.get('znesek_skupaj', 0) * (odstotek / 100)
        cents = int(round(znesek_za_qr * 100))
        amount_str = f"{cents:011d}"
        
        # Podatki prejemnika (naše podjetje) - omejimo na 42 znakov
        p_name = company_data.get('naziv', '')[:42]
        p_address = company_data.get('ulica', '')[:42]
        p_city = company_data.get('posta_kraj', '')[:42]
        
        # Podatki plačnika (partner) - omejimo na 42 znakov
        c_name = partner_data.get('naziv', '')[:42]
        c_address = partner_data.get('ulica', '')[:42]
        c_city = f"{partner_data.get('postna_stevilka', '')} {partner_data.get('kraj', '')}"[:42]
        
        # Sestavimo prvih 19 polj po vrstnem redu ZBS standarda
        vsebina_qr = [
            "UPNQR",            # 1. Glava
            "",                 # 2. IBAN plačnika
            "",                 # 3. Polog
            "",                 # 4. Dvig
            "",                 # 5. Referenca plačnika
            c_name,             # 6. Ime plačnika
            c_address,          # 7. Naslov plačnika
            c_city,             # 8. Kraj plačnika
            amount_str,         # 9. Znesek
            "",                 # 10. Datum plačila
            "",                 # 11. Nujno
            "OTHR",             # 12. Koda namena
            f"Placilo racuna {invoice_data.get('stevilka', '')}"[:42], # 13. Namen
            ".".join(invoice_data.get('datum_zapadlosti', '').split('-')[::-1]) if invoice_data.get('datum_zapadlosti') else "", # 14. Rok plačila (DD.MM.YYYY)
            iban,               # 15. IBAN prejemnika
            f"SI00{sklic_poln}", # 16. Referenca prejemnika
            p_name,             # 17. Ime prejemnika
            p_address,          # 18. Naslov prejemnika
            p_city              # 19. Kraj prejemnika
        ]
        
        vsota_dolzin = sum(len(f.encode('iso-8859-2', errors='replace')) for f in vsebina_qr)
        kontrolna_vsota = vsota_dolzin + 19
        vsebina_qr.append(f"{kontrolna_vsota:03d}")
        
        qr_data_string = "\n".join(vsebina_qr)
        qr_data_bytes = qr_data_string.encode('iso-8859-2', errors='replace')
        
        qr = qrcode.QRCode(
            version=None,
            error_correction=qrcode.constants.ERROR_CORRECT_M,
            box_size=10,
            border=4,
        )
        qr.add_data(qr_data_bytes)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")
        
        fd, temp_path = tempfile.mkstemp(suffix=".png")
        os.close(fd)
        img.save(temp_path)
        
        pdf.ln(5)
        pdf.image(temp_path, x=85, w=40)
        
        try:
            os.remove(temp_path)
        except:
            pass
    
    return pdf.output()

def ustvari_in_pripni_pdf(doc_id: int):
    """
    Interna funkcija, ki generira PDF za podan dokument_id in ga shrani med priloge.
    Prepiše obstoječi PDF, če že obstaja.
    """
    try:
        conn = database.get_db()
        cursor = conn.cursor()
        
        # Pridobivanje podatkov o dokumentu
        cursor.execute("SELECT * FROM dokumenti WHERE id = ?", (doc_id,))
        doc = cursor.fetchone()
        if not doc:
            conn.close()
            return
        
        # Pridobivanje podatkov o podjetju
        cursor.execute("SELECT * FROM nastavitve LIMIT 1")
        company = cursor.fetchone()
        if not company:
            company = {}
        
        # Pridobivanje podatkov o partnerju
        cursor.execute("SELECT * FROM partnerji WHERE id = ?", (doc['partner_id'],))
        partner = cursor.fetchone()
        if not partner:
            partner = {}
            
        # Pridobivanje postavk
        cursor.execute("SELECT * FROM dokumenti_postavke WHERE dokument_id = ?", (doc_id,))
        items = [dict(i) for i in cursor.fetchall()]

        # Generiranje PDF-ja
        pdf_bytes = generate_pdf_invoice(dict(doc), dict(company), dict(partner), items)
        
        # Shranjevanje v datoteko - uporabimo predvidljivo ime za samodejni PDF
        st_safe = str(doc['stevilka']).replace('/', '-').replace('\\', '-').replace(' ', '-')
        
        doc_prefix = "Racun"
        if doc['tip'] == 'ponudbe': doc_prefix = "Ponudba"
        elif doc['tip'] == 'dobropisi': doc_prefix = "Dobropis"
        
        disk_filename = f"{doc_prefix}-{st_safe}.pdf"
        filepath = UPLOADS_DIR / disk_filename
        
        with open(filepath, "wb") as f:
            f.write(pdf_bytes)
            
        # Posodobitev tabele priloge
        # Preverimo po filename, ker je ta unikaten za naš avtomatski PDF tega dokumenta
        cursor.execute("SELECT id FROM priloge WHERE parent_type = 'dokumenti' AND parent_id = ? AND filename = ?", (doc_id, disk_filename))
        existing = cursor.fetchone()
        
        if not existing:
            original_display_name = disk_filename
            
            cursor.execute("""
                INSERT INTO priloge (parent_type, parent_id, filename, original_name)
                VALUES (?, ?, ?, ?)
            """, ('dokumenti', doc_id, disk_filename, original_display_name))
        
        conn.commit()
        conn.close()
    except Exception:
        print("KRITIČNA NAPAKA pri samodejnem generiranju PDF priloge:")
        traceback.print_exc()
        if 'conn' in locals(): conn.close()

def parse_eslog_xml(xml_data):
    """
    Parsira e-SLOG XML na način, ki ignorira namespace (Namespace-Agnostic).
    Podpira UBL, e-Slog 1.6 in EDI-XML (Telemach).
    """
    if xml_data.startswith(b'\xef\xbb\xbf'):
        xml_data = xml_data[3:]
        
    root = ET.fromstring(xml_data)
    
    # 0. Ugotovimo tip dokumenta (380 = Racun, 381 = Dobropis)
    doc_type_code = "380"
    for el in root.iter():
        tag = el.tag.split('}')[-1]
        if tag == 'InvoiceTypeCode' or tag == 'D_1001':
            if el.text:
                doc_type_code = el.text.strip()
                break
    
    tip = 'prejeti_dobropisi' if doc_type_code == '381' else 'prejeti_racuni'

    def get_tag(el):

        return el.tag.split('}')[-1]

    def find_all(tag_name, root_el=root):
        """Poišče vse elemente z določenim imenom taga, ne glede na namespace."""
        res = []
        for el in root_el.iter():
            if get_tag(el) == tag_name:
                res.append(el)
        return res

    def find_one(tag_name, root_el=root):
        """Poišče prvi element z določenim imenom taga."""
        for el in root_el.iter():
            if get_tag(el) == tag_name:
                return el
        return None

    def find_path_val(path_list, root_el=root):
        """Preišče več možnih imen tagov in vrne vrednost prvega najdenega."""
        for name in path_list:
            el = find_one(name, root_el)
            if el is not None and el.text:
                return el.text.strip()
        return ""

    def find_edi_val(segment_tag, qual_tag, qual_val, value_tag, root_el=root):
        """Poišče EDIFACT segment (npr. S_DTM), preveri kvalifikator in vrne vrednost."""
        segments = find_all(segment_tag, root_el)
        for seg in segments:
            q_el = find_one(qual_tag, seg)
            if q_el is not None and q_el.text == qual_val:
                v_el = find_one(value_tag, seg)
                if v_el is not None and v_el.text:
                    return v_el.text.strip()
        return ""

    def find_child_val(tag_name, root_el=root):
        """Poišče neposrednega otroka z določenim imenom taga."""
        for el in root_el:
            if get_tag(el) == tag_name:
                return el.text.strip() if el.text else ""
        return None

    # 1. Številka računa
    stevilka = find_edi_val('S_BGM', 'D_1001', doc_type_code, 'D_1004')

    if not stevilka:
        # Bolj robusten fallback za EDIFACT (poišči D_1004 v kateremkoli S_BGM)
        for bgm in find_all('S_BGM'):
            v = find_one('D_1004', bgm)
            if v is not None and v.text:
                stevilka = v.text.strip()
                break
    if not stevilka:
        for name in ['ID', 'ŠtevilkaRačuna', 'StevilkaRacuna', 'IdRačuna', 'InvoiceNumber', 'DocumentNumber']:
            val = find_child_val(name, root)
            if val:
                stevilka = val
                break
    # 2. Datumi
    datum_izdaje = find_edi_val('S_DTM', 'D_2005', '137', 'D_2380') or find_path_val(['IssueDate', 'DatumRačuna', 'DatumRacuna', 'DatumIzdaje', 'Datum'])
    if datum_izdaje and 'T' in datum_izdaje: datum_izdaje = datum_izdaje.split('T')[0]
    
    datum_zapadlosti = find_edi_val('S_DTM', 'D_2005', '13', 'D_2380') or find_edi_val('S_DTM', 'D_2005', '209', 'D_2380') or find_edi_val('S_DTM', 'D_2005', '35', 'D_2380')
    if not datum_zapadlosti:
        datum_zapadlosti = find_path_val(['DueDate', 'DatumValute', 'DatumZapadlosti'])
    if datum_zapadlosti and 'T' in datum_zapadlosti: datum_zapadlosti = datum_zapadlosti.split('T')[0]

    ds_od = find_edi_val('S_DTM', 'D_2005', '167', 'D_2380')
    ds_do = find_edi_val('S_DTM', 'D_2005', '168', 'D_2380')
    datum_storitve = find_path_val(['DatumOpravljeneStoritve', 'DatumStoritve', 'DatumDobave'])
    if not datum_storitve: datum_storitve = ds_do or datum_izdaje

    # 3. Partner (Dobavitelj)
    seller_naziv = ""
    seller_davcna = ""
    seller_ulica = ""
    seller_postna = ""
    seller_kraj = ""
    seller_trr = ""
    seller_telefon = ""
    seller_email = ""
    
    # Iščemo NAD segment s SE (Seller)
    g_sg2_nodes = find_all('G_SG2')
    for g2 in g_sg2_nodes:
        nad = find_one('S_NAD', g2)
        if nad is not None:
            q = find_one('D_3035', nad)
            if q is not None and q.text in ['SE', 'II', 'SU', 'PR']:
                v_naziv = find_one('D_3036', nad)
                if v_naziv is not None: seller_naziv = v_naziv.text.strip()
                
                # Ulica, Kraj, Pošta v EDIFACT
                v_ulica = find_one('D_3042', nad)
                if v_ulica is not None: seller_ulica = v_ulica.text.strip()
                v_kraj = find_one('D_3164', nad)
                if v_kraj is not None: seller_kraj = v_kraj.text.strip()
                v_postna = find_one('D_3251', nad)
                if v_postna is not None: seller_postna = v_postna.text.strip()
                
                # Davčna je v G2 nivoju (navadno v G_SG3/S_RFF)
                seller_davcna = find_edi_val('S_RFF', 'D_1153', 'VA', 'D_1154', g2) or find_edi_val('S_RFF', 'D_1153', 'AHP', 'D_1154', g2) or find_edi_val('S_RFF', 'D_1153', 'CR', 'D_1154', g2)
                
                # Telefon in Email (S_COM)
                seller_email = find_edi_val('S_COM', 'D_3155', 'EM', 'D_3148', g2)
                seller_telefon = find_edi_val('S_COM', 'D_3155', 'TE', 'D_3148', g2)
                
                # IBAN (S_FII)
                fii = find_one('S_FII', g2)
                if fii is not None:
                    v_iban = find_one('D_3194', fii)
                    if v_iban is not None: seller_trr = v_iban.text.strip()
                break
            
    # Iskanje končano. Če davčne nismo našli znotraj SE vozlišča, ne smemo
    # iskati globalno, ker bi lahko dobili davčno od kupca (uporabnika).
        
    if not seller_davcna or not seller_naziv:
        # Fallback na standardne UBL/1.6 nivoje
        seller_node = find_one('AccountingSupplierParty') or find_one('Izdajatelj') or find_one('Prodajalec')
        if seller_node is not None:
            seller_naziv = seller_naziv or find_path_val(['Name', 'RegistrationName', 'Naziv', 'PartyName/Name'], seller_node)
            seller_davcna = seller_davcna or find_path_val(['CompanyID', 'DavčnaŠtevilka', 'DavcnaStevilka', 'PartyTaxScheme/CompanyID'], seller_node)
            seller_ulica = seller_ulica or find_path_val(['PostalAddress/StreetName', 'Naslov'], seller_node)
            seller_postna = seller_postna or find_path_val(['PostalAddress/PostalZone', 'PoštnaŠtevilka'], seller_node)
            seller_kraj = seller_kraj or find_path_val(['PostalAddress/CityName', 'Kraj'], seller_node)
            seller_trr = seller_trr or find_path_val(['FinancialAccount/ID'], seller_node)
            seller_email = seller_email or find_path_val(['Contact/ElectronicMail', 'Email'], seller_node)
            seller_telefon = seller_telefon or find_path_val(['Contact/Telephone', 'Telefon'], seller_node)

    # VAT Payee detection
    is_zavezanec = seller_davcna and ('SI' in seller_davcna.upper())
    seller_davcna_cisto = re.sub(r'[^0-9]', '', seller_davcna).strip() if seller_davcna else ""

    # 4. Zneski (ostaja isto)
    # ...
    z_skupaj_s = find_edi_val('S_MOA', 'D_5025', '9', 'D_5004') or find_path_val(['PayableAmount', 'ZnesekZaPlačilo', 'ZnesekSkupaj'])
    znesek_skupaj = float((z_skupaj_s or "0").replace(',', '.'))
    
    z_neto_s = find_edi_val('S_MOA', 'D_5025', '79', 'D_5004') or find_path_val(['TaxExclusiveAmount', 'ZnesekBrezDDV', 'NetoZnesek'])
    znesek_brez_ddv = float((z_neto_s or "0").replace(',', '.'))
    
    znesek_ddv = znesek_skupaj - znesek_brez_ddv

        # 5. Postavke
    postavke = []
    lines = find_all('G_SG26') or find_all('InvoiceLine') or find_all('Postavka')
    
    for line in lines:
        opis = find_path_val(['D_7008', 'Name', 'Opis', 'NazivArtikla'], line)
        if not opis: continue
        
        kol_s = find_path_val(['D_6060', 'InvoicedQuantity', 'Količina', 'Kolicina'], line)
        kolicina = float((kol_s or "1").replace(',', '.'))
        
        # Stopnja DDV (Percent v UBL, D_5278 v EDIFACT)
        ddv_s = find_path_val(['Percent', 'D_5278'], line)
        ddv_rate = float((ddv_s or "22.0").replace(',', '.'))
        
        # Neto znesek postavke
        skupaj_l_neto_s = find_edi_val('S_MOA', 'D_5025', '203', 'D_5004', line) or find_path_val(['LineExtensionAmount', 'ZnesekPostavke', 'Znesek'], line)
        skupaj_l_neto = float((skupaj_l_neto_s or "0").replace(',', '.'))
        
        # Znesek skupaj (bruto, z DDV)
        skupaj_l_bruto = skupaj_l_neto * (1 + ddv_rate / 100)

        # Cena na enoto: vedno izračunamo iz skupaj / kolicina za konsistentnost
        # (PriceAmount v XML se ne ujema vedno s formulo kolicina × cena)
        if kolicina != 0:
            cena_enote = skupaj_l_bruto / kolicina
        else:
            # Fallback na PriceAmount iz XML
            cena_s = find_path_val(['D_5118', 'PriceAmount', 'Cena'], line)
            cena_neto = float((cena_s or "0").replace(',', '.'))
            cena_enote = cena_neto * (1 + ddv_rate / 100) if cena_neto > 0 else skupaj_l_bruto

        postavke.append({
            "opis": opis,
            "kolicina": kolicina,
            "cena_enote": round(cena_enote, 6),
            "znesek_skupaj": round(skupaj_l_bruto, 2),
            "stopnja_ddv": ddv_rate
        })

    return {
        "stevilka": stevilka or "NEZNANA",
        "datum_izdaje": datum_izdaje or "2026-01-01",
        "datum_zapadlosti": datum_zapadlosti or datum_izdaje,
        "datum_storitve": datum_storitve or datum_izdaje,
        "datum_storitve_od": ds_od or datum_izdaje,
        "datum_storitve_do": ds_do or datum_izdaje,
        "partner": {
            "naziv": seller_naziv or "Neznan dobavitelj",
            "davcna_stevilka": seller_davcna_cisto,
            "ulica": seller_ulica or "",
            "postna_stevilka": seller_postna or "",
            "kraj": seller_kraj or "",
            "drzava": "Slovenija",
            "trr": seller_trr or "",
            "telefon": seller_telefon or "",
            "email": seller_email or "",
            "zavezanec_za_ddv": is_zavezanec
        },
        "znesek_skupaj": znesek_skupaj,
        "znesek_brez_ddv": znesek_brez_ddv,
        "znesek_ddv": znesek_ddv,
        "postavke": postavke,
        "tip": tip
    }

def _enrich_eslog_data(data):
    # Preveri če partner obstaja
    davcna = (data['partner'].get('davcna_stevilka') or "").strip()
    naziv = (data['partner'].get('naziv') or "").strip()
    
    # Čiščenje davčne številke in TRR preprečevanje zamenjave (IBAN v davčni številki)
    if davcna:
        # Preveri, če je davčna številka dejansko IBAN (npr. začne se z SI56 ali je predolga)
        davcna_clean = re.sub(r'\s+', '', davcna).upper()
        if len(davcna_clean) > 12 or davcna_clean.startswith('SI56') or re.match(r'^[A-Z]{2}\d{2}[A-Z0-9]{10,}', davcna_clean):
            # To je IBAN! Premakni v TRR in sprazni davčno številko
            data['partner']['trr'] = davcna
            data['partner']['davcna_stevilka'] = ""
            davcna = ""
            
    conn = database.get_db()
    cursor = conn.cursor()
    row = None
    
    if davcna:
        # 1. Poskusi ujemanje po davčni številki (samo če ni prazna, z ali brez SI predpone)
        d_clean = re.sub(r'[^0-9]', '', davcna)
        cursor.execute("""
            SELECT id, naziv, davcna_stevilka, ulica, postna_stevilka, kraj, drzava, trr, telefon, email 
            FROM partnerji 
            WHERE davcna_stevilka = ? OR davcna_stevilka = ? OR davcna_stevilka = ? OR davcna_stevilka = ?
        """, (davcna, d_clean, f"SI{d_clean}", f"SI {d_clean}"))
        row = cursor.fetchone()
    
    if not row and naziv:
        # 2. Poskusi ujemanje po točnem nazivu
        cursor.execute("SELECT id, naziv, davcna_stevilka, ulica, postna_stevilka, kraj, drzava, trr, telefon, email FROM partnerji WHERE UPPER(naziv) = UPPER(?)", (naziv,))
        row = cursor.fetchone()
        
    if not row and naziv:
        # 3. Poskusi "po korenu" — vzemi prvi del naziva (brez d.o.o., s.p. itd)
        # Odstranimo vse do vejice ali pike ali d.o.o.
        koren = re.split(r'[,.\s]+(?:d\.?\s*o\.?\s*o\.?|s\.?\s*p\.?|d\.?\s*d\.?)\b', naziv, flags=re.IGNORECASE)[0].strip()
        if len(koren) > 3:
            cursor.execute("SELECT id, naziv, davcna_stevilka, ulica, postna_stevilka, kraj, drzava, trr, telefon, email FROM partnerji WHERE UPPER(naziv) LIKE UPPER(?)", (f"%{koren}%",))
            row = cursor.fetchone()
        
    if not row and naziv:
        # 3. Posebna pravila za tuje platforme
        if naziv.lower() == 'aliexpress':
            cursor.execute("SELECT id, naziv, davcna_stevilka, ulica, postna_stevilka, kraj, drzava, trr, telefon, email FROM partnerji WHERE UPPER(naziv) LIKE '%ALIBABA%' OR UPPER(naziv) = 'ALIEXPRESS'")
            row = cursor.fetchone()
        elif naziv.lower() == 'temu':
            cursor.execute("SELECT id, naziv, davcna_stevilka, ulica, postna_stevilka, kraj, drzava, trr, telefon, email FROM partnerji WHERE UPPER(naziv) LIKE '%WHALECO%' OR UPPER(naziv) = 'TEMU'")
            row = cursor.fetchone()

    conn.close()
    
    data['partner_obstaja'] = row is not None
    data['bizi_enriched'] = False

    if row:
        data['partner']['id'] = row['id']
        data['partner']['naziv'] = row['naziv']
        data['partner']['davcna_stevilka'] = row['davcna_stevilka']
        data['partner']['ulica'] = row['ulica']
        data['partner']['postna_stevilka'] = row['postna_stevilka']
        data['partner']['kraj'] = row['kraj']
        data['partner']['drzava'] = row['drzava']
        data['partner']['trr'] = row['trr']
        data['partner']['telefon'] = row['telefon']
        data['partner']['email'] = row['email']
    else:
        # Novi partner
        drzava = data['partner'].get('drzava', 'Slovenija')
        
        # Enforce that if tax ID has typical Slovenian markers, it is Slovenia
        davcna = (data['partner'].get('davcna_stevilka') or "").strip()
        if davcna.startswith('SI') or (davcna.isdigit() and len(davcna) == 8):
            drzava = 'Slovenija'
            data['partner']['drzava'] = 'Slovenija'
            
        if drzava == 'Slovenija':
            # Novi slovenski partner — obogatimo podatke z Bizi.si
            naziv_za_iskanje = data['partner'].get('naziv', '')
            if naziv_za_iskanje:
                try:
                    bizi_results = search_bizi(naziv_za_iskanje)
                    if bizi_results:
                        best = bizi_results[0]
                        posta_kraj_split = best.get('posta_kraj', '').split(' ', 1)
                        postna = posta_kraj_split[0] if len(posta_kraj_split) > 0 else ''
                        kraj = posta_kraj_split[1] if len(posta_kraj_split) > 1 else ''
                        
                        detail = bizi_detail(best['link'])
                        data['partner']['naziv'] = best['naziv'] or data['partner']['naziv']
                        data['partner']['ulica'] = best.get('naslov') or data['partner'].get('ulica', '')
                        data['partner']['postna_stevilka'] = postna or data['partner'].get('postna_stevilka', '')
                        data['partner']['kraj'] = kraj or data['partner'].get('kraj', '')
                        data['partner']['telefon'] = detail.get('telefon') or data['partner'].get('telefon', '')
                        data['partner']['email'] = detail.get('email') or data['partner'].get('email', '')
                        
                        # Preveri, če Bizi vrne IBAN v polju davčne ali TRR
                        bizi_trr = detail.get('trr') or data['partner'].get('trr', '')
                        bizi_davcna = detail.get('davcna_stevilka') or best.get('davcna_stevilka') or ''
                        
                        # Čiščenje bizi rezultatov
                        if bizi_davcna:
                            bizi_davcna_clean = re.sub(r'\s+', '', bizi_davcna).upper()
                            if bizi_davcna_clean.startswith('SI56') or len(bizi_davcna_clean) > 12:
                                bizi_trr = bizi_davcna
                                bizi_davcna = ""
                                
                        data['partner']['trr'] = bizi_trr
                        if bizi_davcna:
                            data['partner']['davcna_stevilka'] = bizi_davcna
                        data['partner']['zavezanec_za_ddv'] = detail.get('zavezanec_za_ddv', best.get('zavezanec_za_ddv', False))
                        data['bizi_enriched'] = True
                except Exception as bizi_err:
                    print(f"Bizi.si enrichment failed: {bizi_err}")
                    
    # Za Google in AliExpress nastavimo, da je račun plačan s poslovno kartico in brez sklica
    p_naziv_low = (data.get('partner', {}).get('naziv') or '').lower()
    if 'google' in p_naziv_low or 'aliexpress' in p_naziv_low:
        data['sklic'] = ''
        data['placano'] = True
        data['placan'] = True
        data['nacin_placila'] = 'Poslovna kartica'
        
    return data

def _add_attachment(parent_type, parent_id, filename, content):
    ext = Path(filename).suffix.lower()
    unique_name = f"{uuid.uuid4().hex}{ext}"
    dest = UPLOADS_DIR / unique_name
    
    with open(dest, "wb") as f:
        f.write(content)
    
    conn = database.get_db()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO priloge (parent_type, parent_id, filename, original_name, uploaded_at) VALUES (?, ?, ?, ?, ?)",
        (parent_type, parent_id, unique_name, filename, get_now_slo())
    )
    conn.commit()
    conn.close()

def extract_aliexpress_png(content):
    """Izboljšan parser za AliExpress PNG račune.
    - Prebere posamezne artikle iz 'Item detail' sekcije
    - Loči Shipping fee kot ločeno postavko
    - Pravilno izračuna cene brez DDV (ker je VAT vključen)
    - Nastavi status Plačano + Poslovna kartica (plačilo z Visa kartico)
    """
    try:
        img = Image.open(io.BytesIO(content))
        # Izboljšava slike za OCR: povečanje kontrasta + grayscale
        img = img.convert('L')
        ocr_text = pytesseract.image_to_string(img, lang='eng')
    except Exception as e:
        print(f"OCR Error: {e}")
        ocr_text = ""

    print(f"[AliExpress OCR] Prebrano besedilo:\n{ocr_text[:500]}")

    m_map = {'Jan':'01','Feb':'02','Mar':'03','Apr':'04','May':'05','Jun':'06','Jul':'07','Aug':'08','Sep':'09','Oct':'10','Nov':'11','Dec':'12'}
    order_date = datetime.now().strftime("%Y-%m-%d")
    
    pats = [
        r'(?:Order time|Paid on|Date)[^\w]*([A-Za-z]{3})\s+(\d{1,2})[,\.\s]+(\d{4})',
        r'([A-Za-z]{3})\s+(\d{1,2})[,\.\s]+(\d{4})',
        r'(\d{1,2})\s+([A-Za-z]{3})[,\.\s]+(\d{4})',
        r'([A-Za-z]{3,10})\s+(\d{1,2})[,\.\s]+(\d{4})',
        r'(\d{4})-(\d{2})-(\d{2})'
    ]
    for pat in pats:
        m = re.search(pat, ocr_text, re.IGNORECASE)
        if m:
            try:
                g = m.groups()
                if '([A-Za-z]' in pat:
                    mm, d, y = g[0][:3].capitalize(), g[1].zfill(2), g[2]
                    if mm in m_map: order_date = f"{y}-{m_map[mm]}-{d}"
                elif '(\\d{1,2})\\s+([A-Za-z]' in pat:
                    d, mm, y = g[0].zfill(2), g[1][:3].capitalize(), g[2]
                    if mm in m_map: order_date = f"{y}-{m_map[mm]}-{d}"
                else:
                    order_date = f"{g[0]}-{g[1]}-{g[2]}"
                break
            except: continue
    
    order_id_match = re.search(r'\b(\d{15,18})\b', ocr_text)
    order_id = order_id_match.group(1) if order_id_match else "Neznano"
        
    # --- Skupni znesek (Total) ---
    total_val = 0.00
    total_match = re.search(r'Total[^\d\n\r]*([\d]+[\.,][\d]{2})', ocr_text, re.IGNORECASE)
    eur_match = re.search(r'EUR[^\d\n\r]*([\d]+[\.,][\d]{2})', ocr_text, re.IGNORECASE)
    all_potential = []
    for m2 in re.finditer(r'([\d]+[\.,][\d]{2})', ocr_text):
        val = float(m2.group(1).replace(',', '.'))
        start = max(0, m2.start() - 20)
        end = min(len(ocr_text), m2.end() + 20)
        context = ocr_text[start:end].lower()
        if 'vat' not in context:
            all_potential.append(val)
    if total_match: total_val = float(total_match.group(1).replace(',', '.'))
    elif eur_match: total_val = float(eur_match.group(1).replace(',', '.'))
    elif all_potential: total_val = max(all_potential)

    # --- Shipping fee ---
    shipping_val = 0.0
    ship_match = re.search(r'Shipping\s*(?:fee)?[^\d\n\r]*([\d]+[\.,][\d]{2})', ocr_text, re.IGNORECASE)
    if ship_match:
        shipping_val = float(ship_match.group(1).replace(',', '.'))

    # DDV faktor (AliExpress racuni imajo DDV vkljucen v skupni znesek, 22%)
    VAT_RATE = 22.0
    vat_factor = 1 + VAT_RATE / 100.0

    # --- Postavke: izvleci artikle iz "Item detail" sekcije ---
    postavke = []

    # Iskanje artiklov v "Item detail" bloku (format: ime, cena in kolicina "€X.XX x1")
    item_section_match = re.search(r'Item\s+detail(.+?)(?:Things to note|$)', ocr_text, re.IGNORECASE | re.DOTALL)
    if item_section_match:
        item_section = item_section_match.group(1)
        # Vsaka vrstica z oznako cene in kolicine
        item_pattern = list(re.finditer(r'(.*?)[€\$]\s*([\d]+[\.,][\d]{2})\s*x\s*(\d+)', item_section, re.IGNORECASE | re.DOTALL))
        for im in item_pattern:
            raw_desc = im.group(1).strip()
            item_price_gross = float(im.group(2).replace(',', '.'))
            item_qty = float(im.group(3))
            # Vzamemo zadnjo neprazno vrstico opisa (OCR pogosto doda store info pred imenom)
            desc_lines = [l.strip() for l in raw_desc.splitlines() if l.strip() and not re.match(r'^\d+$', l.strip())]
            item_desc = desc_lines[-1] if desc_lines else f"Nakup Aliexpress {order_id}"
            item_price_net = round(item_price_gross / vat_factor, 4)
            item_total_gross = round(item_price_gross * item_qty, 2)
            postavke.append({
                "opis": item_desc,
                "kolicina": item_qty,
                "enota_mere": "kos",
                "cena_enote": item_price_net,
                "popust": 0.0,
                "stopnja_ddv": VAT_RATE,
                "znesek_skupaj": item_total_gross
            })

    # Shipping fee kot locena postavka
    if shipping_val > 0:
        ship_net = round(shipping_val / vat_factor, 4)
        postavke.append({
            "opis": "Shipping fee",
            "kolicina": 1.0,
            "enota_mere": "kos",
            "cena_enote": ship_net,
            "popust": 0.0,
            "stopnja_ddv": VAT_RATE,
            "znesek_skupaj": shipping_val
        })

    # Ce ni nobene postavke, dodaj genericno
    if not postavke:
        base_val_gen = round(total_val / vat_factor, 4)
        postavke.append({
            "opis": f"Nakup Aliexpress {order_id}",
            "kolicina": 1.0,
            "enota_mere": "kos",
            "cena_enote": base_val_gen,
            "popust": 0.0,
            "stopnja_ddv": VAT_RATE,
            "znesek_skupaj": total_val
        })

    base_val = round(total_val / vat_factor, 2)
    vat_val = round(total_val - base_val, 2)
    
    return {
        "stevilka": order_id,
        "datum_izdaje": order_date,
        "datum_zapadlosti": order_date,
        "datum_storitve_od": order_date,
        "datum_storitve_do": order_date,
        # AliExpress racuni so vedno placani z Visa poslovno kartico
        "placano": True,
        "nacin_placila": "Poslovna kartica",
        "datum_placila": order_date,
        "partner": {
            "naziv": "Aliexpress",
            "davcna_stevilka": "NL826439810B01",
            "ulica": "", "postna_stevilka": "", "kraj": "", "drzava": "Kitajska",
            "zavezanec_za_ddv": False,
            "tuji_partner_neprebran": False
        },
        "znesek_skupaj": total_val,
        "znesek_brez_ddv": base_val,
        "znesek_ddv": vat_val,
        "valuta": "EUR",
        "tecaj": 1.0,
        "postavke": postavke
    }

def extract_generic_pdf(content):
    """Generični parser PDF računov - deluje z večino SLO in tujih dobaviteljev."""
    pdf_text = ""
    try:
        with pdfplumber.open(io.BytesIO(content)) as pdf:
            for page in pdf.pages:
                txt = page.extract_text()
                if txt: pdf_text += txt + "\n"
    except Exception as e:
        print(f"PDF Error: {e}")

    if not pdf_text.strip():
        # Skenirani/slikovni PDF - ni besedila. Uporabimo invoice_ocr.
        try:
            return invoice_ocr.process_invoice_data(content, "imported.pdf")
        except:
            return None
        
    try:
        with open("pdf_debug.txt", "w", encoding="utf-8") as f:
            f.write(pdf_text)
    except:
        pass
        
    # Globalno čiščenje problematičnih znakov (Artlist em-dash sredi besed, itd.)
    pdf_text = pdf_text.replace('\u2014', '').replace('\u2013', '-')

    def cn(s):
        """Pretvori evropski format številke v float."""
        if not s: return 0.0
        s = s.strip().rstrip('€').strip()
        if ',' in s and '.' in s:
            s = s.replace('.', '').replace(',', '.') if s.rfind(',') > s.rfind('.') else s.replace(',', '')
        elif ',' in s:
            s = s.replace(',', '.')
        try: return round(float(s), 2)
        except: return 0.0

    def pd(raw):
        """Pretvori niz datuma v YYYY-MM-DD."""
        if not raw: return datetime.now().strftime("%Y-%m-%d")
        raw = raw.strip()
        mm = {'jan':'01','feb':'02','mar':'03','apr':'04','maj':'05','may':'05',
              'jun':'06','jul':'07','avg':'08','aug':'08','sep':'09',
              'okt':'10','oct':'10','nov':'11','dec':'12'}
        m = re.search(r'(\d{1,2})[.\s]+(\d{1,2})[.\s]+(\d{4})', raw)
        if m: return f"{m.group(3)}-{m.group(2).zfill(2)}-{m.group(1).zfill(2)}"
        m = re.search(r'(\d{1,2})[.\s]+([a-z]{3})[.\s]+(\d{4})', raw, re.I)
        if m and m.group(2).lower() in mm: return f"{m.group(3)}-{mm[m.group(2).lower()]}-{m.group(1).zfill(2)}"
        m = re.search(r'([A-Za-z]{3,9})\s+(\d{1,2})[,.]?\s+(\d{4})', raw)
        if m and m.group(1).lower()[:3] in mm: return f"{m.group(3)}-{mm[m.group(1).lower()[:3]]}-{m.group(2).zfill(2)}"
        return datetime.now().strftime("%Y-%m-%d")

    def first_match(patterns, text):
        for pat in patterns:
            m = re.search(pat, text, re.IGNORECASE)
            if m:
                v = m.group(1).strip()
                if v: return v
        return ""

    # ---- ŠTEVILKA RAČUNA ----
    stevilka = first_match([
        r'(?:Številka\s+ra[cč]una\s*:\s*|Številka\s+dokumenta\s*:\s*)([A-Z0-9][A-Z0-9\-_/\.]{1,30})',
        r'(?:Invoice\s+#\s*|Invoice\s+No\.?\s*:?\s*)([A-Z0-9][\w\-]{1,30})',
        r'(?:Interna\s+številka\s+dok\.\s*:\s*)([A-Z0-9][\w\-]{1,20})',
        r'(?:RA[CČ]UN\s+ŠT\.|Ra[cč]un\s+(?:št\.|#))\s*:?\s*([A-Z0-9][\w\-/\.]{1,30})',
        r'(?<![a-zA-Z])(?:Številka|Stevilka)\s*:\s*([A-Z0-9][\w/\-\.]{1,20})',
        r'ORDER NUMBER\s*[\n\r]*\s*#?([A-Z0-9]+)', # Sufio / Fanatec
        r'INVOICE:\s*[\n\r]*.*?\b([A-Z][0-9]{6,10})\b', # Sufio / Fanatec
        r'RAČUN\s+([0-9]+/[0-9]+)',  # BM Racun
        r'RA\s*UN[^\d]+([1-9][A-Z0-9\-_/\.]{5,20})',  # Tuli
        r'Interna\s+številka\s+([\w\-]{3,25})',
        r'Št\.\s*ra[cč]una\s*(?:Številka\s+kupca)?.*?\n.*?\b(\d+-\d+-\d+)\b', # Conrad oblika s tabelo pod "Račun"
        r'(?:Vaša\s+oznaka.*?Št\.\s+računa.*?)(\d[\w\-/\.]{3,20})(?:\s+\d)',  # Conrad stara oblika
    ], pdf_text)
    if not stevilka or len(stevilka) < 2: stevilka = "Neznano"

    # ---- DATUM RAČUNA ----
    datum_raw = first_match([
        r'Datum\s+ra[cč]una/dostave.*?\n.*?\b(\d{1,2}\.\d{1,2}\.\d{4})\b', # Conrad oblika s tabelo
        r'(?:Datum\s+(?:in\s+ura\s+)?ra[cč]una|Datum\s+dokumenta)\s*[:\s,]+\s*(\d{1,2}[.\s]+\d{1,2}[.\s]+\d{4})',
        r'ISSUE DATE:\s*[\n\r]*\s*([A-Za-z]+\s+\d{1,2}[,.]?\s+\d{4})', # Sufio / Fanatec
        r'(?:Datum\s+izdaje)\s*[:\s]+\n?(\d{1,2}\.\s*\d{1,2}\.\s*\d{4})',
        r'(?:Invoice\s+Date)\s+[A-Z]?\u2014?([A-Za-z]{2,9}\s+\d{1,2}[,.]?\s+\d{4})',  # Artlist
        r'(?:Datum:\s*)(\d{1,2}\.\d{1,2}\.\d{4})',
        # Google oblika: "31. jan. 2026"
        r'(\d{1,2}\.\s+[a-z]{3}\.\s+\d{4})',
        # Tuli: "Datum ra una: 12.01.2026 ob"
        r'Datum\s+ra\s*una:\s*(\d{1,2}\.\d{2}\.\d{4})',
        # IKEA/BM fallback: DD. M. YYYY ali DD.MM.YYYY v dokumentu
        r'(\d{2}\.\d{2}\.\d{4})\s+(?:\d{2}:\d{2})',
        r',\s*(\d{1,2}\.\d{1,2}\.\d{4})',  # BM: Celje, 26.01.2026
    ], pdf_text)
    datum_izdaje = pd(datum_raw)

    # ---- DATUM ZAPADLOSTI ----
    zap_raw = first_match([
        r'(?:Zapadlost\s+ra[cč]una|Zapadlost|Datum\s+valute|VALUTA)\s*[:\s]+(\d{1,2}[.\s]+\d{1,2}[.\s]+\d{4})',
        r'(?:Zapadlost:)\s*(\d{1,2}\.\d{1,2}\.\d{4})',
    ], pdf_text)
    datum_zapadlosti = pd(zap_raw) if zap_raw else datum_izdaje

    # ---- SKUPNI ZNESEK ----
    total_val = 0.0
    for pat in [
        r'(?:Za\s+pla[cč]ilo\s+EUR\s*:|ZA\s+PLA[CČ]ILO[:\s]*EUR)[:\s€]*([0-9]+[,\.][0-9]{2})',
        r'(?:Za\s+pla[cč]ilo\s+EUR\s*:?)\s+([0-9]+[,\.][0-9]{2})',
        r'Skupaj\s+za\s+pla[cč]ilo\s+EUR\s+([0-9]+[,\.][0-9]{2})',
        r'(?:Skupaj\s+za\s+pla[cč]ilo)[:\s€]*([0-9]+[,\.][0-9]{2})',
        r'(?:Skupni\s+znesek(?:\s+v\s+valuti\s+EUR)?)[:\s€]*([0-9]+[,\.][0-9]{2})',
        r'(?:Znesek\s+za\s+pla[cč]\s*ilo)[:\s€]*([0-9]+[,\.][0-9]{2})', # Conrad "plač ilo"
        r'(?:Pla[cč]ano|PLA.ANO)[:\s€]*([0-9]+[,\.][0-9]{2})\s+EUR',  # Temu/Tuli
        r'SKUPAJ\s+RA[^\s]*\s*UN\s+EUR\s+([0-9]+[,\.][0-9]{2})',  # Tuli encoding
        r'N\s+ZA\s+PLA[^\s]*\s*ILO\s+EUR\s+([0-9]+[,\.][0-9]{2})',  # Tuli encoding
        r'(?:Invoice\s+Amou[n\u2014\-]*t)[:\s€]*([0-9]+[,\.][0-9]{2})',
        r'(?:Total)[:\s]*([0-9]+[,\.][0-9]{2})\s*€',
        r'([0-9]+[,\.][0-9]{2})\s+Za\s+pla[cč]ilo\s+EUR',  # GMT
    ]:
        m = re.search(pat, pdf_text, re.IGNORECASE)
        if m:
            v = cn(m.group(1))
            if v > 0: total_val = v; break

    # Fallback: DDV rekapitulacija
    if total_val == 0:
        tbl = re.search(r'(?:Skupaj|Total)\s+[0-9,\.]+\s+[0-9,\.]+\s+([0-9]+[,\.][0-9]{2})', pdf_text, re.IGNORECASE)
        if tbl: total_val = cn(tbl.group(1))
    # Fallback2: max znesek z EUR simbolom v dokumentu
    if total_val == 0:
        all_eur = re.findall(r'([0-9]+[,\.][0-9]{2})\s*(?:EUR|€)', pdf_text)
        if all_eur:
            total_val = max(cn(x) for x in all_eur)

    # ---- OSNOVA (BREZ DDV) ----
    net_val = 0.0
    for pat in [
        r'(?:Neto\s+znesek|Znesek\s+brez\s+DDV|VREDNOST\s+brez\s+DDV|Skupaj\s+brez\s+DDV)\s*[:\s€]*([0-9]+[,\.][0-9]{2})',
        r'DDV\s+22[,\.]0+%\s+od\s+osnove\s+([0-9]+[,\.][0-9]{2})',
        r'(?:Osnova\s+za\s+DDV|Osnova\s+DDV)\s*[:\s]*([0-9]+[,\.][0-9]{2})',
        r'Stopnja\s+22[,\.]?0?\s*%\s+([0-9]+[,\.][0-9]{2})',
        r'(?:D[01]\s+-[^0-9]+(?:22|0)[,\.]?0*%)\s+([0-9]+[,\.][0-9]{2})',
        # Shopster: DDV rekapitulacija tabela "22 % 36,60 8,05 44,65"
        r'22\s*%\s+([0-9]+[,\.][0-9]{2})\s+[0-9]+[,\.][0-9]{2}\s+[0-9]+[,\.][0-9]{2}',
        # GMT: Osnova DDV v tabeli DAVČNE STOPNJE
        r'22%\s+([0-9]+[,\.][0-9]{2})\s+[0-9]+[,\.][0-9]{2}\s+[0-9]+[,\.][0-9]{2}',
    ]:
        m = re.search(pat, pdf_text, re.IGNORECASE)
        if m:
            v = cn(m.group(1))
            if v > 0: net_val = v; break

    # ---- DDV ZNESEK ----
    vat_val = 0.0
    for pat in [
        r'DDV\s+\(?22[,\.]0?%?\)?\s+([0-9]+[,\.][0-9]{2})',
        r'DDV\s+22[,\.]\d+%?\s+(?:od\s+osnove\s+[0-9,\.]+\s+EUR\s+)?([0-9]+[,\.][0-9]{2})',
        r'(?:Znesek\s+davka|Znesek\s+DDV)\s+([0-9]+[,\.][0-9]{2})',
        r'22\s*%\s+[0-9,\.]+\s+([0-9]+[,\.][0-9]{2})',
    ]:
        m = re.search(pat, pdf_text, re.IGNORECASE)
        if m:
            v = cn(m.group(1))
            if v > 0: vat_val = v; break

    # Posebni primeri: 0% DDV (reverse charge - Google Ads, Artlist)
    explicit_zero_vat = bool(re.search(r'DDV\s*\(0%\)|0%.*reverse\s+charge|VAT\s+Exemption|self.account.*VAT', pdf_text, re.I))

    # Izračun in uskladitev zneskov
    if total_val > 0 and net_val > 0:
        vat_val = round(total_val - net_val, 2)
    elif total_val > 0 and net_val == 0 and vat_val == 0:
        if explicit_zero_vat:
            net_val = total_val  # 0% DDV
        else:
            net_val = round(total_val / 1.22, 2); vat_val = round(total_val - net_val, 2)
    elif total_val > 0 and net_val == 0 and vat_val > 0:
        net_val = round(total_val - vat_val, 2)
    elif total_val == 0 and net_val > 0:
        total_val = round(net_val + vat_val, 2)

    # ---- DOBAVITELJ (PARTNER) ----
    # Poišči ID za DDV dobavitelja (izključi kupčevo SI11648236)
    partner_naziv = "Neznan dobavitelj"
    partner_davcna = ""
    partner_drzava = "Slovenija"

    # Znani tuji dobavitelji
    if re.search(r'google\s+ireland|google\s+ads', pdf_text, re.I):
        partner_naziv = "Google Ireland Limited"; partner_davcna = "IE6388047V"; partner_drzava = "Irska"
    elif re.search(r'artlist', pdf_text, re.I):
        partner_naziv = "Artlist UK Ltd"; partner_davcna = "GB770403942"; partner_drzava = "Združeno kraljestvo"
    elif re.search(r'PO-\d{3}-\d+|temu\.com', pdf_text, re.I):
        partner_naziv = "Temu"; partner_drzava = "Kitajska"
    elif re.search(r'aliexpress', pdf_text, re.I):
        partner_naziv = "Aliexpress"; partner_drzava = "Kitajska"
    else:
        # SLO dobavitelji: ID za DDV iz prve SI... številke ki ni kupčeva
        vat_matches = re.findall(r'(?:ID\s+(?:za|za:)\s+DDV|ID\s+DDV|Za\s+DDV)[:\s]+SI(\d{8})', pdf_text, re.I)
        vat_matches += re.findall(r'VAT\s+Registration\s+number\s*:\s*([A-Z0-9]+)', pdf_text, re.I)
        for v in vat_matches:
            if v != '11648236':  # Izključi kupčevo DAV
                partner_davcna = v; break

        # Posebni primeri dobaviteljev na podlagi celotnega besedila
        tl = pdf_text.lower()
        if 'mimovrste' in tl: partner_naziv = "Mimovrste d.o.o."
        elif 'shoppster' in tl: partner_naziv = "Shoppster d.o.o."
        elif 'ikea' in tl: partner_naziv = "IKEA Slovenija d.o.o."
        elif 'bauhaus' in tl: partner_naziv = "BAUHAUS d.o.o."
        elif 'conrad' in tl: partner_naziv = "Conrad Electronic d.o.o."
        elif 'b&m' in tl or 'eloksiranje' in tl: partner_naziv = "ELOKSIRANJE B&M d.o.o."
        elif 'gmt' in tl: partner_naziv = "GMT d.o.o."
        
        if partner_naziv == "Neznan dobavitelj":
            # Ime dobavitelja: prve vrstice dokumenta (pred kupcem)
            lines = [l.strip() for l in pdf_text.split('\n') if l.strip()]
            buyer_keywords = ['miha kadiš', 'sim 83', 'simulatorji', 'dobja vas 253', 'kadiš s.p', 'kupec',
                              'stran 1', 'stran 2', 'stran\xa0', 'st.kopije', 'št.kopije', 'račun za gosta',
                              'dobavitelj:', 'račun', 'sklicna', 'konstantni', 'ra\u010dun', 's.p. celje', 'ravne na koro',
                              'invoice supplier', 'client', 'prejemnik', 'izdajatelj']
            company_keywords = ['d.o.o', 'd.d.', 's.p.', 'k.d.', 'ltd', 'limited', 'gmbh', 'inc']
            skip_starts = ('Tel', 'Fax', 'E-po', 'info@', 'www.', 'Stran', 'ZOI', 'EOR', 'IBAN', 'Mat', 'ID', 'Kontaktni', 'Datum', 'Valuta', 'Issue Date', 'Order Number', 'Invoice:')
            for line in lines[:25]:
                ll = line.lower()
                if any(k in ll for k in buyer_keywords): continue
                if len(line) < 4: continue
                if re.match(r'^[\d\s\.\-:/]+$', line): continue
                if line.startswith(skip_starts): continue
                
                if any(k in ll for k in company_keywords):
                    partner_naziv = line
                    break
                if partner_davcna and len(line) > 5 and not any(k in ll for k in ['slovenija', 'ljubljana', 'celje']):
                    partner_naziv = line
                    break

        # Identifikacija države iz davčne številke
        if partner_davcna:
            prefiks = partner_davcna[:2].upper()
            drzave_map = {'SI': 'Slovenija', 'AT': 'Avstrija', 'DE': 'Nemčija', 'IT': 'Italija', 'HR': 'Hrvaška', 'HU': 'Madžarska', 'GB': 'Združeno kraljestvo', 'IE': 'Irska', 'NL': 'Nizozemska', 'FR': 'Francija', 'ES': 'Španija', 'BE': 'Belgija', 'CZ': 'Češka', 'PL': 'Poljska'}
            if prefiks in drzave_map:
                partner_drzava = drzave_map[prefiks]

    stopnja_ddv = 0 if vat_val == 0 else 22
    
    # Hevristični poizkus branja postavk računa (Količina * Cena = Skupaj)
    postavke = []
    try:
        for line in pdf_text.split('\n'):
            line = line.strip()
            if len(line) < 10: continue
            # Preskoči vrstice ki vsebujejo ključne besede za rekapitulacijo
            if re.search(r'(skupaj|ddv|pla[cč]ilo|znesek|osnova|popust|zapadlost|valuta|stran|iban|dobropis|podpis)', line, re.I): continue

            # --- OBLIKA F: Minimax / E-računi s polno davčno tabelo ---
            # Primer: 001 Delovna ura (60 min) 1,00 kos 35,00 0,00 D1 22,0 35,00
            m_full = re.search(
                r'^(?:\d{3,5}\s+)?(.+?)\s+(\d+[,\.]\d{2})\s+(?:kos|kg|m|kom|ur|h|uro|ura|kosa|kosi|kosov|lit|l|par|kpl|pak|pc|pcs|stk|pz|x|kom\.?)\s+([\d]+[,\.]\d{2,4})\s+([\d]+[,\.]\d{2,4})\s+(?:[A-Z0-9]{1,3})\s+([\d]+[,\.]\d{1,2})\s+([\d]+[,\.]\d{2,4})\s*$',
                line, re.I)
            if m_full:
                opis = m_full.group(1).strip()
                kol = cn(m_full.group(2))
                cena = cn(m_full.group(3))
                rabat = cn(m_full.group(4))
                ddv_item = cn(m_full.group(5))
                sk = cn(m_full.group(6))
                if kol > 0 and cena > 0:
                    postavke.append({
                        "opis": opis,
                        "kolicina": kol,
                        "cena_enote": sk / kol if kol > 0 else cena,
                        "stopnja_ddv": ddv_item,
                        "znesek_skupaj": sk
                    })
                    continue

            # --- OBLIKA A: Conrad/Reichelt/Farnell ---
            # npr. "839605 Vijak s cilind. 1PAK K7 12,29 12,29 14,99 14,99"
            # Stolpci: (šifra) opis kol+EM (DDV_koda) cena_neto vrednost_neto cena_ddv vrednost_ddv
            m4 = re.search(
                r'^(?:\d{4,8}\s+)?(.+?)\s+(\d+)\s*(?:PAK|KOM|PC|PCS|KOS|STK|PZ|ST)\b.*?'
                r'([\d]+[,\.]\d{2,4})\s+([\d]+[,\.]\d{2,4})\s+([\d]+[,\.]\d{2,4})\s+([\d]+[,\.]\d{2,4})\s*$',
                line, re.I)
            if m4:
                opis = m4.group(1).strip().split('\t')[0].strip()
                kol = float(m4.group(2))
                # Zadnja 2 stolpca sta cena z DDV in vrednost z DDV
                cena_ddv = cn(m4.group(5))
                sk_ddv = cn(m4.group(6))
                if kol > 0 and cena_ddv > 0 and abs((kol * cena_ddv) - sk_ddv) <= max(0.10, sk_ddv * 0.01):
                    postavke.append({
                        "opis": opis,
                        "kolicina": kol,
                        "cena_enote": cena_ddv,
                        "stopnja_ddv": stopnja_ddv,
                        "znesek_skupaj": sk_ddv
                    })
                    continue

            # --- OBLIKA C: Conrad postavke brez količine (npr. Pavšal za prevoz) ---
            # "Pavšal za prevoz    4,92   4,92   6,00   6,00"
            m_no_qty = re.search(
                r'^(.+?)\s+([\d]+[,\.]\d{2,4})\s+([\d]+[,\.]\d{2,4})\s+([\d]+[,\.]\d{2,4})\s+([\d]+[,\.]\d{2,4})\s*$',
                line, re.I)
            if m_no_qty:
                opis = m_no_qty.group(1).strip()
                cena_ddv = cn(m_no_qty.group(4))
                sk_ddv = cn(m_no_qty.group(5))
                # Za postavko brez količine preverimo, ali sta cena in znesek enaka (količina = 1)
                if cena_ddv > 0 and abs(cena_ddv - sk_ddv) <= max(0.05, sk_ddv * 0.01):
                    postavke.append({
                        "opis": opis,
                        "kolicina": 1.0,
                        "cena_enote": cena_ddv,
                        "stopnja_ddv": stopnja_ddv,
                        "znesek_skupaj": sk_ddv
                    })
                    continue

            # --- OBLIKA D: GMT format ---
            # "11298216 SVEČKA ŽARILNA 4,00 KOM 23,85 35,00 22,00 62,01"
            # Stolpci: [šifra] Naziv Kol EM MPC_Cena Rabat DDV MPC_Vrednost
            m_gmt = re.search(
                r'^(?:[\w\-]{3,20}\s+)?(.+?)\s+(\d+[,\.]\d{2})\s*(?:KOM|KOS|KPL|L|KG|M|PZ|STK|PAR)\s+'
                r'([\d]+[,\.]\d{2,4})\s+([\d]+[,\.]\d{2})\s+([\d]+[,\.]\d{2})\s+([\d]+[,\.]\d{2})\s*$',
                line, re.I)
            if m_gmt:
                opis = m_gmt.group(1).strip()
                kol = cn(m_gmt.group(2))
                cena = cn(m_gmt.group(3)) # MPC cena pred popustom
                rabat = cn(m_gmt.group(4))
                ddv_item = cn(m_gmt.group(5))
                sk = cn(m_gmt.group(6))   # MPC Vrednost
                izracunano = (kol * cena) * (1 - rabat / 100)
                if kol > 0 and cena > 0 and abs(izracunano - sk) <= max(0.10, sk * 0.02):
                    postavke.append({
                        "opis": opis,
                        "kolicina": kol,
                        "cena_enote": round(sk / kol, 4) if kol > 0 else cena,
                        "stopnja_ddv": ddv_item,
                        "znesek_skupaj": sk
                    })
                    continue

            # --- OBLIKA B: Standardna tabela (opis kolicina [enota] cena skupaj) ---
            m = re.search(
                r'^(.+?)\s+(\d+[,\.]?\d*)\s*'
                r'(?:kos|kg|m|kom|ur|h|uro|ura|kosa|kosi|kosov|lit|l|par|kpl|pak|pc|pcs|stk|pz|x|kom\.?)\s*'
                r'([\d]+[,\.]\d{2,4})\s+([\d]+[,\.]\d{2,4})\s*$',
                line, re.I)
            if m:
                opis = m.group(1).strip()
                kol = cn(m.group(2))
                cena = cn(m.group(3))
                sk = cn(m.group(4))
                # Sanity check: Količina * Cena enote = Skupaj (+- 2%)
                if kol > 0 and cena > 0 and abs((kol * cena) - sk) <= max(0.05, sk * 0.02):
                    postavke.append({
                        "opis": opis,
                        "kolicina": kol,
                        "cena_enote": cena,
                        "stopnja_ddv": stopnja_ddv,
                        "znesek_skupaj": sk
                    })
                    continue

            # --- OBLIKA E: Sufio / Fanatec format ---
            # "ClubSport Button Cluster Pack SKU: CS_BCP 2 39.95 €79.90 €14.41"
            m_sufio = re.search(
                r'^(.+?)\s+(\d+)\s+([\d\.,]+)\s+[€$]?([\d\.,]+)\s+[€$]?([\d\.,]+)$',
                line, re.I)
            if m_sufio:
                opis = m_sufio.group(1).strip()
                kol = float(m_sufio.group(2))
                cena = cn(m_sufio.group(3))
                sk = cn(m_sufio.group(4))
                if kol > 0 and cena > 0 and abs((kol * cena) - sk) <= max(0.05, sk * 0.02):
                    postavke.append({
                        "opis": opis,
                        "kolicina": kol,
                        "cena_enote": cena,
                        "stopnja_ddv": stopnja_ddv,
                        "znesek_skupaj": sk
                    })
                    continue

            # --- OBLIKA G: Shoppster / Maloprodaja (opis EM kol cena [ddv%] [popust] skupaj) ---
            # "0709713 UGREEN DP na HDMI kabel KOM 2 12,90 22% 0 25,80"
            m_shop = re.search(
                r'^(?:\d{3,10}\s+)?(.+?)\s+(KOM|KOS|KG|L|M|KPL|PAK|PC|PCS|KOM\.?|KOSA|KOSI)\s+'
                r'(\d+[,\.]?\d*)\s+([\d]+[,\.]\d{2,4})\s+(?:(\d+(?:[,\.]\d+)?)\s*%\s+)?(?:(\d+(?:[,\.]\d+)?)\s+)?([\d]+[,\.]\d{2,4})\s*$',
                line, re.I)
            if m_shop:
                opis = m_shop.group(1).strip()
                em = m_shop.group(2)
                kol = cn(m_shop.group(3))
                cena = cn(m_shop.group(4))
                ddv_p = cn(m_shop.group(5)) if m_shop.group(5) else stopnja_ddv
                popust = cn(m_shop.group(6)) if m_shop.group(6) else 0.0
                sk = cn(m_shop.group(7))
                
                # Sanity check
                calc = kol * cena * (1 - popust / 100)
                if kol > 0 and cena > 0 and abs(calc - sk) <= max(0.10, sk * 0.02):
                    postavke.append({
                        "opis": opis,
                        "kolicina": kol,
                        "cena_enote": cena,
                        "stopnja_ddv": ddv_p,
                        "znesek_skupaj": sk,
                        "enota_mere": em.lower()
                    })
                    continue
    except Exception as e:
        print(f"Napaka pri razčlenjevanju postavk: {e}")

    # Prilagoditev: Ce so izluscene postavke brez DDV (njihova vsota je blizu net_val),
    # pretvorimo znesek_skupaj v bruto. Ce so cene ze bruto, pa cena_enote pretvorimo v neto (UI jo sam mnozi)!
    if postavke and stopnja_ddv > 0:
        sum_skupaj = sum(p["znesek_skupaj"] for p in postavke)
        if abs(sum_skupaj - net_val) < abs(sum_skupaj - total_val):
            # Cene so bile NETO -> znesek_skupaj pretvorimo v bruto
            for p in postavke:
                ddv_p = p.get("stopnja_ddv", stopnja_ddv)
                p["znesek_skupaj"] = round(p["znesek_skupaj"] * (1 + ddv_p / 100), 2)
        else:
            # Cene so bile BRUTO -> cena_enote pretvorimo v neto
            for p in postavke:
                ddv_p = p.get("stopnja_ddv", stopnja_ddv)
                p["cena_enote"] = round(p["cena_enote"] / (1 + ddv_p / 100), 4)

    # Pocisti opise: odstrani vodece stevilke vrstice (npr. "1 ", "001 ") in morebitni DDV%
    for p in postavke:
        opis = p["opis"].strip()
        opis = re.sub(r'^\d{1,5}\s+', '', opis)          # "1 Alu profil" -> "Alu profil"
        opis = re.sub(r'\s+\d{1,2}[,.]\d{2}\s*$', '', opis)  # trailing DDV% "22,00"
        p["opis"] = opis.strip()

    # Fallback na generično postavko, če heuristika ni našla nič pametnega
    if not postavke:
        postavke = [{
            "opis": f"Uvoz računa {stevilka}",
            "kolicina": 1,
            "cena_enote": net_val,
            "stopnja_ddv": stopnja_ddv,
            "znesek_skupaj": total_val,
        }]

    return {
        "stevilka": stevilka,
        "datum_izdaje": datum_izdaje,
        "datum_zapadlosti": datum_zapadlosti,
        "datum_storitve_od": datum_izdaje,
        "datum_storitve_do": datum_izdaje,
        "partner": {
            "naziv": partner_naziv,
            "davcna_stevilka": partner_davcna,
            "ulica": "", "postna_stevilka": "", "kraj": "",
            "drzava": partner_drzava,
            "zavezanec_za_ddv": bool(partner_davcna),
        },
        "znesek_skupaj": total_val,
        "znesek_brez_ddv": net_val,
        "znesek_ddv": vat_val,
        "valuta": "EUR",
        "tecaj": 1.0,
        "placan": False,
        "postavke": postavke
    }

def extract_temu_pdf(content):
    """Ohranjena za nazaj-kompatibilnost — kliče generični parser."""
    return extract_generic_pdf(content)

def _preveri_hrambo(datum_izdaje: str, tip: str) -> dict:
    """
    Faza 2 — ZDDV-1, čl. 85: Preveri če je listino še dovoljeno brisati.
    DDV evidence (izdani/prejeti računi, dobropisi): 10 let hramba.
    Ostale listine (izpiski, PN, plače): 5 let.
    Vrne: {'dovoljeno': bool, 'hramba_do': str, 'let': int, 'message': str}
    """
    from datetime import date
    DDV_TIPI = ['izdani_racuni', 'prejeti_racuni', 'dobropisi', 'prejeti_dobropisi']
    let = 10 if tip in DDV_TIPI else 5
    try:
        d = date.fromisoformat(str(datum_izdaje)[:10])
        hramba_do = d.replace(year=d.year + let)
        dovoljeno = date.today() >= hramba_do
        return {
            'dovoljeno': dovoljeno,
            'hramba_do': hramba_do.isoformat(),
            'let': let,
            'message': (
                f"Ta listina mora biti hranjena do {hramba_do.strftime('%d.%m.%Y')} "
                f"({let} let po ZDDV-1/SRS). "
                f"Za prisilno brisanje pošljite zahtevo z ?force=true."
            ) if not dovoljeno else ''
        }
    except Exception:
        return {'dovoljeno': True, 'hramba_do': '', 'let': 0, 'message': ''}

def generate_eslog_xml(inv, company, partner, items):
    import xml.etree.ElementTree as ET
    from xml.sax.saxutils import escape
    
    def parse_posta_kraj(pk):
        if not pk:
            return "", ""
        m = re.search(r'(\d{4})\s+(.+)', pk)
        if m:
            return m.group(1), m.group(2)
        return "", pk

    supplier_zip, supplier_city = parse_posta_kraj(company.get('posta_kraj', ''))
    customer_zip = partner.get('postna_stevilka', '')
    customer_city = partner.get('kraj', '')
    
    ET.register_namespace('', 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2')
    ET.register_namespace('cac', 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2')
    ET.register_namespace('cbc', 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2')
    
    root = ET.Element('{urn:oasis:names:specification:ubl:schema:xsd:Invoice-2}Invoice')
    
    customization_id = ET.SubElement(root, '{urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2}CustomizationID')
    customization_id.text = 'urn:cen.eu:en16931:2017#compliant#urn:epos.si:eslog:2.0'
    
    profile_id = ET.SubElement(root, '{urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2}ProfileID')
    profile_id.text = 'urn:fdc:peppol.eu:poacc:billing:01:1.0'
    
    doc_id = ET.SubElement(root, '{urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2}ID')
    doc_id.text = str(inv.get('stevilka', ''))
    
    issue_date = ET.SubElement(root, '{urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2}IssueDate')
    issue_date.text = str(inv.get('datum_izdaje', ''))
    
    due_date = ET.SubElement(root, '{urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2}DueDate')
    due_date.text = str(inv.get('datum_zapadlosti', ''))
    
    invoice_type = ET.SubElement(root, '{urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2}InvoiceTypeCode')
    invoice_type.text = '381' if inv.get('tip') in ['dobropis', 'dobropisi', 'prejeti_dobropisi'] else '380'
    
    currency = ET.SubElement(root, '{urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2}DocumentCurrencyCode')
    currency.text = 'EUR'
    
    if inv.get('datum_storitve_do') or inv.get('datum_storitve_od'):
        delivery = ET.SubElement(root, '{urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2}Delivery')
        actual_date = ET.SubElement(delivery, '{urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2}ActualDeliveryDate')
        actual_date.text = str(inv.get('datum_storitve_do') or inv.get('datum_storitve_od') or inv.get('datum_izdaje'))
    
    supplier_party = ET.SubElement(root, '{urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2}AccountingSupplierParty')
    party = ET.SubElement(supplier_party, '{urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2}Party')
    
    party_name = ET.SubElement(party, '{urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2}PartyName')
    name = ET.SubElement(party_name, '{urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2}Name')
    name.text = str(company.get('naziv', ''))
    
    postal_addr = ET.SubElement(party, '{urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2}PostalAddress')
    street = ET.SubElement(postal_addr, '{urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2}StreetName')
    street.text = str(company.get('ulica', ''))
    if supplier_zip:
        p_zone = ET.SubElement(postal_addr, '{urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2}PostalZone')
        p_zone.text = str(supplier_zip)
    city = ET.SubElement(postal_addr, '{urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2}CityName')
    city.text = str(supplier_city)
    country = ET.SubElement(postal_addr, '{urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2}Country')
    c_code = ET.SubElement(country, '{urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2}IdentificationCode')
    c_code.text = 'SI'
    
    supplier_vat = str(company.get('davcna_stevilka', '')).strip()
    if supplier_vat:
        vat_clean = re.sub(r'[^0-9]', '', supplier_vat)
        vat_formatted = f"SI{vat_clean}" if company.get('zavezanec_za_ddv') else vat_clean
        
        party_tax = ET.SubElement(party, '{urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2}PartyTaxScheme')
        company_id = ET.SubElement(party_tax, '{urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2}CompanyID')
        company_id.text = vat_formatted
        tax_scheme = ET.SubElement(party_tax, '{urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2}TaxScheme')
        tax_id = ET.SubElement(tax_scheme, '{urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2}ID')
        tax_id.text = 'VAT'
        
    party_legal = ET.SubElement(party, '{urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2}PartyLegalEntity')
    reg_name = ET.SubElement(party_legal, '{urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2}RegistrationName')
    reg_name.text = str(company.get('naziv', ''))
    
    customer_party = ET.SubElement(root, '{urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2}AccountingCustomerParty')
    c_party = ET.SubElement(customer_party, '{urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2}Party')
    
    c_party_name = ET.SubElement(c_party, '{urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2}PartyName')
    c_name = ET.SubElement(c_party_name, '{urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2}Name')
    c_name.text = str(partner.get('naziv', ''))
    
    c_postal_addr = ET.SubElement(c_party, '{urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2}PostalAddress')
    c_street = ET.SubElement(c_postal_addr, '{urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2}StreetName')
    c_street.text = str(partner.get('ulica', ''))
    if customer_zip:
        c_p_zone = ET.SubElement(c_postal_addr, '{urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2}PostalZone')
        c_p_zone.text = str(customer_zip)
    c_city = ET.SubElement(c_postal_addr, '{urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2}CityName')
    c_city.text = str(customer_city)
    c_country = ET.SubElement(c_postal_addr, '{urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2}Country')
    c_c_code = ET.SubElement(c_country, '{urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2}IdentificationCode')
    c_c_code.text = str(partner.get('drzava', 'SI')) or 'SI'
    
    customer_vat = str(partner.get('davcna_stevilka', '')).strip()
    if customer_vat:
        c_vat_clean = re.sub(r'[^0-9]', '', customer_vat)
        c_vat_formatted = f"SI{c_vat_clean}" if partner.get('zavezanec_za_ddv') else c_vat_clean
        
        c_party_tax = ET.SubElement(c_party, '{urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2}PartyTaxScheme')
        c_company_id = ET.SubElement(c_party_tax, '{urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2}CompanyID')
        c_company_id.text = c_vat_formatted
        c_tax_scheme = ET.SubElement(c_party_tax, '{urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2}TaxScheme')
        c_tax_id = ET.SubElement(c_tax_scheme, '{urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2}ID')
        c_tax_id.text = 'VAT'
        
    c_party_legal = ET.SubElement(c_party, '{urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2}PartyLegalEntity')
    c_reg_name = ET.SubElement(c_party_legal, '{urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2}RegistrationName')
    c_reg_name.text = str(partner.get('naziv', ''))
    
    pm = ET.SubElement(root, '{urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2}PaymentMeans')
    pm_code = ET.SubElement(pm, '{urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2}PaymentMeansCode')
    pm_code.text = '30'
    
    p_id = ET.SubElement(pm, '{urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2}PaymentID')
    p_id.text = str(inv.get('sklic', '')) or f"SI00 {inv.get('stevilka')}"
    
    if company.get('trr'):
        payee_acc = ET.SubElement(pm, '{urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2}PayeeFinancialAccount')
        acc_id = ET.SubElement(payee_acc, '{urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2}ID')
        acc_id.text = re.sub(r'[^a-zA-Z0-9]', '', str(company.get('trr', '')))
        
        if company.get('banka'):
            branch = ET.SubElement(payee_acc, '{urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2}FinancialInstitutionBranch')
            branch_name = ET.SubElement(branch, '{urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2}Name')
            branch_name.text = str(company.get('banka'))
            
    vat_groups = {}
    for item in items:
        rate = item.get('stopnja_ddv', 22.0)
        qty = item.get('kolicina', 1.0)
        price = item.get('cena_enote', 0.0)
        discount = item.get('popust', 0.0)
        
        line_base = qty * price * (1 - discount / 100)
        line_vat = line_base * (rate / 100)
        
        if rate not in vat_groups:
            vat_groups[rate] = {'base': 0.0, 'vat': 0.0}
        vat_groups[rate]['base'] += line_base
        vat_groups[rate]['vat'] += line_vat

    total_vat = sum(g['vat'] for g in vat_groups.values())
    
    tax_total = ET.SubElement(root, '{urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2}TaxTotal')
    t_amount = ET.SubElement(tax_total, '{urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2}TaxAmount')
    t_amount.set('currencyID', 'EUR')
    t_amount.text = f"{total_vat:.2f}"
    
    for rate, g in vat_groups.items():
        subtotal = ET.SubElement(tax_total, '{urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2}TaxSubtotal')
        taxable_amt = ET.SubElement(subtotal, '{urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2}TaxableAmount')
        taxable_amt.set('currencyID', 'EUR')
        taxable_amt.text = f"{g['base']:.2f}"
        
        sub_tax_amt = ET.SubElement(subtotal, '{urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2}TaxAmount')
        sub_tax_amt.set('currencyID', 'EUR')
        sub_tax_amt.text = f"{g['vat']:.2f}"
        
        tax_category = ET.SubElement(subtotal, '{urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2}TaxCategory')
        tc_id = ET.SubElement(tax_category, '{urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2}ID')
        tc_id.text = 'S'
        tc_percent = ET.SubElement(tax_category, '{urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2}Percent')
        tc_percent.text = f"{rate:.1f}"
        
        tc_scheme = ET.SubElement(tax_category, '{urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2}TaxScheme')
        tcs_id = ET.SubElement(tc_scheme, '{urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2}ID')
        tcs_id.text = 'VAT'
        
    net_total = sum(g['base'] for g in vat_groups.values())
    gross_total = net_total + total_vat
    
    monetary_total = ET.SubElement(root, '{urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2}LegalMonetaryTotal')
    
    line_ext = ET.SubElement(monetary_total, '{urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2}LineExtensionAmount')
    line_ext.set('currencyID', 'EUR')
    line_ext.text = f"{net_total:.2f}"
    
    tax_excl = ET.SubElement(monetary_total, '{urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2}TaxExclusiveAmount')
    tax_excl.set('currencyID', 'EUR')
    tax_excl.text = f"{net_total:.2f}"
    
    tax_incl = ET.SubElement(monetary_total, '{urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2}TaxInclusiveAmount')
    tax_incl.set('currencyID', 'EUR')
    tax_incl.text = f"{gross_total:.2f}"
    
    payable = ET.SubElement(monetary_total, '{urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2}PayableAmount')
    payable.set('currencyID', 'EUR')
    payable.text = f"{gross_total:.2f}"
    
    for idx, item in enumerate(items, 1):
        line = ET.SubElement(root, '{urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2}InvoiceLine')
        
        line_id = ET.SubElement(line, '{urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2}ID')
        line_id.text = str(idx)
        
        qty = item.get('kolicina', 1.0)
        invoiced_qty = ET.SubElement(line, '{urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2}InvoicedQuantity')
        invoiced_qty.set('unitCode', 'H87')
        invoiced_qty.text = f"{qty:.3f}"
        
        price = item.get('cena_enote', 0.0)
        discount = item.get('popust', 0.0)
        line_base = qty * price * (1 - discount / 100)
        
        line_ext_amt = ET.SubElement(line, '{urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2}LineExtensionAmount')
        line_ext_amt.set('currencyID', 'EUR')
        line_ext_amt.text = f"{line_base:.2f}"
        
        l_item = ET.SubElement(line, '{urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2}Item')
        l_item_name = ET.SubElement(l_item, '{urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2}Name')
        l_item_name.text = str(item.get('opis', ''))
        
        class_tax = ET.SubElement(l_item, '{urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2}ClassifiedTaxCategory')
        ct_id = ET.SubElement(class_tax, '{urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2}ID')
        ct_id.text = 'S'
        ct_pct = ET.SubElement(class_tax, '{urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2}Percent')
        ct_pct.text = f"{item.get('stopnja_ddv', 22.0):.1f}"
        
        ct_scheme = ET.SubElement(class_tax, '{urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2}TaxScheme')
        cts_id = ET.SubElement(ct_scheme, '{urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2}ID')
        cts_id.text = 'VAT'
        
        l_price = ET.SubElement(line, '{urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2}Price')
        l_price_amt = ET.SubElement(l_price, '{urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2}PriceAmount')
        l_price_amt.set('currencyID', 'EUR')
        l_price_amt.text = f"{price:.4f}"
        
        if discount > 0:
            allowance = ET.SubElement(line, '{urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2}AllowanceCharge')
            chg_indicator = ET.SubElement(allowance, '{urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2}ChargeIndicator')
            chg_indicator.text = 'false'
            
            allowance_amt = ET.SubElement(allowance, '{urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2}Amount')
            allowance_amt.set('currencyID', 'EUR')
            allowance_amt.text = f"{(qty * price * discount / 100):.2f}"
            
            base_amt = ET.SubElement(allowance, '{urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2}BaseAmount')
            base_amt.set('currencyID', 'EUR')
            base_amt.text = f"{(qty * price):.2f}"
            
    xml_str = ET.tostring(root, encoding='utf-8')
    return b'<?xml version="1.0" encoding="UTF-8"?>\n' + xml_str

def calculate_aop(cursor, leto, aop_code, cache, shema_dict, visited=None):
    if aop_code in cache:
        return cache[aop_code]
    
    if visited is None:
        visited = set()
    
    if aop_code in visited:
        return 0.0, {} # Circular reference - stop recursion
    
    visited.add(aop_code)
    
    row = shema_dict.get(aop_code)
    if not row:
        return 0.0, {}
    
    formula = row['formula']
    if not formula:
        return 0.0, {}
    
    total = 0.0
    breakdown = {} # { konto_prefix: value }
    
    # Split by + and - but keep the signs
    tokens = re.findall(r'[+-]?[^+-]+', formula)
    
    for token in tokens:
        token = token.strip()
        if not token: continue
        
        sign = 1.0
        if token.startswith('-'):
            sign = -1.0
            token = token[1:].strip()
        elif token.startswith('+'):
            token = token[1:].strip()
        
        if not token: continue
        
        if token.startswith('@'):
            # Reference to another AOP
            ref_aop = token[1:].strip()
            # Pass a COPY of visited to allow siblings to visit the same nodes
            ref_val, ref_breakdown = calculate_aop(cursor, leto, ref_aop, cache, shema_dict, visited.copy())
            total += sign * ref_val
            # Merge breakdown
            for k, v in ref_breakdown.items():
                breakdown[k] = breakdown.get(k, 0.0) + (sign * v)
        else:
            # Account number prefix
            konto_prefix = token
            cursor.execute("""
                SELECT p.konto, SUM(znesek_v_breme) as b, SUM(znesek_v_dobro) as d 
                FROM temeljnice_postavke p
                JOIN temeljnice t ON p.temeljnica_id = t.id
                WHERE t.poslovno_leto = ? AND p.konto LIKE ?
                GROUP BY p.konto
            """, (leto, f"{konto_prefix}%"))
            rows = cursor.fetchall()
            
            for r in rows:
                konto_full = r['konto']
                b = r['b'] or 0.0
                d = r['d'] or 0.0
                
                # Heuristic for active/passive accounts based on first digit of the prefix
                if konto_prefix[0] in ['0', '1', '4', '5', '6', '8']:
                    val = b - d
                else:
                    val = d - b
                
                total += sign * val
                breakdown[konto_full] = breakdown.get(konto_full, 0.0) + (sign * val)
            
    cache[aop_code] = (total, breakdown)
    return total, breakdown

def extract_data_from_sepa_xml(content, filename=None):
    """Parses ISO 20022 Camt.053 SEPA XML bank statement"""
    root = ET.fromstring(content)
    # Handle namespaces dynamically
    ns_match = re.match(r'\{(.*)\}', root.tag)
    ns_uri = ns_match.group(1) if ns_match else ""
    ns = {'n': ns_uri} if ns_uri else {}
    
    def q(path):
        """Helper to prefix path with namespace if present"""
        if not ns_uri: return path.replace('n:', '')
        return path
        
    def find_val(el, path):
        found = el.find(q(path), ns)
        return found.text if found is not None else ""

    data = {"transactions": []}
    
    stmt = root.find(".//" + q("n:Stmt"), ns)
    if stmt is None: return None # Not a valid statement
    
    # Statement Metadata
    stmt_id = find_val(stmt, "n:Id")
    seq_nb = find_val(stmt, "n:LglSeqNb") or find_val(stmt, "n:ElctrncSeqNb")
    
    final_num = seq_nb if seq_nb else stmt_id
    
    # Fallback to filename if ID is too long/technical or unknown
    if filename and (not final_num or len(final_num) > 10 or final_num == "UNKNOWN"):
        num_match = re.search(r'^(\d+)', filename)
        if num_match: final_num = num_match.group(1)
        
    data['statement_number'] = final_num
    
    # Balances and Date
    data['statement_date'] = ""
    for bal in stmt.findall(q("n:Bal"), ns):
        tp_node = bal.find(q("n:Tp/n:CdOrPrtry/n:Cd"), ns)
        amt = find_val(bal, "n:Amt")
        dt_val = find_val(bal, "n:Dt/n:Dt") or find_val(bal, "n:Dt/n:DtTm")
        
        if tp_node is not None and amt:
            tp = tp_node.text
            if tp == 'OPBD': data['opening_balance'] = float(amt)
            if tp == 'CLBD': 
                data['closing_balance'] = float(amt)
                if dt_val: data['statement_date'] = dt_val[:10]

    if not data['statement_date']:
        cre_date = find_val(stmt, "n:CreDtTm")
        data['statement_date'] = cre_date[:10] if cre_date else ""
            
    # Transactions (Entries)
    for ntry in stmt.findall(q("n:Ntry"), ns):
        val = find_val(ntry, "n:Amt")
        if not val: continue
        amt = float(val)
        if amt == 0: continue
        
        ind = find_val(ntry, "n:CdtDbtInd")
        tp = "dobro" if ind == "CRDT" else "breme"
        
        # Details
        tx_dtls = ntry.find(q("n:NtryDtls/n:TxDtls"), ns)
        desc = ""
        partner = "Neznan"
        
        if tx_dtls is not None:
            desc = find_val(tx_dtls, "n:RmtInf/n:Ustrd")
            # Partner depends on direction
            rltd = tx_dtls.find(q("n:RltdPties"), ns)
            if rltd is not None:
                p_path = q("n:Dbtr/n:Nm") if ind == "CRDT" else q("n:Cdtr/n:Nm")
                p_node = rltd.find(p_path, ns)
                if p_node is not None: partner = p_node.text

        data['transactions'].append({
            'amount': amt,
            'type': tp,
            'code': "PMNT",
            'description': desc,
            'partner': partner,
            'raw_description': desc
        })
        
    return data

def _enrich_izpisek_data(raw_data):
    """Common logic for partner matching and enrichment for all statement formats"""
    postavke = []
    partner_names = []
    
    conn = database.get_db()
    cursor = conn.cursor()
    
    def get_core_name(name):
        if not name: return ""
        cleaned = name.upper().replace(",", " ").replace(".", " ").replace("-", " ")
        suffixes = ["D O O", "S P", "D D", "D N O", "K D", "Z O O", "V D"]
        for s in suffixes:
            cleaned = cleaned.replace(f" {s} ", " ")
            if cleaned.endswith(f" {s}"): cleaned = cleaned[:-len(s)-1]
            if cleaned.startswith(f"{s} "): cleaned = cleaned[len(s)+1:]
        parts = [p.strip() for p in cleaned.split() if len(p.strip()) > 2]
        return parts[0] if parts else cleaned.strip()

    cursor.execute("SELECT id, naziv, drzava FROM partnerji")
    all_partners = [{"id": r["id"], "naziv": r["naziv"], "drzava": r["drzava"], "core": get_core_name(r["naziv"])} for r in cursor.fetchall()]
    
    for tx in raw_data['transactions']:
        partner_id = None
        search_text = f"{(tx.get('partner') or '').upper()} {(tx.get('description') or '').upper()}"
        matched_naziv = ""
        matched_drzava = ""
        for p in all_partners:
            if p["core"] and p["core"] in search_text:
                partner_id = p["id"]
                matched_naziv = p["naziv"].upper()
                matched_drzava = p.get("drzava") or ""
                break
        
        # Predlagaj konto glede na tip
        partner_name = tx.get('partner') or ''
        partner_upper = partner_name.upper()
        
        # Check if NLB / bank fee
        is_nlb = "NOVA LJUBLJANSKA BANKA" in partner_upper or "NLB" in partner_upper or "PROVIZIJA" in search_text or "NADOMESTILO" in search_text
        
        # Check if foreign (Tujina)
        import re
        tuj_regex = r'\b(GMBH|INC|LTD|LIMITED|LLC|AG|SA|SPA|BV|NV|SRL|PLC|AB|OY|AS|APS)\b'
        is_tujina = bool(re.search(tuj_regex, partner_upper)) or bool(re.search(tuj_regex, matched_naziv))
        
        if matched_drzava and matched_drzava.strip().lower() not in ["slovenija", "slovenia", "si"]:
            is_tujina = True
            
        konto = ""
        if is_nlb:
            konto = "419"
        elif tx['type'] == 'dobro':
            konto = "121" if is_tujina else "120"
        elif tx['type'] == 'breme':
            konto = "221" if is_tujina else "220"
        
        postavke.append({
            "tip_prometa": tx['type'],
            "partner_id": partner_id,
            "partner_naziv": tx.get('partner', 'Neznan'),
            "namen": tx.get('description', ''),
            "znesek": tx['amount'],
            "koda_namena": tx.get('code', 'PMNT'),
            "konto": konto
        })
        partner_names.append(tx.get('partner', 'Neznan'))
    
    conn.close()
    
    return {
        "datum": raw_data['statement_date'],
        "stevilka_izpiska": raw_data['statement_number'],
        "zacetno_stanje": raw_data.get('opening_balance', 0),
        "koncno_stanje": raw_data.get('closing_balance', 0),
        "kontrolna_vsota": sum([p['znesek'] * (1 if p['tip_prometa']=='dobro' else -1) for p in postavke]),
        "vsota_prilivov": sum([p['znesek'] for p in postavke if p['tip_prometa']=='dobro']),
        "vsota_odlivov": sum([p['znesek'] for p in postavke if p['tip_prometa']=='breme']),
        "postavke": postavke,
        "partner_names": partner_names
    }

def _parse_single_pdf_content(content):
    # Ta funkcija se zdaj ne uporablja več direktno v parse_izpisek, 
    # ampak jo pustimo za nazaj ali spremenimo v klic refaktorirane logike če je treba.
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        tmp.write(content)
        tmp_path = tmp.name
    try:
        raw_data = extract_data_from_pdf(tmp_path)
    finally:
        if os.path.exists(tmp_path): os.remove(tmp_path)
