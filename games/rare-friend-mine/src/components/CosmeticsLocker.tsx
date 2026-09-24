import React, { useEffect } from "react";
import type { CosmeticSlot, MineRun } from "../types/game.js";
import { FriendActor } from "./FriendActor.js";
import {
  EARNED_ITEMS,
  SHOP_ITEMS,
  achievementProgress,
  formatCosmeticPrice,
  getCosmeticItem,
} from "../engine/cosmetics.js";
import { formatRf } from "../engine/economy.js";
import { WarningIcon } from "./Icons.js";

type LockerItem = {
  id: string;
  slot: CosmeticSlot;
  name: string;
  blurb: string;
  priceRfText: string;
  priceUnits: bigint;
  owned: boolean;
  equipped: boolean;
  earned: boolean;
  progress: string | null;
  color?: string;
  palette?: { primary: string; accent: string };
};

interface CosmeticsLockerProps {
  open: boolean;
  friendId: bigint;
  state: MineRun;
  onPurchase: (itemId: string) => void;
  onEquip: (itemId: string) => void;
  onUnequip: (slot: CosmeticSlot) => void;
  onAck: () => void;
  onClose: () => void;
}

const SLOT_LABELS: Record<string, string> = {
  coat: "COAT",
  helmet: "HELMET",
  pickaxe: "PICKAXE",
  aura: "AURA",
};

export function CosmeticsLocker({
  open,
  friendId,
  state,
  onPurchase,
  onEquip,
  onUnequip,
  onAck,
  onClose,
}: CosmeticsLockerProps) {
  useEffect(() => {
    if (!open) return;
    onAck();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onAck, onClose]);

  if (!open) return null;

  const { cosmetics, stats } = state;

  const itemView = (id: string): LockerItem | null => {
    const item = getCosmeticItem(id);
    if (!item) return null;
    const owned = cosmetics.unlocked.includes(id);
    const equipped = cosmetics.equipped[item.slot] === id;
    return {
      id: item.id,
      slot: item.slot,
      name: item.name,
      blurb: item.blurb,
      priceRfText: formatCosmeticPrice(item.priceRf),
      priceUnits: item.priceRf,
      owned,
      equipped,
      earned: Boolean(item.earn),
      progress: item.earn && !owned ? achievementProgress(item, stats) : null,
      color: item.color,
      palette: item.palette,
    };
  };

  const renderCard = (id: string) => {
    const item = itemView(id);
    if (!item) return null;
    const affordable = state.availableRf >= item.priceUnits;
    const swatchStyle = item.palette
      ? {
          background: `linear-gradient(90deg, ${item.palette.primary} 50%, ${item.palette.accent} 50%)`,
        }
      : { background: item.color ?? "var(--ink-30)" };

    return (
      <div className="gear-item-card" key={item.id} data-slot={item.slot} data-owned={item.owned}>
        <div className="gear-swatch" style={swatchStyle} aria-hidden="true" />
        <div className="gear-item-info">
          <span className="gear-item-name">{item.name}</span>
          <span className="gear-item-blurb">{item.blurb}</span>
        </div>
        <div className="gear-item-status-row">
          {item.owned && item.equipped ? (
            <>
              <span className="gear-equipped-badge">EQUIPPED</span>
              <button
                type="button"
                className="gear-btn-gear"
                onClick={() => onUnequip(item.slot)}
                aria-label={`Unequip ${item.name}`}
              >
                UNEQUIP
              </button>
            </>
          ) : item.owned ? (
            <>
              <span className="gear-price">{item.priceRfText}</span>
              <button
                type="button"
                className="gear-btn-gear"
                onClick={() => onEquip(item.id)}
                aria-label={`Equip ${item.name}`}
              >
                EQUIP
              </button>
            </>
          ) : item.earned ? (
            <>
              <span className="gear-progress">{item.progress}</span>
              <button
                type="button"
                className="gear-btn-gear"
                disabled
                aria-label={`${item.name} is locked`}
              >
                LOCKED
              </button>
            </>
          ) : (
            <>
              <span className="gear-price">{item.priceRfText}</span>
              <button
                type="button"
                className="gear-btn-gear gear-btn-buy"
                disabled={!affordable}
                onClick={() => onPurchase(item.id)}
                aria-label={`Buy ${item.name} for ${item.priceRfText} simulated`}
              >
                {affordable ? "BUY" : "NO RF"}
              </button>
            </>
          )}
        </div>
      </div>
    );
  };

  const slots: string[] = ["coat", "helmet", "pickaxe", "aura"];

  return (
    <div
      className="how-to-play-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="gear-locker-title"
      onClick={onClose}
    >
      <div className="gear-locker-card" onClick={(e) => e.stopPropagation()}>
        <div className="result-title-bar">
          <span id="gear-locker-title">GEAR LOCKER · FRIEND #{friendId.toString()}</span>
          <button
            type="button"
            onClick={onClose}
            style={{ background: "transparent", border: 0, color: "inherit", cursor: "pointer", font: "inherit" }}
            aria-label="Close gear locker"
          >
            ✕
          </button>
        </div>

        <div className="gear-locker-body">
          <div className="gear-preview-strip">
            <FriendActor friendId={friendId} state={state} cosmetics={cosmetics} reducedMotion />
            <div className="gear-preview-info">
              <span className="gear-preview-title">YOUR MINER</span>
              <span className="gear-preview-blurb">
                Durable skins for Friend #{friendId.toString()}. Visual only — never changes odds
                or payouts. Vault: <strong>{formatRf(state.availableRf)} RF</strong> (simulated).
              </span>
            </div>
          </div>

          {slots.map((slot) => {
            const shop = SHOP_ITEMS.filter((i) => i.slot === slot);
            const earned = EARNED_ITEMS.filter((i) => i.slot === slot);
            if (shop.length === 0 && earned.length === 0) return null;
            return (
              <section className="gear-slot-section" key={slot}>
                <h3 className="gear-slot-head">{SLOT_LABELS[slot] ?? slot}</h3>
                <div className="gear-item-grid">
                  {shop.map((i) => renderCard(i.id))}
                  {earned.map((i) => renderCard(i.id))}
                </div>
              </section>
            );
          })}
        </div>

        <div className="htp-footer">
          <p className="gear-note">
            <WarningIcon className="rf-icon" aria-hidden="true" /> All RF, purchases and gear are{" "}
            <strong>simulated</strong> for this preview and last for the runtime session. Gear is
            unlocked per Friend, one time each.
          </p>
          <button type="button" className="result-btn-primary" onClick={onClose} id="btn-close-gear-locker">
            BACK TO THE MINE
          </button>
        </div>
      </div>
    </div>
  );
}