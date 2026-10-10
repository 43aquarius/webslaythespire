// ============ 原版药水分层数据（第二十一批提取自反编译仓库） ============
// 管线严格复刻 AbstractPotion.render：liquid(纯色mask) → hybrid(可选) → spots(可选) → glass(原图)
// 提取源: 18 个药水类 super(PotionSize, PotionColor) + initializeColor 色表 + ImageMaster 装载清单
export interface PotionLayerSpec { shape: string; liquid: string | null; hybrid?: string | null; spots?: string | null }

export const POTION_LAYERS: Record<string, PotionLayerSpec> = {
  firePotion: { shape: 'sphere', liquid: '#ff0000', hybrid: '#ffa500' },  // FirePotion size=SPHERE color=FIRE layers=glass+liquid+hybrid+spots+outline
  blockPotion: { shape: 's', liquid: '#87ceeb' },  // BlockPotion size=S color=BLUE layers=glass+liquid+hybrid+spots+outline
  strengthPotion: { shape: 's', liquid: '#4d4d4d', spots: '#ff7f50' },  // StrengthPotion size=S color=STRENGTH layers=glass+liquid+hybrid+spots+outline
  dexterityPotion: { shape: 's', liquid: '#7fff00' },  // DexterityPotion size=S color=GREEN layers=glass+liquid+hybrid+spots+outline
  energyPotion: { shape: 'bolt', liquid: '#ffd700' },  // EnergyPotion size=BOLT color=ENERGY layers=glass+liquid+hybrid+spots+outline
  explosivePotion: { shape: 'h', liquid: '#ffa500' },  // ExplosivePotion size=H color=EXPLOSIVE layers=glass+liquid+hybrid+spots+outline
  fearPotion: { shape: 'h', liquid: '#000000', hybrid: '#ff1400' },  // FearPotion size=H color=FEAR layers=glass+liquid+hybrid+spots+outline
  weakPotion: { shape: 'h', liquid: '#ee82ee', hybrid: '#b03060' },  // WeakenPotion size=H color=WEAK layers=glass+liquid+hybrid+spots+outline
  swiftPotion: { shape: 'h', liquid: '#0d429d', spots: '#00ffff' },  // SwiftPotion size=H color=SWIFT layers=glass+liquid+hybrid+spots+outline
  bloodPotion: { shape: 'h', liquid: '#ffffff', hybrid: '#b3b3b3' },  // BloodPotion size=H color=WHITE layers=glass+liquid+hybrid+spots+outline
  fruitJuice: { shape: 'heart', liquid: '#ffa500', hybrid: '#32cd32' },  // FruitJuice size=HEART color=FRUIT layers=glass+liquid+hybrid+spots+outline
  skillPotion: { shape: 'card', liquid: '#7fff00' },  // SkillPotion size=CARD color=GREEN layers=glass+liquid+hybrid+spots+outline
  fairyInBottle: { shape: 'fairy', liquid: null, spots: '#ffffff' },  // FairyPotion size=FAIRY color=FAIRY layers=glass+liquid+hybrid+spots+outline
  attackPotion: { shape: 'card', liquid: '#ff0000', hybrid: '#ffa500' },  // AttackPotion size=CARD color=FIRE layers=glass+liquid+hybrid+spots+outline
  poisonPotion: { shape: 'm', liquid: '#32cd32', spots: '#228b22' },  // PoisonPotion size=M color=POISON layers=glass+liquid+hybrid+spots+outline
  ghostInAJar: { shape: 'ghost', liquid: '#ffffff', hybrid: '#b3b3b3' },  // GhostInAJar size=GHOST color=WHITE layers=glass+liquid+hybrid+spots+outline
  liquidBronze: { shape: 'spiky', liquid: '#e2b821', hybrid: '#18bcc0' },  // LiquidBronze size=SPIKY explicit-Color layers=glass+liquid+hybrid+outline
  cultistPotion: { shape: 'moon', liquid: '#2853bc', hybrid: '#1c2c60' },  // CultistPotion size=MOON explicit-Color layers=glass+liquid+hybrid+outline
}

// 空槽占位（原版 PotionSlot: POTION_PLACEHOLDER @ PLACEHOLDER_COLOR = 白 75%）
export const POTION_PLACEHOLDER_COLOR = 'rgba(255,255,255,0.75)'

// 图层资源键（Next: `${A}/${key}`；standalone: A(key)）
export function potionLayerKey(shape: string, layer: string): string {
  return `potionlayers/${shape}_${layer}.png`
}
export const POTION_PLACEHOLDER_KEY = 'potionlayers/placeholder.png'
