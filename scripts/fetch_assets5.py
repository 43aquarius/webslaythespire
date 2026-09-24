#!/usr/bin/env python3
"""大规模素材下载：三新角色 + 涅奥 + Act2/3/4怪物 + 卡面 + 卡框/能量球/图标"""
import hashlib
import subprocess
import os
import json
import urllib.parse
from concurrent.futures import ThreadPoolExecutor

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36"
BASE = "https://slaythespire.wiki.gg/images"
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
    if os.path.exists(outpath) and os.path.getsize(outpath) > 300:
        return (task, True, os.path.getsize(outpath))
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

# ============ 英雄 ============
for k, f in [("ironclad", "Ironclad.png"), ("silent", "Silent.png"),
             ("defect", "Defect.png"), ("watcher", "Watcher.png")]:
    tasks.append(("hero", k, f))

# ============ 涅奥 ============
tasks.append(("neow", "neow", "Neow.png"))

# ============ 卡框/能量球（绿蓝紫） ============
FRAMES = {
    "bgAttackGreen": "BgAttackGreen.png", "bgSkillGreen": "BgSkillGreen.png", "bgPowerGreen": "BgPowerGreen.png",
    "bgAttackBlue": "BgAttackBlue.png", "bgSkillBlue": "BgSkillBlue.png", "bgPowerBlue": "BgPowerBlue.png",
    "bgAttackPurple": "BgAttackPurple.png", "bgSkillPurple": "BgSkillPurple.png", "bgPowerPurple": "BgPowerPurple.png",
    "cardGreenOrb": "CardGreenOrb.png", "cardBlueOrb": "CardBlueOrb.png", "cardPurpleOrb": "CardPurpleOrb.png",
    "greenEnergy": "GreenEnergy.png", "blueEnergy": "BlueEnergy.png", "purpleEnergy": "PurpleEnergy.png",
}
for k, f in FRAMES.items():
    tasks.append(("frames", k, f))

# ============ 类型小图标 ============
for char in ["Silent", "Defect", "Watcher"]:
    for typ in ["Attack", "Skill", "Power"]:
        for rar in ["Common", "Uncommon", "Rare"]:
            tasks.append(("typeicons", f"{char.lower()}{typ}{rar}", f"CardIcon_{char}_{typ}_{rar}.png"))

# ============ Act2/3/4 怪物 ============
MONSTERS = {
    # Act 2 普通
    "byrd": "Byrd.png", "chosen": "Chosen.png", "centurion": "Centurion.png", "mystic": "DarkPriest.png",
    "madGremlin": "GremlinHorn.png", "fatGremlin": "GremlinFat.png", "gremlinWizard": "GremlinWizard.png",
    "shieldGremlin": "GremlinTsundere.png", "sneakyGremlin": "GremlinThief.png",
    "redSlaver": "SlaverRed.png", "blueSlaver": "SlaverBlue.png",
    "sphericGuardian": "SphericGuardian.png", "munchkin": "Munchkin.png",
    # Act 2 精英
    "gremlinLeader": "GremlinLeader.png", "bookOfStabbing": "BookOfStabbing.png", "taskmaster": "Taskmaster.png",
    # Act 2 Boss
    "bronzeAutomaton": "BronzeAutomaton.png", "bronzeOrb": "BronzeOrb.png",
    "theCollector": "TheCollector.png", "theChamp": "Champ.png",
    # Act 3 普通
    "spiker": "Spiker.png", "repulsor": "Repulsor.png", "orbWalker": "OrbWalker.png",
    "writhingMass": "WrithingMass.png", "spireGrowth": "SpireGrowth.png",
    "transient": "Transient.png", "darkling": "Darkling.png",
    # Act 3 精英
    "giantHead": "GiantHead.png", "nemesis": "Nemesis.png", "reptomancer": "Reptomancer.png",
    "dagger": "Dagger.png",
    # Act 3 Boss
    "awakenedOne": "AwakenedOne.png", "timeEater": "TimeEater.png", "donu": "Donu.png", "deca": "Deca.png",
    # Act 4
    "spireShield": "SpireShield.png", "spireSpear": "SpireSpear.png", "corruptHeart": "CorruptHeart.png",
}
for k, f in MONSTERS.items():
    tasks.append(("enemies", k, f))

# ============ 新状态图标 ============
STATUS = {
    "focus": "Icon Focus.png", "wrath": "Icon Wrath.png", "calm": "Icon Calm.png",
    "divinity": "Icon Divinity.png", "intangible": "Icon Intangible.png",
    "lockOn": "Icon Lock-on.png", "mark": "Icon Mark.png", "mantra": "Icon Mantra.png",
    "constricted": "Icon Constricted.png", "theBomb": "Icon The Bomb.png",
    "hex": "Icon Hex.png", "flying": "Icon Flying.png", "time": "Icon Time.png",
    "beatOfDeath": "Icon Beat of Death.png", "infiniteBlades": "Icon Infinite Blades.png",
    "afterImage": "Icon After Image.png", "noxiousFumes": "Icon Noxious Fumes.png",
    "envenom": "Icon Envenom.png", "phasing": "Icon Phasing.png", "equilibrium": "Icon Equilibrium.png",
    "mentalFortress": "Icon Mental Fortress.png", "likeWater": "Icon Like Water.png",
    "nirvana": "Icon Nirvana.png", "devotion": "Icon Devotion.png", "brilliance": "Icon Brilliance.png",
    "masterReality": "Icon Master Reality.png", " establishment": "Icon Establishment.png",
    "loop": "Icon Loop.png", "staticDischarge": "Icon Static Discharge.png", "storm": "Icon Storm.png",
    "accuracy": "Icon Accuracy.png", "caltrops": "Icon Caltrops.png", "aThousandCuts": "Icon A Thousand Cuts.png",
    "echo": "Icon Echo.png", "amplify": "Icon Amplify.png", "heatsinks": "Icon Heatsinks.png",
    "berserk": "Icon Berserk.png", "rebirth": "Icon Rebirth.png", "shackle": "Icon Shackle.png",
    "dexterityLoss": "Icon Dexterity.png",
}
for k, f in STATUS.items():
    tasks.append(("status", k.strip(), f))

# ============ 新药水 ============
POTIONS = {
    "poisonPotion": "Poison Potion.png", "ghostInAJar": "Ghost In A Jar.png",
    "liquidBronze": "Liquid Bronze.png", "cultistPotion": "Cultist Potion.png",
    "sneckoOil": "Snecko Oil.png", "essenceOfSteel": "Essence of Steel.png",
}
for k, f in POTIONS.items():
    tasks.append(("potions", k, f))

# ============ 新遗物 ============
RELICS = {
    "ringOfTheSnake": "Ring of the Snake.png", "crackedCore": "Cracked Core.png",
    "pureWater": "Pure Water.png", "tungstenRod": "Tungsten Rod.png",
    "oddlySmoothStone": "Oddly Smooth Stone.png", "ginger": "Ginger.png",
    "turnip": "Turnip.png", "dataDisk": "Data Disk.png", "Kunai2": "Kunai.png",
}
for k, f in RELICS.items():
    tasks.append(("relics", k, f))

# ============ 背景图（各幕） ============
BGS = {
    "combat2": "TheCity.png", "combat3": "Beyond.png", "combat4": "TheHeart.png",
    "map1": "Exordium.png",
}
for k, f in BGS.items():
    tasks.append(("bg", k, f))

# ============ 卡面（三角色） ============
SILENT_ART = {
    "strikeG": "Green-Strike-Art.png", "defendG": "Green-Defend-Art.png",
    "neutralize": "Green-Neutralize-Art.png", "survivor": "Green-Survivor-Art.png",
    "bladeDance": "Green-BladeDance-Art.png", "cloakAndDagger": "Green-CloakAndDagger-Art.png",
    "daggerSpray": "Green-DaggerSpray-Art.png", "daggerThrow": "Green-DaggerThrow-Art.png",
    "deadlyPoison": "Green-DeadlyPoison-Art.png", "deflect": "Green-Deflect-Art.png",
    "dodgeAndRoll": "Green-DodgeAndRoll-Art.png", "flyingKnee": "Green-FlyingKnee-Art.png",
    "outmaneuver": "Green-Outmaneuver-Art.png", "poisonedStab": "Green-PoisonedStab-Art.png",
    "prepared": "Green-Prepared-Art.png", "slice": "Green-Slice-Art.png",
    "sneakyStrike": "Green-SneakyStrike-Art.png", "suckerPunch": "Green-SuckerPunch-Art.png",
    "accuracy": "Green-Accuracy-Art.png", "acrobatics": "Green-Acrobatics-Art.png",
    "backflip": "Green-Backflip-Art.png", "bane": "Green-Bane-Art.png",
    "bouncingBlade": "Green-BouncingBlade-Art.png", "calculatedGamble": "Green-CalculatedGamble-Art.png",
    "caltrops": "Green-Caltrops-Art.png", "catalyst": "Green-Catalyst-Art.png",
    "chumpBlocker": "Green-ChumpBlocker-Art.png", "concentrate": "Green-Concentrate-Art.png",
    "dash": "Green-Dash-Art.png", "distraction": "Green-Distraction-Art.png",
    "endlessAgony": "Green-EndlessAgony-Art.png", "eviscerate": "Green-Eviscerate-Art.png",
    "expertise": "Green-Expertise-Art.png", "finisher": "Green-Finisher-Art.png",
    "footwork": "Green-Footwork-Art.png", "heelHook": "Green-HeelHook-Art.png",
    "legSweep": "Green-LegSweep-Art.png", "predator": "Green-Predator-Art.png",
    "reflex": "Green-Reflex-Art.png", "terror": "Green-Terror-Art.png",
    "aThousandCuts": "Green-AThousandCuts-Art.png", "adrenaline": "Green-Adrenaline-Art.png",
    "afterImage": "Green-AfterImage-Art.png", "burst": "Green-Burst-Art.png",
    "corpseExplosion": "Green-CorpseExplosion-Art.png", "dieDieDie": "Green-DieDieDie-Art.png",
    "envenom": "Green-Envenom-Art.png", "glassKnife": "Green-GlassKnife-Art.png",
    "grandFinale": "Green-GrandFinale-Art.png", "nightmare": "Green-Nightmare-Art.png",
    "phantasmalKiller": "Green-PhantasmalKiller-Art.png", "stormOfSteel": "Green-StormOfSteel-Art.png",
    "wraithForm": "Green-WraithForm-Art.png", "shiv": "Green-Shiv-Art.png",
}
DEFECT_ART = {
    "strikeB": "Blue-Strike-Art.png", "defendB": "Blue-Defend-Art.png",
    "zap": "Blue-Zap-Art.png", "dualcast": "Blue-Dualcast-Art.png",
    "ballLightning": "Blue-BallLightning-Art.png", "barrage": "Blue-Barrage-Art.png",
    "beamCell": "Blue-BeamCell-Art.png", "claw": "Blue-Claw-Art.png",
    "coldSnap": "Blue-ColdSnap-Art.png", "compileDriver": "Blue-CompileDriver-Art.png",
    "goForTheEyes": "Blue-GofortheEyes-Art.png", "hologram": "Blue-Hologram-Art.png",
    "leap": "Blue-Leap-Art.png", "reprogram": "Blue-Reprogram-Art.png",
    "sweepBeam": "Blue-SweepBeam-Art.png",
    "autoShields": "Blue-Auto-Shields-Art.png", "blizzard": "Blue-Blizzard-Art.png",
    "capacitor": "Blue-Capacitor-Art.png", "chargeBattery": "Blue-ChargeBattery-Art.png",
    "chill": "Blue-Chill-Art.png", "consume": "Blue-Consume-Art.png",
    "darkness": "Blue-Darkness-Art.png", "defragment": "Blue-Defragment-Art.png",
    "doomAndGloom": "Blue-DoomandGloom-Art.png", "equilibrium": "Blue-Equilibrium-Art.png",
    "glacier": "Blue-Glacier-Art.png", "loop": "Blue-Loop-Art.png",
    "melter": "Blue-Melter-Art.png", "overclock": "Blue-Overclock-Art.png",
    "skim": "Blue-Skim-Art.png", "staticDischarge": "Blue-StaticDischarge-Art.png",
    "storm": "Blue-Storm-Art.png", "tempest": "Blue-Tempest-Art.png",
    "whiteNoise": "Blue-WhiteNoise-Art.png",
    "allForOne": "Blue-AllforOne-Art.png", "amplify": "Blue-Amplify-Art.png",
    "chainLightning": "Blue-ChainLightning-Art.png", "coreSurge": "Blue-CoreSurge-Art.png",
    "creativeAI": "Blue-CreativeAI-Art.png", "echoForm": "Blue-EchoForm-Art.png",
    "hyperbeam": "Blue-Hyperbeam-Art.png", "machineLearning": "Blue-MachineLearning-Art.png",
    "meteorStrike": "Blue-MeteorStrike-Art.png", "multiCast": "Blue-MultiCast-Art.png",
    "rainbow": "Blue-Rainbow-Art.png", "reboot": "Blue-Reboot-Art.png",
    "seek": "Blue-Seek-Art.png", "thunderStrike": "Blue-ThunderStrike-Art.png",
    "void": "Blue-Fusion-Art.png",
}
WATCHER_ART = {
    "strikeP": "Purple-Strike-Art.png", "defendP": "Purple-Defend-Art.png",
    "eruption": "Purple-Eruption-Art.png", "vigilance": "Purple-Vigilance-Art.png",
    "bowlingBash": "Purple-BowlingBash-Art.png", "consecration": "Purple-Consecration-Art.png",
    "crushJoint": "Purple-CrushJoint-Art.png", "cutThroughFate": "Purple-CutThroughFate-Art.png",
    "emptyFist": "Purple-EmptyFist-Art.png", "flyingSleeves": "Purple-FlyingSleeves-Art.png",
    "followUp": "Purple-Follow-Up-Art.png", "foresight": "Purple-Foresight-Art.png",
    "halt": "Purple-Halt-Art.png", "justLucky": "Purple-JustLucky-Art.png",
    "pressurePoints": "Purple-PressurePoints-Art.png", "prostrate": "Purple-Prostrate-Art.png",
    "protect": "Purple-Protect-Art.png", "tranquility": "Purple-Tranquility-Art.png",
    "emptyBody": "Purple-EmptyBody-Art.png",
    "carveReality": "Purple-CarveReality-Art.png", "conclude": "Purple-Conclude-Art.png",
    "emptyMind": "Purple-EmptyMind-Art.png", "fasting": "Purple-Fasting-Art.png",
    "fearNoEvil": "Purple-FearNoEvil-Art.png", "indignation": "Purple-Indignation-Art.png",
    "innerPeace": "Purple-InnerPeace-Art.png", "likeWater": "Purple-LikeWater-Art.png",
    "mentalFortress": "Purple-MentalFortress-Art.png", "nirvana": "Purple-Nirvana-Art.png",
    "sanctity": "Purple-Sanctity-Art.png", "tantrum": "Purple-Tantrum-Art.png",
    "wallop": "Purple-Wallop-Art.png", "waveOfTheHand": "Purple-WaveoftheHand-Art.png",
    "weave": "Purple-Weave-Art.png", "wheelKick": "Purple-WheelKick-Art.png",
    "alpha": "Purple-Alpha-Art.png", "blasphemy": "Purple-Blasphemy-Art.png",
    "brilliance": "Purple-Brilliance-Art.png", "devotion": "Purple-Devotion-Art.png",
    "omniscience": "Purple-Omniscience-Art.png", "scrawl": "Purple-Scrawl-Art.png",
    "spiritShield": "Purple-SpiritShield-Art.png", "vault": "Purple-Vault-Art.png",
    "wish": "Purple-Wish-Art.png", "smite": "Purple-Smite-Art.png",
    "miracle": "Purple-Miracle-Art.png", "beta": "Purple-Beta-Art.png", "omega": "Purple-Omega-Art.png",
}
for art_map in (SILENT_ART, DEFECT_ART, WATCHER_ART):
    for k, f in art_map.items():
        tasks.append(("cardart", k, f))

def main():
    ok, miss = 0, []
    with ThreadPoolExecutor(max_workers=10) as ex:
        for (task, good, size) in ex.map(download, tasks):
            subdir, out_name, fn = task
            if good:
                ok += 1
            else:
                miss.append(f"{subdir}/{out_name} <- {fn}")
    print(f"成功 {ok}/{len(tasks)}, 失败 {len(miss)}")
    for m in miss:
        print("  MISS", m)
    with open("/tmp/fetch_miss.json", "w") as f:
        json.dump(miss, f, ensure_ascii=False, indent=1)

if __name__ == "__main__":
    main()
