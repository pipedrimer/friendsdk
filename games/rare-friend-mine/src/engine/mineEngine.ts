import type { MineAction, MineRun, MineTile, SessionStats, TileResolution } from "../types/game.js";
import { createBoard } from "./board.js";
import {
  applyMaxHaul,
  calculateGreenMineMultiplier,
  calculateStepHaul,
  formatRf,
} from "./economy.js";
import { createSeed } from "./random.js";
import {
  calculateRoundMultiplier,
  formatMultiplier,
  getDangerTier,
  getMineDefinition,
  MINES_CONFIG,
  RULES,
} from "./rules.js";
import {
  createCosmeticsState,
  createSessionStats,
  formatCosmeticPrice,
  getCosmeticItem,
  isCosmeticOwned,
  newlyEarnedIds,
} from "./cosmetics.js";


const OUT_OF_RF_MESSAGE =
  "Out of simulated RF. Reset your preview balance to keep delving.";

export function createInitialState(friendId: bigint = 0n): MineRun {
  const defaultMines = MINES_CONFIG.defaultMines;
  const tier = getDangerTier(defaultMines);
  return {
    phase: "ready",
    runId: "",
    friendId,
    difficulty: tier.id,
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
    selectedTileIndex: null,
    revealedTileIds: [],
    board: [],
    resources: [],
    startedAt: 0,
    cosmetics: createCosmeticsState(),
    stats: createSessionStats(),
    history: [],
  };
}

/** Unlock any freshly-earned trophy cosmetics for the given stats. */
function applyEarned(next: MineRun): MineRun {
  const earned = newlyEarnedIds(next.cosmetics, next.stats);
  if (earned.length === 0) return next;
  const history = [
    ...next.history,
    ...earned.map((itemId) => {
      const item = getCosmeticItem(itemId);
      return `EARNED GEAR: ${item?.name ?? itemId} unlocked in the Gear Locker!`;
    }),
  ];
  return {
    ...next,
    cosmetics: {
      ...next.cosmetics,
      unlocked: [...next.cosmetics.unlocked, ...earned],
      newItems: [...next.cosmetics.newItems, ...earned],
    },
    history,
  };
}

/** Stats + achievement bookkeeping after a dig resolves. */
function applyDigProgress(next: MineRun, prev: MineRun): MineRun {
  const gainedSafeDig = next.safeDigCount === prev.safeDigCount + 1;
  if (!gainedSafeDig) return applyEarned(next);
  const stats: SessionStats = { ...next.stats, safeDigs: next.stats.safeDigs + 1 };
  const totalSafeTiles = MINES_CONFIG.totalTiles - next.mineCount;
  const wasFullClear = next.phase === "complete" && next.safeDigCount >= totalSafeTiles;
  const withClear = wasFullClear
    ? {
        ...stats,
        fullClears: stats.fullClears + 1,
        bankedRf: stats.bankedRf + next.bankedRf,
        bestSingleBankRf:
          next.bankedRf > stats.bestSingleBankRf
            ? next.bankedRf
            : stats.bestSingleBankRf,
      }
    : stats;
  return applyEarned({ ...next, stats: withClear });
}

export function mineReducer(state: MineRun, action: MineAction): MineRun {
  switch (action.type) {
    case "INIT_READY": {
      const avail = action.availableRf ?? state.availableRf;
      const validStake = state.stakeRf <= avail && state.stakeRf >= RULES.minStakeRf
        ? state.stakeRf
        : avail >= RULES.minStakeRf ? RULES.minStakeRf : avail;

      // A different Friend account starts a fresh session gear locker.
      const sameFriend = state.friendId === action.friendId;

      return {
        ...state,
        phase: "ready",
        friendId: action.friendId,
        availableRf: avail,
        stakeRf: validStake,
        nextMultiplierBps: calculateRoundMultiplier(state.mineCount, 1),
        cosmetics: sameFriend ? state.cosmetics : createCosmeticsState(),
        stats: sameFriend ? state.stats : createSessionStats(),
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
        selectedTileIndex: null,
        revealedTileIds: [],
        board: [],
        resources: [],
        startedAt: 0,
        completedAt: undefined,
        lastResolution: undefined,
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
        difficulty: tier.id,
        nextMultiplierBps: calculateRoundMultiplier(clamped, 1),
        errorMessage: undefined,
      };
    }

    case "SET_STAKE": {
      if (state.phase !== "ready") return state;
      let targetStake = action.stakeRf;
      if (targetStake < RULES.minStakeRf) targetStake = RULES.minStakeRf;
      // The stake ceiling is a backing control, not a preference: it bounds
      // `stake x yield cap` for every run regardless of wallet balance. Clamp
      // here so no caller can route around it, and re-clamp on START_RUN below.
      if (targetStake > RULES.maxStakeRf) targetStake = RULES.maxStakeRf;
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
      // A run must be funded by at least the minimum stake. Without this the
      // guard below is `0n < 0n`, which accepts a zero-stake run that can
      // never pay out and leaves the session with no way to stake again.
      if (state.stakeRf < RULES.minStakeRf) {
        return {
          ...state,
          errorMessage: OUT_OF_RF_MESSAGE,
        };
      }

      if (state.availableRf < state.stakeRf) {
        return {
          ...state,
          errorMessage: `Insufficient simulated RF to delve with ${formatRf(state.stakeRf)} RF stake. ${OUT_OF_RF_MESSAGE}`,
        };
      }

      // Re-assert the ceiling at run start. SET_STAKE already clamps, but the
      // stake is part of persisted state, so an inflated value from an older
      // save or a hand-built state must not be able to open an over-sized run.
      if (state.stakeRf > RULES.maxStakeRf) {
        return {
          ...state,
          stakeRf: RULES.maxStakeRf,
          errorMessage: `Stake capped at ${formatRf(RULES.maxStakeRf)} RF per delve.`,
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
        selectedTileIndex: null,
        revealedTileIds: [],
        board,
        resources: [],
        startedAt: Date.now(),
        completedAt: undefined,
        lastResolution: undefined,
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

      return {
        ...state,
        phase: "revealing",
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
      const totalSafeTiles = MINES_CONFIG.totalTiles - state.mineCount;
      const boardCleared = safeDigsAfter >= totalSafeTiles;

      // A full clear leaves only mines on the board — there is no longer any
      // feasible safe pick, so the run must end by auto-banking the peak haul.
      const settleSafeDig = (next: MineRun, haulRf: bigint, findNote: string): MineRun => {
        if (!boardCleared) return next;
        return {
          ...next,
          phase: "complete",
          atRiskRf: 0n,
          bankedRf: haulRf,
          availableRf: next.availableRf + haulRf,
          completedAt: Date.now(),
          history: [
            ...next.history,
            `FULL CLEAR! Every safe tile (${totalSafeTiles}) dug through. ${findNote} Auto-banked ${formatRf(haulRf)} RF.`,
          ],
        };
      };

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
      const newAtRisk = applyMaxHaul(
        state.stakeRf,
        currentHaul > 0n ? (currentHaul * BigInt(appliedRoundBps)) / 10000n : 0n,
        state.mineCount,
      );
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
        return applyDigProgress(settleSafeDig(
          {
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
          },
          newAtRisk,
          "Ore seam cleared the shaft.",
        ),
        state,
      );
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

        return applyDigProgress(settleSafeDig(
          {
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
          },
          newAtRisk,
          "The last vein is yours.",
        ),
        state,
      );
      }

      // 3. Special Cache Tile (rare find: +1 Shield or Boost charges)
      if (tile.kind === "special") {
        const haulBoard = updatedBoard.map((t) =>
          t.id === tileId ? ({ ...t, haulRf: newAtRisk } as MineTile) : t,
        );
        if (tile.specialType === "shield") {
          return applyDigProgress(settleSafeDig(
            {
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
            },
            newAtRisk,
"Shield cache was the last safe tile.",
        ),
        state,
      );
      }

        return applyDigProgress(settleSafeDig(
          {
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
          },
          newAtRisk,
          "Boost cache was the last safe tile.",
        ),
        state,
      );
      }

      // 4. Mine Tile
      if (tile.kind === "mine") {
        // Shield Protection Check
        if (state.shieldCharges > 0 && tile.mineType !== "green") {
          return applyDigProgress(
            {
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
                `Mine encounter (${getMineDefinition(tile.mineType).name}) absorbed by active Shield! Current ${formatRf(state.atRiskRf)} RF haul preserved.`,
              ],
            },
            state,
          );
        }

        // Green Mine (Lucky: doubles the round that was just played)
        if (tile.mineType === "green") {
          // The round multiplier still applies — green doubles it rather than
          // replacing it, so a green tile always beats the plain RF tile it
          // stands in for. Previously the round was discarded entirely, which
          // made a fixed 2x a *loss* whenever the round multiplier exceeded 2x
          // (every round from the second onward at 20 mines, for example).
          const greenBps = calculateGreenMineMultiplier(appliedRoundBps);
          const baseHaul = state.atRiskRf > 0n ? state.atRiskRf : state.stakeRf;
          const uncappedHaul =
            baseHaul > 0n ? (baseHaul * BigInt(greenBps)) / 10000n : 0n;
          const doubledHaul = applyMaxHaul(state.stakeRf, uncappedHaul, state.mineCount);
          const greenCurrentBps =
            state.stakeRf > 0n
              ? Number((doubledHaul * 10000n) / state.stakeRf)
              : greenBps;
          const greenCapped = doubledHaul < uncappedHaul;

          return applyDigProgress(settleSafeDig(
            {
              ...state,
              phase: "playing",
              atRiskRf: doubledHaul,
              currentMultiplierBps: greenCurrentBps,
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
                `Lucky Green Mine! Round ${formatMultiplier(appliedRoundBps)}x doubled to ${formatMultiplier(greenBps)}x — haul now ${formatRf(doubledHaul)} RF.${greenCapped ? " (Seam yield cap reached.)" : ""}`,
              ],
            },
            doubledHaul,
            "That green seam was the last safe tile.",
          ),
          state,
          );
        }

        // Any unshielded hazardous mine detonates -> total loss of haul
        const lostRf = state.atRiskRf;
        const mineDef = getMineDefinition(tile.mineType);
        return applyDigProgress(
          {
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
              `${mineDef.name} hit! Lost all ${formatRf(lostRf)} at-risk RF.`,
            ],
          },
          state,
        );
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

    case "BANK": {
      if (state.phase !== "playing") return state;

      const securedRf = state.atRiskRf;
      const totalAvailable = state.availableRf + securedRf;
      const stats: SessionStats = {
        ...state.stats,
        bankedRf: state.stats.bankedRf + securedRf,
        bestSingleBankRf:
          securedRf > state.stats.bestSingleBankRf
            ? securedRf
            : state.stats.bestSingleBankRf,
      };

      return applyEarned({
        ...state,
        stats,
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
      });
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

    case "RESET_SESSION": {
      // Simulated-preview recovery for a drained vault. Restores the starting
      // balance and clears the run; durable gear and session stats are kept.
      if (state.phase !== "ready" && state.phase !== "complete") return state;

      return {
        ...state,
        phase: "ready",
        runId: "",
        availableRf: RULES.startingRf,
        stakeRf: RULES.defaultStakeRf,
        atRiskRf: 0n,
        bankedRf: 0n,
        currentMultiplierBps: 10000,
        nextMultiplierBps: calculateRoundMultiplier(state.mineCount, 1),
        depth: 1,
        safeDigCount: 0,
        shieldCharges: 0,
        boostDigsRemaining: 0,
        selectedTileIndex: null,
        revealedTileIds: [],
        board: [],
        resources: [],
        startedAt: 0,
        completedAt: undefined,
        lastResolution: undefined,
        errorMessage: undefined,
        history: [
          ...state.history,
          `Preview balance reset to ${formatRf(RULES.startingRf)} RF.`,
        ],
      };
    }

    case "SET_ERROR": {
      return {
        ...state,
        errorMessage: action.message,
      };
    }

    case "PURCHASE_COSMETIC": {
      if (state.phase === "revealing" || state.phase === "crashing") return state;
      const item = getCosmeticItem(action.itemId);
      if (!item) return state;
      if (item.priceRf <= 0n) {
        return { ...state, errorMessage: `${item.name} is a trophy — earn it by playing, it cannot be bought.` };
      }
      if (isCosmeticOwned(state.cosmetics, item.id)) {
        return { ...state, errorMessage: `You already own ${item.name}.` };
      }
      if (state.availableRf < item.priceRf) {
        return {
          ...state,
          errorMessage: `Need ${formatCosmeticPrice(item.priceRf)} for ${item.name} — you have ${formatCosmeticPrice(state.availableRf)}.`,
        };
      }
      return {
        ...state,
        availableRf: state.availableRf - item.priceRf,
        cosmetics: {
          ...state.cosmetics,
          unlocked: [...state.cosmetics.unlocked, item.id],
          equipped: { ...state.cosmetics.equipped, [item.slot]: item.id },
          newItems: [...state.cosmetics.newItems, item.id],
        },
        errorMessage: undefined,
        history: [
          ...state.history,
          `Bought ${item.name} from the Gear Locker for ${formatCosmeticPrice(item.priceRf)} (simulated RF).`,
        ],
      };
    }

    case "EQUIP_COSMETIC": {
      const item = getCosmeticItem(action.itemId);
      if (!item) return state;
      if (!isCosmeticOwned(state.cosmetics, item.id)) {
        return { ...state, errorMessage: `Own ${item.name} first.` };
      }
      return {
        ...state,
        cosmetics: {
          ...state.cosmetics,
          equipped: { ...state.cosmetics.equipped, [item.slot]: item.id },
        },
        errorMessage: undefined,
      };
    }

    case "UNEQUIP_COSMETIC": {
      return {
        ...state,
        cosmetics: {
          ...state.cosmetics,
          equipped: { ...state.cosmetics.equipped, [action.slot]: null },
        },
        errorMessage: undefined,
      };
    }

    case "ACK_COSMETICS": {
      if (state.cosmetics.newItems.length === 0) return state;
      return {
        ...state,
        cosmetics: { ...state.cosmetics, newItems: [] },
      };
    }

    default:
      return state;
  }
}

function nextDepth(safeDigs: number): number {
  return Math.min(RULES.maxDepth, 1 + Math.floor(safeDigs / RULES.depthEverySafeDigs));
}

/** True when the session can fund another run. */
export function canStartRun(state: MineRun): boolean {
  return state.stakeRf >= RULES.minStakeRf && state.availableRf >= state.stakeRf;
}

/** True when the vault can no longer cover the minimum entry fee. */
export function isOutOfRf(state: MineRun): boolean {
  return state.availableRf < RULES.minStakeRf;
}