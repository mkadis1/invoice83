import sqlite3
import os
import datetime
from zoneinfo import ZoneInfo
import re

ANALYTICS_DB = "analytics.db"

def get_slo_now():
    return datetime.datetime.now(ZoneInfo("Europe/Ljubljana")).strftime("%Y-%m-%d %H:%M:%S")

def init_analytics_db(db_path=ANALYTICS_DB):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS sessions (
        session_id TEXT PRIMARY KEY,
        first_seen TEXT,
        last_seen TEXT,
        duration_seconds INTEGER DEFAULT 0,
        ip_address TEXT,
        user_agent TEXT,
        device_type TEXT,
        browser TEXT,
        page_views INTEGER DEFAULT 1
    )
    """)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT,
        timestamp TEXT,
        event_category TEXT,
        event_name TEXT,
        details TEXT
    )
    """)
    conn.commit()
    conn.close()

def parse_user_agent(ua_string):
    if not ua_string:
        return "Neznano", "Neznano"
    
    ua = ua_string.lower()
    
    # Naprava
    if "mobile" in ua or "android" in ua or "iphone" in ua or "ipod" in ua:
        device = "📱 Mobilni telefon"
    elif "ipad" in ua or "tablet" in ua:
        device = "📟 Tablica"
    elif "macintosh" in ua or "mac os" in ua:
        device = "💻 Mac Računalnik"
    elif "windows" in ua:
        device = "🖥️ Windows Računalnik"
    elif "linux" in ua:
        device = "🐧 Linux Računalnik"
    else:
        device = "💻 Namizni računalnik"
        
    # Brskalnik
    if "edg/" in ua or "edge" in ua:
        browser = "Edge"
    elif "opr/" in ua or "opera" in ua:
        browser = "Opera"
    elif "chrome" in ua:
        browser = "Chrome"
    elif "safari" in ua and "chrome" not in ua:
        browser = "Safari"
    elif "firefox" in ua:
        browser = "Firefox"
    else:
        browser = "Ostali"
        
    return device, browser

def log_session_hit(session_id: str, ip: str, ua_string: str, path: str, db_path=ANALYTICS_DB):
    try:
        now = get_slo_now()
        device, browser = parse_user_agent(ua_string)
        
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        cursor.execute("SELECT first_seen, last_seen, page_views FROM sessions WHERE session_id = ?", (session_id,))
        row = cursor.fetchone()
        
        if row:
            # Obstoječa seja - posodobi
            first_seen = datetime.datetime.strptime(row[0], "%Y-%m-%d %H:%M:%S")
            now_dt = datetime.datetime.strptime(now, "%Y-%m-%d %H:%M:%S")
            duration = int((now_dt - first_seen).total_seconds())
            views = row[2] + 1
            
            cursor.execute("""
                UPDATE sessions 
                SET last_seen = ?, duration_seconds = ?, page_views = ?
                WHERE session_id = ?
            """, (now, duration, views, session_id))
        else:
            # Nova seja
            cursor.execute("""
                INSERT INTO sessions (session_id, first_seen, last_seen, duration_seconds, ip_address, user_agent, device_type, browser, page_views)
                VALUES (?, ?, ?, 0, ?, ?, ?, ?, 1)
            """, (session_id, now, now, ip, ua_string[:250] if ua_string else '', device, browser))
            
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"[Analytics Error] log_session_hit: {e}")

def log_heartbeat(session_id: str, db_path=ANALYTICS_DB):
    try:
        now = get_slo_now()
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        cursor.execute("SELECT first_seen FROM sessions WHERE session_id = ?", (session_id,))
        row = cursor.fetchone()
        
        if row:
            first_seen = datetime.datetime.strptime(row[0], "%Y-%m-%d %H:%M:%S")
            now_dt = datetime.datetime.strptime(now, "%Y-%m-%d %H:%M:%S")
            duration = int((now_dt - first_seen).total_seconds())
            
            cursor.execute("""
                UPDATE sessions 
                SET last_seen = ?, duration_seconds = ?
                WHERE session_id = ?
            """, (now, duration, session_id))
            conn.commit()
            
        conn.close()
    except Exception as e:
        print(f"[Analytics Error] log_heartbeat: {e}")

def log_event(session_id: str, category: str, name: str, details: str = "", db_path=ANALYTICS_DB):
    try:
        now = get_slo_now()
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO events (session_id, timestamp, event_category, event_name, details)
            VALUES (?, ?, ?, ?, ?)
        """, (session_id, now, category, name, details))
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"[Analytics Error] log_event: {e}")

def get_analytics_summary(db_path=ANALYTICS_DB):
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # 1. Skupno število sej
        cursor.execute("SELECT COUNT(*) FROM sessions")
        total_sessions = cursor.fetchone()[0] or 0
        
        # 2. Seje danes
        today_date = datetime.datetime.now(ZoneInfo("Europe/Ljubljana")).strftime("%Y-%m-%d")
        cursor.execute("SELECT COUNT(*) FROM sessions WHERE first_seen LIKE ?", (f"{today_date}%",))
        sessions_today = cursor.fetchone()[0] or 0
        
        # 3. Povprečni čas trajanja (v minutah)
        cursor.execute("SELECT AVG(duration_seconds) FROM sessions WHERE duration_seconds > 0")
        avg_duration_sec = cursor.fetchone()[0] or 0
        avg_duration_min = round(avg_duration_sec / 60, 1)
        
        # 4. Naprave
        cursor.execute("SELECT device_type, COUNT(*) FROM sessions GROUP BY device_type ORDER BY COUNT(*) DESC")
        devices = cursor.fetchall()
        
        # 5. Brskalniki
        cursor.execute("SELECT browser, COUNT(*) FROM sessions GROUP BY browser ORDER BY COUNT(*) DESC")
        browsers = cursor.fetchall()
        
        # 6. Najbolj obiskani moduli / dogodki
        cursor.execute("SELECT event_name, COUNT(*) FROM events GROUP BY event_name ORDER BY COUNT(*) DESC LIMIT 10")
        top_events = cursor.fetchall()
        
        # 7. Zadnjih 20 sej
        cursor.execute("""
            SELECT session_id, first_seen, last_seen, duration_seconds, ip_address, device_type, browser, page_views
            FROM sessions 
            ORDER BY first_seen DESC 
            LIMIT 30
        """)
        recent_sessions = cursor.fetchall()
        
        conn.close()
        
        return {
            "total_sessions": total_sessions,
            "sessions_today": sessions_today,
            "avg_duration_min": avg_duration_min,
            "devices": devices,
            "browsers": browsers,
            "top_events": top_events,
            "recent_sessions": recent_sessions
        }
    except Exception as e:
        print(f"[Analytics Error] get_analytics_summary: {e}")
        return {
            "total_sessions": 0, "sessions_today": 0, "avg_duration_min": 0,
            "devices": [], "browsers": [], "top_events": [], "recent_sessions": []
        }

def render_dashboard_html(data):
    # Generira moderen in pregleden HTML dashboard
    devices_html = "".join([f"<li><strong>{d[0]}:</strong> {d[1]} obiskov</li>" for d in data["devices"]]) or "<li>Ni podatkov</li>"
    browsers_html = "".join([f"<li><strong>{b[0]}:</strong> {b[1]} obiskov</li>" for b in data["browsers"]]) or "<li>Ni podatkov</li>"
    events_html = "".join([f"<tr><td style='padding:8px; border-bottom:1px solid #eee;'>{e[0]}</td><td style='padding:8px; border-bottom:1px solid #eee; text-align:right;'><b>{e[1]}</b> klikov</td></tr>" for e in data["top_events"]]) or "<tr><td colspan='2' style='padding:8px;'>Ni zabeleženih dogodkov</td></tr>"
    
    rows_html = ""
    for s in data["recent_sessions"]:
        dur = f"{s[3]}s" if s[3] < 60 else f"{s[3]//60}m {s[3]%60}s"
        rows_html += f"""
        <tr style="border-bottom:1px solid #f1f3f5;">
            <td style="padding:10px; font-family:monospace; font-size:0.85em; color:#495057;">{s[0][:12]}...</td>
            <td style="padding:10px;">{s[1]}</td>
            <td style="padding:10px;">{s[2]}</td>
            <td style="padding:10px; font-weight:bold; color:#2b8a3e;">{dur}</td>
            <td style="padding:10px;">{s[4]}</td>
            <td style="padding:10px;">{s[5]}</td>
            <td style="padding:10px;">{s[6]}</td>
            <td style="padding:10px; text-align:center;">{s[7]}</td>
        </tr>
        """
    if not rows_html:
        rows_html = "<tr><td colspan='8' style='padding:15px; text-align:center; color:#868e96;'>Ni zabeleženih obiskov</td></tr>"

    return f"""<!DOCTYPE html>
<html lang="sl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Invoice83 Demo Analitika</title>
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background:#f8f9fa; margin:0; padding:25px; color:#212529; }}
        .container {{ max-width: 1200px; margin: 0 auto; }}
        .header {{ display:flex; justify-content:space-between; align-items:center; margin-bottom:25px; }}
        h1 {{ margin:0; color:#1864ab; font-size:1.8rem; }}
        .refresh-btn {{ background:#1864ab; color:white; border:none; padding:8px 16px; border-radius:6px; font-weight:bold; cursor:pointer; text-decoration:none; display:inline-block; }}
        .refresh-btn:hover {{ background:#155799; }}
        .cards {{ display:grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap:20px; margin-bottom:25px; }}
        .card {{ background:white; border-radius:10px; padding:20px; box-shadow: 0 4px 12px rgba(0,0,0,0.04); border:1px solid #e9ecef; }}
        .card-num {{ font-size:2.2rem; font-weight:bold; color:#1864ab; margin-top:5px; }}
        .card-label {{ color:#868e96; font-size:0.9rem; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; }}
        .grid-2 {{ display:grid; grid-template-columns: 1fr 1fr; gap:20px; margin-bottom:25px; }}
        @media (max-width: 768px) {{ .grid-2 {{ grid-template-columns: 1fr; }} }}
        .table-container {{ background:white; border-radius:10px; padding:20px; box-shadow:0 4px 12px rgba(0,0,0,0.04); border:1px solid #e9ecef; overflow-x:auto; }}
        table {{ width:100%; border-collapse:collapse; text-align:left; font-size:0.92rem; }}
        th {{ padding:10px; background:#f1f3f5; color:#495057; font-weight:600; }}
        ul {{ padding-left:20px; margin:10px 0; }}
        li {{ margin-bottom:6px; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div>
                <h1>📊 Invoice83 Demo Analitika</h1>
                <p style="margin:5px 0 0 0; color:#868e96;">Spremljanje obiska in aktivnosti na javni demo verziji</p>
            </div>
            <a href="javascript:location.reload()" class="refresh-btn">🔄 Osveži podatke</a>
        </div>

        <div class="cards">
            <div class="card">
                <div class="card-label">Obiski danes</div>
                <div class="card-num">{data['sessions_today']}</div>
            </div>
            <div class="card">
                <div class="card-label">Vsi obiski skupaj</div>
                <div class="card-num">{data['total_sessions']}</div>
            </div>
            <div class="card">
                <div class="card-label">Povprečni čas seje</div>
                <div class="card-num">{data['avg_duration_min']} <span style="font-size:1.1rem; color:#495057;">min</span></div>
            </div>
        </div>

        <div class="grid-2">
            <div class="card">
                <h3 style="margin-top:0; color:#343a40; font-size:1.1rem; border-bottom:1px solid #eee; padding-bottom:10px;">📱 Naprave & Brskalniki</h3>
                <div style="display:flex; justify-content:space-between;">
                    <div style="flex:1;">
                        <strong>Naprave:</strong>
                        <ul>{devices_html}</ul>
                    </div>
                    <div style="flex:1;">
                        <strong>Brskalniki:</strong>
                        <ul>{browsers_html}</ul>
                    </div>
                </div>
            </div>

            <div class="card">
                <h3 style="margin-top:0; color:#343a40; font-size:1.1rem; border-bottom:1px solid #eee; padding-bottom:10px;">⚡ Najbolj aktivni moduli / kliki</h3>
                <table style="width:100%;">
                    <tbody>{events_html}</tbody>
                </table>
            </div>
        </div>

        <div class="table-container">
            <h3 style="margin-top:0; color:#343a40; font-size:1.1rem; border-bottom:1px solid #eee; padding-bottom:10px;">📋 Dnevnik zadnjih obiskov</h3>
            <table>
                <thead>
                    <tr>
                        <th>ID Seje</th>
                        <th>Prvi obisk</th>
                        <th>Zadnji stik</th>
                        <th>Trajanje</th>
                        <th>IP Naslov</th>
                        <th>Naprava</th>
                        <th>Brskalnik</th>
                        <th>Zahtevki</th>
                    </tr>
                </thead>
                <tbody>
                    {rows_html}
                </tbody>
            </table>
        </div>
    </div>
</body>
</html>
"""
