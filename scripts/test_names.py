#!/usr/bin/env python3
"""穷举测试 wiki 图片文件名变体"""
import hashlib, subprocess, os, urllib.parse

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36"
BASE = "https://slaythespire.wiki.gg/images"

def exists(filename):
    md5 = hashlib.md5(filename.encode()).hexdigest()
    url = f"{BASE}/{md5[0]}/{md5[:2]}/{urllib.parse.quote(filename)}"
    try:
        r = subprocess.run(["curl", "-sIL", "-m", "12", url, "-H", f"User-Agent: {UA}"],
                           capture_output=True, text=True, timeout=18)
        return f"200" in r.stdout.split("\n")[0]
    except Exception:
        return False

# 测试 Focus 图标的所有可能命名
variants = [
    "Icon Focus.png", "Focus.png", "Focus Icon.png", "Focus (Status).png",
    "Status Focus.png", "Focus status.png", "Icon focus.png", "focus.png",
    "Focus.webp", "Icon Focus.webp", "Focus Icon.webp",
    "Buff Focus.png", "Debuff Focus.png", "Power Focus.png",
    "Icon Focus 1.png", "Icon Focus 2.png", "Focus (buff).png",
    "Focus (Status Effect).png", "Status Icon Focus.png",
]
for v in variants:
    if exists(v):
        print("HIT:", v)
print("---done---")
