#!/usr/bin/env python3
"""慢速礼貌抓取器：1并发 + 延迟 + 403退避重试 + 不删已有文件"""
import hashlib, subprocess, os, sys, time, random, urllib.parse

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36"
BASE = "https://slaythespire.wiki.gg/images"
OUT = "/home/z/my-project/public/assets"

def fetch(subdir, out_name, filename, ext=".png"):
    """下载单个文件，403 时退避重试最多5次"""
    fn = filename.replace(" ", "_")
    md5 = hashlib.md5(fn.encode()).hexdigest()
    url = f"{BASE}/{md5[0]}/{md5[:2]}/{urllib.parse.quote(fn)}"
    dirpath = os.path.join(OUT, subdir)
    os.makedirs(dirpath, exist_ok=True)
    outpath = os.path.join(dirpath, out_name + ext)
    if os.path.exists(outpath) and os.path.getsize(outpath) > 40:
        return True  # 已有，跳过
    for attempt in range(6):
        try:
            r = subprocess.run(
                ["curl", "-sL", "-m", "25", url, "-H", f"User-Agent: {UA}",
                 "-o", outpath, "-w", "%{http_code}|%{content_type}|%{size_download}"],
                capture_output=True, text=True, timeout=35)
            parts = r.stdout.strip().split("|")
            if len(parts) == 3 and parts[0] == "200" and "image" in parts[1] and int(parts[2]) > 40:
                with open(outpath, "rb") as f:
                    magic = f.read(4)
                if magic == b"\x89PNG" or magic[:3] == b"\xff\xd8\xff" or magic[:4] == b"RIFF":
                    return True
                # 下到了图片字节但格式不对（如webp存成png名）——保留也行
                return magic != b""
            if parts and parts[0] == "403":
                # 限流，指数退避
                wait = 20 * (attempt + 1) + random.uniform(2, 8)
                print(f"    403 限流，退避 {wait:.0f}s ...", flush=True)
                os.path.exists(outpath) and os.remove(outpath)
                time.sleep(wait)
                continue
            os.path.exists(outpath) and os.remove(outpath)
            return False
        except Exception:
            os.path.exists(outpath) and os.remove(outpath)
            time.sleep(3)
    return False

def fetch_multi(subdir, out_name, candidates):
    for fn in candidates:
        if fetch(subdir, out_name, fn):
            return True
    return False

TASKS = [
    # ===== typeicons（27彩色类型图标） =====
]
for char in ["Silent", "Defect", "Watcher"]:
    for typ in ["Attack", "Skill", "Power"]:
        for rar in ["Common", "Uncommon", "Rare"]:
            TASKS.append(("typeicons", f"{char.lower()}{typ.lower()}{rar.lower()}",
                          [f"CardIcon {char} {typ} {rar}.png"]))

# ===== 状态图标补漏 =====
STATUS = {
    "wrath": ["Icon Wrath.png", "Wrath Stance.png", "Stance Wrath.png", "Wrath (stance).png"],
    "calm": ["Icon Calm.png", "Calm Stance.png", "Stance Calm.png", "Calm (stance).png"],
    "divinity": ["Icon Divinity.png", "Divinity Stance.png", "Divinity (stance).png"],
    "lockOn": ["Icon Lock-on.png", "Icon Lock on.png", "Locked On.png"],
    "theBomb": ["Icon The Bomb.png", "The Bomb.png"],
    "time": ["Icon Time.png", "Time (buff).png", "Icon Time (buff).png"],
    "beatOfDeath": ["Icon Beat of Death.png", "Beat of Death.png"],
    "infiniteBlades": ["Icon Infinite Blades.png", "Infinite Blades.png"],
    "afterImage": ["Icon After Image.png", "After Image.png"],
    "noxiousFumes": ["Icon Noxious Fumes.png", "Noxious Fumes.png"],
    "phasing": ["Icon Phasing.png", "Phasing.png"],
    "mark": ["Icon Mark.png", "Mark (flight).png"],
    "flying": ["Icon Flying.png", "Flying.png"],
    "hex": ["Icon Hex.png", "Hex.png"],
    "mantra": ["Icon Mantra.png", "Mantra.png"],
    "constricted": ["Icon Constricted.png", "Constricted.png"],
    "intangible": ["Icon Intangible.png", "Intangible.png"],
    "equilibrium": ["Icon Equilibrium.png", "Equilibrium.png"],
    "mentalFortress": ["Icon Mental Fortress.png", "Mental Fortress.png"],
    "likeWater": ["Icon Like Water.png", "Like Water.png"],
    "nirvana": ["Icon Nirvana.png", "Nirvana.png"],
    "devotion": ["Icon Devotion.png", "Devotion.png"],
    "brilliance": ["Icon Brilliance.png", "Brilliance.png"],
    "masterReality": ["Icon Master Reality.png", "Master Reality.png"],
    "establishment": ["Icon Establishment.png", "Establishment.png"],
    "loop": ["Icon Loop.png", "Loop.png"],
    "staticDischarge": ["Icon Static Discharge.png", "Static Discharge.png"],
    "storm": ["Icon Storm.png", "Storm.png"],
    "accuracy": ["Icon Accuracy.png", "Accuracy.png"],
    "caltrops": ["Icon Caltrops.png", "Caltrops.png"],
    "aThousandCuts": ["Icon A Thousand Cuts.png", "A Thousand Cuts.png"],
    "echo": ["Icon Echo.png", "Echo.png"],
    "amplify": ["Icon Amplify.png", "Amplify.png"],
    "heatsinks": ["Icon Heatsinks.png", "Heat Sinks.png"],
    "rebirth": ["Icon Rebirth.png", "Rebirth.png"],
    "shackle": ["Icon Shackle.png", "Shackled.png", "Entangled.png"],
    "dexterityLoss": ["Icon Dexterity Down.png", "Dexterity Down.png"],
}
for k, cands in STATUS.items():
    TASKS.append(("status", k, cands))

# ===== 药水补漏（防误删重下） =====
for k, cands in {
    "poisonPotion": ["Poison Potion.png"], "ghostInAJar": ["Ghost In A Jar.png"],
    "liquidBronze": ["Liquid Bronze.png"], "cultistPotion": ["Cultist Potion.png"],
    "sneckoOil": ["Snecko Oil.png"], "essenceOfSteel": ["Essence of Steel.png"],
}.items():
    TASKS.append(("potions", k, cands))

# ===== 遗物补漏 =====
for k, cands in {
    "ringOfTheSnake": ["Ring of the Snake.png"], "crackedCore": ["Cracked Core.png"],
    "pureWater": ["Pure Water.png"], "tungstenRod": ["Tungsten Rod.png"],
    "oddlySmoothStone": ["Oddly Smooth Stone.png"], "dataDisk": ["Data Disk.png"],
    "ginger": ["Ginger.png"], "turnip": ["Turnip.png"], "kunai": ["Kunai.png"],
    "sneckoEye": ["Snecko Eye.png"], "velvetChoker": ["Velvet Choker.png"],
}.items():
    TASKS.append(("relics", k, cands))

# ===== 背景图 =====
for k, cands in {
    "combat2": ["The City.png", "City.png"],
    "combat3": ["The Beyond.png", "Beyond.png"],
    "combat4": ["The Heart.png", "Heart.png"],
    "map1": ["The Exordium.png", "Exordium.png"],
}.items():
    TASKS.append(("bg", k, cands))

# ===== 敌人补漏 =====
for k, cands in {
    "mystic": ["DarkPriest.png", "Dark Priest.png", "Mystic.png"],
    "munchkin": ["Munchkin.png", "ShellMonster.png"],
}.items():
    TASKS.append(("enemies", k, cands))

# ===== 卡面补漏（加无Art后缀/其他变体） =====
for k, cands in {
    "bouncingBlade": ["Green-BouncingBlade-Art.png", "BouncingBlade.png", "Green-Bouncing Blade-Art.png"],
    "chumpBlocker": ["Green-ChumpBlocker-Art.png", "ChumpBlocker.png"],
    "stormOfSteel": ["Green-StormOfSteel-Art.png", "StormOfSteel.png"],
    "shiv": ["Green-Shiv-Art.png", "Shiv.png", "Green-ShivArt-Art.png"],
    "sweepBeam": ["Blue-SweepBeam-Art.png", "SweepingBeam.png", "Blue-SweepingBeam-Art.png"],
    "chainLightning": ["Blue-ChainLightning-Art.png", "ChainLightning.png", "Chain Lightning.png"],
    "multiCast": ["Blue-MultiCast-Art.png", "MultiCast.png", "Blue-Multi Cast-Art.png"],
    "consecration": ["Purple-Consecration-Art.png", "Consecration.png"],
    "crushJoint": ["Purple-CrushJoint-Art.png", "CrushJoint.png", "Purple-CrushJoints-Art.png"],
    "smite": ["Purple-Smite-Art.png", "Smite.png"],
    "miracle": ["Purple-Miracle-Art.png", "Miracle.png"],
    "beta": ["Purple-Beta-Art.png", "Beta.png"],
    "omega": ["Purple-Omega-Art.png", "Omega.png"],
    "cloakAndDagger": ["Green-CloakAndDagger-Art.png", "CloakAndDagger.png"],
    "dodgeAndRoll": ["Green-DodgeAndRoll-Art.png", "DodgeAndRoll.png"],
}.items():
    TASKS.append(("cardart", k, cands))

def main():
    ok, miss = 0, []
    total = len(TASKS)
    for i, (subdir, name, cands) in enumerate(TASKS):
        good = fetch_multi(subdir, name, cands)
        status = "OK " if good else "MISS"
        print(f"[{i+1}/{total}] {status} {subdir}/{name}", flush=True)
        if good:
            ok += 1
        else:
            miss.append(f"{subdir}/{name}")
        time.sleep(random.uniform(0.8, 1.6))  # 礼貌延迟
    print(f"\n=== 成功 {ok}/{total}, 失败 {len(miss)} ===")
    for m in miss:
        print("  MISS", m)

if __name__ == "__main__":
    main()
