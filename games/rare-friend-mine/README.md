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

> 1 RF → round 1 @ 1.22x → 1.22 RF at risk → round 2 @ 1.23x → 1.22 × 1.23 = **1.50 RF** → round 3 @ 1.25x → **1.88 RF** ...

Every found tile shows the exact RF it secured, and **Bank returns exactly that numbers**. More mines = bigger per-round multipliers, and the deeper you dig the higher the rate climbs:

| Preset | Mines / 25 | Tier | Start multiplier | Next rounds | Peak (full clear) |
| --- | --- | --- | --- | --- | --- |
| 5 | 5 | Novice | ×1.22 | 1.23 → 1.25 → 1.26 | ×31,987 |
| 7 | 7 | Prospector | ×1.35 | 1.38 → 1.40 → 1.43 | ×304,547 |
| 10 | 10 | Prospector | ×1.62 | 1.67 → 1.72 → 1.79 | ×2,234,760 |
| 15 | 15 | Abyss | ×2.44 | 2.60 → 2.80 → 3.06 | ×2,537,438 |
| 20 | 20 | Cataclysm | ×4.88 | 5.85 → 7.47 → 10.73 | ×46,812 |
| 24 | 24 | Inferno | ×24.38 | one safe tile only | ×24.38 |

The per-round multipliers are honest fair odds per survival — a difficulty's peak reflects clearing **every** safe tile, which is extremely rare (the compounding jackpot usually ends in a mine long before the full clear). The house keeps a small per-round margin (`250` bps per round in the `RULES`) so the economy is sustainable without caps or arbitrary pay tables. Difficulty persists across runs until changed on the pre-run screen.

### 3. Minefield Hazards
- 🔥💣 **Red Mine (Full Blast)**: Detonates the shaft and wipes out **100% of your At-Risk RF**. No survival roll, no rescue — a detonated hazardous mine ends the run and the whole haul is lost.
- ⚡ **Yellow Mine (Greed Trap)**: A second hazardous blast — same rule: entire haul lost, run over.
- 🔮 **Purple Mine (Curse)**: Dangerous; if it detonates it also destroys the whole haul.
- 💧 **Blue Mine (Aquifer Rupture)**: Explodes and forfeits the entire haul as well.
- 🍀 **Green Mine (Lucky Mine)**: The one benign anomaly — and a **rare find**! Doubles (2×) your current At-Risk RF on discovery.

Any hazardous mine (red, yellow, purple, or blue) detonating without a Shield is a **live-ending wipe**. There is **no second chance** — bank early or risk everything.

> **Full clear ends the run automatically.** When every safe tile has been dug
> (only mines remain), the whole haul is **auto-banked at the peak multiplier** —
> there is no longer any feasible safe pick, so the run concludes by securing the
> jackpot. This matters most on **Inferno (24 mines / 25)**, where the single safe
> tile IS the full clear: finding it on the first dig banks the ×24.38 peak and
> ends the run immediately.

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

# Engine unit tests (29 deterministic cases)
node games/rare-friend-mine/tests/run-tests.mjs

# Economy Monte Carlo simulation (10,000 default runs per mine count, 5–24)
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
