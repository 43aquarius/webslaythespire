#!/usr/bin/env python3
"""温和的补漏下载：单线程 + 延时，避免再次触发 Cloudflare 封禁。
失败列表写入 /tmp/fetch_pending.json，下次运行自动重试。"""
import hashlib
import subprocess
import os
import json
import time
import sys
from concurrent.futures import ThreadPoolExecutor

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36"
BASE = "https://slaythespire.wiki.gg/images"
OUT = "/home/z/my-project/public/assets"
PENDING = "/tmp/fetch_pending.json"

def wiki_url(filename: str) -> str:
    md5 = hashlib.md5(filename.encode()).hexdigest()
    return f"{BASE}/{md5[0]}/{md5[:2]}/{filename}"

def load_tasks():
    """任务列表：优先 pending，否则重新扫描全部（跳过已存在）"""
    if os.path.exists(PENDING):
        with open(PENDING) as f:
            items = json.load(f)
        return [(it["subdir"], it["out_name"], it["fn"]) for it in items]
    return None

def download(task):
    subdir, out_name, filename = task
    url = wiki_url(filename)
    dirpath = os.path.join(OUT, subdir)
    os.makedirs(dirpath, exist_ok=True)
    outpath = os.path.join(dirpath, out_name + ".png")
    if os.path.exists(outpath) and os.path.getsize(outpath) > 300:
        return (task, True, 0)
    try:
        r = subprocess.run(
            ["curl", "-sL", "-m", "40", url, "-H", f"User-Agent: {UA}",
             "-o", outpath, "-w", "%{http_code}|%{content_type}|%{size_download}"],
            capture_output=True, text=True, timeout=60)
        parts = r.stdout.strip().split("|")
        if len(parts) == 3:
            code, ctype, size = parts
            if code == "200" and "image" in ctype and int(size) > 300:
                with open(outpath, "rb") as f:
                    if f.read(4) == b"\x89PNG":
                        return (task, True, int(size))
        os.path.exists(outpath) and os.remove(outpath)
        return (task, False, 0)
    except Exception:
        os.path.exists(outpath) and os.remove(outpath)
        return (task, False, 0)

def main():
    tasks = load_tasks()
    if not tasks:
        print("没有待下载任务（请先运行 fetch_assets5.py 生成任务清单）")
        return
    ok, pending = 0, []
    blocked = False
    for i, task in enumerate(tasks):
        subdir, out_name, fn = task
        outpath = os.path.join(OUT, subdir, out_name + ".png")
        if os.path.exists(outpath) and os.path.getsize(outpath) > 300:
            ok += 1
            continue
        t, good, _ = download(task)
        if good:
            ok += 1
            print(f"[{i+1}/{len(tasks)}] OK  {subdir}/{out_name}")
        else:
            # 检查是否被封禁（403）
            pending.append({"subdir": subdir, "out_name": out_name, "fn": fn})
            print(f"[{i+1}/{len(tasks)}] FAIL {subdir}/{out_name} <- {fn}")
            # 连续失败 3 次且可能是封禁 → 提前退出
            if len(pending) >= 3 and ok == 0:
                print("疑似被 Cloudflare 封禁，提前退出")
                blocked = True
                break
        time.sleep(1.2)
    with open(PENDING, "w") as f:
        json.dump(pending, f, ensure_ascii=False, indent=1)
    print(f"完成 {ok}，剩余 {len(pending)}{'（封禁提前退出）' if blocked else ''}")

if __name__ == "__main__":
    main()
