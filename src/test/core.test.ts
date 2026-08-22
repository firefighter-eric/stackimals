import { describe, expect, it } from 'vitest';

import { SeededAnimalQueue } from '../game/core/animalQueue';
import { resolveFallOutcome } from '../game/core/matchRules';
import { SeededRandom } from '../game/core/prng';
import { StabilityDetector, isBodyAtRest } from '../game/core/stability';
import { ANIMAL_IDS } from '../game/core/types';
import { ANIMALS, getAnimalCopy } from '../game/data/animals';

describe('SeededRandom', () => {
  it('repeats the same sequence for the same string seed', () => {
    const first = new SeededRandom('match-42');
    const second = new SeededRandom('match-42');

    expect(Array.from({ length: 8 }, () => first.nextUint32())).toEqual(
      Array.from({ length: 8 }, () => second.nextUint32()),
    );
  });

  it('can restore a saved state exactly', () => {
    const random = new SeededRandom(1234);
    random.next();
    const state = random.snapshot();
    const expected = [random.next(), random.next(), random.next()];

    random.restore(state);
    expect([random.next(), random.next(), random.next()]).toEqual(expected);
  });
});

describe('SeededAnimalQueue', () => {
  it('is reproducible and includes every animal in each complete bag', () => {
    const first = new SeededAnimalQueue('same-match');
    const second = new SeededAnimalQueue('same-match');
    const bagSize = ANIMAL_IDS.length;
    const firstTwoBags = Array.from({ length: bagSize * 2 }, () => first.next());
    const secondTwoBags = Array.from({ length: bagSize * 2 }, () => second.next());

    expect(firstTwoBags).toEqual(secondTwoBags);
    expect(new Set(firstTwoBags.slice(0, bagSize))).toEqual(new Set(ANIMAL_IDS));
    expect(new Set(firstTwoBags.slice(bagSize))).toEqual(new Set(ANIMAL_IDS));
    expect(firstTwoBags[bagSize - 1]).not.toBe(firstTwoBags[bagSize]);
  });

  it('previews without consuming animals', () => {
    const queue = new SeededAnimalQueue(9);
    const preview = queue.preview(5);

    expect(queue.drawCount).toBe(0);
    expect(Array.from({ length: 5 }, () => queue.next())).toEqual(preview);
  });

  it('exchanges the current animal and defers it without losing the bag', () => {
    const animalIds = ['bear', 'cat', 'rabbit'] as const;
    const queue = new SeededAnimalQueue('swap-bag', animalIds);
    const current = queue.next();
    const nextBeforeSwap = queue.preview(2);
    const replacement = queue.exchange(current);

    expect(replacement).toBe(nextBeforeSwap[0]);
    expect(queue.drawCount).toBe(2);
    expect(new Set([replacement, ...queue.preview(2)])).toEqual(new Set(animalIds));
    expect(queue.preview(2).at(-1)).toBe(current);
  });

  it('does not repeat the same animal when exchanging at a bag boundary', () => {
    const animalIds = ['bear', 'cat', 'rabbit'] as const;
    const queue = new SeededAnimalQueue('swap-boundary', animalIds);
    const drawn = animalIds.map(() => queue.next());
    const current = drawn.at(-1)!;

    expect(queue.exchange(current)).not.toBe(current);
  });
});

describe('animal data', () => {
  it('defines every render and physics contract', () => {
    expect(ANIMALS.map((animal) => animal.id)).toEqual(ANIMAL_IDS);
    for (const animal of ANIMALS) {
      expect(animal.display.width).toBeGreaterThan(0);
      expect(animal.display.height).toBeGreaterThan(0);
      expect(animal.allowedAngles).toContain(0);
      expect(animal.collision.outline.length).toBeGreaterThan(2);
      expect(animal.physics.friction).toBeGreaterThanOrEqual(0);
      expect(animal.physics.restitution).toBeGreaterThanOrEqual(0);
      expect(animal.gameplay.tip.length).toBeGreaterThan(0);
      expect(animal.gameplay.tipEn.length).toBeGreaterThan(0);
      expect(animal.gameplay.settledCopy.length).toBeGreaterThan(0);
      expect(animal.gameplay.settledCopyEn.length).toBeGreaterThan(0);
      expect(animal.sizeLabelEn.length).toBeGreaterThan(0);
      expect(animal.traitEn.length).toBeGreaterThan(0);
      expect(animal.gameplay.moveSpeedMultiplier).toBeGreaterThan(0.5);
      expect(animal.gameplay.moveSpeedMultiplier).toBeLessThan(1.5);
      expect(animal.gameplay.aiOrientationWeight).toBeGreaterThanOrEqual(0);
      expect(animal.gameplay.preferredAngles.length).toBeGreaterThan(0);
      for (const preferredAngle of animal.gameplay.preferredAngles) {
        expect(animal.allowedAngles).toContain(preferredAngle);
      }
    }
  });

  it('provides complete Chinese and English player-facing copy', () => {
    for (const animal of ANIMALS) {
      const chinese = getAnimalCopy(animal.id, 'zh');
      const english = getAnimalCopy(animal.id, 'en');

      expect(Object.values(chinese).every((value) => value.length > 0)).toBe(true);
      expect(Object.values(english).every((value) => value.length > 0)).toBe(true);
      expect(chinese.name).toBe(animal.nameZh);
      expect(english.name).toBe(animal.name);
    }
  });

  it('uses low-rebound, quickly damped wooden impact tuning', () => {
    for (const animal of ANIMALS) {
      expect(animal.physics.restitution, `${animal.id}: wooden restitution`).toBeLessThanOrEqual(0.012);
      expect(animal.physics.frictionAir, `${animal.id}: impact damping`).toBeGreaterThanOrEqual(0.022);
    }
  });
});

describe('StabilityDetector', () => {
  const quietBody = {
    id: 'quiet',
    velocity: { x: 0.02, y: 0.01 },
    angularVelocity: 0.002,
  };
  const movingBody = {
    id: 'moving',
    velocity: { x: 0.8, y: 0.1 },
    angularVelocity: 0.03,
  };

  it('requires a continuous quiet window', () => {
    const detector = new StabilityDetector({ requiredStableMs: 500, maxWaitMs: 2_000 });

    expect(detector.sample(0, [quietBody]).state).toBe('moving');
    expect(detector.sample(499, [quietBody]).state).toBe('moving');
    expect(detector.sample(500, [quietBody]).state).toBe('stable');

    detector.reset();
    detector.sample(0, [quietBody]);
    detector.sample(300, [movingBody]);
    expect(detector.sample(700, [quietBody]).state).toBe('moving');
    expect(detector.sample(1_200, [quietBody]).state).toBe('stable');
  });

  it('reports moving ids and eventually times out persistent jitter', () => {
    const detector = new StabilityDetector({ requiredStableMs: 500, maxWaitMs: 900 });
    detector.sample(100, [movingBody]);
    const result = detector.sample(1_000, [movingBody]);

    expect(result.state).toBe('timed-out');
    expect(result.movingBodyIds).toEqual(['moving']);
    expect(isBodyAtRest({ ...movingBody, isSleeping: true })).toBe(true);
  });
});

describe('resolveFallOutcome', () => {
  it('makes the acting player responsible for a chain reaction', () => {
    expect(resolveFallOutcome({
      phase: 'settling',
      actingActor: 'player',
      fallenBodies: [{ id: 'old-ai-body', owner: 'ai' }],
    })).toEqual({
      winner: 'ai',
      loser: 'player',
      reason: 'chain-reaction',
      fallenBodyIds: ['old-ai-body'],
    });
  });

  it('attributes a current drop and ignores an already finished match', () => {
    expect(resolveFallOutcome({
      phase: 'dropping',
      actingActor: 'ai',
      fallenBodies: [{ id: 'ai-drop', owner: 'ai', isCurrentDrop: true }],
    })?.reason).toBe('active-drop-fell');

    expect(resolveFallOutcome({
      phase: 'game-over',
      actingActor: 'ai',
      fallenBodies: [{ id: 'late-body', owner: 'player' }],
    })).toBeNull();
  });
});
