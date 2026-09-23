import React from "react";
import { formatRf } from "../engine/economy.js";
import { RF_UNIT, RULES } from "../engine/rules.js";
import { CoinIcon } from "./Icons.js";

interface StakeSelectorProps {
  stakeRf: bigint;
  availableRf: bigint;
  onChange: (stake: bigint) => void;
  disabled?: boolean;
}

export function StakeSelector({
  stakeRf,
  availableRf,
  onChange,
  disabled = false,
}: StakeSelectorProps) {
  const currentWhole = Number(stakeRf / RF_UNIT);
  const maxWhole = Number(availableRf / RF_UNIT);

  const handleStep = (delta: number) => {
    if (disabled) return;
    const target = BigInt(Math.max(1, Math.min(maxWhole, currentWhole + delta))) * RF_UNIT;
    onChange(target);
  };

  const handlePreset = (amount: number) => {
    if (disabled) return;
    const clamped = Math.max(1, Math.min(maxWhole, amount));
    onChange(BigInt(clamped) * RF_UNIT);
  };

  const handleHalf = () => {
    if (disabled) return;
    const half = Math.max(1, Math.floor(maxWhole / 2));
    onChange(BigInt(half) * RF_UNIT);
  };

  const handleMax = () => {
    if (disabled) return;
    onChange(availableRf > RULES.minStakeRf ? availableRf : RULES.minStakeRf);
  };

  const presets = [1, 2, 5, 10];

  return (
    <div className="stake-selector" role="group" aria-label="Delve Stake Selector">
      <span className="stake-label">
        <CoinIcon className="rf-icon" aria-hidden="true" /> STAKE PER ROUND
      </span>

      {/* Preset chips */}
      <div className="stake-presets-group" role="group" aria-label="Quick stake amounts">
        {presets.map((preset) => {
          const presetUnits = BigInt(preset) * RF_UNIT;
          const isSelected = stakeRf === presetUnits;
          const canAfford = availableRf >= presetUnits;

          return (
            <button
              key={preset}
              type="button"
              className={`stake-preset-chip ${isSelected ? "active" : ""}`}
              disabled={disabled || !canAfford}
              aria-pressed={isSelected}
              aria-label={`${preset} RF`}
              onClick={() => handlePreset(preset)}
            >
              {preset} RF
            </button>
          );
        })}
        <button
          type="button"
          className="stake-preset-chip"
          disabled={disabled || maxWhole < 2}
          aria-label="Half of available balance"
          onClick={handleHalf}
        >
          1/2
        </button>
        <button
          type="button"
          className="stake-preset-chip"
          disabled={disabled || availableRf <= RULES.minStakeRf}
          aria-label="Maximum stake"
          onClick={handleMax}
        >
          MAX
        </button>
      </div>

      {/* Stepper with stake display */}
      <div className="stake-controls-row">
        <button
          type="button"
          className="stake-stepper-btn"
          onClick={() => handleStep(-1)}
          disabled={disabled || stakeRf <= RULES.minStakeRf}
          aria-label="Decrease stake by 1 RF"
          title="Decrease stake"
        >
          −
        </button>

        <div className="stake-display">
          <CoinIcon className="rf-icon" aria-hidden="true" />
          <span className="stake-amount" id="stake-display-value">
            {formatRf(stakeRf)}
          </span>
          <span className="stake-unit">RF</span>
        </div>

        <button
          type="button"
          className="stake-stepper-btn"
          onClick={() => handleStep(1)}
          disabled={disabled || stakeRf >= availableRf}
          aria-label="Increase stake by 1 RF"
          title="Increase stake"
        >
          +
        </button>
      </div>

      <div className="stake-meta-row">
        <span>
          VAULT: <strong>{formatRf(availableRf)} RF</strong>
        </span>
        <span>PAYOUT = STAKE × MULTIPLIER</span>
      </div>
    </div>
  );
}