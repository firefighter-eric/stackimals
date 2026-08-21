export type RandomSeed = number | string;

const UINT32_RANGE = 0x1_0000_0000;
const DEFAULT_NON_ZERO_SEED = 0x6d2b79f5;

/** Convert strings and numbers to a stable unsigned 32-bit seed. */
export function seedToUint32(seed: RandomSeed): number {
  if (typeof seed === 'number') {
    if (!Number.isFinite(seed)) {
      throw new RangeError('Random seed must be a finite number.');
    }

    return Math.trunc(seed) >>> 0;
  }

  // FNV-1a is deliberately simple and stable across JS runtimes.
  let hash = 0x811c9dc5;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return hash >>> 0;
}

/**
 * Small deterministic PRNG based on Mulberry32. It is suitable for gameplay
 * queues and AI tie-breaking, not for security-sensitive randomness.
 */
export class SeededRandom {
  private state: number;

  constructor(seed: RandomSeed = DEFAULT_NON_ZERO_SEED) {
    this.state = seedToUint32(seed);
  }

  nextUint32(): number {
    this.state = (this.state + DEFAULT_NON_ZERO_SEED) >>> 0;
    let value = this.state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return (value ^ (value >>> 14)) >>> 0;
  }

  /** Return a floating-point value in the half-open interval [0, 1). */
  next(): number {
    return this.nextUint32() / UINT32_RANGE;
  }

  /** Return an integer in the half-open interval [min, maxExclusive). */
  nextInt(min: number, maxExclusive: number): number {
    if (!Number.isInteger(min) || !Number.isInteger(maxExclusive) || maxExclusive <= min) {
      throw new RangeError('nextInt requires integer bounds where maxExclusive > min.');
    }

    return min + Math.floor(this.next() * (maxExclusive - min));
  }

  range(min: number, max: number): number {
    if (!Number.isFinite(min) || !Number.isFinite(max) || max < min) {
      throw new RangeError('range requires finite bounds where max >= min.');
    }

    return min + this.next() * (max - min);
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) {
      throw new RangeError('Cannot pick from an empty collection.');
    }

    return items[this.nextInt(0, items.length)] as T;
  }

  shuffle<T>(items: readonly T[]): T[] {
    const shuffled = [...items];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swapIndex = this.nextInt(0, index + 1);
      [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex] as T, shuffled[index] as T];
    }
    return shuffled;
  }

  snapshot(): number {
    return this.state >>> 0;
  }

  restore(state: number): void {
    if (!Number.isInteger(state) || state < 0 || state >= UINT32_RANGE) {
      throw new RangeError('PRNG state must be an unsigned 32-bit integer.');
    }
    this.state = state >>> 0;
  }
}
