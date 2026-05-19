import os
import json
import glob
import sqlite3
import shutil
import uuid
from datetime import datetime
from zoneinfo import ZoneInfo

def get_db():
    conn = sqlite3.connect("racunovodstvo.db")
    conn.row_factory = sqlite3.Row
    return conn

def safe_print(msg):
    try:
        print(msg)
    except UnicodeEncodeError:
        print(msg.encode('ascii', 'replace').decode('ascii'))

def get_now_slo():
    return datetime.now(ZoneInfo("Europe/Ljubljana")).strftime("%Y-%m-%d %H:%M:%S")

def main():
    results_dir = "scratch/results"
    sample_dir = "sample"
    uploads_dir = "uploads"
    
    os.makedirs(uploads_dir, exist_ok=True)
    
    json_files = glob.glob(os.path.join(results_dir, "*.json"))
    
    if not json_files:
        safe_print("No JSON files found in scratch/results/!")
        return
        
    conn = get_db()
    cursor = conn.cursor()
    
    linked_count = 0
    skipped_count = 0
    missing_file_count = 0
    
    for filepath in json_files:
        filename_base = os.path.splitext(os.path.basename(filepath))[0]
        with open(filepath, "r", encoding="utf-8") as f:
            try:
                data = json.load(f)
            except Exception as e:
                safe_print(f"Error loading {filepath}: {e}")
                continue
                
        # 1. Get document details
        stevilka = data.get("stevilka", "").strip()
        partner_data = data.get("partner", {})
        naziv = partner_data.get("naziv", "").strip()
        davcna = partner_data.get("davcna_stevilka", "").strip()
        
        if len(davcna) == 8 and davcna.isdigit():
            davcna = "SI" + davcna
            
        # Try to find partner
        partner_id = None
        if davcna:
            cursor.execute("SELECT id FROM partnerji WHERE davcna_stevilka = ?", (davcna,))
            row = cursor.fetchone()
            if row:
                partner_id = row["id"]
        if not partner_id and naziv:
            cursor.execute("SELECT id FROM partnerji WHERE LOWER(naziv) = ?", (naziv.lower(),))
            row = cursor.fetchone()
            if row:
                partner_id = row["id"]
                
        if not partner_id:
            if "ajpes" in naziv.lower():
                cursor.execute("SELECT id FROM partnerji WHERE davcna_stevilka = 'SI53655189'")
                row = cursor.fetchone()
                if row: partner_id = row["id"]
                
        if not stevilka:
            stevilka = "NEZNANA_" + filename_base
            
        # 2. Find document in database
        doc_row = None
        if partner_id:
            cursor.execute(
                "SELECT id, interna_stevilka FROM dokumenti WHERE stevilka = ? AND partner_id = ? AND tip = 'prejeti_racuni'",
                (stevilka, partner_id)
            )
            doc_row = cursor.fetchone()
            
        if not doc_row:
            # Lenient fallback: search by invoice number only
            cursor.execute(
                "SELECT id, interna_stevilka FROM dokumenti WHERE stevilka = ? AND tip = 'prejeti_racuni'",
                (stevilka,)
            )
            doc_row = cursor.fetchone()
            
        if not doc_row:
            safe_print(f"[{filename_base}] Document not found in database (Invoice: {stevilka}). Skipping.")
            continue
            
        doc_id = doc_row["id"]
        interna_stevilka = doc_row["interna_stevilka"]
        
        # 3. Check if attachment already exists
        cursor.execute(
            "SELECT id FROM priloge WHERE parent_type = 'dokumenti' AND parent_id = ?",
            (doc_id,)
        )
        if cursor.fetchone():
            safe_print(f"[{filename_base}] Document {interna_stevilka} already has an attachment. Skipping.")
            skipped_count += 1
            continue
            
        # 4. Find corresponding original file in sample/
        extensions = [".pdf", ".png", ".jpg", ".jpeg", ".PDF", ".PNG", ".JPG", ".JPEG"]
        source_file = None
        original_ext = None
        
        for ext in extensions:
            test_path = os.path.join(sample_dir, filename_base + ext)
            if os.path.exists(test_path):
                source_file = test_path
                original_ext = ext
                break
                
        # Normalized/fuzzy search fallback for unicode/spelling differences
        if not source_file:
            def normalize_name(s):
                return (s.lower()
                        .replace('č', 'c')
                        .replace('š', 's')
                        .replace('ž', 'z')
                        .replace('ć', 'c')
                        .replace('đ', 'd')
                        .replace('lesnik', 'lecnik'))
            
            norm_target = normalize_name(filename_base)
            for fn in os.listdir(sample_dir):
                fn_base, fn_ext = os.path.splitext(fn)
                if fn_ext in extensions:
                    if normalize_name(fn_base) == norm_target:
                        source_file = os.path.join(sample_dir, fn)
                        original_ext = fn_ext
                        break
                        
        if not source_file:
            safe_print(f"[{filename_base}] Original document file not found in {sample_dir}/! Tried extensions: {extensions}")
            missing_file_count += 1
            continue
            
        # 5. Copy file and insert attachment row
        original_name = filename_base + original_ext
        unique_filename = f"{uuid.uuid4().hex}{original_ext.lower()}"
        dest_path = os.path.join(uploads_dir, unique_filename)
        
        try:
            shutil.copy2(source_file, dest_path)
            
            cursor.execute(
                """
                INSERT INTO priloge (parent_type, parent_id, filename, original_name, uploaded_at)
                VALUES ('dokumenti', ?, ?, ?, ?)
                """,
                (doc_id, unique_filename, original_name, get_now_slo())
            )
            safe_print(f"[{filename_base}] Successfully linked attachment for {interna_stevilka} -> copied to uploads/{unique_filename}")
            linked_count += 1
        except Exception as e:
            safe_print(f"Error copying/linking attachment for {filename_base}: {e}")
            
    conn.commit()
    conn.close()
    
    safe_print(f"\nAttachment linking finished!")
    safe_print(f"Linked: {linked_count}")
    safe_print(f"Already had attachment: {skipped_count}")
    safe_print(f"Missing files: {missing_file_count}")

if __name__ == "__main__":
    main()
