#!/bin/bash
set -e

echo "========================================================"
echo "    NAMESTITEV INVOICE83 NA RASPBERRY PI (rustpi)"
echo "========================================================"

# 1. Posodobitev paketov in namestitev potrebnih orodij
echo "[1/4] Namescam sistemske pakete (Python, Tesseract OCR, Poppler)..."
sudo apt update
sudo apt install -y python3-pip python3-venv git tesseract-ocr tesseract-ocr-slv libgl1 poppler-utils

# 2. Virtualno okolje
echo "[2/4] Pripravljam Python virtualno okolje (venv)..."
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi

source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# 3. Nastavitev systemd servisa
echo "[3/4] Nastavljam in zaganjam systemd servis (racunovodstvo)..."
sudo cp deploy/racunovodstvo.service /etc/systemd/system/racunovodstvo.service
sudo systemctl daemon-reload
sudo systemctl enable racunovodstvo
sudo systemctl restart racunovodstvo

# 4. Izpis statusa
echo "[4/4] Preverjam delovanje servisa..."
sleep 2
sudo systemctl status racunovodstvo --no-pager

echo ""
echo "========================================================"
echo "  [USPESNO] Invoice83 streznik tece v ozadju!"
echo "  Dostop preko Tailscale: http://100.65.3.105:8000"
echo "========================================================"
