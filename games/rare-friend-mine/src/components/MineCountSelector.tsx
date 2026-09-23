import React from "react";
import {
  formatMultiplier,
  getDangerTier,
  getStartingMultiplier,
  MINES_CONFIG,
  POPULAR_MINE_PRESETS,
} from "../engine/rules.js";
import { BombIcon, CoinIcon } from "./Icons.js";

interface MineCountSelectorProps {
  mineCount: number;
  onChange: (count: number) => void;
  onStart: () => void;
}

export function MineCountSelector({ mineCount, onChange, onStart }: MineCountSelectorProps) {
  const tier = getDangerTier(mineCount);
  const safeTiles = MINES_CONFIG.totalTiles - mineCount;
  const startingBps = getStartingMultiplier(mineCount);

  const handleDecrement = () => {
    if (mineCount > MINES_CONFIG.minMines) onChange(mineCount - 1);
  };
  const handleIncrement = () => {
    if (mineCount < MINES_CONFIG.maxMines) onChange(mineCount + 1);
  };

  return (
    <fieldset className="mine-count-selector">
      <legend className="mine-selector-label">
        <BombIcon className="rf-icon" aria-hidden="true" /> SELECT MINES
      </legend>

      {/* Preset chips */}
      <div className="mine-presets-group" role="group" aria-label="Quick mine presets">
        {POPULAR_MINE_PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            className={`mine-preset-chip ${mineCount === preset ? "active" : ""}`}
            aria-pressed={mineCount === preset}
            aria-label={`${preset} mines`}
            onClick={() => onChange(preset)}
          >
            {preset}
          </button>
        ))}
      </div>

      {/* Stepper with count display */}
      <div className="mine-stepper-row">
        <button
          type="button"
          className="mine-stepper-btn"
          onClick={handleDecrement}
          disabled={mineCount <= MINES_CONFIG.minMines}
          aria-label="Decrease mines"
          title="Fewer mines"
        >
          −
        </button>

        <div className="mine-count-display">
          <span className="mine-count-number">
            <BombIcon className="rf-icon" aria-hidden="true" /> {mineCount}
          </span>
          <span className="mine-count-total">MINES · {safeTiles} SAFE</span>
        </div>

        <button
          type="button"
          className="mine-stepper-btn"
          onClick={handleIncrement}
          disabled={mineCount >= MINES_CONFIG.maxMines}
          aria-label="Increase mines"
          title="More mines"
        >
          +
        </button>
      </div>

      {/* Danger tier + multiplier info */}
      <div className="mine-info-row">
        <span className="mine-tier-badge">
          {tier.name.toUpperCase()}
        </span>
        <span className="mine-start-mult">
          <CoinIcon className="rf-icon" aria-hidden="true" />
          STARTS AT <strong>{formatMultiplier(startingBps)}x</strong>
        </span>
      </div>
    </fieldset>
  );
}