# Rare Friends: MINE

- **Builder:** pipedrimer (https://github.com/pipedrimer)
- **Category:** Character Spotlight
- **One sentence:** Plunge your selected Rare Friend into a 5×5 shaft of hidden mines, dig safe tiles for a compounding RF haul, and fight the urge to bank before the inevitable blast.

## Source code

- **Repository:** https://github.com/pipedrimer/friendsdk
- **Submitted revision:** `git checkout ef19bd04b66491b5a5c5c85bc537467ff16fca33`
- **FriendSDK version:** v0.1.2

The code will be exported from that exact repository and revision.

## How to run

From the repository root, with Node.js 22+ (WSL2 on Windows):

```sh
git clone https://github.com/pipedrimer/friendsdk.git && cd friendsdk
git checkout ef19bd04b66491b5a5c5c85bc537467ff16fca33
npm ci
npm run dev:game -- games/rare-friend-mine
```

Open the displayed URL, connect a wallet, select an owned eligible Friend, choose a difficulty and dig.

> **Try it without a wallet first:** the hosted test server runs in
> `--test-mode`, which mounts the game under the SDK runtime with a mocked
> Friend (#7730) and simulated RF — no wallet connection and no NFT required.

## How to play

Your Friend walks into the shaft with a pickaxe. Each run costs **1 RF**, and
every safe tile you dig multiplies the haul you currently sit on — the longer
you survive, the bigger the growth. Any mine detonation wipes **your entire
at-risk haul**. Bank whenever you like: **Bank returns exactly the at-risk
amount, never more** — do you cash out, or push deeper?

- **Choose difficulty** before each run: 5, 7, 10, 15, 20 or 24 mines on the
  board (tier names Novice → Inferno). More mines = higher per-round multipliers.
- **Dig** safe tiles to grow your at-risk haul via the compounding round
  multiplier. The round multiplier grows every safe dig at the fair survival
  odds for that board, discounted by a small house margin.
- **Bank [C]** secures your at-risk haul; the run ends.
- **Scanner [S] (1 RF)** gives a directional hazard/treasure clue without revealing a tile.
- **Shield** and **Boost** are rare in-board finds, never purchasable. A Shield
  absorbs one mine detonation; a Boost adds +0.50× to your next two digs.
- **Green Mine** is a lucky anomaly — it doubles (2×) your current at-risk RF.
- **Ores** (Copper, Moon, Cosmic, Golden, Shadow) are collectible finds with no
  RF value at the bank; they lay the groundwork for future crafting/market
  mechanics.
- Controls: Arrow keys + Enter/Space to dig, `S` scanner, `C` bank; tap/touch
  targets on mobile. Audio uses procedural Web Audio (mute + reduced-motion
  options included).

## Economy (simulated)

Each preview ledger starts with **10 RF**. One run costs **1 RF**; a Scanner
costs **1 RF**. Buying a run reserves its maximum prize backing; kept rewards
retain their backed RF value until banked, with no expiry. All amounts use
bigint RF base units.

Per-round multipliers are fair survival odds per board discounted by a `250`
basis point house margin each round — the house edge keeps the economy
positive without caps or arbitrary pay tables. (Monte Carlo sims confirm a
positive house edge on every tier.)

| Mines | Start mult | Peak (full clear) |
| --- | --- | --- |
| 5 | ×1.22 | ×31,987 |
| 7 | ×1.35 | ×304,547 |
| 10 | ×1.62 | ×2,234,760 |
| 15 | ×2.44 | ×2,537,438 |
| 20 | ×4.88 | ×46,812 |
| 24 | ×24.38 | one safe tile only |

Ores, shields and boosts are rare board finds. Purchases, balances, at-risk
hauls, banks and outcomes in this preview are strictly simulated — no real
tokens are transferred, burned or required.

## Hosted demo

**YES.**

- **Test server (no wallet / no NFT):** <https://pipedrimer.github.io/friendsdk/>
  Running in `--test-mode` — mocked Friend, simulated RF, instant play.
- **Main playable preview:** <https://pipedrimer.github.io/friendsdk/play/>
  Wallet/network requirements: a browser wallet on **Robinhood mainnet (chain 4663)** holding a hardwired Rare Friends Generations NFT (generation ≥ 1). No RF funding or transaction signature is needed for the preview.

## Checks and known issues

- 26 deterministic engine unit tests (multipliers, wipes, shields, boosts, full-clear auto-bank).
- 20,000-run Monte Carlo economy simulation (positive house edge on all tiers).
- Automated browser smoke test: real sandboxed runtime, mock wallet, banked haul verified (e.g., +1.21 RF run).
- `npm run check:games` validates the game directory; TypeScript typecheck clean.
- Known limitations: no on-chain economy (deferred); SDK's chance-game client is used as one supported action bound — game rules run in the contained engine; session balances reset on reload (runtime has no save bridge).