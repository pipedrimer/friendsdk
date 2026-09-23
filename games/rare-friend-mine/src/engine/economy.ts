import { RF_DECIMALS, RF_UNIT, RULES } from "./rules.js";

export { RF_DECIMALS, RF_UNIT };

/**
 * Format bigint RF (in 18-decimal base units) to human-readable string.
 * Example: 10_000_000_000_000_000_000n -> "10"
 *          1_500_000_000_000_000_000n  -> "1.5"
 *          2_350_000_000_000_000_000n  -> "2.35"
 */
export function formatRf(units: bigint, precision: number = 2): string {
  if (units === 0n) return "0";
  const negative = units < 0n;
  const abs = negative ? -units : units;
  const whole = abs / RF_UNIT;
  const remainder = abs % RF_UNIT;

  if (remainder === 0n) {
    return `${negative ? "-" : ""}${whole.toString()}`;
  }

  const fractionStr = remainder.toString().padStart(18, "0");
  const cut = fractionStr.slice(0, precision);
  let formatted = `${whole}.${cut}`;

  if (cut === "00") {
    formatted = `${whole}`;
  } else if (formatted.endsWith("0")) {
    formatted = formatted.slice(0, -1);
  }

  return `${negative ? "-" : ""}${formatted}`;
}

/**
 * Convert human readable RF whole amount to base 18-decimal units.
 */
export function toBaseUnits(wholeRf: bigint): bigint {
  return wholeRf * RF_UNIT;
}

/**
 * Parse human readable input (e.g. number or string) to 18-decimal base units.
 */
export function parseRfToUnits(input: string | number): bigint {
  const num = typeof input === "number" ? input : parseFloat(input);
  if (isNaN(num) || num <= 0) return RULES.minStakeRf;
  const whole = Math.floor(num);
  const frac = Math.round((num - whole) * 100);
  return BigInt(whole) * RF_UNIT + (BigInt(frac) * RF_UNIT) / 100n;
}

/**
 * Calculate at-risk haul for the round given current stake and progressive multiplier.
 * stake: bigint in base units (e.g. 1 RF = 10^18)
 * multiplierBps: number in basis points (e.g. 15000 = 1.50x)
 */
export function calculateStepHaul(stake: bigint, multiplierBps: number): bigint {
  if (stake <= 0n || multiplierBps <= 0) return 0n;
  return (stake * BigInt(multiplierBps)) / 10000n;
}

/**
 * Calculate lucky green mine multiplier boost.
 */
export function calculateGreenMineMultiplier(multiplierBps: number): number {
  return multiplierBps * Number(RULES.greenMineMultiplier);
}