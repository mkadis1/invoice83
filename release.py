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
    print("🧹 Čiščenje začasnih datotek...")
    # __pycache__
    for root, dirs, files in os.walk(BASE_DIR):
        for d in dirs:
            if d == '__pycache__':
                try:
                    shutil.rmtree(os.path.join(root, d))
                except Exception as e:
                    print(f"  ⚠️ Ni mogoče pobrisati {d}: {e}")
    
    # build, dist
    for d in ['build', 'dist']:
        path = os.path.join(BASE_DIR, d)
        if os.path.exists(path):
            try:
                shutil.rmtree(path)
            except Exception as e:
                print(f"  ⚠️ Ni mogoče pobrisati {d}: {e}")
            
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
    print("✅ Čiščenje končano.")

def backup():
    today = datetime.datetime.now().strftime("%d-%m-%Y")
    backup_folder = os.path.join(BASE_DIR, f"BACKUP-{today}")
    print(f"📦 Ustvarjanje varnostne kopije v {backup_folder}...")
    
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
                print(f"  ⚠️ Napaka pri backupu {item}: {e}")
    print("✅ Backup uspešno opravljen.")

def update_changelog():
    changes = []
    changes_file = os.path.join(BASE_DIR, 'changes.txt')
    
    if os.path.exists(changes_file):
        print(f"📄 Berem spremembe iz {changes_file}...")
        with open(changes_file, 'r', encoding='utf-8') as f:
            changes = [line.strip() for line in f if line.strip()]
        # Pobrišemo datoteko po branju, da ne bo ista naslednjič
        os.remove(changes_file)
    else:
        print("\n📝 Vnesite nove spremembe (v vsako vrstico eno, zaključi s prazno vrstico):")
        while True:
            line = input("> ").strip()
            if not line: break
            changes.append(line)
    
    if not changes:
        print("⏭️ Ni sprememb, preskakujem posodobitev zgodovine.")
        return

    today_str = datetime.datetime.now().strftime("%d. %m. %Y")
    
    # HTML blok za vstavljanje
    li_items = "".join([f"                            <li>{ch}</li>\n" for ch in changes])
    new_entry = f"""
                    <div style="margin-bottom:25px;">
                        <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px;">
                            <span style="background:var(--primary-blue); color:white; padding:4px 10px; border-radius:20px; font-size:0.85rem; font-weight:bold;">{today_str}</span>
                            <span style="color:#666; font-size:0.9rem;">Avtomatska posodobitev</span>
                        </div>
                        <ul style="margin-top:5px; padding-left:20px;">
{li_items}                        </ul>
                    </div>
"""

    with open(APP_JS, 'r', encoding='utf-8') as f:
        content = f.read()

    # Marker za vstavljanje
    marker = '<div style="background:#fff; border:1px solid #eee; border-radius:10px; padding:20px; box-shadow: 0 2px 10px rgba(0,0,0,0.02);">'
    
    if marker in content:
        new_content = content.replace(marker, marker + new_entry)
        with open(APP_JS, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"✅ Zgodovina sprememb posodobljena v {APP_JS}.")
    else:
        print("❌ Napaka: Marker za zgodovino v app.js ni bil najden!")

def run_scripts():
    print("🚀 Posodabljanje demo verzije (update_demo.py)...")
    try:
        subprocess.run([sys.executable, 'update_demo.py'], check=True)
        print("✅ Demo verzija pripravljena.")
    except Exception as e:
        print(f"❌ Napaka pri posodabljanju demo verzije: {e}")

    print("📦 Ustvarjanje ZIP arhiva za testerje (pakiranje.ps1)...")
    try:
        subprocess.run(['powershell', '-File', 'pakiranje.ps1'], check=True)
        print("✅ ZIP arhiv ustvarjen.")
    except Exception as e:
        print(f"❌ Napaka pri ustvarjanju ZIP arhiva: {e}")

def git_push():
    confirm = input("\n🐙 Ali želite potisniti spremembe na GitHub/Railway? (d/n): ").lower()
    if confirm != 'd':
        print("⏭️ Preskakujem git push.")
        return

    # Preveri če je git inicializiran
    if not os.path.exists(os.path.join(BASE_DIR, '.git')):
        print("⚠️ Git ni inicializiran. Inicializiram...")
        subprocess.run(['git', 'init'], check=True)
    
    try:
        subprocess.run(['git', 'add', '.'], check=True)
        msg = f"Release {datetime.datetime.now().strftime('%Y-%m-%d %H:%M')}"
        subprocess.run(['git', 'commit', '-m', msg], check=True)
        
        # Preveri če obstaja remote
        remotes = subprocess.run(['git', 'remote'], capture_output=True, text=True).stdout.strip()
        if not remotes:
            url = input("Vnesite URL GitHub repozitorija: ").strip()
            if url:
                subprocess.run(['git', 'remote', 'add', 'origin', url], check=True)
                subprocess.run(['git', 'branch', '-M', 'main'], check=True)
            else:
                print("❌ Brez remote-a ne morem push-ati.")
                return

        subprocess.run(['git', 'push', '-u', 'origin', 'main'], check=True)
        print("✅ Uspešno potisnjeno na GitHub.")
    except Exception as e:
        print(f"❌ Napaka pri Git operacijah: {e}")

if __name__ == "__main__":
    print("=== AVTOMATSKA IZDAJA (RELEASE) ===")
    clean()
    backup()
    update_changelog()
    run_scripts()
    git_push()
    print("\n🎉 Vse končano!")
