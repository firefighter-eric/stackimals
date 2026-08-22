import { describe, expect, it } from 'vitest';

import {
  analyzeStack,
  chooseAIPlacement,
  rotatedDisplaySize,
  shouldSwapAIAnimal,
  type AIPlacementDecision,
} from '../game/ai/placementAI';
import { ANIMAL_IDS, type StackBodySnapshot } from '../game/core/types';
import { getAnimalDefinition } from '../game/data/animals';

const bodies: readonly StackBodySnapshot[] = [
  {
    id: 'base-bear',
    animalId: 'bear',
    owner: 'player',
    aabb: { minX: 130, maxX: 230, minY: 280, maxY: 360 },
    position: { x: 180, y: 320 },
    angle: 0,
  },
  {
    id: 'top-cat',
    animalId: 'cat',
    owner: 'ai',
    aabb: { minX: 155, maxX: 225, minY: 215, maxY: 285 },
    position: { x: 190, y: 250 },
    angle: 0,
  },
];

describe('stack analysis', () => {
  it('derives a tower center and top support region from AABBs', () => {
    const analysis = analyzeStack(bodies, { minX: 100, maxX: 300 });

    expect(analysis.towerBounds).toEqual({ minX: 130, maxX: 230, minY: 215, maxY: 360 });
    expect(analysis.supportBodyIds).toEqual(['top-cat']);
    expect(analysis.supportSpans).toEqual([{ minX: 155, maxX: 225 }]);
    expect(analysis.towerCenterX).toBeGreaterThanOrEqual(180);
    expect(analysis.towerCenterX).toBeLessThanOrEqual(190);
  });

  it('uses the platform as support when the tower is empty', () => {
    const analysis = analyzeStack([], { minX: 90, maxX: 310 });
    expect(analysis.supportSpans).toEqual([{ minX: 90, maxX: 310 }]);
    expect(analysis.towerCenterX).toBe(200);
  });
});

describe('chooseAIPlacement', () => {
  it('is reproducible, legal, and selects an allowed angle', () => {
    const context = {
      animalId: 'rabbit' as const,
      bodies,
      platform: { minX: 100, maxX: 300 },
      playfield: { minX: 20, maxX: 380 },
    };
    const first = chooseAIPlacement(context, 'ai-turn-7');
    const second = chooseAIPlacement(context, 'ai-turn-7');
    const size = rotatedDisplaySize(context.animalId, first.angle);

    expect(first).toEqual(second);
    expect(getAnimalDefinition(context.animalId).allowedAngles).toContain(first.angle);
    expect(first.x - size.width / 2).toBeGreaterThanOrEqual(context.playfield.minX - 1e-6);
    expect(first.x + size.width / 2).toBeLessThanOrEqual(context.playfield.maxX + 1e-6);
    expect(first.supportRatio).toBeGreaterThan(0);
    expect(first.usedFallback).toBe(false);
  });

  it('has a deterministic narrow-playfield fallback', () => {
    const decision = chooseAIPlacement({
      animalId: 'bear',
      bodies: [],
      platform: { minX: 0, maxX: 20 },
      playfield: { minX: 0, maxX: 20 },
    }, 17);

    expect(decision.usedFallback).toBe(true);
    expect(decision.x).toBe(10);
    expect(getAnimalDefinition('bear').allowedAngles).toContain(decision.angle);
  });

  it('uses every animal in a posture that matches its play style', () => {
    for (const animalId of ANIMAL_IDS) {
      const animal = getAnimalDefinition(animalId);
      const decision = chooseAIPlacement({
        animalId,
        bodies: [],
        platform: { minX: 48, maxX: 342 },
        playfield: { minX: 34, maxX: 356 },
      }, `featured-${animalId}`);

      expect(animal.gameplay.preferredAngles).toContain(decision.angle);
      expect(decision.usedFallback).toBe(false);
    }
  });
});

describe('AI animal swapping', () => {
  const decision = (overrides: Partial<AIPlacementDecision>): AIPlacementDecision => ({
    x: 195,
    angle: 0,
    score: 8,
    supportRatio: 0.6,
    towerCenterX: 195,
    supportSpans: [{ minX: 100, maxX: 290 }],
    usedFallback: false,
    ...overrides,
  });

  it('uses a swap for a materially safer queued animal', () => {
    expect(shouldSwapAIAnimal(
      decision({ score: 7.2, supportRatio: 0.52 }),
      decision({ score: 8.1, supportRatio: 0.72 }),
    )).toBe(true);
  });

  it('keeps the current animal when the alternative is not meaningfully better', () => {
    expect(shouldSwapAIAnimal(
      decision({ score: 8, supportRatio: 0.76 }),
      decision({ score: 8.2, supportRatio: 0.78 }),
    )).toBe(false);
    expect(shouldSwapAIAnimal(
      decision({ usedFallback: false }),
      decision({ usedFallback: true }),
    )).toBe(false);
  });
});
