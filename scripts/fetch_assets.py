#!/usr/bin/env python3
"""从 slaythespire.wiki.gg 批量下载游戏素材（MediaWiki MD5 路径算法）"""
import hashlib
import subprocess
import sys
import os
from concurrent.futures import ThreadPoolExecutor

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36"
BASE = "https://slaythespire.wiki.gg/images"
OUT = "/home/z/my-project/public/assets"

def wiki_url(filename: str) -> str:
    md5 = hashlib.md5(filename.encode()).hexdigest()
    return f"{BASE}/{md5[0]}/{md5[:2]}/{filename}"

def fetch(filename: str, outpath: str) -> tuple:
    """下载 wiki 文件，返回 (filename, ok, size)"""
    url = wiki_url(filename)
    try:
        r = subprocess.run(
            ["curl", "-sL", "-m", "25", url, "-H", f"User-Agent: {UA}",
             "-o", outpath, "-w", "%{http_code}|%{content_type}|%{size_download}"],
            capture_output=True, text=True, timeout=35)
        code, ctype, size = r.stdout.strip().split("|")
        if code == "200" and ("image" in ctype) and int(size) > 500:
            # 验证是真实图片而非挑战页
            with open(outpath, "rb") as f:
                magic = f.read(8)
            if magic[:4] in (b"\x89PNG", b"\xff\xd8\xff\xe0", b"\xff\xd8\xff\xe1", b"GIF8") or filename.endswith(".svg"):
                return (filename, True, int(size))
        os.remove(outpath) if os.path.exists(outpath) else None
        return (filename, False, 0)
    except Exception:
        if os.path.exists(outpath):
            os.remove(outpath)
        return (filename, False, 0)

# ============ 资源清单：out_subdir -> (out_name, [候选文件名]) ============
ASSETS = {
    "enemies": {
        "jawworm":    ["Jaw_Worm.png"],
        "cultist":    ["Cultist.png"],
        "redlouse":   ["Red_Louse.png"],
        "greenlouse": ["Green_Louse.png"],
        "fungibeast": ["Fungi_Beast.png"],
        "acidslime":  ["Acid_Slime_(S).png", "Acid_Slime.png"],
        "spikeslime": ["Spike_Slime_(S).png", "Spike_Slime.png"],
        "nob":        ["Gremlin_Nob.png"],
        "lagavulin":  ["Lagavulin.png"],
        "sentry":     ["Sentry.png"],
        "slimeboss":  ["Slime_Boss.png"],
        "guardian":   ["The_Guardian.png"],
        "hexaghost":  ["Hexaghost.png"],
    },
    "hero": {
        "ironclad": ["Ironclad.png", "Ironclad_Main.png", "Ironclad_(character).png"],
    },
}

def main():
    tasks = []
    for subdir, items in ASSETS.items():
        os.makedirs(os.path.join(OUT, subdir), exist_ok=True)
        for out_name, candidates in items.items():
            tasks.append((subdir, out_name, candidates))

    results = {}
    with ThreadPoolExecutor(max_workers=10) as ex:
        futures = []
        for subdir, out_name, candidates in tasks:
            for cand in candidates:
                outpath = os.path.join(OUT, subdir, f"{out_name}.png")
                futures.append((ex.submit(fetch, cand, outpath), subdir, out_name, cand))
        for fut, subdir, out_name, cand in futures:
            fn, ok, size = fut.result()
            if ok:
                results[(subdir, out_name)] = (cand, size)
                print(f"  OK  {subdir}/{out_name} <- {fn} ({size}B)")

    print("\n===== 缺失清单 =====")
    for subdir, out_name, candidates in tasks:
        if (subdir, out_name) not in results:
            print(f"  MISS {subdir}/{out_name} (tried: {', '.join(candidates)})")

if __name__ == "__main__":
    main()
