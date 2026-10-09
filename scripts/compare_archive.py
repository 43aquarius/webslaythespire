#!/usr/bin/env python3
"""对比 当前项目素材(wiki.gg来源) vs spire-archive原版素材(游戏JAR提取)"""
import os, hashlib
from PIL import Image

CUR = "/home/z/my-project/public/assets"
ARC = "/tmp/spire-archive/public/images/sts1"

def img_info(p):
    try:
        with Image.open(p) as im:
            return f"{im.size[0]}x{im.size[1]} {im.mode}"
    except Exception as e:
        return f"ERR {e}"

def md5(p):
    return hashlib.md5(open(p,'rb').read()).hexdigest()[:10]

# 映射: (当前目录, 当前名, archive目录, archive名)
PAIRS = [
    # 卡框
    ("frames/bannerCommon.png", "cardui/banner_common.png"),
    ("frames/bgAttackRed.png", "cardui/bg_attack_red.png"),
    ("frames/bgSkillRed.png", "cardui/bg_skill_red.png"),
    ("frames/bgPowerRed.png", "cardui/bg_power_red.png"),
    # 卡面
    ("cardart/strike_red.png", "cards/strike_red.png"),
    ("cardart/bash.png", "cards/bash.png"),
    ("cardart/defend_red.png", "cards/defend_red.png"),
    # 状态图标
    ("status/strength.png", "powers/strength.png"),
    ("status/weak.png", "powers/weak.png"),
    ("status/vulnerable.png", "powers/vulnerable.png"),
    # 遗物
    ("relics/burningBlood.png", "relics/burning_blood.png"),
    ("relics/velvetChoker.png", "relics/velvet_choker.png"),
    # 敌人
    ("enemies/jawWorm.png", "monsters/JawWorm.png"),
    ("enemies/slimeBoss.png", "monsters/SlimeBoss.png"),
    # 药水
    ("potions/firePotion.png", "potions/fire_potion.png"),
    # 角色
    ("hero/ironclad.png", "characters/ironclad.jpg"),
]

print(f"{'当前项目':<42} {'spire-archive原版':<40} {'当前':<16} {'原版':<16} 同文件")
print("-" * 135)
for cur_rel, arc_rel in PAIRS:
    cur_p = os.path.join(CUR, cur_rel)
    arc_p = os.path.join(ARC, arc_rel)
    cur_exists = os.path.exists(cur_p)
    arc_exists = os.path.exists(arc_p)
    ci = img_info(cur_p) if cur_exists else "缺失"
    ai = img_info(arc_p) if arc_exists else "缺失"
    same = "√" if (cur_exists and arc_exists and md5(cur_p) == md5(arc_p)) else ""
    print(f"{cur_rel:<42} {arc_rel:<40} {ci:<16} {ai:<16} {same}")

# 扩展对比: archive有而当前缺失/不同的整目录统计
print()
print("=== 目录级对比 ===")
dirs = {
    "cards→cardart": ("cards", "cardart"),
    "powers→status": ("powers", "status"),
    "relics→relics": ("relics", "relics"),
    "monsters→enemies": ("monsters", "enemies"),
    "potions→potions": ("potions", "potions"),
    "events→(无)": ("events", None),
}
for label, (ad, cd) in dirs.items():
    arc_files = {f for f in os.listdir(os.path.join(ARC, ad)) if not f.startswith('.')} if ad else set()
    arc_n = len(arc_files)
    cur_n = len(os.listdir(os.path.join(CUR, cd))) if cd else 0
    print(f"{label}: archive={arc_n} 当前={cur_n}")
