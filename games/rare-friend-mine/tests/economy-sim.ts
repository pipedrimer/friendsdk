// Rare Friends: MINE -- economy Monte Carlo simulation.
//
// Verifies that the growing per-round multiplier compounds AND that the house
// edge stays positive across the full range of selectable mine counts
// (MINES_CONFIG.minMines .. maxMines), not just the quick presets. Each config is
// exercised through the real SET_MINE_COUNT action and the real board generator.
//
// HOUSE EDGE IS CHECKED AGAINST THE WORST-CASE BANK POLICY, not a single cautious
// bot. An earlier version of this file only tested "bank at >= 2 RF", which made
// a game-breaking strategy ("never bank, ride the compounding curve to the end")
// look fine while actually paying the player 8% more than they staked. Every
// policy below is legal in-game.
//
// All policies are evaluated as PAIRED observations on a single simulated dig
// order per seed: the board and the dig order do not depend on when the player
// chooses to bank, so one pass records the whole haul trajectory and every
// threshold is then read off that same path. This is exact (not an estimate of a
// policy), and pairing removes the cross-policy Monte Carlo noise that previously
// made this check flaky -- the win on hard boards is a rare 200x+ event, so an
// unpaired 4,000-run sample swung by 30 percentage points between invocations.
//
// Bundle + run: node games/rare-friend-mine/tests/run-sim.mjs
import { createInitialState, mineReducer } from "../src/engine/mineEngine.ts";
import {
  formatMaxHaulMultiple,
  formatMultiplier,
  getDangerTier,
  getPeakMultiplier,
  getStartingMultiplier,
  MINES_CONFIG,
  RF_UNIT,
  RULES,
} from "../src/engine/rules.ts";

const RUNS = Number(process.env.RF_MINE_SIM_RUNS ?? 20_000);

/**
 * The gate only fails when the best policy beats the house by MORE than twice
 * the Monte Carlo standard error. Without this, hard boards flake: a 23-mine
 * board clears both safe tiles about 0.4% of the time for a ~248x jackpot, and
 * at 6,000 runs that single event swung the estimate by 16 percentage points --
 * enough to report a phantom failure, or to hide a real 1% leak. A 60,000-run
 * rerun put the same cell at 0.906 RF (a 9.4% house edge).
 */
const SIGMAS_FOR_FAILURE = 2;

/**
 * Legal bank policies, in RF. `null` means "never bank" -- ride the curve to the
 * end of the run, which is the greediest possible strategy.
 */
const BANK_POLICIES: (bigint | null)[] = [
  null,
  1n * RF_UNIT,
  2n * RF_UNIT,
  3n * RF_UNIT,
  5n * RF_UNIT,
  10n * RF_UNIT,
  25n * RF_UNIT,
  100n * RF_UNIT,
];

/** One entry per safe dig on a single simulated dig order. */
type Step = { haulRf: bigint; survived: boolean };

/**
 * Simulate the full "never bank" path for one seed: keep digging until the run
 * can go no further (a mine ends it, or every safe tile is cleared and the haul
 * auto-banks).
 */
function simulatePath(seed: number, mineCount: number): { steps: Step[]; terminalRf: bigint } {
  let state = createInitialState(1000n + BigInt(seed % 1000));
  state = mineReducer(state, { type: "SET_MINE_COUNT", count: mineCount });
  state = mineReducer(state, { type: "START_RUN", seed });

  const steps: Step[] = [];
  for (let dig = 0; dig < RULES.totalTiles && state.phase === "playing"; dig++) {
    const hidden = state.board.filter((t) => !t.revealed);
    const pick = hidden[Math.floor(Math.random() * hidden.length)] ?? state.board[0];
    state = mineReducer(state, { type: "SELECT_TILE", tileId: pick.id });
    state = mineReducer(state, { type: "FINISH_REVEAL" });
    if (state.phase !== "playing") break;
    steps.push({ haulRf: state.atRiskRf, survived: true });
  }

  // A full clear auto-banks; a run that is somehow still live banks what it has.
  if (state.phase === "playing") state = mineReducer(state, { type: "BANK" });
  return { steps, terminalRf: state.phase === "complete" ? state.bankedRf : 0n };
}

/** What a player using `bankAtRf` walks away with from this exact path. */
function payoutFor(path: { steps: Step[]; terminalRf: bigint }, bankAtRf: bigint | null): bigint {
  if (bankAtRf !== null) {
    for (const step of path.steps) {
      if (step.haulRf >= bankAtRf) return step.survived ? step.haulRf : 0n;
    }
  }
  return path.terminalRf;
}

type Stats = {
  digs: number;
  minesHit: number;
  shieldedMines: number;
  destroyedRf: bigint;
  wins: number;
  shieldsFound: number;
  boostsFound: number;
  oresFound: number;
  fullClears: number;
};

function freshStats(): Stats {
  return {
    digs: 0,
    minesHit: 0,
    shieldedMines: 0,
    destroyedRf: 0n,
    wins: 0,
    shieldsFound: 0,
    boostsFound: 0,
    oresFound: 0,
    fullClears: 0,
  };
}

const policyLabel = (p: bigint | null) =>
  p === null ? "never bank" : `bank >= ${Number(p / RF_UNIT)} RF`;

const counts: number[] = [];
for (let c = MINES_CONFIG.minMines; c <= MINES_CONFIG.maxMines; c++) counts.push(c);

const stake = RULES.defaultStakeRf;
const stakeInRf = Number(stake) / Number(RF_UNIT);
const referencePolicy = 2n * RF_UNIT;

console.log(`Rare Friends: MINE economy simulation (${RUNS.toLocaleString()} paired runs per mine count)`);
console.log(`Covers every selectable mine count ${counts[0]}..${counts[counts.length - 1]} via SET_MINE_COUNT`);
console.log(`House edge: ${RULES.houseEdgeBps} bps per round, seam yield cap ${formatMaxHaulMultiple()}, ${RULES.totalTiles} tiles`);
console.log(
  `Sweeping ${BANK_POLICIES.length} legal bank policies per mine count (paired); the house must beat the BEST of them.`,
);

let allPositive = true;
const failures: string[] = [];
let worstEdge = Number.POSITIVE_INFINITY;
let worstAt = 0;

for (const mineCount of counts) {
  const tier = getDangerTier(mineCount);
  const policyTotals = new Map<bigint | null, bigint>();
  const policySq = new Map<bigint | null, number>();
  for (const p of BANK_POLICIES) {
    policyTotals.set(p, 0n);
    policySq.set(p, 0);
  }
  const ref = freshStats();

  for (let i = 0; i < RUNS; i++) {
    const seed = i;
    const path = simulatePath(seed, mineCount);
    for (const p of BANK_POLICIES) {
      const paid = payoutFor(path, p);
      policyTotals.set(p, (policyTotals.get(p) ?? 0n) + paid);
      const rf = Number(paid) / Number(RF_UNIT);
      policySq.set(p, (policySq.get(p) ?? 0) + rf * rf);
    }

    // Descriptive counters come from an independent pass driven by the
    // reference bot, so the reported detail does not depend on the policy sweep.
    let s = createInitialState(1000n + BigInt(seed % 1000));
    s = mineReducer(s, { type: "SET_MINE_COUNT", count: mineCount });
    s = mineReducer(s, { type: "START_RUN", seed });
    for (let dig = 0; dig < RULES.totalTiles && s.phase === "playing"; dig++) {
      const hidden = s.board.filter((t) => !t.revealed);
      const pick = hidden[Math.floor(Math.random() * hidden.length)] ?? s.board[0];
      const resBefore = s.lastResolution;
      s = mineReducer(s, { type: "SELECT_TILE", tileId: pick.id });
      s = mineReducer(s, { type: "FINISH_REVEAL" });
      ref.digs += 1;
      const res = s.lastResolution;
      if (res && res !== resBefore) {
        if (res.type === "mine") {
          if (res.mineType !== "green") ref.minesHit += 1;
          if (res.wasShielded) ref.shieldedMines += 1;
          else if (res.lostRf > 0n) ref.destroyedRf += res.lostRf;
        }
        if (res.type === "special" && res.specialType === "shield") ref.shieldsFound += 1;
        if (res.type === "special" && res.specialType === "boost") ref.boostsFound += 1;
        if (res.type === "resource") ref.oresFound += 1;
      }
      if (s.phase === "complete") {
        ref.fullClears += 1;
        break;
      }
    }
  }

  let bestEv = Number.NEGATIVE_INFINITY;
  let bestSe = 0;
  let bestPolicy: bigint | null = null;
  for (const p of BANK_POLICIES) {
    const total = policyTotals.get(p) ?? 0n;
    const ev = Number((total * 1000n) / (RF_UNIT * BigInt(RUNS))) / 1000;
    if (ev > bestEv) {
      bestEv = ev;
      bestPolicy = p;
      // Standard error of the mean, in RF, from the sample variance.
      const sumSq = policySq.get(p) ?? 0;
      const variance = Math.max(0, sumSq / RUNS - ev * ev);
      bestSe = Math.sqrt(variance / RUNS);
    }
  }

  const tolerance = SIGMAS_FOR_FAILURE * bestSe;
  const houseEdgePct = (1 - bestEv / stakeInRf) * 100;
  // Report the pessimistic end of the noise band, not the raw point estimate: on
  // boards where the jackpot is rare the point estimate swings wildly, and a
  // headline "-12% house edge" from a +/-21% sample is not a real finding.
  const pessimisticEdgePct = (1 - (bestEv + tolerance) / stakeInRf) * 100;
  const beatsHouse = bestEv - stakeInRf > tolerance;
  if (beatsHouse) {
    allPositive = false;
    failures.push(
      `${mineCount} mines (${tier.name}): best policy "${policyLabel(bestPolicy)}" pays ${bestEv.toFixed(3)} RF on a ${stakeInRf.toFixed(2)} RF stake, which is ${((bestEv / stakeInRf - 1) * 100).toFixed(2)}% over stake (+/- ${(tolerance * 100).toFixed(3)}% noise)`,
    );
  }
  if (pessimisticEdgePct < worstEdge) {
    worstEdge = pessimisticEdgePct;
    worstAt = mineCount;
  }

  const refAvg = (n: bigint) => Number((n * 1000n) / (RF_UNIT * BigInt(RUNS))) / 1000;
  const refBanked = policyTotals.get(referencePolicy) ?? 0n;

  console.log("-------------------------------------");
  console.log(
    `[${tier.name.toUpperCase()} · ${mineCount} mines/25] starts x${formatMultiplier(getStartingMultiplier(mineCount))}, cap-limited peak x${formatMultiplier(getPeakMultiplier(mineCount))}`,
  );
  console.log(`  Average safe digs:        ${(ref.digs / RUNS).toFixed(2)}`);
  console.log(`  Average banked RF (2 RF bot): ${refAvg(refBanked).toFixed(3)} RF`);
  console.log(`  Full clears / run:        ${(ref.fullClears / RUNS).toFixed(4)}`);
  console.log(`  Mines hit per run:        ${(ref.minesHit / RUNS).toFixed(2)}`);
  console.log(`  Shields found / run:      ${(ref.shieldsFound / RUNS).toFixed(2)} (shielded mines: ${(ref.shieldedMines / RUNS).toFixed(2)})`);
  console.log(`  Boosts found / run:       ${(ref.boostsFound / RUNS).toFixed(2)}`);
  console.log(`  Ores found / run:         ${(ref.oresFound / RUNS).toFixed(2)} (collectibles, no RF)`);
  console.log(`  BEST legal bank policy:   ${policyLabel(bestPolicy)} -> ${bestEv.toFixed(3)} RF (+/- ${bestSe.toFixed(3)})`);
  console.log(
    `  Worst-case House Edge:    ${houseEdgePct.toFixed(2)}% point, ${pessimisticEdgePct.toFixed(2)}% at the pessimistic end of the noise band (Sustainable: ${beatsHouse ? "NO" : "YES"})`,
  );
}

console.log("=====================================");
console.log(`All ${counts.length} mine counts beat every legal bank policy: ${allPositive ? "YES" : "NO"}`);
console.log(
  `Tightest house edge (pessimistic, 2 sigma): ${worstEdge.toFixed(2)}% at ${worstAt} mines`,
);
if (!allPositive) {
  for (const f of failures) console.log(`  FAIL ${f}`);
  process.exitCode = 1;
}
