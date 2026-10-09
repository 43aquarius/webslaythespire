#!/usr/bin/env python3
"""第18批: 安装原版SFX音效(Next.js q原样 + standalone低码率) + 各幕BGM转码"""
import os, shutil, subprocess, json

SRC = "/tmp/MySlayTheSpire/src/main/resources/audio/sound"
SRC_MUSIC = "/tmp/newmusic"
NEXT = "/home/z/my-project/public/assets"
STAND = "/home/z/my-project/scripts/standalone"

os.makedirs(f"{NEXT}/sfx", exist_ok=True)
os.makedirs(f"{STAND}/audio", exist_ok=True)

# 本游戏事件 → 原版SoundMaster键 (键名→[文件] 或 变体组)
SFX_MAP = {
    # 战斗开始
    'battleStart':      ['STS_SFX_BattleStart_1_v1.ogg', 'STS_SFX_BattleStart_2_v1.ogg'],
    'battleStartBoss':  ['STS_SFX_BattleStart_Boss_v1.ogg'],
    # 攻击 (按卡牌类型分流)
    'atkIron':          ['SOTE_SFX_IronClad_Atk_RR1_v2.ogg', 'SOTE_SFX_IronClad_Atk_RR2_v2.ogg', 'SOTE_SFX_IronClad_Atk_RR3_v2.ogg'],
    'atkDagger':        ['STS_SFX_DaggerThrow_1.ogg', 'STS_SFX_DaggerThrow_2.ogg', 'STS_SFX_DaggerThrow_3.ogg'],
    'atkMagic':         ['SOTE_SFX_MagicFast_1_v1.ogg', 'SOTE_SFX_MagicFast_2_v1.ogg', 'SOTE_SFX_MagicFast_3_v1.ogg'],
    'atkMagicSlow':     ['SOTE_SFX_SlowMagic_1_v1.ogg', 'SOTE_SFX_SlowMagic_2_v1.ogg'],
    'atkHeavy':         ['SOTE_SFX_HeavyAtk_v2.ogg'],
    'atkFast':          ['SOTE_SFX_FastAtk_v2.ogg'],
    'atkWhiff':         ['SOTE_SFX_SlowThrow_1_v1.ogg', 'SOTE_SFX_SlowThrow_2_v1.ogg'],
    'atkFire':          ['SOTE_SFX_FireIgnite_2_v1.ogg'],
    'atkPoison':        ['SOTE_SFX_PoisonCard_1_v1.ogg', 'SOTE_SFX_PoisonCard_2_v1.ogg'],
    'atkWhirlwind':     ['STS_SFX_Whirlwind_v2.ogg'],
    'atkThunderclap':   ['SOTE_SFX_ThunderclapCard_v1.ogg'],
    'atkPiercingWail':  ['STS_SFX_PiercingWail_v2.ogg'],
    'atkFlameBarrier':  ['STS_SFX_FlameBarrier_v2.ogg'],
    'atkBowling':       ['bowling.ogg'],
    'bluntHeavy':       ['SOTE_SFX_HeavyBlunt_v2.ogg'],
    # 格挡
    'blockGain':        ['SOTE_SFX_GainDefense_RR1_v3.ogg', 'SOTE_SFX_GainDefense_RR3_v3.ogg', 'SOTE_SFX_GainDefense_RR2_v3.ogg'],
    'blockAttack':      ['SOTE_SFX_BlockAtk_v2.ogg'],
    'blockBreak':       ['SOTE_SFX_DefenseBreak_v2.ogg'],
    # 伤害
    'bloodSplat':       ['SOTE_SFX_Blood_2_v2.ogg'],
    'bloodSwish':       ['SOTE_SFX_Blood_1_v2.ogg'],
    # 增益/减益
    'buff':             ['SOTE_SFX_Buff_1_v1.ogg', 'SOTE_SFX_Buff_2_v1.ogg', 'SOTE_SFX_Buff_3_v1.ogg'],
    'debuff':           ['SOTE_SFX_Debuff_1_v1.ogg', 'SOTE_SFX_Debuff_2_v1.ogg', 'SOTE_SFX_Debuff_3_v1.ogg'],
    'powerStrength':    ['STS_SFX_Strength_v1.ogg'],
    'powerPoison':      ['STS_SFX_PoisonApply_v1.ogg'],
    'powerFocus':       ['STS_SFX_Focus_v2.ogg'],
    'powerIntangible':  ['STS_SFX_Intangible_v1.ogg'],
    'powerMetallicize': ['STS_SFX_Metallicize_v2.ogg'],
    'powerDexterity':   ['STS_SFX_Dexterity_v2.ogg'],
    # 治疗
    'heal':             ['SOTE_SFX_HealShort_1_v2.ogg', 'SOTE_SFX_HealShort_2_v2.ogg', 'SOTE_SFX_HealShort_3_v2.ogg'],
    # 卡牌
    'cardSelect':       ['SOTE_SFX_CardSelect_v2.ogg'],
    'cardReject':       ['SOTE_SFX_CardReject_v1.ogg'],
    'cardDraw':         ['STS_SFX_CardDeal8_v1.ogg'],
    'cardExhaust':      ['SOTE_SFX_ExhaustCard.ogg'],
    'cardObtain':       ['SOTE_SFX_ObtainCard_v2.ogg'],
    'cardUpgrade':      ['SOTE_SFX_UpgradeCard_v1.ogg'],
    'cardPowerWoosh':   ['STS_SFX_PowerWoosh_v1.ogg'],
    'cardPowerImpact':  ['STS_SFX_Power_v1.ogg'],
    # 回合
    'endTurn':          ['SOTE_SFX_EndTurn_v2.ogg'],
    'enemyTurn':        ['SOTE_SFX_EnemyTurn_v3.ogg'],
    'turnEffect':       ['SOTE_SFX_PlayerTurn_v4_1.ogg'],
    # 地图/UI
    'mapOpen':          ['SOTE_SFX_Map_1_v3.ogg', 'SOTE_SFX_Map_2_v3.ogg'],
    'mapClose':         ['SOTE_SFX_UI_Parchment_1_v2.ogg'],
    'mapHover':         ['SOTE_SFX_MapHover_1_v1.ogg', 'SOTE_SFX_MapHover_2_v1.ogg', 'SOTE_SFX_MapHover_3_v1.ogg', 'SOTE_SFX_MapHover_4_v1.ogg'],
    'mapSelect':        ['SOTE_SFX_MapSelect_1_v1.ogg', 'SOTE_SFX_MapSelect_2_v1.ogg', 'SOTE_SFX_MapSelect_3_v1.ogg', 'SOTE_SFX_MapSelect_4_v1.ogg'],
    'uiClick':          ['SOTE_SFX_UIClick_1_v2.wav', 'SOTE_SFX_UIClick_2_v2.wav'],
    'uiHover':          ['SOTE_SFX_UIHover_v2.wav'],
    'deckOpen':         ['SOTE_SFX_UI_Parchment_3_v1.ogg'],
    'deckClose':        ['SOTE_SFX_UI_Parchment_2_v1.ogg'],
    # 金钱
    'goldGain':         ['SOTE_SFX_Gold_RR1_v3.ogg', 'SOTE_SFX_Gold_RR2_v3.ogg', 'SOTE_SFX_Gold_RR3_v3.ogg', 'SOTE_SFX_Gold_RR4_v3.ogg', 'SOTE_SFX_Gold_RR5_v3.ogg'],
    'goldJingle':       ['SOTE_SFX_Gold_v1.ogg'],
    # 商店
    'shopOpen':         ['SOTE_SFX_ShopRugOpen_v1.ogg'],
    'shopClose':        ['SOTE_SFX_ShopRugClose_v1.ogg'],
    'shopPurchase':     ['SOTE_SFX_CashRegister.ogg'],
    'eventPurchase':    ['SOTE_SFX_EventPurchase.ogg'],
    # 药水
    'potion':           ['SOTE_SFX_Potion_1_v2.ogg', 'SOTE_SFX_Potion_2_v2.ogg', 'SOTE_SFX_Potion_3_v2.ogg'],
    'potionDrop':       ['SOTE_SFX_DropPotion_1_v1.ogg', 'SOTE_SFX_DropPotion_2_v1.ogg'],
    # 遗物
    'relicClink':       ['SOTE_SFX_DropRelic_Clink.ogg'],
    'relicMagical':     ['SOTE_SFX_DropRelic_Magical.ogg'],
    'chestOpen':        ['SOTE_SFX_ChestOpen_v2.ogg'],
    # 篝火
    'restFire':         ['SOTE_SFX_RestFireDry_v2.ogg'],
    # 特殊
    'dungeonTransition': ['SOTE_SFX_DungeonGate.ogg'],
    'bell':             ['SOTE_SFX_Bell_v1.ogg'],
    'keyObtain':        ['SOTE_SFX_Key_v2.ogg'],
    'bossVictoryStinger': ['STS_BossVictoryStinger_1_v3_SFX.ogg'],
    'deathStinger':     ['STS_DeathStinger_v4_SFX.ogg'],
    'victory':          ['SOTE_SFX_Victory_v1.ogg'],
    'heartBeat':        ['SLS_SFX_HeartBeat_Resonant_v1.ogg'],
    'appear':           ['SOTE_SFX_Appear_v2.ogg'],
    # 法球
    'orbFrostChannel':  ['sound/orb/STS_SFX_FrostOrb_Channel_v1.ogg'],
    'orbFrostEvoke':    ['sound/orb/STS_SFX_FrostOrb_Evoke_v1.ogg'],
    'orbLightningChannel': ['sound/orb/STS_SFX_LightningOrb_Channel_v1.ogg'],
    'orbLightningEvoke': ['sound/orb/STS_SFX_LightningOrb_Evoke_v1.ogg'],
    'orbDarkChannel':   ['sound/orb/STS_SFX_DarkOrb_Channel_v1.ogg'],
    'orbDarkEvoke':     ['sound/orb/STS_SFX_DarkOrb_Evoke_v1.ogg'],
    'orbPlasmaChannel': ['sound/orb/STS_SFX_PlasmaOrb_Channel_v1.ogg'],
    'orbPlasmaEvoke':   ['sound/orb/STS_SFX_PlasmaOrb_Evoke_v1.ogg'],
    'orbGainSlot':      ['sound/orb/STS_SFX_GainSlot_v1.ogg'],
    # 姿态(观者)
    'stanceCalm':       ['sound/watcher/STS_SFX_Watcher-Calm_v2.ogg'],
    'stanceWrath':      ['sound/watcher/STS_SFX_Watcher-Wrath_v2.ogg'],
    'stanceDivinity':   ['sound/watcher/STS_SFX_Watcher-Divinity_v3.ogg'],
}

manifest = {'keys': {}, 'files': []}
n_ok = n_miss = 0
for key, files in SFX_MAP.items():
    variants = []
    for f in files:
        # orb/watcher 在子目录
        if f.startswith('sound/'):
            src = f"{SRC}/{f}"
        else:
            src = f"{SRC}/{f}"
        if not os.path.exists(src):
            print(f"MISS {key}: {f}")
            n_miss += 1
            continue
        base = os.path.basename(f)
        ext = base.rsplit('.', 1)[1]
        stem = base.rsplit('.', 1)[0]
        # Next.js: 原样拷贝(wav转ogg)
        dest_next = f"{NEXT}/sfx/{stem}.ogg" if ext == 'wav' else f"{NEXT}/sfx/{base}"
        if ext == 'wav':
            subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', src, '-c:a', 'libvorbis', '-q:a', '5', dest_next], check=True)
        else:
            shutil.copy(src, dest_next)
        # standalone: q0低码率
        dest_stand = f"{STAND}/audio/sfx/{stem}.ogg"
        os.makedirs(os.path.dirname(dest_stand), exist_ok=True)
        subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', src, '-c:a', 'libvorbis', '-q:a', '0', dest_stand], check=True)
        rel = os.path.basename(dest_next)
        variants.append(rel.rsplit('.', 1)[0])
        manifest['files'].append(rel)
        n_ok += 1
    manifest['keys'][key] = variants

json.dump(manifest, open('/tmp/sfx_manifest.json', 'w'), indent=1)
print(f"SFX安装: {n_ok}文件 OK, {n_miss}缺失")
print(f"Next.js sfx: {os.path.getsize(f'{NEXT}/sfx')//1024}KB; standalone: {os.path.getsize(f'{STAND}/audio/sfx')//1024}KB")

# ---- 各幕BGM/act专属Boss BGM 转码 ----
MUSIC = {
    'level2':   ('/tmp/newmusic/level2.ogg',  'STS_Level2_NewMix_v1.ogg'),
    'level3':   ('/tmp/newmusic/level3.ogg',  'STS_Level3_v2.ogg'),
    'act4':     ('/tmp/newmusic/act4.ogg',    'STS_Act4_BGM_v2.ogg'),
    'boss2':    ('/tmp/newmusic/boss2.ogg',   'STS_Boss2_NewMix_v1.ogg'),
    'boss3':    ('/tmp/newmusic/boss3.ogg',   'STS_Boss3_NewMix_v1.ogg'),
    'boss4':    ('/tmp/newmusic/boss4.ogg',   'STS_Boss4_v6.ogg'),
    'mindbloom': ('/tmp/newmusic/mindbloom.ogg', 'STS_Boss1MindBloom_v1.ogg'),
}
for key, (src, _orig) in MUSIC.items():
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', src, '-c:a', 'libvorbis', '-q:a', '4', f'{NEXT}/audio/{key}.ogg'], check=True)
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', src, '-c:a', 'libvorbis', '-q:a', '0', f'{STAND}/audio/{key}.ogg'], check=True)
    print(f"BGM {key}: next={os.path.getsize(f'{NEXT}/audio/{key}.ogg')//1024}KB stand={os.path.getsize(f'{STAND}/audio/{key}.ogg')//1024}KB")
print("完成")
