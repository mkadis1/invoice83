from utils import *
import re
import traceback
from fastapi import APIRouter, HTTPException, UploadFile, File, Response
from typing import List, Optional
import database
import uuid
import time
from datetime import datetime
from schemas import *
import requests
from bs4 import BeautifulSoup
import xml.etree.ElementTree as ET

router = APIRouter()

@router.get("/api/partnerji")
def get_partnerji():
    conn = database.get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM partnerji ORDER BY naziv")
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

@router.post("/api/partnerji")
def create_partner(partner: Partner):
    conn = database.get_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO partnerji (naziv, ulica, postna_stevilka, kraj, drzava, davcna_stevilka, zavezanec_za_ddv, trr, telefon, email, vrsta, status, kategorija, vir_stranke, opombe)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (partner.naziv, partner.ulica, partner.postna_stevilka, partner.kraj, partner.drzava, partner.davcna_stevilka, partner.zavezanec_za_ddv, partner.trr, partner.telefon, partner.email, partner.vrsta, partner.status, partner.kategorija, partner.vir_stranke, partner.opombe))
    conn.commit()
    new_id = cursor.lastrowid
    conn.close()
    return {"status": "success", "id": new_id}

@router.get("/api/partnerji/detajl/{id}")
def get_partner_detajl(id: int):
    conn = database.get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM partnerji WHERE id = ?", (id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Partner ni najden")
    
    res = dict(row)
    
    # Pridobi še kontakte, interakcije in opravila
    cursor.execute("SELECT * FROM partner_kontakti WHERE partner_id = ? ORDER BY primarni DESC, ime_priimek", (id,))
    res['kontakti'] = [dict(r) for r in cursor.fetchall()]
    
    cursor.execute("SELECT * FROM partner_interakcije WHERE partner_id = ? ORDER BY datum DESC", (id,))
    res['interakcije'] = [dict(r) for r in cursor.fetchall()]
    
    cursor.execute("SELECT * FROM partner_opravila WHERE partner_id = ? ORDER BY rok ASC, prioriteta DESC", (id,))
    res['opravila'] = [dict(r) for r in cursor.fetchall()]
    
    conn.close()
    return res

@router.put("/api/partnerji/{id}")
def update_partner(id: int, partner: Partner):
    conn = database.get_db()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE partnerji 
        SET naziv=?, ulica=?, postna_stevilka=?, kraj=?, drzava=?, davcna_stevilka=?, zavezanec_za_ddv=?, trr=?, telefon=?, email=?, vrsta=?, status=?, kategorija=?, vir_stranke=?, opombe=?
        WHERE id = ?
    """, (partner.naziv, partner.ulica, partner.postna_stevilka, partner.kraj, partner.drzava, partner.davcna_stevilka, partner.zavezanec_za_ddv, partner.trr, partner.telefon, partner.email, partner.vrsta, partner.status, partner.kategorija, partner.vir_stranke, partner.opombe, id))
    conn.commit()
    conn.close()
    return {"status": "success"}

@router.post("/api/partnerji/{id}/kontakti")
def add_kontakt(id: int, k: PartnerKontakt):
    conn = database.get_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO partner_kontakti (partner_id, ime_priimek, oddelek, funkcija, email, telefon, primarni)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (id, k.ime_priimek, k.oddelek, k.funkcija, k.email, k.telefon, k.primarni))
    conn.commit()
    new_id = cursor.lastrowid
    conn.close()
    return {"status": "success", "id": new_id}

@router.put("/api/partnerji/kontakti/{kontakt_id}")
def update_kontakt(kontakt_id: int, k: PartnerKontakt):
    conn = database.get_db()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE partner_kontakti SET ime_priimek=?, oddelek=?, funkcija=?, email=?, telefon=?, primarni=?
        WHERE id = ?
    """, (k.ime_priimek, k.oddelek, k.funkcija, k.email, k.telefon, k.primarni, kontakt_id))
    conn.commit()
    conn.close()
    return {"status": "success"}

@router.delete("/api/partnerji/kontakti/{kontakt_id}")
def delete_kontakt(kontakt_id: int):
    conn = database.get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM partner_kontakti WHERE id = ?", (kontakt_id,))
    conn.commit()
    conn.close()
    return {"status": "success"}

@router.post("/api/partnerji/{id}/interakcije")
def add_interakcija(id: int, i: PartnerInterakcija):
    conn = database.get_db()
    cursor = conn.cursor()
    datum = i.datum if i.datum else get_now_slo()
    cursor.execute("""
        INSERT INTO partner_interakcije (partner_id, datum, tip, vsebina, naslednji_korak)
        VALUES (?, ?, ?, ?, ?)
    """, (id, datum, i.tip, i.vsebina, i.naslednji_korak))
    conn.commit()
    new_id = cursor.lastrowid
    conn.close()
    return {"status": "success", "id": new_id}

@router.delete("/api/partnerji/interakcije/{int_id}")
def delete_interakcija(int_id: int):
    conn = database.get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM partner_interakcije WHERE id = ?", (int_id,))
    conn.commit()
    conn.close()
    return {"status": "success"}

@router.post("/api/partnerji/{id}/opravila")
def add_opravilo(id: int, o: PartnerOpravilo):
    conn = database.get_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO partner_opravila (partner_id, naslov, opis, rok, status, prioriteta)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (id, o.naslov, o.opis, o.rok, o.status, o.prioriteta))
    conn.commit()
    new_id = cursor.lastrowid
    conn.close()
    return {"status": "success", "id": new_id}

@router.put("/api/partnerji/opravila/{opr_id}")
def update_opravilo(opr_id: int, o: PartnerOpravilo):
    conn = database.get_db()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE partner_opravila SET naslov=?, opis=?, rok=?, status=?, prioriteta=?
        WHERE id = ?
    """, (o.naslov, o.opis, o.rok, o.status, o.prioriteta, opr_id))
    conn.commit()
    conn.close()
    return {"status": "success"}

@router.delete("/api/partnerji/opravila/{opr_id}")
def delete_opravilo(opr_id: int):
    conn = database.get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM partner_opravila WHERE id = ?", (opr_id,))
    conn.commit()
    conn.close()
    return {"status": "success"}

@router.get("/api/crm/tasks")
def get_all_tasks():
    conn = database.get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT o.*, p.naziv as partner_naziv 
        FROM partner_opravila o 
        JOIN partnerji p ON o.partner_id = p.id 
        WHERE o.status != 'Opravljeno'
        ORDER BY o.rok ASC, o.prioriteta DESC LIMIT 20
    """)
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

@router.get("/api/crm/interactions")
def get_all_interactions():
    conn = database.get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT i.*, p.naziv as partner_naziv 
        FROM partner_interakcije i 
        JOIN partnerji p ON i.partner_id = p.id 
        ORDER BY i.datum DESC LIMIT 20
    """)
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

@router.get("/api/partnerji/search")
def search_partnerji(q: str):
    conn = database.get_db()
    cursor = conn.cursor()
    # Preiščemo naziv, davčno številko in ulico
    query = "%" + q + "%"
    cursor.execute("""
        SELECT * FROM partnerji 
        WHERE naziv LIKE ? OR davcna_stevilka LIKE ? OR ulica LIKE ?
        ORDER BY naziv LIMIT 20
    """, (query, query, query))
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

@router.delete("/api/partnerji/{id}")
def delete_partner(id: int):
    conn = database.get_db()
    cursor = conn.cursor()
    
    # Preveri, če ima partner vezane dokumente
    cursor.execute("SELECT COUNT(*) as cnt FROM dokumenti WHERE partner_id = ?", (id,))
    if cursor.fetchone()['cnt'] > 0:
        conn.close()
        raise HTTPException(status_code=400, detail="Partnerja ni mogoče brisati, ker ima vezane dokumente.")
    
    # Preveri, če ima partner vezane bančne izpiske
    cursor.execute("SELECT COUNT(*) as cnt FROM izpiski_postavke WHERE partner_id = ?", (id,))
    if cursor.fetchone()['cnt'] > 0:
        conn.close()
        raise HTTPException(status_code=400, detail="Partnerja ni mogoče brisati, ker ima vezane bančne izpiske.")
        
    cursor.execute("DELETE FROM partnerji WHERE id = ?", (id,))
    conn.commit()
    conn.close()
    return {"status": "success"}

@router.get("/api/partnerji/search_bizi")
def search_bizi(q: str):
    """Poišče podjetje na Bizi.si in vrne seznam zadetkov."""
    url = f"https://www.bizi.si/iskanje?q={q}"
    headers = {"User-Agent": "Mozilla/5.0"}
    try:
        r = requests.get(url, headers=headers, timeout=10)
        r.raise_for_status()
        soup = BeautifulSoup(r.text, 'html.parser')
        results = []
        rows = soup.select(".b-table-row")
        for row in rows:
            name_el = row.select_one(".b-link-company")
            if not name_el: continue
            cols = row.select(".col")
            if len(cols) < 6: continue
            name = name_el.get_text(strip=True)
            href = name_el['href'] if name_el.has_attr('href') else ""
            link = href if href.startswith("http") else "https://www.bizi.si" + href
            naslov_el = row.select_one('a[href*="openMapTis"]') or cols[2].select_one('a')
            naslov = naslov_el.get_text(strip=True) if naslov_el else cols[2].get_text(strip=True)
            posta_kraj = cols[3].get_text(strip=True)
            davcna_raw = cols[5].get_text(strip=True)
            is_zavezanec = "SI" in davcna_raw
            davcna = davcna_raw.replace("SI", "").strip()
            results.append({
                "naziv": name, "naslov": naslov, "posta_kraj": posta_kraj,
                "davcna_stevilka": davcna, "zavezanec_za_ddv": is_zavezanec, "link": link
            })
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Napaka pri iskanju na Bizi.si: {str(e)}")

@router.get("/api/partnerji/bizi_detail")
def bizi_detail(url: str):
    """Pridobi podrobne kontaktne podatke in TRR podjetja z Bizi.si."""
    headers = {"User-Agent": "Mozilla/5.0"}
    try:
        r = requests.get(url, headers=headers, timeout=10)
        r.raise_for_status()
        soup = BeautifulSoup(r.text, 'html.parser')
        phone_el = soup.select_one("a.i-ostalo-telefon")
        phone = phone_el.get_text(strip=True) if phone_el else ""
        email_el = soup.select_one("#ctl00_ctl00_cphMain_CompanyDetailsTitleBasic1_aMail")
        email = email_el.get_text(strip=True) if email_el else ""
        zavezanec = False
        for label in soup.select(".b-attr-name, .b-attr-label"):
            if "Zavezanec za DDV" in label.get_text(strip=True):
                v = label.find_next_sibling("div", class_="b-attr-value")
                if v and "Da" in v.get_text(): zavezanec = True
                break
        trr = ""
        try:
            r_trr = requests.get(url.rstrip('/') + "/trr-in-blokade/", headers=headers, timeout=5)
            if r_trr.ok:
                soup_trr = BeautifulSoup(r_trr.text, 'html.parser')
                trr_el = soup_trr.select_one("div.b-attr-value-item-trr span.b-attr-value:not(.b-text-line-through)")
                if trr_el: trr = trr_el.get_text(strip=True).replace("IBAN", "").strip()
        except: pass
        return {"telefon": phone, "email": email, "zavezanec_za_ddv": zavezanec, "trr": trr}
    except Exception as e:
        return {"telefon": "", "email": "", "zavezanec_za_ddv": False, "trr": "", "error": str(e)}

@router.get("/api/partnerji/{id}/ujp_check")
def ujp_check_partner(id: int):
    """
    Preveri ali je partner vpisan v UJP B2B register (javna baza).
    Rezultat shrani v partnerji.ujp_subjekt za kasnejšo uporabo.
    """
    conn = database.get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT naziv, davcna_stevilka, ujp_subjekt, ujp_zadnji_check FROM partnerji WHERE id = ?", (id,))
        partner = cursor.fetchone()
        if not partner:
            raise HTTPException(status_code=404, detail="Partner ne obstaja.")

        davcna = re.sub(r'[^0-9]', '', partner['davcna_stevilka'] or '')
        ujp_subjekt = False
        opomba = ""

        try:
            # UJP javni iskalnik — poskusimo z GET zahtevo
            url = f"https://www.ujp.gov.si/subjekti/?davcna={davcna}"
            resp = requests.get(url, timeout=5)
            # Hevristično: če stran vsebuje davčno številko v tabeli rezultatov, je subjekt registriran
            if davcna and davcna in resp.text and 'e-Račun' in resp.text:
                ujp_subjekt = True
                opomba = "Partner je najden v UJP registru subjektov."
            else:
                ujp_subjekt = False
                opomba = "Partner ni najden v UJP registru (ali ni dostopa do interneta)."
        except Exception as e:
            opomba = f"Preverjanje ni uspelo: {str(e)[:100]}"

        from datetime import date
        cursor.execute(
            "UPDATE partnerji SET ujp_subjekt = ?, ujp_zadnji_check = ? WHERE id = ?",
            (1 if ujp_subjekt else 0, date.today().isoformat(), id)
        )
        conn.commit()
        return {
            "partner_id": id,
            "naziv": partner['naziv'],
            "davcna_stevilka": partner['davcna_stevilka'],
            "ujp_subjekt": ujp_subjekt,
            "ujp_zadnji_check": date.today().isoformat(),
            "opomba": opomba
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()
