import type { DifficultyId, ResourceRarity } from "../types/game.js";

export const RF_DECIMALS = 18n;
export const RF_UNIT = 10n ** RF_DECIMALS;

export const RULES = {
  startingRf: 10n * RF_UNIT,
  defaultStakeRf: 1n * RF_UNIT,
  minStakeRf: 1n * RF_UNIT,

  /**
   * Hard ceiling on a single run's stake, regardless of how much RF the
   * player holds.
   *
   * A live player's balance is their real wallet balance and is not something
   * this game can bound, so the amount the developer must hold as backing
   * scales as (player balance x yield cap). Capping the *stake* is what makes
   * the yield cap safe to raise: the exposure becomes this constant times the
   * cap, instead of a whale's balance times the cap.
   *
   * Denominated in RF, not USD. 7,331 RF was *chosen* because it was $10 at the
   * $0.001364/RF reference price on 2026-09-28, but the number is fixed in RF
   * and its dollar value is allowed to drift with the token price. Backing has
   * to be stable, and backing is denominated in RF. The live contract must take
   * this as a governance parameter, not a literal, so it can be moved without a
   * redeploy if RF's price moves materially.
   *
   * It is a governance constant, not a tuning knob -- the backing requirement is
   * `maxStakeRf x maxHaulMultipleBps`, so raising one obliges a decision on the
   * other. A test pins that product at 73,310,000 RF so they cannot drift apart
   * silently.
   */
  maxStakeRf: 7331n * RF_UNIT,

  boostBonusMultiplierBps: 5000, // +0.50x to multiplier when boosted
  boostDigs: 2,

  boardRows: 5,
  boardCols: 5,
  totalTiles: 25,

  depthEverySafeDigs: 3,
  maxDepth: 4,

  greenMineMultiplier: 2n,

  // Per-round house edge applied to each fair-odds multiplier. The rarity of
  // rare finds below is tuned so that the BEST legal strategy (not just a
  // cautious one) still loses RF to the house on every selectable mine count.
  // Verified by tests/economy-sim.ts, which sweeps every bank policy.
  houseEdgeBps: 900,

  // The seam has a yield limit: no matter how deep you dig, a single delve can
  // never pay more than this multiple of the stake. The raw curve is far larger
  // (a 10-mine full clear is ~794,000x), so without this the advertised peak
  // would be an unbackable promise.
  //
  // Paired with `maxStakeRf`, the developer's worst-case backing for a run in
  // flight is `maxStakeRf x maxHaulMultipleBps` = 7,331 RF x 10,000 = 73,310,000
  // RF, and that figure is independent of how much RF any player holds. The
  // house edge is unaffected by this choice: measured across every mine count
  // and cap from 250x to 1,000,000x it stays at 9-13%, because the per-round
  // edge does the work and the full clear is far too rare to move the mean.
  maxHaulMultipleBps: 10_000 * 10000,

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

/**
 * Tune the win here: explicit per-round multipliers (bps, 10000 = 1.00x) for
 * each preset mines count. These override the derived fair-odds values below.
 * The engine, simulation, and Help table all read this same table.
 */
export const MULTIPLIER_TABLE: Record<number, number[]> = {
  5: [11375, 11494, 11627, 11776, 11943, 12133, 12349, 12599, 12891, 13235, 13650, 14155, 14787, 15599, 16683, 18200, 20475, 24266, 31850, 54600],
  7: [12638, 12846, 13081, 13346, 13650, 13999, 14408, 14890, 15470, 16177, 17062, 18200, 19716, 21840, 25025, 30333, 40950, 72800],
  10: [15166, 15599, 16099, 16683, 17371, 18200, 19211, 20475, 22099, 24266, 27300, 31850, 39433, 54600, 100100],
  15: [22750, 24266, 26162, 28599, 31850, 36400, 43225, 54600, 77350, 145600],
  20: [45500, 54600, 69766, 100100, 191100],
  24: [227500],
};

export type MineDefinition = {
  name: string;
  /** What the mine does, shown on the tile tooltip and the Codex. */
  blurb: string;
  /** Shown when this mine ends a run. */
  failureLine: string;
};

/**
 * The five tile kinds. Green is lucky rather than lethal: it doubles the round
 * it replaces. Everything else takes the whole at-risk haul.
 */
export const MINES: Record<string, MineDefinition> = {
  red: {
    name: "Curse Vein",
    blurb: "The common hazard. A pressure-burst pocket that vents the whole at-risk haul.",
    failureLine: "A pressure burst blew the seam open. The whole at-risk haul is gone.",
  },
  yellow: {
    name: "Aquifer Rupture",
    blurb: "Greedy yellow. A flooded pocket — the Deep-Seam crews say it is counting your stake as it fills.",
    failureLine: "The aquifer let go. Floodwater took the at-risk haul down with it.",
  },
  purple: {
    name: "Greed Trap",
    blurb: "Cursed purple. It is bait. The Vault logs every Greed Trap loss under the same heading as a bad bet.",
    failureLine: "A Greed Trap closed around the haul and did not let go.",
  },
  blue: {
    name: "Deep-Seam Chill",
    blurb: "A cold blue seam. It does not add anything — it simply ends the delve where it stands.",
    failureLine: "Deep-Seam chill froze the run solid. The at-risk haul went with it.",
  },
  green: {
    name: "Lucky Seam",
    blurb: "Doubles the round it replaces, including any active Boost. The round still counts.",
    failureLine: "",
  },
};

export function getMineDefinition(mineType: string): MineDefinition {
  return MINES[mineType] ?? MINES.red;
}

export type DangerTier = {
  id: DifficultyId;
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
  const tuned = MULTIPLIER_TABLE[clampedMines];
  if (tuned && tuned[round - 1] !== undefined) return tuned[round - 1];
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
 * per-round multiplier applied so far, clamped to the seam yield limit
 * (RULES.maxHaulMultipleBps). This is the net multiple of the stake the current
 * haul actually sits at, matching the engine's integer math.
 *   step 0 -> 10000 (1.00x)
 *   step k -> round(cum_{k-1} * round_k / 10000), never above the yield cap
 */
export function calculateMinesMultiplier(mineCount: number, step: number): number {
  const clampedMines = Math.min(Math.max(mineCount, MINES_CONFIG.minMines), MINES_CONFIG.maxMines);
  const safeTiles = MINES_CONFIG.totalTiles - clampedMines;
  const clampedStep = Math.min(step, safeTiles);
  let cumulativeBps = 10000;
  for (let round = 1; round <= clampedStep; round++) {
    const roundBps = calculateRoundMultiplier(clampedMines, round);
    cumulativeBps = Math.round((cumulativeBps * roundBps) / 10000);
    if (cumulativeBps > RULES.maxHaulMultipleBps) return RULES.maxHaulMultipleBps;
  }
  return cumulativeBps;
}

/**
 * The raw compounding curve with no yield cap applied. The capped value above is
 * what a player can actually collect; this exists for economy analysis only and
 * must never be shown as a payout.
 */
export function getUncappedPeakMultiplier(mineCount: number): number {
  const clampedMines = Math.min(Math.max(mineCount, MINES_CONFIG.minMines), MINES_CONFIG.maxMines);
  return calculateUncappedMinesMultiplier(clampedMines, MINES_CONFIG.totalTiles - clampedMines);
}

function calculateUncappedMinesMultiplier(mineCount: number, step: number): number {
  const safeTiles = MINES_CONFIG.totalTiles - mineCount;
  const clampedStep = Math.min(step, safeTiles);
  let cumulativeBps = 10000;
  for (let round = 1; round <= clampedStep; round++) {
    cumulativeBps = Math.round((cumulativeBps * calculateRoundMultiplier(mineCount, round)) / 10000);
  }
  return cumulativeBps;
}

/** Full-clear peak: cumulative multiplier after every safe tile is dug. */
export function getPeakMultiplier(mineCount: number): number {
  const clampedMines = Math.min(Math.max(mineCount, MINES_CONFIG.minMines), MINES_CONFIG.maxMines);
  return calculateMinesMultiplier(clampedMines, MINES_CONFIG.totalTiles - clampedMines);
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

/**
 * The seam yield limit, as a plain multiple of the stake: 10,000 means a single
 * delve can pay at most 10,000x what you put in. Used for display and for the
 * "yield cap reached" warning in the HUD.
 */
export function getMaxHaulMultiple(): number {
  return RULES.maxHaulMultipleBps / 10000;
}

/** Format the yield limit for display, e.g. "10,000x". */
export function formatMaxHaulMultiple(): string {
  return `${Math.round(getMaxHaulMultiple()).toLocaleString("en-US")}x`;
}

/** The per-run stake ceiling as whole RF, e.g. 7331. */
export function getMaxStakeWhole(): number {
  return Number(RULES.maxStakeRf / RF_UNIT);
}

/** Format the stake ceiling for display, e.g. "7,331 RF". */
export function formatMaxStakeRf(): string {
  return `${getMaxStakeWhole().toLocaleString("en-US")} RF`;
}

/** Format the largest single-delve payout from the ceiling stake, e.g. "73,310,000 RF". */
export function formatMaxHaulAtMaxStake(): string {
  const rf = (RULES.maxStakeRf * BigInt(RULES.maxHaulMultipleBps)) / 10000n;
  const whole = rf / RF_UNIT;
  return `${whole.toLocaleString("en-US")} RF`;
}

/**
 * The lucky seam needs room to appear. On a board with only one or two safe
 * tiles there is no depth for luck to compound, so no green mine is placed.
 * Without this, a 24-mine board pays a single 22x dig that is doubled by green
 * more often than the edge can absorb.
 */
export function canSpawnGreenMine(safeTileCount: number): boolean {
  return safeTileCount >= 3;
}

export type OreDefinition = {
  name: string;
  rarity: ResourceRarity;
  icon: string;
  /** Shown on the ore tooltip and in the Codex panel. */
  blurb: string;
};

export const ORES: Record<string, OreDefinition> = {
  copper: {
    name: "Copper Ore",
    rarity: "common",
    icon: "copper",
    blurb: "Dull red seams near the surface. Copper is worthless on its own — every Vault ledger starts here.",
  },
  moon: {
    name: "Moon Ore",
    rarity: "uncommon",
    icon: "moon",
    blurb: "Pale bands that hold the seam's silver light. The Deep-Seam crews use it to read water pressure.",
  },
  cosmic: {
    name: "Cosmic Ore",
    rarity: "rare",
    icon: "cosmic",
    blurb: "Dark stone shot through with slow-moving stars. Cartographers argue about where it is actually from.",
  },
  golden: {
    name: "Golden Ore",
    rarity: "epic",
    icon: "golden",
    blurb: "Warm, heavy and stubborn. The only ore the Vault will quote a real price for.",
  },
  shadow: {
    name: "Shadow Ore",
    rarity: "legendary",
    icon: "shadow",
    blurb: "It absorbs lamplight and stays cold. Nine Deep-Seam shafts went dark the night one of these came up.",
  },
};