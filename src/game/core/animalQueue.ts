import { ANIMAL_IDS, type AnimalId } from './types';
import { SeededRandom, type RandomSeed } from './prng';

export interface AnimalQueueSnapshot {
  readonly randomState: number;
  readonly remaining: readonly AnimalId[];
  readonly previous?: AnimalId;
  readonly drawCount: number;
}

/**
 * Endless shuffle-bag queue. Every complete bag contains each configured
 * animal once, which keeps matches varied while remaining fully reproducible.
 */
export class SeededAnimalQueue {
  private readonly random: SeededRandom;
  private readonly animalIds: readonly AnimalId[];
  private remaining: AnimalId[] = [];
  private previous: AnimalId | undefined;
  private draws = 0;

  constructor(seed: RandomSeed, animalIds: readonly AnimalId[] = ANIMAL_IDS) {
    if (animalIds.length === 0) {
      throw new RangeError('Animal queue requires at least one animal.');
    }
    if (new Set(animalIds).size !== animalIds.length) {
      throw new RangeError('Animal queue entries must be unique.');
    }

    this.random = new SeededRandom(seed);
    this.animalIds = [...animalIds];
  }

  next(): AnimalId {
    if (this.remaining.length === 0) {
      this.refill();
    }

    const animal = this.remaining.shift();
    if (animal === undefined) {
      // The constructor/refill invariants make this unreachable.
      throw new Error('Animal queue failed to refill.');
    }

    this.previous = animal;
    this.draws += 1;
    return animal;
  }

  /**
   * Replace the already-drawn current animal with the next queued animal and
   * defer the replaced animal to the back of the active bag.
   */
  exchange(current: AnimalId): AnimalId {
    if (!this.animalIds.includes(current)) {
      throw new RangeError('Exchanged animal must belong to this queue.');
    }
    if (this.animalIds.length === 1) {
      return current;
    }

    if (this.remaining.length === 0) {
      this.refill();
      // A newly refilled bag contains the current animal again. Remove that
      // copy before deferring it so the bag still contains one of each animal.
      const duplicateIndex = this.remaining.indexOf(current);
      if (duplicateIndex >= 0) {
        this.remaining.splice(duplicateIndex, 1);
      }
    }

    const replacement = this.remaining.shift();
    if (replacement === undefined) {
      throw new Error('Animal queue could not provide an exchange replacement.');
    }

    this.remaining.push(current);
    this.previous = replacement;
    this.draws += 1;
    return replacement;
  }

  /** Read upcoming animals without advancing the live queue. */
  preview(count: number): readonly AnimalId[] {
    if (!Number.isInteger(count) || count < 0) {
      throw new RangeError('Preview count must be a non-negative integer.');
    }

    const snapshot = this.snapshot();
    const result = Array.from({ length: count }, () => this.next());
    this.restore(snapshot);
    return result;
  }

  get drawCount(): number {
    return this.draws;
  }

  snapshot(): AnimalQueueSnapshot {
    return {
      randomState: this.random.snapshot(),
      remaining: [...this.remaining],
      previous: this.previous,
      drawCount: this.draws,
    };
  }

  restore(snapshot: AnimalQueueSnapshot): void {
    if (!Number.isInteger(snapshot.drawCount) || snapshot.drawCount < 0) {
      throw new RangeError('Queue draw count must be a non-negative integer.');
    }
    if (snapshot.remaining.some((animal) => !this.animalIds.includes(animal))) {
      throw new RangeError('Queue snapshot contains an animal outside this queue.');
    }

    this.random.restore(snapshot.randomState);
    this.remaining = [...snapshot.remaining];
    this.previous = snapshot.previous;
    this.draws = snapshot.drawCount;
  }

  private refill(): void {
    const nextBag = this.random.shuffle(this.animalIds);

    // Avoid an identical animal on a bag boundary when there is an alternative.
    if (this.previous !== undefined && nextBag.length > 1 && nextBag[0] === this.previous) {
      const swapIndex = this.random.nextInt(1, nextBag.length);
      [nextBag[0], nextBag[swapIndex]] = [nextBag[swapIndex] as AnimalId, nextBag[0] as AnimalId];
    }

    this.remaining = nextBag;
  }
}

export function createAnimalQueue(seed: RandomSeed): SeededAnimalQueue {
  return new SeededAnimalQueue(seed);
}
