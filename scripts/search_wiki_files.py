#!/usr/bin/env python3
"""用 MediaWiki API 搜索实际文件名"""
import subprocess
import json
import urllib.parse

UA = "Mozilla/5.0 (Windows NT 10.0; Win64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36"
API = "https://slaythespire.wiki.gg/api.php"

def query(search, limit=15):
    params = {
        "action": "query", "list": "allimages", "aiprefix": search,
        "ailimit": limit, "format": "json",
    }
    url = API + "?" + urllib.parse.urlencode(params)
    r = subprocess.run(["curl", "-sL", "-m", "20", url, "-H", f"User-Agent: {UA}"],
                       capture_output=True, text=True, timeout=30)
    try:
        data = json.loads(r.stdout)
        return [img["name"] for img in data.get("query", {}).get("allimages", [])]
    except Exception:
        return []

prefixes = [
    "Green-", "Blue-", "Purple-",
    "Gremlin", "Slaver", "Spheric", "Book", "Bronze", "Collector", "Champ",
    "Orb Walker", "Writhing", "Spire Growth", "Spire Shield", "Spire Spear",
    "Awakened", "Time Eater", "Corrupt", "Giant Head", "Mystic", "Centurion",
    "Frame", "Orb.png", "Energy",
]
for p in prefixes:
    names = query(p)
    print(f"--- {p} ---")
    for n in names:
        print("   ", n)
