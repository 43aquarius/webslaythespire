'use client'
// ============ 原版 SFX 音效引擎（客户端单例） ============
// 音源: 反编译原版游戏 audio/sound/ (SoundMaster.java 215键映射的子集)
// 键→变体组随机播放; 音量独立于BGM; 单文件版可通过 resolver 重定向到 ASSETS

export type SfxKey =
  | 'battleStart' | 'battleStartBoss'
  | 'atkIron' | 'atkDagger' | 'atkMagic' | 'atkMagicSlow' | 'atkHeavy' | 'atkFast'
  | 'atkWhiff' | 'atkFire' | 'atkPoison' | 'atkWhirlwind' | 'atkThunderclap'
  | 'atkPiercingWail' | 'atkFlameBarrier' | 'atkBowling' | 'bluntHeavy'
  | 'blockGain' | 'blockAttack' | 'blockBreak'
  | 'bloodSplat' | 'bloodSwish'
  | 'buff' | 'debuff' | 'powerStrength' | 'powerPoison' | 'powerFocus'
  | 'powerIntangible' | 'powerMetallicize' | 'powerDexterity'
  | 'heal'
  | 'cardSelect' | 'cardReject' | 'cardDraw' | 'cardExhaust' | 'cardObtain'
  | 'cardUpgrade' | 'cardPowerWoosh' | 'cardPowerImpact'
  | 'endTurn' | 'enemyTurn' | 'turnEffect'
  | 'mapOpen' | 'mapClose' | 'mapHover' | 'mapSelect'
  | 'uiClick' | 'uiHover' | 'deckOpen' | 'deckClose'
  | 'goldGain' | 'goldJingle' | 'shopOpen' | 'shopClose' | 'shopPurchase' | 'eventPurchase'
  | 'potion' | 'potionDrop' | 'relicClink' | 'relicMagical' | 'chestOpen'
  | 'restFire' | 'dungeonTransition' | 'bell' | 'keyObtain'
  | 'bossVictoryStinger' | 'deathStinger' | 'victory' | 'heartBeat' | 'appear'
  | 'orbFrostChannel' | 'orbFrostEvoke' | 'orbLightningChannel' | 'orbLightningEvoke'
  | 'orbDarkChannel' | 'orbDarkEvoke' | 'orbPlasmaChannel' | 'orbPlasmaEvoke' | 'orbGainSlot'
  | 'stanceCalm' | 'stanceWrath' | 'stanceDivinity'

// 键 → 变体文件名列表（不含扩展名; manifest.json 由安装脚本生成，两版本同键名）
// Next.js: /assets/sfx/{name}.ogg ; 单文件版: ASSETS['sfx/{name}.ogg']
const KEY_VARIANTS: Record<SfxKey, string[]> = {
  battleStart: ['STS_SFX_BattleStart_1_v1', 'STS_SFX_BattleStart_2_v1'],
  battleStartBoss: ['STS_SFX_BattleStart_Boss_v1'],
  atkIron: ['SOTE_SFX_IronClad_Atk_RR1_v2', 'SOTE_SFX_IronClad_Atk_RR2_v2', 'SOTE_SFX_IronClad_Atk_RR3_v2'],
  atkDagger: ['STS_SFX_DaggerThrow_1', 'STS_SFX_DaggerThrow_2', 'STS_SFX_DaggerThrow_3'],
  atkMagic: ['SOTE_SFX_MagicFast_1_v1', 'SOTE_SFX_MagicFast_2_v1', 'SOTE_SFX_MagicFast_3_v1'],
  atkMagicSlow: ['SOTE_SFX_SlowMagic_1_v1', 'SOTE_SFX_SlowMagic_2_v1'],
  atkHeavy: ['SOTE_SFX_HeavyAtk_v2'],
  atkFast: ['SOTE_SFX_FastAtk_v2'],
  atkWhiff: ['SOTE_SFX_SlowThrow_1_v1', 'SOTE_SFX_SlowThrow_2_v1'],
  atkFire: ['SOTE_SFX_FireIgnite_2_v1'],
  atkPoison: ['SOTE_SFX_PoisonCard_1_v1', 'SOTE_SFX_PoisonCard_2_v1'],
  atkWhirlwind: ['STS_SFX_Whirlwind_v2'],
  atkThunderclap: ['SOTE_SFX_ThunderclapCard_v1'],
  atkPiercingWail: ['STS_SFX_PiercingWail_v2'],
  atkFlameBarrier: ['STS_SFX_FlameBarrier_v2'],
  atkBowling: ['bowling'],
  bluntHeavy: ['SOTE_SFX_HeavyBlunt_v2'],
  blockGain: ['SOTE_SFX_GainDefense_RR1_v3', 'SOTE_SFX_GainDefense_RR3_v3', 'SOTE_SFX_GainDefense_RR2_v3'],
  blockAttack: ['SOTE_SFX_BlockAtk_v2'],
  blockBreak: ['SOTE_SFX_DefenseBreak_v2'],
  bloodSplat: ['SOTE_SFX_Blood_2_v2'],
  bloodSwish: ['SOTE_SFX_Blood_1_v2'],
  buff: ['SOTE_SFX_Buff_1_v1', 'SOTE_SFX_Buff_2_v1', 'SOTE_SFX_Buff_3_v1'],
  debuff: ['SOTE_SFX_Debuff_1_v1', 'SOTE_SFX_Debuff_2_v1', 'SOTE_SFX_Debuff_3_v1'],
  powerStrength: ['STS_SFX_Strength_v1'],
  powerPoison: ['STS_SFX_PoisonApply_v1'],
  powerFocus: ['STS_SFX_Focus_v2'],
  powerIntangible: ['STS_SFX_Intangible_v1'],
  powerMetallicize: ['STS_SFX_Metallicize_v2'],
  powerDexterity: ['STS_SFX_Dexterity_v2'],
  heal: ['SOTE_SFX_HealShort_1_v2', 'SOTE_SFX_HealShort_2_v2', 'SOTE_SFX_HealShort_3_v2'],
  cardSelect: ['SOTE_SFX_CardSelect_v2'],
  cardReject: ['SOTE_SFX_CardReject_v1'],
  cardDraw: ['STS_SFX_CardDeal8_v1'],
  cardExhaust: ['SOTE_SFX_ExhaustCard'],
  cardObtain: ['SOTE_SFX_ObtainCard_v2'],
  cardUpgrade: ['SOTE_SFX_UpgradeCard_v1'],
  cardPowerWoosh: ['STS_SFX_PowerWoosh_v1'],
  cardPowerImpact: ['STS_SFX_Power_v1'],
  endTurn: ['SOTE_SFX_EndTurn_v2'],
  enemyTurn: ['SOTE_SFX_EnemyTurn_v3'],
  turnEffect: ['SOTE_SFX_PlayerTurn_v4_1'],
  mapOpen: ['SOTE_SFX_Map_1_v3', 'SOTE_SFX_Map_2_v3'],
  mapClose: ['SOTE_SFX_UI_Parchment_1_v2'],
  mapHover: ['SOTE_SFX_MapHover_1_v1', 'SOTE_SFX_MapHover_2_v1', 'SOTE_SFX_MapHover_3_v1', 'SOTE_SFX_MapHover_4_v1'],
  mapSelect: ['SOTE_SFX_MapSelect_1_v1', 'SOTE_SFX_MapSelect_2_v1', 'SOTE_SFX_MapSelect_3_v1', 'SOTE_SFX_MapSelect_4_v1'],
  uiClick: ['SOTE_SFX_UIClick_1_v2'],
  uiHover: ['SOTE_SFX_UIHover_v2'],
  deckOpen: ['SOTE_SFX_UI_Parchment_3_v1'],
  deckClose: ['SOTE_SFX_UI_Parchment_2_v1'],
  goldGain: ['SOTE_SFX_Gold_RR1_v3', 'SOTE_SFX_Gold_RR2_v3', 'SOTE_SFX_Gold_RR3_v3', 'SOTE_SFX_Gold_RR4_v3', 'SOTE_SFX_Gold_RR5_v3'],
  goldJingle: ['SOTE_SFX_Gold_v1'],
  shopOpen: ['SOTE_SFX_ShopRugOpen_v1'],
  shopClose: ['SOTE_SFX_ShopRugClose_v1'],
  shopPurchase: ['SOTE_SFX_CashRegister'],
  eventPurchase: ['SOTE_SFX_EventPurchase'],
  potion: ['SOTE_SFX_Potion_1_v2', 'SOTE_SFX_Potion_2_v2', 'SOTE_SFX_Potion_3_v2'],
  potionDrop: ['SOTE_SFX_DropPotion_1_v1', 'SOTE_SFX_DropPotion_2_v1'],
  relicClink: ['SOTE_SFX_DropRelic_Clink'],
  relicMagical: ['SOTE_SFX_DropRelic_Magical'],
  chestOpen: ['SOTE_SFX_ChestOpen_v2'],
  restFire: ['SOTE_SFX_RestFireDry_v2'],
  dungeonTransition: ['SOTE_SFX_DungeonGate'],
  bell: ['SOTE_SFX_Bell_v1'],
  keyObtain: ['SOTE_SFX_Key_v2'],
  bossVictoryStinger: ['STS_BossVictoryStinger_1_v3_SFX'],
  deathStinger: ['STS_DeathStinger_v4_SFX'],
  victory: ['SOTE_SFX_Victory_v1'],
  heartBeat: ['SLS_SFX_HeartBeat_Resonant_v1'],
  appear: ['SOTE_SFX_Appear_v2'],
  orbFrostChannel: ['STS_SFX_FrostOrb_Channel_v1'],
  orbFrostEvoke: ['STS_SFX_FrostOrb_Evoke_v1'],
  orbLightningChannel: ['STS_SFX_LightningOrb_Channel_v1'],
  orbLightningEvoke: ['STS_SFX_LightningOrb_Evoke_v1'],
  orbDarkChannel: ['STS_SFX_DarkOrb_Channel_v1'],
  orbDarkEvoke: ['STS_SFX_DarkOrb_Evoke_v1'],
  orbPlasmaChannel: ['STS_SFX_PlasmaOrb_Channel_v1'],
  orbPlasmaEvoke: ['STS_SFX_PlasmaOrb_Evoke_v1'],
  orbGainSlot: ['STS_SFX_GainSlot_v1'],
  stanceCalm: ['STS_SFX_Watcher-Calm_v2'],
  stanceWrath: ['STS_SFX_Watcher-Wrath_v2'],
  stanceDivinity: ['STS_SFX_Watcher-Divinity_v3'],
}

const VOL_KEY = 'sts-sfx-vol'
const MUTE_KEY = 'sts-sfx-muted'
const POOL_SIZE = 12

export class SfxEngine {
  private pool: HTMLAudioElement[] = []
  private loaded = false
  volume = 0.7
  muted = false
  /** 单文件版注入: ASSETS 映射; Next.js: /assets/sfx/ 前缀 */
  resolver: (name: string) => string = (name) => `/assets/sfx/${name}.ogg`

  constructor() {
    if (typeof window === 'undefined') return
    this.volume = Number(localStorage.getItem(VOL_KEY) ?? 0.7)
    this.muted = localStorage.getItem(MUTE_KEY) === '1'
  }

  private ensurePool() {
    if (this.loaded) return
    this.loaded = true
    for (let i = 0; i < POOL_SIZE; i++) {
      const el = new Audio()
      el.preload = 'auto'
      el.volume = this.effVol()
      this.pool.push(el)
    }
  }

  private effVol() { return this.muted ? 0 : this.volume }

  private resolve(name: string) { return this.resolver(name) }

  play(key: SfxKey) {
    if (typeof window === 'undefined') return
    if (this.muted || this.volume <= 0) return
    this.ensurePool()
    const variants = KEY_VARIANTS[key]
    if (!variants || variants.length === 0) return
    const name = variants[Math.floor(Math.random() * variants.length)]
    // 找空闲元素（paused 或 ended）; 全忙则抢占最旧的
    let el: HTMLAudioElement | undefined
    for (const p of this.pool) {
      if (p.paused || p.ended) { el = p; break }
    }
    if (!el) { el = this.pool[0] }
    try { el.pause() } catch { /* ignore */ }
    el.src = this.resolve(name)
    el.volume = this.effVol()
    el.play().then(() => { el.dataset.played = String(Date.now()) }).catch(() => { /* 静默 */ })
    if (!(el.dataset.played ?? '')) { /* noop 保留占位 */ }
  }

  setVolume(v: number) {
    this.volume = v
    localStorage.setItem(VOL_KEY, String(v))
    if (this.effVol() === 0) return
    for (const p of this.pool) if (!p.paused) p.volume = this.effVol()
  }

  setMuted(m: boolean) {
    this.muted = m
    localStorage.setItem(MUTE_KEY, m ? '1' : '0')
    if (this.effVol() === 0) {
      for (const p of this.pool) try { p.pause() } catch { /* ignore */ }
      return
    }
    for (const p of this.pool) p.volume = this.effVol()
  }
}

export const sfx = new SfxEngine()

// 调试/测试钩子
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__sfx = sfx
}
