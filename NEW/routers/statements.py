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

@router.get("/api/reports/statement")
def get_statement(vrsta: str, leto: int):
    conn = database.get_db()
    cursor = conn.cursor()
    
    try:
        # Load kontni nacrt for names
        cursor.execute("SELECT stevilka, naziv FROM kontni_nacrt")
        konti_dict = {row['stevilka']: row['naziv'] for row in cursor.fetchall()}
        
        # Load all AOPs to handle cross-statement references
        cursor.execute("SELECT * FROM ajpes_shema")
        all_rows = cursor.fetchall()
        all_shema_dict = {row['oznaka_aop']: dict(row) for row in all_rows}
        
        # Filter rows for the requested report
        target_rows = [row for row in all_rows if row['vrsta_izkaza'] == vrsta]
        
        cache = {}
        results = []
        for row in target_rows:
            aop_code = row['oznaka_aop']
            val, breakdown = calculate_aop(cursor, leto, aop_code, cache, all_shema_dict)
            
            # Convert breakdown dict to list of objects with names
            konti_list = []
            # Filter out zero values to keep it clean
            for k, v in breakdown.items():
                if abs(v) > 0.001:
                    konti_list.append({
                        "konto": k,
                        "naziv": konti_dict.get(k, "Neznan konto"),
                        "vrednost": round(v, 2)
                    })
            # Sort by account number
            konti_list.sort(key=lambda x: x['konto'])
            
            results.append({
                "aop": aop_code,
                "naziv": row['naziv'],
                "vrednost": round(val, 2),
                "konti": konti_list
            })
        
        return results
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@router.get("/api/izpiski")
def get_izpiski():
    conn = database.get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT ig.*, 
        (SELECT SUM(znesek) FROM izpiski_postavke WHERE izpisek_id = ig.id AND tip_prometa = 'dobro') as vsota_prilivov,
        (SELECT SUM(znesek) FROM izpiski_postavke WHERE izpisek_id = ig.id AND tip_prometa = 'breme') as vsota_odlivov,
        (SELECT EXISTS(SELECT 1 FROM priloge WHERE parent_type = 'izpiski' AND parent_id = ig.id)) as ima_prilogo
        FROM izpiski_glava ig ORDER BY datum DESC, CAST(stevilka_izpiska AS INTEGER) DESC
    """)
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

@router.get("/api/izpiski/detajl/{id}")
def get_izpisek_detajl(id: int):
    conn = database.get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM izpiski_glava WHERE id = ?", (id,))
    glava = cursor.fetchone()
    
    cursor.execute("""
        SELECT p.*, part.naziv as partner_naziv,
               (SELECT COUNT(*) FROM placila_povezave WHERE izpisek_postavka_id = p.id) as st_povezav
        FROM izpiski_postavke p 
        LEFT JOIN partnerji part ON p.partner_id = part.id
        WHERE p.izpisek_id = ?
    """, (id,))
    postavke = cursor.fetchall()
    conn.close()
    
    res = dict(glava)
    res['postavke'] = [dict(p) for p in postavke]
    return res

@router.delete("/api/izpiski/{id}")
def delete_izpisek(id: int, force: bool = False):
    try:
        conn = database.get_db()
        cursor = conn.cursor()
        # Faza 2: Preverjanje hramba roka (5 let za bančne izpiske)
        if not force:
            cursor.execute("SELECT datum FROM izpiski_glava WHERE id = ?", (id,))
            izp_row = cursor.fetchone()
            if izp_row:
                h = _preveri_hrambo(izp_row['datum'] or '', 'izpisek')
                if not h['dovoljeno']:
                    conn.close()
                    return {"status": "warning", "hramba_do": h['hramba_do'],
                            "let": h['let'], "message": h['message']}
        # Obstoječa logika brisanja — nedotaknjena
        cursor.execute("DELETE FROM izpiski_postavke WHERE izpisek_id = ?", (id,))
        cursor.execute("DELETE FROM izpiski_glava WHERE id = ?", (id,))
        conn.commit()
        conn.close()
        return {"status": "success"}
    except Exception as e:
        if 'conn' in locals(): conn.close()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/izpiski")
def create_izpisek(izpisek: Izpisek):
    conn = database.get_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO izpiski_glava (datum, stevilka_izpiska, zacetno_stanje, koncno_stanje, kontrolna_vsota)
        VALUES (?, ?, ?, ?, ?)
    """, (izpisek.datum, izpisek.stevilka_izpiska, izpisek.zacetno_stanje, izpisek.koncno_stanje, izpisek.kontrolna_vsota))
    
    izp_id = cursor.lastrowid
    for p in izpisek.postavke:
        cursor.execute("""
            INSERT INTO izpiski_postavke (izpisek_id, tip_prometa, partner_id, namen, znesek, koda_namena, konto, manualna_likvidacija)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (izp_id, p.tip_prometa, p.partner_id, p.namen, p.znesek, p.koda_namena, p.konto, 1 if p.manualna_likvidacija else 0))
    
    conn.commit()
    conn.close()
    return {"status": "success", "id": izp_id}

@router.put("/api/izpiski/{id}")
def update_izpisek(id: int, izpisek: Izpisek):
    conn = database.get_db()
    cursor = conn.cursor()
    
    # 1. Pridobimo trenutne ID-je postavk v bazi
    cursor.execute("SELECT id FROM izpiski_postavke WHERE izpisek_id = ?", (id,))
    existing_ids = {row['id'] for row in cursor.fetchall()}
    
    # 2. Seznam ID-jev, ki jih želimo ohraniti (so v payloadu)
    new_items_with_ids = [p for p in izpisek.postavke if p.id is not None]
    new_ids = {p.id for p in new_items_with_ids}
    
    # 3. Izbrišemo tiste, ki jih ni več v payloadu
    to_delete = existing_ids - new_ids
    for del_id in to_delete:
        cursor.execute("DELETE FROM izpiski_postavke WHERE id = ?", (del_id,))
        # Opcijsko: izbrišemo tudi likvidacije za te postavke
        cursor.execute("DELETE FROM placila_povezave WHERE izpisek_postavka_id = ?", (del_id,))

    # 4. Posodobimo glavo
    cursor.execute("""
        UPDATE izpiski_glava SET datum=?, stevilka_izpiska=?, zacetno_stanje=?, koncno_stanje=?, kontrolna_vsota=?
        WHERE id = ?
    """, (izpisek.datum, izpisek.stevilka_izpiska, izpisek.zacetno_stanje, izpisek.koncno_stanje, izpisek.kontrolna_vsota, id))
    
    # 5. Posodobimo obstoječe ali vstavimo nove postavke
    result_ids = []
    for p in izpisek.postavke:
        if p.id and p.id in existing_ids:
            # UPDATE
            cursor.execute("""
                UPDATE izpiski_postavke SET 
                    tip_prometa=?, partner_id=?, namen=?, znesek=?, koda_namena=?, konto=?, manualna_likvidacija=?
                WHERE id = ?
            """, (p.tip_prometa, p.partner_id, p.namen, p.znesek, p.koda_namena, p.konto, 1 if p.manualna_likvidacija else 0, p.id))
            result_ids.append(p.id)
        else:
            # INSERT
            cursor.execute("""
                INSERT INTO izpiski_postavke (izpisek_id, tip_prometa, partner_id, namen, znesek, koda_namena, konto, manualna_likvidacija)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (id, p.tip_prometa, p.partner_id, p.namen, p.znesek, p.koda_namena, p.konto, 1 if p.manualna_likvidacija else 0))
            result_ids.append(cursor.lastrowid)
    
    conn.commit()
    conn.close()
    return {"status": "success", "postavke_ids": result_ids}
