import React from "react";
import type { MineRun } from "../types/game.js";

interface RunLogProps {
  history: string[];
  /** How many of the most recent lines to show. */
  limit?: number;
}

/**
 * The delve log. The engine already narrates every dig into `state.history`;
 * this surfaces the tail of it so the player can read back what the seam did.
 */
export function RunLog({ history, limit = 6 }: RunLogProps) {
  if (history.length === 0) return null;
  const lines = history.slice(-limit).reverse();

  return (
    <section className="run-log" aria-label="Delve log">
      <h3 className="run-log-title">DELVE LOG</h3>
      <ol className="run-log-list">
        {lines.map((line, i) => (
          <li key={`${history.length - i}-${line.slice(0, 12)}`} className="run-log-line">
            {line}
          </li>
        ))}
      </ol>
    </section>
  );
}

export function RunLogBadge({ state }: { state: MineRun }) {
  if (state.history.length === 0) return null;
  return (
    <span className="run-log-badge" aria-label={`${state.history.length} log entries`}>
      {state.history.length}
    </span>
  );
}
