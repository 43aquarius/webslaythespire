#!/usr/bin/env python3
"""最终修复：wiki 文件名空格→下划线后重试全部缺失素材"""
import hashlib, subprocess, os, json, urllib.parse
from concurrent.futures import ThreadPoolExecutor

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36"
BASE = "https://slaythespire.wiki.gg/images"
OUT = "/home/z/my-project/public/assets"

def try_one(subdir, out_name, filename):
    fn = filename.replace(" ", "_")  # 关键：wiki URL 用下划线
    md5 = hashlib.md5(fn.encode()).hexdigest()
    url = f"{BASE}/{md5[0]}/{md5[:2]}/{urllib.parse.quote(fn)}"
    dirpath = os.path.join(OUT, subdir)
    os.makedirs(dirpath, exist_ok=True)
    outpath = os.path.join(dirpath, out_name + ".png")
    try:
        r = subprocess.run(
            ["curl", "-sL", "-m", "25", url, "-H", f"User-Agent: {UA}",
             "-o", outpath, "-w", "%{http_code}|%{content_type}|%{size_download}"],
            capture_output=True, text=True, timeout=35)
        parts = r.stdout.strip().split("|")
        if len(parts) == 3 and parts[0] == "200" and "image" in parts[1] and int(parts[2]) > 300:
            with open(outpath, "rb") as f:
                magic = f.read(4)
            if magic == b"\x89PNG" or magic[:3] == b"\xff\xd8\xff" or magic[:4] == b"RIFF":
                return True
        os.path.exists(outpath) and os.remove(outpath)
        return False
    except Exception:
        os.path.exists(outpath) and os.remove(outpath)
        return False

tasks = []

# ============ 状态图标（下划线命名） ============
STATUS = {
    "focus": "Icon Focus.png", "wrath": "Icon Wrath.png", "calm": "Icon Calm.png",
    "divinity": "Icon Divinity.png", "intangible": "Icon Intangible.png",
    "lockOn": "Icon Lock-on.png", "mark": "Icon Mark.png", "mantra": "Icon Mantra.png",
    "constricted": "Icon Constricted.png", "theBomb": "Icon The Bomb.png",
    "hex": "Icon Hex.png", "flying": "Icon Flying.png", "time": "Icon Time.png",
    "beatOfDeath": "Icon Beat of Death.png", "infiniteBlades": "Icon Infinite Blades.png",
    "afterImage": "Icon After Image.png", "noxiousFumes": "Icon Noxious Fumes.png",
    "envenom": "Icon Envenom.png", "phasing": "Icon Phasing.png",
    "equilibrium": "Icon Equilibrium.png", "mentalFortress": "Icon Mental Fortress.png",
    "likeWater": "Icon Like Water.png", "nirvana": "Icon Nirvana.png",
    "devotion": "Icon Devotion.png", "brilliance": "Icon Brilliance.png",
    "masterReality": "Icon Master Reality.png", "establishment": "Icon Establishment.png",
    "loop": "Icon Loop.png", "staticDischarge": "Icon Static Discharge.png",
    "storm": "Icon Storm.png", "accuracy": "Icon Accuracy.png", "caltrops": "Icon Caltrops.png",
    "aThousandCuts": "Icon A Thousand Cuts.png", "echo": "Icon Echo.png",
    "amplify": "Icon Amplify.png", "heatsinks": "Icon Heatsinks.png",
    "berserk": "Icon Berserk.png", "rebirth": "Icon Rebirth.png", "shackle": "Icon Shackle.png",
    "dexterityLoss": "Icon Dexterity Down.png",
    # 额外：观者姿态牌需要的
    "wrathStance": "Icon Wrath.png", "minion": "Icon Minion.png",
    "tentacle": "Icon Tentacle.png", "shieldNext": "Icon Shield.png",
}
for k, f in STATUS.items():
    tasks.append(("status", k, [f]))

# ============ 彩色类型图标（CardIcon_{Char}_{Type}_{Rarity}.png 下划线版） ============
for char in ["Silent", "Defect", "Watcher"]:
    for typ in ["Attack", "Skill", "Power"]:
        for rar in ["Common", "Uncommon", "Rare"]:
            key = f"{char.lower()}{typ.lower()}{rar.lower()}"
            tasks.append(("typeicons", key, [f"CardIcon {char} {typ} {rar}.png"]))

# ============ 药水/遗物（下划线） ============
for k, f in {
    "poisonPotion": "Poison Potion.png", "ghostInAJar": "Ghost In A Jar.png",
    "liquidBronze": "Liquid Bronze.png", "cultistPotion": "Cultist Potion.png",
    "sneckoOil": "Snecko Oil.png", "essenceOfSteel": "Essence of Steel.png",
}.items():
    tasks.append(("potions", k, [f]))
for k, f in {
    "ringOfTheSnake": "Ring of the Snake.png", "crackedCore": "Cracked Core.png",
    "pureWater": "Pure Water.png", "tungstenRod": "Tungsten Rod.png",
    "oddlySmoothStone": "Oddly Smooth Stone.png", "dataDisk": "Data Disk.png",
    "ginger": "Ginger.png", "turnip": "Turnip.png", "kunai": "Kunai.png",
    "sneckoEye": "Snecko Eye.png", "velvetChoker": "Velvet Choker.png",
    "kunai2": "Kunai.png",
}.items():
    tasks.append(("relics", k, [f]))

# ============ 背景图（幕数地图/战斗背景，下划线） ============
for k, cands in {
    "combat2": ["The City.png", "City.png", "Act 2.png", "Environment - The City.png"],
    "combat3": ["The Beyond.png", "Beyond.png", "Act 3.png", "Environment - The Beyond.png"],
    "combat4": ["The Heart.png", "Heart.png", "Act 4.png", "Environment - The Heart.png"],
    "map1": ["The Exordium.png", "Exordium.png", "Act 1.png", "Environment - Exordium.png"],
}.items():
    tasks.append(("bg", k, cands))

# ============ 敌人补漏（下划线） ============
import glob
have = {os.path.splitext(os.path.basename(p))[0] for p in glob.glob(f"{OUT}/enemies/*.png")}
WANT = {
    "byrd": "Byrd.png", "chosen": "Chosen.png", "centurion": "Centurion.png", "mystic": "DarkPriest.png",
    "madGremlin": "GremlinHorn.png", "fatGremlin": "GremlinFat.png", "gremlinWizard": "GremlinWizard.png",
    "shieldGremlin": "GremlinTsundere.png", "sneakyGremlin": "GremlinThief.png",
    "redSlaver": "SlaverRed.png", "blueSlaver": "SlaverBlue.png",
    "sphericGuardian": "SphericGuardian.png", "munchkin": "Munchkin.png",
    "gremlinLeader": "GremlinLeader.png", "bookOfStabbing": "BookOfStabbing.png", "taskmaster": "Taskmaster.png",
    "bronzeAutomaton": "BronzeAutomaton.png", "bronzeOrb": "BronzeOrb.png",
    "theCollector": "TheCollector.png", "theChamp": "Champ.png",
    "spiker": "Spiker.png", "repulsor": "Repulsor.png", "orbWalker": "OrbWalker.png",
    "writhingMass": "WrithingMass.png", "spireGrowth": "SpireGrowth.png",
    "transient": "Transient.png", "darkling": "Darkling.png",
    "giantHead": "GiantHead.png", "nemesis": "Nemesis.png", "reptomancer": "Reptomancer.png",
    "dagger": "Dagger.png", "awakenedOne": "AwakenedOne.png", "timeEater": "TimeEater.png",
    "donu": "Donu.png", "deca": "Deca.png",
    "spireShield": "SpireShield.png", "spireSpear": "SpireSpear.png", "corruptHeart": "CorruptHeart.png",
}
for k, f in WANT.items():
    if k not in have:
        tasks.append(("enemies", k, [f]))

# ============ 卡面补漏（下划线 + 更多变体） ============
CARDART_CAND = {
    "cloakAndDagger": ["Green-CloakAndDagger-Art.png", "Green-CloakandDagger-Art.png"],
    "dodgeAndRoll": ["Green-DodgeAndRoll-Art.png", "Green-DodgeandRoll-Art.png"],
    "bouncingBlade": ["Green-BouncingBlade-Art.png", "Green-BouncingBlades-Art.png"],
    "chumpBlocker": ["Green-ChumpBlocker-Art.png", "Green-Chumpblocker-Art.png"],
    "stormOfSteel": ["Green-StormOfSteel-Art.png", "Green-StormofSteel-Art.png"],
    "shiv": ["Green-Shiv-Art.png", "Shiv.png"],
    "sweepBeam": ["Blue-SweepBeam-Art.png", "Blue-SweepingBeam-Art.png"],
    "chainLightning": ["Blue-ChainLightning-Art.png", "Chain Lightning.png"],
    "multiCast": ["Blue-MultiCast-Art.png", "Blue-Multicast-Art.png"],
    "consecration": ["Purple-Consecration-Art.png", "Consecration.png"],
    "crushJoint": ["Purple-CrushJoint-Art.png", "Purple-CrushJoints-Art.png"],
    "smite": ["Purple-Smite-Art.png", "Smite.png"],
    "miracle": ["Purple-Miracle-Art.png", "Miracle.png"],
    "beta": ["Purple-Beta-Art.png", "Beta.png"],
    "omega": ["Purple-Omega-Art.png", "Omega.png"],
    # 尝试无 Art 后缀的通用模式
}
for k, cands in CARDART_CAND.items():
    tasks.append(("cardart", k, cands))

def main():
    ok, miss = 0, []
    with ThreadPoolExecutor(max_workers=12) as ex:
        results = list(ex.map(lambda t: (t, try_one(t[0], t[1], t[2][0]) if len(t[2]) == 1 else None), tasks))
    # 多候选的单独处理
    for task, _ in results:
        pass
    # 简化：逐个跑（带多候选）
    ok, miss = 0, []
    for task in tasks:
        subdir, out_name, cands = task
        good = False
        for fn in cands:
            if try_one(subdir, out_name, fn):
                good = True
                break
        if good:
            ok += 1
        else:
            miss.append(f"{subdir}/{out_name}")
    print(f"成功 {ok}/{len(tasks)}, 仍失败 {len(miss)}")
    for m in miss:
        print("  MISS", m)

if __name__ == "__main__":
    main()
