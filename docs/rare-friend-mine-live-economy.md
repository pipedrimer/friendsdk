# Rare Friends: MINE — Live Multiplier Settlement Spec

Status: proposal for the Rare Friends phase-two review. Not deployed.

The playable preview gates on a connected wallet + owned Rare Friends
Generations NFT and runs a labeled **simulated** ledger. This document defines
how live play should settle **exactly like the simulation**: the reward a
player banks is their **stake × the compounding round multiplier** they reached,
with no flat 1 RF cap.

## Goal

For each purchased run, the returned RF must equal the same `at-risk haul` the
simulated engine shows (`src/engine/mineEngine.ts`). If the sim says a player
who dug three safe tiles holds `stake × 1.22 × 1.23 × 1.25` RF at risk and banks
it, the live contract must credit that exact multiple.

## Required contract behavior (phase-two contract)

A new `MinesGame` contract (not the supplied `ChanceGame` static-table flow)
must implement:

1. **Progressive per-run cumulative multiplier.** Each run stores
   `multiplierBps` starting at `10000` (1.00x). On every safe dig it is
   multiplied by that round's per-round multiplier
   (`calculateRoundMultiplier`, discounted by the `250` bps house edge from
   `src/engine/rules.ts`), using exact-integer RF base-unit math
   (`haul = haul * roundBps / 10000`), matching the simulation's BigInt math.
   `expired?` handles the case where a safe dig banks vs. a mine ends the run.

2. **Banks settle at the exact multiple.** Player calls `settle()` with the
   current run; reward is `stakeRf * multiplierBps / 10000` base units. A mine
   resolves the run with the current at-risk haul banked, exactly like the sim
   auto-banks the haul shown on the dug tile.

3. **Backing / reserves.** Each purchased run must be funded such that free
   stake covers the run's **peak** prize (`stake × full-clear multiplier`,
   e.g. ×31,987 / ×2,234,760 / ×2,537,438 from `HowToPlay.tsx`). This is the
   existing "reserve the maximum prize" rule from `contracts/README.md:152`
   applied per multiplier, not per static outcome. A no-cap outcome means a
   mine-run purchase on 10 mines reserves `stake × 2,234,760`.

4. **Deterministic RNG.** Random-safe dig vs. mine outcomes must come from a
   verifiable source (Dice-style on-chain randomness, or an approved oracle),
   **not** the browser. The browser owns animation/presentation only. The
   seeded board placement mirrors the sim's placement for identical seeds.

5. **Canonical wallet + fee cap.** Reward lands in the canonical NFT wallet;
   the Dice fee cap of 0.000025 ETH excluding gas applies to RNG requests;
   installed? no custom calldata/signer access in game code.

6. **Pending recovery + receipt.** Unsettled runs are recoverable by their
   existing ID; a withdraw? banks the confirmed reward only after a verified
   receipt. Recovery must not require a second purchase.

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

## Open questions for the reviewer

- Is a single `MinesGame` contract acceptable, or must per-run multiplier state
  live in an ERC-1155/consumable that survives redemptions?
- Which randomness source (Dice integration vs. approved oracle) is authorized
  for stepwise safe/mine resolution?
- What peak-multiplier tiers may be offered live given bankroll reserves?