// Rare Friends: MINE -- economy Monte Carlo simulation.
// Uses the exact board generator + rule module to verify the growing per-round
// multiplier compounds and the house edge stays positive.
// Bundle + run: node games/rare-friend-mine/tests/run-sim.mjs
import { createInitialState, mineReducer } from "../src/engine/mineEngine.ts";
import { DIFFICULTIES, formatMultiplier, RF_UNIT, RULES } from "../src/engine/rules.ts";
import { formatRf } from "../src/engine/economy.ts";

const RUNS = Number(process.env.RF_MINE_SIM_RUNS ?? 10_000);
// Realistic bot banking rule: bank after reaching >= 2.0x multiplier or 2 RF haul
const BANK_HAUL_THRESHOLD = 2n * RF_UNIT;

type Stats = {
  digs: number;
  minesHit: number;
  shieldedMines: number;
  bankedRf: bigint;
  destroyedRf: bigint;
  utilitySpendRf: bigint;
  wins: number;
  shieldsFound: number;
  boostsFound: number;
  oresFound: number;
  scansBought: number;
  cursedDigs: number;
};

function freshStats(): Stats {
  return {
    digs: 0,
    minesHit: 0,
    shieldedMines: 0,
    bankedRf: 0n,
    destroyedRf: 0n,
    utilitySpendRf: 0n,
    wins: 0,
    shieldsFound: 0,
    boostsFound: 0,
    oresFound: 0,
    scansBought: 0,
    cursedDigs: 0,
  };
}

function pickTile(state: ReturnType<typeof createInitialState>): number {
  const hidden = state.board.filter((t) => !t.revealed);
  const pick = hidden[Math.floor(Math.random() * hidden.length)] ?? state.board[0];
  return pick.id;
}

function runOnce(seed: number, difficultyId: (typeof DIFFICULTIES)[number]["id"]): Stats {
  let state = createInitialState(1000n + BigInt(seed % 1000));
  state = mineReducer(state, { type: "SET_DIFFICULTY", difficulty: difficultyId });
  state = mineReducer(state, { type: "START_RUN", seed });

  const bag = freshStats();

  for (let dig = 0; dig < RULES.totalTiles && state.phase === "playing"; dig++) {
    // Bank when haul meets the target threshold (e.g. >= 2.0x)
    if (state.atRiskRf >= BANK_HAUL_THRESHOLD) {
      state = mineReducer(state, { type: "BANK" });
      break;
    }

    const tileId = pickTile(state);
    const resolutionBefore = state.lastResolution;
    state = mineReducer(state, { type: "SELECT_TILE", tileId });
    state = mineReducer(state, { type: "FINISH_REVEAL" });
    bag.digs += 1;

    if (state.lastResolution !== resolutionBefore && state.lastResolution?.type === "mine") {
      if (state.lastResolution.mineType !== "green") bag.minesHit += 1;
      if (state.lastResolution.wasShielded) bag.shieldedMines += 1;
      else if (state.lastResolution.lostRf > 0n) bag.destroyedRf += state.lastResolution.lostRf;
    }

    const res = state.lastResolution;
    if (res && res !== resolutionBefore) {
      if (res.type === "special" && res.specialType === "shield") bag.shieldsFound += 1;
      if (res.type === "special" && res.specialType === "boost") bag.boostsFound += 1;
      if (res.type === "resource") bag.oresFound += 1;
    }

    if (state.phase === "complete") break;
    if (state.curseDigsRemaining > 0) bag.cursedDigs += 1;
  }

  if (state.phase === "playing") {
    state = mineReducer(state, { type: "BANK" });
  }

  if (state.bankedRf > 0n) bag.wins += 1;
  bag.bankedRf += state.bankedRf;

  return bag;
}

function simulate(difficultyId: (typeof DIFFICULTIES)[number]["id"]): Stats {
  const totals = freshStats();
  for (let i = 0; i < RUNS; i++) {
    const bag = runOnce(i, difficultyId);
    for (const key of Object.keys(totals) as (keyof Stats)[]) {
      if (typeof totals[key] === "bigint") {
        totals[key] = (totals[key] as bigint) + (bag[key] as bigint);
      } else {
        totals[key] = (totals[key] as number) + (bag[key] as number);
      }
    }
  }
  return totals;
}

const avgRf = (n: bigint) => Number(n / (RF_UNIT / 1000n)) / 1000 / RUNS;
const avgNum = (n: number) => n / RUNS;
const pct = (n: number) => ((n / RUNS) * 100).toFixed(1) + "%";
const stake = Number(RULES.defaultStakeRf / (RF_UNIT / 1000n)) / 1000;

console.log(`Rare Friends: MINE economy simulation (${RUNS.toLocaleString()} runs per difficulty, 1.0 RF stake, bank at >= 2.0 RF)`);
for (const difficulty of DIFFICULTIES) {
  const t = simulate(difficulty.id);
  const avgBanked = avgRf(t.bankedRf);
  const netEv = avgBanked - stake;
  const houseEdgePct = ((stake - avgBanked) / stake) * 100;

  console.log("-------------------------------------");
  console.log(`[${difficulty.name.toUpperCase()}] ${difficulty.minesPerBoard} mines/25 · starts x${formatMultiplier(difficulty.initialMultiplierBps)}`);
  console.log(`  Average safe digs:        ${avgNum(t.digs).toFixed(2)}`);
  console.log(`  Average banked RF:        ${avgBanked.toFixed(3)} RF`);
  console.log(`  Run win rate (banked>0):  ${pct(t.wins)}`);
  console.log(`  Mines hit per run:        ${avgNum(t.minesHit).toFixed(2)}`);
  console.log(`  Shields found / run:      ${avgNum(t.shieldsFound).toFixed(2)} (shielded mines: ${avgNum(t.shieldedMines).toFixed(2)})`);
  console.log(`  Boosts found / run:       ${avgNum(t.boostsFound).toFixed(2)}`);
  console.log(`  Ores found / run:         ${avgNum(t.oresFound).toFixed(2)} (collectibles, no RF)`);
  console.log(`  Net expected player EV:   ${netEv >= 0 ? "+" : ""}${netEv.toFixed(3)} RF`);
  console.log(`  House Edge:               ${houseEdgePct.toFixed(1)}% (Sustainable: ${houseEdgePct > 0 ? "YES" : "NO"})`);
}
console.log("=====================================");