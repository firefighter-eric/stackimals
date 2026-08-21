import { describe, expect, it } from 'vitest';

import { SeededAnimalQueue } from '../game/core/animalQueue';
import { resolveFallOutcome } from '../game/core/matchRules';
import { SeededRandom } from '../game/core/prng';
import { StabilityDetector, isBodyAtRest } from '../game/core/stability';
import { ANIMAL_IDS } from '../game/core/types';
import { ANIMALS } from '../game/data/animals';

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
    const firstSixteen = Array.from({ length: 16 }, () => first.next());
    const secondSixteen = Array.from({ length: 16 }, () => second.next());

    expect(firstSixteen).toEqual(secondSixteen);
    expect(new Set(firstSixteen.slice(0, 8))).toEqual(new Set(ANIMAL_IDS));
    expect(new Set(firstSixteen.slice(8, 16))).toEqual(new Set(ANIMAL_IDS));
    expect(firstSixteen[7]).not.toBe(firstSixteen[8]);
  });

  it('previews without consuming animals', () => {
    const queue = new SeededAnimalQueue(9);
    const preview = queue.preview(5);

    expect(queue.drawCount).toBe(0);
    expect(Array.from({ length: 5 }, () => queue.next())).toEqual(preview);
  });
});

describe('animal data', () => {
  it('defines all eight render and physics contracts', () => {
    expect(ANIMALS.map((animal) => animal.id)).toEqual(ANIMAL_IDS);
    for (const animal of ANIMALS) {
      expect(animal.display.width).toBeGreaterThan(0);
      expect(animal.display.height).toBeGreaterThan(0);
      expect(animal.allowedAngles).toContain(0);
      expect(animal.collision.outline.length).toBeGreaterThan(2);
      expect(animal.physics.friction).toBeGreaterThanOrEqual(0);
      expect(animal.physics.restitution).toBeGreaterThanOrEqual(0);
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
