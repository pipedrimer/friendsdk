# Rare Friends: MINE

A fast-paced, high-stakes risk/reward mining game built with **FriendSDK v0.1.2** for the **Rare Friends Vibeathon**.

Your selected Rare Friends miner enters a deep geological mine shaft, spending simulated `$RAREFRIENDS` (`RF`) to excavate hidden tiles. Safe tiles yield RF deposits and rare collectible ores that increase your **RF at risk**. Players face the pivotal dilemma on every single tap:

> **Bank now, or risk more for a bigger haul?**

---

## Vibeathon Category Alignment

- **Character Spotlight**: Your selected Generations NFT is the living protagonist—walking, digging with its pickaxe, trembling when risk escalates, reacting with joy to cosmic ores, and celebrating upon banking.
- **Token Activity**: `$RAREFRIENDS` powers the gameplay loop as Entry Fuel (1 RF) and the At-Risk Vault. The haul you bank is compounded by the growing per-round multiplier for the risk tier you chose (via mine count). Shields and Boosts are **rare finds on the board — never purchasable**.
- **Economy Potential**: Mined resources (Copper, Moon, Cosmic, Golden, and Shadow Ore) establish the foundation for persistent crafting and asynchronous peer-to-peer marketplace trading. Durable cosmetic gear (coats, helmets, pickaxes, auras) is unlocked without any simulated risk — a first step toward persistent, wearer-owned cosmetics.

---

## Key Gameplay Mechanics

### 1. The Token Model (Simulated)
- **Available RF**: Stored balance ready for entry or purchasing utilities.
- **At-Risk RF**: Active loot accumulated during the run. Vulnerable to mine blasts!
- **Banked RF**: Secured tokens finalized upon ending the run — **exactly** the at-risk haul, never more.

### 2. Delve Difficulty & Growing Round Multiplier
Before each run you pick how many mines hide on the 5×5 board. The **round multiplier grows every safe dig** and **compounds your current at-risk haul** — never the stake again:

> 1 RF → round 1 @ 1.14x → 1.14 RF at risk → round 2 @ 1.15x → 1.14 × 1.15 = **1.31 RF** → round 3 @ 1.16x → **1.52 RF** ...

Every found tile shows the exact RF it secured, and **Bank returns exactly that number**. More mines = bigger per-round multipliers, and the deeper you dig the higher the rate climbs:

| Preset | Mines / 25 | Tier | Start multiplier | Next rounds | Peak (capped) |
| --- | --- | --- | --- | --- | --- |
| 5 | 5 | Novice | ×1.14 | 1.15 → 1.16 → 1.18 | ×250 |
| 7 | 7 | Prospector | ×1.26 | 1.28 → 1.31 → 1.33 | ×250 |
| 10 | 10 | Prospector | ×1.52 | 1.56 → 1.61 → 1.67 | ×250 |
| 15 | 15 | Abyss | ×2.28 | 2.43 → 2.62 → 2.86 | ×250 |
| 20 | 20 | Cataclysm | ×4.55 | 5.46 → 6.98 → 10.01 | ×250 |
| 24 | 24 | Inferno | ×22.75 | one safe tile only | ×22.75 |

The per-round multipliers are fair odds per survival, discounted by a per-round
house edge (`RULES.houseEdgeBps` = **900 bps**). Two rules keep the economy
honest and are enforced in the engine, not just documented:

- **Seam yield cap.** A delve can never pay more than **×250** of its stake
  (`RULES.maxHaulMultipleBps`). The raw compounding curve on a 5-mine board runs
  past ×8,000, but only ×250 is ever collectable — so the advertised peak is
  both reachable-in-principle and fundable. The HUD shows **YIELD CAP** once the
  haul can no longer grow, and the remaining safe tiles are only worth digging
  for ore.
- **Rare finds need room.** A Lucky Seam is never placed on a board with fewer
  than three safe tiles, because a green tile there would double a single
  enormous round — the one case a per-round house edge cannot absorb.

The house edge is verified against the **best legal bank policy** on every
selectable mine count (5–24), not one cautious bot. See
[Economy verification](#economy-verification).

### 3. Minefield Hazards
Each hazard is named, and the name says how it ends the run:

- 💥 **Red — Curse Vein**: A pressure-burst pocket. Detonates the shaft and wipes out **100% of your At-Risk RF**. No survival roll, no rescue.
- 💧 **Yellow — Aquifer Rupture**: A flooded pocket. Same rule: entire haul lost, run over.
- 🔮 **Purple — Greed Trap**: Cursed bait. Same rule: the whole haul is lost.
- ❄️ **Blue — Deep-Seam Chill**: A cold seam that simply ends the delve where it stands. Same rule: whole haul lost.
- 🍀 **Green — Lucky Seam**: The one benign anomaly, and a **rare find**. It **doubles the round it replaces** (including any active Boost), so the round still counts: a ×2.4 round becomes ×4.8, never a flat ×2. It keeps the run alive.

Any hazardous mine (red, yellow, purple, or blue) detonating without a Shield is a **live-ending wipe**. There is **no second chance** — bank early or risk everything.

> **Full clear ends the run automatically.** When every safe tile has been dug
> (only mines remain), the whole haul is **auto-banked at the capped peak
> multiplier** — there is no longer any feasible safe pick, so the run concludes
> by securing the jackpot. This matters most on **Inferno (24 mines / 25)**, where
> the single safe tile IS the full clear: finding it on the first dig banks the
> ×22.75 peak and ends the run immediately.

### 4. Tactical Rare Finds
- **Shield** (rare find — special cache): Absorbs and neutralizes the next mine detonation encountered — the only thing standing between you and a total wipe. **Not purchasable.**
- **Boost** (rare find — special cache): +0.50× for your next 2 safe digs (adds to the growing round multiplier). **Not purchasable.**
- **Ore** (rare find): Copper, Moon, Cosmic, Golden, or Shadow Ore — collectible resources with **no RF value** at the bank, but they still grow the haul like any safe dig.

### 5. Gear Locker (Durable Cosmetics, Simulated RF)
Open **GEAR** in the top bar (or the **GEAR LOCKER** card on the pre-run screen) to style your Friend. Gear is **durable and visual-only** — it never changes odds or payouts. Unlocks and equipped gear persist across runs for your Friend for the runtime session.

- **Shop skins** (simulated RF, one-time per Friend):

| Slot | Item | RF |
| --- | --- | --- |
| Coat | Sunstone / Viridian / Nocturne | 4 each |
| Helmet | Brass | 3 |
| Helmet | Crown | 5 |
| Pickaxe | Ember / Plasma | 2 each |
| Aura | Ember / Storm | 6 each |

- **Achievement trophies** (earned, never purchasable):

| Item | Unlock |
| --- | --- |
| Golden Helm | Complete a full clear |
| Royal Coat | Bank 25 RF in a single run |
| Diamond Pickaxe | Dig 100 safe tiles |
| Legend Glow | Bank 100 RF total across the session |

Purchases deduct exactly their listed simulated RF from the vault; an **NEW** badge on the GEAR button flags unlocks you have not viewed. Buy one, own it for the session — no recurring costs, no refunds (simulated).

---

## Economy verification

The house edge is not asserted, it is measured. `tests/economy-sim.ts` drives the
**real reducer** through every selectable mine count (5–24) and sweeps **eight
legal bank policies**, including *never bank* — the greediest possible strategy,
which rides the compounding curve to the end of a run.

> An earlier version of this file only tested `bank at >= 2 RF`. That made the
> economy look healthy while *"never bank"* actually paid the player **8% more
> than they staked**. The check now asserts against the **best** policy found.

Two properties make the check reliable:

- **Paired observations.** The board and dig order do not depend on when the
  player banks, so one pass records the whole haul trajectory and every
  threshold is read off that same path. This is exact, not an estimate of a
  policy, and it removes the cross-policy noise.
- **A noise-aware gate.** On hard boards the jackpot is rare (a 23-mine board
  clears both safe tiles about 0.4% of the time for a ~×248 payout). At 6,000
  runs that single event swung the estimate by 16 percentage points, which
  produced phantom failures. The gate therefore only fails when the best policy
  beats the house by **more than two standard errors**, and the reported
  "worst-case" edge is the pessimistic end of that band rather than the raw
  point estimate.

Run it with:

```bash
node games/rare-friend-mine/tests/run-sim.mjs              # 20,000 paired runs
RF_MINE_SIM_RUNS=60000 node games/rare-friend-mine/tests/run-sim.mjs   # high confidence
```

At 60,000 paired runs the house wins against every legal policy on all 20 mine
counts. Most cells settle at a **6–9%** house edge. Two cells — 20 and 23 mines,
where the win depends on a rare ×250-class jackpot — are genuinely noisy and
measured anywhere from **2% to 5%** across repeated runs, so no single run should
be quoted as a precise margin. The invariant being enforced is the one in the
table above: no mine count is player-profitable. The exit code is non-zero if
any count fails.

### Vault soft-lock recovery

Losing every RF is a legal outcome, so the game must never strand a drained
player. `canStartRun` refuses to open an unpayable run, the CTA disables with an
**OUT OF RF** state, and a recovery panel offers **RESET SESSION**, which
restores the 10 RF starting balance while **keeping all gear and session
achievement progress**. It is refused mid-run, so it cannot be used to dodge a
detonation.

---

## Controls

### Mobile / Touch
- **Tap Tile**: Dig unrevealed tile.
- **Action Buttons**: Large 44px+ touch targets for Bank.

### Desktop Keyboard Shortcuts
- **Arrow Keys**: Move focus across the 5×5 grid.
- **Enter / Space**: Dig the focused tile.
- **[C]**: Bank Haul immediately.

---

## Technology Stack

- **Framework**: React 19 + TypeScript + FriendSDK v0.1.2 Runtime
- **Styling**: Vanilla CSS with Cyberpunk obsidian cave aesthetics, glassmorphic HUD, and responsive CSS grid
- **Audio**: Web Audio API procedural 16-bit arcade sound synthesis (zero external audio dependencies)
- **Animation**: Native CSS keyframes + HTML5 canvas pixel rendering with reduced-motion accessibility support

---

## Local Development & Testing

From the FriendSDK root directory:

```bash
# Verify SDK rules and bundle integrity
node scripts/check-games.mjs games/rare-friend-mine

# Build static bundle
node scripts/dev-game.mjs build games/rare-friend-mine

# Typecheck the game sources
npx tsc -p games/rare-friend-mine/tsconfig.json --noEmit

# Engine unit tests (44 deterministic cases, including cap and soft-lock regressions)
node games/rare-friend-mine/tests/run-tests.mjs

# Economy Monte Carlo simulation (20,000 default paired runs per mine count, 5–24)
node games/rare-friend-mine/tests/run-sim.mjs

# Automated browser smoke test (mock wallet + real sandboxed runtime + Gear Locker)
node games/rare-friend-mine/tests/browser-smoke.mjs

# Responsive mobile smoke test (portrait + short-landscape phones)
node games/rare-friend-mine/tests/mobile-smoke.mjs

# Launch live local preview server
node scripts/dev-game.mjs dev games/rare-friend-mine --port 4173
```

Open `http://127.0.0.1:4173` in your browser.

> **Playing without an NFT**: The real (default) dev server keeps the FriendSDK
> ownership gate — you must connect a wallet that owns a hardwired Generations NFT.
> For an playable test environment with no wallet or NFT, add `--test-mode`:

```bash
# npm run dev:mine:test              # shorthand
node scripts/dev-game.mjs dev games/rare-friend-mine --outdir games/rare-friend-mine/.friendsdk/test --test-mode
```

> `--test-mode` is a dev/test-only host that mounts the game under the SDK runtime
> with the sanctioned sample identity (Rare Friends #7730) and grants simulated RF for
> instant gameplay. A **TEST MODE · mocked Rare Friends #7730 · simulated RF** ribbon is
> shown so testers know the identity is fabricated. Do not deploy or publish this
> output; normal `dev`/`build` keeps the real eligibility gate.

---

## Simulated Economy Disclaimer

All `$RAREFRIENDS` balances, entry fees, rewards, gear purchases and cosmetics in this preview are strictly simulated for the Vibeathon demonstration. No real tokens are transferred, burned, or required.
