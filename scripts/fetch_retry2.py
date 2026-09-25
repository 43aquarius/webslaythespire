#!/usr/bin/env python3
"""修复失败素材：对每个目标尝试多个候选 wiki 文件名"""
import hashlib, subprocess, os, json
from concurrent.futures import ThreadPoolExecutor

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36"
BASE = "https://slaythespire.wiki.gg/images"
OUT = "/home/z/my-project/public/assets"

def wiki_url(filename: str) -> str:
    md5 = hashlib.md5(filename.encode()).hexdigest()
    return f"{BASE}/{md5[0]}/{md5[:2]}/{urllib.parse.quote(filename)}"

import urllib.parse

def try_one(subdir, out_name, filename):
    url = wiki_url(filename)
    dirpath = os.path.join(OUT, subdir)
    os.makedirs(dirpath, exist_ok=True)
    outpath = os.path.join(dirpath, out_name + ".png")
    try:
        r = subprocess.run(
            ["curl", "-sL", "-m", "25", url, "-H", f"User-Agent: {UA}",
             "-o", outpath, "-w", "%{http_code}|%{content_type}|%{size_download}"],
            capture_output=True, text=True, timeout=35)
        code, ctype, size = r.stdout.strip().split("|")
        if code == "200" and "image" in ctype and int(size) > 300:
            with open(outpath, "rb") as f:
                magic = f.read(4)
            if magic == b"\x89PNG" or magic[:3] == b"\xff\xd8\xff" or magic[:4] == b"RIFF":
                return True
        os.path.exists(outpath) and os.remove(outpath)
        return False
    except Exception:
        os.path.exists(outpath) and os.remove(outpath)
        return False

def download_multi(task):
    subdir, out_name, candidates = task
    for fn in candidates:
        if try_one(subdir, out_name, fn):
            return (task, True, fn)
    return (task, False, None)

tasks = []

# ============ 失败的状态图标：多候选文件名 ============
STATUS_CAND = {
    "focus": ["Focus.png", "Status Icon - Focus.png", "Icon Focus.png", "Focus (icon).png", "Icon  Focus.png"],
    "wrath": ["Wrath.png", "Status Icon - Wrath.png", "Icon Wrath.png", "Wrath Stance.png", "Stance Wrath.png"],
    "calm": ["Calm.png", "Status Icon - Calm.png", "Icon Calm.png", "Calm Stance.png", "Stance Calm.png"],
    "divinity": ["Divinity.png", "Status Icon - Divinity.png", "Icon Divinity.png", "Divinity Stance.png"],
    "intangible": ["Intangible.png", "Status Icon - Intangible.png", "Icon Intangible.png"],
    "lockOn": ["Lock On.png", "Status Icon - Lock On.png", "Icon Lock-on.png", "Locked On.png"],
    "mark": ["Mark.png", "Status Icon - Mark.png", "Icon Mark.png", "Flight.png"],
    "mantra": ["Mantra.png", "Status Icon - Mantra.png", "Icon Mantra.png"],
    "constricted": ["Constricted.png", "Status Icon - Constricted.png", "Icon Constricted.png"],
    "theBomb": ["The Bomb.png", "Status Icon - The Bomb.png", "Bomb.png"],
    "hex": ["Hex.png", "Status Icon - Hex.png", "Icon Hex.png"],
    "flying": ["Flight.png", "Status Icon - Flight.png", "Flying.png", "Icon Flight.png"],
    "time": ["Time.png", "Status Icon - Time.png", "Icon Time.png"],
    "beatOfDeath": ["Beat of Death.png", "Status Icon - Beat of Death.png"],
    "infiniteBlades": ["Infinite Blades.png", "Status Icon - Infinite Blades.png", "Infinite Blades (buff).png"],
    "afterImage": ["After Image.png", "Status Icon - After Image.png", "Afterimage.png"],
    "noxiousFumes": ["Noxious Fumes.png", "Status Icon - Noxious Fumes.png"],
    "envenom": ["Envenom.png", "Status Icon - Envenom.png"],
    "phasing": ["Phasing.png", "Status Icon - Phasing.png"],
    "equilibrium": ["Equilibrium.png", "Status Icon - Equilibrium.png", "Buffer.png"],
    "mentalFortress": ["Mental Fortress.png", "Status Icon - Mental Fortress.png"],
    "likeWater": ["Like Water.png", "Status Icon - Like Water.png"],
    "nirvana": ["Nirvana.png", "Status Icon - Nirvana.png"],
    "devotion": ["Devotion.png", "Status Icon - Devotion.png"],
    "brilliance": ["Brilliance.png", "Status Icon - Brilliance.png"],
    "masterReality": ["Master Reality.png", "Status Icon - Master Reality.png"],
    "establishment": ["Establishment.png", "Status Icon - Establishment.png"],
    "loop": ["Loop.png", "Status Icon - Loop.png", "Loop (buff).png"],
    "staticDischarge": ["Static Discharge.png", "Status Icon - Static Discharge.png"],
    "storm": ["Storm.png", "Status Icon - Storm.png", "Storm (buff).png"],
    "accuracy": ["Accuracy.png", "Status Icon - Accuracy.png", "Accuracy (buff).png"],
    "caltrops": ["Caltrops.png", "Status Icon - Caltrops.png", "Caltrops (buff).png"],
    "aThousandCuts": ["A Thousand Cuts.png", "Status Icon - A Thousand Cuts.png"],
    "echo": ["Echo.png", "Status Icon - Echo.png", "Echo (buff).png", "Echo Form.png"],
    "amplify": ["Amplify.png", "Status Icon - Amplify.png"],
    "heatsinks": ["Heatsinks.png", "Status Icon - Heatsinks.png", "Heat Sinks.png"],
    "berserk": ["Berserk.png", "Status Icon - Berserk.png"],
    "rebirth": ["Rebirth.png", "Status Icon - Rebirth.png"],
    "shackle": ["Shackle.png", "Status Icon - Shackle.png", "Shackled.png"],
    "dexterityLoss": ["Dexterity Down.png", "Icon Dexterity Down.png", "Dexterity (debuff).png"],
}
for k, cands in STATUS_CAND.items():
    tasks.append(("status", k, cands))

# ============ 失败的药水 ============
POTIONS_CAND = {
    "poisonPotion": ["Poison Potion.png", "Potion - Poison Potion.png"],
    "ghostInAJar": ["Ghost In A Jar.png", "Ghost in a Jar.png", "Ghost in a Jar (potion).png"],
    "liquidBronze": ["Liquid Bronze.png", "LiquidBronze.png"],
    "cultistPotion": ["Cultist Potion.png", "CultistPotion.png"],
    "sneckoOil": ["Snecko Oil.png", "SneckoOil.png"],
    "essenceOfSteel": ["Essence of Steel.png", "EssenceOfSteel.png"],
}
for k, cands in POTIONS_CAND.items():
    tasks.append(("potions", k, cands))

# ============ 失败的遗物 ============
RELICS_CAND = {
    "ringOfTheSnake": ["Ring of the Snake.png", "RingOfTheSnake.png", "Relic - Ring of the Snake.png"],
    "crackedCore": ["Cracked Core.png", "CrackedCore.png"],
    "pureWater": ["Pure Water.png", "PureWater.png"],
    "tungstenRod": ["Tungsten Rod.png", "TungstenRod.png"],
    "oddlySmoothStone": ["Oddly Smooth Stone.png", "OddlySmoothStone.png"],
    "dataDisk": ["Data Disk.png", "DataDisk.png"],
}
for k, cands in RELICS_CAND.items():
    tasks.append(("relics", k, cands))

# ============ 失败的背景图（试区域名/文件名变体） ============
BG_CAND = {
    "combat2": ["TheCity.png", "The City.png", "City.png", "Act2.png", "Act 2.png", "The city.png"],
    "combat3": ["Beyond.png", "The Beyond.png", "Act3.png", "Act 3.png"],
    "combat4": ["TheHeart.png", "The Heart.png", "Heart.png", "Act4.png", "Act 4.png"],
    "map1": ["Exordium.png", "The Exordium.png", "Act1.png", "Act 1.png"],
}
for k, cands in BG_CAND.items():
    tasks.append(("bg", k, cands + [c.replace('.png', '.jpg') for c in cands]))

# ============ 失败的敌人 ============
ENEMIES_CAND = {
    "munchkin": ["Munchkin.png", "Mystic.png", "DarkPriest.png", "Mystic (enemy).png"],
    "darkling": ["Darkling.png", "Darklings.png"],
}
# 检查到底哪2个敌人失败
import glob
have = {os.path.splitext(os.path.basename(p))[0] for p in glob.glob(f"{OUT}/enemies/*.png")}
WANT = ["byrd","chosen","centurion","mystic","madGremlin","fatGremlin","gremlinWizard","shieldGremlin","sneakyGremlin",
        "redSlaver","blueSlaver","sphericGuardian","munchkin","gremlinLeader","bookOfStabbing","taskmaster",
        "bronzeAutomaton","bronzeOrb","theCollector","theChamp","spiker","repulsor","orbWalker","writhingMass",
        "spireGrowth","transient","darkling","giantHead","nemesis","reptomancer","dagger","awakenedOne","timeEater",
        "donu","deca","spireShield","spireSpear","corruptHeart"]
for w in WANT:
    if w not in have:
        cands = [w + ".png", w[0].upper() + w[1:] + ".png"]
        if w in ENEMIES_CAND: cands = ENEMIES_CAND[w] + cands
        tasks.append(("enemies", w, cands))

# ============ 失败的卡面 ============
CARDART_CAND = {
    "cloakAndDagger": ["Green-CloakAndDagger-Art.png", "Green-CloakandDagger-Art.png", "Green-Cloak-and-Dagger-Art.png", "Cloak and Dagger (card art).png"],
    "dodgeAndRoll": ["Green-DodgeAndRoll-Art.png", "Green-DodgeandRoll-Art.png", "Dodge and Roll (card art).png"],
    "bouncingBlade": ["Green-BouncingBlade-Art.png", "Green-BouncingBlades-Art.png", "Bouncing Blade (card art).png"],
    "chumpBlocker": ["Green-ChumpBlocker-Art.png", "Green-Chumpblocker-Art.png", "Chump Blocker (card art).png"],
    "stormOfSteel": ["Green-StormOfSteel-Art.png", "Green-StormofSteel-Art.png", "Storm of Steel (card art).png"],
    "shiv": ["Green-Shiv-Art.png", "Shiv (card art).png", "Green-Shivs-Art.png", "Shiv.png"],
    "sweepBeam": ["Blue-SweepBeam-Art.png", "Blue-SweepingBeam-Art.png", "Sweeping Beam (card art).png", "Blue-SweepingBeam-Art.png"],
    "chainLightning": ["Blue-ChainLightning-Art.png", "Chain Lightning (card art).png", "Blue-ChargeBeam-Art.png"],
    "multiCast": ["Blue-MultiCast-Art.png", "Multi-Cast (card art).png", "Blue-Multicast-Art.png", "Multicast.png"],
    "consecration": ["Purple-Consecration-Art.png", "Consecration (card art).png", "Purple-ConjureBlade-Art.png"],
    "crushJoint": ["Purple-CrushJoint-Art.png", "Crush Joints (card art).png", "Purple-CrushJoints-Art.png"],
    "smite": ["Purple-Smite-Art.png", "Smite (card art).png", "Purple-Smite(card).png"],
    "miracle": ["Purple-Miracle-Art.png", "Miracle (card art).png", "Purple-Miricle-Art.png"],
    "beta": ["Purple-Beta-Art.png", "Beta (card art).png", "Purple-Beta(card).png"],
    "omega": ["Purple-Omega-Art.png", "Omega (card art).png", "Purple-Omega(card).png"],
}
for k, cands in CARDART_CAND.items():
    tasks.append(("cardart", k, cands))

# ============ 失败的 typeicons（用旧命名模式 + 新角色变体） ============
# 已有: attackCommon.png 等 (红角色)。新角色格式: Icon_{Type}_{Rarity}_{Color}.png 之类
TYPE_CAND = {}
for char, color in [("silent", "Green"), ("defect", "Blue"), ("watcher", "Purple")]:
    for typ in ["attack", "skill", "power"]:
        for rar in ["common", "uncommon", "rare"]:
            T = typ.capitalize(); R = rar.capitalize()
            TYPE_CAND[f"{char}{typ}{rar}"] = [
                f"CardIcon_{color}_{typ.capitalize()}_{R}.png",
                f"{typ}{rar}{color}.png",
                f"Icon {T} {R} {color}.png",
                f"{color} {T} {R}.png",
                f"CardIcon_{T}_{R}_{color}.png",
                f"{typ}{R}.png",  # 旧命名兜底（红角色图标也行，颜色差异靠边框）
            ]
for k, cands in TYPE_CAND.items():
    tasks.append(("typeicons", k, cands))

def main():
    ok, miss = 0, []
    with ThreadPoolExecutor(max_workers=12) as ex:
        for (task, good, hit) in ex.map(download_multi, tasks):
            subdir, out_name, _ = task
            if good:
                ok += 1
            else:
                miss.append(f"{subdir}/{out_name}")
    print(f"成功 {ok}/{len(tasks)}, 仍失败 {len(miss)}")
    for m in miss:
        print("  MISS", m)

if __name__ == "__main__":
    main()
