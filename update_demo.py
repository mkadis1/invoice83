import os
import shutil
import re

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
shutil.copy2('demo_analytics.py', 'demo/demo_analytics.py')
shutil.copy2('demo_stats.py', 'demo/stats.py')

# 2. Patch main.py for Demo
with open('main.py', 'r', encoding='utf-8') as f:
    main_code = f.read()

main_code = main_code.replace('from fastapi import FastAPI, HTTPException, UploadFile, File, Response', 
                             'from fastapi import FastAPI, HTTPException, UploadFile, File, Response, Request')

# Remove Watchdog
main_code = re.sub(r'# --- HEARTBEAT WATCHDOG ---.*?_wd_thread\.start\(\)\n\n', '', main_code, flags=re.DOTALL)
main_code = re.sub(r'# --- HEARTBEAT WATCHDOG ---.*?_wd_thread\.start\(\)\n', '', main_code, flags=re.DOTALL)

# 1. Patch startup for demo & analytics
startup_demo = '''@app.on_event("startup")
def startup():
    import demo_analytics
    demo_analytics.init_analytics_db()
    database.set_active_db("demo.db")
    database.init_db()
    conn = database.get_db()
    cursor = conn.cursor()
    cursor.execute("INSERT OR IGNORE INTO nastavitve (id, naziv) VALUES (1, 'Primer Tech d.o.o. (DEMO)')")
    conn.commit()
    conn.close()
'''
main_code = re.sub(r'@app\.on_event\("startup"\)\ndef startup\(\):.*?conn\.close\(\)', startup_demo, main_code, flags=re.DOTALL)

# 2. Patch company routes for demo
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

# 3. Remove remaining companies logic
main_code = main_code.replace('COMPANIES_FILE = "companies.json"', '')
main_code = re.sub(r'def get_companies_registry.*?return json\.load\(f\)', '', main_code, flags=re.DOTALL)
main_code = re.sub(r'def save_companies_registry.*?json\.dump\(registry, f, indent=4\)', '', main_code, flags=re.DOTALL)

# 4. Patch heartbeat & inject analytics endpoints
heartbeat_demo = '''@app.get("/api/heartbeat")
def heartbeat(request: Request):
    session_id = request.headers.get("X-Session-ID")
    if session_id:
        import demo_analytics
        demo_analytics.log_heartbeat(session_id)
    return {"ok": True}

@app.post("/api/demo/track-event")
async def track_demo_event(request: Request):
    try:
        session_id = request.headers.get("X-Session-ID")
        data = await request.json()
        if session_id and data:
            import demo_analytics
            demo_analytics.log_event(session_id, data.get("category", "akcija"), data.get("name", ""), data.get("details", ""))
        return {"status": "ok"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.get("/demo-admin/stats")
def demo_admin_stats():
    from fastapi.responses import HTMLResponse
    import demo_analytics
    stats = demo_analytics.get_analytics_summary()
    return HTMLResponse(demo_analytics.render_dashboard_html(stats))

@app.get("/api/demo-stats/json")
def demo_stats_json():
    import demo_analytics
    return demo_analytics.get_analytics_summary()
'''
main_code = re.sub(r'@app\.get\("/api/heartbeat"\)\ndef heartbeat\(\):.*?return \{"ok": True\}', heartbeat_demo, main_code, flags=re.DOTALL)

# 5. Inject middleware right after app mount
middleware = '''
import demo_analytics
demo_analytics.init_analytics_db()

SESSIONS_DIR = Path("sessions")
SESSIONS_DIR.mkdir(exist_ok=True)

@app.middleware("http")
async def session_isolation_middleware(request: Request, call_next):
    import shutil
    path = request.url.path
    
    # Pridobi sejo
    session_id = request.headers.get("X-Session-ID")
    
    # Zabeleži obisk za analitiko (brez statičnih datotek)
    if session_id and not path.startswith("/static"):
        client_ip = request.headers.get("x-forwarded-for") or (request.client.host if request.client else "unknown")
        user_agent = request.headers.get("user-agent", "")
        demo_analytics.log_session_hit(session_id, client_ip, user_agent, path)

    if not path.startswith("/api") or path in ["/api/heartbeat", "/api/companies", "/api/debug-session", "/api/demo/track-event", "/api/demo-stats/json"]:
        return await call_next(request)

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

print("[OK] Demo datoteke in analitika so bile uspesno posodobljene.")
