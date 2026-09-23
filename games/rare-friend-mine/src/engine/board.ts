import type { DifficultyId, MineTile, MineType, ResourceRarity, ScanResult } from "../types/game.js";
import { DIFFICULTY_MINE_COUNTS, ORES, RULES } from "./rules.js";
import { mulberry32, shuffleWithRng } from "./random.js";

/**
 * Hazardous mine mix: mostly Red, greedy Yellow, cursed Purple, and Blue.
 * Always returns exactly `count` mines.
 */
export function buildMinePlan(count: number): MineType[] {
  const safeCount = Math.min(Math.max(count, 1), 24);
  const plan: MineType[] = [];

  for (let i = 0; i < safeCount; i++) {
    // Distribute varied mine types for tactical variety
    if (i % 5 === 0) {
      plan.push("red");
    } else if (i % 5 === 1) {
      plan.push("yellow");
    } else if (i % 5 === 2) {
      plan.push("red");
    } else if (i % 5 === 3) {
      plan.push("purple");
    } else {
      plan.push(safeCount >= 10 ? "blue" : "red");
    }
  }

  return plan.slice(0, safeCount);
}

/** Rarity weights so ores roll common-heavy with a legendary tail. Sums to 100. */
const ORE_RARITY_WEIGHTS: Array<{ rarity: ResourceRarity; weight: number }> = [
  { rarity: "common", weight: 46 },
  { rarity: "uncommon", weight: 28 },
  { rarity: "rare", weight: 16 },
  { rarity: "epic", weight: 7 },
  { rarity: "legendary", weight: 3 },
];

export function rollOreRarity(rng: () => number): ResourceRarity {
  const total = ORE_RARITY_WEIGHTS.reduce((sum, w) => sum + w.weight, 0);
  let roll = rng() * total;
  for (const entry of ORE_RARITY_WEIGHTS) {
    if (roll < entry.weight) return entry.rarity;
    roll -= entry.weight;
  }
  return "common";
}

/**
 * Rare finds are NOT guaranteed. Each board independently rolls for a Lucky
 * Green Mine, a Shield cache, a Boost cache, and a capped amount of ores.
 * Whatever does not roll stays a plain RF Deposit, so ores/progression are
 * genuinely scarce and every good tile is a surprise.
 */
export function rollRareFinds(rng: () => number, safeCount: number): {
  green: boolean;
  shield: boolean;
  boost: boolean;
  ores: ResourceRarity[];
} {
  if (safeCount <= 0) {
    return { green: false, shield: false, boost: false, ores: [] };
  }

  const green = rng() < RULES.greenFindChance;
  const shield = rng() < RULES.shieldFindChance;
  const boost = rng() < RULES.boostFindChance;

  const ores: ResourceRarity[] = [];
  if (rng() < RULES.oreFindChance) {
    const maxOres = Math.min(RULES.oreSlotsCap, safeCount);
    for (let i = 0; i < maxOres; i++) {
      // Each additional ore slot is increasingly unlikely.
      if (i > 0 && rng() >= 0.5) break;
      ores.push(rollOreRarity(rng));
    }
  }

  return { green, shield, boost, ores };
}

/**
 * Generate a 5x5 board for the given seed and selected mine count (or difficulty ID).
 * Dynamically scales mines and safe tile distribution according to the exact chosen count.
 * Rare finds (green mine, shields, boosts, ores) are rolled via rollRareFinds.
 */
export function createBoard(
  seed: number,
  minesOrDifficulty: number | DifficultyId = 5,
): MineTile[] {
  const rng = mulberry32(seed);

  const mineCount =
    typeof minesOrDifficulty === "number"
      ? Math.min(Math.max(minesOrDifficulty, 1), 24)
      : (DIFFICULTY_MINE_COUNTS[minesOrDifficulty] ?? 5);

  const safeCount = RULES.totalTiles - mineCount;

  // 1. Mines
  const mineTiles: MineTile[] = buildMinePlan(mineCount).map((type) => ({
    id: 0,
    kind: "mine",
    mineType: type,
    revealed: false,
  }));

  // 2. Safe Tiles composition (rare finds first)
  const safeTiles: MineTile[] = [];
  const { green, shield, boost, ores } = rollRareFinds(rng, safeCount);
  let remainingSafe = safeCount;

  if (green && remainingSafe >= 1) {
    safeTiles.push({
      id: 0,
      kind: "mine",
      mineType: "green",
      revealed: false,
    });
    remainingSafe--;
  }

  if (shield && remainingSafe >= 1) {
    safeTiles.push({ id: 0, kind: "special", specialType: "shield", revealed: false });
    remainingSafe--;
  }

  if (boost && remainingSafe >= 1) {
    safeTiles.push({ id: 0, kind: "special", specialType: "boost", revealed: false });
    remainingSafe--;
  }

  for (const rarity of ores) {
    if (remainingSafe < 1) break;
    const keys = Object.keys(ORES);
    // Pick a matching ore for the rolled rarity; fall back if none.
    const key = keys.find((k) => ORES[k].rarity === rarity) ?? keys[0];
    const ore = ORES[key];
    safeTiles.push({
      id: 0,
      kind: "resource",
      resourceId: key,
      name: ore.name,
      rarity: ore.rarity,
      amount: 1,
      revealed: false,
    });
    remainingSafe--;
  }

  // Everything left over is a plain RF Deposit.
  for (let i = 0; i < remainingSafe; i++) {
    safeTiles.push({ id: 0, kind: "rf", revealed: false });
  }

  const rawTiles: MineTile[] = [...mineTiles, ...safeTiles];

  // Shuffle and assign IDs 0..24
  const shuffled = shuffleWithRng(rawTiles, rng);
  return shuffled.slice(0, RULES.totalTiles).map((tile, index) => ({
    ...tile,
    id: index,
  }));
}

/**
 * Scanner gives directional hint without revealing the tile.
 * The scanner is deliberately imperfect (e.g. 75% accurate, 25% ambiguous).
 */
export function scanTileClue(tile: MineTile, rng: () => number): ScanResult {
  const roll = rng();
  const tileId = tile.id;

  if (tile.kind === "mine") {
    if (tile.mineType === "green") {
      // Lucky mine emits emerald energy
      return {
        tileId,
        signal: roll < 0.7 ? "treasure" : "unclear",
        confidence: "medium",
        message: "The Rare Friends miner senses a strange green aura vibrating deep within the rock.",
      };
    }

    if (roll < 0.75) {
      return {
        tileId,
        signal: "danger",
        confidence: "high",
        message: "The Rare Friends miner trembles! Seismic sensors detect a volatile explosive mine.",
      };
    } else {
      return {
        tileId,
        signal: "unclear",
        confidence: "low",
        message: "Acoustic distortion... rock density echoes unpredictably.",
      };
    }
  }

  if (tile.kind === "rf" || tile.kind === "resource" || tile.kind === "special") {
    if (roll < 0.75) {
      return {
        tileId,
        signal: "treasure",
        confidence: "high",
        message: "A resonant mineral pulse echoes! Safe ore seam detected.",
      };
    } else {
      return {
        tileId,
        signal: "unclear",
        confidence: "low",
        message: "Faint signal detected, but depth readings are muffled.",
      };
    }
  }

  return {
    tileId,
    signal: "unclear",
    confidence: "medium",
    message: "The geological scanner returns indeterminate readings.",
  };
}