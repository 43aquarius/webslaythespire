#!/usr/bin/env python3
"""StS 素材主下载脚本：怪物/意图/状态图标/遗物/药水/卡牌插画/卡牌框架"""
import hashlib
import subprocess
import os
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
    if os.path.exists(outpath) and os.path.getsize(outpath) > 500:
        return (task, True, -1)  # 已存在
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

# ============ 怪物精灵图 ============
MONSTERS = {
    "redlouse": "RedLouse.png", "greenlouse": "GreenLouse.png",
    "fungibeast": "FungiBeast.png", "acidslimeS": "AcidSlimeS.png",
    "acidslimeM": "AcidSlimeM.png", "spikeSlimeS": "SpikeSlimeS.png",
    "spikeSlimeM": "SpikeSlimeM.png", "nob": "GremlinNob.png",
    "slimeboss": "SlimeBoss.png", "guardian": "TheGuardian.png",
}
for k, f in MONSTERS.items():
    tasks.append(("enemies", k, f))

# ============ 意图图标 ============
INTENTS = {
    "attack": "Intent Attack.png", "attack2": "Intent Attack2.png",
    "attack3": "Intent Attack3.png", "attack4": "Intent Attack4.png",
    "attack5": "Intent Attack5.png", "attack6": "Intent Attack6.png",
    "attack7": "Intent Attack7.png", "attackDebuff": "Intent AttackDebuff.png",
    "attackDebuff2": "Intent AttackDebuff2.png", "attackDefend": "Intent AttackDefend.png",
    "defend": "Intent Defend.png", "defend2": "Intent Defend2.png",
    "buff": "Intent Buff.png", "debuff": "Intent Debuff.png",
    "debuff2": "Intent Debuff2.png", "debuffStrong": "Intent DebuffStrong.png",
    "sleep": "Intent Sleep.png", "sleep2": "Intent Sleep2.png",
    "unknown": "Intent Unknown.png", "unknown2": "Intent Unknown2.png",
    "stun": "Intent Stun.png", "escape": "Intent Escape.png",
}
for k, f in INTENTS.items():
    tasks.append(("intent", k, f))

# ============ 状态图标 ============
STATUS_ICONS = {
    "strength": "Icon Strength.png", "dexterity": "Icon Dexterity.png",
    "vulnerable": "Icon Vulnerable.png", "weak": "Icon Weak.png",
    "frail": "Icon Frail.png", "thorns": "Icon Thorns.png",
    "artifact": "Icon Artifact.png", "metallicize": "Icon Metallicize.png",
    "ritual": "Icon Ritual.png", "regen": "Icon Regen.png",
    "poison": "Icon Poison.png", "anger": "Icon Anger.png",
    "brutality": "Icon Brutality.png", "combust": "Icon Combust.png",
    "corruption": "Icon Corruption.png", "darkEmbrace": "Icon Dark Embrace.png",
    "demonForm": "Icon Demon Form.png", "evolve": "Icon Evolve.png",
    "feelNoPain": "Icon Feel No Pain.png", "fireBreathing": "Icon Fire Breathing.png",
    "flameBarrier": "Icon Flame Barrier.png", "juggernaut": "Icon Juggernaut.png",
    "rage": "Icon Rage.png", "rupture": "Icon Rupture.png",
    "berserk": "Icon Berserk.png", "doubleTap": "Icon Double Tap.png",
    "entrench": "Icon Entrench.png", "barricade": "Icon Barricade.png",
    "noDraw": "Icon No Draw.png", "modeShift": "Icon ModeShift.png",
    "angry": "Icon Angry.png", "curlUp": "Icon CurlUp.png",
    "sporeCloud": "Icon SporeCloud.png", "split": "Icon Split.png",
    "stasis": "Icon Stasis.png", "sharpHide": "Icon SharpHide.png",
    "block": "Icon Block.png", "metallicizeE": "Icon Metallicize (monster).png",
}
for k, f in STATUS_ICONS.items():
    tasks.append(("status", k, f))

# ============ 遗物图标 ============
RELIC_FILES = {
    "burningBlood": "BurningBlood.png", "vajra": "Vajra.png", "anchor": "Anchor.png",
    "bagOfMarbles": "BagofMarbles.png", "lantern": "Lantern.png",
    "bagOfPreparation": "BagofPreparation.png", "bronzeScales": "BronzeScales.png",
    "centennialPuzzle": "CentennialPuzzle.png", "warPaint": "WarPaint.png",
    "whetstone": "Whetstone.png", "smoothlyStone": "OddlySmoothStone.png",
    "preservedInsect": "PreservedInsect.png", "goldenIdol": "GoldenIdol.png",
    "meatOnTheBone": "MeatOnTheBone.png", "bloodVial": "BloodVial.png",
    "kunai": "Kunai.png", "shuriken": "Shuriken.png",
    "ornamentalFan": "OrnamentalFan.png", "penNib": "PenNib.png",
    "sundial": "Sundial.png", "ectoplasm": "Ectoplasm.png", "sozu": "Sozu.png",
    "velvetChoker": "VelvetChoker.png", "philosophersStone": "PhilosophersStone.png",
    "coffeeDripper": "CoffeeDripper.png", "bustedCrown": "BustedCrown.png",
}
for k, f in RELIC_FILES.items():
    tasks.append(("relics", k, f))

# ============ 药水图标 ============
POTION_FILES = {
    "firePotion": "FirePotion.png", "blockPotion": "BlockPotion.png",
    "strengthPotion": "StrengthPotion.png", "dexterityPotion": "DexterityPotion.png",
    "energyPotion": "EnergyPotion.png", "explosivePotion": "ExplosivePotion.png",
    "fearPotion": "FearPotion.png", "weakPotion": "WeakPotion.png",
    "swiftPotion": "SwiftPotion.png", "bloodPotion": "BloodPotion.png",
    "fruitJuice": "FruitJuice.png", "skillPotion": "SkillPotion.png",
    "fairyInBottle": "FairyInBottle.png", "attackPotion": "AttackPotion.png",
}
for k, f in POTION_FILES.items():
    tasks.append(("potions", k, f))

# ============ 卡牌插画 ============
CARD_ART = {
    "strike": "Red-Strike-Art.png", "defend": "Red-Defend-Art.png", "bash": "Red-Bash-Art.png",
    "anger": "Red-Anger-Art.png", "armaments": "Red-Armaments-Art.png",
    "bodySlam": "Red-BodySlam-Art.png", "clash": "Red-Clash-Art.png",
    "cleave": "Red-Cleave-Art.png", "clothesline": "Red-Clothesline-Art.png",
    "flex": "Red-Flex-Art.png", "headbutt": "Red-Headbutt-Art.png",
    "ironWave": "Red-IronWave-Art.png", "pommelStrike": "Red-PommelStrike-Art.png",
    "perfectedStrike": "Red-PerfectedStrike-Art.png", "searingBlow": "Red-SearingBlow-Art.png",
    "shrugItOff": "Red-ShrugItOff-Art.png", "spotWeakness": "Red-SpotWeakness-Art.png",
    "swordBoomerang": "Red-SwordBoomerang-Art.png", "thunderclap": "Red-Thunderclap-Art.png",
    "trueGrit": "Red-TrueGrit-Art.png", "twinStrike": "Red-TwinStrike-Art.png",
    "warcry": "Red-Warcry-Art.png", "wildStrike": "Red-WildStrike-Art.png",
    "heavyBlade": "Red-HeavyBlade-Art.png", "inflame": "Red-Inflame-Art.png",
    "battleTrance": "Red-BattleTrance-Art.png", "bloodForBlood": "Red-BloodforBlood-Art.png",
    "carnage": "Red-Carnage-Art.png", "dropkick": "Red-Dropkick-Art.png",
    "hemokinesis": "Red-Hemokinesis-Art.png", "pummel": "Red-Pummel-Art.png",
    "rampage": "Red-Rampage-Art.png", "recklessCharge": "Red-RecklessCharge-Art.png",
    "uppercut": "Red-Uppercut-Art.png", "whirlwind": "Red-Whirlwind-Art.png",
    "disarm": "Red-Disarm-Art.png", "entrench": "Red-Entrench-Art.png",
    "feelNoPain": "Red-FeelNoPain-Art.png", "fireBreathing": "Red-FireBreathing-Art.png",
    "flameBarrier": "Red-FlameBarrier-Art.png", "ghostlyArmor": "Red-GhostlyArmor-Art.png",
    "intimidate": "Red-Intimidate-Art.png", "powerThrough": "Red-PowerThrough-Art.png",
    "rage": "Red-Rage-Art.png", "secondWind": "Red-SecondWind-Art.png",
    "seeingRed": "Red-SeeingRed-Art.png", "sentinel": "Red-Sentinel-Art.png",
    "shockwave": "Red-Shockwave-Art.png", "combust": "Red-Combust-Art.png",
    "darkEmbrace": "Red-DarkEmbrace-Art.png", "evolve": "Red-Evolve-Art.png",
    "metallicize": "Red-Metallicize-Art.png", "rupture": "Red-Rupture-Art.png",
    "bludgeon": "Red-Bludgeon-Art.png", "feed": "Red-Feed-Art.png",
    "fiendFire": "Red-FiendFire-Art.png", "immolate": "Red-Immolate-Art.png",
    "reaper": "Red-Reaper-Art.png", "impervious": "Red-Impervious-Art.png",
    "barricade": "Red-Barricade-Art.png", "berserk": "Red-Berserk-Art.png",
    "brutality": "Red-Brutality-Art.png", "corruption": "Red-Corruption-Art.png",
    "demonForm": "Red-DemonForm-Art.png", "doubleTap": "Red-DoubleTap-Art.png",
    "juggernaut": "Red-Juggernaut-Art.png", "limitBreak": "Red-LimitBreak-Art.png",
    "offering": "Red-Offering-Art.png",
    "wound": "Wound.png", "dazed": "Dazed.png", "burn": "Burn.png", "slimed": "Slimed.png",
}
for k, f in CARD_ART.items():
    tasks.append(("cardart", k, f))

# ============ 卡牌框架/UI ============
FRAMES = {
    "frameAttackCommon": "FrameAttackCommon.png", "frameAttackUncommon": "FrameAttackUncommon.png",
    "frameAttackRare": "FrameAttackRare.png", "frameSkillCommon": "FrameSkillCommon.png",
    "frameSkillUncommon": "FrameSkillUncommon.png", "frameSkillRare": "FrameSkillRare.png",
    "framePowerCommon": "FramePowerCommon.png", "framePowerUncommon": "FramePowerUncommon.png",
    "framePowerRare": "FramePowerRare.png",
    "bannerCommon": "BannerCommon.png", "bannerUncommon": "BannerUncommon.png",
    "bannerRare": "BannerRare.png",
    "bgAttackRed": "BgAttackRed.png", "bgSkillRed": "BgSkillRed.png", "bgPowerRed": "BgPowerRed.png",
    "cardRedOrb": "CardRedOrb.png", "redEnergy": "RedEnergy.png",
    "cardBack": "CardBack.png", "cardBgRed": "CardBgRed.png",
}
for k, f in FRAMES.items():
    tasks.append(("frames", k, f))

# ============ 类型小图标 ============
TYPE_ICONS = {
    "attackCommon": "CardIcon Ironclad Attack Common.png",
    "attackUncommon": "CardIcon Ironclad Attack Uncommon.png",
    "attackRare": "CardIcon Ironclad Attack Rare.png",
    "skillCommon": "CardIcon Ironclad Skill Common.png",
    "skillUncommon": "CardIcon Ironclad Skill Uncommon.png",
    "skillRare": "CardIcon Ironclad Skill Rare.png",
    "powerCommon": "CardIcon Ironclad Power Common.png",
    "powerUncommon": "CardIcon Ironclad Power Uncommon.png",
    "powerRare": "CardIcon Ironclad Power Rare.png",
    "status": "CardIcon Status.png",
}
for k, f in TYPE_ICONS.items():
    tasks.append(("typeicons", k, f))

def main():
    print(f"总任务数: {len(tasks)}")
    ok, miss, cached = 0, [], 0
    with ThreadPoolExecutor(max_workers=12) as ex:
        for (task, good, size) in ex.map(download, tasks):
            subdir, out_name, fn = task
            if good and size == -1:
                cached += 1
            elif good:
                ok += 1
            else:
                miss.append(f"{subdir}/{out_name} <- {fn}")
    print(f"新下载: {ok}, 已缓存: {cached}, 失败: {len(miss)}")
    print("===== 缺失清单 =====")
    for m in miss:
        print("  MISS", m)

if __name__ == "__main__":
    main()
