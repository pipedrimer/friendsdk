import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { createInitialState, canStartRun, isOutOfRf, mineReducer } from "../src/engine/mineEngine.ts";
import {
  calculateMinesMultiplier,
  calculateRoundMultiplier,
  formatMultiplier,
  getDangerTier,
  getPeakMultiplier,
  getStartingMultiplier,
  getUncappedPeakMultiplier,
  MINES_CONFIG,
  RF_UNIT,
  RULES,
} from "../src/engine/rules.ts";
import { applyMaxHaul, calculateGreenMineMultiplier, calculateStepHaul, formatRf } from "../src/engine/economy.ts";

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

  it("8. Green Mine (Lucky): doubles the round it replaces, not a flat 2x", () => {
    let state = createInitialState(1001n);
    state = mineReducer(state, { type: "START_RUN", seed: 42 });
    state.currentMultiplierBps = 15000; // 1.50x
    state.atRiskRf = (1n * RF_UNIT * 15000n) / 10000n;
    const haulBefore = state.atRiskRf;

    // Green applies the round multiplier and then doubles it. The round is NOT
    // discarded, so a green tile is always worth strictly more than the plain RF
    // tile it replaces — a fixed 2x used to be a LOSS from round 2 upward.
    const round1 = getStartingMultiplier(5);
    const expectedBps = round1 * 2;

    state.board[0] = { id: 0, kind: "mine", mineType: "green", revealed: false };
    state = mineReducer(state, { type: "SELECT_TILE", tileId: 0 });
    state = mineReducer(state, { type: "FINISH_REVEAL" });

    assert.equal(state.phase, "playing");
    // currentMultiplierBps is the NET multiple of the stake, so the 1.50x haul
    // the test seeded becomes 1.50x * (1.1375x * 2) = 3.4125x.
    assert.equal(
      state.currentMultiplierBps,
      Math.round((15000 * expectedBps) / 10000),
      `1.50x net haul at the doubled ${formatMultiplier(expectedBps)}x round`,
    );
    assert.equal(
      state.atRiskRf,
      (haulBefore * BigInt(expectedBps)) / 10000n,
      "Green pays the current haul at the doubled round, so it always beats a flat 2x",
    );
    assert.ok(
      state.atRiskRf > haulBefore * 2n,
      "A green tile must pay more than doubling the haul while the round is above 1.00x",
    );
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

  it("13. SET_MINE_COUNT maps every count 5..24 to its danger tier and starting multiplier", () => {
    for (let count = 5; count <= 24; count++) {
      const state = mineReducer(createInitialState(1001n), { type: "SET_MINE_COUNT", count });
      assert.equal(state.mineCount, count, `SET_MINE_COUNT ${count} must store the exact count`);
      assert.equal(state.difficulty, getDangerTier(count).id, `count ${count} maps to its danger tier id`);
      assert.equal(state.nextMultiplierBps, getStartingMultiplier(count), `count ${count} sets the matching starting multiplier`);
    }
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
    // A full clear always equals the design peak, and the peak is bounded by the
    // seam yield limit so the advertised jackpot stays collectable.
    for (let mines = 5; mines <= 24; mines++) {
      const safeTiles = MINES_CONFIG.totalTiles - mines;
      const fullClear = calculateMinesMultiplier(mines, safeTiles);
      assert.equal(fullClear, getPeakMultiplier(mines), `${mines} mines full clear must equal design peak`);
      assert.ok(fullClear >= getStartingMultiplier(mines), `${mines} mines peak cannot be below its start`);
      assert.ok(
        fullClear <= RULES.maxHaulMultipleBps,
        `${mines} mines peak (${fullClear}) must not exceed the yield cap (${RULES.maxHaulMultipleBps})`,
      );
    }

    // The 24-mine board has exactly one safe tile, so its peak is its start.
    assert.equal(calculateMinesMultiplier(24, 1), getStartingMultiplier(24), "24 mines peak is its single-start multiplier");
    assert.equal(getPeakMultiplier(24), getStartingMultiplier(24));

    // The raw compounding curve is astronomically larger than the cap on the easy
    // boards, which is exactly why the cap exists: a 5-mine full clear compounds
    // past 8,000x but can only ever bank 250x.
    assert.ok(
      getUncappedPeakMultiplier(5) > 20 * RULES.maxHaulMultipleBps,
      "5 mines uncapped compounding is far above the yield cap",
    );
    assert.equal(getPeakMultiplier(5), RULES.maxHaulMultipleBps, "5 mines full clear is clamped to the yield cap");
  });

  it("18. Every safe dig grows the multiplier until the yield cap, then holds", () => {
    for (let mines = 5; mines <= 24; mines++) {
      const safeTiles = MINES_CONFIG.totalTiles - mines;
      let prev = 10000;
      let saturated = false;
      for (let step = 1; step <= safeTiles; step++) {
        const current = calculateMinesMultiplier(mines, step);
        if (saturated) {
          assert.equal(current, prev, `${mines} mines step ${step} holds at the yield cap`);
          assert.equal(current, RULES.maxHaulMultipleBps, `${mines} mines holds at the cap, not below it`);
        } else {
          assert.ok(
            current - prev >= 100,
            `${mines} mines step ${step} gains at least 100bps (got ${current - prev})`,
          );
          if (current === RULES.maxHaulMultipleBps) saturated = true;
        }
        assert.ok(current <= getPeakMultiplier(mines), `${mines} mines step ${step} stays under the peak`);
        assert.ok(current <= RULES.maxHaulMultipleBps, `${mines} mines step ${step} respects the yield cap`);
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
      let clipped = false;
      for (let step = 1; step <= safeTiles; step++) {
        const roundBps = calculateRoundMultiplier(count, step);
        assert.ok(roundBps >= 10001, `${count} mines step ${step} round multiplier cannot shrink below 1.00x`);
        cumulative = Math.round((cumulative * roundBps) / 10000);
        if (cumulative > RULES.maxHaulMultipleBps) {
          cumulative = RULES.maxHaulMultipleBps;
          clipped = true;
        }
      }
      // Compounding every per-round multiplier reconstructs the design peak. The
      // curve is only ever clipped at the yield cap, never anywhere else.
      assert.equal(cumulative, getPeakMultiplier(count), `${count} mines compounded rounds must equal the peak`);
      assert.ok(
        getUncappedPeakMultiplier(count) >= cumulative,
        `${count} mines capping can only reduce the raw curve`,
      );
      assert.ok(
        !clipped || cumulative === RULES.maxHaulMultipleBps,
        `${count} mines only ever clips at the yield cap`,
      );
    }
  });

  it("24. Tier and multiplier helpers agree with the growing model", () => {
    assert.equal(getDangerTier(5).id, "novice");
    assert.equal(getDangerTier(6).id, "novice");
    assert.equal(getDangerTier(7).id, "prospector");
    assert.equal(getDangerTier(10).id, "prospector");
    assert.equal(getDangerTier(11).id, "abyss");
    assert.equal(getDangerTier(15).id, "abyss");
    assert.equal(getDangerTier(16).id, "cataclysm");
    assert.equal(getDangerTier(20).id, "cataclysm");
    assert.equal(getDangerTier(21).id, "inferno");
    assert.equal(getDangerTier(24).id, "inferno");

    assert.equal(calculateMinesMultiplier(15, 0), 10000);
    assert.equal(calculateMinesMultiplier(15, 1), getStartingMultiplier(15));
    assert.equal(
      calculateMinesMultiplier(15, 2),
      Math.round((getStartingMultiplier(15) * calculateRoundMultiplier(15, 2)) / 10000),
    );
    // More mines, more risk -> higher starting multiplier.
    assert.equal(getStartingMultiplier(5) < getStartingMultiplier(24), true);

    const tier = getDangerTier(5);
    assert.ok(tier.name.length > 0);
  });

  it("25. Full clear auto-banks: digging the last safe tile ends the run at the peak", () => {
    // Inferno (24 mines / 25) has exactly one safe tile. Digging it on the first
    // attempt leaves only mines on the board, so the run MUST end by banking the
    // haul at the start multiplier — never stay "playing" with no safe tile left.
    let state = createInitialState(1001n);
    state = mineReducer(state, { type: "SET_MINE_COUNT", count: 24 });
    state = mineReducer(state, { type: "START_RUN", seed: 7 });

    // Force a deterministic board: tiles 0..23 hazardous mines, tile 24 the only safe RF deposit.
    for (let i = 0; i < 24; i++) state.board[i] = { id: i, kind: "mine", mineType: "red", revealed: false };
    state.board[24] = { id: 24, kind: "rf", amount: 1, revealed: false };
    const startBps = getStartingMultiplier(24);

    state = mineReducer(state, { type: "SELECT_TILE", tileId: 24 });
    state = mineReducer(state, { type: "FINISH_REVEAL" });

    assert.equal(state.phase, "complete", "Digging the only safe tile must end the run");
    assert.equal(state.safeDigCount, 1);
    assert.equal(state.bankedRf, compoundRf(1n * RF_UNIT, [startBps]));
    assert.equal(state.availableRf, 9n * RF_UNIT + state.bankedRf, "Vault credits the auto-banked peak haul");
    assert.ok(state.history.some((line) => line.startsWith("FULL CLEAR!")), "History records the full clear");
    assert.equal(state.completedAt !== undefined, true);
  });

  it("26. Full clear applies to every difficulty when all safe tiles are dug", () => {
    for (const count of [5, 7, 10, 15, 20, 24]) {
      let state = createInitialState(1001n);
      state = mineReducer(state, { type: "SET_MINE_COUNT", count });
      state = mineReducer(state, { type: "START_RUN", seed: 11 });

      // Deterministic board: first `count` tiles are hazardous mines, the rest safe RF deposits.
      const safe = MINES_CONFIG.totalTiles - count;
      for (let i = 0; i < count; i++) state.board[i] = { id: i, kind: "mine", mineType: "red", revealed: false };
      for (let i = count; i < MINES_CONFIG.totalTiles; i++) state.board[i] = { id: i, kind: "rf", amount: 1, revealed: false };

      for (let i = count; i < MINES_CONFIG.totalTiles; i++) {
        if (state.phase !== "playing") break;
        state = mineReducer(state, { type: "SELECT_TILE", tileId: i });
        state = mineReducer(state, { type: "FINISH_REVEAL" });
      }

      assert.equal(state.phase, "complete", `${count} mines: clearing all safe tiles ends the run`);
      assert.equal(state.safeDigCount, safe);
      const roundBps = [];
      for (let step = 1; step <= safe; step++) roundBps.push(calculateRoundMultiplier(count, step));
      // A full clear banks the compounding curve clamped at the yield limit.
      const capRf = (1n * RF_UNIT * BigInt(RULES.maxHaulMultipleBps)) / 10000n;
      const rawHaul = compoundRf(1n * RF_UNIT, roundBps);
      assert.equal(
        state.bankedRf,
        rawHaul > capRf ? capRf : rawHaul,
        `${count} mines banked the per-step compounding, clamped at the yield cap`,
      );
      const peak = getPeakMultiplier(count);
      assert.ok(Math.abs(state.currentMultiplierBps - peak) <= peak * 0.0001, `${count} mines current multiplier is within 1bp of the design peak`);
    }
  });

  it("27. Gear Locker: buying a durable cosmetic deducts simulated RF and equips it", () => {
    let state = createInitialState(1001n);
    assert.equal(state.availableRf, 10n * RF_UNIT);
    assert.equal(state.cosmetics.unlocked.length, 0);
    assert.equal(state.cosmetics.equipped.coat, null);

    state = mineReducer(state, { type: "PURCHASE_COSMETIC", itemId: "coat/sunstone" });
    assert.equal(state.cosmetics.unlocked.includes("coat/sunstone"), true, "Sunstone Coat is unlocked");
    assert.equal(state.cosmetics.equipped.coat, "coat/sunstone", "Buying auto-equips the coat");
    assert.equal(state.availableRf, 6n * RF_UNIT, "Vault drops by the 4 RF simulated price");

    // Buying another coat swaps the equipped slot.
    state = mineReducer(state, { type: "PURCHASE_COSMETIC", itemId: "coat/viridian" });
    assert.equal(state.cosmetics.equipped.coat, "coat/viridian");
    assert.equal(state.cosmetics.unlocked.length, 2);

    // Equipping a previously-bought coat switches back without extra cost.
    state = mineReducer(state, { type: "EQUIP_COSMETIC", itemId: "coat/sunstone" });
    assert.equal(state.cosmetics.equipped.coat, "coat/sunstone");
    assert.equal(state.availableRf, 2n * RF_UNIT, "Equipping never charges money");

    // Unequip clears the slot.
    state = mineReducer(state, { type: "UNEQUIP_COSMETIC", slot: "coat" });
    assert.equal(state.cosmetics.equipped.coat, null);
  });

  it("28. Gear Locker: purchases fail without enough simulated RF or for trophies", () => {
    let state = createInitialState(1001n);
    state = mineReducer(state, { type: "INIT_READY", friendId: 1001n, availableRf: 1n * RF_UNIT });

    state = mineReducer(state, { type: "PURCHASE_COSMETIC", itemId: "coat/sunstone" });
    assert.equal(state.cosmetics.unlocked.length, 0, "Cannot buy a 4 RF coat with only 1 RF");
    assert.match(state.errorMessage, /Need 4 RF for Sunstone Coat/, "Error explains the missing simulated RF");

    // Trophies are never purchasable.
    state = mineReducer(state, { type: "PURCHASE_COSMETIC", itemId: "helmet/golden", });
    assert.equal(state.cosmetics.unlocked.length, 0, "Trophy gear is earned, not bought");
    assert.match(state.errorMessage, /trophy/, "Error says trophy gear is earned");

    // Equipping unowned gear is rejected.
    state = mineReducer(state, { type: "EQUIP_COSMETIC", itemId: "aura/storm" });
    assert.equal(state.cosmetics.equipped.aura, null, "Cannot equip unowned gear");
  });

  it("29. Gear Locker: achievements grant trophies and track session stats", () => {
    // Bank path: deterministic 5-mine board (tiles 0-4 mines, 5-24 RF).
    // A compounded 1 RF stake crosses 25 RF at drill 14 and saturates at the
    // 250 RF yield cap at drill 18, so the trophy unlocks within one run.
    let state = createInitialState(1001n);
    state = mineReducer(state, { type: "START_RUN", seed: 11 });
    for (let i = 0; i < 5; i++) state.board[i] = { id: i, kind: "mine", mineType: "red", revealed: false };
    for (let i = 5; i < 25; i++) state.board[i] = { id: i, kind: "rf", amount: 1, revealed: false };
    for (let i = 5; i < 19 && state.phase === "playing"; i++) {
      state = mineReducer(state, { type: "SELECT_TILE", tileId: i });
      state = mineReducer(state, { type: "FINISH_REVEAL" });
    }
    assert.equal(state.stats.safeDigs, 14, "Safe digs counted so far");
    assert.ok(state.atRiskRf >= 25n * RF_UNIT, "Compounded haul crosses the 25 RF single-bank threshold");

    state = mineReducer(state, { type: "BANK" });
    assert.equal(state.stats.bestSingleBankRf, state.stats.bankedRf, "Single-bank stat records this run's haul");
    assert.ok(state.stats.bestSingleBankRf >= 25n * RF_UNIT);
    assert.ok(state.cosmetics.unlocked.includes("coat/royal"), "Royal Coat unlocks by banking 25 RF in one run (BANK path)");
    assert.ok(state.cosmetics.unlocked.includes("aura/legend") === false, "Legend Glow needs 100 RF banked total — 30 RF is not enough yet");
    assert.ok(state.cosmetics.unlocked.includes("pickaxe/diamond") === false, "Diamond Pickaxe stays locked at 12 safe digs");
    assert.ok(state.cosmetics.newItems.includes("coat/royal"), "The locker marks fresh unlocks");

    // Equip the earned coat and confirm progression survives RETURN_TO_READY.
    state = mineReducer(state, { type: "EQUIP_COSMETIC", itemId: "coat/royal" });
    assert.equal(state.cosmetics.equipped.coat, "coat/royal");
    state = mineReducer(state, { type: "RETURN_TO_READY" });
    assert.equal(state.phase, "ready");
    assert.equal(state.cosmetics.equipped.coat, "coat/royal", "Gear persists to the next run");
    assert.equal(state.stats.bankedRf > 0n, true, "Session banked RF persists");

    // ACK clears the NEW badge.
    state = mineReducer(state, { type: "ACK_COSMETICS" });
    assert.equal(state.cosmetics.newItems.length, 0, "Acknowledged unlocks clear the badge");

    // Full-clear path: digging every safe tile auto-banks at the peak and
    // grants the full-clear + bank mileposts in one run.
    let clear = createInitialState(1001n);
    clear = mineReducer(clear, { type: "SET_MINE_COUNT", count: 5 });
    clear = mineReducer(clear, { type: "START_RUN", seed: 7 });
    for (let i = 0; i < 5; i++) clear.board[i] = { id: i, kind: "mine", mineType: "red", revealed: false };
    for (let i = 5; i < 25; i++) clear.board[i] = { id: i, kind: "rf", amount: 1, revealed: false };
    for (let i = 5; i < 25 && clear.phase === "playing"; i++) {
      clear = mineReducer(clear, { type: "SELECT_TILE", tileId: i });
      clear = mineReducer(clear, { type: "FINISH_REVEAL" });
    }
    assert.equal(clear.phase, "complete");
    assert.equal(clear.stats.fullClears, 1, "Full clear counted in session stats");
    assert.equal(clear.stats.safeDigs, 20, "Safe digs tracked across the run");
    assert.ok(clear.stats.bankedRf > 0n, "Auto-bank haul credits session banked RF");
    assert.ok(clear.stats.bankedRf >= 100n * RF_UNIT, "Peak auto-bank clears the 100 RF bounty");
    assert.ok(clear.cosmetics.unlocked.includes("helmet/golden"), "Golden Helm unlocks on full clear");
    assert.ok(clear.cosmetics.unlocked.includes("aura/legend"), "Legend Glow unlocks past 100 RF banked (full-clear path)");
  });
});

describe("Rare Friends: MINE - Vault soft-lock regression", () => {
  /** Drain the vault to exactly 0 RF by playing runs that bust on a red mine. */
  function drainVaultToZero() {
    let state = createInitialState(1001n);
    let run = 0;
    while (state.availableRf > 0n && run < 40) {
      run += 1;
      state = mineReducer(state, { type: "START_RUN", seed: 4242 + run });
      if (state.phase !== "playing") return state;
      // Force tile 0 to be a red mine so the run always busts.
      state.board[0] = { id: 0, kind: "mine", mineType: "red", revealed: false };
      state = mineReducer(state, { type: "SELECT_TILE", tileId: 0 });
      state = mineReducer(state, { type: "FINISH_REVEAL" });
      state = mineReducer(state, { type: "FINISH_CRASH" });
      assert.equal(state.phase, "complete", "busted run must settle");
      state = mineReducer(state, { type: "RETURN_TO_READY" });
    }
    return state;
  }

  it("losing runs can drain the vault to exactly 0 RF", () => {
    const state = drainVaultToZero();
    assert.equal(state.availableRf, 0n, "vault should be empty");
    assert.equal(state.phase, "ready", "should be back on the pre-run screen");
  });

  it("START_RUN at 0 RF is refused instead of opening an unpayable run", () => {
    // Regression: the old guard was `availableRf < stakeRf`, so a vault
    // clamped to a 0 RF stake passed the check (0n < 0n) and started a run
    // that could never pay out and could never be staked again.
    let state = { ...createInitialState(1001n), availableRf: 0n, stakeRf: 0n, phase: "ready" };
    state = mineReducer(state, { type: "START_RUN", seed: 1 });
    assert.equal(state.phase, "ready", "zero-stake run must not start");
    assert.match(state.errorMessage ?? "", /Out of simulated RF/);
  });

  it("START_RUN with 0 RF but a 1 RF stake is refused with recovery guidance", () => {
    let state = { ...createInitialState(1001n), availableRf: 0n, phase: "ready" };
    state = mineReducer(state, { type: "START_RUN", seed: 1 });
    assert.equal(state.phase, "ready", "run must not start");
    assert.match(state.errorMessage ?? "", /Insufficient simulated RF/);
    assert.match(state.errorMessage ?? "", /Reset your preview balance/);
  });

  it("isOutOfRf and canStartRun drive the START DELVE button state", () => {
    const empty = { ...createInitialState(1001n), availableRf: 0n, stakeRf: 0n, phase: "ready" };
    assert.equal(isOutOfRf(empty), true);
    assert.equal(canStartRun(empty), false);

    const funded = createInitialState(1001n);
    assert.equal(isOutOfRf(funded), false);
    assert.equal(canStartRun(funded), true);

    // A half-funded stake must not be startable either.
    const short = { ...funded, stakeRf: 10n * RF_UNIT, availableRf: 3n * RF_UNIT };
    assert.equal(canStartRun(short), false);
  });

  it("RESET_SESSION restores the starting balance and play resumes", () => {
    let state = drainVaultToZero();
    assert.equal(state.availableRf, 0n);

    state = mineReducer(state, { type: "RESET_SESSION" });
    assert.equal(state.availableRf, RULES.startingRf);
    assert.equal(state.stakeRf, RULES.defaultStakeRf);
    assert.equal(state.errorMessage, undefined, "reset clears the out-of-RF error");
    assert.equal(isOutOfRf(state), false);

    state = mineReducer(state, { type: "START_RUN", seed: 99 });
    assert.equal(state.phase, "playing", "a fresh delve is startable after reset");
    assert.equal(state.availableRf, RULES.startingRf - RULES.defaultStakeRf);
  });

  it("RESET_SESSION keeps durable gear and session stats", () => {
    let state = createInitialState(1001n);
    state = mineReducer(state, { type: "PURCHASE_COSMETIC", itemId: "pickaxe/ember" });
    assert.ok(state.cosmetics.unlocked.includes("pickaxe/ember"));

    state = { ...state, availableRf: 0n, stats: { ...state.stats, safeDigs: 42 } };
    const reset = mineReducer(state, { type: "RESET_SESSION" });

    assert.ok(reset.cosmetics.unlocked.includes("pickaxe/ember"), "gear survives a balance reset");
    assert.equal(reset.stats.safeDigs, 42, "achievement progress survives a balance reset");
  });

  it("RESET_SESSION is refused mid-run so it cannot be used to dodge a blast", () => {
    let state = createInitialState(1001n);
    state = mineReducer(state, { type: "START_RUN", seed: 5 });
    assert.equal(state.phase, "playing");

    const after = mineReducer(state, { type: "RESET_SESSION" });
    assert.equal(after, state, "state must be untouched while a run is live");
  });

  it("funded play is unaffected by the new guards", () => {
    let state = createInitialState(1001n);
    state = mineReducer(state, { type: "START_RUN", seed: 77 });
    assert.equal(state.phase, "playing");
    assert.equal(state.availableRf, RULES.startingRf - RULES.defaultStakeRf);
    assert.equal(state.errorMessage, undefined);
  });
});

describe("Rare Friends: MINE - seam yield cap and lucky-seam placement", () => {
  /** Drive a board of all-safe RF tiles and report the haul after each dig. */
  function digAllSafe(mineCount, seed = 11) {
    let state = createInitialState(1001n);
    state = mineReducer(state, { type: "SET_MINE_COUNT", count: mineCount });
    state = mineReducer(state, { type: "START_RUN", seed });
    for (let i = 0; i < mineCount; i++) {
      state.board[i] = { id: i, kind: "mine", mineType: "red", revealed: false };
    }
    for (let i = mineCount; i < MINES_CONFIG.totalTiles; i++) {
      state.board[i] = { id: i, kind: "rf", amount: 1, revealed: false };
    }
    const hauls = [];
    for (let i = mineCount; i < MINES_CONFIG.totalTiles; i++) {
      if (state.phase !== "playing") break;
      state = mineReducer(state, { type: "SELECT_TILE", tileId: i });
      state = mineReducer(state, { type: "FINISH_REVEAL" });
      hauls.push(state.atRiskRf);
    }
    return { state, hauls };
  }

  it("no delve can ever pay more than the yield cap, for any board", () => {
    const stake = 1n * RF_UNIT;
    const capRf = (stake * BigInt(RULES.maxHaulMultipleBps)) / 10000n;
    for (let mines = 5; mines <= 24; mines++) {
      const { state, hauls } = digAllSafe(mines);
      for (const haul of hauls) {
        assert.ok(
          haul <= capRf,
          `${mines} mines: haul ${haul} must never exceed the ${capRf} yield cap`,
        );
      }
      assert.ok(state.bankedRf <= capRf, `${mines} mines: banked haul respects the cap`);
      // The two shortest boards cannot compound far enough to reach the cap.
      if (MINES_CONFIG.totalTiles - mines <= 2) {
        assert.ok(state.bankedRf < capRf, `${mines} mines never reaches the cap on a short board`);
      }
    }
  });

  it("the cap binds on the long boards, which is what makes it a real bound", () => {
    const capRf = (1n * RF_UNIT * BigInt(RULES.maxHaulMultipleBps)) / 10000n;
    for (const mines of [5, 7, 10, 15, 20]) {
      const { state } = digAllSafe(mines);
      assert.equal(
        state.bankedRf,
        capRf,
        `${mines} mines full clear must bank exactly the capped jackpot`,
      );
    }
  });

  it("the yield cap scales with the stake, not with a fixed RF amount", () => {
    const { state } = digAllSafe(5);
    assert.equal(state.bankedRf, 250n * RF_UNIT, "1 RF stake banks 250 RF at the 250x cap");
  });

  it("no lucky seam is placed on boards with fewer than three safe tiles", () => {
    // 23 and 24 mines leave 2 and 1 safe tiles respectively. A green tile there
    // doubles a single enormous round, which is the one case the house edge
    // cannot absorb.
    for (const mines of [23, 24]) {
      for (let seed = 0; seed < 40; seed++) {
        let state = createInitialState(1001n);
        state = mineReducer(state, { type: "SET_MINE_COUNT", count: mines });
        state = mineReducer(state, { type: "START_RUN", seed: seed * 7919 + 3 });
        const green = state.board.filter((t) => t.kind === "mine" && t.mineType === "green");
        assert.equal(green.length, 0, `${mines} mines, seed ${seed}: no green mine on a ${25 - mines}-tile board`);
      }
    }
  });

  it("a lucky seam is still placed on boards with room for luck to compound", () => {
    let seen = 0;
    for (let seed = 0; seed < 200 && seen === 0; seed++) {
      let state = createInitialState(1001n);
      state = mineReducer(state, { type: "SET_MINE_COUNT", count: 5 });
      state = mineReducer(state, { type: "START_RUN", seed: seed * 104729 + 11 });
      seen = state.board.filter((t) => t.kind === "mine" && t.mineType === "green").length;
    }
    assert.ok(seen > 0, "the 10% green find chance still appears on a 5-mine board");
  });

  it("the green seam is still subject to the yield cap", () => {
    let state = createInitialState(1001n);
    state = mineReducer(state, { type: "SET_MINE_COUNT", count: 5 });
    state = mineReducer(state, { type: "START_RUN", seed: 11 });
    const capRf = (state.stakeRf * BigInt(RULES.maxHaulMultipleBps)) / 10000n;
    // Seed a haul already at the cap, then dig a green tile.
    state.atRiskRf = capRf;
    state.board[0] = { id: 0, kind: "mine", mineType: "green", revealed: false };
    state = mineReducer(state, { type: "SELECT_TILE", tileId: 0 });
    state = mineReducer(state, { type: "FINISH_REVEAL" });
    assert.equal(state.atRiskRf, capRf, "a green seam cannot push the haul past the cap");
    assert.ok(
      state.history.some((h) => /yield cap/i.test(h)),
      "the log says the cap was reached",
    );
  });

  it("a lucky seam still beats the plain tile it replaces on every round", () => {
    // The defect this guards: a fixed 2x used to be a LOSS from round 2 upward
    // on high-mine boards, where the round multiplier is already above 2x.
    for (let mines = 5; mines <= 24; mines++) {
      const safe = MINES_CONFIG.totalTiles - mines;
      for (let round = 1; round <= safe; round++) {
        const roundBps = calculateRoundMultiplier(mines, round);
        const greenBps = calculateGreenMineMultiplier(roundBps);
        const plainHaul = (1n * RF_UNIT * BigInt(roundBps)) / 10000n;
        const greenHaul = (1n * RF_UNIT * BigInt(greenBps)) / 10000n;
        assert.ok(
          greenHaul > plainHaul,
          `${mines} mines round ${round}: green (${greenHaul}) must beat the plain tile (${plainHaul})`,
        );
      }
    }
  });
});
