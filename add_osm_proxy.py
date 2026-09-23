with open('main.py', 'r', encoding='utf-8') as f:
    content = f.read()

proxy_code = '''
@app.get("/api/osm/geocode")
def osm_geocode(q: str):
    import requests
    import time
    # Prevent exceeding 1 req/sec limit on backend
    time.sleep(1.1)
    headers = {"User-Agent": "Invoice83-App/1.0 (info@invoice83.com)"}
    try:
        url = f"https://nominatim.openstreetmap.org/search?format=json&q={q}&limit=1&email=info@invoice83.com"
        r = requests.get(url, headers=headers, timeout=10)
        if r.status_code == 200:
            return r.json()
        return {"error": f"Status {r.status_code}: {r.text}"}
    except Exception as e:
        return {"error": str(e)}

@app.get("/api/osm/route")
def osm_route(lon1: float, lat1: float, lon2: float, lat2: float):
    import requests
    try:
        url = f"https://router.project-osrm.org/route/v1/driving/{lon1},{lat1};{lon2},{lat2}?overview=false"
        r = requests.get(url, timeout=10)
        if r.status_code == 200:
            return r.json()
        return {"error": f"Status {r.status_code}: {r.text}"}
    except Exception as e:
        return {"error": str(e)}
'''

if '@app.get("/api/osm/geocode")' not in content:
    content = content.replace('if __name__ == "__main__":', proxy_code + '\nif __name__ == "__main__":')
    with open('main.py', 'w', encoding='utf-8') as f:
        f.write(content)
