#!/usr/bin/env python3
import subprocess
import json
import urllib.parse

UA = "Mozilla/5.0 (Windows NT 10.0; Win64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36"
API = "https://slaythespire.wiki.gg/api.php"

def query(search, limit=20):
    params = {"action": "query", "list": "allimages", "aiprefix": search, "ailimit": limit, "format": "json"}
    url = API + "?" + urllib.parse.urlencode(params)
    r = subprocess.run(["curl", "-sL", "-m", "20", url, "-H", f"User-Agent: {UA}"],
                       capture_output=True, text=True, timeout=30)
    try:
        data = json.loads(r.stdout)
        return [img["name"] for img in data.get("query", {}).get("allimages", [])]
    except Exception:
        return []

prefixes = [
    "TheCollector", "TimeEater", "GiantHead", "SpireGrowth", "OrbWalker",
    "SpireShield", "SpireSpear", "Mystic", "Munchkin", "Chosen.png",
    "Byrd", "Transient", "Darkling", "Spiker", "Repulsor", "Nemesis",
    "Reptomancer", "Donu", "Deca", "AwakenedOne", "CorruptHeart",
    "SphericGuardian", "GremlinLeader", "BookOfStabbing", "BronzeAutomaton",
    "Whale", "Neow", "CardIcon", "Bg", "Card",
]
for p in prefixes:
    names = query(p)
    if names:
        print(f"--- {p} ---")
        for n in names:
            print("   ", n)
