from utils import *
import re
import traceback
from fastapi import APIRouter, HTTPException, UploadFile, File, Response
from typing import List, Optional, Any
import database
import uuid
import time
from datetime import datetime, date
from schemas import *
import requests
import json
import base64
import os
import knjizenje

router = APIRouter()

@router.get("/api/place")
def get_place():
    conn = database.get_db()
    c = conn.cursor()
    c.execute("""
        SELECT p.*, z.ime_priimek as zaposleni_ime 
        FROM place p 
        LEFT JOIN zaposleni z ON p.zaposleni_id = z.id
        ORDER BY p.leto DESC, 
        CASE p.mesec 
            WHEN 'Januar' THEN 1 WHEN 'Februar' THEN 2 WHEN 'Marec' THEN 3 WHEN 'April' THEN 4 
            WHEN 'Maj' THEN 5 WHEN 'Junij' THEN 6 WHEN 'Julij' THEN 7 WHEN 'Avgust' THEN 8 
            WHEN 'September' THEN 9 WHEN 'Oktober' THEN 10 WHEN 'November' THEN 11 WHEN 'December' THEN 12
            ELSE 0 
        END DESC
    """)
    rows = c.fetchall()
    conn.close()
    return [dict(r) for r in rows]

@router.post("/api/place")
def create_placa(p: Placa):
    conn = database.get_db()
    c = conn.cursor()
    c.execute("""
        INSERT INTO place (zaposleni_id, mesec, leto, vrsta_zaposlitve, bruto_placa, neto_izplacilo, 
        znesek_piz, znesek_zz, znesek_zap, znesek_starsevsko, znesek_ozp, znesek_do, znesek_akontacija_doh, 
        potni_stroski, malica, st_malic, cena_malice, st_dni_pot, km_enosmerno, cena_km,
        znesek_skupaj, sklic, zapadlost, placan, konto_prispevkov)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (p.zaposleni_id, p.mesec, p.leto, p.vrsta_zaposlitve, p.bruto_placa, p.neto_izplacilo, 
          p.znesek_piz, p.znesek_zz, p.znesek_zap, p.znesek_starsevsko, p.znesek_ozp, p.znesek_do, p.znesek_akontacija_doh, 
          p.potni_stroski, p.malica, p.st_malic, p.cena_malice, p.st_dni_pot, p.km_enosmerno, p.cena_km,
          p.znesek_skupaj, p.sklic, p.zapadlost, 1 if p.placan else 0, p.konto_prispevkov))
    conn.commit()
    conn.close()
    return {"status": "success"}

@router.put("/api/place/{id}")
def update_placa(id: int, p: Placa):
    conn = database.get_db()
    c = conn.cursor()
    c.execute("""
        UPDATE place SET zaposleni_id=?, mesec=?, leto=?, vrsta_zaposlitve=?, bruto_placa=?, neto_izplacilo=?, 
        znesek_piz=?, znesek_zz=?, znesek_zap=?, znesek_starsevsko=?, znesek_ozp=?, znesek_do=?, znesek_akontacija_doh=?, 
        potni_stroski=?, malica=?, st_malic=?, cena_malice=?, st_dni_pot=?, km_enosmerno=?, cena_km=?,
        znesek_skupaj=?, sklic=?, zapadlost=?, placan=?, konto_prispevkov=?
        WHERE id=?
    """, (p.zaposleni_id, p.mesec, p.leto, p.vrsta_zaposlitve, p.bruto_placa, p.neto_izplacilo, 
          p.znesek_piz, p.znesek_zz, p.znesek_zap, p.znesek_starsevsko, p.znesek_ozp, p.znesek_do, p.znesek_akontacija_doh, 
          p.potni_stroski, p.malica, p.st_malic, p.cena_malice, p.st_dni_pot, p.km_enosmerno, p.cena_km,
          p.znesek_skupaj, p.sklic, p.zapadlost, 1 if p.placan else 0, p.konto_prispevkov, id))
    conn.commit()
    conn.close()
    return {"status": "success"}

@router.delete("/api/place/{id}")
def delete_placa(id: int, force: bool = False):
    conn = database.get_db()
    c = conn.cursor()
    # K2 — ZdavP-2: 5-letna hramba plačilnih listin
    if not force:
        c.execute("SELECT leto, mesec FROM place WHERE id=?", (id,))
        row = c.fetchone()
        if row:
            datum_str = f"{row['leto']}-{['Januar','Februar','Marec','April','Maj','Junij','Julij','Avgust','September','Oktober','November','December'].index(row['mesec'])+1:02d}-01" if row['mesec'] else f"{row['leto']}-01-01"
            h = _preveri_hrambo(datum_str, 'placa')
            if not h['dovoljeno']:
                conn.close()
                return {"status": "warning", "hramba_do": h['hramba_do'],
                        "let": h['let'], "message": h['message']}
    # Obstoječa logika brisanja — nedotaknjena
    c.execute("DELETE FROM place WHERE id=?", (id,))
    conn.commit()
    conn.close()
    return {"status": "success"}

@router.get("/api/place/predlagaj_vrednosti")
def predlagaj_vrednosti(zaposleni_id: int, leto: int, mesec: str):
    # 1. Count working days in the month/year
    month_map = {
        'Januar': 1, 'Februar': 2, 'Marec': 3, 'April': 4, 'Maj': 5, 'Junij': 6,
        'Julij': 7, 'Avgust': 8, 'September': 9, 'Oktober': 10, 'November': 11, 'December': 12
    }
    month = month_map.get(mesec)
    if not month:
        raise HTTPException(status_code=400, detail="Neveljaven mesec.")
    
    import calendar
    from datetime import date
    
    try:
        num_days = calendar.monthrange(leto, month)[1]
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Neveljavno leto ali mesec: {str(e)}")
        
    workdays = 0
    # Fixed Slovenian holidays
    fixed_holidays = [
        (1, 1), (1, 2), # Novo leto
        (2, 8), # Prešernov dan
        (4, 27), # Dan upora proti okupatorju
        (5, 1), (5, 2), # Praznik dela
        (6, 25), # Dan državnosti
        (8, 15), # Marijino vnebovzetje
        (10, 31), # Dan reformacije
        (11, 1), # Dan spomina na mrtve
        (12, 25), # Božič
        (12, 26) # Dan samostojnosti in enotnosti
    ]
    
    # Easter Mondays
    easter_mondays = {
        2024: (4, 1),
        2025: (4, 21),
        2026: (4, 6),
        2027: (3, 29),
        2028: (4, 17),
        2029: (4, 2),
        2030: (4, 22)
    }
    
    easter_mon = easter_mondays.get(leto)
    
    for day in range(1, num_days + 1):
        d = date(leto, month, day)
        if d.weekday() < 5: # Monday to Friday
            is_holiday = (month, day) in fixed_holidays
            if not is_holiday and easter_mon and month == easter_mon[0] and day == easter_mon[1]:
                is_holiday = True
            if not is_holiday:
                workdays += 1
                
    # Proposed lunch allowance: 7.96 EUR per day
    predlagana_malica = round(workdays * 7.96, 2)
    
    # 2. Get proposed travel expenses from potni nalogi
    conn = database.get_db()
    c = conn.cursor()
    c.execute("""
        SELECT SUM(skupni_znesek) as skupaj_pn
        FROM potni_nalogi
        WHERE zaposleni_id = ?
          AND datum_izdaje LIKE ?
    """, (zaposleni_id, f"{leto}-{month:02d}-%"))
    row = c.fetchone()

    # 3. Get employee saved distance
    c.execute("SELECT razdalja_do_podjetja FROM zaposleni WHERE id = ?", (zaposleni_id,))
    z_row = c.fetchone()
    razdalja = z_row['razdalja_do_podjetja'] if z_row else 0.0
    
    conn.close()
    
    potni_stroski = 0.0
    if row and row['skupaj_pn'] is not None:
        potni_stroski = round(row['skupaj_pn'], 2)
        
    return {
        "delovni_dni": workdays,
        "malica": predlagana_malica,
        "potni_stroski": potni_stroski,
        "razdalja": razdalja
    }

@router.get("/api/zaposleni")
def get_zaposleni():
    conn = database.get_db()
    c = conn.cursor()
    c.execute("SELECT * FROM zaposleni ORDER BY ime_priimek")
    rows = c.fetchall()
    conn.close()
    return [dict(r) for r in rows]

@router.post("/api/zaposleni")
def create_zaposleni(z: Zaposleni):
    conn = database.get_db()
    c = conn.cursor()

    c.execute("""
        INSERT INTO zaposleni (
            ime_priimek, naslov, davcna_stevilka, iban, delovno_mesto, 
            datum_rojstva, stevilo_otrok, invalid_ali_nega, delovna_doba_leta, 
            dopust_odmerjen, dopust_rocni_popravek, posta_kraj, razdalja_do_podjetja
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        z.ime_priimek, z.naslov, z.davcna_stevilka, z.iban, z.delovno_mesto,
        z.datum_rojstva, z.stevilo_otrok, z.invalid_ali_nega, z.delovna_doba_leta,
        z.dopust_odmerjen, z.dopust_rocni_popravek, z.posta_kraj, z.razdalja_do_podjetja
    ))
    conn.commit()
    conn.close()
    return {"status": "success"}

@router.put("/api/zaposleni/{id}")
def update_zaposleni(id: int, z: Zaposleni):
    conn = database.get_db()
    c = conn.cursor()

    c.execute("""
        UPDATE zaposleni SET 
            ime_priimek=?, naslov=?, davcna_stevilka=?, iban=?, delovno_mesto=?, 
            datum_rojstva=?, stevilo_otrok=?, invalid_ali_nega=?, delovna_doba_leta=?, 
            dopust_odmerjen=?, dopust_rocni_popravek=?, posta_kraj=?, razdalja_do_podjetja=? 
        WHERE id=?
    """, (
        z.ime_priimek, z.naslov, z.davcna_stevilka, z.iban, z.delovno_mesto,
        z.datum_rojstva, z.stevilo_otrok, z.invalid_ali_nega, z.delovna_doba_leta,
        z.dopust_odmerjen, z.dopust_rocni_popravek, z.posta_kraj, z.razdalja_do_podjetja, id
    ))
    conn.commit()
    conn.close()
    return {"status": "success"}

@router.delete("/api/zaposleni/{id}")
def delete_zaposleni(id: int):
    conn = database.get_db()
    c = conn.cursor()
    c.execute("DELETE FROM zaposleni WHERE id=?", (id,))
    conn.commit()
    conn.close()
    return {"status": "success"}

@router.get("/api/potni_nalogi")
def get_potni_nalogi():
    conn = database.get_db()
    c = conn.cursor()
    c.execute("""
        SELECT p.*, z.ime_priimek as zaposleni_ime 
        FROM potni_nalogi p 
        LEFT JOIN zaposleni z ON p.zaposleni_id = z.id
        ORDER BY p.id DESC
    """)
    rows = c.fetchall()
    conn.close()
    return [dict(r) for r in rows]

@router.get("/api/potni_nalogi/next_stevilka")
def next_pn_stevilka(leto: str):
    conn = database.get_db()
    c = conn.cursor()
    c.execute("SELECT stevilka_naloga FROM potni_nalogi WHERE stevilka_naloga LIKE ? ORDER BY id DESC LIMIT 1", (f"%{leto}",))
    row = c.fetchone()
    conn.close()
    if row and row['stevilka_naloga']:
        try:
            num = int(row['stevilka_naloga'].split('-')[0])
            return {"stevilka": f"{num+1:03d}-{leto}"}
        except:
            pass
    return {"stevilka": f"001-{leto}"}

@router.post("/api/potni_nalogi")
def create_potni_nalog(p: PotniNalog):
    conn = database.get_db()
    c = conn.cursor()
    c.execute("""
        INSERT INTO potni_nalogi (stevilka_naloga, zaposleni_id, vozilo, namen, datum_izdaje, 
        datum_cas_odhoda, datum_cas_povratka, relacija_zacetek, relacija_cilj, relacija_konec, 
        razdalja_km, znesek_kilometrine, znesek_dnevnice, skupni_znesek)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (p.stevilka_naloga, p.zaposleni_id, p.vozilo, p.namen, p.datum_izdaje, p.datum_cas_odhoda, 
          p.datum_cas_povratka, p.relacija_zacetek, p.relacija_cilj, p.relacija_konec, p.razdalja_km, 
          p.znesek_kilometrine, p.znesek_dnevnice, p.skupni_znesek))
    conn.commit()
    conn.close()
    return {"status": "success"}

@router.put("/api/potni_nalogi/{id}")
def update_potni_nalog(id: int, p: PotniNalog):
    conn = database.get_db()
    c = conn.cursor()
    c.execute("""
        UPDATE potni_nalogi SET stevilka_naloga=?, zaposleni_id=?, vozilo=?, namen=?, datum_izdaje=?, 
        datum_cas_odhoda=?, datum_cas_povratka=?, relacija_zacetek=?, relacija_cilj=?, relacija_konec=?, 
        razdalja_km=?, znesek_kilometrine=?, znesek_dnevnice=?, skupni_znesek=?
        WHERE id=?
    """, (p.stevilka_naloga, p.zaposleni_id, p.vozilo, p.namen, p.datum_izdaje, p.datum_cas_odhoda, 
          p.datum_cas_povratka, p.relacija_zacetek, p.relacija_cilj, p.relacija_konec, p.razdalja_km, 
          p.znesek_kilometrine, p.znesek_dnevnice, p.skupni_znesek, id))
    conn.commit()
    conn.close()
    return {"status": "success"}

@router.delete("/api/potni_nalogi/{id}")
def delete_potni_nalog(id: int, force: bool = False):
    conn = database.get_db()
    c = conn.cursor()
    # K2 — ZdavP-2: 5-letna hramba potnih nalogov
    if not force:
        c.execute("SELECT datum_izdaje FROM potni_nalogi WHERE id=?", (id,))
        row = c.fetchone()
        if row and row['datum_izdaje']:
            h = _preveri_hrambo(row['datum_izdaje'], 'potni_nalog')
            if not h['dovoljeno']:
                conn.close()
                return {"status": "warning", "hramba_do": h['hramba_do'],
                        "let": h['let'], "message": h['message']}
    # Obstoječa logika brisanja — nedotaknjena
    c.execute("DELETE FROM potni_nalogi WHERE id=?", (id,))
    conn.commit()
    conn.close()
    return {"status": "success"}

@router.get("/api/vozila")
def get_vozila():
    conn = database.get_db()
    c = conn.cursor()
    c.execute("SELECT DISTINCT vozilo FROM potni_nalogi WHERE vozilo IS NOT NULL AND vozilo != ''")
    rows = c.fetchall()
    conn.close()
    return [r[0] for r in rows]

@router.get("/api/tarife")
def get_tarife():
    conn = database.get_db()
    c = conn.cursor()
    c.execute("SELECT * FROM tarife_potanj WHERE id = 1")
    row = c.fetchone()
    
    # Preveri, če je danes 1. v mesecu in ali smo ta mesec že preverili
    danes = datetime.now()
    if row and danes.day == 1:
        zadnje = row['zadnje_preverjanje']
        if not zadnje or not zadnje.startswith(danes.strftime("%Y-%m")):
            # Scrapanje - za primer zanesljivosti poskusimo dobiti z urlja, sicer uporabimo statične iz baze
            try:
                # Tu bi šla koda za strganje: requests.get(...)
                pass
                
                # Zapišemo, da smo preverili
                c.execute("UPDATE tarife_potanj SET zadnje_preverjanje=? WHERE id=1", (datetime.now().strftime("%Y-%m-%d %H:%M:%S"),))
                conn.commit()
            except Exception as e:
                print("Napaka pri avtomatskem preverjanju tarif:", e)
                
    # Osvežen row
    c.execute("SELECT * FROM tarife_potanj WHERE id = 1")
    row = c.fetchone()
    conn.close()
    
    if not row:
        return {"kilometrina": 0.43, "dnevnica_polna": 27.81, "dnevnica_polovicna": 13.88, "dnevnica_znizana": 9.69}
    return dict(row)

@router.get("/api/place/{id}/pdf")
def get_placa_pdf(id: int):
    """Generira PDF plačilno listo (obračunski list) za zaposlenega ali s.p. (ZDR-1, čl. 134)."""
    from fpdf import FPDF
    conn = database.get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            SELECT p.*, z.ime_priimek, z.iban as zaposleni_iban, z.naslov as zaposleni_naslov,
                   z.davcna_stevilka as zaposleni_davcna
            FROM place p
            LEFT JOIN zaposleni z ON p.zaposleni_id = z.id
            WHERE p.id = ?
        """, (id,))
        p = cursor.fetchone()
        if not p:
            raise HTTPException(status_code=404, detail="Obračun plače ne obstaja.")
        cursor.execute("SELECT * FROM nastavitve WHERE id = 1")
        company = cursor.fetchone()
    finally:
        conn.close()

    pdf = FPDF()
    pdf.add_font('DejaVu', '', 'DejaVuSans.ttf')
    pdf.add_font('DejaVu', 'B', 'DejaVuSans-Bold.ttf')
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()

    # Glava
    pdf.set_font('DejaVu', 'B', 13)
    pdf.set_text_color(25, 42, 86)
    vrsta_doc = "OBRAČUN PRISPEVKOV" if p['vrsta_zaposlitve'] in ['sp_100', 'sp_50'] else "PLAČILNA LISTA"
    pdf.cell(0, 9, f"{vrsta_doc} — {p['mesec']} {p['leto']}", ln=1)
    pdf.set_text_color(0, 0, 0)
    pdf.set_draw_color(25, 42, 86)
    pdf.set_line_width(0.4)
    pdf.line(10, pdf.get_y(), 200, pdf.get_y())
    pdf.ln(3)

    # Podjetje in zaposleni
    pdf.set_font('DejaVu', '', 9)
    if company:
        pdf.cell(95, 5, f"Delodajalec: {company['naziv']}", ln=0)
    pdf.cell(95, 5, f"Delavec / Zavezanec: {p['ime_priimek'] or ''}", ln=1)
    if company:
        pdf.cell(95, 5, f"ID za DDV: {company.get('davcna_stevilka', '')}", ln=0)
    if p['zaposleni_davcna']:
        pdf.cell(95, 5, f"Davčna št.: {p['zaposleni_davcna']}", ln=1)
    else:
        pdf.ln(5)
    pdf.ln(4)

    # Tabela obračuna
    def vrstica(opis, znesek, bold=False, sign=''):
        pdf.set_font('DejaVu', 'B' if bold else '', 9)
        pdf.cell(130, 6, opis, border='B', ln=0)
        z_str = format_money(abs(znesek)) if znesek else "0,00 €"
        pdf.cell(60, 6, f"{sign}{z_str}", border='B', ln=1, align='R')

    pdf.set_fill_color(230, 230, 230)
    pdf.set_font('DejaVu', 'B', 9)
    pdf.cell(130, 7, 'Postavka', 1, 0, 'L', True)
    pdf.cell(60, 7, 'Znesek', 1, 1, 'R', True)

    if p['vrsta_zaposlitve'] in ['sp_100', 'sp_50']:
        # S.P. format
        vrstica("Osnova za prispevke (bruto)", p['bruto_placa'], bold=True)
        vrstica("  − Pokojninsko in invalidsko zavarovanje (PIZ)", p['znesek_piz'], sign='−')
        vrstica("  − Zdravstveno zavarovanje (ZZ)", p['znesek_zz'], sign='−')
        vrstica("  − Zavarovanje za primer brezposelnosti", p['znesek_zap'], sign='−')
        vrstica("  − Starševsko varstvo", p['znesek_starsevsko'], sign='−')
        vrstica("  − Obvezno zdravstveno zavarovanje (OZP)", p['znesek_ozp'], sign='−')
        vrstica("  − Dolgotrajna oskrba (DO)", p['znesek_do'] or 0, sign='−')
        pdf.set_font('DejaVu', 'B', 9)
        skupaj_prisp = ((p['znesek_piz'] or 0) + (p['znesek_zz'] or 0) + (p['znesek_zap'] or 0) +
                        (p['znesek_starsevsko'] or 0) + (p['znesek_ozp'] or 0) + (p['znesek_do'] or 0))
        vrstica("SKUPAJ PRISPEVKI S.P.", skupaj_prisp, bold=True)
        if p['potni_stroski']:
            vrstica("  + Povračilo prevoza na delo", p['potni_stroski'], sign='+')
        if p['malica']:
            vrstica("  + Povračilo prehrane med delom", p['malica'], sign='+')
        pdf.ln(2)
        pdf.set_font('DejaVu', 'B', 11)
        pdf.set_fill_color(200, 220, 255)
        pdf.cell(130, 8, "SKUPAJ ZA PLAČILO:", 'T', 0, 'L', True)
        pdf.cell(60, 8, format_money(p['znesek_skupaj'] or skupaj_prisp), 'T', 1, 'R', True)
    else:
        # Zaposleni format
        vrstica("BRUTO PLAČA", p['bruto_placa'], bold=True)
        vrstica("  − Prispevek PIZ delojemalec (15,5%)", p['znesek_piz'], sign='−')
        vrstica("  − Prispevek ZZ delojemalec (6,36%)", p['znesek_zz'], sign='−')
        vrstica("  − Prispevek za brezposelnost (0,14%)", p['znesek_zap'], sign='−')
        vrstica("  − Starševsko varstvo (0,10%)", p['znesek_starsevsko'], sign='−')
        vrstica("  − OZP (0,53%)", p['znesek_ozp'], sign='−')
        osnova_doh = (p['bruto_placa'] or 0) - ((p['znesek_piz'] or 0) + (p['znesek_zz'] or 0) +
                     (p['znesek_zap'] or 0) + (p['znesek_starsevsko'] or 0) + (p['znesek_ozp'] or 0))
        vrstica("= OSNOVA ZA DOHODNINO", osnova_doh, bold=True)
        vrstica("  − Akontacija dohodnine", p['znesek_akontacija_doh'] or 0, sign='−')
        vrstica("= NETO PLAČA", p['neto_izplacilo'], bold=True)
        if p['potni_stroski']:
            vrstica("  + Povračilo prevoza", p['potni_stroski'], sign='+')
        if p['malica']:
            vrstica("  + Povračilo prehrane", p['malica'], sign='+')
        pdf.ln(2)
        pdf.set_font('DejaVu', 'B', 11)
        pdf.set_fill_color(200, 220, 255)
        pdf.cell(130, 8, "SKUPAJ ZA IZPLAČILO:", 'T', 0, 'L', True)
        pdf.cell(60, 8, format_money(p['znesek_skupaj'] or 0), 'T', 1, 'R', True)

    # Plačilni podatki
    pdf.ln(5)
    pdf.set_font('DejaVu', '', 8)
    pdf.set_text_color(80, 80, 80)
    if p['zaposleni_iban']:
        pdf.cell(0, 4, f"IBAN za izplačilo: {p['zaposleni_iban']}", ln=1)
    if p['sklic']:
        pdf.cell(0, 4, f"Sklic: {p['sklic']}", ln=1)
    if p['zapadlost']:
        pdf.cell(0, 4, f"Rok izplačila: {p['zapadlost']}", ln=1)
    pdf.set_text_color(0, 0, 0)

    pdf_bytes = pdf.output()
    fn = f"placilna_lista_{p['mesec']}_{p['leto']}_{(p['ime_priimek'] or 'sp').replace(' ', '_')}.pdf"
    return Response(content=bytes(pdf_bytes), media_type="application/pdf",
                    headers={"Content-Disposition": f"attachment; filename={fn}"})
