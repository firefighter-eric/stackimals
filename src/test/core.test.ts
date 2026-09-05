import { describe, expect, it } from 'vitest';

import { SeededAnimalQueue } from '../game/core/animalQueue';
import { canActorAim, isOutOfPlay, resolveFallOutcome } from '../game/core/matchRules';
import { SeededRandom } from '../game/core/prng';
import { StabilityDetector, isBodyAtRest } from '../game/core/stability';
import { ANIMAL_IDS } from '../game/core/types';
import { ANIMALS, getAnimalCopy } from '../game/data/animals';
import {
  WOOD_CONTACT_SLOP,
  WOOD_PLATFORM_PHYSICS,
  WOOD_SLEEP_THRESHOLD,
  WOOD_SOLVER_ITERATIONS,
} from '../game/data/woodPhysics';

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
      expect(animal.physics.restitution, `${animal.id}: wooden restitution`).toBeLessThanOrEqual(0.009);
      expect(animal.physics.frictionAir, `${animal.id}: impact damping`).toBeGreaterThanOrEqual(0.04);
      expect(animal.physics.frictionAir, `${animal.id}: impact damping ceiling`).toBeLessThanOrEqual(0.06);
      expect(animal.physics.friction, `${animal.id}: sliding friction`).toBeGreaterThan(0);
      const minimumStableStaticFriction = animal.id === 'tiger' ? 1.15 : 2.6;
      expect(animal.physics.friction, `${animal.id}: stable kinetic-friction ceiling`).toBeLessThanOrEqual(
        0.2,
      );
      expect(animal.physics.frictionStatic, `${animal.id}: wooden static friction`).toBeGreaterThanOrEqual(
        minimumStableStaticFriction,
      );
      expect(
        animal.physics.friction * animal.physics.frictionStatic,
        `${animal.id}: near-rest wooden grip`,
      ).toBeGreaterThanOrEqual(0.1);
      expect(animal.physics.frictionStatic, `${animal.id}: static friction exceeds sliding`).toBeGreaterThan(
        animal.physics.friction,
      );
    }

    expect(WOOD_PLATFORM_PHYSICS.friction).toBeLessThanOrEqual(0.9);
    expect(WOOD_PLATFORM_PHYSICS.frictionStatic).toBeGreaterThanOrEqual(1.25);
    expect(WOOD_PLATFORM_PHYSICS.restitution).toBeLessThanOrEqual(0.006);
    expect(WOOD_CONTACT_SLOP).toBeGreaterThanOrEqual(0.1);
    expect(WOOD_CONTACT_SLOP).toBeLessThanOrEqual(0.2);
    expect(WOOD_SLEEP_THRESHOLD).toBeLessThanOrEqual(15);
    expect(WOOD_SOLVER_ITERATIONS.position).toBeLessThanOrEqual(6);
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

  it('enforces the default quiet window, deadline, and missing-motion contract', () => {
    const stable = new StabilityDetector();
    stable.sample(0, [quietBody]);
    expect(stable.sample(849, [quietBody]).state).toBe('moving');
    expect(stable.sample(850, [quietBody]).state).toBe('stable');
    const unsettled = new StabilityDetector();
    unsettled.sample(0, [movingBody]);
    expect(unsettled.sample(7999, [movingBody]).state).toBe('moving');
    expect(unsettled.sample(8000, [movingBody]).state).toBe('timed-out');
    expect(isBodyAtRest({ id: 'unknown-motion' })).toBe(false);
  });
});

describe('resolveFallOutcome', () => {
  it('keeps late consequences with the last releaser until the next actual drop', () => {
    for (const phase of ['aiming', 'thinking'] as const) {
      expect(resolveFallOutcome({
        phase,
        actingActor: 'player',
        lastActingActor: 'ai',
        fallenBodies: [{ id: 'old-player-body', owner: 'player' }],
      })).toEqual({ winner: 'player', loser: 'ai', reason: 'chain-reaction', fallenBodyIds: ['old-player-body'] });
    }
    expect(resolveFallOutcome({
      phase: 'dropping', actingActor: 'player', lastActingActor: 'ai',
      fallenBodies: [{ id: 'old-ai-body', owner: 'ai' }],
    })?.loser).toBe('player');
  });

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

  it('uses the body owner only when no release exists, and ignores empty falls', () => {
    expect(resolveFallOutcome({ phase: 'aiming', fallenBodies: [] })).toBeNull();
    expect(resolveFallOutcome({ phase: 'aiming', fallenBodies: [{ id: 'orphan', owner: 'ai' }] }))
      .toMatchObject({ loser: 'ai', reason: 'unattributed-fall' });
  });
});

describe('playfield and input boundaries', () => {
  it('waits for the entire body to cross a fall boundary', () => {
    const bounds = { minX: -70, maxX: 460 };
    expect(isOutOfPlay({ minX: 0, maxX: 20, minY: 695, maxY: 715 }, 695, bounds)).toBe(false);
    expect(isOutOfPlay({ minX: 0, maxX: 20, minY: 695.01, maxY: 715 }, 695, bounds)).toBe(true);
    expect(isOutOfPlay({ minX: -90, maxX: -70, minY: 0, maxY: 20 }, 695, bounds)).toBe(false);
    expect(isOutOfPlay({ minX: -90, maxX: -70.01, minY: 0, maxY: 20 }, 695, bounds)).toBe(true);
    expect(isOutOfPlay({ minX: 460, maxX: 480, minY: 0, maxY: 20 }, 695, bounds)).toBe(false);
    expect(isOutOfPlay({ minX: 460.01, maxX: 480, minY: 0, maxY: 20 }, 695, bounds)).toBe(true);
  });

  it('allows only the active actor to aim and never permits play during resolution', () => {
    expect(canActorAim('aiming', 'player', 'player')).toBe(true);
    expect(canActorAim('aiming', 'ai', 'player')).toBe(false);
    for (const phase of ['ready', 'thinking', 'dropping', 'settling', 'game-over'] as const) {
      expect(canActorAim(phase, 'player', 'player')).toBe(false);
    }
  });
});
