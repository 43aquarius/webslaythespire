// ============ 杀戮尖塔 Web 复刻 - 核心类型定义 ============

export type CardType = 'attack' | 'skill' | 'power'
export type Rarity = 'starter' | 'common' | 'uncommon' | 'rare' | 'special'
export type CardTarget = 'enemy' | 'allEnemies' | 'self' | 'none'
export type PileId = 'draw' | 'hand' | 'discard' | 'exhaust'
export type CardColor = 'red' | 'green' | 'blue' | 'purple' | 'colorless'
export type CharacterId = 'ironclad' | 'silent' | 'defect' | 'watcher'

// ============ 状态效果 ============
export type StatusId =
  | 'strength'      // 力量
  | 'dexterity'     // 敏捷
  | 'vulnerable'    // 易伤
  | 'weak'          // 虚弱
  | 'frail'         // 脆弱
  | 'artifact'      // 反制
  | 'thorns'        // 尖刺
  | 'metallicize'   // 金属化
  | 'regen'         // 回复
  | 'ritual'        // 仪式
  | 'demonForm'     // 恶魔形态
  | 'barricade'     // 壁垒
  | 'brutality'     // 残暴
  | 'corruption'    // 堕落
  | 'combust'       // 燃烧
  | 'darkEmbrace'   // 暗黑拥抱
  | 'evolve'        // 进化
  | 'feelNoPain'    // 无痛
  | 'fireBreathing' // 火焰吐息
  | 'rupture'       // 破裂
  | 'juggernaut'    // 主宰
  | 'berserk'       // 狂暴
  | 'rage'          // 狂怒
  | 'doubleTap'     // 连击
  | 'noDraw'        // 无法抽牌（战斗恍惚）
  | 'angry'         // 哥布林大王激怒
  | 'asleep'        // 拉格维林沉睡
  | 'curlUp'        // 虱子蜷缩
  | 'metallicizeE'  // 敌人用金属化
  | 'poison'        // 中毒
  | 'focus'         // 集中（故障机器人）
  | 'intangible'    // 虚无形体：受到的伤害变为 1
  | 'lockOn'        // 锁定
  | 'mark'          // 印记（观者）
  | 'mantra'        // 真言
  | 'constricted'   // 束缚（尖塔生长体）
  | 'hex'           // 咒术（天选者）
  | 'flying'        // 飞行（百鸟）
  | 'time'          // 时间吞噬者计数
  | 'beatOfDeath'   // 腐朽之心：死亡节拍
  | 'accuracy'      // 小刀精准
  | 'afterImage'    // 残像
  | 'aThousandCuts' // 千刀万剐
  | 'caltropsS'     // 蒺藜（潜行者版）
  | 'envenomS'      // 淬毒
  | 'echoForm'      // 回声形态
  | 'amplifyS'      // 扩增
  | 'loopS'         // 循环
  | 'staticDischargeS' // 静电释放
  | 'stormS'        // 风暴
  | 'equilibriumS'  // 平衡：保留手牌
  | 'mentalFortressS' // 心灵壁垒
  | 'likeWaterS'    // 静如水
  | 'nirvanaS'      // 涅槃
  | 'devotionS'     // 奉献
  | 'brillianceS'   // 光辉
  | 'alphaS'        // 阿尔法
  | 'establishmentS' // 建制
  | 'phantasmal'    // 幻影杀手：下次攻击双倍
  | 'blasphemyD'    // 亵渎：下回合开始时死亡
  | 'vaultS'        // 跳跃：跳过敌人回合
  | 'rebirth'       // 重生（觉醒者）
  | 'entangled'     // 纠缠：下回合无法打出攻击牌
  | 'shackled'      // 束缚（时间吞噬者削弱）
  | 'modeShift'     // 模式切换（已有）
  | 'corpseExplosionS' // 尸爆
  | 'noxiousFumesS' // 恶性烟雾
  | 'infiniteBladesS' // 无限刀刃
  | 'phasingS'      // 相位
  | 'tempest'       // 占位
  | 'fumes'         // 占位2

export interface StatusMap {
  [key: string]: number
}

// ============ 卡牌 ============
export interface CardDef {
  id: string
  name: string
  nameEn: string
  type: CardType
  rarity: Rarity
  cost: number          // -1 = X 费；-99 = 不可打出
  target: CardTarget
  exhaust?: boolean
  ethereal?: boolean    // 虚无：回合结束时消耗
  retain?: boolean      // 保留
  innate?: boolean      // 固有：开局在手
  exhaustOnDiscard?: boolean // Slimed 之类：离手时消耗
  desc: string
  upDesc: string
  art: string           // 素材 key
  values?: number[]     // [伤害/格挡, 次数, ...] 动态描述引用
  upValues?: number[]
  upCost?: number
  artTheme?: string
  color?: CardColor     // 所属角色色（默认 red）
  unplayable?: boolean  // 不可主动打出（Reflex/Void）
  onDiscardDraw?: number // 被弃时抽牌（Reflex）
  isToken?: boolean     // 衍生牌（小刀/奇迹/惩罚等）
}

export interface CardInstance {
  uid: string
  id: string
  upgraded: number      // 0 = 未升级；>0 = 升级次数
  freeThisTurn?: boolean // 药水墨牌：本回合 0 费
  limitBreakExhaust?: boolean
}

// ============ 敌人 ============
export type IntentType =
  | 'attack' | 'attackDebuff' | 'attackDefend' | 'defend'
  | 'buff' | 'debuff' | 'strongDebuff' | 'sleep' | 'unknown'

export interface Intent {
  type: IntentType
  damage?: number       // 每次伤害
  times?: number        // 攻击次数
}

export interface EnemyMove {
  name: string
  intent: Intent
  // 参数
  dmg?: number
  times?: number
  block?: number
  status?: { id: StatusId; amount: number; target: 'player' | 'self' | 'allies' | 'allAllies' }
  status2?: { id: StatusId; amount: number; target: 'player' | 'self' | 'allies' | 'allAllies' }
  heal?: number                 // 自我治疗
  healAllies?: number           // 治疗其他队友
  summon?: { id: string; count: number }  // 召唤
  addCards?: { cardId: string; count: number; pile: 'draw' | 'discard' }
  custom?: string
}

export interface EnemyDef {
  id: string
  name: string
  nameEn: string
  minHp: number
  maxHp: number
  sprite: string
  moves: EnemyMove[]
  openingMove?: number
  moveLogic?: 'random' | 'cycle'
  weights?: number[]
  noTripleRepeat?: boolean
  onDeath?: 'sporeCloud' | 'splitBoss' | 'splitAcid' | 'splitSpike' | 'rebirth' | 'corpseExplosion'
  startStatuses?: StatusMap
  elite?: boolean
  boss?: boolean
  small?: boolean          // 召唤物/小怪（精灵图更小）
  escapeAfter?: number     // N 回合后逃跑（短暂者）
  attackGrows?: boolean    // 逐回合伤害递增（短暂者）
}

export interface EnemyInstance {
  uid: string
  id: string
  hp: number
  maxHp: number
  block: number
  statuses: StatusMap
  history: number[]       // 出招历史（move idx）
  intent: Intent | null
  nextMoveIdx: number
  flash: boolean
  dying: boolean
  custom: Record<string, number>
}

// ============ 遗物 ============
export type RelicRarity = 'starter' | 'common' | 'uncommon' | 'boss' | 'shop'

export interface RelicDef {
  id: string
  name: string
  nameEn: string
  rarity: RelicRarity
  desc: string
  icon: string   // emoji
  color: string  // 图标底色
}

// ============ 药水 ============
export interface PotionDef {
  id: string
  name: string
  nameEn: string
  desc: string
  color: string       // 药液颜色
  glow?: string
  target: 'enemy' | 'none' | 'allEnemies'
  rarity: 'common' | 'uncommon' | 'rare'
}

// ============ 地图 ============
export type NodeType = 'monster' | 'elite' | 'event' | 'shop' | 'treasure' | 'rest' | 'boss'

export interface MapNode {
  id: string           // "r{row}c{col}"
  row: number          // 0-16
  col: number
  type: NodeType
  edges: string[]
  x: number
  y: number
}

export interface GameMap {
  nodes: Record<string, MapNode>
  startNodes: string[]
  bossNodeId: string
}

// ============ 战斗 ============
export type OrbType = 'lightning' | 'frost' | 'dark' | 'plasma'

export interface Orb {
  type: OrbType
  damage?: number   // 暗球蓄伤
}

export type StanceId = 'none' | 'wrath' | 'calm' | 'divinity'

export interface PlayerCombatState {
  block: number
  statuses: StatusMap
  energy: number
  maxEnergy: number
  hpLostThisCombat: number
  attacksThisTurn: number
  tempStr?: number            // 屈伸临时力量
  cardsPlayedThisTurn?: number
  customFlags?: Record<string, number>
  // ---- 观者 ----
  stance?: StanceId
  mantra?: number
  exitedStanceThisTurn?: boolean
  lastCardType?: CardType | 'none'
  // ---- 寂静猎手 ----
  cardsDiscardedThisTurn?: number
  // ---- 故障机器人 ----
  orbs?: Orb[]
  orbSlots?: number
  channeledThisCombat?: number
  lightningChanneled?: number
  // ---- 通用 ----
  cardsDrawnThisTurn?: number
}

export interface CombatState {
  enemies: EnemyInstance[]
  player: PlayerCombatState
  drawPile: CardInstance[]
  hand: CardInstance[]
  discardPile: CardInstance[]
  exhaustPile: CardInstance[]
  turn: number
  phase: 'player' | 'enemy' | 'over'
  encounterName: string
  isElite: boolean
  isBoss: boolean
  goldReward: number
  potionDrop: boolean
  fx: FxEvent[]
  log: string[]
  combatOver: boolean
  playerWon: boolean
  combatEndTriggered: boolean
  rampage?: Record<string, number>   // 暴走牌伤害成长
  glassKnife?: Record<string, number> // 玻璃小刀永久削减
  clawBonus?: number                 // 爪击全局成长
  pendingArmaments?: 'one' | 'all' | null  // 武装升级选择
  pendingHeadbutt?: boolean              // 头槌选牌
  pendingTrueGrit?: boolean              // 坚毅升级版选牌
  pendingWarcry?: boolean                // 战吼选牌
  pendingNightmare?: { cardId: string; upgraded: number; count: number } | null // 噩梦：下回合入手副本
  pendingScry?: number | null               // 预见中（卡数）
  scryDiscarded?: string[]                  // 预见弃牌 uid 集合
}

export interface FxEvent {
  kind: 'dmg' | 'block' | 'heal' | 'status' | 'shake' | 'buff' | 'text' | 'slash' | 'lunge' | 'cardPlay' | 'orb'
  target: 'player' | string
  value?: number
  text?: string
  id: number
}

// ============ 事件 ============
export interface EventChoice {
  text: string
  effect: string
  tooltip?: string
  disabled?: (gold: number) => boolean
}

export interface EventDef {
  id: string
  name: string
  nameEn: string
  desc: string
  choices: EventChoice[]
}

// ============ 运行状态 ============
export type Screen =
  | 'title' | 'neow' | 'map' | 'combat' | 'reward' | 'shop'
  | 'rest' | 'treasure' | 'event' | 'gameover' | 'victory' | 'bossRelic' | 'actTransition'

export interface ShopState {
  cards: { cardId: string; price: number; sold: boolean; upgraded: boolean }[]
  relics: { relicId: string; price: number; sold: boolean }[]
  potions: { potionId: string; price: number; sold: boolean }[]
  removalUsed: boolean
  removalPrice: number
}

export interface RewardState {
  gold?: number
  cards?: string[]
  potion?: string
  relic?: string
  taken: string[]
}

// ============ 涅奥祝福 ============
export interface NeowOption {
  id: string
  title: string
  desc: string
  effect: string   // 'maxHp' | 'gold' | 'heal' | 'relic' | 'removeCard' | 'upgradeCard' | 'transformCard' | 'duplicateCard' | 'potions'
  value?: number
}

export interface NeowState {
  options: NeowOption[]
  chosen: string | null
}

export interface RunState {
  hp: number
  maxHp: number
  gold: number
  character: CharacterId
  deck: CardInstance[]
  relics: string[]
  potions: (string | null)[]
  map: GameMap
  currentNodeId: string | null
  visitedNodes: string[]
  screen: Screen
  combat: CombatState | null
  reward: RewardState | null
  shop: ShopState | null
  currentEvent: string | null
  eventsSeen: string[]
  removalCount: number
  eliteKilled: number
  monsterKilled: number
  goldEarned: number
  act: number
  relicCounters: Record<string, number>
  gameOverInfo: { victory: boolean; floor: number; monstersSlain: number; elitesSlain: number; goldEarned: number } | null
  neow?: NeowState | null
  bossesSeen: string[]   // 本局已遭遇的 boss（避免重复）
  nextActInfo?: number | null
}
