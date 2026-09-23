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

@router.get("/api/konti")
def get_konti():
    conn = database.get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM kontni_nacrt ORDER BY stevilka")
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

@router.post("/api/konti")
def create_konto(k: Konto):
    conn = database.get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("INSERT INTO kontni_nacrt (stevilka, naziv, opis) VALUES (?, ?, ?)", (k.stevilka, k.naziv, k.opis))
        conn.commit()
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=400, detail=f"Napaka pri dodajanju konta: {str(e)}")
    conn.close()
    return {"status": "success", "id": cursor.lastrowid}

@router.put("/api/konti/{id}")
def update_konto(id: int, k: Konto):
    conn = database.get_db()
    cursor = conn.cursor()
    cursor.execute("UPDATE kontni_nacrt SET stevilka=?, naziv=?, opis=? WHERE id = ?", (k.stevilka, k.naziv, k.opis, id))
    conn.commit()
    conn.close()
    return {"status": "success"}

@router.get("/api/likvidacija/odprte_postavke/{partner_id}")
def get_odprte_postavke(partner_id: int):
    conn = database.get_db()
    cursor = conn.cursor()
    # Poiščemo vse račune (izdane in prejete), ki niso popolnoma plačani
    # Računamo preostanek: znesek_skupaj - vsota vseh povezav v placila_povezave
    cursor.execute("""
        SELECT d.id, d.tip, d.stevilka, d.datum_izdaje, d.datum_zapadlosti, d.znesek_skupaj, d.status, d.delna_placila, d.delno_placano_znesek,
               p.naziv as partner_naziv,
               IFNULL((SELECT SUM(znesek) FROM placila_povezave WHERE dokument_id = d.id), 0) as placano_znesek
         FROM dokumenti d
        LEFT JOIN partnerji p ON d.partner_id = p.id
        WHERE d.partner_id = ? AND d.tip IN ('izdani_racuni', 'prejeti_racuni', 'dobropisi', 'prejeti_dobropisi')
        ORDER BY d.datum_zapadlosti ASC
    """, (partner_id,))
    rows = cursor.fetchall()
    conn.close()
    
    result = []
    for r in rows:
        d = dict(r)
        manual_sum = get_sum_delna_placila(d.get('delna_placila'))
        d['placano_znesek'] = round(max(d['placano_znesek'] or 0.0, d.get('delno_placano_znesek') or 0.0) + manual_sum, 2)
        d['preostanek'] = round(d['znesek_skupaj'] - d['placano_znesek'], 2)
        if d['preostanek'] > 0:
            result.append(d)
    return result

@router.get("/api/likvidacija/iskanje_racunov")
def iskanje_racunov(q: str):
    conn = database.get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT d.id, d.tip, d.stevilka, d.datum_izdaje, d.datum_zapadlosti, d.znesek_skupaj, d.status, d.delna_placila, d.delno_placano_znesek,
               p.naziv as partner_naziv,
               IFNULL((SELECT SUM(znesek) FROM placila_povezave WHERE dokument_id = d.id), 0) as placano_znesek
        FROM dokumenti d
        LEFT JOIN partnerji p ON d.partner_id = p.id
        WHERE (d.stevilka LIKE ? OR p.naziv LIKE ?)
          AND d.tip IN ('izdani_racuni', 'prejeti_racuni', 'dobropisi', 'prejeti_dobropisi')
        ORDER BY d.datum_zapadlosti ASC
    """, (f"%{q}%", f"%{q}%"))
    rows = cursor.fetchall()
    conn.close()
    
    result = []
    for r in rows:
        d = dict(r)
        manual_sum = get_sum_delna_placila(d.get('delna_placila'))
        d['placano_znesek'] = round(max(d['placano_znesek'] or 0.0, d.get('delno_placano_znesek') or 0.0) + manual_sum, 2)
        d['preostanek'] = round(d['znesek_skupaj'] - d['placano_znesek'], 2)
        # Pri ročnem iskanju vrnemo vse ujemajoče se račune, tudi že plačane, da jih je mogoče povezati
        result.append(d)
    return result

@router.get("/api/likvidacija/povezave/{izpisek_postavka_id}")
def get_povezave_postavke(izpisek_postavka_id: int):
    conn = database.get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT pp.*, d.stevilka, d.tip, d.datum_izdaje, p.naziv as partner_naziv
        FROM placila_povezave pp
        JOIN dokumenti d ON pp.dokument_id = d.id
        LEFT JOIN partnerji p ON d.partner_id = p.id
        WHERE pp.izpisek_postavka_id = ?
    """, (izpisek_postavka_id,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

@router.post("/api/likvidacija/povezi")
def povezi_placilo(req: LikvidacijaRequest):
    conn = database.get_db()
    cursor = conn.cursor()
    try:
        # 1. Pobrišemo obstoječe povezave za to postavko (če obstajajo)
        # Najprej dobimo id-je dokumentov, ki so bili vključeni, da jim kasneje posodobimo status
        cursor.execute("SELECT dokument_id FROM placila_povezave WHERE izpisek_postavka_id = ?", (req.izpisek_postavka_id,))
        old_doc_ids = [r['dokument_id'] for r in cursor.fetchall()]
        
        cursor.execute("DELETE FROM placila_povezave WHERE izpisek_postavka_id = ?", (req.izpisek_postavka_id,))
        
        # 2. Ob povezavi z računom samodejno umaknemo oznako ročne likvidacije
        cursor.execute("UPDATE izpiski_postavke SET manualna_likvidacija = 0 WHERE id = ?", (req.izpisek_postavka_id,))
        
        # 3. Vstavimo nove povezave
        new_doc_ids = []
        for p in req.povezave:
            if p.znesek > 0:
                cursor.execute("""
                    INSERT INTO placila_povezave (izpisek_postavka_id, dokument_id, znesek)
                    VALUES (?, ?, ?)
                """, (req.izpisek_postavka_id, p.dokument_id, p.znesek))
                new_doc_ids.append(p.dokument_id)
        
        # 3. Posodobitev statusov vseh vpletenih dokumentov (starih in novih)
        statement_date = None
        cursor.execute("""
            SELECT ig.datum 
            FROM izpiski_postavke ip
            JOIN izpiski_glava ig ON ip.izpisek_id = ig.id
            WHERE ip.id = ?
        """, (req.izpisek_postavka_id,))
        s_row = cursor.fetchone()
        if s_row:
            statement_date = s_row['datum']

        all_affected = list(set(old_doc_ids + new_doc_ids))
        for doc_id in all_affected:
            # Izračunamo skupno plačano vrednost za ta dokument
            cursor.execute("SELECT SUM(znesek) as skupaj_placano FROM placila_povezave WHERE dokument_id = ?", (doc_id,))
            placano = cursor.fetchone()['skupaj_placano'] or 0
            
            # Pridobimo znesek prvega plačila, ostala delna plačila in trenutni sklic
            cursor.execute("SELECT znesek_skupaj, delno_placano_znesek, delna_placila, datum_placila, nacin_placila, sklic FROM dokumenti WHERE id = ?", (doc_id,))
            doc_row = cursor.fetchone()
            if not doc_row:
                continue
            skupaj = doc_row['znesek_skupaj'] or 0.0
            delno_placano_znesek = doc_row['delno_placano_znesek'] or 0.0
            manual_sum = get_sum_delna_placila(doc_row['delna_placila'])
            doc_sklic = doc_row['sklic'] or ''
            
            vse_skupaj_placano = max(placano, delno_placano_znesek) + manual_sum
            
            status = 'neplačano'
            doc_datum_placila = doc_row['datum_placila']
            doc_nacin_placila = doc_row['nacin_placila']
            
            if vse_skupaj_placano >= skupaj - 0.001: # Toleranca za decimalke
                status = 'plačano'
                if statement_date:
                    doc_datum_placila = statement_date
                    doc_nacin_placila = 'TRR'
                    delno_placano_znesek = placano
            elif vse_skupaj_placano > 0:
                status = 'delno plačano'
                if statement_date:
                    doc_datum_placila = statement_date
                    doc_nacin_placila = 'TRR'
                    delno_placano_znesek = placano
            else:
                status = 'neplačano'
                doc_datum_placila = None
                doc_nacin_placila = None
                delno_placano_znesek = 0.0

            # Poskusimo razbrati sklic iz namen postavke banke
            cursor.execute("""
                SELECT ip.namen 
                FROM placila_povezave pp
                JOIN izpiski_postavke ip ON pp.izpisek_postavka_id = ip.id
                WHERE pp.dokument_id = ?
            """, (doc_id,))
            p_rows = cursor.fetchall()
            extracted_sklic = ""
            for pr in p_rows:
                sk = extract_sklic_from_namen(pr['namen'])
                if sk:
                    extracted_sklic = sk
                    break
            if extracted_sklic:
                doc_sklic = extracted_sklic
            
            cursor.execute("""
                UPDATE dokumenti 
                SET status = ?, datum_placila = ?, nacin_placila = ?, delno_placano_znesek = ?, sklic = ? 
                WHERE id = ?
            """, (status, doc_datum_placila, doc_nacin_placila, delno_placano_znesek, doc_sklic, doc_id))
            
        conn.commit()
        conn.close()
        return {"status": "success"}
    except Exception as e:
        if 'conn' in locals(): conn.close()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/likvidacija/manualna")
def manualna_likvidacija(req: ManualnaLikvidacijaRequest):
    conn = database.get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("UPDATE izpiski_postavke SET manualna_likvidacija = ? WHERE id = ?", (1 if req.manualna else 0, req.izpisek_postavka_id))
        conn.commit()
        return {"status": "success"}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@router.delete("/api/konti/{id}")
def delete_konto(id: int):
    conn = database.get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM kontni_nacrt WHERE id = ?", (id,))
    conn.commit()
    conn.close()
    return {"status": "success"}

@router.post("/api/dokumenti/{id}/knjizi")
def api_knjizi_dokument(id: int, req: Optional[KnjiziRequest] = None):
    tid = req.temeljnica_id if req else None
    naziv = req.novi_naziv if req else None
    return knjizenje.knjizi_dokument(id, tid, naziv)

@router.post("/api/dokumenti/{id}/razknjizi")
def api_razknjizi_dokument(id: int):
    return knjizenje.razknjizi_dokument(id)

@router.post("/api/knjizenje/bulk_knjizi")
def api_bulk_knjizi(req: BulkKnjizenjeRequest):
    uspesno = 0
    napake = []
    
    tid = req.temeljnica_id
    naziv = req.novi_naziv
    shared_tid = None
    
    for doc_id in req.ids:
        try:
            if req.akcija == 'knjizi':
                if tid == -1 or tid is None:
                    if shared_tid is None:
                        if req.module == 'place':
                            res = knjizenje.knjizi_placa(doc_id, None, naziv)
                        else:
                            res = knjizenje.knjizi_dokument(doc_id, None, naziv)
                        shared_tid = res.get('temeljnica_id')
                    else:
                        if req.module == 'place':
                            knjizenje.knjizi_placa(doc_id, shared_tid)
                        else:
                            knjizenje.knjizi_dokument(doc_id, shared_tid)
                else:
                    if req.module == 'place':
                        knjizenje.knjizi_placa(doc_id, tid)
                    else:
                        knjizenje.knjizi_dokument(doc_id, tid)
            elif req.akcija == 'razknjizi':
                if req.module == 'place':
                    knjizenje.razknjizi_placa(doc_id)
                else:
                    knjizenje.razknjizi_dokument(doc_id)
            uspesno += 1
        except Exception as e:
            napake.append(f"Napaka pri elementu {doc_id}: {str(e)}")
    
    return {"status": "success", "uspesno": uspesno, "napake": napake}

@router.get("/api/temeljnice")
def get_temeljnice(leto: int = None):
    conn = database.get_db()
    cursor = conn.cursor()
    if leto:
        cursor.execute("SELECT t.*, (SELECT SUM(znesek_v_breme) FROM temeljnice_postavke WHERE temeljnica_id = t.id) as promet_breme, (SELECT SUM(znesek_v_dobro) FROM temeljnice_postavke WHERE temeljnica_id = t.id) as promet_dobro FROM temeljnice t WHERE t.poslovno_leto = ? ORDER BY t.datum DESC, t.id DESC", (leto,))
    else:
        cursor.execute("SELECT t.*, (SELECT SUM(znesek_v_breme) FROM temeljnice_postavke WHERE temeljnica_id = t.id) as promet_breme, (SELECT SUM(znesek_v_dobro) FROM temeljnice_postavke WHERE temeljnica_id = t.id) as promet_dobro FROM temeljnice t ORDER BY t.datum DESC, t.id DESC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

@router.get("/api/temeljnice/detajl/{id}")
def get_temeljnica_detajl(id: int):
    conn = database.get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM temeljnice WHERE id = ?", (id,))
    t = cursor.fetchone()
    if not t:
        conn.close()
        raise HTTPException(status_code=404, detail="Temeljnica ne obstaja")
    cursor.execute("SELECT p.*, part.naziv as partner_naziv FROM temeljnice_postavke p LEFT JOIN partnerji part ON p.partner_id = part.id WHERE p.temeljnica_id = ?", (id,))
    postavke = cursor.fetchall()
    conn.close()
    res = dict(t)
    res['postavke'] = [dict(p) for p in postavke]
    return res

@router.post("/api/temeljnice")
def create_temeljnica(data: TemeljnicaIn):
    conn = database.get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            INSERT INTO temeljnice (poslovno_leto, vrsta, stevilka, datum, opis, zaklenjeno)
            VALUES (?, ?, ?, ?, ?, 0)
        """, (data.poslovno_leto, data.vrsta, data.stevilka, data.datum, data.opis))
        tid = cursor.lastrowid
        
        for p in data.postavke:
            cursor.execute("""
                INSERT INTO temeljnice_postavke (temeljnica_id, konto, partner_id, opis, datum_zapadlosti, znesek_v_breme, znesek_v_dobro)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (tid, p.konto, p.partner_id, p.opis, p.datum_zapadlosti, p.znesek_v_breme, p.znesek_v_dobro))
            
        conn.commit()
        return {"status": "success", "id": tid}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@router.delete("/api/temeljnice/{id}")
def delete_temeljnica(id: int):
    conn = database.get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT zaklenjeno, dokument_id FROM temeljnice WHERE id = ?", (id,))
        row = cursor.fetchone()
        if not row: raise HTTPException(status_code=404, detail="Temeljnica ne obstaja.")
        
        # Ce je temeljnica avtomatsko generirana iz dokumenta, morda ne pustimo brisanja?
        # Zaenkrat pustimo, vendar moramo v tem primeru dokument oznaciti kot neknjizen.
        if row['dokument_id']:
            # To je sicer bolj kompleksno, ker ena temeljnica lahko vsebuje vec dokumentov
            # ampak nase avtomatsko knjizenje trenutno dela 1:1 ali N:1.
            # Za varnost raje uporabimo razknjizi_vse logiko v knjizenje.py
            pass

        cursor.execute("DELETE FROM temeljnice_postavke WHERE temeljnica_id = ?", (id,))
        cursor.execute("DELETE FROM temeljnice WHERE id = ?", (id,))
        conn.commit()
        return {"status": "success"}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@router.get("/api/reports/konto_kartica")
def get_konto_kartica(konto: str, leto: int):
    conn = database.get_db()
    cursor = conn.cursor()
    try:
        # Iščemo po celotnem kontu ali po prefixu
        cursor.execute("""
            SELECT p.*, t.stevilka as temeljnica_stevilka, t.datum, t.vrsta as temeljnica_vrsta,
                   par.naziv as partner_naziv
            FROM temeljnice_postavke p
            JOIN temeljnice t ON p.temeljnica_id = t.id
            LEFT JOIN partnerji par ON p.partner_id = par.id
            WHERE t.poslovno_leto = ? AND p.konto LIKE ?
            ORDER BY t.datum ASC, t.stevilka ASC, p.id ASC
        """, (leto, f"{konto}%"))
        rows = cursor.fetchall()
        return [dict(row) for row in rows]
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@router.post("/api/izpiski/{id}/knjizi")
def api_knjizi_izpisek(id: int, req: Optional[KnjiziRequest] = None):
    tid = req.temeljnica_id if req else None
    naziv = req.novi_naziv if req else None
    return knjizenje.knjizi_izpisek(id, tid, naziv)

@router.post("/api/izpiski/{id}/razknjizi")
def api_razknjizi_izpisek(id: int):
    return knjizenje.razknjizi_izpisek(id)

@router.post("/api/place/{id}/knjizi")
def api_knjizi_placa(id: int, req: Optional[KnjiziRequest] = None):
    tid = req.temeljnica_id if req else None
    naziv = req.novi_naziv if req else None
    return knjizenje.knjizi_placa(id, tid, naziv)

@router.post("/api/place/{id}/razknjizi")
def api_razknjizi_placa(id: int):
    return knjizenje.razknjizi_placa(id)

@router.post("/api/potni_nalogi/{id}/knjizi")
def api_knjizi_potni_nalog(id: int, req: Optional[KnjiziRequest] = None):
    tid = req.temeljnica_id if req else None
    naziv = req.novi_naziv if req else None
    return knjizenje.knjizi_potni_nalog(id, tid, naziv)

@router.post("/api/potni_nalogi/{id}/razknjizi")
def api_razknjizi_potni_nalog(id: int):
    return knjizenje.razknjizi_potni_nalog(id)

@router.post("/api/amortizacija/{leto}/knjizi")
def api_knjizi_amortizacija(leto: int, req: Optional[KnjiziRequest] = None):
    tid = req.temeljnica_id if req else None
    naziv = req.novi_naziv if req else None
    ids = req.ids if req else None
    return knjizenje.knjizi_amortizacija(leto, tid, naziv, ids)

@router.post("/api/amortizacija/{leto}/razknjizi")
def api_razknjizi_amortizacija(leto: int):
    return knjizenje.razknjizi_amortizacija(leto)

@router.get("/api/reports/ddv_o")
def get_ddv_o(leto: int, mesec: Optional[int] = None, cetrtletje: Optional[int] = None):
    """
    DDV-O poročilo: vstopni in izstopni DDV po stopnjah za izbrano obdobje.
    Parametri: leto (obvezno), mesec (1-12) ali cetrtletje (1-4), ali samo leto (celo leto).
    """
    import calendar
    conn = database.get_db()
    cursor = conn.cursor()
    try:
        # Določitev datumskega razpona
        if mesec and 1 <= mesec <= 12:
            _, zadnji_dan = calendar.monthrange(leto, mesec)
            dat_od = f"{leto}-{mesec:02d}-01"
            dat_do = f"{leto}-{mesec:02d}-{zadnji_dan:02d}"
            opis_obdobja = f"{mesec:02d}/{leto}"
        elif cetrtletje and 1 <= cetrtletje <= 4:
            mesec_od = (cetrtletje - 1) * 3 + 1
            mesec_do = cetrtletje * 3
            _, zadnji_dan = calendar.monthrange(leto, mesec_do)
            dat_od = f"{leto}-{mesec_od:02d}-01"
            dat_do = f"{leto}-{mesec_do:02d}-{zadnji_dan:02d}"
            opis_obdobja = f"Q{cetrtletje}/{leto}"
        else:
            dat_od = f"{leto}-01-01"
            dat_do = f"{leto}-12-31"
            opis_obdobja = str(leto)

        def ddv_po_stopnjah(tipi_dokumentov):
            """Sešteje neto osnovo in DDV po stopnjah za podane tipe dokumentov."""
            placeholders = ','.join(['?'] * len(tipi_dokumentov))
            cursor.execute(f"""
                SELECT dp.stopnja_ddv,
                       ROUND(SUM(dp.kolicina * dp.cena_enote * (1 - dp.popust/100.0)), 2) as osnova,
                       ROUND(SUM(dp.kolicina * dp.cena_enote * (1 - dp.popust/100.0) * dp.stopnja_ddv / 100.0), 2) as ddv
                FROM dokumenti_postavke dp
                JOIN dokumenti d ON dp.dokument_id = d.id
                WHERE d.tip IN ({placeholders})
                  AND d.datum_izdaje BETWEEN ? AND ?
                GROUP BY dp.stopnja_ddv
                ORDER BY dp.stopnja_ddv DESC
            """, (*tipi_dokumentov, dat_od, dat_do))
            return [dict(r) for r in cursor.fetchall()]

        # Izstopni DDV: izdani računi + dobropisi (dobropisi zmanjšajo izstopni DDV)
        izstopni_racuni = ddv_po_stopnjah(['izdani_racuni'])
        izstopni_dobropisi = ddv_po_stopnjah(['dobropisi'])

        # Združimo in odštejemo dobropise
        izstopni_map = {}
        for r in izstopni_racuni:
            izstopni_map[r['stopnja_ddv']] = {'stopnja_ddv': r['stopnja_ddv'],
                                               'osnova': r['osnova'], 'ddv': r['ddv']}
        for r in izstopni_dobropisi:
            s = r['stopnja_ddv']
            if s in izstopni_map:
                izstopni_map[s]['osnova'] = round(izstopni_map[s]['osnova'] - r['osnova'], 2)
                izstopni_map[s]['ddv'] = round(izstopni_map[s]['ddv'] - r['ddv'], 2)
            else:
                izstopni_map[s] = {'stopnja_ddv': s, 'osnova': -r['osnova'], 'ddv': -r['ddv']}

        # K3 — ZDDV-1, čl. 76a: Samoobdavčitev — izstopni del (obveznost DDV)
        cursor.execute("""
            SELECT stopnja_ddv_samo as stopnja_ddv,
                   ROUND(SUM(znesek_brez_ddv), 2) as osnova,
                   ROUND(SUM(znesek_brez_ddv * stopnja_ddv_samo / 100.0), 2) as ddv
            FROM dokumenti
            WHERE tip = 'prejeti_racuni' AND samoobdavcitev = 1
              AND datum_izdaje BETWEEN ? AND ?
            GROUP BY stopnja_ddv_samo
        """, (dat_od, dat_do))
        for r in cursor.fetchall():
            s = float(r['stopnja_ddv'] or 22)
            entry = izstopni_map.get(s, {'stopnja_ddv': s, 'osnova': 0.0, 'ddv': 0.0})
            entry['osnova'] = round(entry['osnova'] + (r['osnova'] or 0), 2)
            entry['ddv'] = round(entry['ddv'] + (r['ddv'] or 0), 2)
            entry['samoobdavcitev_ddv'] = round((entry.get('samoobdavcitev_ddv') or 0) + (r['ddv'] or 0), 2)
            izstopni_map[s] = entry
        izstopni = sorted(izstopni_map.values(), key=lambda x: -x['stopnja_ddv'])

        # Vstopni DDV: prejeti računi − prejeti dobropisi
        vstopni_racuni = ddv_po_stopnjah(['prejeti_racuni'])
        vstopni_dobropisi = ddv_po_stopnjah(['prejeti_dobropisi'])
        vstopni_map = {}
        for r in vstopni_racuni:
            vstopni_map[r['stopnja_ddv']] = {'stopnja_ddv': r['stopnja_ddv'],
                                              'osnova': r['osnova'], 'ddv': r['ddv']}
        for r in vstopni_dobropisi:
            s = r['stopnja_ddv']
            if s in vstopni_map:
                vstopni_map[s]['osnova'] = round(vstopni_map[s]['osnova'] - r['osnova'], 2)
                vstopni_map[s]['ddv'] = round(vstopni_map[s]['ddv'] - r['ddv'], 2)
            else:
                vstopni_map[s] = {'stopnja_ddv': s, 'osnova': -r['osnova'], 'ddv': -r['ddv']}

        # K3 — ZDDV-1, čl. 76a: Samoobdavčitev — vstopni del (odbitek DDV)
        cursor.execute("""
            SELECT stopnja_ddv_samo as stopnja_ddv,
                   ROUND(SUM(znesek_brez_ddv), 2) as osnova,
                   ROUND(SUM(znesek_brez_ddv * stopnja_ddv_samo / 100.0), 2) as ddv
            FROM dokumenti
            WHERE tip = 'prejeti_racuni' AND samoobdavcitev = 1
              AND datum_izdaje BETWEEN ? AND ?
            GROUP BY stopnja_ddv_samo
        """, (dat_od, dat_do))
        for r in cursor.fetchall():
            s = float(r['stopnja_ddv'] or 22)
            entry = vstopni_map.get(s, {'stopnja_ddv': s, 'osnova': 0.0, 'ddv': 0.0})
            entry['osnova'] = round(entry['osnova'] + (r['osnova'] or 0), 2)
            entry['ddv'] = round(entry['ddv'] + (r['ddv'] or 0), 2)
            entry['samoobdavcitev_ddv'] = round((entry.get('samoobdavcitev_ddv') or 0) + (r['ddv'] or 0), 2)
            vstopni_map[s] = entry
        vstopni = sorted(vstopni_map.values(), key=lambda x: -x['stopnja_ddv'])

        izstopni_ddv_skupaj = round(sum(r['ddv'] for r in izstopni), 2)
        vstopni_ddv_skupaj = round(sum(r['ddv'] for r in vstopni), 2)
        razlika = round(izstopni_ddv_skupaj - vstopni_ddv_skupaj, 2)

        return {
            "obdobje": {"od": dat_od, "do": dat_do, "opis": opis_obdobja},
            "izstopni": izstopni,
            "vstopni": vstopni,
            "izstopni_osnova_skupaj": round(sum(r['osnova'] for r in izstopni), 2),
            "izstopni_ddv_skupaj": izstopni_ddv_skupaj,
            "vstopni_osnova_skupaj": round(sum(r['osnova'] for r in vstopni), 2),
            "vstopni_ddv_skupaj": vstopni_ddv_skupaj,
            "razlika_ddv": razlika,
            "tip_razlike": "obveznost" if razlika > 0 else ("presežek" if razlika < 0 else "izenačeno")
        }
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@router.get("/api/reports/ddv_o/export")
def export_ddv_o(leto: int, mesec: Optional[int] = None, cetrtletje: Optional[int] = None):
    """Izvozi DDV-O poročilo v PDF (ZDDV-1, čl. 88)."""
    from fpdf import FPDF
    # Pridobi podatke iz obstoječega endpointa
    data = get_ddv_o(leto=leto, mesec=mesec, cetrtletje=cetrtletje)
    conn = database.get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT naziv, davcna_stevilka FROM nastavitve WHERE id = 1")
    company = cursor.fetchone()
    conn.close()

    pdf = FPDF()
    pdf.add_font('DejaVu', '', 'DejaVuSans.ttf')
    pdf.add_font('DejaVu', 'B', 'DejaVuSans-Bold.ttf')
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()

    # Glava
    pdf.set_font('DejaVu', 'B', 14)
    pdf.cell(0, 10, f"DDV-O POROČILO — {data['obdobje']['opis']}", ln=1, align='C')
    pdf.set_font('DejaVu', '', 9)
    if company:
        pdf.cell(0, 5, f"{company['naziv']}  |  ID za DDV: SI{re.sub(r'[^0-9]', '', company['davcna_stevilka'] or '')}", ln=1, align='C')
    pdf.ln(5)

    def tabela_ddv(naslov, vrstice, fill_r, fill_g, fill_b):
        pdf.set_font('DejaVu', 'B', 10)
        pdf.set_fill_color(fill_r, fill_g, fill_b)
        pdf.cell(0, 8, naslov, ln=1, fill=True)
        pdf.set_font('DejaVu', 'B', 9)
        pdf.cell(60, 7, 'DDV stopnja', 1, 0, 'C', True)
        pdf.cell(60, 7, 'Osnova (€)', 1, 0, 'R', True)
        pdf.cell(60, 7, 'DDV (€)', 1, 1, 'R', True)
        pdf.set_font('DejaVu', '', 9)
        for r in vrstice:
            stopnja = r['stopnja_ddv']
            label = f"{stopnja:.4g}%" if stopnja > 0 else "0% (oproščeno)"
            pdf.cell(60, 6, label, 1, 0, 'C')
            pdf.cell(60, 6, format_money(r['osnova']), 1, 0, 'R')
            pdf.cell(60, 6, format_money(r['ddv']), 1, 1, 'R')
        pdf.set_font('DejaVu', 'B', 9)
        pdf.cell(60, 6, 'SKUPAJ', 1, 0, 'C', True)
        pdf.cell(60, 6, format_money(sum(r['osnova'] for r in vrstice)), 1, 0, 'R', True)
        pdf.cell(60, 6, format_money(sum(r['ddv'] for r in vrstice)), 1, 1, 'R', True)
        pdf.ln(4)

    tabela_ddv("IZSTOPNI DDV (izdani računi)", data['izstopni'], 220, 235, 255)
    tabela_ddv("VSTOPNI DDV (prejeti računi)", data['vstopni'], 220, 255, 220)

    # Razlika
    pdf.set_font('DejaVu', 'B', 11)
    razlika = data['razlika_ddv']
    tip = data['tip_razlike'].upper()
    pdf.set_fill_color(255, 240, 200)
    pdf.cell(0, 9, f"RAZLIKA DDV ({tip}): {format_money(abs(razlika))}", ln=1, fill=True, align='R')

    pdf_bytes = pdf.output()
    fn = f"DDV-O_{data['obdobje']['opis'].replace('/', '-')}.pdf"
    return Response(content=bytes(pdf_bytes), media_type="application/pdf",
                    headers={"Content-Disposition": f"attachment; filename={fn}"})

@router.get("/api/reports/kpo")
def get_kpo(leto: int, format: str = "json"):
    """
    Knjiga prihodkov in odhodkov (KPO) za enostavno knjigovodstvo (SRS 30).
    Evidentira plačane prihodke in plačane odhodke po datumu plačila.
    format: 'json', 'pdf', ali 'csv'
    """
    conn = database.get_db()
    cursor = conn.cursor()
    try:
        # Prihodki = plačani izdani računi, po datumu plačila
        cursor.execute("""
            SELECT d.datum_placila as datum, d.stevilka, p.naziv as partner,
                   'Prihodek' as vrsta, d.znesek_skupaj as prihodek, 0.0 as odhodek,
                   d.znesek_ddv, d.znesek_brez_ddv
            FROM dokumenti d
            LEFT JOIN partnerji p ON d.partner_id = p.id
            WHERE d.tip = 'izdani_racuni'
              AND d.status = 'plačano'
              AND strftime('%Y', COALESCE(d.datum_placila, d.datum_izdaje)) = ?
            ORDER BY d.datum_placila ASC, d.id ASC
        """, (str(leto),))
        prihodki = [dict(r) for r in cursor.fetchall()]

        # Odhodki = plačani prejeti računi, po datumu plačila
        cursor.execute("""
            SELECT d.datum_placila as datum, d.stevilka, p.naziv as partner,
                   'Odhodek' as vrsta, 0.0 as prihodek, d.znesek_skupaj as odhodek,
                   d.znesek_ddv, d.znesek_brez_ddv
            FROM dokumenti d
            LEFT JOIN partnerji p ON d.partner_id = p.id
            WHERE d.tip = 'prejeti_racuni'
              AND d.status = 'plačano'
              AND strftime('%Y', COALESCE(d.datum_placila, d.datum_izdaje)) = ?
            ORDER BY d.datum_placila ASC, d.id ASC
        """, (str(leto),))
        odhodki = [dict(r) for r in cursor.fetchall()]

        vse = sorted(prihodki + odhodki, key=lambda x: (x['datum'] or ''))
        skupaj_prihodki = sum(r['prihodek'] for r in prihodki)
        skupaj_odhodki = sum(r['odhodek'] for r in odhodki)

        if format == 'csv':
            import io as _io
            import csv as _csv
            output = _io.StringIO()
            writer = _csv.writer(output, delimiter=';')
            writer.writerow(['Datum', 'Številka', 'Partner', 'Vrsta', 'Prihodek (€)', 'Odhodek (€)'])
            for r in vse:
                writer.writerow([r['datum'], r['stevilka'], r['partner'], r['vrsta'],
                                  f"{r['prihodek']:.2f}", f"{r['odhodek']:.2f}"])
            writer.writerow(['', '', '', 'SKUPAJ', f"{skupaj_prihodki:.2f}", f"{skupaj_odhodki:.2f}"])
            return Response(content=output.getvalue().encode('utf-8-sig'),
                            media_type="text/csv",
                            headers={"Content-Disposition": f"attachment; filename=KPO_{leto}.csv"})

        if format == 'pdf':
            from fpdf import FPDF
            cursor.execute("SELECT naziv FROM nastavitve WHERE id = 1")
            company = cursor.fetchone()
            pdf = FPDF()
            pdf.add_font('DejaVu', '', 'DejaVuSans.ttf')
            pdf.add_font('DejaVu', 'B', 'DejaVuSans-Bold.ttf')
            pdf.set_auto_page_break(auto=True, margin=15)
            pdf.add_page(orientation='L')
            pdf.set_font('DejaVu', 'B', 12)
            pdf.cell(0, 9, f"KNJIGA PRIHODKOV IN ODHODKOV — {leto}", ln=1, align='C')
            if company:
                pdf.set_font('DejaVu', '', 9)
                pdf.cell(0, 5, company['naziv'], ln=1, align='C')
            pdf.ln(3)
            pdf.set_fill_color(230, 230, 230)
            pdf.set_font('DejaVu', 'B', 8)
            pdf.cell(25, 7, 'Datum', 1, 0, 'C', True)
            pdf.cell(30, 7, 'Številka', 1, 0, 'C', True)
            pdf.cell(80, 7, 'Partner', 1, 0, 'L', True)
            pdf.cell(25, 7, 'Vrsta', 1, 0, 'C', True)
            pdf.cell(40, 7, 'Prihodek (€)', 1, 0, 'R', True)
            pdf.cell(40, 7, 'Odhodek (€)', 1, 1, 'R', True)
            pdf.set_font('DejaVu', '', 8)
            for r in vse:
                pdf.cell(25, 6, str(r['datum'] or ''), 1, 0, 'C')
                pdf.cell(30, 6, str(r['stevilka'] or ''), 1, 0, 'C')
                pdf.cell(80, 6, str(r['partner'] or '')[:45], 1, 0, 'L')
                pdf.cell(25, 6, r['vrsta'], 1, 0, 'C')
                pdf.cell(40, 6, f"{r['prihodek']:.2f}" if r['prihodek'] else '', 1, 0, 'R')
                pdf.cell(40, 6, f"{r['odhodek']:.2f}" if r['odhodek'] else '', 1, 1, 'R')
            pdf.set_font('DejaVu', 'B', 8)
            pdf.set_fill_color(200, 220, 255)
            pdf.cell(160, 7, 'SKUPAJ', 1, 0, 'R', True)
            pdf.cell(40, 7, f"{skupaj_prihodki:.2f}", 1, 0, 'R', True)
            pdf.cell(40, 7, f"{skupaj_odhodki:.2f}", 1, 1, 'R', True)
            pdf_bytes = pdf.output()
            return Response(content=bytes(pdf_bytes), media_type="application/pdf",
                            headers={"Content-Disposition": f"attachment; filename=KPO_{leto}.pdf"})

        return {
            "leto": leto,
            "vnosi": vse,
            "skupaj_prihodki": round(skupaj_prihodki, 2),
            "skupaj_odhodki": round(skupaj_odhodki, 2),
            "poslovni_izid": round(skupaj_prihodki - skupaj_odhodki, 2)
        }
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@router.get("/api/reports/knjiga_terjatev")
def get_knjiga_terjatev(leto: int):
    """Knjiga terjatev do kupcev za enostavno knjigovodstvo (SRS 30)."""
    conn = database.get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            SELECT d.id, d.stevilka, d.datum_izdaje, d.datum_zapadlosti, d.datum_placila,
                   d.znesek_skupaj, d.status,
                   p.naziv as partner,
                   COALESCE(
                       (SELECT SUM(znesek) FROM placila_povezave WHERE dokument_id = d.id), 0
                   ) as placano_znesek
            FROM dokumenti d
            LEFT JOIN partnerji p ON d.partner_id = p.id
            WHERE d.tip = 'izdani_racuni'
              AND strftime('%Y', d.datum_izdaje) = ?
            ORDER BY d.datum_izdaje ASC
        """, (str(leto),))
        rows = [dict(r) for r in cursor.fetchall()]
        for r in rows:
            r['odprto'] = round(r['znesek_skupaj'] - (r['placano_znesek'] or 0), 2)
        return {
            "leto": leto,
            "terjatve": rows,
            "skupaj_znesek": round(sum(r['znesek_skupaj'] for r in rows), 2),
            "skupaj_odprto": round(sum(r['odprto'] for r in rows), 2),
            "skupaj_placano": round(sum(r['placano_znesek'] or 0 for r in rows), 2)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@router.get("/api/reports/knjiga_obveznosti")
def get_knjiga_obveznosti(leto: int):
    """Knjiga obveznosti do dobaviteljev za enostavno knjigovodstvo (SRS 30)."""
    conn = database.get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            SELECT d.id, d.stevilka, d.interna_stevilka, d.datum_izdaje, d.datum_zapadlosti, d.datum_placila,
                   d.znesek_skupaj, d.status,
                   p.naziv as partner,
                   COALESCE(
                       (SELECT SUM(znesek) FROM placila_povezave WHERE dokument_id = d.id), 0
                   ) as placano_znesek
            FROM dokumenti d
            LEFT JOIN partnerji p ON d.partner_id = p.id
            WHERE d.tip = 'prejeti_racuni'
              AND strftime('%Y', d.datum_izdaje) = ?
            ORDER BY d.datum_izdaje ASC
        """, (str(leto),))
        rows = [dict(r) for r in cursor.fetchall()]
        for r in rows:
            r['odprto'] = round(r['znesek_skupaj'] - (r['placano_znesek'] or 0), 2)
        return {
            "leto": leto,
            "obveznosti": rows,
            "skupaj_znesek": round(sum(r['znesek_skupaj'] for r in rows), 2),
            "skupaj_odprto": round(sum(r['odprto'] for r in rows), 2),
            "skupaj_placano": round(sum(r['placano_znesek'] or 0 for r in rows), 2)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@router.get("/api/reports/register_os")
def get_register_os(leto: int, format: str = "json"):
    """Register opredmetenih osnovnih sredstev (SRS 30) s stanjem amortizacije za izbrano leto."""
    conn = database.get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT * FROM osnovna_sredstva ORDER BY inventarna_stevilka ASC")
        sredstva = cursor.fetchall()
        rezultati = []
        for s in sredstva:
            nabavna = s['nabavna_vrednost'] or 0.0
            stopnja = s['stopnja_amortizacije'] or 0.0
            # Akumulirana amortizacija do konca izbranega leta
            cursor.execute("""
                SELECT COALESCE(SUM(p.znesek_v_dobro), 0) as akumulirana
                FROM temeljnice_postavke p
                JOIN temeljnice t ON p.temeljnica_id = t.id
                WHERE p.konto = '050' AND p.dokument_id = ? AND p.dokument_tip = 'amortizacija'
                  AND t.poslovno_leto <= ?
            """, (s['id'], leto))
            akumulirana = cursor.fetchone()['akumulirana'] or 0.0
            # Amortizacija samo za izbrano leto
            cursor.execute("""
                SELECT COALESCE(SUM(p.znesek_v_dobro), 0) as am_leto
                FROM temeljnice_postavke p
                JOIN temeljnice t ON p.temeljnica_id = t.id
                WHERE p.konto = '050' AND p.dokument_id = ? AND p.dokument_tip = 'amortizacija'
                  AND t.poslovno_leto = ?
            """, (s['id'], leto))
            am_leto = cursor.fetchone()['am_leto'] or 0.0
            preostala = max(0.0, nabavna - akumulirana)
            rezultati.append({
                "id": s['id'],
                "inventarna_stevilka": s['inventarna_stevilka'],
                "naziv": s['naziv'],
                "tip": s['tip'],
                "datum_nabave": s['datum_nabave'],
                "nabavna_vrednost": round(nabavna, 2),
                "stopnja_amortizacije": stopnja,
                "amortizacija_leto": round(am_leto, 2),
                "akumulirana_amortizacija": round(akumulirana, 2),
                "sedanja_vrednost": round(preostala, 2),
                "aktiven": bool(s['aktiven'])
            })

        if format == 'pdf':
            from fpdf import FPDF
            cursor.execute("SELECT naziv FROM nastavitve WHERE id = 1")
            company = cursor.fetchone()
            pdf = FPDF()
            pdf.add_font('DejaVu', '', 'DejaVuSans.ttf')
            pdf.add_font('DejaVu', 'B', 'DejaVuSans-Bold.ttf')
            pdf.set_auto_page_break(auto=True, margin=15)
            pdf.add_page(orientation='L')
            pdf.set_font('DejaVu', 'B', 11)
            pdf.cell(0, 9, f"REGISTER OSNOVNIH SREDSTEV — stanje {leto}", ln=1, align='C')
            if company:
                pdf.set_font('DejaVu', '', 9)
                pdf.cell(0, 5, company['naziv'], ln=1, align='C')
            pdf.ln(3)
            pdf.set_fill_color(230, 230, 230)
            pdf.set_font('DejaVu', 'B', 7)
            for h, w in [('Inv.št.', 14), ('Naziv', 55), ('Nabava', 20),
                         ('Nabavna vred.', 28), ('Stop.%', 14), (f'AM {leto}', 22),
                         ('Akum. AM', 22), ('Sed. vrednost', 28)]:
                pdf.cell(w, 7, h, 1, 0, 'C', True)
            pdf.ln()
            pdf.set_font('DejaVu', '', 7)
            for r in rezultati:
                pdf.cell(14, 6, str(r['inventarna_stevilka'] or ''), 1, 0, 'C')
                pdf.cell(55, 6, str(r['naziv'] or '')[:38], 1, 0, 'L')
                pdf.cell(20, 6, str(r['datum_nabave'] or ''), 1, 0, 'C')
                pdf.cell(28, 6, f"{r['nabavna_vrednost']:.2f}", 1, 0, 'R')
                pdf.cell(14, 6, f"{r['stopnja_amortizacije']:.1f}%", 1, 0, 'C')
                pdf.cell(22, 6, f"{r['amortizacija_leto']:.2f}", 1, 0, 'R')
                pdf.cell(22, 6, f"{r['akumulirana_amortizacija']:.2f}", 1, 0, 'R')
                pdf.cell(28, 6, f"{r['sedanja_vrednost']:.2f}", 1, 1, 'R')
            pdf_bytes = pdf.output()
            return Response(content=bytes(pdf_bytes), media_type="application/pdf",
                            headers={"Content-Disposition": f"attachment; filename=Register_OS_{leto}.pdf"})

        return {"leto": leto, "osnovna_sredstva": rezultati,
                "skupaj_nabavna": round(sum(r['nabavna_vrednost'] for r in rezultati), 2),
                "skupaj_am_leto": round(sum(r['amortizacija_leto'] for r in rezultati), 2),
                "skupaj_sedanja": round(sum(r['sedanja_vrednost'] for r in rezultati), 2)}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@router.get("/api/reports/enostavno_summary")
def get_enostavno_summary(leto: int):
    """Povzetek enostavnega knjigovodstva za dashboard (SRS 30)."""
    conn = database.get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("""SELECT COALESCE(SUM(znesek_skupaj),0) FROM dokumenti
                          WHERE tip='izdani_racuni' AND status='plačano'
                          AND strftime('%Y',COALESCE(datum_placila,datum_izdaje))=?""", (str(leto),))
        kpo_prihodki = cursor.fetchone()[0]
        cursor.execute("""SELECT COALESCE(SUM(znesek_skupaj),0) FROM dokumenti
                          WHERE tip='prejeti_racuni' AND status='plačano'
                          AND strftime('%Y',COALESCE(datum_placila,datum_izdaje))=?""", (str(leto),))
        kpo_odhodki = cursor.fetchone()[0]
        cursor.execute("""SELECT COALESCE(SUM(znesek_skupaj - COALESCE(
                          (SELECT SUM(znesek) FROM placila_povezave WHERE dokument_id=d.id),0)),0)
                          FROM dokumenti d WHERE tip='izdani_racuni' AND status!='plačano'
                          AND strftime('%Y',datum_izdaje)=?""", (str(leto),))
        terjatve_odprte = cursor.fetchone()[0]
        cursor.execute("""SELECT COALESCE(SUM(znesek_skupaj - COALESCE(
                          (SELECT SUM(znesek) FROM placila_povezave WHERE dokument_id=d.id),0)),0)
                          FROM dokumenti d WHERE tip='prejeti_racuni' AND status!='plačano'
                          AND strftime('%Y',datum_izdaje)=?""", (str(leto),))
        obveznosti_odprte = cursor.fetchone()[0]
        cursor.execute("SELECT COALESCE(SUM(trenutna_vrednost),0) FROM osnovna_sredstva WHERE aktiven=1")
        os_skupaj = cursor.fetchone()[0]
        return {
            "leto": leto,
            "kpo_prihodki": round(kpo_prihodki, 2),
            "kpo_odhodki": round(kpo_odhodki, 2),
            "kpo_poslovni_izid": round(kpo_prihodki - kpo_odhodki, 2),
            "terjatve_odprte": round(terjatve_odprte, 2),
            "obveznosti_odprte": round(obveznosti_odprte, 2),
            "os_skupaj_vrednost": round(os_skupaj, 2)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@router.get("/api/reports/cash_flow")
def get_cash_flow(leto: int, format: str = "json"):
    """
    Izkaz denarnih tokov — direktna metoda (SRS 22, različica I).
    Temelji na bančnih izpiskih in kontih iz likvidacije.
    """
    conn = database.get_db()
    cursor = conn.cursor()
    try:
        # Pridobi vse postavke bančnih izpiskov za izbrano leto
        cursor.execute("""
            SELECT ip.tip_prometa, ip.znesek, ip.konto, ip.namen, ip.partner_id,
                   ig.datum
            FROM izpiski_postavke ip
            JOIN izpiski_glava ig ON ip.izpisek_id = ig.id
            WHERE strftime('%Y', ig.datum) = ?
            ORDER BY ig.datum ASC
        """, (str(leto),))
        postavke = [dict(r) for r in cursor.fetchall()]

        def seštej(tip, konto_prefix):
            """Sešteje zneske glede na tip (dobro/breme) in konto prefix."""
            return sum(
                p['znesek'] for p in postavke
                if p['tip_prometa'] == tip and p['konto'] and p['konto'].startswith(konto_prefix)
            )

        # A. POSLOVNI TOKOVI
        a_prejemki_prodaja = seštej('dobro', '12')        # Terjatve do kupcev
        a_placila_dobaviteljem = seštej('breme', '22')    # Obveznosti do dobaviteljev
        a_placila_zaposlenim = seštej('breme', '25')      # Obveznosti za plače
        a_placila_davki = seštej('breme', '26')           # Obveznosti za davke/prispevke
        a_bancni_stroski = seštej('breme', '41')          # Bančne storitve
        # Ostali poslovni (konto ne spada v nobeno drugo skupino)
        poslovni_konti = {'12', '22', '25', '26', '41', '0', '19', '29'}
        a_ostali_prejemki = sum(
            p['znesek'] for p in postavke
            if p['tip_prometa'] == 'dobro' and p['konto']
            and not any(p['konto'].startswith(k) for k in poslovni_konti)
        )
        a_ostali_odhodki = sum(
            p['znesek'] for p in postavke
            if p['tip_prometa'] == 'breme' and p['konto']
            and not any(p['konto'].startswith(k) for k in poslovni_konti)
        )
        # Nekategorizirano (prazen konto)
        nekategorizirano_dobro = sum(p['znesek'] for p in postavke
                                      if p['tip_prometa'] == 'dobro' and not p['konto'])
        nekategorizirano_breme = sum(p['znesek'] for p in postavke
                                      if p['tip_prometa'] == 'breme' and not p['konto'])
        neto_poslovanje = (a_prejemki_prodaja + a_ostali_prejemki + nekategorizirano_dobro
                           - a_placila_dobaviteljem - a_placila_zaposlenim
                           - a_placila_davki - a_bancni_stroski - a_ostali_odhodki
                           - nekategorizirano_breme)

        # B. NALOŽBENI TOKOVI (OS)
        b_nakup_os = seštej('breme', '0')
        b_prodaja_os = seštej('dobro', '0')
        neto_nalozbe = b_prodaja_os - b_nakup_os

        # C. FINANCIRANJA
        c_posojila_prejeta = seštej('dobro', '29') + seštej('dobro', '19')
        c_posojila_vracilo = seštej('breme', '29') + seštej('breme', '19')
        neto_financiranje = c_posojila_prejeta - c_posojila_vracilo

        # D, E, F — skupni tok in stanja
        skupni_neto = round(neto_poslovanje + neto_nalozbe + neto_financiranje, 2)

        # Začetno in končno stanje iz bančnih izpiskov
        cursor.execute("""
            SELECT zacetno_stanje FROM izpiski_glava
            WHERE strftime('%Y', datum) = ?
            ORDER BY datum ASC LIMIT 1
        """, (str(leto),))
        row_zac = cursor.fetchone()
        cursor.execute("""
            SELECT koncno_stanje FROM izpiski_glava
            WHERE strftime('%Y', datum) = ?
            ORDER BY datum DESC LIMIT 1
        """, (str(leto),))
        row_kon = cursor.fetchone()
        zacetno_stanje = row_zac['zacetno_stanje'] if row_zac else 0.0
        koncno_stanje = row_kon['koncno_stanje'] if row_kon else 0.0

        rezultat = {
            "leto": leto,
            "A_poslovni": {
                "prejemki_od_prodaje": round(a_prejemki_prodaja, 2),
                "placila_dobaviteljem": round(a_placila_dobaviteljem, 2),
                "placila_zaposlenim": round(a_placila_zaposlenim, 2),
                "placila_davki_prispevki": round(a_placila_davki, 2),
                "bancni_stroski": round(a_bancni_stroski, 2),
                "ostali_prejemki": round(a_ostali_prejemki, 2),
                "ostali_odhodki": round(a_ostali_odhodki, 2),
                "nekategorizirano": round(nekategorizirano_dobro - nekategorizirano_breme, 2),
                "neto": round(neto_poslovanje, 2)
            },
            "B_nalozbe": {
                "nakup_os": round(b_nakup_os, 2),
                "prodaja_os": round(b_prodaja_os, 2),
                "neto": round(neto_nalozbe, 2)
            },
            "C_financiranje": {
                "posojila_prejeta": round(c_posojila_prejeta, 2),
                "posojila_vracilo": round(c_posojila_vracilo, 2),
                "neto": round(neto_financiranje, 2)
            },
            "D_skupni_neto_tok": skupni_neto,
            "E_zacetno_stanje_denarja": round(zacetno_stanje, 2),
            "F_koncno_stanje_denarja": round(koncno_stanje, 2),
            "kontrola_ok": abs((zacetno_stanje + skupni_neto) - koncno_stanje) < 1.0,
            "opomba_nekategorizirano": (
                f"Nekategorizirane postavke: {round(nekategorizirano_dobro + nekategorizirano_breme, 2)} € "
                f"(dodelite konte v bančnih izpiskih za natančnejši izkaz)"
            ) if (nekategorizirano_dobro + nekategorizirano_breme) > 0 else ""
        }

        if format == 'pdf':
            from fpdf import FPDF
            cursor.execute("SELECT naziv FROM nastavitve WHERE id = 1")
            company = cursor.fetchone()
            pdf = FPDF()
            pdf.add_font('DejaVu', '', 'DejaVuSans.ttf')
            pdf.add_font('DejaVu', 'B', 'DejaVuSans-Bold.ttf')
            pdf.set_auto_page_break(auto=True, margin=15)
            pdf.add_page()
            pdf.set_font('DejaVu', 'B', 13)
            pdf.set_text_color(25, 42, 86)
            pdf.cell(0, 9, f"IZKAZ DENARNIH TOKOV — {leto}", ln=1, align='C')
            pdf.set_font('DejaVu', '', 9)
            pdf.set_text_color(0, 0, 0)
            if company:
                pdf.cell(0, 5, f"{company['naziv']}  |  Direktna metoda (SRS 22)", ln=1, align='C')
            pdf.ln(4)

            def sekcija(naslov, postavke_list, neto, bold_neto=True):
                pdf.set_font('DejaVu', 'B', 10)
                pdf.set_fill_color(230, 235, 255)
                pdf.cell(0, 7, naslov, ln=1, fill=True)
                pdf.set_font('DejaVu', '', 9)
                for opis, znesek, predznak in postavke_list:
                    pdf.cell(150, 6, f"  {opis}", ln=0)
                    pdf.cell(40, 6, f"{predznak}{format_money(abs(znesek))}", ln=1, align='R')
                pdf.set_font('DejaVu', 'B', 9)
                pdf.set_fill_color(210, 220, 255)
                pdf.cell(150, 7, f"  NETO {naslov.split('—')[0].strip()}", fill=True, ln=0)
                pdf.cell(40, 7, format_money(neto), fill=True, ln=1, align='R')
                pdf.ln(2)

            sekcija("A — POSLOVNE DEJAVNOSTI", [
                ("Prejemki od prodaje", rezultat['A_poslovni']['prejemki_od_prodaje'], '+'),
                ("Plačila dobaviteljem", rezultat['A_poslovni']['placila_dobaviteljem'], '−'),
                ("Plačila zaposlenim", rezultat['A_poslovni']['placila_zaposlenim'], '−'),
                ("Plačila davkov in prispevkov", rezultat['A_poslovni']['placila_davki_prispevki'], '−'),
                ("Bančni stroški", rezultat['A_poslovni']['bancni_stroski'], '−'),
                ("Ostali poslovni prejemki/odhodki (neto)", rezultat['A_poslovni']['ostali_prejemki'] - rezultat['A_poslovni']['ostali_odhodki'], ''),
            ], rezultat['A_poslovni']['neto'])

            sekcija("B — NALOŽBENE DEJAVNOSTI", [
                ("Nakup osnovnih sredstev", rezultat['B_nalozbe']['nakup_os'], '−'),
                ("Iztržek od prodaje OS", rezultat['B_nalozbe']['prodaja_os'], '+'),
            ], rezultat['B_nalozbe']['neto'])

            sekcija("C — FINANCIRANJE", [
                ("Prejeta posojila", rezultat['C_financiranje']['posojila_prejeta'], '+'),
                ("Vračila posojil", rezultat['C_financiranje']['posojila_vracilo'], '−'),
            ], rezultat['C_financiranje']['neto'])

            pdf.set_font('DejaVu', 'B', 10)
            pdf.set_fill_color(180, 200, 255)
            pdf.cell(150, 8, "D — SKUPNI NETO DENARNI TOK (A+B+C)", fill=True, ln=0)
            pdf.cell(40, 8, format_money(rezultat['D_skupni_neto_tok']), fill=True, ln=1, align='R')
            pdf.cell(150, 7, "E — Začetno stanje denarja", ln=0)
            pdf.cell(40, 7, format_money(rezultat['E_zacetno_stanje_denarja']), ln=1, align='R')
            pdf.set_fill_color(160, 200, 160)
            pdf.cell(150, 8, "F — Končno stanje denarja (E+D)", fill=True, ln=0)
            pdf.cell(40, 8, format_money(rezultat['F_koncno_stanje_denarja']), fill=True, ln=1, align='R')

            pdf_bytes = pdf.output()
            return Response(content=bytes(pdf_bytes), media_type="application/pdf",
                            headers={"Content-Disposition": f"attachment; filename=CashFlow_{leto}.pdf"})

        return rezultat
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()
