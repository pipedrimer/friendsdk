import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { createInitialState, mineReducer } from "../src/engine/mineEngine.ts";
import {
  calculateMinesMultiplier,
  calculateRoundMultiplier,
  formatMultiplier,
  getDangerTier,
  getDifficulty,
  getPeakMultiplier,
  getStepMultiplier,
  getStartingMultiplier,
  MINES_CONFIG,
  RF_UNIT,
  RULES,
  DIFFICULTY_MINE_COUNTS,
} from "../src/engine/rules.ts";
import { calculateStepHaul, formatRf } from "../src/engine/economy.ts";

/**
 * Exact expected haul after a run of safe digs, mirroring the engine's bigint
 * compounding: atRisk = currentHaul * appliedRoundBps / 10000 at each round.
 * For whole-RF stakes (divisible by 10000) the first steps are lossless.
 */
function compoundRf(stakeRf, roundBps) {
  return roundBps.reduce((haul, bps) => (haul * BigInt(bps)) / 10000n, stakeRf);
}

describe("Rare Friends: MINE - Progressive Multiplier Engine Unit Tests", () => {
  it("1. Start Run: deducts default 1 RF entry stake and initializes run", () => {
    let state = createInitialState(1001n);
    assert.equal(state.availableRf, 10n * RF_UNIT);
    assert.equal(state.stakeRf, 1n * RF_UNIT);

    state = mineReducer(state, { type: "START_RUN", seed: 42 });
    assert.equal(state.phase, "playing");
    assert.equal(state.availableRf, 9n * RF_UNIT, "Starting RF should decrease from 10 to 9 after 1 RF stake");
    assert.equal(state.atRiskRf, 0n);
    assert.equal(state.board.length, 25);
    assert.equal(state.currentMultiplierBps, 10000);
  });

  it("2. Custom Stake: SET_STAKE configures round stake and scales deductions", () => {
    let state = createInitialState(1001n);
    state = mineReducer(state, { type: "SET_STAKE", stakeRf: 5n * RF_UNIT });
    assert.equal(state.stakeRf, 5n * RF_UNIT);

    state = mineReducer(state, { type: "START_RUN", seed: 42 });
    assert.equal(state.availableRf, 5n * RF_UNIT, "10 RF - 5 RF stake = 5 RF remaining in vault");
    assert.equal(state.stakeRf, 5n * RF_UNIT);
  });

  it("3. Cataclysm (15 mines) Progressive Multiplier: dynamic multiplier scaling", () => {
    let state = createInitialState(1001n);
    state = mineReducer(state, { type: "SET_MINE_COUNT", count: 15 });
    state = mineReducer(state, { type: "START_RUN", seed: 42 });

    const round1 = calculateRoundMultiplier(15, 1);
    const round2 = calculateRoundMultiplier(15, 2);
    const expectedCumulative2 = calculateMinesMultiplier(15, 2);

    // Force tile #0 and #1 to be mineral nodes
    state.board[0] = { id: 0, kind: "rf", amount: 1, revealed: false };
    state.board[1] = { id: 1, kind: "rf", amount: 1, revealed: false };

    // Dig Tile 1
    state = mineReducer(state, { type: "SELECT_TILE", tileId: 0 });
    state = mineReducer(state, { type: "FINISH_REVEAL" });

    assert.equal(state.safeDigCount, 1);
    assert.ok(round2 > round1, "Round multiplier must grow (round 2 > round 1)");
    assert.equal(
      state.currentMultiplierBps,
      round1,
      `15-mine tile 1 cumulative multiplier must be the round 1 start ${formatMultiplier(round1)}x`,
    );
    assert.equal(
      state.nextMultiplierBps,
      round2,
      `Next multiplier must be the growing round 2 rate ${formatMultiplier(round2)}x`,
    );
    assert.equal(state.atRiskRf, compoundRf(1n * RF_UNIT, [round1]));

    // Dig Tile 2
    state = mineReducer(state, { type: "SELECT_TILE", tileId: 1 });
    state = mineReducer(state, { type: "FINISH_REVEAL" });

    assert.equal(state.safeDigCount, 2);
    assert.ok(
      Math.abs(state.currentMultiplierBps - expectedCumulative2) <= 3,
      `15-mine tile 2 cumulative multiplier should be ~${formatMultiplier(expectedCumulative2)}x (got ${state.currentMultiplierBps})`,
    );
    assert.equal(state.atRiskRf, compoundRf(1n * RF_UNIT, [round1, round2]));
  });

  it("4. Scaled Payout with Custom Stake: 4 RF stake with 15 mines pays 4 * multiplier on Tile 1", () => {
    let state = createInitialState(1001n);
    state = mineReducer(state, { type: "SET_MINE_COUNT", count: 15 });
    state = mineReducer(state, { type: "SET_STAKE", stakeRf: 4n * RF_UNIT });
    state = mineReducer(state, { type: "START_RUN", seed: 42 });

    const round1 = calculateRoundMultiplier(15, 1);

    state.board[0] = { id: 0, kind: "rf", amount: 1, revealed: false };
    state = mineReducer(state, { type: "SELECT_TILE", tileId: 0 });
    state = mineReducer(state, { type: "FINISH_REVEAL" });

    assert.equal(state.currentMultiplierBps, round1);
    assert.equal(state.atRiskRf, compoundRf(4n * RF_UNIT, [round1]), `4 RF stake * ${formatMultiplier(round1)}x`);
  });

  it("5. Boost: gained from a Special Cache, then adds +0.50x to the next round and decrements charges", () => {
    let state = createInitialState(1001n);
    state = mineReducer(state, { type: "SET_MINE_COUNT", count: 15 });
    state = mineReducer(state, { type: "START_RUN", seed: 42 });

    const round1 = calculateRoundMultiplier(15, 1);
    const round2 = calculateRoundMultiplier(15, 2);

    // Tile 0 is a Special Boost Cache (a rare find, never purchasable).
    state.board[0] = { id: 0, kind: "special", specialType: "boost", revealed: false };
    state = mineReducer(state, { type: "SELECT_TILE", tileId: 0 });
    state = mineReducer(state, { type: "FINISH_REVEAL" });

    assert.equal(state.boostDigsRemaining, RULES.boostDigs, "Boost cache grants 2 boosted digs");
    assert.equal(state.lastResolution?.specialType, "boost");
    assert.equal(state.atRiskRf, compoundRf(1n * RF_UNIT, [round1]), "Boost cache dig still compounds the round 1 haul");

    const boostedBps = round2 + RULES.boostBonusMultiplierBps;

    state.board[1] = { id: 1, kind: "rf", amount: 1, revealed: false };
    state = mineReducer(state, { type: "SELECT_TILE", tileId: 1 });
    state = mineReducer(state, { type: "FINISH_REVEAL" });

    assert.equal(state.lastResolution?.wasBoosted, true, "The next safe dig consumes the boost");
    assert.equal(state.boostDigsRemaining, RULES.boostDigs - 1);
    assert.equal(state.atRiskRf, compoundRf(1n * RF_UNIT, [round1, boostedBps]), `round 1 x boosted round 2 (${formatMultiplier(boostedBps)}x)`);
  });

  it("6. Red Mine: detonates, plays the crash sequence, then wipes the entire at-risk haul", () => {
    let state = createInitialState(1001n);
    state = mineReducer(state, { type: "START_RUN", seed: 42 });
    state.atRiskRf = 5n * RF_UNIT;

    state.board[0] = { id: 0, kind: "mine", mineType: "red", revealed: false };
    state = mineReducer(state, { type: "SELECT_TILE", tileId: 0 });
    state = mineReducer(state, { type: "FINISH_REVEAL" });

    assert.equal(state.lastResolution?.lostRf, 5n * RF_UNIT);
    assert.equal(state.phase, "crashing", "Detonation triggers animated crash before settling");
    assert.equal(state.atRiskRf, 0n, "Haul is wiped immediately");
    assert.equal(state.bankedRf, 0n);

    // FINISH_CRASH is dispatched by the UI after the animation window closes.
    state = mineReducer(state, { type: "FINISH_CRASH" });
    assert.equal(state.phase, "complete", "Crash settles and ends the run");
    assert.ok(state.completedAt !== undefined, "Settlement timestamp is set after the crash");
  });

  it("7. Shield: gained from a Special Cache, then blocks a mine blast preserving haul and multiplier", () => {
    let state = createInitialState(1001n);
    state = mineReducer(state, { type: "SET_MINE_COUNT", count: 15 });
    state = mineReducer(state, { type: "START_RUN", seed: 42 });

    const round1 = calculateRoundMultiplier(15, 1);

    // Tile 0 is a Special Shield Cache (a rare find, never purchasable).
    state.board[0] = { id: 0, kind: "special", specialType: "shield", revealed: false };
    state = mineReducer(state, { type: "SELECT_TILE", tileId: 0 });
    state = mineReducer(state, { type: "FINISH_REVEAL" });

    assert.equal(state.shieldCharges, 1);
    assert.equal(state.lastResolution?.specialType, "shield");
    assert.equal(state.atRiskRf, compoundRf(1n * RF_UNIT, [round1]));

    state.board[1] = { id: 1, kind: "mine", mineType: "red", revealed: false };
    state = mineReducer(state, { type: "SELECT_TILE", tileId: 1 });
    state = mineReducer(state, { type: "FINISH_REVEAL" });

    assert.equal(state.phase, "playing", "Shield keeps delve active");
    assert.equal(state.atRiskRf, compoundRf(1n * RF_UNIT, [round1]), "Haul preserved");
    assert.equal(state.currentMultiplierBps, round1, "Multiplier preserved");
    assert.equal(state.lastResolution?.wasShielded, true);
    assert.equal(state.shieldCharges, 0);
  });

  it("8. Green Mine (Lucky): doubles current progressive multiplier and haul", () => {
    let state = createInitialState(1001n);
    state = mineReducer(state, { type: "START_RUN", seed: 42 });
    state.currentMultiplierBps = 15000; // 1.50x
    state.atRiskRf = (1n * RF_UNIT * 15000n) / 10000n;

    state.board[0] = { id: 0, kind: "mine", mineType: "green", revealed: false };
    state = mineReducer(state, { type: "SELECT_TILE", tileId: 0 });
    state = mineReducer(state, { type: "FINISH_REVEAL" });

    assert.equal(state.phase, "playing");
    assert.equal(state.currentMultiplierBps, 30000, "1.50x doubled to 3.00x (30000 bps)");
    assert.equal(state.atRiskRf, 3n * RF_UNIT);
  });

  it("9. Bank: immediately secures exactly the compounded haul and completes run", () => {
    let state = createInitialState(1001n);
    state = mineReducer(state, { type: "SET_MINE_COUNT", count: 15 });
    state = mineReducer(state, { type: "START_RUN", seed: 42 });

    const round1 = calculateRoundMultiplier(15, 1);
    const expectedHaul = compoundRf(1n * RF_UNIT, [round1]);

    state.board[0] = { id: 0, kind: "rf", amount: 1, revealed: false };
    state = mineReducer(state, { type: "SELECT_TILE", tileId: 0 });
    state = mineReducer(state, { type: "FINISH_REVEAL" });

    assert.equal(state.atRiskRf, expectedHaul);

    state = mineReducer(state, { type: "BANK" });
    assert.equal(state.phase, "complete");
    assert.equal(state.bankedRf, expectedHaul, "Bank returns exactly the at-risk haul");
    assert.equal(state.atRiskRf, 0n);
    assert.equal(state.availableRf, 9n * RF_UNIT + expectedHaul, "Banked haul added to vault");
  });

  it("10. Shield and Boost are rare finds only: no purchase actions exist anymore", () => {
    // A mineReducer must ignore legacy purchase actions (default no-op), so a
    // player can never buy a shield or boost.
    let state = createInitialState(1001n);
    state = mineReducer(state, { type: "START_RUN", seed: 42 });

    const before = state.boostDigsRemaining;
    const shieldState = mineReducer(state, { type: "BUY_SHIELD" });
    assert.equal(shieldState, state, "BUY_SHIELD is ignored (action no longer exists)");

    const boostState = mineReducer(state, { type: "ACTIVATE_BOOST" });
    assert.equal(boostState, state, "ACTIVATE_BOOST is ignored (action no longer exists)");
    assert.equal(state.boostDigsRemaining, before);
  });

  it("11. Concurrency: double-clicking the same tile is safely ignored", () => {
    let state = createInitialState(1001n);
    state = mineReducer(state, { type: "START_RUN", seed: 42 });

    state = mineReducer(state, { type: "SELECT_TILE", tileId: 0 });
    assert.equal(state.phase, "revealing");

    const state2 = mineReducer(state, { type: "SELECT_TILE", tileId: 0 });
    assert.equal(state2, state);
  });

  it("12. SET_MINE_COUNT: manually selecting mine count updates state correctly with min 5", () => {
    let state = createInitialState(1001n);

    // Set to 10 mines
    state = mineReducer(state, { type: "SET_MINE_COUNT", count: 10 });
    assert.equal(state.mineCount, 10);
    assert.equal(state.nextMultiplierBps, getStartingMultiplier(10));

    // Set to 20 mines
    state = mineReducer(state, { type: "SET_MINE_COUNT", count: 20 });
    assert.equal(state.mineCount, 20);
    assert.equal(state.nextMultiplierBps, getStartingMultiplier(20));

    // Clamp to max 24
    state = mineReducer(state, { type: "SET_MINE_COUNT", count: 30 });
    assert.equal(state.mineCount, 24);

    // Clamp to minimum 5 mines
    state = mineReducer(state, { type: "SET_MINE_COUNT", count: 0 });
    assert.equal(state.mineCount, 5, "Min mines must clamp to 5");

    state = mineReducer(state, { type: "SET_MINE_COUNT", count: 3 });
    assert.equal(state.mineCount, 5, "Setting 3 mines must clamp to min 5");
  });

  it("13. SET_DIFFICULTY backward compat: sets mine count from difficulty tier", () => {
    let state = createInitialState(1001n);
    state = mineReducer(state, { type: "SET_DIFFICULTY", difficulty: "cataclysm" });
    assert.equal(state.mineCount, DIFFICULTY_MINE_COUNTS["cataclysm"]);
    assert.equal(state.nextMultiplierBps, getStartingMultiplier(DIFFICULTY_MINE_COUNTS["cataclysm"]));

    state = mineReducer(state, { type: "SET_DIFFICULTY", difficulty: "novice" });
    assert.equal(state.mineCount, DIFFICULTY_MINE_COUNTS["novice"]);
    assert.equal(state.nextMultiplierBps, getStartingMultiplier(DIFFICULTY_MINE_COUNTS["novice"]));
  });

  it("14. RETURN_TO_READY: completed runs return to ready screen with reset multiplier", () => {
    let state = createInitialState(1001n);
    state = mineReducer(state, { type: "SET_MINE_COUNT", count: 15 });
    state = mineReducer(state, { type: "START_RUN", seed: 42 });

    state.board[0] = { id: 0, kind: "rf", amount: 1, revealed: false };
    state = mineReducer(state, { type: "SELECT_TILE", tileId: 0 });
    state = mineReducer(state, { type: "FINISH_REVEAL" });
    state = mineReducer(state, { type: "BANK" });

    assert.equal(state.phase, "complete");

    state = mineReducer(state, { type: "RETURN_TO_READY" });
    assert.equal(state.phase, "ready");
    assert.equal(state.atRiskRf, 0n);
    assert.equal(state.bankedRf, 0n);
    assert.equal(state.currentMultiplierBps, 10000);
    assert.equal(state.nextMultiplierBps, getStartingMultiplier(15));
    assert.equal(state.board.length, 0);
  });

  it("15. Starting multiplier increases with more mines", () => {
    // More mines = higher per-round multiplier (minimum 5 mines)
    const mult5 = getStartingMultiplier(5);
    const mult7 = getStartingMultiplier(7);
    const mult10 = getStartingMultiplier(10);
    const mult20 = getStartingMultiplier(20);

    assert.ok(mult5 < mult7, `5 mines (${mult5}) should be less than 7 mines (${mult7})`);
    assert.ok(mult7 < mult10, `7 mines (${mult7}) should be less than 10 mines (${mult10})`);
    assert.ok(mult10 < mult20, `10 mines (${mult10}) should be less than 20 mines (${mult20})`);

    // And the cumulative multiplier compounds upward on every step
    for (let mines of [5, 10, 15, 20]) {
      const step1 = calculateMinesMultiplier(mines, 1);
      const step2 = calculateMinesMultiplier(mines, 2);
      const step3 = calculateMinesMultiplier(mines, 3);
      assert.ok(step1 < step2, `${mines} mines: step 1 (${step1}) < step 2 (${step2})`);
      assert.ok(step2 < step3, `${mines} mines: step 2 (${step2}) < step 3 (${step3})`);
    }
  });

  it("16. Starting multiplier climbs strictly as mines increase", () => {
    // Every mine count (5..24) unlocks a higher starting multiplier than the one before.
    let prev = getStartingMultiplier(5);
    for (let mines = 6; mines <= 24; mines++) {
      const start = getStartingMultiplier(mines);
      assert.ok(start > prev, `${mines} mines (${start}) should start higher than ${mines - 1} mines (${prev})`);
      prev = start;
    }
  });

  it("17. Peak multiplier: full clear lands exactly on the design peak for every board", () => {
    // A full clear always equals the design peak (no arbitrary cap).
    for (let mines = 5; mines <= 24; mines++) {
      const safeTiles = MINES_CONFIG.totalTiles - mines;
      const fullClear = calculateMinesMultiplier(mines, safeTiles);
      assert.equal(fullClear, getPeakMultiplier(mines), `${mines} mines full clear must equal design peak`);
      assert.ok(fullClear >= getStartingMultiplier(mines), `${mines} mines peak cannot be below its start`);
    }

    // The 24-mine board has exactly one safe tile, so its peak is its start.
    assert.equal(calculateMinesMultiplier(24, 1), getStartingMultiplier(24), "24 mines peak is its single-start multiplier");
    assert.equal(getPeakMultiplier(24), getStartingMultiplier(24));

    // The compounding jackpots are large — a 5-mine full clear is over 30,000x.
    assert.ok(getPeakMultiplier(5) > 300_000_000, "5 mines full clear exceeds 30,000x (claim payout visibility)");
  });

  it("18. Every safe dig grows the multiplier at least +0.01x without overshooting the peak", () => {
    for (let mines = 5; mines <= 24; mines++) {
      const safeTiles = MINES_CONFIG.totalTiles - mines;
      let prev = 10000;
      for (let step = 1; step <= safeTiles; step++) {
        const current = calculateMinesMultiplier(mines, step);
        assert.ok(current - prev >= 100, `${mines} mines step ${step} gains at least 100bps (got ${current - prev})`);
        assert.ok(current <= getPeakMultiplier(mines), `${mines} mines step ${step} stays under the peak`);
        prev = current;
      }
    }
  });

  it("19. Ores are collectibles only: banking secures exactly the at-risk haul, no RF bonus", () => {
    let state = createInitialState(1001n);
    state = mineReducer(state, { type: "START_RUN", seed: 7 });
    state = {
      ...state,
      atRiskRf: 3n * RF_UNIT,
      resources: [
        { resourceId: "copper", name: "Copper Ore", amount: 1, rarity: "common", icon: "copper" },
        { resourceId: "golden", name: "Golden Ore", amount: 1, rarity: "epic", icon: "golden" },
      ],
    };
    const goldBefore = state.availableRf;

    state = mineReducer(state, { type: "BANK" });

    assert.equal(state.bankedRf, 3n * RF_UNIT, "Banked total is exactly the at-risk haul (ores add no RF)");
    assert.equal(state.availableRf, goldBefore + 3n * RF_UNIT, "Vault credits exactly the secured haul");
    assert.equal(state.phase, "complete");

    // A resource dig still compounds the haul like any safe dig.
    state = createInitialState(1001n);
    state = mineReducer(state, { type: "SET_MINE_COUNT", count: 15 });
    state = mineReducer(state, { type: "START_RUN", seed: 9 });
    const round1 = calculateRoundMultiplier(15, 1);
    state.board[0] = {
      id: 0,
      kind: "resource",
      resourceId: "moon",
      name: "Moon Ore",
      amount: 1,
      rarity: "uncommon",
      revealed: false,
    };
    state = mineReducer(state, { type: "SELECT_TILE", tileId: 0 });
    state = mineReducer(state, { type: "FINISH_REVEAL" });
    assert.equal(state.phase, "playing");
    assert.equal(state.resources.length, 1);
    assert.equal(state.atRiskRf, compoundRf(1n * RF_UNIT, [round1]), "Ore digs grow the haul like any safe dig");
  });

  it("20. Per-round compounding: each round's growing multiplier compounds the current haul, not the stake", () => {
    // User-facing model: stake 1 RF -> round 1 @ 1.22x -> 1.22 RF -> round 2
    // @ 1.23x -> 1.22 x 1.23 = 1.50 RF -> round 3 @ 1.25x -> ...
    let state = createInitialState(1001n);
    state = mineReducer(state, { type: "SET_MINE_COUNT", count: 5 });
    state = mineReducer(state, { type: "START_RUN", seed: 42 });

    const r1 = calculateRoundMultiplier(5, 1);
    const r2 = calculateRoundMultiplier(5, 2);
    const r3 = calculateRoundMultiplier(5, 3);
    assert.ok(r2 > r1 && r3 > r2, "Round multipliers must grow monotonically");

    state.board[0] = { id: 0, kind: "rf", amount: 1, revealed: false };
    state = mineReducer(state, { type: "SELECT_TILE", tileId: 0 });
    state = mineReducer(state, { type: "FINISH_REVEAL" });

    // 1 RF stake x round 1 = 1.22 RF at risk, round 2 @ 1.23x shown next.
    assert.equal(state.atRiskRf, compoundRf(1n * RF_UNIT, [r1]));
    assert.equal(state.currentMultiplierBps, r1);
    assert.equal(state.nextMultiplierBps, r2, "Next shows the growing round-2 rate");

    state.board[1] = { id: 1, kind: "rf", amount: 1, revealed: false };
    state = mineReducer(state, { type: "SELECT_TILE", tileId: 1 });
    state = mineReducer(state, { type: "FINISH_REVEAL" });

    // 1.22 RF x round 2 (1.23x) = 1.50 RF. Compounding, never re-staking.
    assert.equal(state.atRiskRf, compoundRf(1n * RF_UNIT, [r1, r2]));
    assert.equal(state.currentMultiplierBps, calculateMinesMultiplier(5, 2));
    assert.equal(state.nextMultiplierBps, r3, "Next shows the growing round-3 rate");
  });

  it("21. Ready screen: next multiplier is the growing round-1 start multiplier", () => {
    for (const count of [5, 7, 10, 15, 20, 24]) {
      let state = createInitialState(1001n);
      state = mineReducer(state, { type: "SET_MINE_COUNT", count });
      assert.equal(state.nextMultiplierBps, getStartingMultiplier(count));

      state = mineReducer(state, { type: "START_RUN", seed: 1 });
      assert.equal(state.nextMultiplierBps, getStartingMultiplier(count));
    }
  });

  it("22. Boost compounds onto the current haul with the boosted round multiplier", () => {
    let state = createInitialState(1001n);
    state = mineReducer(state, { type: "SET_MINE_COUNT", count: 5 });
    state = mineReducer(state, { type: "START_RUN", seed: 42 });

    const r1 = calculateRoundMultiplier(5, 1);
    const r2 = calculateRoundMultiplier(5, 2);

    state.board[0] = { id: 0, kind: "rf", amount: 1, revealed: false };
    state = mineReducer(state, { type: "SELECT_TILE", tileId: 0 });
    state = mineReducer(state, { type: "FINISH_REVEAL" });
    const preBoostHaul = state.atRiskRf;
    const beforeBps = state.currentMultiplierBps;

    // Boost was acquired as a rare find earlier (charge state is set directly).
    state.boostDigsRemaining = 2;

    const boostedBps = r2 + RULES.boostBonusMultiplierBps;

    state.board[1] = { id: 1, kind: "rf", amount: 1, revealed: false };
    state = mineReducer(state, { type: "SELECT_TILE", tileId: 1 });
    state = mineReducer(state, { type: "FINISH_REVEAL" });

    // Boost multiplies the current haul by the boosted round ratio:
    // preBoostHaul * (round2 + 5000) / 10000.
    const boostedHaul = (preBoostHaul * BigInt(boostedBps)) / 10000n;
    assert.equal(state.atRiskRf, boostedHaul, "Boost multiplies the current haul by the boosted round multiplier");
    assert.ok(state.currentMultiplierBps > beforeBps);
    assert.equal(state.lastResolution?.wasBoosted, true);
  });

  it("23. Per-round multipliers are positive and compound exactly up to the cumulative peak", () => {
    for (let count = 5; count <= 24; count++) {
      const safeTiles = MINES_CONFIG.totalTiles - count;
      let cumulative = 10000;
      for (let step = 1; step <= safeTiles; step++) {
        const roundBps = calculateRoundMultiplier(count, step);
        assert.ok(roundBps >= 10001, `${count} mines step ${step} round multiplier cannot shrink below 1.00x`);
        cumulative = Math.round((cumulative * roundBps) / 10000);
      }
      // Compounding every per-round multiplier reconstructs the design peak.
      assert.equal(cumulative, getPeakMultiplier(count), `${count} mines compounded rounds must equal the peak`);
    }
  });

  it("24. Difficulty helpers agree with the growing model", () => {
    const cataclysm = getDifficulty("cataclysm");
    assert.equal(cataclysm.minesPerBoard, DIFFICULTY_MINE_COUNTS["cataclysm"]);
    assert.equal(cataclysm.initialMultiplierBps, getStartingMultiplier(cataclysm.minesPerBoard));

    const novice = getDifficulty("novice");
    assert.equal(novice.initialMultiplierBps, getStartingMultiplier(novice.minesPerBoard));

    assert.equal(getStepMultiplier(15, 0), 10000);
    assert.equal(getStepMultiplier(15, 1), getStartingMultiplier(15));
    assert.equal(getStepMultiplier(15, 2), calculateMinesMultiplier(15, 2));

    const tier = getDangerTier(5);
    assert.ok(tier.name.length > 0);
  });
});