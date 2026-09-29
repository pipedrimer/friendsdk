# Rare Friends: MINE — Live Multiplier Settlement Spec

Status: proposal for the Rare Friends phase-two review. Not deployed.

The playable preview gates on a connected wallet + owned Rare Friends
Generations NFT and runs a labeled **simulated** ledger. This document defines
how live play should settle **exactly like the simulation**: the reward a
player banks is their **stake × the compounding round multiplier** they reached,
**capped at ×10,000** and never risking more than **7,331 RF** (see "Yield
cap" and "Stake ceiling" below).

## Goal

For each purchased run, the returned RF must equal the same `at-risk haul` the
simulated engine shows (`src/engine/mineEngine.ts`). If the sim says a player
who dug three safe tiles holds `stake × 1.14 × 1.15 × 1.16` RF at risk and banks
it, the live contract must credit that exact multiple.

## Required contract behavior (phase-two contract)

A new `MinesGame` contract (not the supplied `ChanceGame` static-table flow)
must implement:

1. **Progressive per-run cumulative multiplier.** Each run stores
   `multiplierBps` starting at `10000` (1.00x). On every safe dig it is
   multiplied by that round's per-round multiplier
   (`calculateRoundMultiplier`, discounted by the `900` bps house edge from
   `src/engine/rules.ts`), using exact-integer RF base-unit math
   (`haul = haul * roundBps / 10000`), matching the simulation's BigInt math.
   `expired?` handles the case where a safe dig banks vs. a mine ends the run.

2. **Yield cap.** `multiplierBps` is clamped to `10000 * 10000` on every update,
   mirroring `applyMaxHaul` in `src/engine/economy.ts`. The cap is
   stake-relative, so it scales with the stake and needs no per-tier table. This
   also bounds the reserve requirement in (4): without it a 5-mine run's raw
   curve exceeds ×8,050, a 10-mine run exceeds ×794,000, and a 13-mine run
   exceeds ×1,600,000, which no vault can fund at a meaningful stake.

2b. **Stake ceiling.** A run's stake is clamped to `maxStakeRf` (**7,331 RF**)
   when the run is opened, mirroring `RULES.maxStakeRf` and the `SET_STAKE` /
   `START_RUN` clamps in `src/engine/mineEngine.ts`. This is a **backing
   control, not a preference**. A live player's balance is their real wallet
   balance and the game cannot bound it, so without this rule the amount the
   developer must float would be `(richest player's balance × cap)` — unbounded
   and unknown. With it, that figure is a constant.

   **The ceiling is denominated in RF, not USD.** 7,331 RF is fixed; it was
   *selected* because it was $10 at the $0.001364/RF reference price on
   2026-09-28, but the dollar figure is provenance rather than policy. Backing is
   what has to be stable, and backing is denominated in RF. See "Decisions taken"
   for the price drift this accepts and the governance-parameter requirement.

3. **Banks settle at the exact multiple.** Player calls `settle()` with the
   current run; reward is `min(stakeRf * multiplierBps / 10000, stakeRf * 10000)`
   base units. A mine resolves the run with zero banked, exactly like the sim
   wiping the at-risk haul.

4. **Backing / reserves.** Each purchased run must be funded such that free
   stake covers the run's **capped peak** prize
   (`stake × min(full-clear multiplier, 10000)` — a flat `stake × 10000` for every
   count except Inferno, where the single safe tile peaks at `stake × 22.75`).
   This is the existing "reserve the maximum prize" rule from
   `contracts/README.md:152` applied per run, not per static outcome.

   Because the stake ceiling in (2b) bounds the stake at 7,331 RF regardless of
   the player wallet balance, the worst-case backing for a run in flight is a
   **fixed 73,310,000 RF** (`7,331 × 10,000`), independent of how much RF any
   player holds. That bound is the reason the cap is paired with a stake ceiling
   rather than raised alone.

5. **Deterministic RNG.** Random-safe dig vs. mine outcomes must come from a
   verifiable source (Dice-style on-chain randomness, or an approved oracle),
   **not** the browser. The browser owns animation/presentation only. The
   seeded board placement mirrors the sim's placement for identical seeds.

6. **Lucky Seam placement.** Green is never placed when fewer than three safe
   tiles remain (`rollRareFinds` in `src/engine/board.ts`). Live play must apply
   the same placement rule or the published house edge does not hold.

7. **Canonical wallet + fee cap.** Reward lands in the canonical NFT wallet;
   the Dice fee cap of 0.000025 ETH excluding gas applies to RNG requests;
   installed? no custom calldata/signer access in game code.

8. **Pending recovery + receipt.** Unsettled runs are recoverable by their
   existing ID; a withdraw? banks the confirmed reward only after a verified
   receipt. Recovery must not require a second purchase.

## House edge evidence

The `900` bps edge was not chosen for feel; they were fitted
against the **greediest legal strategy**, not a cautious one. An early revision
of this project verified only `bank at >= 2 RF` and reported a healthy economy,
while `never bank` actually paid a player **8% more than they staked**. The
current check (`games/rare-friend-mine/tests/economy-sim.ts`) drives the real
reducer across all 20 selectable mine counts and sweeps eight bank thresholds
including `never bank`, asserting that the **best** policy found still loses.

Board generation and dig order do not depend on when the player banks, so a
single pass records the whole haul trajectory and every threshold is read off
that same path — the sweep is exact per path rather than an estimate per
policy.

A standalone re-implementation of the rules was used to fit the edge, because it
runs the full 5–24 grid plus a dense threshold sweep in seconds:

| Config | Worst-case best-policy EV on 1 RF stake | Verdict |
| --- | --- | --- |
| `300` bps + per-tier caps | 1.081 RF | rejected, player-profitable |
| `700` bps + ×250 cap | 0.985 RF | rejected, under 2% margin |
| **`900` bps + ×250 cap** | **0.944 RF** | **edge selected, 5.6% margin** |
| `1100` bps + ×250 cap | 0.916 RF | rejected, margins too punishing |

The edge was fitted at a ×250 cap, and the cap was then raised to ×10,000 once
the stake ceiling made the backing bounded. Re-running the real reducer at
60,000 paired runs confirms the edge is unchanged: **5–9%** on 18 of 20 counts,
with only the two near-impossible Inferno boards (21, 22 mines) reading
player-favourable. The cap does not set the edge, because the full clear is too
rare to move the mean; the 900 bps per-round discount does.

The authoritative number is the one the **real reducer** produces, since the
re-implementation can drift from shipped behaviour. At 60,000 paired runs
`tests/economy-sim.ts` reports point estimates of roughly **5–9%** house edge on
18 of 20 counts.

| Mine count | Best policy | EV per 1 RF stake | House edge |
| --- | --- | --- | --- |
| 5 (Novice) | `bank >= 1 RF` | 0.912 | 8.8% |
| 16 (Cataclysm) | `bank >= 1 RF` | 0.927 | 7.3% |
| 20 (Cataclysm) | `bank >= 10 RF` | 0.977 | 2.3% |
| 23 (Inferno) | `never bank` | 0.907 | 9.3% |

**20 and 23 mines are high-variance cells** and should not be quoted as precise
margins. Both hinge on a rare jackpot, and repeated 60,000-run sweeps move the
20-mine estimate between roughly 2% and 6.5% while 23 mines moves between 4.4%
and 9.3%. That is why the gate is statistical rather than a fixed threshold: a
single deterministic cutoff produced phantom failures at 6,000 runs and would
eventually produce a phantom pass in the other direction. The invariant worth
carrying forward is **no mine count is player-profitable**, not a specific edge.

Two things a reviewer should carry into the live contract:

- **The per-round edge is not sufficient on its own.** A multiplier that grows
  unboundedly hands the player the compounding tail; the cap is what makes the
  reserve requirement finite.
- **Rare finds need placement constraints, not just weights.** A green tile on a
  two-safe-tile board doubles a single enormous round, which no per-round margin
  absorbs. The simulator's green gate exists for exactly this case.

### Declared prize in `game.json` is a placeholder, not the real payoff

`node scripts/check-games.mjs games/rare-friend-mine` currently reports
`maximum 1000000000000000000 RF base units` — a **1 RF** maximum prize — because
`game.json` declares a single deterministic 1 RF reference outcome. The engine
can pay up to **10,000 RF** on a 1 RF stake, so the declared maximum does not
describe the game.

Do **not** "fix" this by editing the outcome table. A static `outcomes` array
cannot express a progressive per-run multiplier, and inventing weights to make
the number look right would describe a game that does not exist. The correct
resolution is the `MinesGame` contract in the section above; `game.json` stays a
reference until then, and the preview ledger remains fully simulated.

## Capability gaps (what the current runtime lacks)

- `ChanceGame` (`contracts/src/ChanceGame.sol`) settles one outcome from a
  **static weight table** per `play()`. It has no progressive per-run
  multiplier and cannot pay `stake × reached_multiplier`.
- `game.json` today configures a single deterministic 1 RF reference outcome;
  that is the *reference* reward, not the game's intended payoff table.
- The fixed action client (`read / canBuy / buy / play / settle / redeem`) has
  no "dig-safe / hit-mine" step, so an intervening acting adapter or a raw
  contract call path is needed for stepwise progress.

## Preview behavior (unchanged until contract lands)

- Real wallet + NFT gate stays enforced on the `/play/` build.
- The compounding jackpots shown in the Help table are labeled simulation-only
  until the contract backs them.
- The `×10,000` cap, the 7,331 RF stake ceiling and the Lucky Seam placement gate
  are enforced in the preview engine and must be reproduced by the contract, not
  re-derived later.

## Decisions taken

- **The live stake ceiling is a fixed RF amount, not a USD peg.** A run is
  bounded at **7,331 RF**. That figure was *chosen* because it was $10 at the
  $0.001364/RF reference price on 2026-09-28, but the $10 is the origin of the
  number, not the rule: the rule is "7,331 RF, fixed". Consequences accepted
  explicitly:
  - The USD value of a run drifts with the RF price. At half the reference price
    the ceiling is worth ~$5; at double it is ~$20. A fixed RF ceiling keeps the
    *backing* requirement stable in the unit that actually has to be floated,
    which is the property that matters, at the cost of a stable dollar cost to
    the player.
  - The ceiling must still be a **governance parameter** on the contract
    (constructor argument or settable value), not a literal, so the team can move
    it without a redeploy. It should be lowered if RF falls far enough that
    7,331 RF becomes an unreasonable single bet, and raised if RF recovers.
  - `maxStakeRf` and `maxHaulMultipleBps` must move together, because backing is
    their product. The engine's test suite pins that product at 73,310,000 RF so
    the two cannot drift apart silently.

## Open questions for the reviewer

- Is a single `MinesGame` contract acceptable, or must per-run multiplier state
  live in an ERC-1155/consumable that survives redemptions?
- Which randomness source (Dice integration vs. approved oracle) is authorized
  for stepwise safe/mine resolution?
- Confirm the backing figure. At the preview values the developer must be able to
  float **73,310,000 RF** (~$100,000 at the $0.001364 reference price) for a
  single run in flight. The reserve requirement is bounded and predictable in RF,
  but its dollar cost still moves with the price, and the team should confirm
  they can fund it.