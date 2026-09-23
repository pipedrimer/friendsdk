/**
 * Deterministic Mulberry32 32-bit PRNG.
 * Generates floating point numbers in [0, 1) from an integer seed.
 */
export function mulberry32(seed: number) {
  let s = Math.floor(seed) >>> 0;
  return function next(): number {
    let t = (s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generate a randomized seed in the uint32 range.
 */
export function createSeed(): number {
  return Math.floor(Math.random() * 2_147_483_647);
}

/**
 * Shuffle an array immutably using a random function.
 */
export function shuffleWithRng<T>(items: readonly T[], rng: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const temp = result[i];
    result[i] = result[j];
    result[j] = temp;
  }
  return result;
}
