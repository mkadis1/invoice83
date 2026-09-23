from schemas import *
import os
import sys
# Zagotovi, da je trenutna mapa v pathu za uvoze na Railwayu
sys.path.append(os.getcwd())
try:
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
except AttributeError:
    pass # In case stdout/stderr doesn't support reconfigure (e.g. non-standard file-like object)

import base64
import tempfile
import zipfile
import xml.etree.ElementTree as ET
import re
import shutil
import uuid
import traceback
from pathlib import Path
from fastapi import FastAPI, HTTPException, UploadFile, File, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import List, Optional
import database
import knjizenje
import uvicorn
import requests
from datetime import datetime
from zoneinfo import ZoneInfo
from PIL import Image
import pytesseract
import pdfplumber

# Pot do Tesseracta (nastavi samo na Windows)
if os.name == 'nt':
    pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
from bs4 import BeautifulSoup
import pdf_parser
from pdf_parser import extract_data_from_pdf
try:
    import invoice_ocr
except Exception:
    import traceback
    import sys
    sys.stderr.write("CRITICAL: Failed to import invoice_ocr\n")
    traceback.print_exc(file=sys.stderr)
    sys.stderr.flush()
    # Still raise it to stop the server
    raise
import io
from email.mime.application import MIMEApplication
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import smtplib
import threading
import time

app = FastAPI(title="Invoice83 API")
from routers import partners
app.include_router(partners.router)
from routers import items
app.include_router(items.router)
from routers import documents
app.include_router(documents.router)
from routers import statements
app.include_router(statements.router)
from routers import bookkeeping
app.include_router(bookkeeping.router)
from routers import payroll_travel
app.include_router(payroll_travel.router)
from routers import assets
app.include_router(assets.router)
from routers import settings
app.include_router(settings.router)


# --- HEARTBEAT WATCHDOG ---
# Če teče kot strežnik (SERVER_MODE=1), watchdog ne ugasne procesa
if os.environ.get("SERVER_MODE") != "1":
    _last_heartbeat = time.time()
    _HEARTBEAT_TIMEOUT = 300  # Povečano na 300 sekund zaradi throttlinga brskalnikov v ozadju

    def _watchdog():
        """Ozadje: ugasne streznik, ko browser zapre okno."""
        while True:
            time.sleep(5)
            if time.time() - _last_heartbeat > _HEARTBEAT_TIMEOUT:
                msg = f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] Heartbeat timeout ({_HEARTBEAT_TIMEOUT}s) - ugasam streznik.\n"
                print(msg)
                with open("server_log.txt", "a", encoding="utf-8") as f:
                    f.write(msg)
                import os, signal
                os.kill(os.getpid(), signal.SIGTERM)

    _wd_thread = threading.Thread(target=_watchdog, daemon=True)
    _wd_thread.start()



app.mount("/static", StaticFiles(directory="static"), name="static")

UPLOADS_DIR = Path("uploads")
UPLOADS_DIR.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

COMPANIES_FILE = "companies.json"



@app.on_event("startup")
def startup():
    registry = get_companies_registry()
    active_id = registry.get("active_id", "default")
    active_company = next((c for c in registry["items"] if c["id"] == active_id), registry["items"][0])
    
    database.set_active_db(active_company["db"])
    database.init_db()
    
    # Zagotovi, da obstaja vsaj ena vrstica v nastavitvah
    conn = database.get_db()
    cursor = conn.cursor()
    cursor.execute("INSERT OR IGNORE INTO nastavitve (id, naziv) VALUES (1, 'Moje Podjetje d.o.o.')")
    conn.commit()
    conn.close()

@app.get("/api/companies")
def list_companies():
    return get_companies_registry()

@app.post("/api/companies/switch/{company_id}")
def switch_company(company_id: str):
    registry = get_companies_registry()
    company = next((c for c in registry["items"] if c["id"] == company_id), None)
    if not company:
        raise HTTPException(status_code=404, detail="Podjetje ne obstaja")
    
    registry["active_id"] = company_id
    save_companies_registry(registry)
    database.set_active_db(company["db"])
    database.init_db() # Zagotovimo, da je baza inicirana
    return {"status": "success", "company": company}

@app.post("/api/companies/create")
def create_company(data: dict):
    name = data.get("name")
    if not name:
        raise HTTPException(status_code=400, detail="Ime podjetja je obvezno")
    
    registry = get_companies_registry()
    new_id = f"comp_{uuid.uuid4().hex[:8]}"
    db_name = f"{new_id}.db"
    
    new_company = {"id": new_id, "name": name, "db": db_name}
    registry["items"].append(new_company)
    registry["active_id"] = new_id
    save_companies_registry(registry)
    
    # Iniciraj novo bazo
    database.set_active_db(db_name)
    database.init_db()
    
    # Nastavi začetne podatke za podjetje
    conn = database.get_db()
    cursor = conn.cursor()
    cursor.execute("INSERT OR IGNORE INTO nastavitve (id, naziv) VALUES (1, ?)", (name,))
    conn.commit()
    conn.close()
    
    return {"status": "success", "company": new_company}

@app.get("/")
def read_root():
    from fastapi.responses import HTMLResponse
    try:
        with open("static/index.html", "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    except Exception as e:
        return HTMLResponse(content=f"<html><body>Napaka pri nalaganju index.html: {str(e)}</body></html>")

@app.get("/api/heartbeat")
def heartbeat():
    """Browser pinguje ta endpoint vsakih 5 sekund. Watchdog se resetira."""
    global _last_heartbeat
    _last_heartbeat = time.time()
    return {"ok": True}


# --- Partnerji ---











# --- ARTIKLI IN STORITVE ---








# --- PRILOGE ---
@app.post("/api/upload_priloga")
async def upload_priloga(parent_type: str, parent_id: int, file: UploadFile = File(...)):
    ext = Path(file.filename).suffix.lower()
    allowed = {'.pdf', '.jpg', '.jpeg', '.png', '.txt', '.xml'}
    if ext not in allowed:
        raise HTTPException(status_code=400, detail=f"Format {ext} ni dovoljen. Dovoljeni: {', '.join(allowed)}")
    
    unique_name = f"{uuid.uuid4().hex}{ext}"
    dest = UPLOADS_DIR / unique_name
    
    with open(dest, "wb") as f:
        shutil.copyfileobj(file.file, f)
    
    conn = database.get_db()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO priloge (parent_type, parent_id, filename, original_name, uploaded_at) VALUES (?, ?, ?, ?, ?)",
        (parent_type, parent_id, unique_name, file.filename, get_now_slo())
    )
    conn.commit()
    new_id = cursor.lastrowid
    conn.close()
    return {"id": new_id, "filename": unique_name, "original_name": file.filename, "url": f"/uploads/{unique_name}"}







# --- CRM: KONTAKTI ---



# --- CRM: INTERAKCIJE ---


# --- CRM: OPRAVILA ---








# --- Bizi.si pomožne funkcije ---





# --- Nastavitve ---




# --- Kontni načrt ---



# --- LIKVIDACIJA (Povezovanje plačil) ---







@app.post("/api/nastavitve/logo")
async def upload_logo(file: UploadFile = File(...)):
    # Shranimo logotip v static mapo
    try:
        content = await file.read()
        import os
        if not os.path.exists("static/uploads"):
            os.makedirs("static/uploads")
        
        # Podpiramo samo pogoste formate
        ext = file.filename.split('.')[-1].lower()
        if ext not in ['png', 'jpg', 'jpeg', 'gif']:
            raise HTTPException(status_code=400, detail="Nepodprt format slike.")
            
        active_id = "default"
        if "get_companies_registry" in globals():
            try:
                registry = globals()["get_companies_registry"]()
                active_id = registry.get("active_id", "default")
            except Exception:
                pass
                
        # Izbrišemo prejšnje logotipe te firme z vsemi podprtimi končnicami, da se izognemo duplikatom
        for e in ['png', 'jpg', 'jpeg', 'gif', 'PNG', 'JPG', 'JPEG', 'GIF']:
            old_p = f"static/uploads/logo_{active_id}.{e}"
            if os.path.exists(old_p):
                try: os.remove(old_p)
                except: pass
                
        file_path = f"static/uploads/logo_{active_id}.{ext}"
        with open(file_path, "wb") as f:
            f.write(content)
            
        return {"status": "success", "path": f"/static/uploads/logo_{active_id}.{ext}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =============================================
# UJP B2B NASTAVITVE IN POŠILJANJE E-RAČUNOV
# =============================================

UJP_CERTS_DIR = Path("ujp_certs")
UJP_CERTS_DIR.mkdir(exist_ok=True)

@app.post("/api/nastavitve/ujp_cert")
async def upload_ujp_cert(file: UploadFile = File(...)):
    """Naloži sistemsko digitalno potrdilo (.p12/.pfx) za UJP B2B."""
    try:
        content = await file.read()
        ext = file.filename.split('.')[-1].lower()
        if ext not in ['p12', 'pfx']:
            raise HTTPException(status_code=400, detail="Podprte so samo datoteke .p12 ali .pfx")
        
        # Shranimo potrdilo varno v ujp_certs/ mapo
        cert_filename = f"ujp_cert.{ext}"
        cert_path = UJP_CERTS_DIR / cert_filename
        with open(cert_path, "wb") as f:
            f.write(content)
        
        # Shranimo pot v bazo
        conn = database.get_db()
        cursor = conn.cursor()
        cursor.execute("UPDATE nastavitve SET ujp_cert_path=? WHERE id=1", (str(cert_path),))
        conn.commit()
        conn.close()
        
        return {"status": "success", "filename": cert_filename}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))





@app.post("/api/dokumenti/posji_ujp/{id}")
def poslji_na_ujp(id: int):
    """Pošlje izdani račun neposredno na UJP B2B vmesnik."""
    conn = database.get_db()
    cursor = conn.cursor()
    
    # Pridobi nastavitve
    cursor.execute("SELECT ujp_cert_path, ujp_cert_password, ujp_test_mode FROM nastavitve WHERE id=1")
    settings = cursor.fetchone()
    if not settings or not settings["ujp_cert_path"]:
        conn.close()
        raise HTTPException(status_code=400, detail="UJP digitalno potrdilo ni naloženo. Naložite ga v Nastavitve → UJP e-Račun.")
    
    cert_path = settings["ujp_cert_path"]
    cert_password = settings["ujp_cert_password"] or ""
    test_mode = bool(settings["ujp_test_mode"] if settings["ujp_test_mode"] is not None else 1)
    
    if not os.path.exists(cert_path):
        conn.close()
        raise HTTPException(status_code=400, detail="Datoteka digitalnega potrdila ne obstaja. Naložite jo znova v nastavitve.")
    
    # Pridobi podatke o računu
    cursor.execute("SELECT * FROM dokumenti WHERE id=?", (id,))
    inv = cursor.fetchone()
    if not inv:
        conn.close()
        raise HTTPException(status_code=404, detail="Račun ni najden.")
    if inv["tip"] != "izdani_racuni":
        conn.close()
        raise HTTPException(status_code=400, detail="Na UJP je mogoče pošiljati samo izdane račune.")
    
    cursor.execute("SELECT * FROM partnerji WHERE id=?", (inv["partner_id"],))
    partner = cursor.fetchone()
    partner_dict = dict(partner) if partner else {"naziv": "Neznan", "ulica": "", "postna_stevilka": "", "kraj": "", "drzava": "Slovenija", "davcna_stevilka": "", "zavezanec_za_ddv": 0, "trr": ""}
    
    cursor.execute("SELECT * FROM dokumenti_postavke WHERE dokument_id=?", (id,))
    items = [dict(r) for r in cursor.fetchall()]
    
    cursor.execute("SELECT * FROM nastavitve WHERE id=1")
    company = cursor.fetchone()
    conn.close()
    
    # Generiraj e-SLOG XML
    xml_content = generate_eslog_xml(dict(inv), dict(company), partner_dict, items)
    stevilka = inv["stevilka"]
    
    # Pripravi SOAP ovojnico
    soap_body = _generate_ujp_soap_envelope(xml_content, stevilka)
    
    # Endpoint (testni ali produkcijski)
    if test_mode:
        endpoint = "https://betaujpnet.ujp.gov.si/b2b/service.svc"
    else:
        endpoint = "https://ujpnet.ujp.gov.si/b2b/service.svc"
    
    # Izvleči PEM certifikat in ključ iz .p12 datoteke
    try:
        from cryptography.hazmat.primitives.serialization import pkcs12, Encoding, PrivateFormat, NoEncryption
        from cryptography.hazmat.primitives.serialization.pkcs12 import load_key_and_certificates
        import tempfile
        
        with open(cert_path, "rb") as f:
            p12_data = f.read()
        
        password_bytes = cert_password.encode("utf-8") if cert_password else None
        private_key, certificate, _ = load_key_and_certificates(p12_data, password_bytes)
        
        # Zapišemo začasne PEM datoteke za requests
        with tempfile.NamedTemporaryFile(suffix=".pem", delete=False) as cert_pem_file:
            cert_pem_file.write(certificate.public_bytes(Encoding.PEM))
            cert_pem_path = cert_pem_file.name
        
        with tempfile.NamedTemporaryFile(suffix=".pem", delete=False) as key_pem_file:
            key_pem_file.write(private_key.private_bytes(Encoding.PEM, PrivateFormat.TraditionalOpenSSL, NoEncryption()))
            key_pem_path = key_pem_file.name
        
        # Pošlji SOAP zahtevek z mTLS
        headers = {
            "Content-Type": "application/soap+xml; charset=utf-8",
            "SOAPAction": "http://ujpnet.ujp.gov.si/b2b/IService/SendInvoice"
        }
        response = requests.post(
            endpoint,
            data=soap_body.encode("utf-8"),
            headers=headers,
            cert=(cert_pem_path, key_pem_path),
            timeout=30,
            verify=True
        )
        
        # Počistimo začasne datoteke
        try:
            os.unlink(cert_pem_path)
            os.unlink(key_pem_path)
        except:
            pass
        
        # Zabeležimo rezultat
        status = "success" if response.status_code == 200 else "error"
        odgovor = response.text[:2000] if response.text else str(response.status_code)
        
        conn2 = database.get_db()
        cursor2 = conn2.cursor()
        cursor2.execute(
            "INSERT INTO ujp_log (dokument_id, stevilka, status, odgovor) VALUES (?,?,?,?)",
            (id, stevilka, status, odgovor)
        )
        conn2.commit()
        conn2.close()
        
        if response.status_code == 200:
            return {"status": "success", "message": f"Račun {stevilka} je bil uspešno poslan na UJP{' (testno okolje)' if test_mode else ''}.", "odgovor": odgovor}
        else:
            raise HTTPException(status_code=400, detail=f"UJP je vrnil napako {response.status_code}: {odgovor[:500]}")
    
    except HTTPException:
        raise
    except ImportError:
        raise HTTPException(status_code=500, detail="Manjka knjižnica 'cryptography'. Zaženite: pip install cryptography")
    except Exception as e:
        # Zabeležimo napako
        try:
            conn3 = database.get_db()
            cursor3 = conn3.cursor()
            cursor3.execute(
                "INSERT INTO ujp_log (dokument_id, stevilka, status, odgovor) VALUES (?,?,?,?)",
                (id, str(inv.get("stevilka", "")), "error", str(e)[:2000])
            )
            conn3.commit()
            conn3.close()
        except:
            pass
        raise HTTPException(status_code=500, detail=f"Napaka pri pošiljanju: {str(e)}")

@app.get("/api/ujp_log")
def get_ujp_log():
    """Vrne dnevnik pošiljanj na UJP."""
    conn = database.get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT * FROM ujp_log ORDER BY id DESC LIMIT 100")
        rows = cursor.fetchall()
        conn.close()
        return [dict(r) for r in rows]
    except Exception:
        conn.close()
        return []



# --- PDF GENERATOR (fpdf2) ---


@app.get("/api/dokumenti/pdf/{id}")
def get_pdf_invoice(id: int):
    conn = database.get_db()
    cursor = conn.cursor()
    
    # Get invoice
    cursor.execute("SELECT * FROM dokumenti WHERE id = ?", (id,))
    inv = cursor.fetchone()
    if not inv:
        conn.close()
        return {"error": "Ni najdeno"}
    
    # Get partner
    cursor.execute("SELECT * FROM partnerji WHERE id = ?", (inv['partner_id'],))
    partner = cursor.fetchone()
    if not partner:
        partner = {"naziv": "Neznan partner", "ulica": "", "posta_kraj": "", "drzava": "", "davcna_stevilka": ""}
    
    # Get items
    cursor.execute("SELECT * FROM dokumenti_postavke WHERE dokument_id = ?", (id,))
    items = [dict(r) for r in cursor.fetchall()]
    
    # Get company settings
    cursor.execute("SELECT * FROM nastavitve WHERE id = 1")
    company = cursor.fetchone()
    conn.close()
    
    pdf_content = generate_pdf_invoice(dict(inv), dict(company), dict(partner), items)
    
    
    doc_title = "Racun"
    if inv['tip'] == 'ponudbe':
        doc_title = "Ponudba"
    elif inv['tip'] == 'dobropisi':
        doc_title = "Dobropis"
        
    return Response(content=bytes(pdf_content), media_type="application/pdf", headers={
        "Content-Disposition": f"attachment; filename={doc_title}_{inv['stevilka']}.pdf"
    })

@app.post("/api/nastavitve/test_smtp")
def test_smtp(n: Nastavitve):
    if not n.smtp_server or not n.smtp_port or not n.smtp_username or not n.smtp_password:
        raise HTTPException(status_code=400, detail="Vnesite vse obvezne podatke za SMTP (strežnik, vrata, up. ime, geslo).")
    try:
        if n.smtp_use_tls:
            server = smtplib.SMTP(n.smtp_server, n.smtp_port, timeout=10)
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(n.smtp_username, n.smtp_password)
            server.quit()
        else:
            server = smtplib.SMTP_SSL(n.smtp_server, n.smtp_port, timeout=10)
            server.login(n.smtp_username, n.smtp_password)
            server.quit()
        return {"status": "success", "message": "Povezava s SMTP strežnikom je uspešna!"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Napaka pri povezavi: {str(e)}")

@app.get("/api/email_log")
def get_email_log():
    conn = database.get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM email_log ORDER BY poslano_at DESC LIMIT 100")
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

@app.post("/api/dokumenti/send_email/{id}")
def send_email_invoice(id: int, request: EmailRequest = None):
    conn = database.get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM dokumenti WHERE id = ?", (id,))
    inv = cursor.fetchone()
    if not inv:
        conn.close()
        raise HTTPException(status_code=404, detail="Dokument ne obstaja")
    
    cursor.execute("SELECT * FROM partnerji WHERE id = ?", (inv['partner_id'],))
    partner_row = cursor.fetchone()
    partner = dict(partner_row) if partner_row else {}
    
    to_email_raw = (request.to_email if (request and request.to_email) else partner.get('email', '')) or ''
    recipients = [e.strip() for e in re.split(r'[,;\s]+', to_email_raw) if e.strip()]
    if not recipients and partner.get('email'):
        recipients = [e.strip() for e in re.split(r'[,;\s]+', partner['email']) if e.strip()]
        
    if not recipients:
        conn.close()
        raise HTTPException(status_code=400, detail="Partner nima vnesenega e-naslova in e-naslov prejemnika ni bil naveden.")
        
    to_header = ", ".join(recipients)
        
    cursor.execute("SELECT * FROM dokumenti_postavke WHERE dokument_id = ?", (id,))
    items = [dict(r) for r in cursor.fetchall()]
    
    cursor.execute("SELECT * FROM nastavitve WHERE id = 1")
    company_row = cursor.fetchone()
    conn.close()
    
    if not company_row:
        raise HTTPException(status_code=500, detail="Nastavitve niso najdene v bazi.")
    
    company = dict(company_row)
    
    if not company.get('smtp_server') or not company.get('smtp_port') or not company.get('smtp_username') or not company.get('smtp_password'):
        raise HTTPException(status_code=400, detail="SMTP nastavitve niso izpolnjene v Nastavitvah.")
        
    try:
        pdf_content = generate_pdf_invoice(dict(inv), company, partner, items)
        
        doc_title = "Racun"
        if inv['tip'] == 'ponudbe':
            doc_title = "Ponudba"
        elif inv['tip'] == 'dobropisi':
            doc_title = "Dobropis"
            
        filename = f"{doc_title}_{inv['stevilka']}.pdf"
        
        msg = MIMEMultipart()
        msg['From'] = company.get('email_posiljatelja') or company['smtp_username']
        msg['To'] = to_header
        msg['Subject'] = f"{doc_title} št. {inv['stevilka']} - {company.get('naziv', '')}"
        
        # Uporaba predloge besedila
        template = ""
        if inv['tip'] == 'izdani_racuni':
            template = company.get('email_template_racun')
        elif inv['tip'] == 'ponudbe':
            template = company.get('email_template_ponudba')
        elif inv['tip'] == 'dobropisi':
            template = company.get('email_template_dobropis')
            
        if not template:
            body = f"Spoštovani,\n\nv priponki vam pošiljamo dokument {doc_title} št. {inv['stevilka']}.\n\nLep pozdrav,\n{company.get('naziv', '')}"
        else:
            # Osnovna zamenjava placeholderjev
            body = template.replace("{stevilka}", str(inv['stevilka']))
            body = body.replace("{tip}", doc_title)
            body = body.replace("{podjetje}", company.get('naziv', ''))
            
        msg.attach(MIMEText(body, 'plain', 'utf-8'))
        
        part = MIMEApplication(pdf_content, Name=filename)
        part['Content-Disposition'] = f'attachment; filename="{filename}"'
        msg.attach(part)
        
        # Dodajanje izbranih prilog
        if request and request.priloge_ids:
            conn = database.get_db()
            cursor = conn.cursor()
            for p_id in request.priloge_ids:
                cursor.execute("SELECT * FROM priloge WHERE id = ?", (p_id,))
                p_row = cursor.fetchone()
                if p_row:
                    p_path = UPLOADS_DIR / p_row['filename']
                    if p_path.exists():
                        with open(p_path, "rb") as f:
                            p_part = MIMEApplication(f.read(), Name=p_row['original_name'])
                            p_part['Content-Disposition'] = f'attachment; filename="{p_row["original_name"]}"'
                            msg.attach(p_part)
            conn.close()
        
        if company['smtp_use_tls']:
            server = smtplib.SMTP(company['smtp_server'], int(company['smtp_port']), timeout=10)
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(company['smtp_username'], company['smtp_password'])
            server.send_message(msg, to_addrs=recipients)
            server.quit()
        else:
            server = smtplib.SMTP_SSL(company['smtp_server'], int(company['smtp_port']), timeout=10)
            server.login(company['smtp_username'], company['smtp_password'])
            server.send_message(msg, to_addrs=recipients)
            server.quit()
            
        # Logiranje uspešnega pošiljanja
        conn = database.get_db()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO email_log (dokument_id, tip_dokumenta, stevilka_dokumenta, prejemnik, zadeva, status, poslano_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (id, inv['tip'], inv['stevilka'], to_header, msg['Subject'], 'success', get_now_slo()))
        conn.commit()
        conn.close()
            
        return {"status": "success", "message": "E-pošta je bila uspešno poslana."}
    except Exception as e:
        # Logiranje napake
        try:
            conn = database.get_db()
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO email_log (dokument_id, tip_dokumenta, stevilka_dokumenta, prejemnik, zadeva, status, napaka, poslano_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (id, inv['tip'], inv['stevilka'], to_header if 'to_header' in locals() else partner.get('email', ''), f"{doc_title} št. {inv['stevilka']}", 'error', str(e), get_now_slo()))
            conn.commit()
            conn.close()
        except: pass
        raise HTTPException(status_code=500, detail=f"Napaka pri pošiljanju: {str(e)}")

@app.post("/api/dokumenti/send_reminder/{id}")
def send_reminder_invoice(id: int):
    conn = database.get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM dokumenti WHERE id = ?", (id,))
    inv = cursor.fetchone()
    if not inv:
        conn.close()
        raise HTTPException(status_code=404, detail="Dokument ne obstaja")
    
    cursor.execute("SELECT * FROM partnerji WHERE id = ?", (inv['partner_id'],))
    partner_row = cursor.fetchone()
    if not partner_row or not partner_row['email']:
        conn.close()
        raise HTTPException(status_code=400, detail="Partner nima vnesenega e-naslova.")
        
    cursor.execute("SELECT * FROM dokumenti_postavke WHERE dokument_id = ?", (id,))
    items = [dict(r) for r in cursor.fetchall()]
    
    cursor.execute("SELECT * FROM nastavitve WHERE id = 1")
    company_row = cursor.fetchone()
    conn.close()
    
    if not company_row:
        raise HTTPException(status_code=500, detail="Nastavitve niso najdene v bazi.")
    
    company = dict(company_row)
    partner = dict(partner_row)
    
    if not company.get('smtp_server') or not company.get('smtp_port') or not company.get('smtp_username') or not company.get('smtp_password'):
        raise HTTPException(status_code=400, detail="SMTP nastavitve niso izpolnjene v Nastavitvah.")
        
    try:
        pdf_content = generate_pdf_invoice(dict(inv), company, partner, items)
        
        doc_title = "Opomin za racun"
        filename = f"Opomin_{inv['stevilka']}.pdf"
        
        msg = MIMEMultipart()
        msg['From'] = company.get('email_posiljatelja') or company['smtp_username']
        msg['To'] = partner['email']
        msg['Subject'] = f"Opomin za račun št. {inv['stevilka']} - {company.get('naziv', '')}"
        
        # Format due date for placeholders
        zapadlost_str = inv['datum_zapadlosti'] or ""
        if zapadlost_str:
            try:
                from datetime import datetime
                dt = datetime.strptime(zapadlost_str, "%Y-%m-%d")
                zapadlost_str = dt.strftime("%d.%m.%Y")
            except Exception:
                pass
                
        znesek_str = f"{inv['znesek_skupaj']:.2f}"
        
        # Uporaba predloge besedila za opomine
        template = company.get('email_template_opomin')
            
        if not template:
            body = (
                f"Spoštovani,\n\n"
                f"ugotavljamo, da račun št. {inv['stevilka']} z zapadlostjo {zapadlost_str} še ni poravnan. "
                f"Prosimo vas, da znesek {znesek_str} € čim prej nakažete na naš TRR.\n\n"
                f"Če ste račun medtem že plačali, se vam zahvaljujemo in ta opomin štejte za brezpredmeten.\n\n"
                f"Lep pozdrav,\n{company.get('naziv', '')}"
            )
        else:
            # Osnovna zamenjava placeholderjev
            body = template.replace("{stevilka}", str(inv['stevilka']))
            body = body.replace("{tip}", doc_title)
            body = body.replace("{podjetje}", company.get('naziv', ''))
            body = body.replace("{zapadlost}", zapadlost_str)
            body = body.replace("{znesek}", znesek_str)
            
        msg.attach(MIMEText(body, 'plain', 'utf-8'))
        
        part = MIMEApplication(pdf_content, Name=filename)
        part['Content-Disposition'] = f'attachment; filename="{filename}"'
        msg.attach(part)
        
        if company['smtp_use_tls']:
            server = smtplib.SMTP(company['smtp_server'], int(company['smtp_port']), timeout=10)
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(company['smtp_username'], company['smtp_password'])
            server.send_message(msg)
            server.quit()
        else:
            server = smtplib.SMTP_SSL(company['smtp_server'], int(company['smtp_port']), timeout=10)
            server.login(company['smtp_username'], company['smtp_password'])
            server.send_message(msg)
            server.quit()
            
        # Logiranje uspešnega pošiljanja
        conn = database.get_db()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO email_log (dokument_id, tip_dokumenta, stevilka_dokumenta, prejemnik, zadeva, status, poslano_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (id, 'opomin', inv['stevilka'], partner['email'], msg['Subject'], 'success', get_now_slo()))
        conn.commit()
        conn.close()
            
        return {"status": "success", "message": "Opomin je bil uspešno poslan."}
    except Exception as e:
        # Logiranje napake
        try:
            conn = database.get_db()
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO email_log (dokument_id, tip_dokumenta, stevilka_dokumenta, prejemnik, zadeva, status, napaka, poslano_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (id, 'opomin', inv['stevilka'], partner['email'], f"Opomin št. {inv['stevilka']}", 'error', str(e), get_now_slo()))
            conn.commit()
            conn.close()
        except: pass
        raise HTTPException(status_code=500, detail=f"Napaka pri pošiljanju opomina: {str(e)}")



@app.post("/api/dokumenti/import_eslog_pregled")
async def import_eslog_pregled(file: UploadFile = File(...)):
    try:
        content = await file.read()
        results = []
        
        if file.filename.endswith('.zip'):
            with zipfile.ZipFile(io.BytesIO(content)) as z:
                for name in z.namelist():
                    if name.lower().endswith('.xml'):
                        xml_content = z.read(name)
                        try:
                            parsed = parse_eslog_xml(xml_content)
                            enriched = _enrich_eslog_data(parsed)
                            results.append(enriched)
                        except Exception as e:
                            print(f"Error parsing {name}: {e}")
                    elif name.lower().endswith('.png') or name.lower().endswith('.pdf'):
                        # AliExpress ali Temu?
                        f_content = z.read(name)
                        try:
                            parsed = None
                            if name.lower().endswith('.png'):
                                parsed = extract_aliexpress_png(f_content)
                            else:
                                parsed = invoice_ocr.process_invoice_data(f_content, name)
                            
                            if parsed:
                                enriched = _enrich_eslog_data(parsed)
                                enriched['file_data'] = base64.b64encode(f_content).decode('utf-8')
                                enriched['file_name'] = name
                                results.append(enriched)
                        except Exception as e:
                            print(f"Error parsing {name}: {e}")
        else:
            if file.filename.lower().endswith('.xml'):
                parsed = parse_eslog_xml(content)
                enriched = _enrich_eslog_data(parsed)
                results.append(enriched)
            elif file.filename.lower().endswith(('.png', '.jpg', '.jpeg')):
                # Najprej poskusi z Llama AI (ki se uči iz primerov)
                parsed = invoice_ocr.process_invoice_data(content, file.filename)
                # Fallback: če Llama ni na voljo, uporabi regex parser za AliExpress
                if not parsed:
                    parsed = extract_aliexpress_png(content)
                
                if parsed:
                    enriched = _enrich_eslog_data(parsed)
                    enriched['file_data'] = base64.b64encode(content).decode('utf-8')
                    enriched['file_name'] = file.filename
                    results.append(enriched)
            elif file.filename.lower().endswith('.pdf'):
                parsed = invoice_ocr.process_invoice_data(content, file.filename)
                
                if parsed:
                    enriched = _enrich_eslog_data(parsed)
                    enriched['file_data'] = base64.b64encode(content).decode('utf-8')
                    enriched['file_name'] = file.filename
                    results.append(enriched)

        return {"items": results, "count": len(results)}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/dokumenti/import_eslog_bulk_potrdi")
async def import_eslog_bulk_potrdi(request_data: dict):
    items = request_data.get("items", [])
    results = []
    for data in items:
        try:
            doc_id = await _save_imported_eslog(data)
            results.append(doc_id)
        except Exception as e:
            print(f"Bulk save error: {e}")
    return {"status": "success", "count": len(results), "ids": results}

async def _save_imported_eslog(data):
    conn = database.get_db()
    cursor = conn.cursor()
    try:
        # 1. Partner — mora obstajati v bazi; samodejno ustvarjanje ni dovoljeno
        partner_id = data['partner'].get('id')
        if not partner_id:
            # Zadnja obramba: preverimo po davčni ali nazivu
            p = data['partner']
            davcna = (p.get('davcna_stevilka') or '').strip()
            naziv = (p.get('naziv') or '').strip()
            if davcna:
                d_clean = re.sub(r'[^0-9]', '', davcna)
                cursor.execute("""
                    SELECT id FROM partnerji 
                    WHERE davcna_stevilka = ? OR davcna_stevilka = ? OR davcna_stevilka = ? OR davcna_stevilka = ?
                """, (davcna, d_clean, f"SI{d_clean}", f"SI {d_clean}"))
                row = cursor.fetchone()
                if row:
                    partner_id = row['id']
            if not partner_id and naziv:
                cursor.execute("SELECT id FROM partnerji WHERE UPPER(naziv) = UPPER(?)", (naziv,))
                row = cursor.fetchone()
                if row:
                    partner_id = row['id']
            if not partner_id:
                raise ValueError(f"Partner '{naziv or davcna or 'neznano'}' ni v bazi. Dodajte ga najprej prek gumba '+ Nov partner'.")
        
        # 2. Dokument
        poslovno_leto = int(data['datum_izdaje'].split('-')[0]) if '-' in data['datum_izdaje'] else 2026
        status = 'neplačano'
        datum_placila = None
        nacin_placila = None
        
        if data.get('placan') or data.get('placano'):
            status = 'plačano'
            datum_placila = data.get('datum_placila') or data['datum_izdaje']
            nacin_placila = data.get('nacin_placila') or 'Poslovna kartica'

        doc_tip = data.get('tip', 'prejeti_racuni')

        # Generiranje interne stevilke
        cursor.execute("SELECT interna_stevilka FROM dokumenti WHERE tip = ? AND poslovno_leto = ? AND interna_stevilka LIKE '%-%'", (doc_tip, poslovno_leto))
        rows = cursor.fetchall()
        max_int = 0
        for r in rows:
            st = r['interna_stevilka']
            if not st: continue
            try:
                parts = st.split('-')
                if len(parts) == 2:
                    num = int(parts[0]) if parts[0].isdigit() and int(parts[0]) != poslovno_leto else int(parts[1])
                    if num > max_int: max_int = num
            except: pass
        next_int = max_int + 1
        interna_st = f"{next_int:03d}-{poslovno_leto}"

        cursor.execute("""
            INSERT INTO dokumenti (poslovno_leto, tip, stevilka, interna_stevilka, partner_id, datum_izdaje, datum_zapadlosti, 
                                   datum_storitve_od, datum_storitve_do, znesek_brez_ddv, znesek_ddv, 
                                   znesek_skupaj, valuta, tecaj, znesek_v_valuti, status, datum_placila, nacin_placila, sklic)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (poslovno_leto, doc_tip, data['stevilka'], interna_st, partner_id, data['datum_izdaje'], data['datum_zapadlosti'], 
              data['datum_storitve_od'], data['datum_storitve_do'], data['znesek_brez_ddv'], 
              data['znesek_ddv'], data['znesek_skupaj'], data.get('valuta', 'EUR'), 
              data.get('tecaj', 1.0), data.get('znesek_v_valuti', data['znesek_skupaj']),
              status, datum_placila, nacin_placila, data.get('sklic', '')))
        
        doc_id = cursor.lastrowid

        # 3. Priloga (v isti transakciji!)
        if 'file_data' in data and 'file_name' in data:
            file_content = base64.b64decode(data['file_data'])
            ext = Path(data['file_name']).suffix.lower()
            unique_name = f"{uuid.uuid4().hex}{ext}"
            dest = UPLOADS_DIR / unique_name
            with open(dest, "wb") as f:
                f.write(file_content)
            
            cursor.execute(
                "INSERT INTO priloge (parent_type, parent_id, filename, original_name, uploaded_at) VALUES (?, ?, ?, ?, ?)",
                ('dokumenti', doc_id, unique_name, data['file_name'], get_now_slo())
            )
        
        # 4. Postavke
        for it in data['postavke']:
            cursor.execute("""
                INSERT INTO dokumenti_postavke (dokument_id, artikel_id, opis, kolicina, cena_enote, popust, stopnja_ddv, znesek_skupaj, konto, enota_mere)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (doc_id, it.get('artikel_id'), it['opis'], it['kolicina'], it['cena_enote'], it.get('popust', 0), it['stopnja_ddv'], it['znesek_skupaj'], it.get('konto'), it.get('enota_mere', 'kos')))
        
        conn.commit()
        return doc_id
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()

@app.post("/api/dokumenti/import_eslog_potrdi")
async def import_eslog_potrdi(data: dict):
    try:
        # Preveri, če je način učenja aktiven
        conn = database.get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT vrednost FROM llama_settings WHERE kljuc = 'learning_mode'")
        row = cursor.fetchone()
        conn.close()
        learning_active = (row['vrednost'] == '1') if row else False
        
        ocr_text = data.pop("ocr_text", None)
        original_data = data.pop("original_data", None)
        
        doc_id = await _save_imported_eslog(data)
        
        # Shrani primer učenja, če je način učenja aktiven in je prisotno OCR besedilo
        if learning_active and ocr_text:
            try:
                invoice_ocr.save_llama_learning_example(ocr_text, data, original_data, data.get("file_name", ""))
            except Exception as ex_err:
                print(f"Napaka pri shranjevanju llama učenja: {ex_err}")
                
        return {"status": "success", "id": doc_id}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))











# --- DOKUMENTI ---



























# --- BANČNI IZPISKI ---











@app.post("/api/izpiski/parse")
async def parse_izpisek(file: UploadFile = File(...)):
    try:
        content = await file.read()
        results = []
        
        files_to_process = []
        if file.filename.lower().endswith('.zip'):
            with zipfile.ZipFile(io.BytesIO(content)) as z:
                for name in z.namelist():
                    if name.lower().endswith(('.pdf', '.xml')):
                        files_to_process.append((name, z.read(name)))
        else:
            files_to_process.append((file.filename, content))
            
        for name, data in files_to_process:
            try:
                raw_data = None
                if name.lower().endswith('.pdf'):
                    # Temporary PDF file for parser
                    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
                        tmp.write(data)
                        tmp_path = tmp.name
                    raw_data = extract_data_from_pdf(tmp_path)
                    
                    # AI fallback if regex fails
                    if (not raw_data or not raw_data.get('transactions')) and invoice_ocr.ensure_ollama_running():
                        print(f"Regex parsing failed for {name}, trying AI fallback...")
                        try:
                            pdf_text = invoice_ocr.extract_text_from_pdf(data)
                            llama_data = invoice_ocr.parse_bank_statement_with_llama(pdf_text, name)
                            if llama_data and llama_data.get('transactions'):
                                raw_data = {
                                    'statement_date': llama_data.get('statement_date', datetime.now().strftime("%Y-%m-%d")),
                                    'statement_number': llama_data.get('statement_number', 'UNKNOWN'),
                                    'opening_balance': llama_data.get('opening_balance', 0.0),
                                    'closing_balance': llama_data.get('closing_balance', 0.0),
                                    'transactions': llama_data['transactions']
                                }
                                print(f"Llama3 successfully extracted {len(raw_data['transactions'])} transactions.")
                        except Exception as llama_err:
                            print(f"Llama fallback failed for {name}: {llama_err}")
                            
                    os.unlink(tmp_path)

                elif name.lower().endswith('.xml'):
                    raw_data = extract_data_from_sepa_xml(data, name)
                
                if raw_data:
                    # Shranimo v uploads za kasnejšo priponko
                    ext = name.split('.')[-1]
                    disk_filename = f"izpisek_{uuid.uuid4().hex}.{ext}"
                    with open(UPLOADS_DIR / disk_filename, "wb") as f:
                        f.write(data)
                        
                    enriched = _enrich_izpisek_data(raw_data)
                    # Add source filename for UI
                    enriched['source_file'] = name
                    enriched['disk_file'] = disk_filename
                    results.append(enriched)
            except Exception as e:
                print(f"Napaka pri obdelavi {name}: {e}")
                # Ne prekinemo celotnega uvoza, če ena datoteka spodleti

        return {"items": results, "count": len(results)}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/izpiski/bulk_potrdi")
async def izpiski_bulk_potrdi(request_data: dict):
    items = request_data.get("items", [])
    results = []
    conn = database.get_db()
    cursor = conn.cursor()
    try:
        for data in items:
            cursor.execute("""
                INSERT INTO izpiski_glava (datum, stevilka_izpiska, zacetno_stanje, koncno_stanje, kontrolna_vsota)
                VALUES (?, ?, ?, ?, ?)
            """, (data['datum'], data['stevilka_izpiska'], data['zacetno_stanje'], data['koncno_stanje'], data.get('kontrolna_vsota', 0)))
            
            izp_id = cursor.lastrowid
            
            # Če imamo shranjeno datoteko, jo dodamo kot prilogo
            if data.get('disk_file'):
                cursor.execute("""
                    INSERT INTO priloge (parent_type, parent_id, filename, original_name)
                    VALUES (?, ?, ?, ?)
                """, ('izpiski', izp_id, data['disk_file'], data['source_file']))

            for p in data['postavke']:
                cursor.execute("""
                    INSERT INTO izpiski_postavke (izpisek_id, tip_prometa, partner_id, namen, znesek, koda_namena, konto)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (izp_id, p['tip_prometa'], p['partner_id'], p['namen'], p['znesek'], p['koda_namena'], p['konto']))
            results.append(izp_id)
        
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Bulk save error: {str(e)}")
    finally:
        conn.close()
    return {"status": "success", "count": len(results), "ids": results}

# --- PLAČE IN PRISPEVKI ---








# --- OSNOVNA SREDSTVA ---

@app.get("/api/osnovna_sredstva/next_inv")
def next_inv():
    conn = database.get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT inventarna_stevilka FROM osnovna_sredstva ORDER BY id DESC LIMIT 1")
    row = cursor.fetchone()
    conn.close()
    if row and row['inventarna_stevilka']:
        try:
            num = int(row['inventarna_stevilka'])
            return {"stevilka": f"{num+1:03d}"}
        except ValueError:
            pass
    return {"stevilka": "001"}




# --- ZAPOSLENI ---





# --- POTNI NALOGI ---











# --- TARIFE POTANJ (Scraping limitov na 1. v mesecu) ---

@app.post("/api/bulk-delete")
async def bulk_delete(request_data: dict):
    module = request_data.get("module")
    ids = request_data.get("ids", [])
    force = request_data.get("force", False)
    if not ids: return {"status": "success", "count": 0}
    
    conn = database.get_db()
    cursor = conn.cursor()
    try:
        if module in ['izdani_racuni', 'prejeti_racuni', 'prejete_ponudbe', 'ponudbe', 'dobropisi', 'prejeti_dobropisi', 'delovni_nalogi']:
            module = 'dokumenti'
        # Faza 2: Za dokumente in izpiske preveri rok hramba pred brisanjem
        if module == 'dokumenti' and not force:
            opozorila = []
            for doc_id in ids:
                cursor.execute("SELECT datum_izdaje, tip FROM dokumenti WHERE id = ?", (doc_id,))
                row = cursor.fetchone()
                if row:
                    h = _preveri_hrambo(row['datum_izdaje'] or '', row['tip'] or '')
                    if not h['dovoljeno']:
                        opozorila.append({'id': doc_id, 'hramba_do': h['hramba_do'], 'message': h['message']})
            if opozorila:
                conn.close()
                return {"status": "warning", "opozorila": opozorila,
                        "message": f"{len(opozorila)} listin ima še aktivni rok hramba. Pošljite force=true za prisilno brisanje."}
        if module == 'partnerji':
            for id in ids:
                cursor.execute("SELECT COUNT(*) as cnt FROM dokumenti WHERE partner_id = ?", (id,))
                if cursor.fetchone()['cnt'] > 0:
                    raise HTTPException(status_code=400, detail=f"Partnerja {id} ni mogoče brisati, ker ima vezane dokumente.")
            cursor.execute(f"DELETE FROM partnerji WHERE id IN ({','.join(['?']*len(ids))})", ids)
        elif module == 'dokumenti':
            cursor.execute(f"DELETE FROM dokumenti_postavke WHERE dokument_id IN ({','.join(['?']*len(ids))})", ids)
            cursor.execute(f"DELETE FROM dokumenti WHERE id IN ({','.join(['?']*len(ids))})", ids)
        elif module == 'izpiski':
            cursor.execute(f"DELETE FROM izpiski_postavke WHERE izpisek_id IN ({','.join(['?']*len(ids))})", ids)
            cursor.execute(f"DELETE FROM izpiski_glava WHERE id IN ({','.join(['?']*len(ids))})", ids)
        elif module == 'zaposleni':
            cursor.execute(f"DELETE FROM zaposleni WHERE id IN ({','.join(['?']*len(ids))})", ids)
        elif module == 'potni_nalogi':
            cursor.execute(f"DELETE FROM potni_nalogi WHERE id IN ({','.join(['?']*len(ids))})", ids)
        elif module == 'osnovna_sredstva':
            cursor.execute(f"DELETE FROM osnovna_sredstva WHERE id IN ({','.join(['?']*len(ids))})", ids)
        elif module == 'place':
            cursor.execute(f"DELETE FROM place WHERE id IN ({','.join(['?']*len(ids))})", ids)
        elif module == 'konti':
            cursor.execute(f"DELETE FROM kontni_nacrt WHERE id IN ({','.join(['?']*len(ids))})", ids)
            
        conn.commit()
    except Exception as e:
        conn.rollback()
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()
    return {"status": "success", "count": len(ids)}

# ==============================================================================
# FAZA 3.2 — Posodobitev trenutna_vrednost po obračunu amortizacije (SRS 3.18)
# ==============================================================================


# ==============================================================================
# FAZA 4 — DDV-O poročilo (ZDDV-1, čl. 88)
# ==============================================================================




# ==============================================================================
# FAZA 5 — Plačilna lista za tisk (ZDR-1, SRS 29)
# ==============================================================================


# ==============================================================================
# FAZA 6 — UJP preverjanje partnerja
# ==============================================================================


# ==============================================================================
# FAZA 7 — Enostavno knjigovodstvo: poslovne knjige (SRS 30)
# ==============================================================================










# ==============================================================================
# FAZA 8 — Izkaz denarnih tokov (SRS 22, direktna metoda)
# ==============================================================================


if __name__ == "__main__":
    import os
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)