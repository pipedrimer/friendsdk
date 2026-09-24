import React from "react";
import type { MineRun } from "../types/game.js";
import { formatRf, calculateStepHaul } from "../engine/economy.js";
import { formatMultiplier, getDangerTier, getStartingMultiplier } from "../engine/rules.js";
import {
  BoltIcon,
  BombIcon,
  CoinIcon,
  FlameIcon,
  PickaxeIcon,
  QuestionIcon,
  ShieldIcon,
  SpeakerOffIcon,
  SpeakerOnIcon,
  SparklesIcon,
  TrophyIcon,
} from "./Icons.js";

interface GameHudProps {
  state: MineRun;
  muted: boolean;
  reducedMotion: boolean;
  theme: "light" | "invert";
  newCosmetics: number;
  onToggleMute: () => void;
  onToggleReducedMotion: () => void;
  onToggleTheme: () => void;
  onToggleHelp: () => void;
  onToggleCosmetics: () => void;
}

export function GameHud({
  state,
  muted,
  reducedMotion,
  theme,
  newCosmetics,
  onToggleMute,
  onToggleReducedMotion,
  onToggleTheme,
  onToggleHelp,
  onToggleCosmetics,
}: GameHudProps) {
  const tier = getDangerTier(state.mineCount);
  const startBps = getStartingMultiplier(state.mineCount);
  const inRun =
    state.phase === "playing" ||
    state.phase === "revealing" ||
    state.phase === "crashing" ||
    state.phase === "complete";
  const hasMultiplier = state.safeDigCount > 0;
  const projectedPayout = calculateStepHaul(state.stakeRf, startBps);

  return (
    <header className="game-hud" aria-label="Game Status Bar">
      {/* 1. Available Vault RF */}
      <div className="hud-stat-box">
        <span className="stat-label">
          <CoinIcon className="rf-icon" aria-hidden="true" />
          AVAILABLE
        </span>
        <span className="stat-value" id="hud-available-rf">
          {formatRf(state.availableRf)} RF
        </span>
      </div>

      {inRun ? (
        <>
          {/* 2. Current At-Risk Haul */}
          <div className={`hud-stat-box ${state.atRiskRf > 0n ? "pulse-emerald" : ""}`}>
            <span className="stat-label">
              <FlameIcon className="rf-icon" aria-hidden="true" />
              AT RISK
            </span>
            <span className="stat-value" id="hud-at-risk-rf">
              {formatRf(state.atRiskRf)} RF
            </span>
          </div>

          {/* 3. Progressive Multiplier (next round grows every dig, compounds the haul) */}
          <div className={`hud-stat-box ${hasMultiplier ? "highlight-gold" : ""}`}>
            <span className="stat-label">
              <SparklesIcon className="rf-icon" aria-hidden="true" />
              MULTIPLIER
            </span>
            <span className="stat-value" id="hud-multiplier-value">
              {formatMultiplier(state.nextMultiplierBps)}x
              <small className="stat-sub">next · net {formatMultiplier(state.currentMultiplierBps)}x</small>
            </span>
          </div>

          {/* 4. Safe Digs Progress */}
          <div className="hud-stat-box">
            <span className="stat-label">
              <PickaxeIcon className="rf-icon" aria-hidden="true" />
              PROGRESS
            </span>
            <span className="stat-value" id="hud-safe-count">
              {state.safeDigCount} safe · L{state.depth}
            </span>
          </div>

          {/* 5. Tool Charges */}
          <div className="hud-stat-box">
            <span className="stat-label">
              <BoltIcon className="rf-icon" aria-hidden="true" />
              TOOLS
            </span>
            <span className="stat-value" id="hud-tool-charges">
              <span className="tool-chip">
                <ShieldIcon className="rf-icon" aria-hidden="true" />
                {state.shieldCharges}
              </span>
              <span className="tool-chip">
                <BoltIcon className="rf-icon" aria-hidden="true" />
                {state.boostDigsRemaining}
              </span>
            </span>
          </div>
        </>
      ) : (
        <>
          {/* 2. Selected Stake */}
          <div className="hud-stat-box">
            <span className="stat-label">
              <CoinIcon className="rf-icon" aria-hidden="true" />
              STAKE
            </span>
            <span className="stat-value" id="hud-stake-rf">
              {formatRf(state.stakeRf)} RF
            </span>
          </div>

          {/* 3. Projected Bank (stake × starting multiplier) */}
          <div className="hud-stat-box">
            <span className="stat-label">
              <TrophyIcon className="rf-icon" aria-hidden="true" />
              PAYOUT
            </span>
            <span className="stat-value" id="hud-payout-rf">
              +{formatRf(projectedPayout)} RF
            </span>
          </div>

          {/* 4. Run Status */}
          <div className="hud-stat-box">
            <span className="stat-label">
              <PickaxeIcon className="rf-icon" aria-hidden="true" />
              STATUS
            </span>
            <span className="stat-value" id="hud-status-label">
              ready to delve
            </span>
          </div>
        </>
      )}

      {/* 5. Danger Tier / Mine Count Badge */}
      <div
        className={`hud-tier-badge tier-${tier.id}`}
        title={`${tier.name}: ${state.mineCount} mines, starts at ${formatMultiplier(startBps)}x`}
      >
        <BombIcon className="rf-icon" aria-hidden="true" /> {state.mineCount}M ·{" "}
        {tier.name.toUpperCase()}
      </div>

      {/* 6. Utility Controls (Gear, Theme, Sound, Motion) */}
      <div className="hud-util-cluster" aria-label="Display and audio controls">
        <button
          type="button"
          className={`hud-btn-toggle ${newCosmetics > 0 ? "has-new" : ""}`}
          id="btn-gear-locker"
          onClick={onToggleCosmetics}
          aria-haspopup="dialog"
          aria-label={newCosmetics > 0 ? `Open gear locker, ${newCosmetics} new` : "Open gear locker"}
          title="Gear Locker — durable cosmetics for your Friend"
        >
          <SparklesIcon className="rf-icon" aria-hidden="true" /> GEAR
          {newCosmetics > 0 && (
            <span className="gear-new-badge" aria-hidden="true">{newCosmetics}</span>
          )}
        </button>

        <button
          type="button"
          className="hud-btn-toggle"
          id="btn-toggle-theme"
          onClick={onToggleTheme}
          aria-label="Toggle dark or light theme"
          title="Switch theme"
        >
          {theme === "invert" ? "LIGHT" : "DARK"}
        </button>

        <button
          type="button"
          className="hud-btn-toggle"
          onClick={onToggleMute}
          aria-label={muted ? "Unmute audio" : "Mute audio"}
          title={muted ? "Sound Off (click to unmute)" : "Sound On (click to mute)"}
        >
          {muted ? <SpeakerOffIcon className="rf-icon" aria-hidden="true" /> : <SpeakerOnIcon className="rf-icon" aria-hidden="true" />}
          {muted ? "MUTE" : "SOUND"}
        </button>

        <button
          type="button"
          className="hud-btn-toggle"
          onClick={onToggleReducedMotion}
          aria-label="Toggle reduced motion"
          title="Toggle Reduced Motion"
        >
          {reducedMotion ? "STATIC" : "MOTION"}
        </button>

        <button
          type="button"
          className="hud-btn-toggle"
          id="btn-toggle-help"
          onClick={onToggleHelp}
          aria-haspopup="dialog"
          aria-label="How to play"
          title="How to play"
        >
          <QuestionIcon className="rf-icon" aria-hidden="true" /> HELP
        </button>
      </div>
    </header>
  );
}