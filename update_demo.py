import os
import shutil

# 1. Copy files
shutil.copy2('static/app.js', 'demo/static/app.js')
shutil.copy2('static/index.html', 'demo/static/index.html')
try:
    shutil.copy2('static/styles.css', 'demo/static/styles.css')
except:
    pass
shutil.copy2('database.py', 'demo/database.py')
shutil.copy2('pdf_parser.py', 'demo/pdf_parser.py')
shutil.copy2('knjizenje.py', 'demo/knjizenje.py')
shutil.copy2('invoice_ocr.py', 'demo/invoice_ocr.py')

# 2. Patch main.py for Demo
with open('main.py', 'r', encoding='utf-8') as f:
    main_code = f.read()

main_code = main_code.replace('from fastapi import FastAPI, HTTPException, UploadFile, File, Response', 
                             'from fastapi import FastAPI, HTTPException, UploadFile, File, Response, Request')

# We need the demo middleware and dummy routes. We have them in demo/main.py currently.
with open('demo/main.py', 'r', encoding='utf-8') as f:
    demo_old = f.read()

demo_header = demo_old.split('# --- NASTAVITVE ---')[0] if '# --- NASTAVITVE ---' in demo_old else ''
if not demo_header:
    # fallback, manually extract the middleware part
    pass

# Let's just create the demo version manually by removing the watchdog and company logic from main_code
# and inserting the demo middleware.

import re

# Remove Watchdog
main_code = re.sub(r'# --- HEARTBEAT WATCHDOG ---.*?_wd_thread\.start\(\)\n', '', main_code, flags=re.DOTALL)

# 1. Patch specific parts
startup_demo = '''@app.on_event("startup")
def startup():
    database.set_active_db("demo.db")
    database.init_db()
    conn = database.get_db()
    cursor = conn.cursor()
    cursor.execute("INSERT OR IGNORE INTO nastavitve (id, naziv) VALUES (1, 'Primer Tech d.o.o. (DEMO)')")
    conn.commit()
    conn.close()
'''
main_code = re.sub(r'@app\.on_event\("startup"\)\ndef startup\(\):.*?conn\.close\(\)', startup_demo, main_code, flags=re.DOTALL)

company_demo = '''@app.get("/api/companies")
def list_companies():
    return {"active_id": "demo", "items": [{"id": "demo", "name": "Primer Tech d.o.o. (DEMO)", "db": "demo.db"}]}

@app.post("/api/companies/switch/{company_id}")
def switch_company(company_id: str):
    return {"status": "success", "company": {"id": "demo", "name": "Primer Tech d.o.o. (DEMO)", "db": "demo.db"}}

@app.post("/api/companies/create")
def create_company(data: dict):
    from fastapi import HTTPException
    raise HTTPException(status_code=403, detail="Ustvarjanje podjetij ni dovoljeno v demo verziji.")
'''
main_code = re.sub(r'@app\.get\("/api/companies"\).*?return \{"status": "success", "company": new_company\}', company_demo, main_code, flags=re.DOTALL)

# 2. Remove remaining companies logic (the functions and global var)
main_code = main_code.replace('COMPANIES_FILE = "companies.json"', '')
main_code = re.sub(r'def get_companies_registry.*?return json\.load\(f\)', '', main_code, flags=re.DOTALL)
main_code = re.sub(r'def save_companies_registry.*?json\.dump\(registry, f, indent=4\)', '', main_code, flags=re.DOTALL)

# Inject middleware right after app mount
middleware = '''
SESSIONS_DIR = Path("sessions")
SESSIONS_DIR.mkdir(exist_ok=True)

@app.middleware("http")
async def session_isolation_middleware(request: Request, call_next):
    import shutil
    path = request.url.path
    if not path.startswith("/api") or path in ["/api/heartbeat", "/api/companies", "/api/debug-session"]:
        return await call_next(request)

    session_id = request.headers.get("X-Session-ID")
    if not session_id:
        database.set_active_db("demo.db")
        return await call_next(request)

    safe_id = "".join(c for c in session_id if c.isalnum() or c in "-_")
    session_db_path = SESSIONS_DIR / f"{safe_id}.db"

    if not session_db_path.exists():
        try:
            shutil.copy2("demo.db", session_db_path)
        except Exception as e:
            database.set_active_db("demo.db")
            return await call_next(request)

    database.set_active_db(str(session_db_path))
    return await call_next(request)

'''
main_code = main_code.replace('app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")', 
                              'app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")\n' + middleware)


with open('demo/main.py', 'w', encoding='utf-8') as f:
    f.write(main_code)

print("Demo files updated successfully.")
