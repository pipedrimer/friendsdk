import React from "react";
import type { DifficultyId } from "../types/game.js";
import { DIFFICULTIES, formatMultiplier } from "../engine/rules.js";
import { BombIcon, CoinIcon } from "./Icons.js";

interface DifficultyPickerProps {
  value: DifficultyId;
  onChange: (id: DifficultyId) => void;
  onStart?: () => void;
}

export function DifficultyPicker({ value, onChange, onStart }: DifficultyPickerProps) {
  return (
    <fieldset className="difficulty-picker">
      <legend className="difficulty-label">SELECT DELVE DIFFICULTY</legend>
      <div className="difficulty-options" role="group" aria-label="Choose delve difficulty">
        {DIFFICULTIES.map((difficulty) => {
          const active = difficulty.id === value;

          const handleClick = () => {
            if (active && onStart) {
              onStart();
            } else {
              onChange(difficulty.id as DifficultyId);
            }
          };

          return (
            <button
              key={difficulty.id}
              type="button"
              className={`difficulty-option ${active ? "active" : ""}`}
              aria-pressed={active}
              onClick={handleClick}
              title={`${difficulty.tagline}. ${difficulty.minesPerBoard} mines / 25 tiles. Starts at x${formatMultiplier(difficulty.initialMultiplierBps)} per safe tile.`}
            >
              <span className="difficulty-name">
                <BombIcon className="rf-icon" aria-hidden="true" />
                {difficulty.name}
              </span>
              <small className="difficulty-stats">
                {difficulty.minesPerBoard} mines / 25
              </small>
              <small className="difficulty-multiplier">
                <CoinIcon className="rf-icon" aria-hidden="true" />
                starts x{formatMultiplier(difficulty.initialMultiplierBps)}
              </small>

              {active && onStart && (
                <span className="difficulty-quick-start" aria-hidden="true">
                  ▶ START
                </span>
              )}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}