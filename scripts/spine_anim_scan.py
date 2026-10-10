#!/usr/bin/env python3
"""第二十七批预研：提取 52 敌人权威 idle 动画名/scale/时长/deform/drawOrder 占比"""
import os, json, subprocess, re

SRC = '/tmp/MySlayTheSpire/src/main/resources/images/monsters'
JAVA = '/tmp/MySlayTheSpire/src/main/java/com/megacrit/cardcrawl/monsters'

CLS = {
 'acidslimeM':'AcidSlime_M','acidslimeS':'AcidSlime_S','awakenedOne':'AwakenedOne',
 'blueSlaver':'SlaverBlue','bookOfStabbing':'BookOfStabbing','bronzeAutomaton':'BronzeAutomaton',
 'bronzeOrb':'BronzeOrb','byrd':'Byrd','centurion':'Centurion','chosen':'Chosen','cultist':'Cultist',
 'dagger':'Dagger','darkling':'Darkling','deca':'Deca','donu':'Donu','fatGremlin':'GremlinFat',
 'fungibeast':'FungiBeast','giantHead':'GiantHead','greenlouse':'LouseDefensive',
 'gremlinLeader':'GremlinLeader','gremlinWizard':'GremlinWizard','guardian':'TheGuardian',
 'jawworm':'JawWorm','lagavulin':'Lagavulin','madGremlin':'GremlinMad','mystic':'Mystic',
 'nemesis':'Nemesis','nob':'GremlinNob','orbWalker':'OrbWalker','redSlaver':'SlaverRed',
 'redlouse':'LouseNormal','reptomancer':'Reptomancer','repulsor':'Repulsor','sentry':'Sentry',
 'shieldGremlin':'GremlinShield','slimeboss':'SlimeBoss','sneakyGremlin':'GremlinSneaky',
 'sphericGuardian':'SphericGuardian','spikeSlimeM':'SpikeSlime_M','spikeSlimeS':'SpikeSlime_S',
 'spiker':'Spiker','spireGrowth':'SpireGrowth','spireShield':'SpireShield','spireSpear':'SpireSpear',
 'taskmaster':'Taskmaster','theChamp':'TheChamp','theCollector':'TheCollector','timeEater':'TimeEater',
 'transient':'Transient','writhingMass':'WrithingMass',
}
SPINE_MAP = {
 'acidslimeM':'theBottom/slimeM','acidslimeS':'theBottom/slimeS','awakenedOne':'theForest/awakenedOne',
 'blueSlaver':'theBottom/blueSlaver','bookOfStabbing':'theCity/bookOfStabbing','bronzeAutomaton':'theCity/automaton',
 'bronzeOrb':'theCity/sphere','byrd':'theCity/byrd','centurion':'theCity/romeo','chosen':'theCity/chosen',
 'cultist':'theBottom/cultist','dagger':'theForest/mage_dagger','darkling':'theForest/darkling',
 'deca':'theForest/deca','donu':'theForest/donu','fatGremlin':'theBottom/fatGremlin',
 'fungibeast':'theBottom/fungi','giantHead':'theForest/head','greenlouse':'theBottom/louseGreen',
 'gremlinLeader':'theCity/gremlinleader','gremlinWizard':'theBottom/wizardGremlin','guardian':'theBottom/boss/guardian',
 'jawworm':'theBottom/jawWorm','lagavulin':'theBottom/lagavulin','madGremlin':'theBottom/angryGremlin',
 'mystic':'theCity/healer','nemesis':'theForest/nemesis','nob':'theBottom/nobGremlin','orbWalker':'theForest/orbWalker',
 'redSlaver':'theBottom/redSlaver','redlouse':'theBottom/louseRed','reptomancer':'theCity/reptile',
 'repulsor':'theForest/repulser','sentry':'theBottom/sentry','shieldGremlin':'theBottom/femaleGremlin',
 'slimeboss':'theBottom/boss/slime','sneakyGremlin':'theBottom/thiefGremlin','sphericGuardian':'theCity/tank',
 'spikeSlimeM':'theBottom/slimeAltM','spikeSlimeS':'theBottom/slimeAltS','spiker':'theForest/spiker',
 'spireGrowth':'theForest/spireGrowth','spireShield':'theEnding/shield','spireSpear':'theEnding/spear',
 'taskmaster':'theCity/slaverMaster','theChamp':'theCity/champ','theCollector':'theCity/collector',
 'timeEater':'theForest/timeEater','transient':'theForest/transient','writhingMass':'theForest/spaghetti',
}

def find_java(cls):
    p = subprocess.run(['find', JAVA, '-name', cls + '.java'], capture_output=True, text=True).stdout.strip().splitlines()
    return p[0] if p else None

def anim_len(av):
    t = 0
    for ch in ('bones', 'slots'):
        for tgt, tls in av.get(ch, {}).items():
            if isinstance(tls, dict):
                for tlk, tl in tls.items():
                    for k in tl:
                        if 'time' in k: t = max(t, k['time'])
    for do in av.get('drawOrder', []):
        if 'time' in do: t = max(t, do['time'])
    for sk, slots in av.get('deform', {}).items():
        for sl, atts in slots.items():
            for at, tls in atts.items():
                for k in tls:
                    if 'time' in k: t = max(t, k['time'])
    return t

nd = nmiss = 0
rows = []
for sprite in sorted(CLS):
    cls = CLS[sprite]
    jf = find_java(cls)
    anim = atlas = scale = None
    if jf:
        txt = open(jf, encoding='utf-8', errors='ignore').read()
        ma = re.findall(r'loadAnimation\("([^"]+)"\s*,\s*"([^"]+)"\s*,\s*([\d.]+)F', txt)
        ms = re.findall(r'setAnimation\(0,\s*"([^"]+)",\s*true', txt)
        if ma:
            atlas, scale = ma[0][0], float(ma[0][2])
        if ms:
            anim = ms[0]
    sd = SPINE_MAP.get(sprite)
    base = 'skeleton'
    if sprite == 'byrd': base = 'flying'
    L, dflag, dof, info = None, '', '', ''
    if anim and sd:
        try:
            d = json.load(open(f'{SRC}/{sd}/{base}.json'))
            av = d['animations'][anim]
            L = anim_len(av)
            dflag = 'DEFORM' if 'deform' in av else ''
            dof = 'DRAWORDER' if 'drawOrder' in av else ''
            if dflag: nd += 1
            info = f'{L:6.2f}'
        except KeyError:
            info = 'ANIM_NOT_FOUND'
            nmiss += 1
    else:
        info = 'NO_JAVA_OR_ANIM' if not anim else 'NO_SPINE_DIR'
        nmiss += 1
    rows.append((sprite, anim, scale, info, dflag, dof))

print(f"{'sprite':18s} {'anim':16s} {'scale':5s} {'len':>6s}  flags")
for r in rows:
    print(f"{r[0]:18s} {str(r[1]):16s} {str(r[2]):5s} {r[3]:6s}  {r[4]} {r[5]}")
print("\nidle 带 deform:", nd, " 缺失:", nmiss)
