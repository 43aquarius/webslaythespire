#!/usr/bin/env python3
"""测试 wiki.gg 素材 URL 可用性（md5 路径）"""
import hashlib
import subprocess
import os

UA = "Mozilla/5.0 (Windows NT 10.0; Win64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36"
BASE = "https://slaythespire.wiki.gg/images"

def wiki_url(filename: str) -> str:
    md5 = hashlib.md5(filename.encode()).hexdigest()
    return f"{BASE}/{md5[0]}/{md5[:2]}/{filename}"

tests = [
    # 英雄
    "Silent.png", "Defect.png", "Watcher.png", "Ironclad.png",
    # 涅奥鲸鱼
    "Neow.png", "Whale.png", "NeowLobby.png",
    # Act2 怪物
    "Byrd.png", "Chosen.png", "Centurion.png", "Mystic.png",
    "Mad_Gremlin.png", "Gremlin_Wizard.png", "Fat_Gremlin.png", "Shield_Gremlin.png", "Sneaky_Gremlin.png",
    "Red_Slaver.png", "Blue_Slaver.png", "Taskmaster.png", "Spheric_Guardian.png",
    "Gremlin_Leader.png", "Book_of_Stabbing.png",
    "Bronze_Automaton.png", "Bronze_Orb.png", "The_Collector.png", "The_Champ.png", "Munchkin.png",
    # Act3 怪物
    "Spiker.png", "Repulsor.png", "Orb_Walker.png", "Writhing_Mass.png", "Spire_Growth.png",
    "Transient.png", "Darkling.png", "Wraith.png", "Mysterious_Choice.png",
    "Giant_Head.png", "Nemesis.png", "Reptomancer.png",
    "Awakened_One.png", "Time_Eater.png", "Donu.png", "Deca.png",
    "Spire_Shield.png", "Spire_Spear.png", "Corrupt_Heart.png",
    # 绿色卡框/能量球（猜测命名）
    "CardFrame_Green.png", "Green_Energy.png", "cardGreenOrb.png",
    # 绿卡示例
    "Strike_Green.png", "Defend_Green.png", "Neutralize.png", "Deadly_Poison.png",
    "Strike_Blue.png", "Defend_Blue.png", "Zap.png", "Dualcast.png",
    "Strike_Purple.png", "Defend_Purple.png", "Eruption.png", "Vigilance.png",
]

for fn in tests:
    url = wiki_url(fn)
    r = subprocess.run(["curl", "-sL", "-m", "15", url, "-H", f"User-Agent: {UA}",
                        "-o", "/dev/null", "-w", "%{http_code}|%{content_type}|%{size_download}"],
                       capture_output=True, text=True, timeout=25)
    code, ctype, size = r.stdout.strip().split("|")
    status = "OK " if code == "200" and "image" in ctype and int(size) > 300 else "FAIL"
    print(f"{status} {fn}  [{code} {ctype} {size}b]")
