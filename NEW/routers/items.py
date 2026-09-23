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

@router.get("/api/artikli_storitve")
def get_artikli_storitve(vrsta: Optional[str] = None, aktiven: Optional[bool] = None):
    conn = database.get_db()
    cursor = conn.cursor()
    sql = """
        SELECT a.*, IFNULL(SUM(z.kolicina), 0) as zaloga_kolicina
        FROM artikli_storitve a
        LEFT JOIN zaloga z ON a.id = z.artikel_id
        WHERE 1=1
    """
    params = []
    if vrsta:
        sql += " AND a.vrsta = ?"
        params.append(vrsta)
    if aktiven is not None:
        sql += " AND a.aktiven = ?"
        params.append(1 if aktiven else 0)
    
    sql += " GROUP BY a.id ORDER BY a.sifra"
    cursor.execute(sql, params)
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

@router.get("/api/artikli_storitve/search")
def search_artikli_storitve(q: str):
    conn = database.get_db()
    cursor = conn.cursor()
    query = "%" + q + "%"
    cursor.execute("""
        SELECT * FROM artikli_storitve
        WHERE (naziv LIKE ? OR sifra LIKE ? OR opis LIKE ?) AND aktiven = 1
        ORDER BY sifra LIMIT 30
    """, (query, query, query))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

@router.get("/api/artikli_storitve/{id}")
def get_artikel_storitev(id: int):
    conn = database.get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM artikli_storitve WHERE id = ?", (id,))
    row = cursor.fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Artikel/storitev ni najden")
    return dict(row)

@router.post("/api/artikli_storitve")
def create_artikel_storitev(a: ArtiklStoritev):
    conn = database.get_db()
    cursor = conn.cursor()
    try:
        sifra = a.sifra if a.sifra else _naslednja_sifra(cursor, a.vrsta)
        cursor.execute("""
            INSERT INTO artikli_storitve (sifra, vrsta, naziv, opis, enota_mere, cena_malo, cena_velo, stopnja_ddv, konto, aktiven, vodi_zalogo)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (sifra, a.vrsta, a.naziv, a.opis, a.enota_mere, a.cena_malo, a.cena_velo, a.stopnja_ddv, a.konto, 1 if a.aktiven else 0, 1 if a.vodi_zalogo else 0))
        new_id = cursor.lastrowid
        
        # Če je podana začetna zaloga, jo vpišemo v tabelo zaloga
        if a.vodi_zalogo and a.zacetna_zaloga and a.zacetna_zaloga != 0:
            cursor.execute("""
                INSERT INTO zaloga (artikel_id, kolicina, datum, opis)
                VALUES (?, ?, ?, ?)
            """, (new_id, a.zacetna_zaloga, datetime.now().strftime("%Y-%m-%d"), "Začetno stanje"))
        
        conn.commit()
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=400, detail=f"Napaka: {str(e)}")
    conn.close()
    return {"status": "success", "id": new_id, "sifra": sifra}

@router.put("/api/artikli_storitve/{id}")
def update_artikel_storitev(id: int, a: ArtiklStoritev):
    conn = database.get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            UPDATE artikli_storitve SET vrsta=?, naziv=?, opis=?, enota_mere=?, cena_malo=?, cena_velo=?,
            stopnja_ddv=?, konto=?, aktiven=?, vodi_zalogo=?
            WHERE id = ?
        """, (a.vrsta, a.naziv, a.opis, a.enota_mere, a.cena_malo, a.cena_velo, a.stopnja_ddv, a.konto, 1 if a.aktiven else 0, 1 if a.vodi_zalogo else 0, id))
        conn.commit()
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=400, detail=f"Napaka: {str(e)}")
    conn.close()
    return {"status": "success"}

@router.delete("/api/artikli_storitve/{id}")
def delete_artikel_storitev(id: int):
    conn = database.get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM artikli_storitve WHERE id = ?", (id,))
    conn.commit()
    conn.close()
    return {"status": "success"}

@router.post("/api/artikli_storitve/{id}/zaloga")
def adjust_zaloga(id: int, data: dict):
    # data: { kolicina: float, opis: str }
    conn = database.get_db()
    cursor = conn.cursor()
    try:
        kolicina = float(data.get('kolicina', 0))
        opis = data.get('opis', 'Ročna prilagoditev')
        datum = get_now_slo()
        
        cursor.execute("""
            INSERT INTO zaloga (artikel_id, kolicina, datum, opis)
            VALUES (?, ?, ?, ?)
        """, (id, kolicina, datum, opis))
        conn.commit()
    except Exception as e:
        conn.rollback()
        conn.close()
        raise HTTPException(status_code=400, detail=str(e))
    conn.close()
    return {"status": "success"}
