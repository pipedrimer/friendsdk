import type {
  CosmeticEarnRule,
  CosmeticItem,
  CosmeticsState,
  SessionStats,
} from "../types/game.js";
import { RF_UNIT } from "./rules.js";

const rf = (whole: number) => BigInt(whole) * RF_UNIT;

/**
 * The durable gear catalog. Shop items cost simulated RF from the Vault once
 * each; trophy items are granted free by session achievements. Everything is
 * visual only and labeled simulated — purchases never change odds or payouts
 * and never redeem real tokens.
 */
export const CATALOG: readonly CosmeticItem[] = [
  // --- Shop: durable, one-time simulated-RF purchases ---
  {
    id: "coat/sunstone",
    slot: "coat",
    name: "Sunstone Coat",
    blurb: "Molten-gold coat with a magma head.",
    priceRf: rf(4),
    palette: { primary: "#ffb800", accent: "#ff7a1a" },
  },
  {
    id: "coat/viridian",
    slot: "coat",
    name: "Viridian Coat",
    blurb: "Deep emerald coat, teal command head.",
    priceRf: rf(4),
    palette: { primary: "#00b87a", accent: "#00d4ff" },
  },
  {
    id: "coat/nocturne",
    slot: "coat",
    name: "Nocturne Coat",
    blurb: "Royal violet coat with a hot-pink head.",
    priceRf: rf(4),
    palette: { primary: "#7c3aed", accent: "#ff3ac8" },
  },
  {
    id: "helmet/brass",
    slot: "helmet",
    name: "Brass Miner Helm",
    blurb: "A trusty brass cap for cold seams.",
    priceRf: rf(3),
    color: "#f0b429",
  },
  {
    id: "helmet/crown",
    slot: "helmet",
    name: "Ruby Gap Crown",
    blurb: "A crown cut from deep-seam ruby.",
    priceRf: rf(5),
    color: "#ff5470",
  },
  {
    id: "pickaxe/ember",
    slot: "pickaxe",
    name: "Ember Pickaxe",
    blurb: "Forged in a vent seam, still glowing.",
    priceRf: rf(2),
    color: "#ff7a1a",
  },
  {
    id: "pickaxe/plasma",
    slot: "pickaxe",
    name: "Plasma Pickaxe",
    blurb: "Charged with unstable plasma.",
    priceRf: rf(2),
    color: "#00d4ff",
  },
  {
    id: "aura/ember",
    slot: "aura",
    name: "Ember Aura",
    blurb: "A warm miner's glow follows you.",
    priceRf: rf(6),
    color: "#ff7a1a",
  },
  {
    id: "aura/storm",
    slot: "aura",
    name: "Storm Aura",
    blurb: "Crackling azure static field.",
    priceRf: rf(6),
    color: "#38bdf8",
  },

  // --- Trophies: earned free by session achievements ---
  {
    id: "helmet/golden",
    slot: "helmet",
    name: "Golden Helm",
    blurb: "Crown of a full clear.",
    priceRf: 0n,
    earn: { kind: "full-clear" },
    color: "#ffd60a",
  },
  {
    id: "coat/royal",
    slot: "coat",
    name: "Deep-Seam Royal Coat",
    blurb: "Violet coat, gold head — you banked in style.",
    priceRf: 0n,
    earn: { kind: "single-bank", thresholdRf: rf(25) },
    palette: { primary: "#b47aff", accent: "#ffb800" },
  },
  {
    id: "pickaxe/diamond",
    slot: "pickaxe",
    name: "Diamond Pickaxe",
    blurb: "100 safe digs paid in pure diamond.",
    priceRf: 0n,
    earn: { kind: "safe-digs", threshold: 100 },
    color: "#8ef7ff",
  },
  {
    id: "aura/legend",
    slot: "aura",
    name: "Legend Glow",
    blurb: "For miners who banked 100 RF.",
    priceRf: 0n,
    earn: { kind: "session-banked", thresholdRf: rf(100) },
    color: "#ccff00",
  },
] as const;

export const SHOP_ITEMS: readonly CosmeticItem[] = CATALOG.filter((item) => !item.earn);
export const EARNED_ITEMS: readonly CosmeticItem[] = CATALOG.filter((item) => item.earn);

export function getCosmeticItem(itemId: string): CosmeticItem | undefined {
  return CATALOG.find((item) => item.id === itemId);
}

export function createCosmeticsState(): CosmeticsState {
  return { unlocked: [], equipped: { coat: null, helmet: null, pickaxe: null, aura: null }, newItems: [] };
}

export function createSessionStats(): SessionStats {
  return { safeDigs: 0, bankedRf: 0n, bestSingleBankRf: 0n, fullClears: 0 };
}

export function isCosmeticOwned(cosmetics: CosmeticsState, itemId: string): boolean {
  return cosmetics.unlocked.includes(itemId);
}

function ruleMet(rule: CosmeticEarnRule, stats: SessionStats): boolean {
  switch (rule.kind) {
    case "full-clear":
      return stats.fullClears >= 1;
    case "single-bank":
      return stats.bestSingleBankRf >= rule.thresholdRf;
    case "session-banked":
      return stats.bankedRf >= rule.thresholdRf;
    case "safe-digs":
      return stats.safeDigs >= rule.threshold;
  }
}

/** Trophy items whose achievement is met with the current session stats. */
export function countEarnedWith(stats: SessionStats): number {
  return EARNED_ITEMS.filter((item) => item.earn && ruleMet(item.earn, stats)).length;
}

/** Newly-earned trophy ids for the given stats, minus what is already unlocked. */
export function newlyEarnedIds(
  cosmetics: CosmeticsState,
  stats: SessionStats,
): string[] {
  return EARNED_ITEMS.filter(
    (item) => item.earn && ruleMet(item.earn, stats) && !isCosmeticOwned(cosmetics, item.id),
  ).map((item) => item.id);
}

/** Human-readable progress hint shown for locked trophy items. */
export function achievementProgress(item: CosmeticItem, stats: SessionStats): string | null {
  if (!item.earn) return null;
  const rule = item.earn;
  switch (rule.kind) {
    case "full-clear":
      return stats.fullClears > 0 ? "Full clear complete!" : "Full clear any board";
    case "single-bank":
      return `Bank ${formatRfUnits(rule.thresholdRf)} RF in one run · best ${formatRfUnits(stats.bestSingleBankRf)}`;
    case "session-banked":
      return `Bank ${formatRfUnits(rule.thresholdRf)} RF total · ${formatRfUnits(stats.bankedRf)}`;
    case "safe-digs":
      return `${stats.safeDigs}/${rule.threshold} safe digs`;
  }
}

/** Dim a hex color toward black or white by `amount` (-1..1). */
export function shade(hex: string, amount: number): string {
  const clean = hex.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(clean)) return hex;
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  let r = parseInt(clean.slice(0, 2), 16);
  let g = parseInt(clean.slice(2, 4), 16);
  let b = parseInt(clean.slice(4, 6), 16);
  if (amount < 0) {
    r = clamp(r * (1 + amount));
    g = clamp(g * (1 + amount));
    b = clamp(b * (1 + amount));
  } else {
    r = clamp(r + (255 - r) * amount);
    g = clamp(g + (255 - g) * amount);
    b = clamp(b + (255 - b) * amount);
  }
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function formatRfUnits(units: bigint): string {
  if (units === 0n) return "0";
  const whole = units / RF_UNIT;
  const remainder = units % RF_UNIT;
  if (remainder === 0n) return whole.toString();
  const cut = remainder.toString().padStart(18, "0").slice(0, 2);
  return `${whole}.${cut.replace(/0$/, "")}`;
}

export function formatCosmeticPrice(units: bigint): string {
  return units === 0n ? "FREE" : `${formatRfUnits(units)} RF`;
}