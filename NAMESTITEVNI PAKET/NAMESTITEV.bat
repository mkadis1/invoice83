@echo off
title Invoice83 - Namestitev

:: Spremenimo delovni imenik na mapo, kjer je ta .bat datoteka
cd /d "%~dp0"

echo.
echo  ============================================
echo   Invoice83 - Namestitev za testiranje
echo  ============================================
echo.

:: -----------------------------------------------
:: 1. Najprej preverimo PY launcher, ki je bolj zanesljiv na Windowsih
:: -----------------------------------------------
set PYTHON_CMD=

py --version >nul 2>&1
if not errorlevel 1 (
    set PYTHON_CMD=py
    goto check_done
)

:: Ce PY ni na voljo, preverimo se navaden python
python --version >nul 2>&1
if not errorlevel 1 (
    set PYTHON_CMD=python
    goto check_done
)

:: Ce ni ne py ne python, preverimo lokalne mape uporabnika
for %%P in (
    "%LocalAppData%\Programs\Python\Python313\python.exe"
    "%LocalAppData%\Programs\Python\Python312\python.exe"
    "%LocalAppData%\Programs\Python\Python311\python.exe"
    "%LocalAppData%\Programs\Python\Python310\python.exe"
    "C:\Program Files\Python313\python.exe"
    "C:\Program Files\Python312\python.exe"
    "C:\Program Files\Python311\python.exe"
) do (
    if exist "%%~P" (
        "%%~P" --version >nul 2>&1
        if not errorlevel 1 (
            set PYTHON_CMD="%%~P"
            goto check_done
        )
    )
)

echo [NAPAKA] Python ni najden ali ni v PATH!
echo.
echo Poskusite naslednje:
echo 1. Ce ste ZIP datoteko odprli direktno, jo NAJPREJ RAZPAKIRAJTE (Extract All).
echo 2. Ce poganjate kot Administrator, poskusite zagnati normalno (dvoklik).
echo 3. Ce Python se ni namescen, ga namestite: https://www.python.org/downloads/
echo    (OBVEZNO obkljukajte "Add Python to PATH" ob namestitvi!)
echo.
pause
exit /b 1

:check_done
echo [OK] Uporabljen bo ukaz: %PYTHON_CMD%
echo.

echo [1/5] Ustvarjam virtualno okolje (venv)...
if exist venv rmdir /s /q venv
%PYTHON_CMD% -m venv venv
if errorlevel 1 (
    echo [NAPAKA] Ustvarjanje virtualnega okolja ni uspelo!
    pause
    exit /b 1
)
echo      OK.
echo.

echo [2/5] Namescam Python pakete (to lahko traja nekaj minut)...
venv\Scripts\python.exe -m pip install --upgrade pip --quiet
venv\Scripts\python.exe -m pip install -r requirements.txt --quiet
if errorlevel 1 (
    echo [NAPAKA] Namestitev paketov ni uspela!
    pause
    exit /b 1
)
echo      OK.
echo.

echo [3/5] Brisem stare podatke...
for %%f in (*.db) do del /f /q "%%f" >nul 2>&1
if exist uploads del /f /q "uploads\*.*" >nul 2>&1
if exist companies.json del /f /q companies.json >nul 2>&1
if exist server_log.txt del /f /q server_log.txt >nul 2>&1
if exist pdf_debug.txt del /f /q pdf_debug.txt >nul 2>&1
if exist static\uploads\logo.* del /f /q static\uploads\logo.* >nul 2>&1
echo      OK.
echo.

echo [4/5] Inicializiram bazo...
venv\Scripts\python.exe database.py >nul 2>&1
if errorlevel 1 (
    echo [NAPAKA] Inicializacija baze ni uspela!
    pause
    exit /b 1
)
echo      OK.
echo.

echo [5/5] Ustvarjam datoteko ZAGON.bat...
(
    echo @echo off
    echo cd /d "%%~dp0"
    echo echo Zaganjam Invoice83...
    echo start http://127.0.0.1:8000
    echo venv\Scripts\python.exe main.py
    echo pause
) > ZAGON.bat
echo      OK.
echo.

echo  ============================================
echo   Namestitev uspesna!
echo  ============================================
echo.
echo  Za zagon programa dvokliknite: ZAGON.bat
echo.
pause
