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

@router.get("/api/priloge/{parent_type}/{parent_id}")
def get_priloge(parent_type: str, parent_id: int):
    conn = database.get_db()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT id, filename, original_name, uploaded_at FROM priloge WHERE parent_type=? AND parent_id=? ORDER BY uploaded_at",
        (parent_type, parent_id)
    )
    rows = cursor.fetchall()
    conn.close()
    return [{**dict(r), "url": f"/uploads/{r['filename']}"} for r in rows]

@router.delete("/api/priloge/{id}")
def delete_priloga(id: int):
    conn = database.get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT filename FROM priloge WHERE id=?", (id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Priloga ni najdena.")
    try:
        (UPLOADS_DIR / row['filename']).unlink(missing_ok=True)
    except Exception:
        pass
    cursor.execute("DELETE FROM priloge WHERE id=?", (id,))
    conn.commit()
    conn.close()
    return {"status": "deleted"}

@router.delete("/api/dokumenti/{id}")
def delete_dokument(id: int, force: bool = False):
    try:
        conn = database.get_db()
        cursor = conn.cursor()
        # Faza 2: Preverjanje hramba roka pred brisanjem (ZDDV-1, čl. 85)
        if not force:
            cursor.execute("SELECT datum_izdaje, tip, hramba_zakljucena FROM dokumenti WHERE id = ?", (id,))
            doc_row = cursor.fetchone()
            if doc_row:
                h = _preveri_hrambo(doc_row['datum_izdaje'] or '', doc_row['tip'] or '')
                if not h['dovoljeno']:
                    conn.close()
                    return {"status": "warning", "hramba_do": h['hramba_do'],
                            "let": h['let'], "message": h['message']}
        # Obstoječa logika brisanja — nedotaknjena
        cursor.execute("DELETE FROM dokumenti_postavke WHERE dokument_id = ?", (id,))
        cursor.execute("DELETE FROM dokumenti WHERE id = ?", (id,))
        conn.commit()
        conn.close()
        return {"status": "success"}
    except Exception as e:
        if 'conn' in locals(): conn.close()
        print(f"Napaka pri brisanju dokumenta {id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Napaka pri brisanju: {str(e)}")

@router.get("/api/dokumenti/check_stevilka")
def check_stevilka(stevilka: str, tip: str, exclude_id: Optional[int] = None):
    """Preveri, ali dokument s to številko že obstaja."""
    conn = database.get_db()
    cursor = conn.cursor()
    if exclude_id:
        cursor.execute(
            "SELECT id, stevilka, partner_id FROM dokumenti WHERE tip = ? AND stevilka = ? AND id != ?",
            (tip, stevilka.strip(), exclude_id)
        )
    else:
        cursor.execute(
            "SELECT id, stevilka, partner_id FROM dokumenti WHERE tip = ? AND stevilka = ?",
            (tip, stevilka.strip())
        )
    row = cursor.fetchone()
    conn.close()
    if row:
        return {"obstaja": True, "id": row["id"]}
    return {"obstaja": False}

@router.get("/api/dokumenti/eslog/{id}")
def get_eslog_xml(id: int):
    conn = database.get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM dokumenti WHERE id = ?", (id,))
    inv = cursor.fetchone()
    if not inv:
        conn.close()
        raise HTTPException(status_code=404, detail="Račun ni najden")
        
    cursor.execute("SELECT * FROM partnerji WHERE id = ?", (inv['partner_id'],))
    partner = cursor.fetchone()
    if not partner:
        partner = {"naziv": "Neznan partner", "ulica": "", "postna_stevilka": "", "kraj": "", "drzava": "Slovenija", "davcna_stevilka": "", "zavezanec_za_ddv": 0, "trr": ""}
        
    cursor.execute("SELECT * FROM dokumenti_postavke WHERE dokument_id = ?", (id,))
    items = [dict(r) for r in cursor.fetchall()]
    
    cursor.execute("SELECT * FROM nastavitve WHERE id = 1")
    company = cursor.fetchone()
    conn.close()
    
    xml_content = generate_eslog_xml(dict(inv), dict(company), dict(partner), items)
    
    filename = f"eslog_{inv['stevilka']}.xml"
    return Response(content=xml_content, media_type="application/xml", headers={
        "Content-Disposition": f"attachment; filename={filename}"
    })

@router.get("/api/dokumenti/{tip}")

def get_dokumenti(tip: str):
    conn = database.get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT d.*, p.naziv as partner_naziv,
        (SELECT EXISTS(SELECT 1 FROM priloge WHERE parent_type = 'dokumenti' AND parent_id = d.id)) as ima_prilogo,
        (SELECT MAX(poslano_at) FROM email_log WHERE dokument_id = d.id AND status = 'success') as zadnje_poslano,
        IFNULL((SELECT SUM(znesek) FROM placila_povezave WHERE dokument_id = d.id), 0) as placano_znesek
        FROM dokumenti d
        LEFT JOIN partnerji p ON d.partner_id = p.id
        WHERE d.tip = ? ORDER BY d.id DESC
    """, (tip,))
    rows = cursor.fetchall()
    conn.close()
    
    result = []
    for r in rows:
        d = dict(r)
        manual_sum = get_sum_delna_placila(d.get('delna_placila'))
        d['placano_znesek'] = round(max(d['placano_znesek'] or 0.0, d.get('delno_placano_znesek') or 0.0) + manual_sum, 2)
        result.append(d)
    return result

@router.get("/api/dokumenti/detajl/{id}")
def get_dokument_detajl(id: int):
    conn = database.get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT d.*, p.naziv as partner_naziv, p.email as partner_email
        FROM dokumenti d
        LEFT JOIN partnerji p ON d.partner_id = p.id
        WHERE d.id = ?
    """, (id,))
    doc = cursor.fetchone()
    if not doc:
        conn.close()
        raise HTTPException(status_code=404, detail="Dokument ni najden")
    
    cursor.execute("SELECT * FROM dokumenti_postavke WHERE dokument_id = ?", (id,))
    items = cursor.fetchall()
    
    cursor.execute("SELECT MAX(poslano_at) FROM email_log WHERE dokument_id = ? AND status = 'success'", (id,))
    sent_row = cursor.fetchone()
    conn.close()
    
    res = dict(doc)
    res['postavke'] = [dict(i) for i in items]
    res['zadnje_poslano'] = sent_row[0] if sent_row else None
    return res

@router.post("/api/dokumenti")
def create_dokument(doc: Dokument):
    conn = database.get_db()
    cursor = conn.cursor()
    
    # Samodejno oštevilčevanje, če številka ni podana
    stevilka = doc.stevilka
    interna_st = doc.interna_stevilka
    
    if not stevilka or stevilka == "":
        cursor.execute("SELECT stevilka FROM dokumenti WHERE tip = ? AND poslovno_leto = ? AND stevilka LIKE '%-%'", (doc.tip, doc.poslovno_leto))
        rows = cursor.fetchall()
        
        max_num = 0
        for r in rows:
            st = r['stevilka']
            try:
                parts = st.split('-')
                if len(parts) == 2:
                    if parts[0].isdigit() and len(parts[0]) <= 4 and int(parts[0]) != doc.poslovno_leto:
                        num = int(parts[0])
                    else:
                        num = int(parts[1])
                    if num > max_num:
                        max_num = num
            except: pass
                
        next_num = max_num + 1
        stevilka = f"{next_num:03d}-{doc.poslovno_leto}"

    # Posebna logika za interna_stevilka pri prejetih računih in prejetih ponudbah
    if doc.tip in ['prejeti_racuni', 'prejete_ponudbe'] and (not interna_st or interna_st == ""):
        cursor.execute("SELECT interna_stevilka FROM dokumenti WHERE tip = ? AND poslovno_leto = ? AND interna_stevilka LIKE '%-%'", (doc.tip, doc.poslovno_leto))
        rows = cursor.fetchall()
        max_int = 0
        for r in rows:
            st = r['interna_stevilka']
            if not st: continue
            try:
                parts = st.split('-')
                if len(parts) == 2:
                    num = int(parts[0]) if parts[0].isdigit() and int(parts[0]) != doc.poslovno_leto else int(parts[1])
                    if num > max_int: max_int = num
            except: pass
        next_int = max_int + 1
        interna_st = f"{next_int:03d}-{doc.poslovno_leto}"
    elif not interna_st or interna_st == "":
        interna_st = stevilka
    
    cursor.execute("""
        INSERT INTO dokumenti (poslovno_leto, tip, stevilka, partner_id, datum_izdaje, datum_zapadlosti, znesek_brez_ddv, znesek_ddv, znesek_skupaj, datum_storitve_od, datum_storitve_do, status, datum_placila, nacin_placila, zakljucno_besedilo, noga_dokumenta, opombe, valuta, tecaj, znesek_v_valuti, vkljuci_placilo, odstotek_placila, interna_stevilka, sklic, kompenzacija_doc_id, delno_placano_znesek, delna_placila, stotinska_izravnava, samoobdavcitev, stopnja_ddv_samo)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (doc.poslovno_leto, doc.tip, stevilka, doc.partner_id, doc.datum_izdaje, doc.datum_zapadlosti, doc.znesek_brez_ddv, doc.znesek_ddv, doc.znesek_skupaj, doc.datum_storitve_od, doc.datum_storitve_do, doc.status, doc.datum_placila, doc.nacin_placila, doc.zakljucno_besedilo, doc.noga_dokumenta, doc.opombe, doc.valuta, doc.tecaj, doc.znesek_v_valuti, 1 if doc.vkljuci_placilo else 0, doc.odstotek_placila, interna_st, doc.sklic, doc.kompenzacija_doc_id, doc.delno_placano_znesek, doc.delna_placila, doc.stotinska_izravnava, 1 if doc.samoobdavcitev else 0, doc.stopnja_ddv_samo or 22.0))
    
    doc_id = cursor.lastrowid
    for p in doc.postavke:
        cursor.execute("""
            INSERT INTO dokumenti_postavke (dokument_id, artikel_id, opis, kolicina, cena_enote, stopnja_ddv, znesek_skupaj, konto, popust, enota_mere)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (doc_id, p.artikel_id, p.opis, p.kolicina, p.cena_enote, p.stopnja_ddv, p.znesek_skupaj, p.konto, p.popust, p.enota_mere))
    
    # Posodobi zalogo (takoj ob shranjevanju)
    knjizenje.posodobi_zalogo_iz_dokumenta(cursor, doc_id)
    
    conn.commit()
    
    # Samodejno generiranje PDF za izdane dokumente
    if doc.tip in ['izdani_racuni', 'ponudbe', 'dobropisi']:
        try:
            ustvari_in_pripni_pdf(doc_id)
        except Exception as e:
            print(f"Napaka pri generiranju PDF: {e}")

    conn.close()
    return {"status": "success", "id": doc_id, "stevilka": stevilka}

@router.put("/api/dokumenti/{id}")
def update_dokument(id: int, doc: Dokument):
    conn = database.get_db()
    cursor = conn.cursor()
    # Brisanje starih postavk
    cursor.execute("DELETE FROM dokumenti_postavke WHERE dokument_id = ?", (id,))
    
    if not doc.stevilka:
        cursor.execute("SELECT stevilka FROM dokumenti WHERE id = ?", (id,))
        row = cursor.fetchone()
        if row: doc.stevilka = row['stevilka']
    
    # Posodobitev glave
    cursor.execute("""
        UPDATE dokumenti SET 
            poslovno_leto=?, tip=?, stevilka=?, partner_id=?, datum_izdaje=?, datum_zapadlosti=?, 
            znesek_brez_ddv=?, znesek_ddv=?, znesek_skupaj=?, datum_storitve_od=?, datum_storitve_do=?, 
            status=?, datum_placila=?, nacin_placila=?, zakljucno_besedilo=?, noga_dokumenta=?, opombe=?,
            valuta=?, tecaj=?, znesek_v_valuti=?, vkljuci_placilo=?, odstotek_placila=?, interna_stevilka=?, sklic=?,
            kompenzacija_doc_id=?, delno_placano_znesek=?, delna_placila=?, stotinska_izravnava=?,
            samoobdavcitev=?, stopnja_ddv_samo=?
        WHERE id = ?
    """, (doc.poslovno_leto, doc.tip, doc.stevilka, doc.partner_id, doc.datum_izdaje, doc.datum_zapadlosti, 
          doc.znesek_brez_ddv, doc.znesek_ddv, doc.znesek_skupaj, doc.datum_storitve_od, doc.datum_storitve_do, 
          doc.status, doc.datum_placila, doc.nacin_placila, doc.zakljucno_besedilo, doc.noga_dokumenta, doc.opombe,
          doc.valuta, doc.tecaj, doc.znesek_v_valuti, 1 if doc.vkljuci_placilo else 0, doc.odstotek_placila, doc.interna_stevilka, doc.sklic,
          doc.kompenzacija_doc_id, doc.delno_placano_znesek, doc.delna_placila, doc.stotinska_izravnava,
          1 if doc.samoobdavcitev else 0, doc.stopnja_ddv_samo or 22.0, id))
    
    # Vstavljanje novih postavk
    for p in doc.postavke:
        cursor.execute("""
            INSERT INTO dokumenti_postavke (dokument_id, artikel_id, opis, kolicina, cena_enote, stopnja_ddv, znesek_skupaj, konto, popust, enota_mere)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (id, p.artikel_id, p.opis, p.kolicina, p.cena_enote, p.stopnja_ddv, p.znesek_skupaj, p.konto, p.popust, p.enota_mere))
    
    # Posodobi zalogo (takoj ob shranjevanju)
    knjizenje.posodobi_zalogo_iz_dokumenta(cursor, id)

    conn.commit()
    
    # Samodejno generiranje PDF za izdane dokumente
    if doc.tip in ['izdani_racuni', 'ponudbe', 'dobropisi']:
        try:
            ustvari_in_pripni_pdf(id)
        except Exception as e:
            print(f"Napaka pri generiranju PDF: {e}")

    conn.close()
    return {"status": "success", "id": id}
