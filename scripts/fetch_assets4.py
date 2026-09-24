#!/usr/bin/env python3
"""修正文件名（空格→下划线）并补齐缺失素材"""
import hashlib
import subprocess
import os
import json
import urllib.parse
import time
from concurrent.futures import ThreadPoolExecutor

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36"
BASE = "https://slaythespire.wiki.gg/images"
API = "https://slaythespire.wiki.gg/api.php"
OUT = "/home/z/my-project/public/assets"

def wiki_url(filename: str) -> str:
    md5 = hashlib.md5(filename.encode()).hexdigest()
    return f"{BASE}/{md5[0]}/{md5[:2]}/{filename}"

def download(task):
    subdir, out_name, filename = task
    url = wiki_url(filename)
    dirpath = os.path.join(OUT, subdir)
    os.makedirs(dirpath, exist_ok=True)
    outpath = os.path.join(dirpath, out_name + ".png")
    try:
        r = subprocess.run(
            ["curl", "-sL", "-m", "30", url, "-H", f"User-Agent: {UA}",
             "-o", outpath, "-w", "%{http_code}|%{content_type}|%{size_download}"],
            capture_output=True, text=True, timeout=40)
        code, ctype, size = r.stdout.strip().split("|")
        if code == "200" and "image" in ctype and int(size) > 300:
            with open(outpath, "rb") as f:
                magic = f.read(4)
            if magic == b"\x89PNG":
                return (task, True, int(size))
        os.path.exists(outpath) and os.remove(outpath)
        return (task, False, 0)
    except Exception:
        os.path.exists(outpath) and os.remove(outpath)
        return (task, False, 0)

tasks = []
# 意图（下划线）
INTENTS = {
    "attack": "Intent_Attack.png", "attack2": "Intent_Attack2.png",
    "attack3": "Intent_Attack3.png", "attack4": "Intent_Attack4.png",
    "attack5": "Intent_Attack5.png", "attack6": "Intent_Attack6.png",
    "attack7": "Intent_Attack7.png", "attackDebuff": "Intent_AttackDebuff.png",
    "attackDebuff2": "Intent_AttackDebuff2.png", "attackDefend": "Intent_AttackDefend.png",
    "defend": "Intent_Defend.png", "defend2": "Intent_Defend2.png",
    "buff": "Intent_Buff.png", "debuff": "Intent_Debuff.png",
    "debuff2": "Intent_Debuff2.png", "debuffStrong": "Intent_DebuffStrong.png",
    "sleep": "Intent_Sleep.png", "sleep2": "Intent_Sleep2.png",
    "unknown": "Intent_Unknown.png", "unknown2": "Intent_Unknown2.png",
    "stun": "Intent_Stun.png", "escape": "Intent_Escape.png",
}
for k, f in INTENTS.items():
    tasks.append(("intent", k, f))

# 状态图标（下划线）
STATUS_ICONS = {
    "strength": "Icon_Strength.png", "dexterity": "Icon_Dexterity.png",
    "vulnerable": "Icon_Vulnerable.png", "weak": "Icon_Weak.png",
    "frail": "Icon_Frail.png", "thorns": "Icon_Thorns.png",
    "artifact": "Icon_Artifact.png", "metallicize": "Icon_Metallicize.png",
    "ritual": "Icon_Ritual.png", "regen": "Icon_Regen.png",
    "poison": "Icon_Poison.png", "anger": "Icon_Anger.png",
    "brutality": "Icon_Brutality.png", "combust": "Icon_Combust.png",
    "corruption": "Icon_Corruption.png", "darkEmbrace": "Icon_DarkEmbrace.png",
    "demonForm": "Icon_DemonForm.png", "evolve": "Icon_Evolve.png",
    "feelNoPain": "Icon_FeelNoPain.png", "fireBreathing": "Icon_FireBreathing.png",
    "flameBarrier": "Icon_FlameBarrier.png", "juggernaut": "Icon_Juggernaut.png",
    "rage": "Icon_Rage.png", "rupture": "Icon_Rupture.png",
    "berserk": "Icon_Berserk.png", "doubleTap": "Icon_DoubleTap.png",
    "entrench": "Icon_Entrench.png", "barricade": "Icon_Barricade.png",
    "noDraw": "Icon_NoDraw.png", "modeShift": "Icon_ModeShift.png",
    "angry": "Icon_Angry.png", "curlUp": "Icon_CurlUp.png",
    "sporeCloud": "Icon_SporeCloud.png", "split": "Icon_Split.png",
    "stasis": "Icon_Stasis.png", "sharpHide": "Icon_SharpHide.png",
    "block": "Icon_Block.png",
}
for k, f in STATUS_ICONS.items():
    tasks.append(("status", k, f))

# 类型小图标（下划线）
TYPE_ICONS = {
    "attackCommon": "CardIcon_Ironclad_Attack_Common.png",
    "attackUncommon": "CardIcon_Ironclad_Attack_Uncommon.png",
    "attackRare": "CardIcon_Ironclad_Attack_Rare.png",
    "skillCommon": "CardIcon_Ironclad_Skill_Common.png",
    "skillUncommon": "CardIcon_Ironclad_Skill_Uncommon.png",
    "skillRare": "CardIcon_Ironclad_Skill_Rare.png",
    "powerCommon": "CardIcon_Ironclad_Power_Common.png",
    "powerUncommon": "CardIcon_Ironclad_Power_Uncommon.png",
    "powerRare": "CardIcon_Ironclad_Power_Rare.png",
    "status": "CardIcon_Status.png",
}
for k, f in TYPE_ICONS.items():
    tasks.append(("typeicons", k, f))

# 状态牌插画候选
STATUS_ART = {
    "wound": ["Red-Wound-Art.png", "Wound_Art.png", "Wound_(card).png"],
    "dazed": ["Red-Dazed-Art.png", "Dazed_Art.png", "Dazed_(card).png"],
    "burn": ["Red-Burn-Art.png", "Burn_Art.png", "Burn_(card).png"],
    "slimed": ["Red-Slimed-Art.png", "Slimed_Art.png", "Slimed_(card).png"],
}
for k, cands in STATUS_ART.items():
    for c in cands:
        tasks.append(("cardart", k, c))

# 遗物/药水缺失候选
tasks.append(("relics", "meatOnTheBone", "MeatOnTheBone.png"))
tasks.append(("relics", "meatOnTheBone", "Meat_on_the_Bone.png"))
tasks.append(("potions", "fairyInBottle", "FairyinaBottle.png"))
tasks.append(("potions", "fairyInBottle", "FairyInABottle.png"))

def main():
    ok, miss = 0, []
    with ThreadPoolExecutor(max_workers=12) as ex:
        for (task, good, size) in ex.map(download, tasks):
            subdir, out_name, fn = task
            if good:
                ok += 1
            else:
                miss.append(f"{subdir}/{out_name} <- {fn}")
    print(f"成功 {ok}, 失败 {len(miss)}")
    for m in miss:
        print("  MISS", m)

if __name__ == "__main__":
    main()
