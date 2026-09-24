import React, { useEffect } from "react";
import {
  BoltIcon,
  CloverIcon,
  CoinIcon,
  LayersIcon,
  PickaxeIcon,
  ShieldIcon,
  SparklesIcon,
  WarningIcon,
} from "./Icons.js";

interface HowToPlayProps {
  open: boolean;
  onClose: () => void;
}

export function HowToPlay({ open, onClose }: HowToPlayProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="how-to-play-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="how-to-play-title"
      onClick={onClose}
    >
      <div className="how-to-play-card" onClick={(e) => e.stopPropagation()}>
        <div className="result-title-bar">
          <span id="how-to-play-title">HOW TO PLAY · RARE FRIENDS MINE</span>
          <button
            type="button"
            onClick={onClose}
            style={{ background: "transparent", border: 0, color: "inherit", cursor: "pointer", font: "inherit" }}
            aria-label="Close how to play"
          >
            ✕
          </button>
        </div>

        <div className="htp-body">
          {/* Goal */}
          <section className="htp-section">
            <h3 className="htp-head">
              <PickaxeIcon className="rf-icon" aria-hidden="true" /> THE GOAL
            </h3>
            <p className="htp-p">
              Dig tiles on a 5×5 minefield. Every <strong>safe tile</strong> you reveal makes your
              winnings bigger. <strong>Bank</strong> your haul before you dig up a mine — if you hit
              one, everything you had at risk is lost.
            </p>
          </section>

          {/* Money terms */}
          <section className="htp-section">
            <h3 className="htp-head">
              <CoinIcon className="rf-icon" aria-hidden="true" /> MONEY TALK
            </h3>
            <ul className="htp-list">
              <li>
                <strong>RF / $RAREFRIENDS</strong> — the play currency of this preview. It is all{" "}
                <strong>simulated</strong>; no real tokens are spent or won.
              </li>
              <li>
                <strong>Vault</strong> — your RF wallet inside the game. It starts at{" "}
                <strong>10 RF</strong>.
              </li>
              <li>
                <strong>Stake</strong> — the RF you risk to start a delve. It is taken from your
                Vault before the run.
              </li>
              <li>
                <strong>At-Risk</strong> — RF you have won but not secured yet. Hit a mine without a
                Shield and it disappears.
              </li>
              <li>
                <strong>Bank</strong> — locks in your at-risk haul, adds it to the Vault, and ends
                the run. Bank early and often!
              </li>
            </ul>
          </section>

          {/* Multiplier */}
          <section className="htp-section">
            <h3 className="htp-head">
              <SparklesIcon className="rf-icon" aria-hidden="true" /> THE MULTIPLIER
            </h3>
            <p className="htp-p">
              The <strong>round multiplier grows every dig</strong> and compounds your{" "}
              <strong>current at-risk haul</strong> — never the stake again. Start with 1 RF at
              a <strong>1.22x</strong> tile and you hold <strong>1.22 RF</strong>; the next round
              pays a <strong>1.23x</strong> tile so your haul becomes{" "}
              <strong>1.22 × 1.23 = 1.50 RF</strong>, then <strong>1.25x → 1.88 RF</strong>. Each
              tile shows the exact RF it secured. Bank any time and you get{" "}
              <strong>exactly</strong> that at-risk number.
            </p>
            <p className="htp-p">
              <strong>More mines = bigger per-round multipliers.</strong> The round multiplier
              also climbs as you dig deeper into the same board. <strong>Start</strong> is your
              first dig's multiplier, <strong>next</strong> is the growing multiplier for your
              next dig (always higher than the one you just used), and <strong>peak</strong> is
              the total multiple of your stake if you cleared every safe tile — the jackpot on
              a full clear is huge but the run almost always ends in a mine first.
            </p>
            <table className="htp-table">
              <thead>
                <tr>
                  <th>Mines / 25</th>
                  <th>Start</th>
                  <th>Next rounds</th>
                  <th>Peak (full clear)</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>5</td><td>1.22x</td><td>1.23x → 1.25x → 1.26x</td><td>31,987x</td></tr>
                <tr><td>7</td><td>1.35x</td><td>1.38x → 1.40x → 1.43x</td><td>304,547x</td></tr>
                <tr><td>10</td><td>1.62x</td><td>1.67x → 1.72x → 1.79x</td><td>2,234,760x</td></tr>
                <tr><td>15</td><td>2.44x</td><td>2.60x → 2.80x → 3.06x</td><td>2,537,438x</td></tr>
                <tr><td>20</td><td>4.88x</td><td>5.85x → 7.47x → 10.73x</td><td>46,812x</td></tr>
                <tr><td>24</td><td>24.38x</td><td>one safe tile only</td><td>24.38x</td></tr>
              </tbody>
            </table>
            <p className="htp-note">
              Tier names are just difficulty labels — Novice, Prospector, Abyss, Cataclysm, and
              Inferno — based on how many mines you pick.
            </p>
          </section>

          {/* Tiles */}
          <section className="htp-section">
            <h3 className="htp-head">
              <CloverIcon className="rf-icon" aria-hidden="true" /> TILES YOU CAN DIG
            </h3>
            <ul className="htp-list">
              <li>
                <strong>RF Deposit</strong> — safe. Revealing it banks the{" "}
                <strong>exact hauled RF</strong> shown on the tile: your at-risk haul times the
                growing round multiplier.
              </li>
              <li>
                <strong>Resource Ore</strong> — safe and <strong>rare</strong>. Copper, Moon,
                Cosmic, Golden, or Shadow Ore. Ores are <strong>collectibles with no RF value</strong>{" "}
                at the bank — but they also grow the haul like any round win.
              </li>
              <li>
                <strong>Special Cache</strong> — safe and <strong>rare</strong>. Equips <strong>+1 Shield</strong> or <strong>+2 Boost</strong> charges as a find.
                You cannot buy them.
              </li>
              <li>
                <strong>Mines (Red, Yellow, Purple, Blue)</strong> — danger! Dig one without a
                Shield and the run ends with your whole at-risk haul gone.
              </li>
              <li>
                <strong>Green Mine</strong> — lucky and <strong>rare</strong>. It{" "}
                <strong>doubles</strong> your current haul and keeps the run alive.
              </li>
            </ul>
          </section>

          {/* Perks */}
          <section className="htp-section">
            <h3 className="htp-head">
              <ShieldIcon className="rf-icon" aria-hidden="true" /> PERKS (RARE FINDS, NOT FOR SALE)
            </h3>
            <ul className="htp-list">
              <li>
                <strong>Shield</strong> — found in Special Caches. Absorbs the next mine blast
                and keeps your haul. Never purchasable.
              </li>
              <li>
                <strong>Boost</strong> — found in Special Caches. Your next 2 safe digs earn a
                bonus <strong>+0.50x</strong> on top of the round multiplier. Stack it with a
                Green Mine to run the numbers up.
              </li>
              <li>
                <strong>Bank</strong> — your best perk. The at-risk haul only becomes real RF when
                you secure it, and you keep <strong>exactly</strong> that number.
              </li>
            </ul>
          </section>

          {/* Gear Locker */}
          <section className="htp-section">
            <h3 className="htp-head">
              <SparklesIcon className="rf-icon" aria-hidden="true" /> GEAR LOCKER (DURABLE COSMETICS)
            </h3>
            <p className="htp-p">
              Open <strong>GEAR</strong> in the top bar (or the pre-run screen) to style your
              Friend: <strong>coats</strong>, <strong>helmets</strong>,{" "}
              <strong>pickaxe skins</strong> and <strong>auras</strong>. They are{" "}
              <strong>visual only</strong> — they never change a tile, the odds, or the payouts.
            </p>
            <ul className="htp-list">
              <li>
                <strong>Shop gear</strong> is a one-time purchase in simulated RF from your Vault
                (e.g. the Ember Pickaxe for 2 RF, Sunstone Coat for 4 RF, Storm Aura for 6 RF). You
                buy it once and it stays unlocked for this session.
              </li>
              <li>
                <strong>Trophy gear</strong> is earned free by playing: the <strong>Golden Helm</strong>{" "}
                for a full clear, the <strong>Deep-Seam Royal Coat</strong> for banking 25 RF in one
                run, the <strong>Diamond Pickaxe</strong> for 100 safe digs, and the{" "}
                <strong>Legend Glow</strong> for banking 100 RF total.
              </li>
              <li>
                A <strong>NEW</strong> badge on the GEAR button shows unlocks you have not viewed
                yet. All RF and gear is <strong>simulated</strong> and resets with the session.
              </li>
            </ul>
          </section>

          {/* Depth / HUD */}
          <section className="htp-section">
            <h3 className="htp-head">
              <LayersIcon className="rf-icon" aria-hidden="true" /> PROGRESS, LEVELS &amp; TOOLS
            </h3>
            <p className="htp-p">
              The HUD shows how many <strong>safe tiles</strong> you have dug and your current{" "}
              <strong>level</strong>. Every 3 safe digs you go one level deeper (up to 4) — it is a
              thrill meter, not a penalty. <strong>TOOLS</strong> shows your Shield charges and
              Boost digs left.
            </p>
          </section>

          {/* Controls */}
          <section className="htp-section">
            <h3 className="htp-head">
              <BoltIcon className="rf-icon" aria-hidden="true" /> CONTROLS
            </h3>
            <ul className="htp-list">
              <li><strong>Tap / click</strong> a tile to dig it.</li>
              <li><strong>Keyboard:</strong> Arrow keys to move, <strong>Enter / Space</strong> to dig, <strong>C</strong> = Bank, <strong>Esc</strong> = close this guide.</li>
              <li><strong>Top bar:</strong> DARK / LIGHT theme, SOUND on/off, MOTION / STATIC (wobble-free mode), GEAR (Gear Locker) and HELP.</li>
            </ul>
          </section>

          {/* Sim note */}
          <section className="htp-section">
            <h3 className="htp-head">
              <WarningIcon className="rf-icon" aria-hidden="true" /> GOOD TO KNOW
            </h3>
            <p className="htp-p">
              All RF here is <strong>simulated</strong> for this Vibeathon preview — no real tokens
              are spent or won. To play you need a connected wallet that owns a{" "}
              <strong>Rare Friends Generations NFT</strong>; eligibility is checked before you play.
              The mines are stacked against you on purpose — secure your haul when the number looks
              good.
            </p>
          </section>
        </div>

        <div className="htp-footer">
          <button
            type="button"
            className="result-btn-primary"
            onClick={onClose}
            id="btn-close-how-to-play"
          >
            BACK TO THE MINE
          </button>
        </div>
      </div>
    </div>
  );
}