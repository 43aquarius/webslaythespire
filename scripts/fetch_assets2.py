#!/usr/bin/env python3
"""通过 MediaWiki API 解析文件名并批量下载 StS 素材"""
import hashlib
import subprocess
import os
import json
import urllib.parse
import time
from concurrent.futures import ThreadPoolExecutor

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36"
API = "https://slaythespire.wiki.gg/api.php"
BASE = "https://slaythespire.wiki.gg/images"
OUT = "/home/z/my-project/public/assets"

def api_get(params: dict) -> dict:
    qs = urllib.parse.urlencode(params)
    r = subprocess.run(
        ["curl", "-sL", "-m", "25", f"{API}?{qs}", "-H", f"User-Agent: {UA}"],
        capture_output=True, text=True, timeout=35)
    return json.loads(r.stdout)

def page_images(titles: list) -> dict:
    """返回 {页面标题: [File:xxx, ...]}"""
    out = {}
    for i in range(0, len(titles), 10):
        batch = titles[i:i+10]
        cont = None
        while True:
            params = {
                "action": "query", "titles": "|".join(batch),
                "prop": "images", "format": "json", "imlimit": "500",
            }
            if cont:
                params["imcontinue"] = cont
            data = api_get(params)
            pages = data.get("query", {}).get("pages", {})
            for p in pages.values():
                title = p.get("title", "")
                imgs = out.setdefault(title, [])
                for im in p.get("images", []):
                    fn = im["title"].replace("File:", "")
                    if fn not in imgs:
                        imgs.append(fn)
            cont = data.get("continue", {}).get("imcontinue")
            if not cont:
                break
    return out

def wiki_url(filename: str) -> str:
    md5 = hashlib.md5(filename.encode()).hexdigest()
    return f"{BASE}/{md5[0]}/{md5[:2]}/{filename}"

def download(filename: str, subdir: str, out_name: str | None = None) -> tuple:
    url = wiki_url(filename)
    os.makedirs(os.path.join(OUT, subdir), exist_ok=True)
    ext = ".png" if not filename.endswith(".svg") else ".svg"
    outpath = os.path.join(OUT, subdir, (out_name or filename.rsplit(".", 1)[0]) + ext)
    try:
        r = subprocess.run(
            ["curl", "-sL", "-m", "30", url, "-H", f"User-Agent: {UA}",
             "-o", outpath, "-w", "%{http_code}|%{content_type}|%{size_download}"],
            capture_output=True, text=True, timeout=40)
        code, ctype, size = r.stdout.strip().split("|")
        if code == "200" and "image" in ctype and int(size) > 300:
            with open(outpath, "rb") as f:
                magic = f.read(8)
            if magic[:4] == b"\x89PNG" or filename.endswith(".svg") or magic[:3] == b"\xff\xd8\xff":
                return (filename, True, int(size))
        os.path.exists(outpath) and os.remove(outpath)
        return (filename, False, 0)
    except Exception:
        os.path.exists(outpath) and os.remove(outpath)
        return (filename, False, 0)

# ---------- 怪物页 -> 精灵图 ----------
MONSTER_PAGES = {
    "redlouse": "Red Louse", "greenlouse": "Green Louse",
    "fungibeast": "Fungi Beast", "acidslimeS": "Acid Slime (S)",
    "acidslimeM": "Acid Slime (M)", "spikeSlimeS": "Spike Slime (S)",
    "spikeSlimeM": "Spike Slime (M)", "nob": "Gremlin Nob",
    "slimeboss": "Slime Boss", "guardian": "The Guardian",
    "lagavulin": "Lagavulin", "sentry": "Sentry",
    "jawworm": "Jaw Worm", "cultist": "Cultist", "hexaghost": "Hexaghost",
}
SKIP_PREFIX = ("Icon", "Intent", "CardIcon", "Ascension", "Clear", "Energy", "Gold", "HP", "Hp", "Block")

def pick_sprite(title: str, imgs: list) -> str | None:
    # 规则：不含特殊前缀的 png，优先与怪物名相近的
    cands = [f for f in imgs if f.endswith(".png") and not any(f.startswith(p) for p in SKIP_PREFIX)
             and not f.startswith("Map") and "Icon" not in f and "Status" not in f]
    # 优先完全匹配名字的
    base = title.replace(" ", "").replace("(", "").replace(")", "")
    for c in cands:
        cb = c.replace("_", "").replace("(", "").replace(")", "").rsplit(".", 1)[0]
        if cb.lower() == base.lower():
            return c
    return cands[0] if cands else None

def main():
    print("===== 第一步：解析怪物页精灵图 =====")
    imgs_by_page = page_images(list(MONSTER_PAGES.values()))
    tasks = []
    for key, page in MONSTER_PAGES.items():
        imgs = imgs_by_page.get(page, [])
        sprite = pick_sprite(page, imgs)
        if sprite:
            tasks.append(("enemies", key, sprite))
        else:
            print(f"  !! 未找到 {page} 的精灵图，页面图片: {imgs[:8]}")

    print("===== 第二步：图标（意图/状态） =====")
    ICONS = {
        "intent": [
            "Intent Attack.png", "Intent Attack2.png", "Intent Attack3.png", "Intent Attack4.png",
            "Intent AttackDebuff.png", "Intent AttackDefend.png", "Intent Defend.png",
            "Intent Defend2.png", "Intent Buff.png", "Intent Debuff.png", "Intent Debuff2.png",
            "Intent StrongDebuff.png", "Intent Sleep.png", "Intent Sleep2.png", "Intent Unknown.png",
            "Intent Unknown2.png", "Intent Stun.png", "Intent Escape.png",
        ],
        "status": [
            "Icon Strength.png", "Icon Dexterity.png", "Icon Vulnerable.png", "Icon Weak.png",
            "Icon Frail.png", "Icon Thorns.png", "Icon Artifact.png", "Icon Metallicize.png",
            "Icon Ritual.png", "Icon Regen.png", "Icon Poison.png", "Icon Anger.png",
            "Icon Brutality.png", "Icon Combust.png", "Icon Corruption.png", "Icon Dark Embrace.png",
            "Icon Demon Form.png", "Icon Evolve.png", "Icon Feel No Pain.png", "Icon Fire Breathing.png",
            "Icon Flame Barrier.png", "Icon Juggernaut.png", "Icon Rage.png", "Icon Rupture.png",
            "Icon Berserk.png", "Icon Double Tap.png", "Icon Entrench.png", "Icon Barricade.png",
            "Icon No Draw.png", "Icon Mode Shift.png", "Icon Angry.png", "Icon Curl Up.png",
            "Icon Spore Cloud.png", "Icon Split.png", "Icon Stasis.png", "Icon Metallicize (monster).png",
            "Icon Painful Stabs.png", "Icon Life Link.png", "Icon Shackled.png", "Icon Sharp Hide.png",
        ],
        "ui": [
            "Energy Orb.png", "Gold.png", "Relic Panel.png", "Potion Panel.png",
            "Card Reward Banner.png", "Map.png", "The City.png", "The Beyond.png",
            "Exordium.png", "The Exordium.png", "Victory.png", "Defeat.png",
        ],
    }
    for subdir, files in ICONS.items():
        for f in files:
            out_name = f.replace("Icon ", "").replace("Intent ", "").replace(".png", "").replace(" ", "").replace("(", "").replace(")", "").lower()
            tasks.append((subdir, out_name, f))

    print(f"共 {len(tasks)} 个下载任务")
    ok, miss = 0, []
    with ThreadPoolExecutor(max_workers=12) as ex:
        futs = [ex.submit(download, fn, sd, on) for sd, on, fn in tasks]
        for fut, (sd, on, fn) in zip(futs, tasks):
            _, good, size = fut.result()
            if good:
                ok += 1
                print(f"  OK  {sd}/{on} <- {fn} ({size}B)")
            else:
                miss.append(f"{sd}/{on} <- {fn}")
    print(f"\n成功 {ok} / {len(tasks)}")
    print("===== 缺失 =====")
    for m in miss:
        print(f"  MISS {m}")

if __name__ == "__main__":
    main()
