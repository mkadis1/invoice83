@echo off
cd /d "D:\Antigravity\Racunovodstvo"
echo Ustavljam obstojece procese na portu 8000...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8000 ^| findstr LISTENING') do taskkill /f /pid %%a >nul 2>&1
timeout /t 1 /nobreak >nul
echo Zaganjam Invoice83...
start "" /b "D:\Antigravity\Racunovodstvo\venv\Scripts\pythonw.exe" "D:\Antigravity\Racunovodstvo\main.py"
echo Server uspesno ponovno zagnan!
