import React, { useRef } from "react";
import type { MineTile, ScanResult } from "../types/game.js";
import { formatRf } from "../engine/economy.js";
import {
  BombIcon,
  BoltIcon,
  CloverIcon,
  CoinIcon,
  CoinSplitIcon,
  CursedEyeIcon,
  DropletIcon,
  QuestionIcon,
  RadarIcon,
  ResourceIcon,
  ShieldIcon,
  SparklesIcon,
  WarningIcon,
} from "./Icons.js";

interface MineGridProps {
  board: MineTile[];
  disabled: boolean;
  selectedTileIndex: number | null;
  lastScanResult?: ScanResult;
  crashing?: boolean;
  crashTileId?: number | null;
  onSelect: (tileId: number) => void;
}

const MINE_ICONS: Record<string, React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
  red: BombIcon,
  yellow: CoinSplitIcon,
  green: CloverIcon,
  purple: CursedEyeIcon,
  blue: DropletIcon,
};

export function MineGrid({
  board,
  disabled,
  selectedTileIndex,
  lastScanResult,
  crashing = false,
  crashTileId = null,
  onSelect,
}: MineGridProps) {
  const gridRef = useRef<HTMLDivElement | null>(null);

  // Keyboard navigation support: Arrow keys navigation & Enter/Space selection
  const handleKeyDown = (event: React.KeyboardEvent, index: number) => {
    let nextIndex = -1;
    switch (event.key) {
      case "ArrowUp":
        nextIndex = index - 5 >= 0 ? index - 5 : index;
        break;
      case "ArrowDown":
        nextIndex = index + 5 < 25 ? index + 5 : index;
        break;
      case "ArrowLeft":
        nextIndex = index % 5 !== 0 ? index - 1 : index;
        break;
      case "ArrowRight":
        nextIndex = (index + 1) % 5 !== 0 ? index + 1 : index;
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        if (!disabled && !board[index]?.revealed) {
          onSelect(index);
        }
        return;
      default:
        return;
    }

    if (nextIndex !== -1 && nextIndex !== index) {
      event.preventDefault();
      const buttons = gridRef.current?.querySelectorAll<HTMLButtonElement>("button.mine-tile");
      buttons?.[nextIndex]?.focus();
    }
  };

  return (
    <div
      ref={gridRef}
      className="mine-grid-container"
      role="grid"
      aria-label="5 by 5 Minefield"
    >
      {board.map((tile, index) => {
        const isRevealing = selectedTileIndex === index;
        const isScanned = lastScanResult?.tileId === index;
        const isRevealed = tile.revealed;

        // During a detonation crash, every unrevealed mine detonates in a shockwave
        // radiating outward from the epicenter (the tile that was actually dug).
        const crashMine = crashing && !isRevealed && tile.kind === "mine";
        const shown = isRevealed || crashMine;
        const row = Math.floor(index / 5);
        const col = index % 5;
        const epicenterRow = crashTileId !== null ? Math.floor(crashTileId / 5) : -1;
        const epicenterCol = crashTileId !== null ? crashTileId % 5 : -1;
        const shockWaveDelay =
          crashMine && crashTileId !== null
            ? (Math.abs(row - epicenterRow) + Math.abs(col - epicenterCol)) * 55
            : 0;
        const isEpicenter = crashing && crashTileId === index;

        let tileContent: React.ReactNode = null;
        let tileAriaLabel = `Tile row ${row + 1}, column ${col + 1}: unrevealed`;
        let tileClasses = "mine-tile";

        if (isScanned && !shown) {
          tileClasses += ` scanned-${lastScanResult.signal}`;
        }

        if (isRevealing) {
          tileClasses += " is-revealing";
        }

        if (crashMine) {
          tileClasses += " crash-mine";
        }

        if (isEpicenter) {
          tileClasses += " crash-epicenter";
        }

        if (shown) {
          tileClasses += " revealed";

          // Each safe dig banks its EXACT compounding win on the tile (the haul at risk
          // right after that dig). Ores and special caches also carry their RF win.
          const exactWin = tile.haulRf;

          if (tile.kind === "rf") {
            tileClasses += " tile-rf";
            tileAriaLabel = `RF Deposit: +${formatRf(exactWin ?? 0n)} RF`;
            tileContent = (
              <div className="tile-inner rf-content">
                <span className="tile-icon" aria-hidden="true"><CoinIcon /></span>
                <span className="tile-value">+{formatRf(exactWin ?? 0n)}</span>
                <span className="tile-sub">RF</span>
              </div>
            );
          } else if (tile.kind === "resource") {
            tileClasses += ` tile-ore ore-${tile.rarity}`;
            tileAriaLabel = `Resource: ${tile.name} (${tile.rarity}) +${formatRf(exactWin ?? 0n)} RF`;
            tileContent = (
              <div className="tile-inner ore-content">
                <span className="tile-icon" aria-hidden="true"><ResourceIcon id={tile.resourceId} /></span>
                <span className="tile-value">{tile.name}</span>
                {exactWin !== undefined && (
                  <span className="tile-sub">+{formatRf(exactWin)} RF</span>
                )}
              </div>
            );
          } else if (tile.kind === "mine") {
            tileClasses += ` tile-mine mine-${tile.mineType}`;
            tileAriaLabel = `Mine encountered: ${tile.mineType} mine`;
            const MineIcon = MINE_ICONS[tile.mineType] ?? BombIcon;
            const mineText = tile.mineType === "green" ? "2X LUCKY" : "LOSE ALL";

            tileContent = (
              <div className="tile-inner mine-content">
                <span className="tile-icon" aria-hidden="true"><MineIcon /></span>
                <span className="tile-value">{mineText}</span>
                {tile.mineType === "green" && exactWin !== undefined && (
                  <span className="tile-sub">+{formatRf(exactWin)} RF</span>
                )}
              </div>
            );
          } else if (tile.kind === "special") {
            const isBoost = tile.specialType === "boost";
            tileClasses += " tile-special";
            tileAriaLabel = `Special: ${isBoost ? "+Boost charges" : "+1 Shield"} haul +${formatRf(exactWin ?? 0n)} RF`;
            tileContent = (
              <div className="tile-inner special-content">
                <span className="tile-icon" aria-hidden="true">
                  {isBoost ? <BoltIcon /> : <ShieldIcon />}
                </span>
                <span className="tile-value">{isBoost ? "+BOOST" : "+SHIELD"}</span>
                {exactWin !== undefined && (
                  <span className="tile-sub">+{formatRf(exactWin)} RF</span>
                )}
              </div>
            );
          }
        } else {
          // Unrevealed tile state
          tileContent = (
            <div className="tile-inner unrevealed-content">
              {isScanned ? (
                <span className="scan-indicator-badge">
                  {lastScanResult.signal === "danger"
                    ? <WarningIcon />
                    : lastScanResult.signal === "treasure"
                      ? <SparklesIcon />
                      : <QuestionIcon />}
                </span>
              ) : (
                <span className="tile-coord">{index + 1}</span>
              )}
            </div>
          );
        }

        return (
          <button
            key={tile.id}
            type="button"
            className={tileClasses}
            disabled={disabled || shown || isRevealing}
            aria-label={tileAriaLabel}
            aria-pressed={shown}
            onClick={() => onSelect(index)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            style={crashMine ? { animationDelay: `${shockWaveDelay}ms` } : undefined}
          >
            {tileContent}
          </button>
        );
      })}
    </div>
  );
}