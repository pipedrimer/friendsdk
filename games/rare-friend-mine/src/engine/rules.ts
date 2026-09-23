import type { ResourceRarity } from "../types/game.js";

export const RF_DECIMALS = 18n;
export const RF_UNIT = 10n ** RF_DECIMALS;

export const RULES = {
  startingRf: 10n * RF_UNIT,
  defaultStakeRf: 1n * RF_UNIT,
  minStakeRf: 1n * RF_UNIT,

  scannerCostRf: 1n * RF_UNIT,

  curseExtraCostRf: 1n * RF_UNIT,
  curseDurationDigs: 3,

  boostBonusMultiplierBps: 5000, // +0.50x to multiplier when boosted
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
  mineCrashReducedMotionMs: 350,
} as const;

export const MINES_CONFIG = {
  minMines: 5,
  maxMines: 24,
  defaultMines: 5,
  totalTiles: 25,
} as const;

/**
 * Multiplier model: fair-odds per-round growth with a house margin.
 *
 * The user-facing rule: the ROUND multiplier grows each safe dig (1.3x, 1.35x,
 * 1.4x, ...) and every win compounds the current haul. To keep the economy
 * sustainable we derive each round's multiplier from the live survival odds of
 * a 25-tile Mines board discounted by a small per-round house edge.
 *
 * For a board with `mineCount` mines, after `round-1` safe digs there are
 * remainingSafe = 25 - mineCount - (round-1) safe tiles and remainingTiles =
 * 25 - (round-1) tiles. Fair payout for the next round is
 * remainingTiles / remainingSafe, which grows every round. We apply the house
 * edge so the house keeps a margin (fair-odds EV drops below 100% per round).
 */
export const POPULAR_MINE_PRESETS = [5, 7, 10, 15, 20, 24] as const;

export type DangerTier = {
  id: string;
  name: string;
  tagline: string;
  color: string;
};

export function getDangerTier(mineCount: number): DangerTier {
  if (mineCount <= 6) return { id: "novice", name: "Novice", tagline: "Entry seams", color: "#10b981" };
  if (mineCount <= 10) return { id: "prospector", name: "Prospector", tagline: "Standard risk", color: "#38bdf8" };
  if (mineCount <= 15) return { id: "abyss", name: "Abyss", tagline: "Deep and deadly", color: "#a855f7" };
  if (mineCount <= 20) return { id: "cataclysm", name: "Cataclysm", tagline: "Extreme volatile hazard", color: "#f59e0b" };
  return { id: "inferno", name: "Inferno", tagline: "Insane risk, legendary payout", color: "#ef4444" };
}

/**
 * Per-round multiplier (in bps, 10000 = 1.00x) for the `round`-th safe dig.
 * Grows monotonically every round:
 *   round 1: remainingTiles / remainingSafe (no digs done yet)
 *   round 2: (25-1) / (safeTiles-1)
 *   round k: (25-(k-1)) / (safeTiles-(k-1))
 * A small house-edge discount (RULES.houseEdgeBps) keeps the house positive.
 */
export function calculateRoundMultiplier(mineCount: number, round: number): number {
  const clampedMines = Math.min(Math.max(mineCount, MINES_CONFIG.minMines), MINES_CONFIG.maxMines);
  const safeTiles = MINES_CONFIG.totalTiles - clampedMines;
  if (round <= 0) return 10000;
  if (round > safeTiles) round = safeTiles;
  const remainingTiles = MINES_CONFIG.totalTiles - (round - 1);
  const remainingSafe = safeTiles - (round - 1);
  if (remainingSafe <= 0) return 10000;
  const fairBps = Math.floor((remainingTiles * 10000) / remainingSafe);
  return Math.max(10001, Math.floor((fairBps * (10000 - RULES.houseEdgeBps)) / 10000));
}

/** Convenience helper for the starting (Round 1) multiplier */
export function getStartingMultiplier(mineCount: number): number {
  return calculateRoundMultiplier(mineCount, 1);
}

/**
 * Cumulative multiplier (bps) after `step` safe digs: the product of every
 * per-round multiplier applied so far (matching the engine's integer math).
 * This is the net multiple of the stake the current haul sits at.
 *   step 0 -> 10000 (1.00x)
 *   step k -> round(cum_{k-1} * round_k / 10000)
 */
export function calculateMinesMultiplier(mineCount: number, step: number): number {
  if (step <= 0) return 10000;
  const clampedMines = Math.min(Math.max(mineCount, MINES_CONFIG.minMines), MINES_CONFIG.maxMines);
  const safeTiles = MINES_CONFIG.totalTiles - clampedMines;
  const clampedStep = Math.min(step, safeTiles);
  let cumulativeBps = 10000;
  for (let round = 1; round <= clampedStep; round++) {
    const roundBps = calculateRoundMultiplier(clampedMines, round);
    cumulativeBps = Math.round((cumulativeBps * roundBps) / 10000);
  }
  return cumulativeBps;
}

/** Full-clear peak: cumulative multiplier after every safe tile is dug. */
export function getPeakMultiplier(mineCount: number): number {
  const clampedMines = Math.min(Math.max(mineCount, MINES_CONFIG.minMines), MINES_CONFIG.maxMines);
  return calculateMinesMultiplier(clampedMines, MINES_CONFIG.totalTiles - clampedMines);
}

/**
 * Legacy difficulty bridge: maps legacy difficulty IDs to mine counts.
 */
export const DIFFICULTY_MINE_COUNTS: Record<string, number> = {
  novice: 5,
  prospector: 8,
  abyss: 12,
  cataclysm: 16,
};

export function getDifficulty(id: string) {
  const count = DIFFICULTY_MINE_COUNTS[id] ?? 5;
  const tier = getDangerTier(count);
  return {
    id,
    name: tier.name,
    tagline: tier.tagline,
    minesPerBoard: count,
    initialMultiplierBps: getStartingMultiplier(count),
  };
}

export const DIFFICULTIES = ["novice", "prospector", "abyss", "cataclysm"].map(getDifficulty);

export function getStepMultiplier(idOrCount: string | number, step: number): number {
  const count = typeof idOrCount === "number" ? idOrCount : (DIFFICULTY_MINE_COUNTS[idOrCount] ?? 5);
  return calculateMinesMultiplier(count, step);
}

/** Format a multiplier (basis points) for display, e.g. 15000 -> "1.50", 12200 -> "1.22". */
export function formatMultiplier(multiplierBps: number): string {
  const whole = Math.floor(multiplierBps / 10000);
  const hundredths = Math.round(((multiplierBps % 10000) / 10000) * 100);
  if (hundredths === 100) {
    return `${whole + 1}.00`;
  }
  return `${whole}.${hundredths.toString().padStart(2, "0")}`;
}

export const ORES: Record<string, { name: string; rarity: ResourceRarity; icon: string }> = {
  copper: { name: "Copper Ore", rarity: "common", icon: "copper" },
  moon: { name: "Moon Ore", rarity: "uncommon", icon: "moon" },
  cosmic: { name: "Cosmic Ore", rarity: "rare", icon: "cosmic" },
  golden: { name: "Golden Ore", rarity: "epic", icon: "golden" },
  shadow: { name: "Shadow Ore", rarity: "legendary", icon: "shadow" },
};