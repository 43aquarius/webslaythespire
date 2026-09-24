// ============ 杀戮尖塔 Web 复刻 - 核心类型定义 ============

export type CardType = 'attack' | 'skill' | 'power'
export type Rarity = 'starter' | 'common' | 'uncommon' | 'rare' | 'special'
export type CardTarget = 'enemy' | 'allEnemies' | 'self' | 'none'
export type PileId = 'draw' | 'hand' | 'discard' | 'exhaust'

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
  exhaustOnDiscard?: boolean // Slimed 之类：离手时消耗
  desc: string
  upDesc: string
  art: string           // 素材 key
  values?: number[]     // [伤害/格挡, 次数, ...] 动态描述引用
  upValues?: number[]
  upCost?: number
  artTheme?: string
}

export interface CardInstance {
  uid: string
  id: string
  upgraded: number      // 0 = 未升级；>0 = 升级次数
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
  status?: { id: StatusId; amount: number; target: 'player' | 'self' }
  status2?: { id: StatusId; amount: number; target: 'player' | 'self' }
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
  onDeath?: 'sporeCloud' | 'splitBoss' | 'splitAcid' | 'splitSpike'
  startStatuses?: StatusMap
  elite?: boolean
  boss?: boolean
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
export interface PlayerCombatState {
  block: number
  statuses: StatusMap
  energy: number
  maxEnergy: number
  hpLostThisCombat: number
  attacksThisTurn: number
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
}

export interface FxEvent {
  kind: 'dmg' | 'block' | 'heal' | 'status' | 'shake' | 'buff' | 'text'
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
  | 'title' | 'map' | 'combat' | 'reward' | 'shop'
  | 'rest' | 'treasure' | 'event' | 'gameover' | 'victory' | 'bossRelic'

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

export interface RunState {
  hp: number
  maxHp: number
  gold: number
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
  gameOverInfo: { victory: boolean; floor: number; monstersSlain: number; elitesSlain: number; goldEarned: number } | null
}
