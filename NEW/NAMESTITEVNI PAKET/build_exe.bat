venv\Scripts\pyinstaller.exe --name Invoice83 --onedir --noconfirm --clean ^
    --hidden-import=uvicorn.logging ^
    --hidden-import=uvicorn.loops ^
    --hidden-import=uvicorn.loops.auto ^
    --hidden-import=uvicorn.protocols ^
    --hidden-import=uvicorn.protocols.http ^
    --hidden-import=uvicorn.protocols.http.auto ^
    --hidden-import=uvicorn.protocols.websockets ^
    --hidden-import=uvicorn.protocols.websockets.auto ^
    --hidden-import=uvicorn.lifespan ^
    --hidden-import=uvicorn.lifespan.on ^
    --hidden-import=uvicorn.lifespan.off ^
    --hidden-import=pdfplumber ^
    --hidden-import=fpdf ^
    --hidden-import=pytesseract ^
    --hidden-import=qrcode ^
    --hidden-import=PIL ^
    main.py
