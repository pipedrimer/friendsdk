export type GamePhase =
  | "loading"
  | "ready"
  | "starting"
  | "playing"
  | "revealing"
  | "crashing"
  | "complete"
  | "error";

export type DifficultyId = "novice" | "prospector" | "abyss" | "cataclysm";

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

export type ScanResult = {
  tileId: number;
  signal: "treasure" | "danger" | "unclear";
  confidence: "low" | "medium" | "high";
  message: string;
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
  curseDigsRemaining: number;

  selectedTileIndex: number | null;
  revealedTileIds: number[];
  board: MineTile[];
  resources: ResourceReward[];

  startedAt: number;
  completedAt?: number;

  lastResolution?: TileResolution;
  lastScanResult?: ScanResult;
  history: string[];
  errorMessage?: string;
};

export type MineAction =
  | { type: "INIT_READY"; friendId: bigint; availableRf?: bigint }
  | { type: "START_RUN"; seed?: number }
  | { type: "RETURN_TO_READY" }
  | { type: "SET_DIFFICULTY"; difficulty: DifficultyId }
  | { type: "SET_MINE_COUNT"; count: number }
  | { type: "SET_STAKE"; stakeRf: bigint }
  | { type: "SELECT_TILE"; tileId: number }
  | { type: "FINISH_REVEAL" }
  | { type: "FINISH_CRASH" }
  | { type: "SCAN"; tileId: number }
  | { type: "CLEAR_SCAN" }
  | { type: "BANK" }
  | { type: "END_RUN" }
  | { type: "SET_ERROR"; message: string };
