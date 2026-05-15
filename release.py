import os
import shutil
import datetime
import re
import subprocess
import json
import sys

# --- KONFIGURACIJA ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, 'static')
APP_JS = os.path.join(STATIC_DIR, 'app.js')
DEMO_DIR = os.path.join(BASE_DIR, 'demo')
ZIP_OUTPUT_PATH = r'c:\Users\mihak\My Drive\Dokumenti\Antigravity\Invoice83_tester.zip'

def clean():
    print("--- Ciscenje zacasnih datotek...")
    # __pycache__
    for root, dirs, files in os.walk(BASE_DIR):
        for d in dirs:
            if d == '__pycache__':
                try:
                    shutil.rmtree(os.path.join(root, d))
                except Exception as e:
                    print(f"  [!] Ni mogoce pobrisati {d}: {e}")
    
    # build, dist
    for d in ['build', 'dist']:
        path = os.path.join(BASE_DIR, d)
        if os.path.exists(path):
            try:
                # Na Windowsih shutil.rmtree včasih odpove, če so datoteke v uporabi
                # ignore_errors=True bi sicer preskočil, a mi želimo vsaj poskusiti
                shutil.rmtree(path)
            except Exception as e:
                print(f"  [!] Ni mogoce popolnoma pobrisati {d}: {e}")
                print(f"  [*] Nasvet: Zaprite vse programe, ki morda uporabljajo datoteke v {d}.")
            
    # sessions
    sessions_dir = os.path.join(BASE_DIR, 'sessions')
    if os.path.exists(sessions_dir):
        for f in os.listdir(sessions_dir):
            if f.endswith('.db'):
                try:
                    os.remove(os.path.join(sessions_dir, f))
                except:
                    pass
    
    # uploads temp
    uploads_dir = os.path.join(BASE_DIR, 'uploads')
    if os.path.exists(uploads_dir):
        for f in os.listdir(uploads_dir):
            if f.startswith('temp_'):
                try:
                    os.remove(os.path.join(uploads_dir, f))
                except:
                    pass
    print("[OK] Ciscenje koncano.")

def backup():
    today = datetime.datetime.now().strftime("%d-%m-%Y")
    backup_folder = os.path.join(BASE_DIR, f"BACKUP-{today}")
    print(f"--- Ustvarjanje varnostne kopije v {backup_folder}...")
    
    if not os.path.exists(backup_folder):
        os.makedirs(backup_folder)
    
    # Seznam datotek/map za backup
    to_backup = [
        'main.py', 'database.py', 'pdf_parser.py', 'knjizenje.py', 
        'requirements.txt', 'static', 'companies.json', 'racunovodstvo.db'
    ]
    
    for item in to_backup:
        src = os.path.join(BASE_DIR, item)
        dst = os.path.join(backup_folder, item)
        if os.path.exists(src):
            try:
                if os.path.isdir(src):
                    if os.path.exists(dst): shutil.rmtree(dst)
                    shutil.copytree(src, dst)
                else:
                    shutil.copy2(src, dst)
            except Exception as e:
                print(f"  [!] Napaka pri backupu {item}: {e}")
    print("[OK] Backup uspesno opravljen.")

def get_git_changes():
    """Poskusi pridobiti spremembe iz git log-a od zadnje izdaje."""
    try:
        # Poišči zadnjo "Release" verzijo
        result = subprocess.run(
            ['git', 'log', '--grep=^Release', '-n', '1', '--format=%H'],
            capture_output=True, text=True
        )
        last_release = result.stdout.strip()
        
        if not last_release:
            # Če ni nobene "Release" verzije, vzami zadnjih 5 commitov
            log_cmd = ['git', 'log', '-n', '5', '--oneline']
        else:
            log_cmd = ['git', 'log', f'{last_release}..HEAD', '--oneline']
            
        log_output = subprocess.run(log_cmd, capture_output=True, text=True).stdout.strip()
        
        if not log_output:
            return []
            
        raw_changes = [line.split(' ', 1)[1] for line in log_output.split('\n') if line.strip()]
        
        # Filtriranje "tehnikalij" - ignoriramo commite, ki se začnejo s temi besedami
        ignore_keywords = [
            'fix', 'chore', 'refactor', 'cleanup', 'merge', 'build', 'ci', 
            'minor', 'debug', 'test', 'temp', 'lint', 'styles', 'css', 'release'
        ]
        
        useful_changes = []
        for ch in raw_changes:
            # Če commit vsebuje [USER], ga vedno vključimo (brez prefixa)
            if '[USER]' in ch:
                useful_changes.append(ch.replace('[USER]', '').strip())
                continue
                
            lower_ch = ch.lower()
            if any(lower_ch.startswith(k) for k in ignore_keywords):
                continue
            if len(ch) < 8:
                continue
            # Če je sporočilo v slogu "Update main.py" ali "Fix button", ga preskočimo
            if lower_ch.startswith('update ') and ('.py' in lower_ch or '.js' in lower_ch or '.css' in lower_ch):
                continue
            useful_changes.append(ch)
            
        return useful_changes
    except Exception as e:
        print(f"  [!] Napaka pri branju git log-a: {e}")
        return []

def update_changelog():
    changes = []
    changes_file = os.path.join(BASE_DIR, 'changes.txt')
    
    if os.path.exists(changes_file):
        print(f"[*] Berem spremembe iz {changes_file}...")
        with open(changes_file, 'r', encoding='utf-8') as f:
            changes = [line.strip() for line in f if line.strip()]
        os.remove(changes_file)
    else:
        print("[*] Iscem nove spremembe v git zgodovini...")
        changes = get_git_changes()
        
        if changes:
            print("+++ Zaznane spremembe (samodejno potrjeno):")
            for ch in changes:
                print(f"  - {ch}")
        else:
            print("[*] Ni novih pomembnih sprememb v git zgodovini.")
    
    if not changes:
        print("[SKIP] Ni sprememb, preskakujem posodobitev zgodovine.")
        return

    today_str = datetime.datetime.now().strftime("%d. %m. %Y")
    
    # HTML blok za vstavljanje (modra značka + napis)
    formatted_changes = []
    for ch in changes:
        if ':' in ch:
            header, content = ch.split(':', 1)
            formatted_changes.append(f"<strong>{header.strip()}:</strong>{content}")
        else:
            formatted_changes.append(ch)

    li_items = "".join([f"                            <li>{ch}</li>\n" for ch in formatted_changes])
    new_entry = f"""
                    <div style="margin-bottom:25px;">
                        <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px;">
                            <span style="background:var(--primary-blue); color:white; padding:4px 10px; border-radius:20px; font-size:0.85rem; font-weight:bold;">{today_str}</span>
                            <span style="color:#666; font-size:0.9rem;">Zadnja posodobitev</span>
                        </div>
                        <ul style="margin-top:5px; padding-left:20px;">
{li_items}                        </ul>
                    </div>
"""

    with open(APP_JS, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Najprej demoviramo trenutno "Zadnjo posodobitev" v navadno (siva značka)
    # Iščemo modro značko in napis "Zadnja posodobitev"
    content = content.replace('background:var(--primary-blue); color:white; padding:4px 10px; border-radius:20px; font-size:0.85rem; font-weight:bold;', 
                             'background:#f1f3f5; color:#495057; padding:4px 10px; border-radius:20px; font-size:0.85rem; font-weight:bold;')
    content = content.replace('<span style="color:#666; font-size:0.9rem;">Zadnja posodobitev</span>', '')
    # Dodamo ločilno črto prejšnjemu vnosu
    content = content.replace('<div style="margin-bottom:25px;">', '<div style="margin-bottom:25px; padding-top:15px; border-top:1px dashed #eee;">', 1)

    # 2. Vstavimo nov vnos na vrh
    marker = '<div style="background:#fff; border:1px solid #eee; border-radius:10px; padding:20px; box-shadow: 0 2px 10px rgba(0,0,0,0.02);">'
    
    if marker in content:
        new_content = content.replace(marker, marker + new_entry)
        with open(APP_JS, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"[OK] Zgodovina sprememb posodobljena v {APP_JS}.")
    else:
        print("[ERR] Napaka: Marker za zgodovino v app.js ni bil najden!")

def run_scripts():
    print(">>> Posodabljanje demo verzije (update_demo.py)...")
    try:
        subprocess.run([sys.executable, 'update_demo.py'], check=True)
        print("[OK] Demo verzija pripravljena.")
    except Exception as e:
        print(f"[ERR] Napaka pri posodabljanju demo verzije: {e}")

    print(">>> Ustvarjanje ZIP arhiva za testerje (pakiranje.ps1)...")
    try:
        subprocess.run(['powershell', '-ExecutionPolicy', 'Bypass', '-File', 'pakiranje.ps1'], check=True)
        print("[OK] ZIP arhiv ustvarjen.")
    except Exception as e:
        print(f"[ERR] Napaka pri ustvarjanju ZIP arhiva: {e}")

def git_push():
    print("\n--- Priprava za potisk na GitHub/Railway...")

    # Preveri če je git inicializiran
    if not os.path.exists(os.path.join(BASE_DIR, '.git')):
        print("[!] Git ni inicializiran. Inicializiram...")
        subprocess.run(['git', 'init'], check=True)
    
    try:
        subprocess.run(['git', 'add', '.'], check=True)
        msg = f"Release {datetime.datetime.now().strftime('%Y-%m-%d %H:%M')}"
        subprocess.run(['git', 'commit', '-m', msg], check=True)
        
        # Preveri če obstaja remote
        remotes = subprocess.run(['git', 'remote'], capture_output=True, text=True).stdout.strip()
        if not remotes:
            print("❌ Napaka: Brez remote-a (origin) ne morem push-ati. Prosim, ročno dodajte remote: git remote add origin <url>")
            return

        subprocess.run(['git', 'push', '-u', 'origin', 'main'], check=True)
        print("[OK] Uspesno potisnjeno na GitHub.")
    except Exception as e:
        print(f"[ERR] Napaka pri Git operacijah: {e}")

if __name__ == "__main__":
    print("=== AVTOMATSKA IZDAJA (RELEASE) ===")
    clean()
    backup()
    update_changelog()
    run_scripts()
    git_push()
    print("\n[OK] Vse koncano!")
