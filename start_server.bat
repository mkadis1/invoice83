@echo off
cd /d "D:\Antigravity\Racunovodstvo"

:: Preveri, če strežnik že teče na portu 8000 (samo LISTENING stanje)
netstat -ano | findstr :8000 | findstr LISTENING > nul
if %errorlevel% equ 0 (
    echo Server is already running.
    exit /b
)

echo Starting Invoice83 server... > server_log.txt
start "" /b "D:\Antigravity\Racunovodstvo\venv\Scripts\pythonw.exe" "D:\Antigravity\Racunovodstvo\main.py" >> server_log.txt 2>&1

