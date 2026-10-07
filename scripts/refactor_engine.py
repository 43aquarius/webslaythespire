#!/usr/bin/env python3
# engine.ts 多人重构 - 机械替换阶段
# combat.player -> AP(combat) / 牌堆与pending移入玩家结构 / fx 'player' -> ptgt(combat)
import re

P = '/home/z/my-project/src/game/engine.ts'
src = open(P).read()
orig = src

# 1) combat.player / combat.<pile> / combat.<pending> / combat.<growth> -> AP(combat).xxx
mech = [
    (r'combat\.player\b', 'AP(combat)'),
    (r'combat\.drawPile\b', 'AP(combat).drawPile'),
    (r'combat\.hand\b', 'AP(combat).hand'),
    (r'combat\.discardPile\b', 'AP(combat).discardPile'),
    (r'combat\.exhaustPile\b', 'AP(combat).exhaustPile'),
    (r'combat\.pendingArmaments\b', 'AP(combat).pendingArmaments'),
    (r'combat\.pendingHeadbutt\b', 'AP(combat).pendingHeadbutt'),
    (r'combat\.pendingTrueGrit\b', 'AP(combat).pendingTrueGrit'),
    (r'combat\.pendingWarcry\b', 'AP(combat).pendingWarcry'),
    (r'combat\.pendingNightmare\b', 'AP(combat).pendingNightmare'),
    (r'combat\.pendingScry\b', 'AP(combat).pendingScry'),
    (r'combat\.scryDiscarded\b', 'AP(combat).scryDiscarded'),
    (r'combat\.rampage\b', 'AP(combat).rampage'),
    (r'combat\.glassKnife\b', 'AP(combat).glassKnife'),
    (r'combat\.clawBonus\b', 'AP(combat).clawBonus'),
]
for pat, rep in mech:
    src = re.sub(pat, rep, src)

# 2) fx 目标 'player' -> ptgt(combat)（仅限有 combat 的 fx 调用）
fx_pats = [
    (r"fx\(combat, '(dmg|shake|heal|block|text|status|buff)', 'player'", r"fx(combat, '\1', ptgt(combat)"),
    (r"fx\(combat, 'text', target === 'player' \? 'player' : target\.uid", r"fx(combat, 'text', target === 'player' ? ptgt(combat) : target.uid"),
    (r"fx\(combat, 'status', target === 'player' \? 'player' : target\.uid", r"fx(combat, 'status', target === 'player' ? ptgt(combat) : target.uid"),
]
for pat, rep in fx_pats:
    src = re.sub(pat, rep, src)

open(P, 'w').write(src)
print('replacements done, changed:', orig != src)
# 统计
import subprocess
print(subprocess.run(['grep', '-c', 'AP(combat)', P], capture_output=True, text=True).stdout)
