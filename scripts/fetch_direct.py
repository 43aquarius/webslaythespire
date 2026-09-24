#!/usr/bin/env python3
"""最终批量下载：直连 URL（/images/NAME 无需MD5）+ 已确认的正确文件名"""
import subprocess, os, time, random

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36"
BASE = "https://slaythespire.wiki.gg/images"
OUT = "/home/z/my-project/public/assets"

def dl(subdir, out_name, filename):
    url = f"{BASE}/{filename}"
    dirpath = os.path.join(OUT, subdir)
    os.makedirs(dirpath, exist_ok=True)
    outpath = os.path.join(dirpath, out_name + ".png")
    if os.path.exists(outpath) and os.path.getsize(outpath) > 40:
        return True
    for attempt in range(4):
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
            if parts and parts[0] == "403":
                wait = 15 * (attempt + 1) + random.uniform(1, 5)
                print(f"    403退避{wait:.0f}s", flush=True)
                os.path.exists(outpath) and os.remove(outpath)
                time.sleep(wait)
                continue
            os.path.exists(outpath) and os.remove(outpath)
            return False
        except Exception:
            time.sleep(3)
    return False

# (subdir, out_name, wiki文件名)
TASKS = [
    # ===== 状态图标（驼峰命名，来自 API 确认列表） =====
    ("status", "afterImage", "Icon_AfterImage.png"),
    ("status", "beatOfDeath", "Icon_BeatOfDeath.png"),
    ("status", "theBomb", "Icon_Bomb.png"),
    ("status", "lockOn", "Icon_LockOn.png"),
    ("status", "aThousandCuts", "Icon_ThousandCuts.png"),
    ("status", "heatsinks", "Icon_Heatsink.png"),
    ("status", "noxiousFumes", "Icon_NoxiousFumes.png"),
    ("status", "shackle", "Icon_Shackled.png"),
    ("status", "time", "Icon_Timeline.png"),
    ("status", "infiniteBlades", "Icon_InfiniteBlades.png"),
    ("status", "mentalFortress", "Icon_MentalFortress.png"),
    ("status", "likeWater", "Icon_LikeWater.png"),
    ("status", "masterReality", "Icon_MasterReality.png"),
    ("status", "staticDischarge", "Icon_StaticDischarge.png"),
    ("status", "echo", "Icon_EchoForm.png"),
    ("status", "entangled", "Icon_Entangled.png"),
    ("status", "phantasmal", "Icon_Phantasmal.png"),
    ("status", "vigor", "Icon_Vigor.png"),
    ("status", "penNib", "Icon_PenNib.png"),
    ("status", "buffer", "Icon_Buffer.png"),
    ("status", "electro", "Icon_Electro.png"),
    ("status", "corpseExplosion", "Icon_CorpseExplosion.png"),
    ("status", "nightmare", "Icon_Nightmare.png"),
    ("status", "burst", "Icon_Burst.png"),
    ("status", "creativeAI", "Icon_CreativeAI.png"),
    ("status", "foresight", "Icon_Foresight.png"),
    ("status", "mayhem", "Icon_Mayhem.png"),
    ("status", "equilibriumB", "Icon_Equilibrium.png"),
    # ===== 药水 =====
    ("potions", "poisonPotion", "PoisonPotion.png"),
    ("potions", "cultistPotion", "CultistPotion.png"),
    ("potions", "liquidBronze", "LiquidBronze.png"),
    ("potions", "sneckoOil", "SneckoOil.png"),
    ("potions", "ghostInAJar", "GhostInAJar.png"),
    ("potions", "essenceOfSteel", "EssenceofSteel.png"),
    # ===== 遗物 =====
    ("relics", "oddlySmoothStone", "OddlySmoothStone.png"),
    ("relics", "ringOfTheSnake", "RingoftheSnake.png"),
    ("relics", "sneckoEye", "SneckoEye.png"),
    ("relics", "velvetChoker", "VelvetChoker.png"),
    ("relics", "dataDisk", "DataDisk.png"),
    ("relics", "tungstenRod", "TungstenRod.png"),
    ("relics", "pureWater", "PureWater.png"),
    ("relics", "crackedCore", "CrackedCore.png"),
    # ===== 卡面（确认命名） =====
    ("cardart", "multiCast", "Blue-Multi-Cast-Art.png"),
    ("cardart", "sweepBeam", "Blue-SweepingBeam-Art.png"),
    ("cardart", "consecration", "Purple-Consecrate-Art.png"),
    ("cardart", "crushJoint", "Purple-CrushJoints-Art.png"),
    ("cardart", "dodgeAndRoll", "Green-DodgeandRoll-Art.png"),
    ("cardart", "likeWaterS", "Purple-LikeWater-Art.png"),
    ("cardart", "devotionS", "Purple-Devotion-Art.png"),
    ("cardart", "brillianceS", "Purple-Brilliance-Art.png"),
    ("cardart", "mentalFortressS", "Purple-MentalFortress-Art.png"),
    ("cardart", "nirvanaS", "Purple-Nirvana-Art.png"),
    ("cardart", "alphaS", "Purple-Alpha-Art.png"),
    ("cardart", "amplifyS", "Blue-Amplify-Art.png"),
    ("cardart", "staticDischargeS", "Blue-StaticDischarge-Art.png"),
    ("cardart", "loopS", "Blue-Loop-Art.png"),
    ("cardart", "stormS", "Blue-Storm-Art.png"),
    ("cardart", "caltropsS", "Green-Caltrops-Art.png"),
    ("cardart", "envenomS", "Green-Envenom-Art.png"),
    ("cardart", "chainLightning", "Blue-ChainLightning-Art.png"),
    ("cardart", "chumpBlocker", "Green-ChumpBlocker-Art.png"),
    ("cardart", "stormOfSteel", "Green-StormofSteel-Art.png"),
    ("cardart", "bouncingBlade", "Green-BouncingFlask-Art.png"),
    ("cardart", "cloakAndDagger", "Green-CloakandDagger-Art.png"),
    # token 牌整卡（用于裁剪卡面）
    ("cardart", "_tok_beta", "Purple-Beta.png"),
    ("cardart", "_tok_omega", "Purple-Omega.png"),
    ("cardart", "_tok_miracle", "Purple-Miracle.png"),
    ("cardart", "_tok_smite", "Purple-Smite.png"),
    ("cardart", "_tok_shiv", "Green-Shiv.png"),
    # ===== 背景图测试 =====
    ("bg", "_t_city", "TheCity.png"),
    ("bg", "_t_beyond", "TheBeyond.png"),
    ("bg", "_t_heart", "TheHeart.png"),
    ("bg", "_t_exordium", "TheExordium.png"),
    # ===== 敌人 =====
    ("enemies", "mystic", "DarkPriest.png"),
    ("enemies", "munchkin", "Munchkin.png"),
]

def main():
    ok, miss = 0, []
    for i, (sub, name, fn) in enumerate(TASKS):
        good = dl(sub, name, fn)
        print(f"[{i+1}/{len(TASKS)}] {'OK ' if good else 'MISS'} {sub}/{name} <- {fn}", flush=True)
        ok += good
        if not good: miss.append(f"{sub}/{name}")
        time.sleep(random.uniform(0.6, 1.2))
    print(f"\n=== 成功 {ok}/{len(TASKS)} ===")
    for m in miss: print("  MISS", m)

if __name__ == "__main__":
    main()
