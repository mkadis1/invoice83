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

@router.get("/api/osnovna_sredstva")
def get_osnovna_sredstva():
    conn = database.get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM osnovna_sredstva")
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

@router.post("/api/osnovna_sredstva")
def create_osnovno_sredstvo(os_obj: OsnovnoSredstvo):
    conn = database.get_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO osnovna_sredstva (naziv, aktiven, amortizacijska_skupina, inventarna_stevilka, datum_nabave, nabavna_vrednost, stopnja_amortizacije, trenutna_vrednost, tip)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (os_obj.naziv, os_obj.aktiven, os_obj.amortizacijska_skupina, os_obj.inventarna_stevilka, os_obj.datum_nabave, os_obj.nabavna_vrednost, os_obj.stopnja_amortizacije, os_obj.trenutna_vrednost, os_obj.tip))
    conn.commit()
    conn.close()
    return {"status": "success"}

@router.put("/api/osnovna_sredstva/{id}")
def update_osnovno_sredstvo(id: int, os_obj: OsnovnoSredstvo):
    conn = database.get_db()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE osnovna_sredstva SET naziv=?, aktiven=?, amortizacijska_skupina=?, inventarna_stevilka=?, datum_nabave=?, nabavna_vrednost=?, stopnja_amortizacije=?, trenutna_vrednost=?, tip=?
        WHERE id = ?
    """, (os_obj.naziv, os_obj.aktiven, os_obj.amortizacijska_skupina, os_obj.inventarna_stevilka, os_obj.datum_nabave, os_obj.nabavna_vrednost, os_obj.stopnja_amortizacije, os_obj.trenutna_vrednost, os_obj.tip, id))
    conn.commit()
    conn.close()
    return {"status": "success"}

@router.delete("/api/osnovna_sredstva/{id}")
def delete_osnovno_sredstvo(id: int):
    try:
        conn = database.get_db()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM osnovna_sredstva WHERE id = ?", (id,))
        conn.commit()
        conn.close()
        return {"status": "success"}
    except Exception as e:
        if 'conn' in locals(): conn.close()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/amortizacija/{leto}/posodobi_vrednosti")
def posodobi_vrednosti_os(leto: int):
    """Posodobi trenutna_vrednost vseh OS glede na knjiženo amortizacijo (konto 050)."""
    conn = database.get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT id, nabavna_vrednost FROM osnovna_sredstva WHERE aktiven = 1")
        sredstva = cursor.fetchall()
        for s in sredstva:
            cursor.execute("""
                SELECT COALESCE(SUM(znesek_v_dobro), 0) as akumulirana
                FROM temeljnice_postavke
                WHERE konto = '050' AND dokument_id = ? AND dokument_tip = 'amortizacija'
            """, (s['id'],))
            akumulirana = cursor.fetchone()['akumulirana'] or 0.0
            preostala = max(0.0, (s['nabavna_vrednost'] or 0.0) - akumulirana)
            cursor.execute("UPDATE osnovna_sredstva SET trenutna_vrednost = ? WHERE id = ?",
                           (round(preostala, 2), s['id']))
        conn.commit()
        return {"status": "success", "posodobljeno": len(sredstva)}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()
