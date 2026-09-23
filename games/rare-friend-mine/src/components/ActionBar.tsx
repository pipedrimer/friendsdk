import React from "react";
import type { MineRun } from "../types/game.js";
import { formatRf } from "../engine/economy.js";
import { formatMultiplier } from "../engine/rules.js";
import { BankIcon } from "./Icons.js";

interface ActionBarProps {
  state: MineRun;
  disabled: boolean;
  onBank: () => void;
}

export function ActionBar({ state, disabled, onBank }: ActionBarProps) {
  const isPlaying = state.phase === "playing";
  const canBank = isPlaying && state.atRiskRf > 0n && !disabled;

  return (
    <footer className="action-deck" aria-label="Game Action Controls">
      {/* Bank Haul Button */}
      <button
        type="button"
        className={`action-btn btn-bank ${canBank ? "ready" : ""}`}
        disabled={!canBank}
        onClick={onBank}
        id="btn-bank"
        aria-label={`Bank and secure ${formatRf(state.atRiskRf)} simulated RF (${formatMultiplier(state.currentMultiplierBps)}x)`}
      >
        <span className="action-title">
          <BankIcon className="rf-icon" aria-hidden="true" />
          {canBank ? "SECURE & BANK" : "BANK HAUL"}
        </span>
        <span className="action-cost">
          {canBank
            ? `${formatRf(state.atRiskRf)} RF @ ${formatMultiplier(state.currentMultiplierBps)}x`
            : state.phase === "complete"
              ? "0 RF"
              : "No haul yet"}
        </span>
      </button>
    </footer>
  );
}
