import type { DifficultyId, MineAction, MineRun, MineTile, ScanResult, TileResolution } from "../types/game.js";
import { createBoard, scanTileClue } from "./board.js";
import {
  calculateGreenMineMultiplier,
  calculateStepHaul,
  formatRf,
} from "./economy.js";
import { createSeed, mulberry32 } from "./random.js";
import {
  calculateRoundMultiplier,
  DIFFICULTY_MINE_COUNTS,
  formatMultiplier,
  getDangerTier,
  MINES_CONFIG,
  RULES,
} from "./rules.js";


export function createInitialState(friendId: bigint = 0n): MineRun {
  const defaultMines = MINES_CONFIG.defaultMines;
  const tier = getDangerTier(defaultMines);
  return {
    phase: "ready",
    runId: "",
    friendId,
    difficulty: tier.id as DifficultyId,
    mineCount: defaultMines,
    stakeRf: RULES.defaultStakeRf,
    availableRf: RULES.startingRf,
    atRiskRf: 0n,
    bankedRf: 0n,
    currentMultiplierBps: 10000, // 1.00x base
    nextMultiplierBps: calculateRoundMultiplier(defaultMines, 1),
    depth: 1,
    safeDigCount: 0,
    shieldCharges: 0,
    boostDigsRemaining: 0,
    curseDigsRemaining: 0,
    selectedTileIndex: null,
    revealedTileIds: [],
    board: [],
    resources: [],
    startedAt: 0,
    history: [],
  };
}

export function mineReducer(state: MineRun, action: MineAction): MineRun {
  switch (action.type) {
    case "INIT_READY": {
      const avail = action.availableRf ?? state.availableRf;
      const validStake = state.stakeRf <= avail && state.stakeRf >= RULES.minStakeRf
        ? state.stakeRf
        : avail >= RULES.minStakeRf ? RULES.minStakeRf : avail;

      return {
        ...state,
        phase: "ready",
        friendId: action.friendId,
        availableRf: avail,
        stakeRf: validStake,
        nextMultiplierBps: calculateRoundMultiplier(state.mineCount, 1),
        errorMessage: undefined,
      };
    }

    case "RETURN_TO_READY": {
      if (state.phase !== "complete") return state;
      const validStake = state.stakeRf <= state.availableRf && state.stakeRf >= RULES.minStakeRf
        ? state.stakeRf
        : state.availableRf >= RULES.minStakeRf ? RULES.minStakeRf : state.availableRf;

      return {
        ...state,
        phase: "ready",
        runId: "",
        stakeRf: validStake,
        atRiskRf: 0n,
        bankedRf: 0n,
        currentMultiplierBps: 10000,
        nextMultiplierBps: calculateRoundMultiplier(state.mineCount, 1),
        depth: 1,
        safeDigCount: 0,
        shieldCharges: 0,
        boostDigsRemaining: 0,
        curseDigsRemaining: 0,
        selectedTileIndex: null,
        revealedTileIds: [],
        board: [],
        resources: [],
        startedAt: 0,
        completedAt: undefined,
        lastResolution: undefined,
        lastScanResult: undefined,
        errorMessage: undefined,
      };
    }

    case "SET_DIFFICULTY": {
      if (state.phase !== "ready") return state;
      const count = DIFFICULTY_MINE_COUNTS[action.difficulty] ?? 5;
      return {
        ...state,
        difficulty: action.difficulty,
        mineCount: count,
        nextMultiplierBps: calculateRoundMultiplier(count, 1),
        errorMessage: undefined,
      };
    }

    case "SET_MINE_COUNT": {
      if (state.phase !== "ready") return state;
      const clamped = Math.min(Math.max(action.count, MINES_CONFIG.minMines), MINES_CONFIG.maxMines);
      const tier = getDangerTier(clamped);
      return {
        ...state,
        mineCount: clamped,
        difficulty: tier.id as DifficultyId,
        nextMultiplierBps: calculateRoundMultiplier(clamped, 1),
        errorMessage: undefined,
      };
    }

    case "SET_STAKE": {
      if (state.phase !== "ready") return state;
      let targetStake = action.stakeRf;
      if (targetStake < RULES.minStakeRf) targetStake = RULES.minStakeRf;
      if (state.availableRf > 0n && targetStake > state.availableRf) {
        targetStake = state.availableRf;
      }
      return {
        ...state,
        stakeRf: targetStake,
        errorMessage: undefined,
      };
    }

    case "START_RUN": {
      if (state.availableRf < state.stakeRf) {
        return {
          ...state,
          errorMessage: `Insufficient simulated RF to delve with ${formatRf(state.stakeRf)} RF stake.`,
        };
      }

      const seed = action.seed ?? createSeed();
      const tier = getDangerTier(state.mineCount);
      const board = createBoard(seed, state.mineCount);
      const runId = `run_${Date.now()}_${seed}`;
      const firstStepBps = calculateRoundMultiplier(state.mineCount, 1);

      return {
        ...state,
        phase: "playing",
        runId,
        availableRf: state.availableRf - state.stakeRf,
        atRiskRf: 0n,
        bankedRf: 0n,
        currentMultiplierBps: 10000,
        nextMultiplierBps: firstStepBps,
        depth: 1,
        safeDigCount: 0,
        shieldCharges: 0,
        boostDigsRemaining: 0,
        curseDigsRemaining: 0,
        selectedTileIndex: null,
        revealedTileIds: [],
        board,
        resources: [],
        startedAt: Date.now(),
        completedAt: undefined,
        lastResolution: undefined,
        lastScanResult: undefined,
        history: [
          `Delve started (${tier.name}, ${state.mineCount} mines, Seed: ${seed}). Stake: ${formatRf(state.stakeRf)} RF.`,
        ],
        errorMessage: undefined,
      };
    }

    case "SELECT_TILE": {
      if (state.phase !== "playing") return state;
      const tile = state.board[action.tileId];
      if (!tile || tile.revealed) return state;

      let available = state.availableRf;
      let curseRemaining = state.curseDigsRemaining;
      if (curseRemaining > 0) {
        if (available >= RULES.curseExtraCostRf) {
          available -= RULES.curseExtraCostRf;
        }
        curseRemaining -= 1;
      }

      return {
        ...state,
        phase: "revealing",
        availableRf: available,
        curseDigsRemaining: curseRemaining,
        selectedTileIndex: action.tileId,
        errorMessage: undefined,
      };
    }

    case "FINISH_REVEAL": {
      if (state.phase !== "revealing" || state.selectedTileIndex === null) {
        return state;
      }

      const tileId = state.selectedTileIndex;
      const tile = state.board[tileId];
      if (!tile) return state;

      const updatedBoard = state.board.map((t) =>
        t.id === tileId ? ({ ...t, revealed: true } as MineTile) : t,
      );
      const revealedIds = [...state.revealedTileIds, tileId];
      const safeDigsAfter = state.safeDigCount + 1;

      // Growing per-round multiplier. Every safe dig applies a NEW round
      // multiplier (round 1, round 2, ...) that grows monotonically, and the
      // multiplier compounds the CURRENT at-risk haul — never the stake again.
      //   stake 1 RF -> round 1 @ 1.3x -> 1.30 RF -> round 2 @ 1.35x -> 1.755 RF
      // Boost adds +0.50x (RULES.boostBonusMultiplierBps) to the applied round.
      const isBoosted = state.boostDigsRemaining > 0;
      const newBoost = isBoosted ? state.boostDigsRemaining - 1 : 0;
      const roundBps = calculateRoundMultiplier(state.mineCount, safeDigsAfter);
      const appliedRoundBps = isBoosted
        ? roundBps + RULES.boostBonusMultiplierBps
        : roundBps;
      const currentHaul = state.atRiskRf > 0n ? state.atRiskRf : state.stakeRf;
      const newAtRisk =
        currentHaul > 0n
          ? (currentHaul * BigInt(appliedRoundBps)) / 10000n
          : 0n;
      const newCurrentMultiplierBps =
        state.stakeRf > 0n
          ? Math.round(Number((newAtRisk * 10000n) / state.stakeRf))
          : 10000;
      const nextRoundBps =
        safeDigsAfter < MINES_CONFIG.totalTiles - state.mineCount
          ? calculateRoundMultiplier(state.mineCount, safeDigsAfter + 1)
          : appliedRoundBps;

      // 1. Mineral Node (Safe RF Tile)
      if (tile.kind === "rf") {
        const haulBoard = updatedBoard.map((t) =>
          t.id === tileId ? ({ ...t, haulRf: newAtRisk } as MineTile) : t,
        );
        return {
          ...state,
          phase: "playing",
          atRiskRf: newAtRisk,
          currentMultiplierBps: newCurrentMultiplierBps,
          nextMultiplierBps: nextRoundBps,
          safeDigCount: safeDigsAfter,
          depth: nextDepth(safeDigsAfter),
          boostDigsRemaining: newBoost,
          board: haulBoard,
          revealedTileIds: revealedIds,
          selectedTileIndex: null,
          lastResolution: {
            type: "rf",
            tileId,
            haulRf: newAtRisk,
            wasBoosted: isBoosted,
            multiplierBps: appliedRoundBps,
          },
          history: [
            ...state.history,
            `Dug tile #${tileId}: Safe seam! Haul grew to ${formatRf(newAtRisk)} RF (round ${safeDigsAfter})${isBoosted ? " [Boosted!]" : ""}.`,
          ],
        };
      }

      // 2. Resource Ore Tile (collectible — never adds RF to the bank)
      if (tile.kind === "resource") {
        const reward = {
          resourceId: tile.resourceId,
          name: tile.name,
          amount: tile.amount,
          rarity: tile.rarity,
          icon: tile.resourceId,
        };
        const haulBoard = updatedBoard.map((t) =>
          t.id === tileId ? ({ ...t, haulRf: newAtRisk } as MineTile) : t,
        );

        return {
          ...state,
          phase: "playing",
          resources: [...state.resources, reward],
          atRiskRf: newAtRisk,
          currentMultiplierBps: newCurrentMultiplierBps,
          nextMultiplierBps: nextRoundBps,
          safeDigCount: safeDigsAfter,
          depth: nextDepth(safeDigsAfter),
          boostDigsRemaining: newBoost,
          board: haulBoard,
          revealedTileIds: revealedIds,
          selectedTileIndex: null,
          lastResolution: {
            type: "resource",
            tileId,
            resource: reward,
            haulRf: newAtRisk,
            multiplierBps: appliedRoundBps,
          },
          history: [
            ...state.history,
            `Discovered rare ore: ${tile.name}! Haul grew to ${formatRf(newAtRisk)} RF.`,
          ],
        };
      }

      // 3. Special Cache Tile (rare find: +1 Shield or Boost charges)
      if (tile.kind === "special") {
        const haulBoard = updatedBoard.map((t) =>
          t.id === tileId ? ({ ...t, haulRf: newAtRisk } as MineTile) : t,
        );
        if (tile.specialType === "shield") {
          return {
            ...state,
            phase: "playing",
            shieldCharges: state.shieldCharges + 1,
            atRiskRf: newAtRisk,
            currentMultiplierBps: newCurrentMultiplierBps,
            nextMultiplierBps: nextRoundBps,
            safeDigCount: safeDigsAfter,
            depth: nextDepth(safeDigsAfter),
            boostDigsRemaining: newBoost,
            board: haulBoard,
            revealedTileIds: revealedIds,
            selectedTileIndex: null,
            lastResolution: {
              type: "special",
              tileId,
              specialType: "shield",
              haulRf: newAtRisk,
              multiplierBps: appliedRoundBps,
            },
            history: [
              ...state.history,
              `Found a Shield cache! +1 charge. Haul grew to ${formatRf(newAtRisk)} RF.`,
            ],
          };
        }

        return {
          ...state,
          phase: "playing",
          boostDigsRemaining: newBoost + RULES.boostDigs,
          atRiskRf: newAtRisk,
          currentMultiplierBps: newCurrentMultiplierBps,
          nextMultiplierBps: nextRoundBps,
          safeDigCount: safeDigsAfter,
          depth: nextDepth(safeDigsAfter),
          board: haulBoard,
          revealedTileIds: revealedIds,
          selectedTileIndex: null,
          lastResolution: {
            type: "special",
            tileId,
            specialType: "boost",
            haulRf: newAtRisk,
            multiplierBps: appliedRoundBps,
          },
          history: [
            ...state.history,
            `Found a Boost cache! +${RULES.boostDigs} boosted digs. Haul grew to ${formatRf(newAtRisk)} RF.`,
          ],
        };
      }

      // 4. Mine Tile
      if (tile.kind === "mine") {
        // Shield Protection Check
        if (state.shieldCharges > 0 && tile.mineType !== "green") {
          return {
            ...state,
            phase: "playing",
            shieldCharges: state.shieldCharges - 1,
            board: updatedBoard,
            revealedTileIds: revealedIds,
            selectedTileIndex: null,
            lastResolution: {
              type: "mine",
              tileId,
              mineType: tile.mineType,
              wasShielded: true,
              lostRf: 0n,
            },
            history: [
              ...state.history,
              `Mine encounter (${tile.mineType}) absorbed by active Shield! Current ${formatRf(state.atRiskRf)} RF haul preserved.`,
            ],
          };
        }

        // Green Mine (Lucky: doubles the CURRENT haul, keeps the run going)
        if (tile.mineType === "green") {
          const boostedMultiplierBps = calculateGreenMineMultiplier(state.currentMultiplierBps);
          const doubledHaul = calculateStepHaul(state.stakeRf, boostedMultiplierBps);

          return {
            ...state,
            phase: "playing",
            atRiskRf: doubledHaul,
            currentMultiplierBps: boostedMultiplierBps,
            nextMultiplierBps: nextRoundBps,
            safeDigCount: safeDigsAfter,
            depth: nextDepth(safeDigsAfter),
            board: updatedBoard,
            revealedTileIds: revealedIds,
            selectedTileIndex: null,
            lastResolution: {
              type: "mine",
              tileId,
              mineType: "green",
              wasShielded: false,
              lostRf: 0n,
            },
            history: [
              ...state.history,
              `Lucky Green Mine! Haul DOUBLED to ${formatRf(doubledHaul)} RF (${formatMultiplier(boostedMultiplierBps)}x)!`,
            ],
          };
        }

        // Any unshielded hazardous mine detonates -> total loss of haul
        const lostRf = state.atRiskRf;
        return {
          ...state,
          phase: "crashing",
          atRiskRf: 0n,
          bankedRf: 0n,
          board: updatedBoard,
          revealedTileIds: revealedIds,
          selectedTileIndex: null,
          completedAt: undefined,
          lastResolution: {
            type: "mine",
            tileId,
            mineType: tile.mineType,
            wasShielded: false,
            lostRf,
          },
          history: [
            ...state.history,
            `MINE DETONATION (${tile.mineType}): lost all ${formatRf(lostRf)} at-risk RF.`,
          ],
        };
      }

      return state;
    }

    case "FINISH_CRASH": {
      if (state.phase !== "crashing") return state;
      return {
        ...state,
        phase: "complete",
        completedAt: Date.now(),
      };
    }

    case "SCAN": {
      if (state.phase !== "playing") return state;
      if (state.availableRf < RULES.scannerCostRf) {
        return {
          ...state,
          errorMessage: `Not enough simulated RF to use Scanner (${formatRf(RULES.scannerCostRf)} RF required).`,
        };
      }

      const tile = state.board[action.tileId];
      if (!tile || tile.revealed) return state;

      const rng = mulberry32(Date.now() + action.tileId);
      const scanResult = scanTileClue(tile, rng);

      return {
        ...state,
        availableRf: state.availableRf - RULES.scannerCostRf,
        lastScanResult: scanResult,
        history: [...state.history, `Scanned tile #${action.tileId}: ${scanResult.signal}`],
        errorMessage: undefined,
      };
    }

    case "CLEAR_SCAN": {
      return {
        ...state,
        lastScanResult: undefined,
      };
    }

    case "BANK": {
      if (state.phase !== "playing") return state;

      const securedRf = state.atRiskRf;
      const totalAvailable = state.availableRf + securedRf;

      return {
        ...state,
        phase: "complete",
        availableRf: totalAvailable,
        bankedRf: securedRf,
        atRiskRf: 0n,
        completedAt: Date.now(),
        history: [
          ...state.history,
          `BANKED! Secured exactly ${formatRf(securedRf)} RF (${formatMultiplier(state.currentMultiplierBps)}x of stake).`,
        ],
        errorMessage: undefined,
      };
    }

    case "END_RUN": {
      return {
        ...state,
        phase: "complete",
        atRiskRf: 0n,
        completedAt: Date.now(),
        history: [...state.history, "Run ended."],
      };
    }

    case "SET_ERROR": {
      return {
        ...state,
        errorMessage: action.message,
      };
    }

    default:
      return state;
  }
}

function nextDepth(safeDigs: number): number {
  return Math.min(RULES.maxDepth, 1 + Math.floor(safeDigs / RULES.depthEverySafeDigs));
}