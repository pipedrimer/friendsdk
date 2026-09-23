"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// games/rare-friend-mine/src/engine/rules.ts
var rules_exports = {};
__export(rules_exports, {
  DIFFICULTIES: () => DIFFICULTIES,
  DIFFICULTY_MINE_COUNTS: () => DIFFICULTY_MINE_COUNTS,
  MINES_CONFIG: () => MINES_CONFIG,
  ORES: () => ORES,
  POPULAR_MINE_PRESETS: () => POPULAR_MINE_PRESETS,
  RF_DECIMALS: () => RF_DECIMALS,
  RF_UNIT: () => RF_UNIT,
  RULES: () => RULES,
  calculateMinesMultiplier: () => calculateMinesMultiplier,
  calculateRoundMultiplier: () => calculateRoundMultiplier,
  formatMultiplier: () => formatMultiplier,
  getDangerTier: () => getDangerTier,
  getDifficulty: () => getDifficulty,
  getPeakMultiplier: () => getPeakMultiplier,
  getStartingMultiplier: () => getStartingMultiplier,
  getStepMultiplier: () => getStepMultiplier
});
module.exports = __toCommonJS(rules_exports);
var RF_DECIMALS = 18n;
var RF_UNIT = 10n ** RF_DECIMALS;
var RULES = {
  startingRf: 10n * RF_UNIT,
  defaultStakeRf: 1n * RF_UNIT,
  minStakeRf: 1n * RF_UNIT,
  scannerCostRf: 1n * RF_UNIT,
  curseExtraCostRf: 1n * RF_UNIT,
  curseDurationDigs: 3,
  boostBonusMultiplierBps: 5e3,
  // +0.50x to multiplier when boosted
  boostDigs: 2,
  boardRows: 5,
  boardCols: 5,
  totalTiles: 25,
  depthEverySafeDigs: 3,
  maxDepth: 4,
  greenMineMultiplier: 2n,
  // Per-round house edge applied to each fair-odds multiplier. The rarity of
  // rare finds below is tuned so the average run returns less than the stake
  // even when survivors bank the big compounding hauls.
  houseEdgeBps: 250,
  // Rare find presence odds (per board). Green mines, ores, shields and boosts
  // are lucky finds — not guaranteed and never purchasable.
  greenFindChance: 0.1,
  oreFindChance: 0.45,
  shieldFindChance: 0.18,
  boostFindChance: 0.15,
  oreSlotsCap: 2,
  animationDurationMs: 400,
  // Time the detonation "crash" plays before the run settles.
  mineCrashMs: 1100,
  mineCrashReducedMotionMs: 350
};
var MINES_CONFIG = {
  minMines: 5,
  maxMines: 24,
  defaultMines: 5,
  totalTiles: 25
};
var POPULAR_MINE_PRESETS = [5, 7, 10, 15, 20, 24];
function getDangerTier(mineCount) {
  if (mineCount <= 6) return { id: "novice", name: "Novice", tagline: "Entry seams", color: "#10b981" };
  if (mineCount <= 10) return { id: "prospector", name: "Prospector", tagline: "Standard risk", color: "#38bdf8" };
  if (mineCount <= 15) return { id: "abyss", name: "Abyss", tagline: "Deep and deadly", color: "#a855f7" };
  if (mineCount <= 20) return { id: "cataclysm", name: "Cataclysm", tagline: "Extreme volatile hazard", color: "#f59e0b" };
  return { id: "inferno", name: "Inferno", tagline: "Insane risk, legendary payout", color: "#ef4444" };
}
function calculateRoundMultiplier(mineCount, round) {
  const clampedMines = Math.min(Math.max(mineCount, MINES_CONFIG.minMines), MINES_CONFIG.maxMines);
  const safeTiles = MINES_CONFIG.totalTiles - clampedMines;
  if (round <= 0) return 1e4;
  if (round > safeTiles) round = safeTiles;
  const remainingTiles = MINES_CONFIG.totalTiles - (round - 1);
  const remainingSafe = safeTiles - (round - 1);
  if (remainingSafe <= 0) return 1e4;
  const fairBps = Math.floor(remainingTiles * 1e4 / remainingSafe);
  return Math.max(10001, Math.floor(fairBps * (1e4 - RULES.houseEdgeBps) / 1e4));
}
function getStartingMultiplier(mineCount) {
  return calculateRoundMultiplier(mineCount, 1);
}
function calculateMinesMultiplier(mineCount, step) {
  if (step <= 0) return 1e4;
  const clampedMines = Math.min(Math.max(mineCount, MINES_CONFIG.minMines), MINES_CONFIG.maxMines);
  const safeTiles = MINES_CONFIG.totalTiles - clampedMines;
  const clampedStep = Math.min(step, safeTiles);
  let cumulativeBps = 1e4;
  for (let round = 1; round <= clampedStep; round++) {
    const roundBps = calculateRoundMultiplier(clampedMines, round);
    cumulativeBps = Math.round(cumulativeBps * roundBps / 1e4);
  }
  return cumulativeBps;
}
function getPeakMultiplier(mineCount) {
  const clampedMines = Math.min(Math.max(mineCount, MINES_CONFIG.minMines), MINES_CONFIG.maxMines);
  return calculateMinesMultiplier(clampedMines, MINES_CONFIG.totalTiles - clampedMines);
}
var DIFFICULTY_MINE_COUNTS = {
  novice: 5,
  prospector: 8,
  abyss: 12,
  cataclysm: 16
};
function getDifficulty(id) {
  const count = DIFFICULTY_MINE_COUNTS[id] ?? 5;
  const tier = getDangerTier(count);
  return {
    id,
    name: tier.name,
    tagline: tier.tagline,
    minesPerBoard: count,
    initialMultiplierBps: getStartingMultiplier(count)
  };
}
var DIFFICULTIES = ["novice", "prospector", "abyss", "cataclysm"].map(getDifficulty);
function getStepMultiplier(idOrCount, step) {
  const count = typeof idOrCount === "number" ? idOrCount : DIFFICULTY_MINE_COUNTS[idOrCount] ?? 5;
  return calculateMinesMultiplier(count, step);
}
function formatMultiplier(multiplierBps) {
  const whole = Math.floor(multiplierBps / 1e4);
  const hundredths = Math.round(multiplierBps % 1e4 / 1e4 * 100);
  if (hundredths === 100) {
    return `${whole + 1}.00`;
  }
  return `${whole}.${hundredths.toString().padStart(2, "0")}`;
}
var ORES = {
  copper: { name: "Copper Ore", rarity: "common", icon: "copper" },
  moon: { name: "Moon Ore", rarity: "uncommon", icon: "moon" },
  cosmic: { name: "Cosmic Ore", rarity: "rare", icon: "cosmic" },
  golden: { name: "Golden Ore", rarity: "epic", icon: "golden" },
  shadow: { name: "Shadow Ore", rarity: "legendary", icon: "shadow" }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  DIFFICULTIES,
  DIFFICULTY_MINE_COUNTS,
  MINES_CONFIG,
  ORES,
  POPULAR_MINE_PRESETS,
  RF_DECIMALS,
  RF_UNIT,
  RULES,
  calculateMinesMultiplier,
  calculateRoundMultiplier,
  formatMultiplier,
  getDangerTier,
  getDifficulty,
  getPeakMultiplier,
  getStartingMultiplier,
  getStepMultiplier
});
