import React from "react";
import type { MineRun } from "../types/game.js";
import { formatRf } from "../engine/economy.js";
import { formatMultiplier, getDangerTier } from "../engine/rules.js";
import {
  CloseIcon,
  QuestionIcon,
  ResourceIcon,
  SmokeIcon,
  SparklesIcon,
  TrophyIcon,
  WarningIcon,
} from "./Icons.js";

interface ResultOverlayProps {
  state: MineRun;
  onPlayAgain: () => void;
  onDismissScan: () => void;
}

export function ResultOverlay({ state, onPlayAgain, onDismissScan }: ResultOverlayProps) {
  // 1. Run Complete / Settlement Screen
  if (state.phase === "complete") {
    const isSuccess = state.bankedRf > 0n;
    const tier = getDangerTier(state.mineCount);

    return (
      <div className="result-overlay-backdrop" role="dialog" aria-modal="true" aria-labelledby="result-title">
        <div className="result-card">
          <div className="result-title-bar">
            <h2 id="result-title" style={{ margin: 0, font: "inherit" }}>
              {isSuccess ? "DELVE REPORT · SUCCESS" : "DELVE REPORT · CONCLUDED"}
            </h2>
            <button
              type="button"
              onClick={onPlayAgain}
              style={{ background: "transparent", border: 0, color: "inherit", cursor: "pointer", font: "inherit" }}
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          <div className="result-card-body">
            <div className={`result-badge ${isSuccess ? "victory" : "defeat"}`} id="final-banked-rf">
              {isSuccess ? `+${formatRf(state.bankedRf)} RF` : "HAUL LOST IN MINE"}
            </div>

            <table className="result-stats-table">
              <tbody>
                <tr>
                  <td>STAKE:</td>
                  <td>{formatRf(state.stakeRf)} RF</td>
                </tr>
                <tr>
                  <td>MINES:</td>
                  <td>{state.mineCount} MINES · {tier.name.toUpperCase()}</td>
                </tr>
                <tr>
                  <td>SAFE TILES:</td>
                  <td>{state.safeDigCount} TILES</td>
                </tr>
                <tr>
                  <td>MULTIPLIER:</td>
                  <td>{formatMultiplier(state.currentMultiplierBps)}x</td>
                </tr>
                <tr>
                  <td>NET SECURED:</td>
                  <td>{isSuccess ? `+${formatRf(state.bankedRf)} RF` : "0 RF"}</td>
                </tr>
                <tr>
                  <td>VAULT BALANCE:</td>
                  <td id="final-available-rf">{formatRf(state.availableRf)} RF</td>
                </tr>
              </tbody>
            </table>

            {/* Collected Ore Resources (collectibles: no RF credited at bank) */}
            {state.resources.length > 0 && (
              <div style={{ padding: "8px", border: "var(--rule-dashed)", background: "var(--paper)" }}>
                <span style={{ fontSize: "10px", fontWeight: "bold", textTransform: "uppercase" }}>
                  ORES FOUND
                </span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "4px" }}>
                  {state.resources.map((res, i) => (
                    <span key={`${res.resourceId}_${i}`} style={{ border: "var(--rule)", padding: "2px 6px", fontSize: "10px" }}>
                      {res.name}
                    </span>
                  ))}
                </div>
                <div style={{ fontSize: "10px", fontWeight: "bold", marginTop: "6px" }}>
                  Collectible ore (no RF value at bank)
                </div>
              </div>
            )}

            <div className="result-actions-row">
              <button
                type="button"
                className="result-btn-primary"
                onClick={onPlayAgain}
                id="btn-play-again"
              >
                PLAN NEXT DELVE
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 2. Scanner Clue Overlay
  if (state.lastScanResult) {
    const isDanger = state.lastScanResult.signal === "danger";
    const isTreasure = state.lastScanResult.signal === "treasure";

    return (
      <div className="result-overlay-backdrop" role="dialog" aria-modal="true" aria-labelledby="scan-title">
        <div className="result-card">
          <div className="result-title-bar">
            <span id="scan-title">SCAN REPORT · TILE #{state.lastScanResult.tileId + 1}</span>
            <button
              type="button"
              onClick={onDismissScan}
              style={{ background: "transparent", border: 0, color: "inherit", cursor: "pointer", font: "inherit" }}
              aria-label="Close scanner report"
            >
              ✕
            </button>
          </div>

          <div className="result-card-body">
            <div className={`result-badge ${isDanger ? "defeat" : "victory"}`}>
              {isDanger ? "DANGER: HIGH SEISMIC HAZARD" : isTreasure ? "TREASURE: SIGNAL DETECTED" : "CLEAR: LOW READINGS"}
            </div>
            <p style={{ fontSize: "11px", lineHeight: "1.4" }}>{state.lastScanResult.message}</p>
            <div className="result-actions-row">
              <button
                type="button"
                className="result-btn-primary"
                onClick={onDismissScan}
                id="btn-dismiss-scan"
              >
                RETURN TO MINEFIELD
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}