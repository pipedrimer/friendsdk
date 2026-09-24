export type GamePhase =
  | "loading"
  | "ready"
  | "starting"
  | "playing"
  | "revealing"
  | "crashing"
  | "complete"
  | "error";

export type DifficultyId = "novice" | "prospector" | "abyss" | "cataclysm" | "inferno";

export type MineType = "red" | "yellow" | "purple" | "blue" | "green";

export type ResourceRarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

export type ResourceReward = {
  resourceId: string;
  name: string;
  amount: number;
  rarity: ResourceRarity;
  icon: string;
};

export type MineTile =
  | {
      id: number;
      kind: "rf";
      revealed: boolean;
      haulRf?: bigint;
    }
  | {
      id: number;
      kind: "resource";
      resourceId: string;
      name: string;
      rarity: ResourceRarity;
      amount: number;
      revealed: boolean;
      haulRf?: bigint;
    }
  | {
      id: number;
      kind: "mine";
      mineType: MineType;
      revealed: boolean;
      haulRf?: bigint;
    }
  | {
      id: number;
      kind: "special";
      specialType: "shield" | "boost";
      revealed: boolean;
      haulRf?: bigint;
    };

export type TileResolution =
  | {
      type: "rf";
      tileId: number;
      haulRf: bigint;
      wasBoosted: boolean;
      multiplierBps: number;
    }
  | {
      type: "resource";
      tileId: number;
      resource: ResourceReward;
      haulRf: bigint;
      multiplierBps: number;
    }
  | {
      type: "mine";
      tileId: number;
      mineType: MineType;
      wasShielded: boolean;
      lostRf: bigint;
    }
  | {
      type: "special";
      tileId: number;
      specialType: "shield" | "boost";
      haulRf: bigint;
      multiplierBps: number;
    };

export type FriendMood =
  | "idle"
  | "digging"
  | "treasure"
  | "bigTreasure"
  | "danger"
  | "explosion"
  | "banking";

/** Cosmetic slots layered over the canonical Friend sprite. */
export type CosmeticSlot = "coat" | "helmet" | "pickaxe" | "aura";

/** Achievement rule that grants a trophy cosmetic for free (no RF cost). */
export type CosmeticEarnRule =
  | { kind: "full-clear" }
  | { kind: "single-bank"; thresholdRf: bigint }
  | { kind: "session-banked"; thresholdRf: bigint }
  | { kind: "safe-digs"; threshold: number };

/**
 * A durable cosmetic: a one-time simulated-RF purchase from the Vault or a
 * free achievement trophy. Visual only — never changes odds or payouts.
 * Session-scoped (the sandbox has no storage); all RF is simulated.
 */
export type CosmeticItem = {
  id: string;
  slot: CosmeticSlot;
  name: string;
  blurb: string;
  /** Simulated RF price; 0n for achievement trophies. */
  priceRf: bigint;
  earn?: CosmeticEarnRule;
  /** Coat palette override (primary body / accent head colors). */
  palette?: { primary: string; accent: string };
  /** Single render color for helmet, pickaxe skin or aura. */
  color?: string;
};

export type CosmeticsState = {
  unlocked: string[];
  equipped: Record<CosmeticSlot, string | null>;
  /** Unlocks not yet seen in the Gear Locker (drives the HUD NEW badge). */
  newItems: string[];
};

/** Session counters that unlock achievement trophies. */
export type SessionStats = {
  safeDigs: number;
  bankedRf: bigint;
  bestSingleBankRf: bigint;
  fullClears: number;
};

export type MineRun = {
  phase: GamePhase;
  runId: string;
  friendId: bigint;

  difficulty: DifficultyId;
  mineCount: number;

  // Economy & Staking
  stakeRf: bigint;
  availableRf: bigint;
  atRiskRf: bigint;
  bankedRf: bigint;

  // Progressive per-tile multipliers (basis points: 10000 = 1.00x)
  currentMultiplierBps: number;
  nextMultiplierBps: number;

  depth: number;
  safeDigCount: number;

  shieldCharges: number;
  boostDigsRemaining: number;

  selectedTileIndex: number | null;
  revealedTileIds: number[];
  board: MineTile[];
  resources: ResourceReward[];

  startedAt: number;
  completedAt?: number;

  cosmetics: CosmeticsState;
  stats: SessionStats;

  lastResolution?: TileResolution;
  history: string[];
  errorMessage?: string;
};

export type MineAction =
  | { type: "INIT_READY"; friendId: bigint; availableRf?: bigint }
  | { type: "START_RUN"; seed?: number }
  | { type: "RETURN_TO_READY" }
  | { type: "SET_MINE_COUNT"; count: number }
  | { type: "SET_STAKE"; stakeRf: bigint }
  | { type: "SELECT_TILE"; tileId: number }
  | { type: "FINISH_REVEAL" }
  | { type: "FINISH_CRASH" }
  | { type: "BANK" }
  | { type: "END_RUN" }
  | { type: "SET_ERROR"; message: string }
  | { type: "PURCHASE_COSMETIC"; itemId: string }
  | { type: "EQUIP_COSMETIC"; itemId: string }
  | { type: "UNEQUIP_COSMETIC"; slot: CosmeticSlot }
  | { type: "ACK_COSMETICS" };
