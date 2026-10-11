#!/usr/bin/env python3
"""第二十七批：批量烘焙全部敌人原版 idle 动画 WebP（替换静态立绘）
权威映射（反编译 java loadAnimation/setAnimation 考证）：
  52 sprite 中 50 个为 Spine 动画; bronzeOrb 原版无动画（AbstractMonster 静态 img）→ 单帧;
  hexaghost 非 Spine（纯图合成）→ 单帧; corruptHeart 走 npcs/heart。
烘焙: max_side = min(现有静态 png 最长边, 460) 保持显示尺寸基准;
  帧 n = clamp(ceil(dur*12), 8, 20); quality 70 / alpha 80 / method 6。
体积: 单敌 >260KB 自动降级 q60/mf16 重试。
输出: public/assets/enemies/<sprite>.webp
"""
import json, math, os, sys
sys.path.insert(0, '/home/z/my-project/scripts')
from spine_anim import bake
from PIL import Image

SRC = '/tmp/MySlayTheSpire/src/main/resources/images/monsters'
NPC = '/tmp/MySlayTheSpire/src/main/resources/images/npcs'
OUT = '/home/z/my-project/public/assets/enemies'

# sprite -> (dir, anim, base)
MAP = {
 'acidslimeM': ('theBottom/slimeM', 'idle', 'skeleton'),
 'acidslimeS': ('theBottom/slimeS', 'idle', 'skeleton'),
 'awakenedOne': ('theForest/awakenedOne', 'Idle_1', 'skeleton'),
 'blueSlaver': ('theBottom/blueSlaver', 'idle', 'skeleton'),
 'bookOfStabbing': ('theCity/stabBook', 'Idle', 'skeleton'),
 'bronzeAutomaton': ('theCity/automaton', 'idle', 'skeleton'),
 'byrd': ('theCity/byrd', 'idle_flap', 'flying'),
 'centurion': ('theCity/romeo', 'Idle', 'skeleton'),
 'chosen': ('theCity/chosen', 'Idle', 'skeleton'),
 'corruptHeart': ('HEART', 'idle', 'skeleton'),
 'cultist': ('theBottom/cultist', 'waving', 'skeleton'),
 'dagger': ('theForest/mage_dagger', 'Idle', 'skeleton'),
 'darkling': ('theForest/darkling', 'Idle', 'skeleton'),
 'deca': ('theForest/deca', 'Idle', 'skeleton'),
 'donu': ('theForest/donu', 'Idle', 'skeleton'),
 'fatGremlin': ('theBottom/fatGremlin', 'animation', 'skeleton'),
 'fungibeast': ('theBottom/fungi', 'Idle', 'skeleton'),
 'giantHead': ('theForest/head', 'idle_open', 'skeleton'),
 'greenlouse': ('theBottom/louseGreen', 'idle', 'skeleton'),
 'gremlinLeader': ('theCity/gremlinleader', 'Idle', 'skeleton'),
 'gremlinWizard': ('theBottom/wizardGremlin', 'animation', 'skeleton'),
 'guardian': ('theBottom/boss/guardian', 'idle', 'skeleton'),
 'jawworm': ('theBottom/jawWorm', 'idle', 'skeleton'),
 'lagavulin': ('theBottom/lagavulin', 'Idle_2', 'skeleton'),
 'madGremlin': ('theBottom/angryGremlin', 'idle', 'skeleton'),
 'mystic': ('theCity/healer', 'Idle', 'skeleton'),
 'nemesis': ('theForest/nemesis', 'Idle', 'skeleton'),
 'nob': ('theBottom/nobGremlin', 'animation', 'skeleton'),
 'orbWalker': ('theForest/orbWalker', 'Idle', 'skeleton'),
 'redSlaver': ('theBottom/redSlaver', 'idle', 'skeleton'),
 'redlouse': ('theBottom/louseRed', 'idle', 'skeleton'),
 'reptomancer': ('theCity/reptile', 'Idle', 'skeleton'),
 'repulsor': ('theForest/repulser', 'idle', 'skeleton'),
 'sentry': ('theBottom/sentry', 'idle', 'skeleton'),
 'shieldGremlin': ('theBottom/femaleGremlin', 'idle', 'skeleton'),
 'slimeboss': ('theBottom/boss/slime', 'idle', 'skeleton'),
 'sneakyGremlin': ('theBottom/thiefGremlin', 'animation', 'skeleton'),
 'sphericGuardian': ('theCity/tank', 'Idle', 'skeleton'),
 'spikeSlimeM': ('theBottom/slimeAltM', 'idle', 'skeleton'),
 'spikeSlimeS': ('theBottom/slimeAltS', 'idle', 'skeleton'),
 'spiker': ('theForest/spiker', 'idle', 'skeleton'),
 'spireGrowth': ('theForest/spireGrowth', 'Idle', 'skeleton'),
 'spireShield': ('theEnding/shield', 'Idle', 'skeleton'),
 'spireSpear': ('theEnding/spear', 'Idle', 'skeleton'),
 'taskmaster': ('theCity/slaverMaster', 'idle', 'skeleton'),
 'theChamp': ('theCity/champ', 'Idle', 'skeleton'),
 'theCollector': ('theCity/collector', 'idle', 'skeleton'),
 'timeEater': ('theForest/timeEater', 'Idle', 'skeleton'),
 'transient': ('theForest/transient', 'Idle', 'skeleton'),
 'writhingMass': ('theForest/spaghetti', 'Idle', 'skeleton'),
}
STATIC_ONLY = {'bronzeOrb', 'hexaghost'}  # 原版无动画 → 现有 png 转单帧 webp


def png_side(sprite):
    p = f'{OUT}/{sprite}.png'
    return max(Image.open(p).size) if os.path.exists(p) else 420


def main():
    only = sys.argv[1:] if len(sys.argv) > 1 else None
    rows, total = [], 0
    for sprite in sorted(MAP) + sorted(STATIC_ONLY):
        if only and sprite not in only: continue
        out = f'{OUT}/{sprite}.webp'
        if sprite in STATIC_ONLY:
            Image.open(f'{OUT}/{sprite}.png').save(out, format='WEBP', quality=90, method=6)
            kb = os.path.getsize(out) / 1024
            rows.append((sprite, 'static', 1, f'{kb:.0f}KB'))
            total += kb
            continue
        sd_spec, anim, base = MAP[sprite]
        sd = os.path.join(NPC, 'heart') if sd_spec == 'HEART' else os.path.join(SRC, sd_spec)
        side = min(png_side(sprite), 460)
        try:
            r = bake(sd, out, anim, base=base, fps=12, max_frames=20,
                     max_side=side, quality=70, alpha_quality=80)
        except Exception as e:
            rows.append((sprite, 'ERROR', 0, str(e)[:60]))
            continue
        if r['kb'] > 260:  # 体积降级重试
            r = bake(sd, out, anim, base=base, fps=12, max_frames=16,
                     max_side=side, quality=60, alpha_quality=70)
            r['downgraded'] = True
        total += r['kb']
        rows.append((sprite, anim, r['frames'], f"{r['kb']:.0f}KB {r['size']}" + (' 降级' if r.get('downgraded') else '')))
    for row in rows:
        print(f"{row[0]:18s} {row[1]:14s} {str(row[2]):>3s}f  {row[3]}")
    errs = [r for r in rows if r[1] == 'ERROR']
    print(f"\n合计 {len(rows)} 敌, {total/1024:.2f} MB, 失败 {len(errs)}")


if __name__ == '__main__':
    main()
