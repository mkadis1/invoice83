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

@router.get("/api/nastavitve")
def get_nastavitve():
    conn = database.get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM nastavitve WHERE id = 1")
    row = cursor.fetchone()
    conn.close()
    
    res = dict(row) if row else {}
    
    # Preveri obstoj logotipa
    active_id = "default"
    if "get_companies_registry" in globals():
        try:
            registry = globals()["get_companies_registry"]()
            active_id = registry.get("active_id", "default")
        except Exception:
            pass
            
    import os
    logo_url = None
    for ext in ['png', 'jpg', 'jpeg', 'gif', 'PNG', 'JPG', 'JPEG', 'GIF']:
        p_comp = f"static/uploads/logo_{active_id}.{ext}"
        if os.path.exists(p_comp):
            logo_url = f"/static/uploads/logo_{active_id}.{ext}"
            break
            
    if not logo_url:
        for ext in ['png', 'jpg', 'jpeg', 'gif', 'PNG', 'JPG', 'JPEG', 'GIF']:
            p_glob = f"static/uploads/logo.{ext}"
            if os.path.exists(p_glob):
                logo_url = f"/static/uploads/logo.{ext}"
                break
                
    res["logo_url"] = logo_url
    return res

@router.post("/api/nastavitve")
@router.put("/api/nastavitve")
def save_nastavitve(n: Nastavitve):
    conn = database.get_db()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE nastavitve SET 
            naziv=?, ulica=?, posta_kraj=?, drzava=?, davcna_stevilka=?, 
            zavezanec_za_ddv=?, trr=?, banka=?, email_posiljatelja=?, telefon=?, spletna_stran=?,
            kratko_ime=?, dvostavno_knjigovodstvo=?, smtp_server=?, smtp_port=?, smtp_username=?,
            smtp_password=?, smtp_use_tls=?, email_template_racun=?, email_template_ponudba=?, email_template_dobropis=?, email_template_opomin=?,
            dashboard_config=?
        WHERE id = 1
    """, (n.naziv, n.ulica, n.posta_kraj, n.drzava, n.davcna_stevilka, 
          n.zavezanec_za_ddv, n.trr, n.banka, n.email_posiljatelja, n.telefon, n.spletna_stran,
          n.kratko_ime, n.dvostavno_knjigovodstvo, n.smtp_server, n.smtp_port, n.smtp_username,
          n.smtp_password, n.smtp_use_tls, n.email_template_racun, n.email_template_ponudba, n.email_template_dobropis, n.email_template_opomin,
          n.dashboard_config))
    conn.commit()
    conn.close()
    
    # Sinhronizacija z registries.json če imamo kratko_ime
    if n.kratko_ime:
        registry = get_companies_registry()
        active_id = registry.get("active_id")
        for item in registry["items"]:
            if item["id"] == active_id:
                item["name"] = n.kratko_ime
                break
        save_companies_registry(registry)
        
    return {"status": "success"}

@router.get("/api/settings/llama")
def get_llama_settings():
    conn = database.get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT vrednost FROM llama_settings WHERE kljuc = 'learning_mode'")
    row = cursor.fetchone()
    conn.close()
    val = row['vrednost'] if row else '0'
    return {"learning_mode": val == '1'}

@router.post("/api/settings/llama")
def save_llama_settings(settings: LlamaSettings):
    conn = database.get_db()
    cursor = conn.cursor()
    val = '1' if settings.learning_mode else '0'
    cursor.execute("INSERT OR REPLACE INTO llama_settings (kljuc, vrednost) VALUES ('learning_mode', ?)", (val,))
    conn.commit()
    conn.close()
    return {"status": "success"}

@router.delete("/api/nastavitve/logo")
def delete_logo():
    try:
        active_id = "default"
        if "get_companies_registry" in globals():
            try:
                registry = globals()["get_companies_registry"]()
                active_id = registry.get("active_id", "default")
            except Exception:
                pass
                
        import os
        deleted = False
        for ext in ['png', 'jpg', 'jpeg', 'gif', 'PNG', 'JPG', 'JPEG', 'GIF']:
            p = f"static/uploads/logo_{active_id}.{ext}"
            if os.path.exists(p):
                try:
                    os.remove(p)
                    deleted = True
                except:
                    pass
        # preveri še globalnega
        for ext in ['png', 'jpg', 'jpeg', 'gif', 'PNG', 'JPG', 'JPEG', 'GIF']:
            p = f"static/uploads/logo.{ext}"
            if os.path.exists(p):
                try:
                    os.remove(p)
                    deleted = True
                except:
                    pass
                    
        return {"status": "success", "deleted": deleted}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/nastavitve/ujp_settings")
def save_ujp_settings(data: dict):
    """Shrani UJP B2B nastavitve (geslo potrdila, testni način)."""
    conn = database.get_db()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE nastavitve SET ujp_cert_password=?, ujp_test_mode=? WHERE id=1",
        (data.get("ujp_cert_password", ""), 1 if data.get("ujp_test_mode", True) else 0)
    )
    conn.commit()
    conn.close()
    return {"status": "success"}

@router.get("/api/nastavitve/ujp_status")
def get_ujp_status():
    """Vrne status UJP B2B nastavitev (ali je potrdilo naloženo)."""
    conn = database.get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT ujp_cert_path, ujp_cert_password, ujp_test_mode FROM nastavitve WHERE id=1")
    row = cursor.fetchone()
    conn.close()
    if not row:
        return {"cert_loaded": False, "test_mode": True}
    cert_path = row["ujp_cert_path"] or ""
    cert_loaded = bool(cert_path and os.path.exists(cert_path))
    return {
        "cert_loaded": cert_loaded,
        "cert_filename": os.path.basename(cert_path) if cert_loaded else None,
        "test_mode": bool(row["ujp_test_mode"] if row["ujp_test_mode"] is not None else 1)
    }

@router.delete("/api/nastavitve/ujp_cert")
def delete_ujp_cert():
    """Izbriše naloženo UJP digitalno potrdilo."""
    conn = database.get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT ujp_cert_path FROM nastavitve WHERE id=1")
    row = cursor.fetchone()
    if row and row["ujp_cert_path"]:
        try:
            if os.path.exists(row["ujp_cert_path"]):
                os.remove(row["ujp_cert_path"])
        except:
            pass
    cursor.execute("UPDATE nastavitve SET ujp_cert_path=NULL WHERE id=1")
    conn.commit()
    conn.close()
    return {"status": "success"}

@router.get("/api/zakljucna_besedila")
def get_zakljucna_besedila():
    conn = database.get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM zakljucna_besedila")
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

@router.post("/api/zakljucna_besedila")
def create_zakljucno_besedilo(zb: ZakljucnoBesedilo):
    conn = database.get_db()
    cursor = conn.cursor()
    cursor.execute("INSERT INTO zakljucna_besedila (naziv, besedilo) VALUES (?, ?)", (zb.naziv, zb.besedilo))
    conn.commit()
    conn.close()
    return {"status": "success"}

@router.put("/api/zakljucna_besedila/{id}")
def update_zakljucno_besedilo(id: int, zb: ZakljucnoBesedilo):
    conn = database.get_db()
    cursor = conn.cursor()
    cursor.execute("UPDATE zakljucna_besedila SET naziv=?, besedilo=? WHERE id = ?", (zb.naziv, zb.besedilo, id))
    conn.commit()
    conn.close()
    return {"status": "success"}

@router.delete("/api/zakljucna_besedila/{id}")
def delete_zakljucno_besedilo(id: int):
    conn = database.get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM zakljucna_besedila WHERE id = ?", (id,))
    conn.commit()
    conn.close()
    return {"status": "success"}

@router.get("/api/tecaj")
def get_tecaj(valuta: str, datum: Optional[str] = "latest"):
    try:
        # Frankfurter API včasih zavrača klice iz brskalnika (CORS), zato to naredimo na strežniku
        url = f"https://api.frankfurter.app/{datum}?from={valuta}&to=EUR"
        response = requests.get(url, timeout=5)
        
        if response.status_code != 200 and datum != "latest":
            # Poskusimo z 'latest' če datum ne obstaja
            response = requests.get(f"https://api.frankfurter.app/latest?from={valuta}&to=EUR", timeout=5)
            
        if response.status_code == 200:
            return response.json()
        else:
            return {"rates": {"EUR": 1.0}, "error": "API response error"}
    except Exception as e:
        return {"rates": {"EUR": 1.0}, "error": str(e)}
